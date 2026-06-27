/**
 * Reddit HTML Scraper — scrapes old.reddit.com directly with axios + cheerio.
 * No API key, no PullPush. Works on public HTML pages.
 * Browses subreddit /top/?t=all listing pages, then fetches each post detail.
 */
import axios from 'axios';
import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as path from 'path';
import pLimit from 'p-limit';
import { v4 as uuidv4 } from 'uuid';
import { RawIncident, Comment } from '../types';
import { logger } from '../utils/logger';
import { sleep } from '../utils/rate-limiter';
import { extractDeviceInfo } from '../utils/device-extractor';
import { config } from '../config';
import { BULK_SUBREDDITS } from './reddit-bulk-scraper';
import { proxyRotator, getAxiosProxyConfig, reportProxyRateLimit } from '../utils/proxy-rotator';

const BASE = 'https://old.reddit.com';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

// Direct connection — Reddit allows ~0.3 req/sec sustained without banning
const REQUEST_DELAY = 5000;   // between listing pages
const DETAIL_DELAY  = 3000;   // between post detail pages
const DETAIL_CONCURRENCY = 2; // 2 workers × 3s = ~0.67 req/sec total
const MAX_EMPTY_PAGES = 8;    // skip subreddit after 8 consecutive all-seen pages

// ─────────────────────────────────────────────────────────────────
// Checkpoint
// ─────────────────────────────────────────────────────────────────
interface RedditHtmlCheckpoint {
  subredditProgress: Record<string, { after: string; collected: number; done: boolean }>;
  totalCollected: number;
  lastUpdated: string;
}

function loadCheckpoint(filePath: string): RedditHtmlCheckpoint {
  try {
    if (fs.existsSync(filePath)) return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch { /* start fresh */ }
  return { subredditProgress: {}, totalCollected: 0, lastUpdated: '' };
}

function saveCheckpoint(filePath: string, cp: RedditHtmlCheckpoint): void {
  cp.lastUpdated = new Date().toISOString();
  fs.writeFileSync(filePath, JSON.stringify(cp), { encoding: 'utf8' });
}

// ─────────────────────────────────────────────────────────────────
// HTTP helpers
// ─────────────────────────────────────────────────────────────────
// Reddit blocks datacenter proxies. Always use direct connection for old.reddit.com.
async function fetchHtml(url: string, retries = 3): Promise<string | null> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await axios.get<string>(url, { headers: HEADERS, timeout: 20000 });
      return res.data;
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } }).response?.status;
      if (status === 429) {
        logger.warn(`Reddit rate limit (direct). Waiting ${30 * (i + 1)}s...`);
        await sleep(30000 * (i + 1));
        continue;
      }
      if (status === 403 || status === 404) return null;
      if (i < retries - 1) await sleep(4000);
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────
// Parse listing page — returns [{permalink, title, score, domain}]
// ─────────────────────────────────────────────────────────────────
interface ListingPost {
  permalink: string;
  title: string;
  score: number;
  isSelf: boolean;
  fullname: string;
}

function parseListing(html: string): { posts: ListingPost[]; nextAfter: string | null } {
  const $ = cheerio.load(html);
  const posts: ListingPost[] = [];

  $('.thing').each((_, el) => {
    const domain = $(el).attr('data-domain') || '';
    const isSelf = domain.startsWith('self.');
    const permalink = $(el).attr('data-permalink') || '';
    const title = $(el).find('a.title').first().text().trim();
    const score = parseInt($(el).attr('data-score') || '0', 10);
    const fullname = $(el).attr('data-fullname') || '';

    if (permalink && title) {
      posts.push({ permalink, title, score, isSelf, fullname });
    }
  });

  const nextHref = $('.next-button a').attr('href') || null;
  const nextAfter = nextHref ? (new URL(nextHref).searchParams.get('after') ?? null) : null;

  return { posts, nextAfter };
}

// ─────────────────────────────────────────────────────────────────
// Parse post detail page — returns body + comments
// ─────────────────────────────────────────────────────────────────
function parsePost(html: string, url: string, sourceName: string, title: string): RawIncident | null {
  const $ = cheerio.load(html);

  // Body text — first .expando on the page (the OP's post)
  const body = $('.thing.self .expando .usertext-body .md, .expando .usertext-body .md')
    .first().text().trim();

  if (!body || body.length < config.minBodyLength) return null;

  const comments: Comment[] = [];
  $('.commentarea .comment').slice(0, 15).each((_, el) => {
    // Only top-level comments (direct child text content)
    const commentBody = $(el).find('> .entry .usertext-body .md').first().text().trim();
    if (!commentBody || commentBody === '[deleted]' || commentBody === '[removed]') return;

    const scoreText = $(el).find('.score').first().text().replace(/[^0-9\-]/g, '') || '0';
    const score = parseInt(scoreText, 10) || 0;
    const author = $(el).find('.author').first().text().trim() || 'unknown';
    const dateEl = $(el).find('time').first();
    const created_at = dateEl.attr('datetime') || new Date().toISOString();

    comments.push({ author, body: commentBody, score, is_accepted: false, created_at });
  });

  // Best comment as solution
  const best = [...comments].sort((a, b) => b.score - a.score)[0];
  const questionDate = $('time[datetime]').first().attr('datetime') || new Date().toISOString();
  const deviceInfo = extractDeviceInfo(title, body);

  return {
    id: uuidv4(),
    source: sourceName,
    url,
    title,
    body,
    comments,
    accepted_solution: best?.body || '',
    created_at: questionDate,
    device_name: deviceInfo.device_name,
    device_brand: deviceInfo.device_brand,
    device_model: deviceInfo.device_model,
    scraped_at: new Date().toISOString(),
  };
}

// ─────────────────────────────────────────────────────────────────
// Per-subreddit scraper
// ─────────────────────────────────────────────────────────────────
async function scrapeSubreddit(
  subreddit: string,
  existingUrls: Set<string>,
  onIncident: (i: RawIncident) => void,
  maxPerSub: number,
  maxPages: number,
  detailLimit: ReturnType<typeof pLimit>,
  initialAfter: string,
): Promise<{ collected: number; lastAfter: string }> {
  let after = initialAfter;
  let collected = 0;
  let page = 0;
  let emptyPages = 0; // consecutive pages with no new posts (all in existingUrls)
  const seen = new Set<string>();

  while (collected < maxPerSub && page < maxPages) {
    const listUrl = after
      ? `${BASE}/r/${subreddit}/top/?t=all&count=${page * 25}&after=${after}`
      : `${BASE}/r/${subreddit}/top/?t=all`;

    await sleep(REQUEST_DELAY);
    const html = await fetchHtml(listUrl);
    page++;

    if (!html) {
      logger.warn(`Reddit HTML r/${subreddit}: no response on page ${page}, skipping`);
      break;
    }

    const { posts, nextAfter } = parseListing(html);

    if (posts.length === 0) break;

    if (page % 5 === 0) {
      logger.info(`Reddit HTML r/${subreddit}: page ${page}, collected ${collected} so far`);
    }

    // Fetch detail pages concurrently for self-posts only
    const selfPosts = posts.filter(p => p.isSelf && p.score >= 1);
    const newPosts = selfPosts.filter(p => !existingUrls.has(`${BASE}${p.permalink}`) && !seen.has(`${BASE}${p.permalink}`));

    if (newPosts.length === 0) {
      emptyPages++;
      if (emptyPages >= MAX_EMPTY_PAGES) {
        logger.info(`Reddit HTML r/${subreddit}: ${MAX_EMPTY_PAGES} consecutive all-seen pages, moving on`);
        break;
      }
      if (!nextAfter) break;
      after = nextAfter;
      continue;
    }
    emptyPages = 0;

    const tasks = newPosts.map(p =>
      detailLimit(async () => {
        if (collected >= maxPerSub) return;
        const fullUrl = `${BASE}${p.permalink}`;
        if (existingUrls.has(fullUrl)) return;
        if (seen.has(fullUrl)) return;
        seen.add(fullUrl);

        await sleep(DETAIL_DELAY);
        const detailHtml = await fetchHtml(fullUrl);
        if (!detailHtml) return;

        const incident = parsePost(detailHtml, fullUrl, `reddit/r/${subreddit}`, p.title);
        if (incident) {
          onIncident(incident);
          collected++;
        }
      })
    );

    await Promise.all(tasks);

    if (!nextAfter) break;
    after = nextAfter;
  }

  return { collected, lastAfter: after };
}

// ─────────────────────────────────────────────────────────────────
// Main scraper class
// ─────────────────────────────────────────────────────────────────
export class RedditHtmlScraper {
  private checkpointFile = path.join(config.rawDataDir, 'reddit_html_checkpoint.json');

  async scrapeAll(
    existingUrls: Set<string>,
    onIncident: (incident: RawIncident) => void,
  ): Promise<void> {
    const cp = loadCheckpoint(this.checkpointFile);
    const maxTotal = config.maxIncidentsPerSource;
    const maxPerSub = Math.ceil(maxTotal / BULK_SUBREDDITS.length) + 200;
    const maxPages = 100; // 100 pages × 25 posts = 2500 posts per subreddit max
    const detailLimit = pLimit(DETAIL_CONCURRENCY);

    let totalCollected = cp.totalCollected;
    const pending = BULK_SUBREDDITS.filter(sub => !cp.subredditProgress[sub]?.done);

    logger.info(`Reddit HTML: ${pending.length} subreddits to scrape, max ${maxPerSub}/sub`);
    logger.info(`  proxies=${proxyRotator.count}, concurrency=${DETAIL_CONCURRENCY}, listingDelay=${REQUEST_DELAY}ms, detailDelay=${DETAIL_DELAY}ms`);

    for (const sub of pending) {
      if (totalCollected >= maxTotal) break;

      const subState = cp.subredditProgress[sub];
      const initialAfter = subState?.after ?? '';

      logger.info(`Reddit HTML r/${sub}: starting`);

      const { collected, lastAfter } = await scrapeSubreddit(
        sub, existingUrls, onIncident, maxPerSub, maxPages, detailLimit, initialAfter,
      );

      totalCollected += collected;
      cp.subredditProgress[sub] = { after: lastAfter, collected, done: true };
      cp.totalCollected = totalCollected;
      saveCheckpoint(this.checkpointFile, cp);

      logger.success(`Reddit HTML r/${sub}: +${collected} (total: ${totalCollected}/${maxTotal})`);
    }

    logger.success(`Reddit HTML scraper done. Total: ${totalCollected}`);
  }
}

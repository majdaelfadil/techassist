/**
 * AnandTech Forum Scraper — XenForo-based IT support forum.
 * 15 IT-relevant forums with thousands of pages each.
 * Uses axios + cheerio (no browser). Streaming pipeline.
 */
import axios from 'axios';
import * as cheerio from 'cheerio';
import pLimit from 'p-limit';
import { v4 as uuidv4 } from 'uuid';
import { RawIncident, Comment } from '../types';
import { logger } from '../utils/logger';
import { sleep } from '../utils/rate-limiter';
import { extractDeviceInfo } from '../utils/device-extractor';
import { config } from '../config';

const BASE = 'https://forums.anandtech.com';

const FORUMS = [
  { id: 10,  slug: 'windows',                        name: 'at-windows' },
  { id: 11,  slug: 'operating-systems',              name: 'at-os' },
  { id: 12,  slug: 'networking',                     name: 'at-networking' },
  { id: 41,  slug: 'security',                       name: 'at-security' },
  { id: 23,  slug: 'laptops',                        name: 'at-laptops' },
  { id: 47,  slug: 'memory-and-storage',             name: 'at-storage' },
  { id: 5,   slug: 'cpus-and-overclocking',          name: 'at-cpu' },
  { id: 6,   slug: 'motherboards',                   name: 'at-motherboards' },
  { id: 8,   slug: 'graphics-cards',                 name: 'at-gpu' },
  { id: 48,  slug: 'power-supplies',                 name: 'at-psu' },
  { id: 45,  slug: 'apple',                          name: 'at-apple' },
  { id: 79,  slug: 'apple-laptops-and-desktops',     name: 'at-apple-hw' },
  { id: 46,  slug: 'open-source',                    name: 'at-linux' },
  { id: 37,  slug: 'mobile-devices',                 name: 'at-mobile' },
  { id: 22,  slug: 'ask-a-technical-professional',   name: 'at-pro' },
];

const MAX_PAGES_PER_FORUM = 120;
const LISTING_CONCURRENCY = 4;
const DETAIL_CONCURRENCY  = 8;
const LISTING_DELAY = 1200;
const DETAIL_DELAY  = 900;
const AT_403_COOLDOWN_MS = 3 * 60 * 60 * 1000; // 3 hr — stops refreshing AnandTech's IP ban

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Connection': 'keep-alive',
};

// Global 403 cooldown — when set, ALL AT requests wait before proceeding
let at403Cooldown = 0;

async function fetchHtml(url: string, retries = 3): Promise<string | null> {
  // Wait out any active IP ban before making the request
  const now = Date.now();
  if (at403Cooldown > now) {
    await sleep(at403Cooldown - now + Math.floor(Math.random() * 8000));
  }

  for (let i = 0; i < retries; i++) {
    try {
      const res = await axios.get<string>(url, { headers: HEADERS, timeout: 15000 });
      return res.data;
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } }).response?.status;
      if (status === 429) { await sleep(20000 * (i + 1)); continue; }
      if (status === 403) {
        at403Cooldown = Date.now() + AT_403_COOLDOWN_MS;
        return null; // caller checks cooldown and retries
      }
      if (status === 404 || status === 410) return null;
      if (i < retries - 1) await sleep(2000);
    }
  }
  return null;
}

function parseThreadLinks(html: string): string[] {
  const $ = cheerio.load(html);
  const seen = new Set<string>();
  const urls: string[] = [];

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const match = href.match(/\/threads\/[a-z0-9-]+\.\d+\//);
    if (match) {
      const full = `${BASE}${match[0]}`;
      if (!seen.has(full)) { seen.add(full); urls.push(full); }
    }
  });

  return urls;
}

function parseThread(html: string, url: string, sourceName: string): RawIncident | null {
  const $ = cheerio.load(html);

  const title = $('.p-title-value, h1.thread-title').first().text().trim();
  if (!title || title.length < 5) return null;

  const messages = $('.message');
  if (messages.length === 0) return null;

  // First message = question
  const firstMsgClone = $(messages.get(0)).find('.message-body .bbWrapper, .bbWrapper').clone();
  firstMsgClone.find('script, style, blockquote').remove();
  const body = firstMsgClone.text().trim().replace(/\s+/g, ' ');
  if (!body || body.length < config.minBodyLength) return null;

  // Replies = answers
  const comments: Comment[] = [];
  let acceptedSolution = '';

  messages.slice(1, 12).each((_, el) => {
    const replyClone = $(el).find('.message-body .bbWrapper, .bbWrapper').clone();
    replyClone.find('script, style, blockquote').remove();
    const replyBody = replyClone.text().trim().replace(/\s+/g, ' ');
    if (!replyBody || replyBody.length < 20) return;

    const author = $(el).find('.username, .message-name').first().text().trim() || 'user';
    const dateStr = $(el).find('time[datetime]').first().attr('datetime') || new Date().toISOString();
    comments.push({ author, body: replyBody, score: 0, is_accepted: false, created_at: dateStr });
    if (!acceptedSolution) acceptedSolution = replyBody;
  });

  const questionDate = $(messages.get(0)).find('time[datetime]').first().attr('datetime') || new Date().toISOString();
  const deviceInfo = extractDeviceInfo(title, body);

  return {
    id: uuidv4(),
    source: sourceName,
    url,
    title,
    body,
    comments,
    accepted_solution: acceptedSolution,
    created_at: questionDate,
    device_name: deviceInfo.device_name,
    device_brand: deviceInfo.device_brand,
    device_model: deviceInfo.device_model,
    scraped_at: new Date().toISOString(),
  };
}

export class AnandTechScraper {
  async scrapeAll(
    existingUrls: Set<string>,
    onIncident: (incident: RawIncident) => void,
  ): Promise<void> {
    const listingLimit = pLimit(LISTING_CONCURRENCY);
    const detailLimit  = pLimit(DETAIL_CONCURRENCY);
    const globalSeen   = new Set<string>();
    let totalCollected = 0;

    const processUrl = (url: string, sourceName: string): Promise<void> =>
      detailLimit(async () => {
        if (existingUrls.has(url) || globalSeen.has(url)) return;
        if (totalCollected >= config.maxIncidentsPerSource) return;
        globalSeen.add(url);

        await sleep(DETAIL_DELAY);
        const html = await fetchHtml(url);
        if (!html) return;

        const incident = parseThread(html, url, sourceName);
        if (incident) {
          onIncident(incident);
          totalCollected++;
          if (totalCollected % 100 === 0) {
            logger.info(`AnandTech: ${totalCollected} saved`);
          }
        }
      });

    logger.info(`AnandTech: ${FORUMS.length} forums × ${MAX_PAGES_PER_FORUM} pages, listConc=${LISTING_CONCURRENCY}, detailConc=${DETAIL_CONCURRENCY}`);

    await Promise.all(FORUMS.map(forum =>
      listingLimit(async () => {
        const detailTasks: Promise<void>[] = [];
        let topicsFound = 0;

        for (let page = 1; page <= MAX_PAGES_PER_FORUM; page++) {
          if (totalCollected >= config.maxIncidentsPerSource) break;

          const listUrl = page === 1
            ? `${BASE}/forums/${forum.slug}.${forum.id}/`
            : `${BASE}/forums/${forum.slug}.${forum.id}/page-${page}`;

          await sleep(LISTING_DELAY);
          let html = await fetchHtml(listUrl);

          // Loop until ban clears — each 403 extends the cooldown; keep waiting and retrying
          while (html === null && at403Cooldown > Date.now()) {
            const waitMs = at403Cooldown - Date.now();
            logger.warn(`AnandTech ${forum.name}: IP blocked — waiting ${Math.ceil(waitMs / 60000)}min before retry`);
            await sleep(waitMs + 5000 + Math.floor(Math.random() * 15000));
            html = await fetchHtml(listUrl);
          }

          if (!html) break;

          const threadUrls = parseThreadLinks(html);
          if (threadUrls.length === 0) break;

          topicsFound += threadUrls.length;
          threadUrls.forEach(u => {
            if (!existingUrls.has(u) && !globalSeen.has(u)) {
              detailTasks.push(processUrl(u, forum.name));
            }
          });
        }

        logger.info(`AnandTech ${forum.name}: ${topicsFound} topics queued`);
        await Promise.all(detailTasks);
        logger.success(`AnandTech ${forum.name}: done`);
      })
    ));

    logger.success(`AnandTech: finished. Total: ${totalCollected}`);
  }
}

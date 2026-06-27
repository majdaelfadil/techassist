/**
 * Stack Exchange HTML Scraper — scrapes superuser, serverfault, askubuntu, unix.se, etc.
 * Uses axios + cheerio (no browser). Concurrent requests for speed.
 * No API key required — just public HTML pages.
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
import { SE_EXTENDED_TAGS, SEARCH_KEYWORDS } from './it-keywords';
import { proxyRotator, getAxiosProxyConfig, reportProxyRateLimit } from '../utils/proxy-rotator';

const SE_SITES = [
  { host: 'superuser.com',                    name: 'superuser' },
  { host: 'serverfault.com',                  name: 'serverfault' },
  { host: 'askubuntu.com',                    name: 'askubuntu' },
  { host: 'unix.stackexchange.com',           name: 'unix-se' },
  { host: 'electronics.stackexchange.com',    name: 'electronics-se' },
  { host: 'raspberrypi.stackexchange.com',    name: 'raspberrypi-se' },
  { host: 'stackoverflow.com',                name: 'stackoverflow' },
  { host: 'security.stackexchange.com',       name: 'security-se' },
  { host: 'networkengineering.stackexchange.com', name: 'networkeng-se' },
  { host: 'apple.stackexchange.com',          name: 'apple-se' },
];

// Base tags (broad category coverage)
const SE_BASE_TAGS = [
  'networking', 'hardware', 'windows', 'router', 'printer',
  'firewall', 'vpn', 'storage', 'server', 'wireless-networking',
  'hard-drive', 'bios', 'drivers', 'switch', 'ups',
  'linux', 'ubuntu', 'ssh', 'dns', 'dhcp',
  'raid', 'backup', 'nas', 'virtualization', 'docker',
  'ethernet', 'wifi', 'ip-address', 'troubleshooting', 'crash',
];

// Combined: base tags + extended device-specific tags (deduplicated)
const SE_TAGS = [...new Set([...SE_BASE_TAGS, ...SE_EXTENDED_TAGS])];

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Cache-Control': 'max-age=0',
};

let se403Cooldown = 0; // unix ms — if nonzero, listing requests wait until this time

// ─────────────────────────────────────────────────────────────────
// HTTP helpers
// ─────────────────────────────────────────────────────────────────
async function fetchHtml(url: string, retries = 3): Promise<string | null> {
  // Honour global 403-cooldown (SE throttle recovery)
  const now = Date.now();
  if (se403Cooldown > now) await sleep(se403Cooldown - now);

  for (let i = 0; i < retries; i++) {
    try {
      const res = await axios.get<string>(url, { headers: HEADERS, timeout: 15000 });
      return res.data;
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } }).response?.status;
      if (status === 429) { await sleep(20000 * (i + 1)); continue; }
      if (status === 403) {
        // IP throttle — back off 90 seconds globally before any further SE requests
        se403Cooldown = Date.now() + 90000;
        return null;
      }
      if (status === 404 || status === 410) return null;
      if (i < retries - 1) await sleep(2000);
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────
// Listing page — returns question URLs
// ─────────────────────────────────────────────────────────────────
function parseQuestionLinks(html: string, host: string): string[] {
  const $ = cheerio.load(html);
  const urls: string[] = [];

  $('a').each((_, el) => {
    const href = $(el).attr('href') || '';
    if (/^\/questions\/\d+\/[^/]+\/?$/.test(href)) {
      const full = `https://${host}${href.split('#')[0]}`;
      if (!urls.includes(full)) urls.push(full);
    }
  });

  return urls.slice(0, 50);
}

// ─────────────────────────────────────────────────────────────────
// Question page — parses full incident
// ─────────────────────────────────────────────────────────────────
function parseQuestion(html: string, url: string, sourceName: string): RawIncident | null {
  const $ = cheerio.load(html);

  const title = $('h1[itemprop="name"] a, h1.question-hyperlink, #question-header h1')
    .first().text().trim()
    || $('title').text()
      .replace(/- Super User$/, '').replace(/- Server Fault$/, '')
      .replace(/- Ask Ubuntu$/, '').replace(/- Unix.*$/, '')
      .replace(/- Stack Overflow$/, '').trim();

  if (!title || title.length < 5) return null;

  // Question body
  const body = $('.question .s-prose, .question .post-text, #question .post-body')
    .first().text().trim();
  if (!body || body.length < config.minBodyLength) return null;

  // Answers
  const comments: Comment[] = [];
  let acceptedSolution = '';

  $('.answer').each((i, el) => {
    if (i >= 10) return;
    const isAccepted = $(el).hasClass('accepted-answer')
      || $(el).find('.accepted-answer-indicator, svg[aria-hidden="true"][class*="accepted"]').length > 0;
    const answerBody = $(el).find('.s-prose, .post-text').first().text().trim();
    const score = parseInt($(el).find('.js-vote-count, .vote-count-post').first().text().trim() || '0', 10);
    const author = $(el).find('.user-details a, [itemprop="author"] span').first().text().trim();
    const dateEl = $(el).find('time[datetime]').first();
    const created_at = dateEl.attr('datetime') || new Date().toISOString();

    if (answerBody.length > 20) {
      comments.push({ author, body: answerBody, score, is_accepted: isAccepted, created_at });
      if (isAccepted && !acceptedSolution) acceptedSolution = answerBody;
    }
  });

  if (!acceptedSolution && comments.length > 0) {
    acceptedSolution = [...comments].sort((a, b) => b.score - a.score)[0].body;
  }

  const questionDate = $('.question time[datetime]').first().attr('datetime') || new Date().toISOString();
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

// ─────────────────────────────────────────────────────────────────
// Main scraper — streaming pipeline (listing → detail in parallel)
// ─────────────────────────────────────────────────────────────────
export class SuperUserScraper {
  async scrapeAll(
    existingUrls: Set<string>,
    onIncident: (incident: RawIncident) => void
  ): Promise<void> {
    const pagesPerTag = config.sePagesPerTag;

    // Direct connection — SE works fine without proxies at these rates
    const listingConcurrency = 5;   // ~1 worker per site
    const detailConcurrency  = 12;  // ~2 workers per site
    const listingDelay       = 1000;
    const detailDelay        = 700;

    logger.info(`Stack Exchange: direct, listingConc=${listingConcurrency}, detailConc=${detailConcurrency}`);

    const listingLimit = pLimit(listingConcurrency);
    const detailLimit  = pLimit(detailConcurrency);

    let totalCollected = 0;
    const globalSeen   = new Set<string>();

    const processUrl = (url: string, siteName: string): Promise<void> =>
      detailLimit(async () => {
        if (existingUrls.has(url) || globalSeen.has(url)) return;
        if (totalCollected >= config.maxIncidentsPerSource) return;
        globalSeen.add(url);

        await sleep(detailDelay);
        const html = await fetchHtml(url);
        if (!html) return;

        const incident = parseQuestion(html, url, siteName);
        if (incident) {
          onIncident(incident);
          totalCollected++;
          if (totalCollected % 200 === 0) {
            logger.info(`Stack Exchange: ${totalCollected} saved so far`);
          }
        }
      });

    // Process all sites in parallel
    await Promise.all(SE_SITES.map(async ({ host, name }) => {
      logger.info(`SE ${name}: starting listing crawl (${SE_TAGS.length} tags × ${pagesPerTag} pages)`);

      const detailTasks: Promise<void>[] = [];

      // Helper: parse a listing page and immediately enqueue its detail pages
      const processListingPage = async (url: string) => {
        await sleep(listingDelay);
        const html = await fetchHtml(url);
        if (!html) return 0;
        const urls = parseQuestionLinks(html, host);
        urls.forEach(u => {
          if (!existingUrls.has(u) && !globalSeen.has(u)) {
            detailTasks.push(processUrl(u, name));
          }
        });
        return urls.length;
      };

      // Phase 1: all tags concurrently
      await Promise.all(SE_TAGS.map(tag =>
        listingLimit(async () => {
          for (let page = 1; page <= pagesPerTag; page++) {
            if (totalCollected >= config.maxIncidentsPerSource) break;
            const listUrl = `https://${host}/questions/tagged/${encodeURIComponent(tag)}?tab=votes&page=${page}&pagesize=50`;
            const count = await processListingPage(listUrl);
            if (count === 0) break;
          }
        })
      ));

      // Phase 2: keyword search
      await Promise.all(SEARCH_KEYWORDS.slice(0, 100).map(keyword =>
        listingLimit(async () => {
          if (totalCollected >= config.maxIncidentsPerSource) return;
          const searchUrl = `https://${host}/search?q=${encodeURIComponent(keyword + ' solved')}&tab=relevance`;
          await processListingPage(searchUrl);
        })
      ));

      // Wait for all detail fetches for this site
      await Promise.all(detailTasks);
      logger.success(`SE ${name}: done. Total so far: ${totalCollected}`);
    }));

    logger.success(`Stack Exchange HTML: finished. Total: ${totalCollected}`);
  }
}

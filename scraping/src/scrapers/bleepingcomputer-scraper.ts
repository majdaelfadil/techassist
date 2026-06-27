/**
 * BleepingComputer Forum Scraper — scrapes IT support topics with axios + cheerio.
 * Covers 15 high-value forums: Windows, hardware, networking, security, Linux.
 * Streaming pipeline: detail pages fetched as listing pages complete.
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

const BASE = 'https://www.bleepingcomputer.com';

const FORUMS = [
  { id: 76,  slug: 'microsoft-windows-support',              name: 'bc-windows' },
  { id: 233, slug: 'windows-crashes-and-blue-screen-of-death-bsod-help-and-support', name: 'bc-bsod' },
  { id: 229, slug: 'windows-10-support',                     name: 'bc-win10' },
  { id: 250, slug: 'windows-11',                             name: 'bc-win11' },
  { id: 83,  slug: 'windows-server',                         name: 'bc-winserver' },
  { id: 167, slug: 'windows-7',                             name: 'bc-win7' },
  { id: 209, slug: 'windows-8-and-windows-81',              name: 'bc-win8' },
  { id: 137, slug: 'hardware',                               name: 'bc-hardware' },
  { id: 7,   slug: 'internal-hardware',                      name: 'bc-int-hw' },
  { id: 138, slug: 'external-hardware',                      name: 'bc-ext-hw' },
  { id: 139, slug: 'system-building-and-upgrading',          name: 'bc-sysbuilding' },
  { id: 11,  slug: 'linux-unix',                             name: 'bc-linux' },
  { id: 172, slug: 'mac-os',                                 name: 'bc-mac' },
  { id: 232, slug: 'alternative-operating-systems-support', name: 'bc-altos' },
  { id: 21,  slug: 'networking',                             name: 'bc-networking' },
  { id: 22,  slug: 'virus-trojan-spyware-and-malware-removal-help', name: 'bc-malware' },
  { id: 45,  slug: 'general-security',                       name: 'bc-security' },
  { id: 239, slug: 'ransomware-help-tech-support',           name: 'bc-ransomware' },
  { id: 238, slug: 'backup-imaging-and-disk-management-software', name: 'bc-backup' },
  { id: 222, slug: 'firewall-software-and-hardware',         name: 'bc-firewall' },
  { id: 103, slug: 'am-i-infected-what-do-i-do',             name: 'bc-infected' },
  { id: 243, slug: 'virtual-machines-and-vm-programs',       name: 'bc-vm' },
  { id: 16,  slug: 'business-applications',                  name: 'bc-bizapps' },
  { id: 57,  slug: 'all-other-applications',                 name: 'bc-apps' },
  { id: 215, slug: 'tablets-mobile-devices',                 name: 'bc-mobile' },
];

const MAX_PAGES_PER_FORUM = 100;  // ~100 × 31 topics = 3100 topics per forum
const LISTING_CONCURRENCY = 6;
const DETAIL_CONCURRENCY  = 25;  // shared across all forums — high count drains queue fast
const LISTING_DELAY = 800;
const DETAIL_DELAY  = 500;

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Connection': 'keep-alive',
};

// ─────────────────────────────────────────────────────────────────
// HTTP
// ─────────────────────────────────────────────────────────────────
async function fetchHtml(url: string, retries = 3): Promise<string | null> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await axios.get<string>(url, { headers: HEADERS, timeout: 15000 });
      return res.data;
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } }).response?.status;
      if (status === 429) { await sleep(15000 * (i + 1)); continue; }
      if (status === 403 || status === 404 || status === 410) return null;
      if (i < retries - 1) await sleep(2000);
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────
// Listing page — extract topic URLs
// ─────────────────────────────────────────────────────────────────
function parseTopicLinks(html: string): string[] {
  const $ = cheerio.load(html);
  const seen = new Set<string>();
  const urls: string[] = [];

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const match = href.match(/^https?:\/\/www\.bleepingcomputer\.com\/forums\/t\/\d+\/[^/?#]+/);
    if (match && !seen.has(match[0])) {
      seen.add(match[0]);
      urls.push(match[0]);
    }
  });

  return urls;
}

// ─────────────────────────────────────────────────────────────────
// Topic detail page — parse incident
// ─────────────────────────────────────────────────────────────────
function parseTopic(html: string, url: string, sourceName: string): RawIncident | null {
  const $ = cheerio.load(html);

  const title = $('.ipsType_pagetitle, h1').first().text().trim();
  if (!title || title.length < 5) return null;

  const posts = $('.post_block');
  if (posts.length === 0) return null;

  // First post = the question body (strip script/style tags first)
  const firstPostEl = $(posts.get(0));
  const firstPostClone = firstPostEl.find('.post_body').clone();
  firstPostClone.find('script, style, .ipQuoteContainer').remove();
  const body = firstPostClone.text().trim().replace(/\s+/g, ' ');

  if (!body || body.length < config.minBodyLength) return null;

  // Replies = answers
  const comments: Comment[] = [];
  let acceptedSolution = '';

  posts.slice(1, 12).each((_, el) => {
    const replyClone = $(el).find('.post_body').clone();
    replyClone.find('script, style, .ipQuoteContainer').remove();
    const replyBody = replyClone.text().trim().replace(/\s+/g, ' ');
    if (!replyBody || replyBody.length < 20) return;

    const author = $(el).find('.post_author_name a, .memberName').first().text().trim() || 'user';
    comments.push({ author, body: replyBody, score: 0, is_accepted: false, created_at: new Date().toISOString() });
    if (!acceptedSolution) acceptedSolution = replyBody;
  });

  const questionDate = $('time').first().attr('datetime') || new Date().toISOString();
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
// Main scraper
// ─────────────────────────────────────────────────────────────────
export class BleepingComputerScraper {
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

        const incident = parseTopic(html, url, sourceName);
        if (incident) {
          onIncident(incident);
          totalCollected++;
          if (totalCollected % 100 === 0) {
            logger.info(`BleepingComputer: ${totalCollected} saved`);
          }
        }
      });

    logger.info(`BleepingComputer: ${FORUMS.length} forums × ${MAX_PAGES_PER_FORUM} pages, listConc=${LISTING_CONCURRENCY}, detailConc=${DETAIL_CONCURRENCY}`);

    await Promise.all(FORUMS.map(forum =>
      listingLimit(async () => {
        const detailTasks: Promise<void>[] = [];
        let topicsFound = 0;

        for (let page = 1; page <= MAX_PAGES_PER_FORUM; page++) {
          if (totalCollected >= config.maxIncidentsPerSource) break;

          const listUrl = page === 1
            ? `${BASE}/forums/f/${forum.id}/${forum.slug}/`
            : `${BASE}/forums/f/${forum.id}/${forum.slug}/page-${page}?prune_day=100&sort_by=Z-A&sort_key=last_post&topicfilter=all`;

          await sleep(LISTING_DELAY);
          const html = await fetchHtml(listUrl);
          if (!html) break;

          const topicUrls = parseTopicLinks(html);
          if (topicUrls.length === 0) break;

          topicsFound += topicUrls.length;
          topicUrls.forEach(u => {
            if (!existingUrls.has(u) && !globalSeen.has(u)) {
              detailTasks.push(processUrl(u, forum.name));
            }
          });
        }

        logger.info(`BleepingComputer ${forum.name}: ${topicsFound} topics queued`);
        await Promise.all(detailTasks);
        logger.success(`BleepingComputer ${forum.name}: done`);
      })
    ));

    logger.success(`BleepingComputer: finished. Total: ${totalCollected}`);
  }
}

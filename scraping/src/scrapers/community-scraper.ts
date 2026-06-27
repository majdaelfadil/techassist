/**
 * Community Forum Scraper — covers Tier 2-6 sites from the user's list.
 * Supports Discourse, phpBB, XenForo, and LinuxQuestions.
 * Uses axios + cheerio (no browser, no API keys).
 *
 * Sites:
 *   Discourse: Proxmox Forum, TrueNAS Forums, TP-Link Community
 *   phpBB:     MikroTik Forum
 *   XenForo:   IP Cam Talk
 *   Custom:    LinuxQuestions.org
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
import { COMMUNITY_SITES, CommunitySite } from './it-keywords';
import { proxyRotator, getAxiosProxyConfig, reportProxyRateLimit } from '../utils/proxy-rotator';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

async function fetchHtml(url: string, retries = 3): Promise<string | null> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await axios.get<string>(url, { headers: HEADERS, timeout: 15000 });
      return res.data;
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } }).response?.status;
      if (status === 429) { await sleep(20000 * (i + 1)); continue; }
      if (status === 404 || status === 410 || status === 403) return null;
      if (i < retries - 1) await sleep(3000);
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────
// Discourse scraper — uses .json endpoints (no JS required, no key)
// ─────────────────────────────────────────────────────────────────
interface DiscourseTopicList {
  topic_list?: { topics?: Array<{ id: number; slug: string; title: string; posts_count: number }> };
}
interface DiscourseTopicDetail {
  title?: string;
  post_stream?: {
    posts?: Array<{ username?: string; cooked?: string; created_at?: string; accepted_answer?: boolean }>;
  };
}

async function fetchJson<T>(url: string): Promise<T | null> {
  const raw = await fetchHtml(url);
  if (!raw) return null;
  try { return JSON.parse(raw) as T; } catch { return null; }
}

function discourseTopicToIncident(data: DiscourseTopicDetail, url: string, sourceName: string): RawIncident | null {
  const title = data.title?.trim() || '';
  if (!title || title.length < 5) return null;

  const posts = (data.post_stream?.posts ?? [])
    .filter(p => p.cooked && p.cooked.length > 20);

  if (posts.length === 0) return null;

  const op = posts[0];
  const opBody = cheerio.load(op.cooked ?? '').text().trim();
  if (opBody.length < config.minBodyLength) return null;

  const comments: Comment[] = posts.slice(1).map(p => ({
    author: p.username ?? 'unknown',
    body: cheerio.load(p.cooked ?? '').text().trim(),
    score: 0,
    is_accepted: p.accepted_answer ?? false,
    created_at: p.created_at ?? new Date().toISOString(),
  })).filter(c => c.body.length > 10);

  const accepted = comments.find(c => c.is_accepted)?.body
    || comments[0]?.body || '';

  const deviceInfo = extractDeviceInfo(title, opBody);
  return {
    id: uuidv4(), source: sourceName, url, title, body: opBody, comments,
    accepted_solution: accepted,
    created_at: op.created_at ?? new Date().toISOString(),
    device_name: deviceInfo.device_name,
    device_brand: deviceInfo.device_brand,
    device_model: deviceInfo.device_model,
    scraped_at: new Date().toISOString(),
  };
}

async function scrapeDiscourse(
  site: CommunitySite,
  existingUrls: Set<string>,
  onIncident: (incident: RawIncident) => void,
  limit: ReturnType<typeof pLimit>,
): Promise<number> {
  const host = site.host;
  const name = site.name;
  let collected = 0;
  const seenIds = new Set<number>();
  const topicIds: Array<{ id: number; slug: string }> = [];

  const addTopic = (id: number, slug: string) => {
    if (!seenIds.has(id)) { seenIds.add(id); topicIds.push({ id, slug }); }
  };

  // /latest.json — paginated list of recent topics
  for (let page = 0; page < site.maxPages; page++) {
    const data = await fetchJson<DiscourseTopicList>(`https://${host}/latest.json?page=${page}`);
    await sleep(1200);
    if (!data?.topic_list?.topics?.length) break;
    data.topic_list.topics.forEach(t => addTopic(t.id, t.slug));
  }

  // /top.json — all-time top topics (different set)
  for (const period of ['all', 'yearly']) {
    for (let page = 0; page < Math.min(site.maxPages, 10); page++) {
      const data = await fetchJson<DiscourseTopicList>(`https://${host}/top.json?period=${period}&page=${page}`);
      await sleep(1200);
      if (!data?.topic_list?.topics?.length) break;
      data.topic_list.topics.forEach(t => addTopic(t.id, t.slug));
    }
  }

  // Per-category topic lists
  for (const category of site.categories) {
    for (let page = 0; page < Math.min(site.maxPages, 10); page++) {
      const data = await fetchJson<DiscourseTopicList>(`https://${host}/c/${category}.json?page=${page}`);
      await sleep(1200);
      if (!data?.topic_list?.topics?.length) break;
      data.topic_list.topics.forEach(t => addTopic(t.id, t.slug));
    }
  }

  logger.info(`${name}: found ${topicIds.length} topics via JSON. Fetching details...`);

  const tasks = topicIds.map(({ id, slug }) =>
    limit(async () => {
      const tUrl = `https://${host}/t/${slug}/${id}`;
      if (existingUrls.has(tUrl)) return;

      await sleep(800);
      const data = await fetchJson<DiscourseTopicDetail>(`https://${host}/t/${id}.json`);
      if (!data) return;

      const incident = discourseTopicToIncident(data, tUrl, name);
      if (incident) {
        onIncident(incident);
        collected++;
        if (collected % 200 === 0) logger.info(`${name}: ${collected} collected so far`);
      }
    })
  );

  await Promise.all(tasks);
  logger.success(`${name}: +${collected} incidents`);
  return collected;
}

// ─────────────────────────────────────────────────────────────────
// phpBB scraper (MikroTik Forum)
// ─────────────────────────────────────────────────────────────────
function parsePhpBBLinks(html: string, host: string): string[] {
  const $ = cheerio.load(html);
  const urls: string[] = [];

  $('a[href*="viewtopic"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const full = href.startsWith('http') ? href : `https://${host}/${href.replace(/^\//, '')}`;
    const clean = full.split('#')[0];
    if (!urls.includes(clean)) urls.push(clean);
  });

  return urls;
}

function parsePhpBBTopic(html: string, url: string, sourceName: string): RawIncident | null {
  const $ = cheerio.load(html);

  const title = $('h2.topic-title, h3, #page-body h2').first().text().trim()
    || $('title').text().replace(/• .+$/, '').trim();

  if (!title || title.length < 5) return null;

  const posts: Array<{ body: string; author: string; created_at: string }> = [];

  $('.post, [class*="postbody"]').each((_, el) => {
    const body = $(el).find('.content, .postbody, div.post_body').first().text().trim();
    if (body.length < 30) return;

    const author = $(el).find('.username, .postauthor, [itemprop="author"]').first().text().trim() || 'unknown';
    const dateEl = $(el).find('time').first();
    const created_at = dateEl.attr('datetime') || new Date().toISOString();

    posts.push({ body, author, created_at });
  });

  if (posts.length === 0) return null;
  const questionPost = posts[0];
  if (questionPost.body.length < config.minBodyLength) return null;

  const answers: Comment[] = posts.slice(1).map(p => ({
    author: p.author,
    body: p.body,
    score: 0,
    is_accepted: false,
    created_at: p.created_at,
  }));

  const deviceInfo = extractDeviceInfo(title, questionPost.body);

  return {
    id: uuidv4(),
    source: sourceName,
    url,
    title,
    body: questionPost.body,
    comments: answers,
    accepted_solution: answers[0]?.body || '',
    created_at: questionPost.created_at,
    device_name: deviceInfo.device_name,
    device_brand: deviceInfo.device_brand,
    device_model: deviceInfo.device_model,
    scraped_at: new Date().toISOString(),
  };
}

async function scrapePhpBB(
  site: CommunitySite,
  existingUrls: Set<string>,
  onIncident: (incident: RawIncident) => void,
  limit: ReturnType<typeof pLimit>,
): Promise<number> {
  const host = site.host;
  let collected = 0;
  const topicUrls: string[] = [];
  const seenUrls = new Set<string>();

  const addUrl = (u: string) => {
    if (!existingUrls.has(u) && !seenUrls.has(u)) { seenUrls.add(u); topicUrls.push(u); }
  };

  for (const forumId of site.categories) {
    for (let page = 0; page < site.maxPages; page++) {
      const start = page * 25;
      const listUrl = `https://${host}/viewforum.php?f=${forumId}&start=${start}`;
      const html = await fetchHtml(listUrl);
      await sleep(2000);

      if (!html) break;
      const urls = parsePhpBBLinks(html, host);
      if (urls.length === 0) break;
      urls.forEach(addUrl);
    }
  }

  logger.info(`${site.name}: found ${topicUrls.length} topic URLs. Fetching...`);

  const tasks = topicUrls.map(tUrl =>
    limit(async () => {
      if (existingUrls.has(tUrl)) return;
      const html = await fetchHtml(tUrl);
      await sleep(800);
      if (!html) return;
      const incident = parsePhpBBTopic(html, tUrl, site.name);
      if (incident) { onIncident(incident); collected++; }
    })
  );

  await Promise.all(tasks);
  return collected;
}

// ─────────────────────────────────────────────────────────────────
// XenForo scraper (IP Cam Talk)
// ─────────────────────────────────────────────────────────────────
async function scrapeXenForo(
  site: CommunitySite,
  existingUrls: Set<string>,
  onIncident: (incident: RawIncident) => void,
  limit: ReturnType<typeof pLimit>,
): Promise<number> {
  const host = site.host;
  let collected = 0;
  const topicUrls: string[] = [];
  const seenUrls = new Set<string>();

  const addUrl = (u: string) => {
    if (!existingUrls.has(u) && !seenUrls.has(u)) { seenUrls.add(u); topicUrls.push(u); }
  };

  for (const category of site.categories) {
    for (let page = 1; page <= site.maxPages; page++) {
      const listUrl = `https://${host}/${category}/page-${page}`;
      const html = await fetchHtml(listUrl);
      await sleep(2000);
      if (!html) break;

      const $ = cheerio.load(html);
      $('a[href*="/threads/"]').each((_, el) => {
        const href = $(el).attr('href') || '';
        const full = href.startsWith('http') ? href : `https://${host}${href.startsWith('/') ? '' : '/'}${href}`;
        addUrl(full.split(/[?#]/)[0]);
      });
    }
  }

  logger.info(`${site.name}: found ${topicUrls.length} topic URLs. Fetching...`);

  const tasks = topicUrls.map(tUrl =>
    limit(async () => {
      if (existingUrls.has(tUrl)) return;
      const html = await fetchHtml(tUrl);
      await sleep(800);
      if (!html) return;

      const $ = cheerio.load(html);
      const title = $('h1.p-title-value, .titleBar h1').first().text().trim();
      if (!title) return;

      const posts: Comment[] = [];
      $('article.message, .message').each((i, el) => {
        const body = $(el).find('.bbWrapper, .message-userContent').first().text().trim();
        const author = $(el).find('.username, .message-name a').first().text().trim() || 'unknown';
        const score = parseInt($(el).find('.reactionsBar-link, .likeText').first().text().replace(/[^0-9]/g, '') || '0', 10);
        if (body.length > 30) {
          posts.push({ author, body, score, is_accepted: i === 0, created_at: new Date().toISOString() });
        }
      });

      if (posts.length === 0 || posts[0].body.length < config.minBodyLength) return;

      const deviceInfo = extractDeviceInfo(title, posts[0].body);
      const incident: RawIncident = {
        id: uuidv4(), source: site.name, url: tUrl, title,
        body: posts[0].body, comments: posts.slice(1),
        accepted_solution: posts[1]?.body || '',
        created_at: new Date().toISOString(),
        device_name: deviceInfo.device_name,
        device_brand: deviceInfo.device_brand,
        device_model: deviceInfo.device_model,
        scraped_at: new Date().toISOString(),
      };
      onIncident(incident);
      collected++;
    })
  );

  await Promise.all(tasks);
  return collected;
}

// ─────────────────────────────────────────────────────────────────
// LinuxQuestions.org scraper
// ─────────────────────────────────────────────────────────────────
async function scrapeLinuxQuestions(
  site: CommunitySite,
  existingUrls: Set<string>,
  onIncident: (incident: RawIncident) => void,
  limit: ReturnType<typeof pLimit>,
): Promise<number> {
  const host = site.host;
  let collected = 0;
  const topicUrls: string[] = [];
  const seenUrls = new Set<string>();

  const addUrl = (u: string) => {
    if (!existingUrls.has(u) && !seenUrls.has(u)) { seenUrls.add(u); topicUrls.push(u); }
  };

  for (const boardPath of site.categories) {
    for (let page = 1; page <= site.maxPages; page++) {
      const listUrl = `https://${host}/${boardPath}/index${page}.html`;
      const html = await fetchHtml(listUrl);
      await sleep(1500);
      if (!html) break;

      const $ = cheerio.load(html);
      $('a[href*="/questions/"]').each((_, el) => {
        const href = $(el).attr('href') || '';
        if (!/showthread/.test(href) && !/page/.test(href)) {
          const full = href.startsWith('http') ? href : `https://${host}${href.startsWith('/') ? '' : '/'}${href}`;
          addUrl(full.split(/[?#]/)[0]);
        }
      });
    }
  }

  logger.info(`${site.name}: found ${topicUrls.length} topic URLs. Fetching...`);

  const tasks = topicUrls.map(tUrl =>
    limit(async () => {
      if (existingUrls.has(tUrl)) return;
      const html = await fetchHtml(tUrl);
      await sleep(800);
      if (!html) return;

      const $ = cheerio.load(html);
      const title = $('h2.threadtitle, .threadtitle, h1').first().text().trim();
      if (!title) return;

      const posts: Comment[] = [];
      $('.postbody, .post .postrow .content, div.post_message').each((i, el) => {
        const body = $(el).text().trim();
        const author = $(el).closest('.post, .postcontainer').find('.username, .postauthor').first().text().trim() || 'unknown';
        if (body.length > 30) {
          posts.push({ author, body, score: 0, is_accepted: i === 0, created_at: new Date().toISOString() });
        }
      });

      if (posts.length === 0 || posts[0].body.length < config.minBodyLength) return;

      const deviceInfo = extractDeviceInfo(title, posts[0].body);
      const incident: RawIncident = {
        id: uuidv4(), source: site.name, url: tUrl, title,
        body: posts[0].body, comments: posts.slice(1),
        accepted_solution: posts[1]?.body || '',
        created_at: new Date().toISOString(),
        device_name: deviceInfo.device_name,
        device_brand: deviceInfo.device_brand,
        device_model: deviceInfo.device_model,
        scraped_at: new Date().toISOString(),
      };
      onIncident(incident);
      collected++;
    })
  );

  await Promise.all(tasks);
  return collected;
}

// ─────────────────────────────────────────────────────────────────
// Main scraper class
// ─────────────────────────────────────────────────────────────────
export class CommunityScraper {
  async scrapeAll(
    existingUrls: Set<string>,
    onIncident: (incident: RawIncident) => void,
  ): Promise<void> {
    const limit = pLimit(6);
    let totalCollected = 0;

    for (const site of COMMUNITY_SITES) {
      if (totalCollected >= config.maxIncidentsPerSource) break;

      logger.info(`Community: scraping ${site.name} (${site.host}) [${site.platform}]`);

      let siteCollected = 0;
      try {
        switch (site.platform) {
          case 'discourse':
            siteCollected = await scrapeDiscourse(site, existingUrls, onIncident, limit);
            break;
          case 'phpbb':
            siteCollected = await scrapePhpBB(site, existingUrls, onIncident, limit);
            break;
          case 'xenforo':
            siteCollected = await scrapeXenForo(site, existingUrls, onIncident, limit);
            break;
          case 'custom':
            if (site.host.includes('linuxquestions')) {
              siteCollected = await scrapeLinuxQuestions(site, existingUrls, onIncident, limit);
            }
            break;
        }
      } catch (err) {
        logger.warn(`${site.name}: scrape error — ${(err as Error).message}`);
      }

      totalCollected += siteCollected;
      logger.success(`${site.name}: +${siteCollected} incidents (total: ${totalCollected})`);
    }

    logger.success(`Community scraper done. Total: ${totalCollected}`);
  }
}

/**
 * Reddit Bulk Scraper via PullPush API (https://api.pullpush.io)
 * — a public Reddit archive, no auth / no API key required.
 * Returns up to 100 posts per request with full selftext.
 * Paginate backwards with `before` (unix timestamp).
 *
 * Mode 1 — Subreddit sweep: fetch ALL posts from IT subreddits (bulk volume)
 * Mode 2 — Keyword search: search Reddit-wide for specific device failures
 */
import axios, { AxiosError } from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import pLimit from 'p-limit';
import { RawIncident, Comment } from '../types';
import { logger } from '../utils/logger';
import { sleep } from '../utils/rate-limiter';
import { extractDeviceInfo } from '../utils/device-extractor';
import { config } from '../config';
import { SEARCH_KEYWORDS } from './it-keywords';

// ─────────────────────────────────────────────────────────────────
// Subreddit list — ordered by expected IT incident yield
// ─────────────────────────────────────────────────────────────────
export const BULK_SUBREDDITS = [
  // Tier 1 — dedicated IT/tech support (highest yield)
  'techsupport', 'ITsupport', 'sysadmin', 'networking', 'homelab',
  'computerrepair', 'printers', 'cctv', 'Ubiquiti', 'Cisco',
  // Tier 2 — specific hardware / software stacks
  'HomeNetworking', 'pfsense', 'synology', 'servers', 'WindowsServer',
  'vmware', 'AskNetworking', 'msp', 'surveillance', 'unRAID',
  'linuxadmin', 'selfhosted', 'docker', 'pihole', 'Proxmox',
  // Tier 3 — hardware / OS general
  'buildapc', 'hardware', 'computers', 'linux', 'linuxquestions',
  'raspberry_pi', 'QNAP', 'truenas', 'opnsense', 'wireguard',
  // Tier 4 — brands / specific devices
  'Meraki', 'fortinet', 'sophos', 'mikrotik', 'freenas',
  'techsupportmacgyver', 'applehelp', 'MacOS', 'Dell', 'hpprinters',
  '24hoursupport', 'pcgamingtechsupport', 'linuxmint', 'debian', 'CentOS',
  // Tier 5 — additional from user's site list
  'homesecurity', 'netsec', 'sysadminjobs', 'k12sysadmin', 'office365',
  'exchangeserver', 'PowerShell', 'sccm', 'AZURE', 'aws',
];

const BASE_URL = 'https://api.pullpush.io/reddit/submission/search';
const COMMENTS_URL = 'https://api.pullpush.io/reddit/comment/search';
const UA = 'Mozilla/5.0 (compatible; ITDatasetCollector/1.0; academic)';

// ─────────────────────────────────────────────────────────────────
// Checkpoint
// ─────────────────────────────────────────────────────────────────
interface BulkCheckpoint {
  subredditProgress: Record<string, { before: number; collected: number; done: boolean }>;
  keywordProgress: Record<string, { before: number; done: boolean }>;
  totalCollected: number;
  lastUpdated: string;
}

function loadCheckpoint(filePath: string): BulkCheckpoint {
  try {
    if (fs.existsSync(filePath)) return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as BulkCheckpoint;
  } catch { /* start fresh */ }
  return { subredditProgress: {}, keywordProgress: {}, totalCollected: 0, lastUpdated: '' };
}

function saveCheckpoint(filePath: string, cp: BulkCheckpoint): void {
  cp.lastUpdated = new Date().toISOString();
  fs.writeFileSync(filePath, JSON.stringify(cp), { encoding: 'utf8', flag: 'w' });
}

// ─────────────────────────────────────────────────────────────────
// PullPush types
// ─────────────────────────────────────────────────────────────────
interface PPPost {
  id: string;
  title: string;
  selftext: string;
  score: number;
  num_comments: number;
  full_link: string;
  permalink?: string;
  created_utc: number;
  is_self: boolean;
  link_flair_text?: string;
  author: string;
  subreddit: string;
}

interface PPComment {
  id: string;
  body: string;
  score: number;
  author: string;
  created_utc: number;
}

// ─────────────────────────────────────────────────────────────────
// HTTP helpers
// ─────────────────────────────────────────────────────────────────
async function fetchPosts(params: Record<string, string | number | boolean>, retries = 2): Promise<PPPost[]> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await axios.get<{ data: PPPost[] }>(BASE_URL, {
        params: { limit: 100, sort_type: 'created_utc', sort: 'desc', ...params },
        headers: { 'User-Agent': UA },
        timeout: 20000,
      });
      return res.data?.data ?? [];
    } catch (err) {
      const status = (err as AxiosError).response?.status;
      if (status === 429) {
        logger.warn(`PullPush rate limit. Waiting 60s...`);
        await sleep(60000);
        attempt--; // don't count rate-limit waits as retries
        continue;
      }
      if (status && status >= 500) await sleep(15000);
    }
  }
  return [];
}

async function fetchComments(postId: string, limit = 10): Promise<PPComment[]> {
  try {
    const res = await axios.get<{ data: PPComment[] }>(COMMENTS_URL, {
      params: { link_id: `t3_${postId}`, limit, sort_type: 'score', sort: 'desc' },
      headers: { 'User-Agent': UA },
      timeout: 15000,
    });
    return (res.data?.data ?? []).filter(c => c.body && c.body !== '[deleted]' && c.body !== '[removed]');
  } catch {
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────
// Post filtering
// ─────────────────────────────────────────────────────────────────
function isUseful(post: PPPost, minScore: number): boolean {
  if (!post.is_self) return false;
  const text = post.selftext;
  if (!text || text === '[deleted]' || text === '[removed]') return false;
  if (text.length < 120) return false;
  if (post.score < minScore) return false;
  return true;
}

function buildIncident(post: PPPost, comments: PPComment[], subreddit: string): RawIncident {
  const commentList: Comment[] = comments.map(c => ({
    author: c.author,
    body: c.body,
    score: c.score,
    is_accepted: false,
    created_at: new Date(c.created_utc * 1000).toISOString(),
  }));

  const best = [...commentList].sort((a, b) => b.score - a.score)[0];
  const postUrl = post.full_link || `https://www.reddit.com/r/${subreddit}/comments/${post.id}/`;
  const deviceInfo = extractDeviceInfo(post.title, post.selftext);

  return {
    id: uuidv4(),
    source: `reddit/r/${subreddit}`,
    url: postUrl,
    title: post.title,
    body: post.selftext,
    comments: commentList,
    accepted_solution: best?.body || '',
    created_at: new Date(post.created_utc * 1000).toISOString(),
    device_name: deviceInfo.device_name,
    device_brand: deviceInfo.device_brand,
    device_model: deviceInfo.device_model,
    scraped_at: new Date().toISOString(),
  };
}

// ─────────────────────────────────────────────────────────────────
// Per-subreddit worker
// ─────────────────────────────────────────────────────────────────
async function scrapeSubreddit(
  subreddit: string,
  existingUrls: Set<string>,
  onIncident: (incident: RawIncident) => void,
  maxPerSub: number,
  minScore: number,
  commentScoreThreshold: number,
  initialBefore: number,
  maxPages: number,
): Promise<{ collected: number; lastBefore: number }> {
  let before = initialBefore;
  let collected = 0;
  let emptyPages = 0;
  let pageCount = 0;
  const EARLIEST_UTC = 1483228800; // 2017-01-01 — don't go further back than this
  // Local set: prevents re-processing the same post within this run.
  // We do NOT write to `existingUrls` here — that's the manager's job via onIncident().
  const seen = new Set<string>();

  while (collected < maxPerSub && pageCount < maxPages) {
    await sleep(3000); // ~20 req/min — comfortably under PullPush limits

    const posts = await fetchPosts({ subreddit, is_self: 'true', before });
    pageCount++;

    if (pageCount % 10 === 0) {
      logger.info(`Reddit Bulk r/${subreddit}: page ${pageCount}, collected ${collected} so far...`);
    }

    if (posts.length === 0) {
      emptyPages++;
      if (emptyPages >= 3) break; // exhausted
      before -= 86400 * 30; // skip back 30 days and try again
      continue;
    }

    emptyPages = 0;
    let oldestTs = before;

    for (const post of posts) {
      if (post.created_utc < oldestTs) oldestTs = post.created_utc;
      if (collected >= maxPerSub) break;

      if (!isUseful(post, minScore)) continue;
      const postUrl = post.full_link || `https://www.reddit.com/r/${subreddit}/comments/${post.id}/`;
      if (existingUrls.has(postUrl)) continue;
      if (seen.has(postUrl)) continue;
      seen.add(postUrl);

      let comments: PPComment[] = [];
      if (post.score >= commentScoreThreshold || post.num_comments >= 5) {
        await sleep(3000);
        comments = await fetchComments(post.id, 10);
      }

      const incident = buildIncident(post, comments, subreddit);
      onIncident(incident); // manager adds to existingUrls and increments totalSaved
      collected++;
    }

    before = oldestTs - 1;
    if (before < EARLIEST_UTC) break; // gone back far enough
    if (posts.length < 50) break; // near end of subreddit history
  }

  return { collected, lastBefore: before };
}

// ─────────────────────────────────────────────────────────────────
// Keyword search worker — searches Reddit-wide for specific terms
// ─────────────────────────────────────────────────────────────────
async function scrapeKeyword(
  keyword: string,
  existingUrls: Set<string>,
  onIncident: (incident: RawIncident) => void,
  initialBefore: number,
  minScore: number,
  commentScoreThreshold: number,
): Promise<{ collected: number; lastBefore: number }> {
  let before = initialBefore;
  let collected = 0;
  const seen = new Set<string>();

  // 3 pages per keyword = 300 posts max, at 3s between = 9s per keyword
  for (let page = 0; page < 3; page++) {
    await sleep(3000);

    const posts = await fetchPosts({ q: keyword, is_self: true, before });
    if (posts.length === 0) break;

    let oldestTs = before;
    for (const post of posts) {
      if (post.created_utc < oldestTs) oldestTs = post.created_utc;

      if (!isUseful(post, minScore)) continue;
      const postUrl = post.full_link || `https://www.reddit.com/r/${post.subreddit}/comments/${post.id}/`;
      if (existingUrls.has(postUrl)) continue;
      if (seen.has(postUrl)) continue;
      seen.add(postUrl);

      let comments: PPComment[] = [];
      if (post.score >= commentScoreThreshold || post.num_comments >= 5) {
        await sleep(3000);
        comments = await fetchComments(post.id, 10);
      }

      const incident = buildIncident(post, comments, post.subreddit || 'reddit');
      onIncident(incident);
      collected++;
    }

    before = oldestTs - 1;
    if (posts.length < 50) break;
  }

  return { collected, lastBefore: before };
}

// ─────────────────────────────────────────────────────────────────
// Main scraper
// ─────────────────────────────────────────────────────────────────
export class RedditBulkScraper {
  private checkpointFile = path.join(config.rawDataDir, 'reddit_bulk_checkpoint.json');

  async scrapeAll(
    existingUrls: Set<string>,
    onIncident: (incident: RawIncident) => void
  ): Promise<void> {
    const cp = loadCheckpoint(this.checkpointFile);
    const maxTotal = config.maxIncidentsPerSource;
    const maxPerSub = Math.ceil(maxTotal / BULK_SUBREDDITS.length) + 500;
    const minScore = config.redditBulkMinScore;
    const commentThreshold = config.redditBulkCommentScoreThreshold;
    const now = Math.floor(Date.now() / 1000);

    let totalCollected = cp.totalCollected;
    const maxPages = config.redditBulkPagesPerSub;
    logger.info(`Reddit Bulk (PullPush): resuming at ${totalCollected}, target=${maxTotal}`);
    logger.info(`  Subreddits: ${BULK_SUBREDDITS.length}, max/sub: ${maxPerSub}, maxPages/sub: ${maxPages}, minScore: ${minScore}`);

    // Phase 1: Subreddit sweep — sequential to respect PullPush rate limits
    const pendingSubs = BULK_SUBREDDITS.filter(sub => !cp.subredditProgress[sub]?.done);
    logger.info(`  Pending subreddits: ${pendingSubs.length}`);

    for (const sub of pendingSubs) {
      if (totalCollected >= maxTotal) break;

      const subState = cp.subredditProgress[sub];
      const initialBefore = subState?.before ?? now;

      logger.info(`Reddit Bulk r/${sub}: starting (before=${new Date(initialBefore * 1000).toISOString().slice(0,10)})`);

      const { collected, lastBefore } = await scrapeSubreddit(
        sub, existingUrls, onIncident,
        maxPerSub, minScore, commentThreshold, initialBefore, maxPages,
      );

      totalCollected += collected;
      cp.subredditProgress[sub] = { before: lastBefore, collected, done: true };
      cp.totalCollected = totalCollected;
      saveCheckpoint(this.checkpointFile, cp);

      logger.success(`Reddit Bulk r/${sub}: +${collected} (total: ${totalCollected}/${maxTotal})`);
    }

    // Phase 2: Keyword search — targeted device-specific incidents
    if (totalCollected < maxTotal) {
      const pendingKeywords = SEARCH_KEYWORDS.filter(k => !cp.keywordProgress[k]?.done);
      logger.info(`Reddit Bulk keywords: ${pendingKeywords.length} pending device-specific terms`);

      for (const keyword of pendingKeywords) {
        if (totalCollected >= maxTotal) break;

        const kwState = cp.keywordProgress[keyword];
        const initialBefore = kwState?.before ?? now;

        const { collected, lastBefore } = await scrapeKeyword(
          keyword, existingUrls, onIncident, initialBefore, minScore, commentThreshold,
        );

        totalCollected += collected;
        cp.keywordProgress[keyword] = { before: lastBefore, done: true };
        cp.totalCollected = totalCollected;

        // Save checkpoint every 50 keywords
        if (pendingKeywords.indexOf(keyword) % 50 === 0) {
          saveCheckpoint(this.checkpointFile, cp);
          logger.info(`Reddit Bulk keywords: ${totalCollected} total so far...`);
        }
      }

      saveCheckpoint(this.checkpointFile, cp);
    }

    logger.success(`Reddit Bulk (PullPush): done. Total collected: ${totalCollected}`);
  }
}

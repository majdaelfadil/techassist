import { v4 as uuidv4 } from 'uuid';
import pLimit from 'p-limit';
import { RawIncident } from '../types';
import { BaseScraper } from './base-scraper';
import { logger } from '../utils/logger';
import { sleep, randomDelay } from '../utils/rate-limiter';
import { extractDeviceInfo } from '../utils/device-extractor';
import { config } from '../config';
import { Page } from 'puppeteer';

// IT maintenance search keywords — 360 keywords across 12 device categories
export const REDDIT_SEARCH_KEYWORDS = [
  // Desktop PCs (30)
  'pc slow',
  'computer slow',
  'desktop slow',
  'pc freezing',
  'computer freezing',
  'pc lagging',
  'high cpu usage',
  'high ram usage',
  'computer overheating',
  'pc overheating',
  'computer not booting',
  'pc not booting',
  'black screen pc',
  'blue screen',
  'bsod',
  'boot loop',
  'windows crash',
  'computer restart loop',
  'power supply failure',
  'motherboard issue',
  'ssd failure',
  'hard drive failure',
  'ram failure',
  'bios issue',
  'fan noise',
  'computer shutdown',
  'random restart',
  'virus infection',
  'malware infection',
  'computer no display',
  // Laptops (30)
  'laptop overheating',
  'laptop battery issue',
  'battery not charging',
  'battery draining fast',
  'laptop not turning on',
  'laptop shuts down',
  'laptop black screen',
  'screen flickering',
  'screen not working',
  'keyboard not working',
  'touchpad not working',
  'charging port issue',
  'laptop fan noise',
  'slow laptop',
  'laptop freeze',
  'laptop boot issue',
  'wifi not working laptop',
  'bluetooth not working',
  'broken hinge',
  'laptop overheating while charging',
  'battery swollen',
  'laptop restart loop',
  'laptop crash',
  'laptop lagging',
  'laptop no display',
  'camera not working laptop',
  'speaker not working laptop',
  'usb port not working',
  'laptop power issue',
  'laptop motherboard issue',
  // Printers (30)
  'printer offline',
  'printer not printing',
  'paper jam',
  'printer queue stuck',
  'printer connection issue',
  'network printer issue',
  'printer driver issue',
  'printer error',
  'printer cartridge issue',
  'printer toner issue',
  'printer scan problem',
  'printer not detected',
  'printer wireless issue',
  'printer slow printing',
  'printer print quality issue',
  'printer streaks',
  'printer ink problem',
  'printer maintenance kit issue',
  'printer spooler issue',
  'printer usb issue',
  'printer wifi issue',
  'printer firmware issue',
  'printer scanner not working',
  'printer blank pages',
  'printer color issue',
  'printer paper feed issue',
  'printer communication error',
  'printer hardware failure',
  'printer network timeout',
  'printer unable to print',
  // Routers (30)
  'router offline',
  'router not working',
  'router rebooting',
  'router internet down',
  'wan down',
  'router configuration issue',
  'router firmware issue',
  'router packet loss',
  'router power issue',
  'router overheating',
  'router disconnecting',
  'router dns issue',
  'router nat issue',
  'router slow internet',
  'router no internet',
  'router login issue',
  'router vpn issue',
  'router dhcp issue',
  'router routing issue',
  'router wan failure',
  'router lan issue',
  'router port issue',
  'router firewall issue',
  'router bandwidth issue',
  'router unstable connection',
  'router network outage',
  'router ip conflict',
  'router access issue',
  'router wireless issue',
  'router authentication issue',
  // Switches (30)
  'switch offline',
  'switch not responding',
  'switch port failure',
  'switch configuration issue',
  'switch vlan issue',
  'switch rebooting',
  'switch power issue',
  'switch packet loss',
  'switch uplink issue',
  'switch network outage',
  'switch firmware issue',
  'switch spanning tree issue',
  'switch loop issue',
  'switch stack issue',
  'switch management issue',
  'switch port down',
  'switch connectivity issue',
  'switch trunk issue',
  'switch access port issue',
  'switch broadcast storm',
  'switch poe issue',
  'switch fan failure',
  'switch overheating',
  'switch authentication issue',
  'switch latency issue',
  'switch routing issue',
  'switch mac table issue',
  'switch network instability',
  'switch hardware failure',
  'switch link down',
  // Firewalls (30)
  'firewall offline',
  'firewall not working',
  'firewall rule issue',
  'firewall vpn issue',
  'firewall configuration issue',
  'firewall firmware issue',
  'firewall performance issue',
  'firewall rebooting',
  'firewall internet issue',
  'firewall access issue',
  'firewall packet loss',
  'firewall latency issue',
  'firewall authentication issue',
  'firewall power issue',
  'firewall hardware issue',
  'firewall ssl vpn issue',
  'firewall site to site vpn issue',
  'firewall traffic issue',
  'firewall policy issue',
  'firewall nat issue',
  'firewall logging issue',
  'firewall update issue',
  'firewall network outage',
  'firewall dns issue',
  'firewall routing issue',
  'firewall interface down',
  'firewall connection failure',
  'firewall management issue',
  'firewall high cpu',
  'firewall high memory',
  // Access Points / WiFi (30)
  'wifi not working',
  'wifi disconnecting',
  'wireless issue',
  'access point offline',
  'access point rebooting',
  'wifi slow',
  'wifi coverage issue',
  'wifi authentication issue',
  'wifi roaming issue',
  'ssid not visible',
  'wireless interference',
  'wifi packet loss',
  'wifi latency issue',
  'access point power issue',
  'access point firmware issue',
  'wifi channel issue',
  'wifi signal weak',
  'wifi network outage',
  'wifi bandwidth issue',
  'wifi client issue',
  'wifi ip issue',
  'wifi dhcp issue',
  'wifi security issue',
  'wifi captive portal issue',
  'wifi connection failed',
  'wifi unstable',
  'wifi access problem',
  'wifi login issue',
  'wifi performance issue',
  'wireless access issue',
  // CCTV Cameras (30)
  'camera offline',
  'camera no video',
  'camera blurry',
  'camera image issue',
  'camera not recording',
  'camera power issue',
  'camera network issue',
  'camera disconnected',
  'camera night vision issue',
  'camera rebooting',
  'camera not detected',
  'ip camera issue',
  'camera storage issue',
  'camera firmware issue',
  'camera connection issue',
  'camera video loss',
  'camera poor image quality',
  'camera focus issue',
  'camera lens issue',
  'camera infrared issue',
  'camera motion detection issue',
  'camera cable issue',
  'camera poe issue',
  'camera access issue',
  'camera authentication issue',
  'camera lagging',
  'camera stream issue',
  'camera hardware issue',
  'camera signal loss',
  'camera network timeout',
  // NVR / DVR (30)
  'nvr offline',
  'nvr recording issue',
  'nvr hard drive issue',
  'nvr camera disconnect',
  'nvr storage full',
  'nvr playback issue',
  'dvr not recording',
  'dvr offline',
  'dvr power issue',
  'nvr rebooting',
  'nvr network issue',
  'nvr firmware issue',
  'nvr disk failure',
  'nvr connection issue',
  'nvr remote access issue',
  'nvr authentication issue',
  'nvr video loss',
  'nvr camera sync issue',
  'nvr storage corruption',
  'nvr backup issue',
  'nvr hardware failure',
  'nvr overheating',
  'nvr configuration issue',
  'dvr video issue',
  'dvr playback issue',
  'dvr storage issue',
  'dvr hard drive issue',
  'dvr camera issue',
  'dvr firmware issue',
  'dvr connection issue',
  // Servers (30)
  'server down',
  'server offline',
  'server not booting',
  'server crash',
  'server performance issue',
  'server storage issue',
  'server overheating',
  'server disk failure',
  'server raid issue',
  'server backup failure',
  'server network issue',
  'server power issue',
  'server rebooting',
  'server hardware failure',
  'server memory issue',
  'server cpu issue',
  'server operating system issue',
  'windows server issue',
  'linux server issue',
  'vmware issue',
  'hypervisor issue',
  'virtual machine issue',
  'server authentication issue',
  'server update issue',
  'server replication issue',
  'server database issue',
  'server latency issue',
  'server connectivity issue',
  'server access issue',
  'server unavailable',
  // UPS / Power Systems (30)
  'ups battery failure',
  'ups battery replacement',
  'ups alarm',
  'ups not charging',
  'ups power issue',
  'ups shutdown',
  'ups overload',
  'ups communication issue',
  'ups firmware issue',
  'ups overheating',
  'ups battery low',
  'ups runtime issue',
  'ups inverter issue',
  'ups output issue',
  'ups input issue',
  'ups hardware failure',
  'ups maintenance issue',
  'ups connection issue',
  'ups monitoring issue',
  'ups voltage issue',
  'ups surge issue',
  'ups startup issue',
  'ups network card issue',
  'ups fan issue',
  'ups unexpected shutdown',
  'ups battery degradation',
  'ups calibration issue',
  'ups backup issue',
  'ups charging failure',
  'ups fault alarm',
  // Generic High-Value Failure Keywords (30)
  'not working',
  'offline',
  'down',
  'failure',
  'issue',
  'problem',
  'error',
  'fault',
  'broken',
  'disconnecting',
  'unreachable',
  'cannot connect',
  'connection failed',
  'crashing',
  'rebooting',
  'freezing',
  'slow',
  'lagging',
  'overheating',
  'not detected',
  'no power',
  'no signal',
  'configuration issue',
  'hardware failure',
  'software issue',
  'authentication failure',
  'timeout error',
  'firmware issue',
  'performance issue',
  'connectivity issue',
];

// Subreddits to search within
const SUBREDDITS = [
  'techsupport',
  'sysadmin',
  'networking',
  'homelab',
  'Ubiquiti',
  'Cisco',
  'HomeNetworking',
  'computerrepair',
  'printers',
  'cctv',
  'ITsupport',
  'pfsense',
  'synology',
  'servers',
  'WindowsServer',
  'vmware',
  'surveillance',
  'unRAID',
  'AskNetworking',
  'msp',
];

const OP_SOLVED_PHRASES = [
  'edit: fixed', 'edit: solved', 'edit: resolved', 'update: fixed',
  'update: solved', 'this fixed it', 'this worked', 'solved!',
  'marking as solved', 'problem solved', 'figured it out',
  'the fix was', 'the issue was', 'turned out to be',
  'it was the', 'ended up', '[solved]', 'got it working',
];

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export class RedditScraper extends BaseScraper {
  constructor() {
    super('reddit');
  }

  // Fast navigation that bypasses the shared rate limiter.
  // Each parallel worker manages its own timing.
  private async navigateFast(page: Page, url: string): Promise<boolean> {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
      await sleep(400 + Math.random() * 500); // 400–900ms per worker
      return true;
    } catch (err) {
      logger.debug(`Navigate failed ${url}: ${(err as Error).message}`);
      return false;
    }
  }

  // ──────────────────────────────────────────────────────────
  // Search results page: collect post URLs
  // ──────────────────────────────────────────────────────────
  private async collectPostUrls(
    subreddit: string,
    keyword: string,
    maxPages: number = 3
  ): Promise<string[]> {
    const allUrls: string[] = [];
    let nextUrl: string | null =
      `https://old.reddit.com/r/${subreddit}/search?q=${encodeURIComponent(keyword)}&restrict_sr=on&sort=top&t=all`;

    for (let page = 0; page < maxPages && nextUrl; page++) {
      const listPage = await this.newPage();
      logger.debug(`Reddit search: r/${subreddit} "${keyword}" page ${page + 1}`);

      const loaded = await this.navigateFast(listPage, nextUrl);
      if (!loaded) {
        await listPage.close();
        break;
      }

      // Collect self-post links (text posts, not link posts)
      const pageUrls = await listPage.$$eval(
        'div.search-result-link a.search-title, div.thing.self a.title',
        (els: Element[]) => {
          const seen = new Set<string>();
          const urls: string[] = [];
          for (const el of els) {
            let href = (el as HTMLAnchorElement).href || '';
            href = href.replace('www.reddit.com', 'old.reddit.com')
                       .replace('https://old.reddit.com/out?url=', '');
            if (href.includes('/comments/') && !seen.has(href) && !href.includes('/out?')) {
              seen.add(href);
              urls.push(href);
            }
          }
          return urls;
        }
      );

      allUrls.push(...pageUrls);

      nextUrl = await listPage.$eval(
        'div.nav-buttons span.next-button a',
        (el: Element) => {
          const href = (el as HTMLAnchorElement).href || '';
          return href.replace('www.reddit.com', 'old.reddit.com') || null;
        }
      ).catch(() => null);

      await listPage.close();

      if (pageUrls.length === 0) break;
      await randomDelay(600, 1200); // reduced from 1500–2500
    }

    return allUrls;
  }

  // ──────────────────────────────────────────────────────────
  // Individual post page: extract content
  // ──────────────────────────────────────────────────────────
  private async scrapePost(postUrl: string, subreddit: string): Promise<RawIncident | null> {
    const url = postUrl
      .replace('www.reddit.com', 'old.reddit.com')
      .split('?')[0];

    const page = await this.newPage();
    try {
      const loaded = await this.navigateFast(page, `${url}?limit=200&sort=top`);
      if (!loaded) return null;

      const data = await page.evaluate(() => {
        // Title
        const titleEl = document.querySelector('a.title.may-blank, div#siteTable p.title a.title');
        const title = titleEl?.textContent?.trim() || document.title.replace(' : ' + document.title.split(' : ').pop(), '');

        // Post body (self-text)
        const selfThing = document.querySelector('div.thing.self, div.thing[data-type="link"].self');
        const bodyEl = selfThing?.querySelector('div.usertext-body div.md') ||
                       document.querySelector('div.expando div.usertext-body div.md');
        const body = bodyEl?.textContent?.trim() || '';

        // Post timestamp
        const timeEl = document.querySelector('div.thing.self time, time.live-timestamp');
        const created_at = timeEl?.getAttribute('datetime') || '';

        // Comments
        const commentEls = Array.from(document.querySelectorAll('div.comment'));
        const comments: Array<{
          author: string; body: string; score: number;
          is_accepted: boolean; created_at: string;
        }> = [];

        for (let i = 0; i < Math.min(commentEls.length, 200); i++) {
          const el = commentEls[i];

          // Skip collapsed/deleted
          if (el.classList.contains('collapsed')) continue;

          const author = el.querySelector('a.author')?.textContent?.trim() || '';
          const commentBodyEl = el.querySelector(':scope > div.entry div.usertext-body div.md');
          const commentBody = commentBodyEl?.textContent?.trim() || '';

          if (!commentBody || commentBody === '[deleted]' || commentBody === '[removed]') continue;
          if (commentBody.length < 15) continue;

          const scoreEl = el.querySelector(':scope > div.entry span.score');
          const scoreText = scoreEl?.textContent?.replace(/[^\d-]/g, '') || '0';
          const score = parseInt(scoreText, 10) || 0;

          const commentTime = el.querySelector(':scope > div.entry time');
          const comment_at = commentTime?.getAttribute('datetime') || '';

          comments.push({ author, body: commentBody, score, is_accepted: false, created_at: comment_at });
        }

        return { title, body, comments, created_at };
      });

      if (!data.body || data.body.length < config.minBodyLength) return null;
      if (!data.title || data.title.length < 5) return null;

      // Find best solution
      const sorted = [...data.comments].sort((a, b) => b.score - a.score);
      let acceptedSolution = '';

      // Check OP body for solved edit
      const bodyLower = data.body.toLowerCase();
      if (OP_SOLVED_PHRASES.some(p => bodyLower.includes(p))) {
        acceptedSolution = data.body;
      } else {
        // Find comment with solved phrase
        const solvedComment = data.comments.find(c =>
          OP_SOLVED_PHRASES.some(p => c.body.toLowerCase().includes(p))
        );
        acceptedSolution = solvedComment?.body || sorted[0]?.body || '';
      }

      const deviceInfo = extractDeviceInfo(data.title, data.body);

      return {
        id: uuidv4(),
        source: `reddit/r/${subreddit}`,
        url,
        title: data.title,
        body: data.body,
        comments: data.comments,
        accepted_solution: acceptedSolution,
        created_at: data.created_at || new Date().toISOString(),
        device_name: deviceInfo.device_name,
        device_brand: deviceInfo.device_brand,
        device_model: deviceInfo.device_model,
        scraped_at: new Date().toISOString(),
      };
    } catch (err) {
      logger.debug(`Post scrape failed ${url}: ${(err as Error).message}`);
      return null;
    } finally {
      await page.close();
    }
  }

  // Required by BaseScraper abstract contract — actual work goes through scrapeAll
  async scrapeIncidents(): Promise<{ incidents: RawIncident[]; nextCursor: string | null; hasMore: boolean }> {
    return { incidents: [], nextCursor: null, hasMore: false };
  }

  // ──────────────────────────────────────────────────────────
  // Main entry — called by ScraperManager
  // Runs SCRAPER_CONCURRENCY searches in parallel (default: 5)
  // ──────────────────────────────────────────────────────────
  async scrapeAll(
    existingUrls: Set<string>,
    onIncident: (incident: RawIncident) => void,
    _progressMap: Record<string, string> = {}
  ): Promise<void> {
    await this.initBrowser();

    let totalCollected = 0;
    const maxPerSource = config.maxIncidentsPerSource;
    const concurrency = config.scraperConcurrency;

    // Flatten subreddit × keyword into a shuffled work queue.
    // Shuffling interleaves subreddits so no single subreddit is hammered.
    const workItems = shuffleArray(
      SUBREDDITS.flatMap(sub => REDDIT_SEARCH_KEYWORDS.map(kw => ({ subreddit: sub, keyword: kw })))
    );

    logger.info(`Reddit: ${workItems.length} searches queued, ${concurrency} parallel workers`);

    const limit = pLimit(concurrency);
    // Tracks URLs currently being processed by a worker to prevent duplicate
    // scraping across concurrent tasks. Separate from existingUrls so the
    // manager's onIncident callback remains the single writer to existingUrls.
    const inProgress = new Set<string>();

    const tasks = workItems.map(({ subreddit, keyword }) =>
      limit(async () => {
        if (totalCollected >= maxPerSource) return;

        let postUrls: string[] = [];
        try {
          postUrls = await this.collectPostUrls(subreddit, keyword, 5);
        } catch (err) {
          logger.warn(`Search failed r/${subreddit} "${keyword}": ${(err as Error).message}`);
          return;
        }

        for (const postUrl of postUrls) {
          if (totalCollected >= maxPerSource) break;
          if (existingUrls.has(postUrl)) continue;
          if (inProgress.has(postUrl)) continue;
          inProgress.add(postUrl);

          try {
            const incident = await this.scrapePost(postUrl, subreddit);
            if (incident) {
              onIncident(incident);
              totalCollected++;
              if (totalCollected % 100 === 0) {
                logger.info(`Reddit: ${totalCollected} incidents collected`);
              }
            }
          } catch (err) {
            logger.debug(`Post error ${postUrl}: ${(err as Error).message}`);
          }

          await randomDelay(600, 1200);
        }
      })
    );

    await Promise.all(tasks);
    await this.closeBrowser();
    logger.success(`Reddit Puppeteer scraper complete: ${totalCollected} incidents`);
  }
}

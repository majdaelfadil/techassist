import { v4 as uuidv4 } from 'uuid';
import { RawIncident, Comment } from '../types';
import { BaseScraper } from './base-scraper';
import { logger } from '../utils/logger';
import { sleep } from '../utils/rate-limiter';
import { extractDeviceInfo } from '../utils/device-extractor';
import { config } from '../config';

const TH_CATEGORIES = [
  'https://forums.tomshardware.com/forums/networking.36/',
  'https://forums.tomshardware.com/forums/storage.36/',
  'https://forums.tomshardware.com/forums/systems.36/',
  'https://forums.tomshardware.com/forums/laptops-notebooks.38/',
  'https://forums.tomshardware.com/forums/printers-scanners-cameras.40/',
  'https://forums.tomshardware.com/forums/components.26/',
  'https://forums.tomshardware.com/forums/windows-11.186/',
  'https://forums.tomshardware.com/forums/networking.36/',
];

export class TomsHardwareScraper extends BaseScraper {
  constructor() {
    super('tomshardware');
  }

  async scrapeIncidents(cursor?: string): Promise<{ incidents: RawIncident[]; nextCursor: string | null; hasMore: boolean }> {
    const incidents: RawIncident[] = [];
    await this.initBrowser();

    for (const categoryUrl of TH_CATEGORIES) {
      let page = 1;
      let categoryIncidents = 0;

      while (categoryIncidents < 400) {
        const listPage = await this.newPage();
        const listUrl = page === 1 ? categoryUrl : `${categoryUrl}page-${page}`;

        logger.info(`Tom's Hardware: ${listUrl}`);
        const loaded = await this.navigateSafe(listPage, listUrl, 'domcontentloaded');
        if (!loaded) { await listPage.close(); break; }

        await sleep(1500);

        const threadLinks = await listPage.$$eval(
          'a',
          (els: Element[]) => {
            const seen = new Set<string>();
            const links: string[] = [];
            for (const el of els) {
              const href = (el as HTMLAnchorElement).href;
              if (href && href.includes('/threads/') && !href.includes('#') && !seen.has(href)) {
                seen.add(href);
                links.push(href);
              }
            }
            return links.slice(0, 25);
          }
        );

        await listPage.close();

        if (threadLinks.length === 0) break;

        for (const threadUrl of threadLinks) {
          const incident = await this.scrapeThread(threadUrl);
          if (incident) {
            incidents.push(incident);
            categoryIncidents++;
          }
          await sleep(2000);
        }

        page++;
        await sleep(3000);
      }
    }

    return { incidents, nextCursor: null, hasMore: false };
  }

  private async scrapeThread(url: string): Promise<RawIncident | null> {
    const page = await this.newPage();
    try {
      const loaded = await this.navigateSafe(page, url, 'domcontentloaded');
      if (!loaded) return null;

      await sleep(1000);

      const data = await page.evaluate(() => {
        const titleEl = document.querySelector('h1.p-title-value, h1[class*="title"], h1.p-title');
        const title = titleEl?.textContent?.trim() || document.title;

        // XenForo posts: article.message or div.message
        const postEls = document.querySelectorAll('article.message, div.message');
        const posts: Array<{ author: string; body: string; score: number; created_at: string; isFirst: boolean }> = [];

        postEls.forEach((el, i) => {
          const author = el.querySelector('.message-name a, .username, [itemprop="name"]')?.textContent?.trim() || '';
          // bbWrapper is the actual content div in XenForo
          const bodyEl = el.querySelector('.bbWrapper, .message-userContent .bbWrapper, [class*="message-body"] .bbWrapper, .message-userContent');
          const body = bodyEl?.textContent?.trim() || '';
          const scoreEl = el.querySelector('.reactionsBar-link, [data-reaction-score]');
          const score = parseInt(scoreEl?.textContent?.replace(/[^\d]/g, '') || '0', 10);
          const dateEl = el.querySelector('time[datetime]');
          const created_at = dateEl?.getAttribute('datetime') || '';

          if (body && body.length > 30) {
            posts.push({ author, body, score, created_at, isFirst: i === 0 });
          }
        });

        const body = posts[0]?.body || '';
        const comments = posts.slice(1);

        return { title, body, comments, created_at: posts[0]?.created_at || '' };
      });

      if (!data.body || data.body.length < config.minBodyLength) return null;

      const deviceInfo = extractDeviceInfo(data.title, data.body);

      const comments: Comment[] = data.comments.map(c => ({
        author: c.author,
        body: c.body,
        score: c.score,
        is_accepted: false,
        created_at: c.created_at || new Date().toISOString(),
      }));

      const sorted = [...comments].sort((a, b) => b.score - a.score);
      const accepted_solution = sorted[0]?.body || '';

      return {
        id: uuidv4(),
        source: 'tomshardware',
        url,
        title: data.title,
        body: data.body,
        comments,
        accepted_solution,
        created_at: data.created_at || new Date().toISOString(),
        device_name: deviceInfo.device_name,
        device_brand: deviceInfo.device_brand,
        device_model: deviceInfo.device_model,
        scraped_at: new Date().toISOString(),
      };
    } catch (err) {
      logger.warn(`Tom's Hardware thread failed ${url}: ${(err as Error).message}`);
      return null;
    } finally {
      await page.close();
    }
  }
}

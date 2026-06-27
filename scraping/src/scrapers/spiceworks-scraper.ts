import { Page } from 'puppeteer';
import { v4 as uuidv4 } from 'uuid';
import { RawIncident, Comment } from '../types';
import { BaseScraper } from './base-scraper';
import { logger } from '../utils/logger';
import { sleep } from '../utils/rate-limiter';
import { extractDeviceInfo } from '../utils/device-extractor';
import { config } from '../config';

const SPICEWORKS_CATEGORIES = [
  'https://community.spiceworks.com/c/networking/20',
  'https://community.spiceworks.com/c/hardware/9',
  'https://community.spiceworks.com/c/windows/14',
  'https://community.spiceworks.com/c/security/22',
  'https://community.spiceworks.com/c/virtualization/25',
  'https://community.spiceworks.com/c/storage/21',
  'https://community.spiceworks.com/c/printers/12',
];

export class SpiceworksScraper extends BaseScraper {
  constructor() {
    super('spiceworks');
  }

  async scrapeIncidents(cursor?: string): Promise<{ incidents: RawIncident[]; nextCursor: string | null; hasMore: boolean }> {
    const incidents: RawIncident[] = [];
    await this.initBrowser();

    const startCategoryIndex = cursor ? parseInt(cursor.split(':')[0], 10) : 0;
    const startPage = cursor ? parseInt(cursor.split(':')[1] || '1', 10) : 1;

    for (let ci = startCategoryIndex; ci < SPICEWORKS_CATEGORIES.length; ci++) {
      const categoryUrl = SPICEWORKS_CATEGORIES[ci];
      let page = ci === startCategoryIndex ? startPage : 1;
      let categoryIncidents = 0;

      while (categoryIncidents < 500) {
        const listPage = await this.newPage();
        const listUrl = page === 1 ? categoryUrl : `${categoryUrl}?page=${page}`;

        logger.info(`Spiceworks: ${listUrl}`);
        const loaded = await this.navigateSafe(listPage, listUrl, 'networkidle2');
        if (!loaded) { await listPage.close(); break; }

        await sleep(1500);

        // Extract thread links — Discourse uses /t/slug/id format
        const threadLinks = await listPage.$$eval(
          'a',
          (els: Element[]) => {
            const seen = new Set<string>();
            const links: string[] = [];
            for (const el of els) {
              const href = (el as HTMLAnchorElement).href;
              // Discourse topic URLs: /t/slug/numeric-id
              if (href && /\/t\/[^/]+\/\d+/.test(href) && !seen.has(href)) {
                seen.add(href);
                links.push(href);
              }
            }
            return links.slice(0, 30);
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
          await sleep(1500);
        }

        page++;
        await sleep(2000);
      }
    }

    return { incidents, nextCursor: null, hasMore: false };
  }

  private async scrapeThread(url: string): Promise<RawIncident | null> {
    const page = await this.newPage();
    try {
      const loaded = await this.navigateSafe(page, url, 'networkidle2');
      if (!loaded) return null;

      await sleep(1000);

      const data = await page.evaluate(() => {
        // Discourse selectors
        const titleEl = document.querySelector('#topic-title h1, h1.topic-title, .fancy-title, h1');
        const title = titleEl?.textContent?.trim() || document.title;

        // Discourse posts: article.boxed or div[itemprop="articleBody"] or .cooked
        const postEls = document.querySelectorAll('article.post-stream .topic-post, .regular.contents');
        const comments: Array<{ author: string; body: string; score: number; created_at: string }> = [];
        let body = '';

        if (postEls.length > 0) {
          postEls.forEach((el, i) => {
            if (i >= 50) return;
            const author = el.querySelector('.username, [itemprop="author"] span')?.textContent?.trim() || '';
            const text = el.querySelector('.cooked, [itemprop="text"]')?.textContent?.trim() || '';
            const likes = el.querySelector('.like-count, .post-actions .likes')?.textContent?.trim() || '0';
            const score = parseInt(likes.replace(/[^\d]/g, '') || '0', 10);
            const dateEl = el.querySelector('time[itemprop="datePublished"], time[datetime]');
            const created_at = dateEl?.getAttribute('datetime') || dateEl?.getAttribute('content') || '';
            if (i === 0) { body = text; }
            else if (text && text.length > 20) {
              comments.push({ author, body: text, score, created_at });
            }
          });
        } else {
          // Fallback: grab first .cooked block
          const cookedEls = document.querySelectorAll('.cooked');
          cookedEls.forEach((el, i) => {
            if (i === 0) body = el.textContent?.trim() || '';
            else if (i < 20 && (el.textContent?.trim().length || 0) > 20) {
              comments.push({ author: '', body: el.textContent?.trim() || '', score: 0, created_at: '' });
            }
          });
        }

        const dateEl = document.querySelector('time[itemprop="datePublished"], time[datetime]');
        const created_at = dateEl?.getAttribute('datetime') || dateEl?.getAttribute('content') || '';

        return { title, body, comments, created_at };
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
        source: 'spiceworks',
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
      logger.warn(`Spiceworks thread failed ${url}: ${(err as Error).message}`);
      return null;
    } finally {
      await page.close();
    }
  }
}

import { v4 as uuidv4 } from 'uuid';
import { RawIncident, Comment } from '../types';
import { BaseScraper } from './base-scraper';
import { logger } from '../utils/logger';
import { sleep } from '../utils/rate-limiter';
import { extractDeviceInfo } from '../utils/device-extractor';
import { config } from '../config';

// iFixit device categories with known hardware/networking repair content
const IFIXIT_CATEGORIES = [
  'https://www.ifixit.com/Answers/Device/PC/Desktop-PC',
  'https://www.ifixit.com/Answers/Device/Laptop',
  'https://www.ifixit.com/Answers/Device/Printer',
  'https://www.ifixit.com/Answers/Device/Router',
  'https://www.ifixit.com/Answers/Device/Network-Switch',
  'https://www.ifixit.com/Answers/Device/PC/Server',
  'https://www.ifixit.com/Answers/Device/IP-Camera',
  'https://www.ifixit.com/Answers/Device/NAS',
  'https://www.ifixit.com/Answers/Device/UPS',
  'https://www.ifixit.com/Answers',
];

export class IFixitScraper extends BaseScraper {
  constructor() {
    super('ifixit');
  }

  async scrapeIncidents(): Promise<{ incidents: RawIncident[]; nextCursor: string | null; hasMore: boolean }> {
    return { incidents: [], nextCursor: null, hasMore: false };
  }

  private async getQuestionLinks(url: string): Promise<string[]> {
    const page = await this.newPage();
    try {
      const loaded = await this.navigateSafe(page, url, 'networkidle2');
      if (!loaded) return [];
      await sleep(1500);

      const links = await page.$$eval('a[href*="/Answers/View/"]', (els: Element[]) => {
        const seen = new Set<string>();
        const result: string[] = [];
        for (const el of els) {
          const href = (el as HTMLAnchorElement).href;
          if (href && /\/Answers\/View\/\d+/.test(href) && !seen.has(href)) {
            seen.add(href);
            result.push(href.split('#')[0]);
          }
        }
        return result.slice(0, 25);
      });

      return links;
    } catch {
      return [];
    } finally {
      await page.close();
    }
  }

  private async scrapeQuestion(url: string): Promise<RawIncident | null> {
    const page = await this.newPage();
    try {
      const loaded = await this.navigateSafe(page, url, 'networkidle2');
      if (!loaded) return null;
      await sleep(1000);

      const data = await page.evaluate(() => {
        const titleEl = document.querySelector('h1.page-title, h1.title, h1');
        const title = titleEl?.textContent?.trim() || document.title;

        // Question body — first .user-content block
        const questionEl = document.querySelector('.question .user-content, .question-body .user-content, [class*="question"] .post-content');
        const body = questionEl?.textContent?.trim() || '';

        // Answers
        const answerEls = document.querySelectorAll('.answer');
        const answers: Array<{ author: string; body: string; score: number; is_accepted: boolean; created_at: string }> = [];

        answerEls.forEach((el, i) => {
          if (i >= 10) return;
          const isAccepted = el.classList.contains('chosen') || el.querySelector('.chosen, [class*="accepted"]') !== null;
          const bodyEl = el.querySelector('.user-content, .post-content, .answer-body');
          const text = bodyEl?.textContent?.trim() || '';
          const scoreEl = el.querySelector('.votes .count, [class*="score"], [class*="vote"]');
          const score = parseInt(scoreEl?.textContent?.replace(/[^\d-]/g, '') || '0', 10);
          const author = el.querySelector('.username, .author, [class*="username"]')?.textContent?.trim() || '';
          const dateEl = el.querySelector('time[datetime], .date, [class*="date"]');
          const created_at = dateEl?.getAttribute('datetime') || dateEl?.textContent?.trim() || '';

          if (text && text.length > 20) {
            answers.push({ author, body: text, score, is_accepted: isAccepted, created_at });
          }
        });

        const questionDateEl = document.querySelector('.question time, .posted-date time, [class*="date"] time');
        const created_at = questionDateEl?.getAttribute('datetime') || new Date().toISOString();

        return { title, body, answers, created_at };
      });

      if (!data.body || data.body.length < config.minBodyLength) return null;

      const comments: Comment[] = data.answers.map(a => ({
        author: a.author,
        body: a.body,
        score: a.score,
        is_accepted: a.is_accepted,
        created_at: a.created_at || data.created_at,
      }));

      const accepted = comments.find(c => c.is_accepted);
      const acceptedSolution = accepted?.body
        || [...comments].sort((a, b) => b.score - a.score)[0]?.body
        || '';

      const deviceInfo = extractDeviceInfo(data.title, data.body);

      return {
        id: uuidv4(),
        source: 'ifixit',
        url,
        title: data.title,
        body: data.body,
        comments,
        accepted_solution: acceptedSolution,
        created_at: data.created_at,
        device_name: deviceInfo.device_name,
        device_brand: deviceInfo.device_brand,
        device_model: deviceInfo.device_model,
        scraped_at: new Date().toISOString(),
      };
    } catch (err) {
      logger.warn(`iFixit thread failed ${url}: ${(err as Error).message}`);
      return null;
    } finally {
      await page.close();
    }
  }

  async scrapeAll(
    existingUrls: Set<string>,
    onIncident: (incident: RawIncident) => void
  ): Promise<void> {
    await this.initBrowser();
    let totalCollected = 0;

    for (const categoryUrl of IFIXIT_CATEGORIES) {
      if (totalCollected >= config.maxIncidentsPerSource) break;

      // Scrape multiple pages per category
      for (let page = 1; page <= 5; page++) {
        if (totalCollected >= config.maxIncidentsPerSource) break;

        const pageUrl = page === 1 ? categoryUrl : `${categoryUrl}?page=${page}`;
        logger.info(`iFixit: ${pageUrl}`);

        const questionLinks = await this.getQuestionLinks(pageUrl);
        if (questionLinks.length === 0) break;

        for (const qUrl of questionLinks) {
          if (existingUrls.has(qUrl)) continue;
          if (totalCollected >= config.maxIncidentsPerSource) break;

          const incident = await this.scrapeQuestion(qUrl);
          if (incident) {
            existingUrls.add(qUrl);
            onIncident(incident);
            totalCollected++;
          }

          await sleep(1500);
        }

        await sleep(2000);
      }
    }

    logger.success(`iFixit: collected ${totalCollected} incidents`);
  }
}

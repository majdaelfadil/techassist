import puppeteer, { Browser, Page } from 'puppeteer';
import { RawIncident } from '../types';
import { logger } from '../utils/logger';
import { RateLimiter, withRetry, randomDelay } from '../utils/rate-limiter';
import { config } from '../config';

export interface ScraperResult {
  incidents: RawIncident[];
  nextCursor: string | null;
  hasMore: boolean;
}

export abstract class BaseScraper {
  protected browser: Browser | null = null;
  protected rateLimiter: RateLimiter;
  protected sourceName: string;

  constructor(sourceName: string) {
    this.sourceName = sourceName;
    this.rateLimiter = new RateLimiter(config.scraperRateLimitMs);
  }

  async initBrowser(): Promise<void> {
    if (this.browser) return;
    logger.info(`Launching Puppeteer browser for ${this.sourceName}...`);

    const puppeteerExtra = require('puppeteer-extra');
    const StealthPlugin = require('puppeteer-extra-plugin-stealth');
    puppeteerExtra.use(StealthPlugin());

    this.browser = await puppeteerExtra.launch({
      headless: config.headless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--window-size=1280,800',
        '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      ],
    });
  }

  async closeBrowser(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  protected async newPage(): Promise<Page> {
    if (!this.browser) await this.initBrowser();
    const page = await this.browser!.newPage();

    await page.setViewport({ width: 1280, height: 800 });
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    });

    // Block images, fonts, and media to speed up scraping
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const type = req.resourceType();
      if (['image', 'media', 'font', 'stylesheet'].includes(type)) {
        req.abort();
      } else {
        req.continue();
      }
    });

    return page;
  }

  protected async navigateSafe(page: Page, url: string, waitFor: 'networkidle0' | 'networkidle2' | 'domcontentloaded' = 'domcontentloaded'): Promise<boolean> {
    await this.rateLimiter.throttle();
    try {
      await withRetry(
        async () => {
          await page.goto(url, {
            waitUntil: waitFor,
            timeout: 30000,
          });
        },
        config.scraperMaxRetries,
        2000,
        `navigate to ${url}`
      );
      await randomDelay(500, 1200);
      return true;
    } catch (err) {
      logger.warn(`Failed to navigate to ${url}: ${(err as Error).message}`);
      return false;
    }
  }

  protected async safeText(page: Page, selector: string): Promise<string> {
    try {
      return await page.$eval(selector, (el: Element) => el.textContent?.trim() || '');
    } catch {
      return '';
    }
  }

  protected async safeAttr(page: Page, selector: string, attr: string): Promise<string> {
    try {
      return await page.$eval(selector, (el: Element, a: string) => el.getAttribute(a) || '', attr);
    } catch {
      return '';
    }
  }

  abstract scrapeIncidents(cursor?: string): Promise<ScraperResult>;
}

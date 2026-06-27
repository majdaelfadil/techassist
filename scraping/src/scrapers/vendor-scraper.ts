import { v4 as uuidv4 } from 'uuid';
import { RawIncident, Comment } from '../types';
import { BaseScraper } from './base-scraper';
import { logger } from '../utils/logger';
import { sleep } from '../utils/rate-limiter';
import { extractDeviceInfo } from '../utils/device-extractor';
import { config } from '../config';

export interface VendorConfig {
  name: string;
  listingUrls: string[];
  threadLinkSelector: string;
  threadLinkFilter: (href: string) => boolean;
  titleSelector: string;
  bodySelector: string;
  commentSelector: string;
  commentAuthorSelector: string;
  commentBodySelector: string;
  commentScoreSelector: string;
  dateSelector: string;
  paginationSelector?: string;
  nextPageFn?: (page: number) => string;
  maxPages?: number;
  waitUntil?: 'networkidle0' | 'networkidle2' | 'domcontentloaded';
}

const VENDOR_CONFIGS: VendorConfig[] = [
  {
    name: 'cisco-community',
    listingUrls: [
      'https://community.cisco.com/t5/networking/bd-p/disc-networking',
      'https://community.cisco.com/t5/security/bd-p/disc-security',
      'https://community.cisco.com/t5/switching/bd-p/disc-switching',
      'https://community.cisco.com/t5/wireless/bd-p/disc-wireless',
    ],
    threadLinkSelector: 'a[href*="/t5/"][href*="/td-p/"]',
    threadLinkFilter: (href) => href.includes('/td-p/'),
    titleSelector: 'h1.lia-message-subject, .page-header h1',
    bodySelector: '.lia-message-body-content, .post-body',
    commentSelector: '.lia-message-view-wrapper',
    commentAuthorSelector: '.UserName, .lia-user-name',
    commentBodySelector: '.lia-message-body-content',
    commentScoreSelector: '.lia-kudos-count',
    dateSelector: 'span.local-date',
    waitUntil: 'networkidle2',
    maxPages: 10,
  },
  {
    name: 'dell-community',
    listingUrls: [
      'https://www.dell.com/community/en/conversations/poweredge',
      'https://www.dell.com/community/en/conversations/laptops-general',
      'https://www.dell.com/community/en/conversations/networking',
    ],
    threadLinkSelector: 'a[href*="/conversations/"]',
    threadLinkFilter: (href) => href.includes('/conversations/') && href.split('/').length > 6,
    titleSelector: 'h1, .page-header',
    bodySelector: '.lia-message-body, .post-content',
    commentSelector: '.lia-message-view',
    commentAuthorSelector: '.lia-user-name',
    commentBodySelector: '.lia-message-body',
    commentScoreSelector: '.lia-kudos-count',
    dateSelector: 'span.local-date',
    waitUntil: 'networkidle2',
    maxPages: 5,
  },
  {
    name: 'ubiquiti-community',
    listingUrls: [
      'https://community.ui.com/questions',
      'https://community.ui.com/releases',
    ],
    threadLinkSelector: 'a[href*="/questions/"]',
    threadLinkFilter: (href) => href.includes('/questions/') && !href.endsWith('/questions/'),
    titleSelector: 'h1',
    bodySelector: '.post-content, .entry-content, article',
    commentSelector: '.answer, .reply, .comment',
    commentAuthorSelector: '.author, .username',
    commentBodySelector: '.content, .body',
    commentScoreSelector: '.votes, .score',
    dateSelector: 'time',
    waitUntil: 'networkidle2',
    maxPages: 10,
  },
  {
    name: 'hp-community',
    listingUrls: [
      'https://h30434.www3.hp.com/t5/Printer-Technical-Assistance/bd-p/itcc1',
      'https://h30434.www3.hp.com/t5/Notebook-Hardware-and-Upgrade-Questions/bd-p/nbhardware',
      'https://h30434.www3.hp.com/t5/Business-Notebooks/bd-p/businessnotebooks',
    ],
    threadLinkSelector: 'a[href*="/td-p/"]',
    threadLinkFilter: (href) => href.includes('/td-p/'),
    titleSelector: 'h1.lia-message-subject',
    bodySelector: '.lia-message-body-content',
    commentSelector: '.lia-message-view-wrapper',
    commentAuthorSelector: '.lia-user-name',
    commentBodySelector: '.lia-message-body-content',
    commentScoreSelector: '.lia-kudos-count',
    dateSelector: 'span.local-date',
    waitUntil: 'networkidle2',
    maxPages: 8,
  },
  {
    name: 'microsoft-community',
    listingUrls: [
      'https://answers.microsoft.com/en-us/windows',
      'https://answers.microsoft.com/en-us/msserver',
    ],
    threadLinkSelector: 'a[href*="/en-us/"][href*="/thread/"]',
    threadLinkFilter: (href) => href.includes('/thread/'),
    titleSelector: 'h1, .thread-title',
    bodySelector: '.thread-question-content, .post-content',
    commentSelector: '.reply-section .single-reply',
    commentAuthorSelector: '.user-name',
    commentBodySelector: '.reply-content',
    commentScoreSelector: '.helpful-count',
    dateSelector: 'time, .timestamp',
    waitUntil: 'networkidle2',
    maxPages: 5,
  },
];

export class VendorScraper extends BaseScraper {
  constructor() {
    super('vendor');
  }

  async scrapeIncidents(): Promise<{ incidents: RawIncident[]; nextCursor: string | null; hasMore: boolean }> {
    const incidents: RawIncident[] = [];
    await this.initBrowser();

    for (const vendorConfig of VENDOR_CONFIGS) {
      logger.info(`Scraping vendor community: ${vendorConfig.name}`);
      const vendorIncidents = await this.scrapeVendor(vendorConfig);
      incidents.push(...vendorIncidents);
      logger.success(`${vendorConfig.name}: collected ${vendorIncidents.length} incidents`);
    }

    return { incidents, nextCursor: null, hasMore: false };
  }

  private async scrapeVendor(vc: VendorConfig): Promise<RawIncident[]> {
    const incidents: RawIncident[] = [];

    for (const listingUrl of vc.listingUrls) {
      const maxPages = vc.maxPages || 5;

      for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
        const pageUrl = pageNum === 1
          ? listingUrl
          : `${listingUrl}?page=${pageNum}`;

        const listPage = await this.newPage();
        logger.info(`  ${vc.name}: ${pageUrl}`);
        const loaded = await this.navigateSafe(listPage, pageUrl, vc.waitUntil || 'domcontentloaded');
        if (!loaded) { await listPage.close(); break; }

        await sleep(2000);

        let threadLinks: string[] = [];
        try {
          threadLinks = await listPage.$$eval(
            vc.threadLinkSelector,
            (els: Element[], filter: string) => {
              const filterFn = new Function('href', `return ${filter}`);
              const seen = new Set<string>();
              const links: string[] = [];
              for (const el of els) {
                const href = (el as HTMLAnchorElement).href;
                if (href && filterFn(href) && !seen.has(href)) {
                  seen.add(href);
                  links.push(href);
                }
              }
              return links.slice(0, 20);
            },
            vc.threadLinkFilter.toString().replace('(href) =>', 'return').replace('=>', '; return')
          );
        } catch {
          // Fallback: collect all /topic/ or /thread/ links
          threadLinks = await listPage.$$eval('a[href]', (els: Element[]) => {
            const seen = new Set<string>();
            const links: string[] = [];
            for (const el of els) {
              const href = (el as HTMLAnchorElement).href;
              if (href && (href.includes('/thread/') || href.includes('/topic/') || href.includes('/td-p/') || href.includes('/questions/')) && !seen.has(href)) {
                seen.add(href);
                links.push(href);
              }
            }
            return links.slice(0, 20);
          });
        }

        await listPage.close();

        if (threadLinks.length === 0) break;

        for (const threadUrl of threadLinks) {
          const incident = await this.scrapeVendorThread(threadUrl, vc);
          if (incident) incidents.push(incident);
          await sleep(2000);
        }
      }
    }

    return incidents;
  }

  private async scrapeVendorThread(url: string, vc: VendorConfig): Promise<RawIncident | null> {
    const page = await this.newPage();
    try {
      const loaded = await this.navigateSafe(page, url, vc.waitUntil || 'domcontentloaded');
      if (!loaded) return null;

      await sleep(1500);

      const data = await page.evaluate(
        (titleSel, bodySel, commentSel, commentAuthorSel, commentBodySel, commentScoreSel, dateSel) => {
          const titleEl = document.querySelector(titleSel);
          const title = titleEl?.textContent?.trim() || document.title;

          const bodyEl = document.querySelector(bodySel);
          const body = bodyEl?.textContent?.trim() || '';

          const commentEls = document.querySelectorAll(commentSel);
          const comments: Array<{ author: string; body: string; score: number; created_at: string }> = [];

          commentEls.forEach((el, i) => {
            if (i >= 200) return;
            const author = el.querySelector(commentAuthorSel)?.textContent?.trim() || '';
            const cBody = el.querySelector(commentBodySel)?.textContent?.trim() || '';
            const scoreText = el.querySelector(commentScoreSel)?.textContent?.replace(/[^\d]/g, '') || '0';
            const score = parseInt(scoreText, 10) || 0;
            const dateEl = el.querySelector(dateSel);
            const created_at = dateEl?.getAttribute('datetime') || dateEl?.textContent?.trim() || '';

            if (cBody && cBody.length > 20) {
              comments.push({ author, body: cBody, score, created_at });
            }
          });

          const mainDateEl = document.querySelector(dateSel);
          const created_at = mainDateEl?.getAttribute('datetime') || mainDateEl?.textContent?.trim() || '';

          return { title, body, comments, created_at };
        },
        vc.titleSelector,
        vc.bodySelector,
        vc.commentSelector,
        vc.commentAuthorSelector,
        vc.commentBodySelector,
        vc.commentScoreSelector,
        vc.dateSelector
      );

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
        source: vc.name,
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
      logger.warn(`Vendor thread failed ${url}: ${(err as Error).message}`);
      return null;
    } finally {
      await page.close();
    }
  }
}

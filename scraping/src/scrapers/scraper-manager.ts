import { RawIncident } from '../types';
import { logger } from '../utils/logger';
import { appendJsonl, getExistingIds, saveProgress, loadProgress, countLines } from '../utils/storage';
import { config } from '../config';
import { RedditScraper } from './reddit-scraper';
import { ServerFaultScraper } from './serverfault-scraper';
import { SpiceworksScraper } from './spiceworks-scraper';
import { TomsHardwareScraper } from './tomshardware-scraper';
import { VendorScraper } from './vendor-scraper';
import { SuperUserScraper } from './superuser-scraper';
import { IFixitScraper } from './ifixit-scraper';
import { CommunityScraper } from './community-scraper';
import { RedditHtmlScraper } from './reddit-html-scraper';
import { BleepingComputerScraper } from './bleepingcomputer-scraper';
import { AnandTechScraper } from './anandtech-scraper';

interface ScrapeProgress {
  reddit: Record<string, string>;
  lastUpdated: string;
}

export type SourceName = 'reddit' | 'reddit-html' | 'serverfault' | 'spiceworks' | 'tomshardware' | 'vendors' | 'superuser' | 'ifixit' | 'community' | 'bleepingcomputer' | 'anandtech' | 'all';

export class ScraperManager {
  private existingUrls: Set<string>;
  private totalSaved = 0;

  constructor() {
    this.existingUrls = new Set();
  }

  private onIncident(incident: RawIncident): void {
    if (this.existingUrls.has(incident.url)) return;
    this.existingUrls.add(incident.url);
    appendJsonl(config.rawIncidentsFile, incident);
    this.totalSaved++;

    if (this.totalSaved % 100 === 0) {
      logger.success(`Saved ${this.totalSaved} raw incidents`);
    }
  }

  async run(source: SourceName = 'all'): Promise<void> {
    logger.info('=== Scraper Manager Starting ===');
    logger.info(`Target file: ${config.rawIncidentsFile}`);

    // Load existing URLs to avoid duplicates
    this.existingUrls = getExistingIds(config.rawIncidentsFile);
    const existingCount = countLines(config.rawIncidentsFile);
    logger.info(`Found ${existingCount} existing incidents in raw file`);

    const progress = loadProgress<ScrapeProgress>(config.progressFile) || {
      reddit: {},
      lastUpdated: new Date().toISOString(),
    };

    try {
      if (source === 'reddit' || source === 'all') {
        await this.runReddit(progress);
      }

      if (source === 'reddit-html' || source === 'all') {
        await this.runRedditHtml();
      }

      if (source === 'serverfault' || source === 'all') {
        await this.runServerFault();
      }

      if (source === 'spiceworks' || source === 'all') {
        await this.runSpiceworks();
      }

      if (source === 'tomshardware' || source === 'all') {
        await this.runTomsHardware();
      }

      if (source === 'vendors' || source === 'all') {
        await this.runVendors();
      }

      if (source === 'superuser' || source === 'all') {
        await this.runSuperUser();
      }

      if (source === 'ifixit' || source === 'all') {
        await this.runIFixit();
      }

      if (source === 'community' || source === 'all') {
        await this.runCommunity();
      }

      if (source === 'bleepingcomputer' || source === 'all') {
        await this.runBleepingComputer();
      }

      if (source === 'anandtech' || source === 'all') {
        await this.runAnandTech();
      }
    } finally {
      saveProgress(config.progressFile, {
        ...progress,
        lastUpdated: new Date().toISOString(),
      });
    }

    const finalCount = countLines(config.rawIncidentsFile);
    logger.success(`=== Scraping complete. Total raw incidents: ${finalCount} ===`);
  }

  private async runReddit(progress: ScrapeProgress): Promise<void> {
    logger.info('--- Starting Reddit scraper ---');
    const scraper = new RedditScraper();

    await scraper.scrapeAll(
      this.existingUrls,
      (incident) => this.onIncident(incident),
      progress.reddit
    );

    saveProgress(config.progressFile, { ...progress, lastUpdated: new Date().toISOString() });
    logger.success(`Reddit done. Saved so far: ${this.totalSaved}`);
  }

  private async runServerFault(): Promise<void> {
    logger.info('--- Starting ServerFault scraper ---');
    const scraper = new ServerFaultScraper();

    await scraper.scrapeAll(
      this.existingUrls,
      (incident) => this.onIncident(incident)
    );

    logger.success(`ServerFault done. Saved so far: ${this.totalSaved}`);
  }

  private async runSpiceworks(): Promise<void> {
    logger.info('--- Starting Spiceworks scraper ---');
    const scraper = new SpiceworksScraper();

    try {
      const { incidents } = await scraper.scrapeIncidents();
      for (const incident of incidents) this.onIncident(incident);
    } finally {
      await scraper.closeBrowser();
    }

    logger.success(`Spiceworks done. Saved so far: ${this.totalSaved}`);
  }

  private async runTomsHardware(): Promise<void> {
    logger.info("--- Starting Tom's Hardware scraper ---");
    const scraper = new TomsHardwareScraper();

    try {
      const { incidents } = await scraper.scrapeIncidents();
      for (const incident of incidents) this.onIncident(incident);
    } finally {
      await scraper.closeBrowser();
    }

    logger.success(`Tom's Hardware done. Saved so far: ${this.totalSaved}`);
  }

  private async runVendors(): Promise<void> {
    logger.info('--- Starting Vendor Communities scraper ---');
    const scraper = new VendorScraper();

    try {
      const { incidents } = await scraper.scrapeIncidents();
      for (const incident of incidents) this.onIncident(incident);
    } finally {
      await scraper.closeBrowser();
    }

    logger.success(`Vendors done. Saved so far: ${this.totalSaved}`);
  }

  private async runRedditHtml(): Promise<void> {
    logger.info('--- Starting Reddit HTML scraper (old.reddit.com, no API) ---');
    const scraper = new RedditHtmlScraper();
    await scraper.scrapeAll(this.existingUrls, (incident) => this.onIncident(incident));
    logger.success(`Reddit HTML done. Saved so far: ${this.totalSaved}`);
  }

  private async runSuperUser(): Promise<void> {
    logger.info('--- Starting SuperUser/ServerFault HTML scraper ---');
    const scraper = new SuperUserScraper();
    await scraper.scrapeAll(this.existingUrls, (incident) => this.onIncident(incident));
    logger.success(`SuperUser done. Saved so far: ${this.totalSaved}`);
  }

  private async runIFixit(): Promise<void> {
    logger.info('--- Starting iFixit scraper ---');
    const scraper = new IFixitScraper();
    try {
      await scraper.scrapeAll(this.existingUrls, (incident) => this.onIncident(incident));
    } finally {
      await scraper.closeBrowser();
    }
    logger.success(`iFixit done. Saved so far: ${this.totalSaved}`);
  }

  private async runCommunity(): Promise<void> {
    logger.info('--- Starting Community Forums scraper (Proxmox, TrueNAS, TP-Link, MikroTik, IP Cam Talk, LinuxQuestions) ---');
    const scraper = new CommunityScraper();
    await scraper.scrapeAll(this.existingUrls, (incident) => this.onIncident(incident));
    logger.success(`Community done. Saved so far: ${this.totalSaved}`);
  }

  private async runBleepingComputer(): Promise<void> {
    logger.info('--- Starting BleepingComputer scraper ---');
    const scraper = new BleepingComputerScraper();
    await scraper.scrapeAll(this.existingUrls, (incident) => this.onIncident(incident));
    logger.success(`BleepingComputer done. Saved so far: ${this.totalSaved}`);
  }

  private async runAnandTech(): Promise<void> {
    logger.info('--- Starting AnandTech Forum scraper ---');
    const scraper = new AnandTechScraper();
    await scraper.scrapeAll(this.existingUrls, (incident) => this.onIncident(incident));
    logger.success(`AnandTech done. Saved so far: ${this.totalSaved}`);
  }

  getStats(): { total: number } {
    return { total: this.totalSaved };
  }
}

import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { RawIncident, Comment } from '../types';
import { logger } from '../utils/logger';
import { RateLimiter, withRetry, sleep } from '../utils/rate-limiter';
import { extractDeviceInfo } from '../utils/device-extractor';
import { config, STACK_EXCHANGE_TAGS } from '../config';

interface SEQuestion {
  question_id: number;
  title: string;
  body: string;
  body_markdown: string;
  score: number;
  creation_date: number;
  link: string;
  tags: string[];
  accepted_answer_id?: number;
}

interface SEAnswer {
  answer_id: number;
  body: string;
  body_markdown: string;
  score: number;
  is_accepted: boolean;
  creation_date: number;
  owner: { display_name: string };
}

export class ServerFaultScraper {
  private rateLimiter = new RateLimiter(3000);
  private apiBase = 'https://api.stackexchange.com/2.3';

  private get params() {
    return config.stackExchangeApiKey ? `&key=${config.stackExchangeApiKey}` : '';
  }

  private async fetchQuestions(
    site: string,
    tag: string,
    page: number
  ): Promise<{ questions: SEQuestion[]; hasMore: boolean }> {
    await this.rateLimiter.throttle();

    // filter=!nNPvSNdWme includes body, body_markdown, and accepted_answer_id
    const url = `${this.apiBase}/questions?site=${site}&tagged=${tag}&sort=votes&order=desc&pagesize=50&page=${page}&filter=!nNPvSNdWme${this.params}`;

    const res = await withRetry(
      () => axios.get(url, { timeout: 15000 }),
      3,
      3000,
      `SE questions tag=${tag} page=${page}`
    );

    // Detect quota exhaustion
    if (res.data.quota_remaining !== undefined && res.data.quota_remaining < 5) {
      logger.warn(`Stack Exchange API quota nearly exhausted (${res.data.quota_remaining} remaining). Add STACK_EXCHANGE_API_KEY to .env for 10k/day.`);
    }

    return {
      questions: res.data.items || [],
      hasMore: res.data.has_more,
    };
  }

  private async fetchAnswers(site: string, questionIds: number[]): Promise<Map<number, SEAnswer[]>> {
    await this.rateLimiter.throttle();

    const ids = questionIds.join(';');
    const url = `${this.apiBase}/questions/${ids}/answers?site=${site}&sort=votes&order=desc&pagesize=100&filter=withbody${this.params}`;

    const map = new Map<number, SEAnswer[]>();
    try {
      const res = await withRetry(
        () => axios.get(url, { timeout: 15000 }),
        2,
        3000,
        `SE answers for ${ids}`
      );

      for (const answer of res.data.items as SEAnswer[]) {
        // answers don't include question_id in this endpoint, reconstruct from context
      }

      // Fetch per question to properly map
      for (const qid of questionIds) {
        await this.rateLimiter.throttle();
        const qUrl = `${this.apiBase}/questions/${qid}/answers?site=${site}&sort=votes&order=desc&pagesize=50&filter=withbody${this.params}`;
        try {
          const qRes = await withRetry(
            () => axios.get(qUrl, { timeout: 15000 }),
            2,
            3000,
            `SE answers qid=${qid}`
          );
          map.set(qid, qRes.data.items || []);
        } catch {
          map.set(qid, []);
        }
      }
    } catch (err) {
      logger.warn(`Failed to fetch SE answers: ${(err as Error).message}`);
    }

    return map;
  }

  private htmlToText(html: string): string {
    return html
      .replace(/<pre[^>]*>[\s\S]*?<\/pre>/gi, '[CODE BLOCK]')
      .replace(/<code[^>]*>([^<]*)<\/code>/gi, '$1')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .trim();
  }

  private buildIncident(question: SEQuestion, answers: SEAnswer[]): RawIncident {
    const body = this.htmlToText(question.body || '');
    const comments: Comment[] = answers.map(a => ({
      author: a.owner?.display_name || 'Unknown',
      body: this.htmlToText(a.body || ''),
      score: a.score,
      is_accepted: a.is_accepted,
      created_at: new Date(a.creation_date * 1000).toISOString(),
    }));

    const acceptedAnswer = answers.find(a => a.is_accepted);
    const bestAnswer = acceptedAnswer || answers.sort((a, b) => b.score - a.score)[0];
    const accepted_solution = bestAnswer ? this.htmlToText(bestAnswer.body) : '';

    const deviceInfo = extractDeviceInfo(question.title, body);

    return {
      id: uuidv4(),
      source: 'serverfault',
      url: question.link,
      title: question.title,
      body,
      comments,
      accepted_solution,
      created_at: new Date(question.creation_date * 1000).toISOString(),
      device_name: deviceInfo.device_name,
      device_brand: deviceInfo.device_brand,
      device_model: deviceInfo.device_model,
      scraped_at: new Date().toISOString(),
    };
  }

  async scrapeAll(
    existingUrls: Set<string>,
    onIncident: (incident: RawIncident) => void
  ): Promise<void> {
    let totalCollected = 0;
    let quotaExhausted = false;

    for (const tag of STACK_EXCHANGE_TAGS) {
      if (quotaExhausted) break;
      logger.info(`ServerFault: scraping tag "${tag}"`);
      let page = 1;

      while (totalCollected < config.maxIncidentsPerSource * 2) {
        let questions: SEQuestion[];
        let hasMore: boolean;

        try {
          const result = await this.fetchQuestions('serverfault', tag, page);
          questions = result.questions;
          hasMore = result.hasMore;
        } catch (err) {
          const msg = (err as Error).message;
          if (msg.includes('400') || msg.includes('throttle') || msg.includes('quota')) {
            logger.warn(`ServerFault quota exhausted or bad request. Add STACK_EXCHANGE_API_KEY to .env for 10k req/day (free at stackapps.com).`);
            quotaExhausted = true;
          } else {
            logger.warn(`ServerFault tag=${tag} page=${page} failed: ${msg}`);
          }
          break;
        }

        if (questions.length === 0) break;

        const newQuestions = questions.filter(q => !existingUrls.has(q.link));
        if (newQuestions.length === 0) { page++; if (!hasMore) break; continue; }

        const qIds = newQuestions.map(q => q.question_id);

        // Batch answer fetching
        const batchSize = 10;
        for (let i = 0; i < qIds.length; i += batchSize) {
          const batch = newQuestions.slice(i, i + batchSize);
          const answerMap = await this.fetchAnswers('serverfault', batch.map(q => q.question_id));

          for (const question of batch) {
            if (existingUrls.has(question.link)) continue;
            if (!question.body || question.body.length < 50) continue;

            const answers = answerMap.get(question.question_id) || [];
            const incident = this.buildIncident(question, answers);

            existingUrls.add(incident.url);
            onIncident(incident);
            totalCollected++;
          }

          await sleep(1000);
        }

        logger.info(`ServerFault tag=${tag}: page ${page}, total ${totalCollected}`);
        page++;
        if (!hasMore) break;
        await sleep(2000);
      }
    }
  }
}

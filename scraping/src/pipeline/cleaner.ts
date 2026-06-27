import { RawIncident, CleanedIncident, Comment } from '../types';
import { logger } from '../utils/logger';
import { readJsonlStream, writeJsonl, countLines } from '../utils/storage';
import { config } from '../config';

const URL_REGEX = /https?:\/\/[^\s]+/g;
const MARKDOWN_LINK_REGEX = /\[([^\]]+)\]\([^)]+\)/g;
const HTML_TAG_REGEX = /<[^>]+>/g;
const HTML_ENTITY_REGEX = /&(?:amp|lt|gt|quot|#39|nbsp|apos);/g;
const REDDIT_EDIT_REGEX = /\*{0,2}EDIT\*{0,2}:?/gi;
const SIGNATURE_PATTERNS = [
  /^-{2,}\s*\n[\s\S]{0,200}$/m,
  /^Sent from my .+/im,
  /^Posted via .+/im,
  /^Thanks,?\s*\n\w+/im,
  /^Best regards,?[\s\S]{0,100}$/im,
];
const ADVERTISEMENT_PATTERNS = [
  /sponsored|advertisement|click here|sign up now|free trial|buy now/gi,
  /\[advertisement\]/gi,
];
const WHITESPACE_REGEX = /[ \t]{2,}/g;
const MULTI_NEWLINE_REGEX = /\n{3,}/g;

const HTML_ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&nbsp;': ' ',
  '&apos;': "'",
};

function decodeHtmlEntities(text: string): string {
  return text.replace(HTML_ENTITY_REGEX, match => HTML_ENTITIES[match] || match);
}

function cleanText(raw: string): string {
  if (!raw) return '';

  let text = raw;

  // Remove HTML tags
  text = text.replace(HTML_TAG_REGEX, ' ');

  // Decode HTML entities
  text = decodeHtmlEntities(text);

  // Convert markdown links to plain text
  text = text.replace(MARKDOWN_LINK_REGEX, '$1');

  // Remove URLs
  text = text.replace(URL_REGEX, '');

  // Remove reddit-specific edit markers
  text = text.replace(REDDIT_EDIT_REGEX, '');

  // Remove signatures
  for (const pattern of SIGNATURE_PATTERNS) {
    text = text.replace(pattern, '');
  }

  // Remove advertisements
  for (const pattern of ADVERTISEMENT_PATTERNS) {
    text = text.replace(pattern, '');
  }

  // Normalize whitespace
  text = text.replace(WHITESPACE_REGEX, ' ');
  text = text.replace(MULTI_NEWLINE_REGEX, '\n\n');

  // Remove leading/trailing whitespace
  text = text.trim();

  return text;
}

function cleanComment(comment: Comment): Comment {
  return {
    ...comment,
    body: cleanText(comment.body),
  };
}

function qualityScore(incident: RawIncident, cleanedBody: string): number {
  let score = 0;

  // Body length scoring (up to 40 points)
  if (cleanedBody.length >= 500) score += 40;
  else if (cleanedBody.length >= 200) score += 25;
  else if (cleanedBody.length >= 100) score += 15;
  else score += 5;

  // Has accepted solution (20 points)
  if (incident.accepted_solution && incident.accepted_solution.length > 50) score += 20;

  // Comment quality (up to 20 points)
  const meaningfulComments = incident.comments.filter(c => c.body.length > 50).length;
  score += Math.min(meaningfulComments * 2, 20);

  // Device information available (10 points)
  if (incident.device_brand !== 'Unknown') score += 5;
  if (incident.device_model) score += 5;

  // Title quality (10 points)
  if (incident.title.length > 20 && incident.title.length < 200) score += 10;

  return Math.min(score, 100);
}

export async function runCleaningPipeline(): Promise<void> {
  logger.info('=== Starting Cleaning Pipeline ===');

  const inputCount = countLines(config.rawIncidentsFile);
  logger.info(`Input: ${inputCount} raw incidents`);

  const cleaned: CleanedIncident[] = [];
  let processed = 0;
  let skipped = 0;

  await readJsonlStream<RawIncident>(config.rawIncidentsFile, (incident) => {
    processed++;

    const cleanedBody = cleanText(incident.body);
    const cleanedSolution = cleanText(incident.accepted_solution);

    // Skip if body too short after cleaning
    if (cleanedBody.length < config.minBodyLength) {
      skipped++;
      return;
    }

    // Skip if title looks like spam
    if (!incident.title || incident.title.length < 5) {
      skipped++;
      return;
    }

    const cleanedComments = incident.comments
      .map(cleanComment)
      .filter(c => c.body.length > 20);

    const score = qualityScore(incident, cleanedBody);

    cleaned.push({
      ...incident,
      cleaned_body: cleanedBody,
      cleaned_solution: cleanedSolution,
      comments: cleanedComments,
      quality_score: score,
    });

    if (processed % 1000 === 0) {
      logger.progress(processed, inputCount, 'Cleaning');
    }
  });

  writeJsonl(config.cleanedFile, cleaned);
  logger.success(`Cleaning complete: ${cleaned.length} kept, ${skipped} skipped`);
  logger.info(`Output: ${config.cleanedFile}`);
}

import { CleanedIncident } from '../types';
import { logger } from '../utils/logger';
import { readAllJsonl, writeJsonl, countLines } from '../utils/storage';
import { config } from '../config';

const SPAM_PATTERNS = [
  /make money|earn \$|click here|free gift|limited offer/gi,
  /(.)\1{8,}/,  // same character repeated 8+ times (e.g. aaaaaaaaaa)
];

const NON_TECHNICAL_KEYWORDS = [
  'homework', 'assignment', 'school project', 'what is the best game',
  'recommend a laptop for gaming', 'which gpu should i buy',
  'is this a good deal', 'how much does it cost',
];

const TECHNICAL_KEYWORDS = [
  'error', 'issue', 'problem', 'fail', 'crash', 'not working', 'broken',
  'configure', 'install', 'setup', 'connect', 'disconnect', 'slow',
  'timeout', 'packet', 'ping', 'ip address', 'dns', 'dhcp', 'vlan',
  'boot', 'bsod', 'blue screen', 'driver', 'firmware', 'update',
  'restart', 'reboot', 'power', 'overheating', 'fan', 'port',
  'cable', 'router', 'switch', 'firewall', 'vpn', 'ssl', 'certificate',
  'printer', 'scan', 'queue', 'spooler', 'ink', 'toner',
  'camera', 'nvr', 'dvr', 'recording', 'motion', 'alert',
  'server', 'backup', 'restore', 'raid', 'storage', 'nas',
  'network', 'wifi', 'ethernet', 'ssid', 'wpa', 'wpa2',
];

function isSpam(text: string): boolean {
  return SPAM_PATTERNS.some(p => p.test(text));
}

function isTechnical(title: string, body: string): boolean {
  const combined = (title + ' ' + body).toLowerCase();
  const score = TECHNICAL_KEYWORDS.filter(kw => combined.includes(kw)).length;
  return score >= 1;
}

function isNonTechnical(title: string, body: string): boolean {
  const combined = (title + ' ' + body).toLowerCase();
  return NON_TECHNICAL_KEYWORDS.some(kw => combined.includes(kw));
}

function hasMinimumContent(incident: CleanedIncident): boolean {
  if (incident.cleaned_body.length < config.minBodyLength) return false;
  if (!incident.title || incident.title.trim().length < 5) return false;
  return true;
}

function hasQuestionStructure(title: string, body: string): boolean {
  const combined = title + ' ' + body;
  // Must look like a question/problem report, not a tutorial
  const questionIndicators = ['?', 'how', 'why', 'what', 'when', 'where', 'issue', 'problem', 'help', 'not working'];
  return questionIndicators.some(q => combined.toLowerCase().includes(q));
}

export async function runQualityFilter(): Promise<void> {
  logger.info('=== Starting Quality Filter ===');

  const inputCount = countLines(config.cleanedFile);
  logger.info(`Input: ${inputCount} cleaned incidents`);

  const incidents = await readAllJsonl<CleanedIncident>(config.cleanedFile);
  const filtered: CleanedIncident[] = [];
  let stats = { spam: 0, nonTechnical: 0, tooShort: 0, noStructure: 0, passed: 0 };

  for (let i = 0; i < incidents.length; i++) {
    const incident = incidents[i];

    if (!hasMinimumContent(incident)) {
      stats.tooShort++;
      continue;
    }

    if (isSpam(incident.title + ' ' + incident.cleaned_body)) {
      stats.spam++;
      continue;
    }

    if (isNonTechnical(incident.title, incident.cleaned_body)) {
      stats.nonTechnical++;
      continue;
    }

    if (!isTechnical(incident.title, incident.cleaned_body)) {
      stats.nonTechnical++;
      continue;
    }

    if (!hasQuestionStructure(incident.title, incident.cleaned_body)) {
      stats.noStructure++;
      continue;
    }

    filtered.push(incident);
    stats.passed++;

    if (i % 1000 === 0) {
      logger.progress(i, incidents.length, 'Quality Filter');
    }
  }

  writeJsonl(config.cleanedFile, filtered);

  logger.success(`Quality filter complete:`);
  logger.info(`  Passed:        ${stats.passed}`);
  logger.info(`  Too short:     ${stats.tooShort}`);
  logger.info(`  Spam:          ${stats.spam}`);
  logger.info(`  Non-technical: ${stats.nonTechnical}`);
  logger.info(`  No structure:  ${stats.noStructure}`);
}

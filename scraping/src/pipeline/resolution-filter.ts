import { CleanedIncident, ResolutionScore, LabelQuality } from '../types';
import { logger } from '../utils/logger';
import { readAllJsonl, writeJsonl, countLines } from '../utils/storage';
import { config } from '../config';

// ────────────────────────────────────────────────────────────
// Resolution quality signals
// ────────────────────────────────────────────────────────────

const OP_CONFIRMATION_PHRASES = [
  'this fixed it', 'this worked', 'problem solved', 'issue resolved',
  'solved!', 'resolved!', 'that was it', 'you were right',
  'worked perfectly', 'thanks that fixed', 'marking as solved',
  'marking solved', 'editing to add', 'edit: fixed', 'update: fixed',
  'edit: solved', 'edit: resolved', 'turned out to be', 'it was the',
  'the fix was', 'the solution was', 'ended up', 'figured it out',
];

const SOLVED_KEYWORDS = [
  'solved', 'solution', 'fixed', 'resolved', 'working now', 'works now',
  'got it working', 'issue fixed', 'problem fixed', 'found the fix',
  'found the issue', 'root cause', 'cause was', 'the problem was',
];

const UNRESOLVED_INDICATORS = [
  'still not working', 'still having issues', 'no solution',
  'nobody helped', 'gave up', 'abandoned', 'unresolved',
  'still broken', 'still failing', 'no fix', 'nothing worked',
  'waiting for response', 'crickets', 'any ideas?',
];

const TECHNICAL_DEPTH_KEYWORDS = [
  'ip address', 'mac address', 'vlan', 'firmware', 'driver', 'registry',
  'config', 'log', 'error code', 'event id', 'traceroute', 'ping',
  'dhcp', 'dns', 'gateway', 'subnet', 'bios', 'uefi', 'raid', 'mdm',
  'ssl', 'certificate', 'port', 'protocol', 'packet', 'latency',
  'throughput', 'bandwidth', 'cpu', 'memory', 'disk', 'ssd', 'hdd',
];

// ────────────────────────────────────────────────────────────
// Scoring function
// ────────────────────────────────────────────────────────────

export function scoreResolution(incident: CleanedIncident): ResolutionScore {
  const allText = [
    incident.title,
    incident.cleaned_body,
    incident.cleaned_solution,
    ...incident.comments.map(c => c.body),
  ].join(' ').toLowerCase();

  let score = 0;

  // Accepted answer indicator (+3)
  const has_accepted_answer = Boolean(
    incident.accepted_solution && incident.accepted_solution.length > 50
  ) || incident.comments.some(c => c.is_accepted);
  if (has_accepted_answer) score += 3;

  // OP confirmation (+2)
  const has_op_confirmation = OP_CONFIRMATION_PHRASES.some(phrase => allText.includes(phrase));
  if (has_op_confirmation) score += 2;

  // Solved keyword (+2)
  const has_solved_keyword = SOLVED_KEYWORDS.some(kw => allText.includes(kw));
  if (has_solved_keyword) score += 2;

  // Multiple technical comments with depth (+1 each, max +3)
  const technical_comment_count = incident.comments.filter(c => {
    if (c.body.length < 80) return false;
    const bodyLower = c.body.toLowerCase();
    return TECHNICAL_DEPTH_KEYWORDS.some(kw => bodyLower.includes(kw));
  }).length;
  score += Math.min(technical_comment_count, 3);

  // Device model detected (+1)
  const device_model_detected = Boolean(incident.device_model && incident.device_model.trim() !== '');
  if (device_model_detected) score += 1;

  // High comment engagement (+1)
  if (incident.comments.length >= 5) score += 1;

  // Body length quality (+1 if detailed)
  if (incident.cleaned_body.length >= 500) score += 1;

  // Negative: unresolved indicators (−2)
  const isUnresolved = UNRESOLVED_INDICATORS.some(kw => allText.includes(kw));
  if (isUnresolved) score -= 2;

  // Negative: no comments at all (−1)
  if (incident.comments.length === 0) score -= 1;

  // Floor at 0
  score = Math.max(score, 0);

  // Quality tier assignment
  let quality: LabelQuality;
  if (score >= 6 && has_accepted_answer && has_op_confirmation) {
    quality = 'gold';
  } else if (score >= 3) {
    quality = 'silver';
  } else {
    quality = 'bronze';
  }

  return {
    score,
    quality,
    has_accepted_answer,
    has_op_confirmation,
    has_solved_keyword,
    technical_comment_count,
    device_model_detected,
  };
}

// ────────────────────────────────────────────────────────────
// Pipeline stage
// ────────────────────────────────────────────────────────────

export async function runResolutionFilter(): Promise<void> {
  logger.info('=== Starting Resolution Filter ===');

  const inputCount = countLines(config.dedupFile);
  logger.info(`Input: ${inputCount} deduplicated incidents`);

  const incidents = await readAllJsonl<CleanedIncident & { resolution?: ResolutionScore }>(config.dedupFile);

  const stats = { gold: 0, silver: 0, bronze: 0, discarded: 0 };
  const kept: Array<CleanedIncident & { resolution: ResolutionScore }> = [];

  for (const incident of incidents) {
    const resolution = scoreResolution(incident);

    if (resolution.score < config.resolutionScoreThreshold) {
      stats.discarded++;
      continue;
    }

    stats[resolution.quality]++;
    kept.push({ ...incident, resolution });
  }

  // Write annotated incidents back to the dedup file (adds resolution metadata)
  writeJsonl(config.dedupFile, kept);

  logger.success('Resolution filter complete:');
  logger.info(`  Gold:      ${stats.gold}`);
  logger.info(`  Silver:    ${stats.silver}`);
  logger.info(`  Bronze:    ${stats.bronze}`);
  logger.info(`  Discarded: ${stats.discarded} (score < ${config.resolutionScoreThreshold})`);
  logger.info(`  Kept:      ${kept.length}`);
}

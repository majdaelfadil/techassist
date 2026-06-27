import axios, { AxiosError } from 'axios';
import fs from 'fs';
import {
  CleanedIncident, DeviceType, Pass1Result, GrokPass2Result,
  ConfidentValue, LabelQuality, ResolutionScore,
} from '../types';
import { logger } from '../utils/logger';
import { sleep } from '../utils/rate-limiter';
import { config } from '../config';
import { scoreResolution } from './resolution-filter';
import { applyRuleEngine } from './rule-engine';

// ────────────────────────────────────────────────────────────
// Repair parts knowledge base (loaded once)
// ────────────────────────────────────────────────────────────

let repairPartsMap: Record<string, string[]> | null = null;

function loadRepairPartsMap(): Record<string, string[]> {
  if (repairPartsMap) return repairPartsMap;
  try {
    const raw = fs.readFileSync(config.repairPartsMapFile, 'utf-8');
    repairPartsMap = JSON.parse(raw) as Record<string, string[]>;
    delete (repairPartsMap as Record<string, unknown>)['_comment'];
    return repairPartsMap;
  } catch {
    logger.warn('repair-parts-map.json not found — Grok will determine parts without lookup.');
    repairPartsMap = {};
    return repairPartsMap;
  }
}

function lookupParts(title: string, body: string, deviceType: DeviceType): string[] | null {
  const map = loadRepairPartsMap();
  const combined = `${title} ${body}`.toLowerCase();

  let bestKey: string | null = null;
  let bestScore = 0;

  for (const key of Object.keys(map)) {
    const keyWords = key.toLowerCase().split(/\s+/);
    const score = keyWords.filter(w => combined.includes(w)).length;
    const ratio = score / keyWords.length;
    if (ratio > 0.6 && score > bestScore) {
      bestScore = score;
      bestKey = key;
    }
  }

  return bestKey ? map[bestKey] : null;
}

// ────────────────────────────────────────────────────────────
// Multi-provider pool (round-robin with per-provider rate limit)
// ────────────────────────────────────────────────────────────

interface GrokMessage { role: 'system' | 'user' | 'assistant'; content: string; }

interface Provider {
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  timeoutMs: number;
  rateLimitedUntil: number;
  successCount: number;
}

let providerPool: Provider[] | null = null;
let rrIndex = 0;

function buildProviderPool(): Provider[] {
  const providers: Provider[] = [];

  if (config.grokApiKey) {
    providers.push({
      name: 'primary',
      baseUrl: config.grokBaseUrl,
      apiKey: config.grokApiKey,
      model: config.grokModel,
      timeoutMs: config.grokTimeoutMs,
      rateLimitedUntil: 0,
      successCount: 0,
    });
  }

  const raw = process.env.LABEL_PROVIDERS;
  if (raw) {
    try {
      const list = JSON.parse(raw) as Array<{
        name?: string; baseUrl: string; apiKey: string; model: string; timeoutMs?: number;
      }>;
      for (const p of list) {
        providers.push({
          name: p.name ?? `provider-${providers.length}`,
          baseUrl: p.baseUrl,
          apiKey: p.apiKey,
          model: p.model,
          timeoutMs: p.timeoutMs ?? config.grokTimeoutMs,
          rateLimitedUntil: 0,
          successCount: 0,
        });
      }
    } catch {
      logger.warn('LABEL_PROVIDERS is not valid JSON — using only primary provider.');
    }
  }

  logger.info(`Provider pool: [${providers.map(p => p.name).join(', ')}]`);
  return providers;
}

function getProvider(): Provider {
  if (!providerPool) providerPool = buildProviderPool();
  const now = Date.now();

  for (let i = 0; i < providerPool.length; i++) {
    const idx = (rrIndex + i) % providerPool.length;
    if (providerPool[idx].rateLimitedUntil <= now) {
      rrIndex = (idx + 1) % providerPool.length;
      return providerPool[idx];
    }
  }

  // All rate-limited — return the one with the soonest expiry and wait for it
  return providerPool.reduce((a, b) => a.rateLimitedUntil < b.rateLimitedUntil ? a : b);
}

async function callGrok(
  messages: GrokMessage[],
  maxTokens = 1024,
  label = 'grok call'
): Promise<string> {
  let lastError: Error = new Error(`${label} failed after ${config.labelMaxRetries} attempts`);

  for (let attempt = 0; attempt < config.labelMaxRetries; attempt++) {
    const provider = getProvider();

    // If all providers are rate-limited, wait for the next available one
    const waitMs = provider.rateLimitedUntil - Date.now();
    if (waitMs > 0) {
      logger.warn(`All providers rate-limited. Waiting ${Math.round(waitMs / 1000)}s... (${label})`);
      await sleep(waitMs + 500);
    }

    try {
      // Disable Qwen3 thinking mode to avoid slow chain-of-thought tokens
      const isQwen3 = provider.model.toLowerCase().includes('qwen3');
      const sentMessages = isQwen3
        ? messages.map((m, i) => i === messages.length - 1 && m.role === 'user'
            ? { ...m, content: `/no_think\n${m.content}` }
            : m)
        : messages;
      const response = await axios.post(
        `${provider.baseUrl}/chat/completions`,
        { model: provider.model, messages: sentMessages, temperature: 0.1, max_tokens: maxTokens },
        {
          headers: { Authorization: `Bearer ${provider.apiKey}`, 'Content-Type': 'application/json' },
          timeout: provider.timeoutMs,
        }
      );

      const raw: string = response.data?.choices?.[0]?.message?.content ?? '';
      const content = raw.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
      provider.successCount++;
      if (provider.successCount % 10 === 0) {
        logger.info(`[${provider.name}] labeled ${provider.successCount} so far`);
      }
      return content;
    } catch (err) {
      const axErr = err as AxiosError;
      const status = axErr.response?.status;
      lastError = err instanceof Error ? err : new Error(String(err));

      if (status === 429) {
        const retryAfter = axErr.response?.headers?.['retry-after'];
        const lockMs = retryAfter ? parseInt(retryAfter, 10) * 1000 + 1000 : 60000;
        provider.rateLimitedUntil = Date.now() + lockMs;
        logger.warn(`[${provider.name}] Rate limited. Locked for ${Math.round(lockMs / 1000)}s. Switching provider. (${label})`);
        continue;
      }

      if (status === 401 || status === 403) {
        const body = JSON.stringify(axErr.response?.data ?? {});
        logger.warn(`[${provider.name}] Auth error (${status}) — disabling provider. ${body}`);
        provider.rateLimitedUntil = Date.now() + 86400000; // disable for 24h
        continue;
      }

      const delay = 2000 * Math.pow(2, attempt);
      logger.debug(`[${provider.name}] ${label} attempt ${attempt + 1} failed: ${(err as Error).message}. Retry in ${delay}ms`);
      await sleep(delay);
    }
  }

  throw lastError;
}

// ────────────────────────────────────────────────────────────
// JSON extraction with malformed JSON recovery
// ────────────────────────────────────────────────────────────

function extractJson<T>(text: string): T | null {
  // Strip markdown code fences if present
  const stripped = text.replace(/```(?:json)?\s*\n?([\s\S]*?)```/g, '$1').trim();

  // Try direct parse
  try {
    return JSON.parse(stripped) as T;
  } catch {
    // Fallback: extract first {...} block
    const match = stripped.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]) as T;
    } catch {
      // Last resort: attempt to fix common Grok JSON issues
      try {
        const fixed = match[0]
          .replace(/,\s*}/g, '}')        // trailing commas in objects
          .replace(/,\s*]/g, ']')        // trailing commas in arrays
          .replace(/'/g, '"')            // single quotes
          .replace(/\n/g, ' ');
        return JSON.parse(fixed) as T;
      } catch {
        return null;
      }
    }
  }
}

// ────────────────────────────────────────────────────────────
// Shared helper
// ────────────────────────────────────────────────────────────

function parseConfidentArray(val: unknown): ConfidentValue[] {
  if (!Array.isArray(val)) return [];
  const result: ConfidentValue[] = [];
  for (const item of val) {
    if (typeof item === 'string') {
      result.push({ value: item, confidence: 0.70 });
    } else if (item && typeof item === 'object') {
      const v = (item as Record<string, unknown>).value;
      const c = (item as Record<string, unknown>).confidence;
      if (typeof v === 'string' && v.trim()) {
        result.push({
          value: v.trim(),
          confidence: typeof c === 'number' ? Math.min(Math.max(c, 0), 1) : 0.70,
        });
      }
    }
  }
  return result;
}

// ────────────────────────────────────────────────────────────
// Single-pass: extract everything in one API call
// ────────────────────────────────────────────────────────────

const SINGLE_PASS_SYSTEM = `You are an IT incident analysis system. Return only valid JSON. No markdown, no explanation.`;

const SINGLE_PASS_PROMPT = `Analyze this IT support incident and extract all required information.

TITLE: {TITLE}
DESCRIPTION: {BODY}
SOLUTION: {SOLUTION}

Return exactly this JSON:
{
  "problem_summary": "<1-2 sentences describing the exact technical problem>",
  "device_type": "<Desktop|Laptop|Printer|Router|Switch|Firewall|Camera|NVR|DVR|Access Point|Server|UPS|Unknown>",
  "brand": "<brand name or empty string>",
  "model": "<model name or empty string>",
  "probable_causes": [{"value": "<specific technical cause>", "confidence": 0.0}],
  "recommended_actions": [{"value": "<specific actionable step>", "confidence": 0.0}],
  "required_parts": [{"value": "<exact part name>", "confidence": 0.0}],
  "prevention_advice": [{"value": "<specific preventive action>", "confidence": 0.0}]
}

Rules: probable_causes 2-3 items, recommended_actions 2-3 items, required_parts 0-2 (use [] for software/config issues), prevention_advice 2-3 items. confidence: 0.9+ clear evidence, 0.6-0.89 likely, below 0.6 speculative.`;

interface SinglePassResult {
  problem_summary: string;
  device_type: string;
  brand: string;
  model: string;
  probable_causes: ConfidentValue[];
  recommended_actions: ConfidentValue[];
  required_parts: ConfidentValue[];
  prevention_advice: ConfidentValue[];
}

async function runSinglePass(incident: CleanedIncident): Promise<SinglePassResult | null> {
  const solution = (incident.cleaned_solution || incident.accepted_solution || 'No solution documented').slice(0, 600);

  const prompt = SINGLE_PASS_PROMPT
    .replace('{TITLE}', incident.title.slice(0, 200))
    .replace('{BODY}', incident.cleaned_body.slice(0, 1200))
    .replace('{SOLUTION}', solution);

  const text = await callGrok(
    [
      { role: 'system', content: SINGLE_PASS_SYSTEM },
      { role: 'user', content: prompt },
    ],
    700,
    `Label:${incident.id}`
  );

  const raw = extractJson<Record<string, unknown>>(text);
  if (!raw || !raw.problem_summary || !raw.device_type) return null;

  const validDevices = new Set([
    'Desktop', 'Laptop', 'Printer', 'Router', 'Switch', 'Firewall',
    'Camera', 'NVR', 'DVR', 'Access Point', 'Server', 'UPS', 'Unknown',
  ]);
  const deviceType = typeof raw.device_type === 'string' ? raw.device_type : 'Unknown';

  return {
    problem_summary: String(raw.problem_summary),
    device_type: validDevices.has(deviceType) ? deviceType : 'Unknown',
    brand: typeof raw.brand === 'string' ? raw.brand : '',
    model: typeof raw.model === 'string' ? raw.model : '',
    probable_causes: parseConfidentArray(raw.probable_causes),
    recommended_actions: parseConfidentArray(raw.recommended_actions),
    required_parts: parseConfidentArray(raw.required_parts),
    prevention_advice: parseConfidentArray(raw.prevention_advice),
  };
}

// ────────────────────────────────────────────────────────────
// Confidence filtering
// ────────────────────────────────────────────────────────────

function filterByConfidence(items: ConfidentValue[], threshold: number): string[] {
  return items
    .filter(item => item.confidence >= threshold)
    .map(item => item.value);
}

function avgConfidence(items: ConfidentValue[]): number {
  if (items.length === 0) return 0;
  return items.reduce((sum, i) => sum + i.confidence, 0) / items.length;
}

function computeOverallConfidence(pass2: GrokPass2Result): number {
  const arrays = [
    pass2.probable_causes,
    pass2.recommended_actions,
    pass2.prevention_advice,
  ].filter(a => a.length > 0);
  if (arrays.length === 0) return 0;
  const avg = arrays.reduce((sum, a) => sum + avgConfidence(a), 0) / arrays.length;
  return Math.round(avg * 100) / 100;
}

// ────────────────────────────────────────────────────────────
// Checkpoint support
// ────────────────────────────────────────────────────────────

interface LabelingCheckpoint {
  labeled_ids: string[];
  last_updated: string;
}

function loadCheckpoint(filePath: string): Set<string> {
  try {
    if (!fs.existsSync(filePath)) return new Set();
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as LabelingCheckpoint;
    return new Set(data.labeled_ids);
  } catch {
    return new Set();
  }
}

function saveCheckpoint(filePath: string, ids: Set<string>): void {
  const data: LabelingCheckpoint = {
    labeled_ids: Array.from(ids),
    last_updated: new Date().toISOString(),
  };
  // Write without BOM so JSON.parse always succeeds on next load
  fs.writeFileSync(filePath, JSON.stringify(data), { encoding: 'utf8', flag: 'w' });
}

// ────────────────────────────────────────────────────────────
// Main labeling function for a single incident
// ────────────────────────────────────────────────────────────

export interface GrokLabelResult {
  problem_description: string;
  device_type: DeviceType;
  device_brand: string;
  device_model: string;
  probable_causes: string[];
  recommended_actions: string[];
  required_parts: string[];
  prevention_advice: string[];
  label_quality: LabelQuality;
  confidence_score: number;
}

export async function labelOneIncident(
  incident: CleanedIncident & { resolution?: ResolutionScore }
): Promise<GrokLabelResult | null> {
  const resolution = incident.resolution ?? scoreResolution(incident);

  let result: SinglePassResult | null = null;
  try {
    result = await runSinglePass(incident);
  } catch (err) {
    logger.warn(`Labeling failed for ${incident.id}: ${(err as Error).message}`);
    return null;
  }

  if (!result) {
    logger.debug(`Single pass returned null for ${incident.id}`);
    return null;
  }

  const knownParts = lookupParts(incident.title, incident.cleaned_body, result.device_type as DeviceType);

  const threshold = config.confidenceThreshold;
  const causes = filterByConfidence(result.probable_causes, threshold);
  const actions = filterByConfidence(result.recommended_actions, threshold);
  const parts = knownParts
    ? knownParts.map(p => p)
    : filterByConfidence(result.required_parts, threshold);
  const prevention = filterByConfidence(result.prevention_advice, threshold);

  if (causes.length === 0 || actions.length === 0) return null;

  const confidence_score = computeOverallConfidence({
    probable_causes: result.probable_causes,
    recommended_actions: result.recommended_actions,
    required_parts: result.required_parts,
    prevention_advice: result.prevention_advice,
  });

  return {
    problem_description: result.problem_summary,
    device_type: result.device_type as DeviceType,
    device_brand: result.brand || incident.device_brand || 'Unknown',
    device_model: result.model || incident.device_model || '',
    probable_causes: causes,
    recommended_actions: actions,
    required_parts: parts,
    prevention_advice: prevention,
    label_quality: resolution.quality,
    confidence_score,
  };
}

export async function testGrokConnection(): Promise<void> {
  const { logger: _logger } = await import('../utils/logger');
  _logger.info(`Testing Grok API...`);
  _logger.info(`  Base URL: ${config.grokBaseUrl}`);
  _logger.info(`  Model:    ${config.grokModel}`);
  _logger.info(`  Key:      ${config.grokApiKey ? config.grokApiKey.slice(0, 10) + '...' : '(not set)'}`);

  try {
    const result = await callGrok(
      [
        { role: 'user', content: 'Reply with the single word: OK' },
      ],
      16,
      'connection test'
    );
    _logger.info(`  Response: ${result.trim()}`);
    _logger.info('Grok API connection: OK');
  } catch (err) {
    _logger.info(`Grok API connection: FAILED — ${(err as Error).message}`);
  }
}

export {
  loadCheckpoint,
  saveCheckpoint,
  loadRepairPartsMap,
};

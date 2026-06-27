import axios, { AxiosError } from 'axios';
import fs from 'fs';
import path from 'path';
import pLimit from 'p-limit';
import { LabeledIncident } from '../types';
import { logger } from '../utils/logger';
import { config } from '../config';
import { sleep } from '../utils/rate-limiter';
import { readAllJsonl } from '../utils/storage';

// ────────────────────────────────────────────────────────────
// Files
// ────────────────────────────────────────────────────────────
const AUGMENTED_FILE = path.resolve(config.processedDataDir, 'augmented_incidents.jsonl');
const CHECKPOINT_FILE = path.resolve(config.processedDataDir, 'augmentation_checkpoint.json');

// ────────────────────────────────────────────────────────────
// Provider pool (mirrors grok-labeler.ts)
// ────────────────────────────────────────────────────────────
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

  const next = () => {
    const p = providerPool![rrIndex % providerPool!.length];
    rrIndex++;
    return p;
  };

  let p = next();
  for (let i = 0; i < providerPool.length; i++) {
    if (p.rateLimitedUntil <= Date.now()) return p;
    p = next();
  }
  return p; // return least-recently-limited
}

// ────────────────────────────────────────────────────────────
// Checkpoint
// ────────────────────────────────────────────────────────────
function loadCheckpoint(): Set<string> {
  try {
    const raw = fs.readFileSync(CHECKPOINT_FILE, 'utf-8');
    const data = JSON.parse(raw) as { augmented_ids: string[] };
    return new Set(data.augmented_ids);
  } catch {
    return new Set();
  }
}

function saveCheckpoint(ids: Set<string>): void {
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify({ augmented_ids: [...ids] }, null, 2));
}

// ────────────────────────────────────────────────────────────
// Variant generation
// ────────────────────────────────────────────────────────────
function buildVariantPrompt(inc: LabeledIncident): string {
  return `You are a data augmentation assistant for an IT helpdesk AI training dataset.

Create ONE realistic variant of this IT incident by rephrasing the text. Keep ALL structured labels IDENTICAL.

ORIGINAL:
Problem: ${inc.problem_description}
Solution: ${inc.raw_solution}
Causes: ${inc.probable_causes.slice(0, 3).join('; ')}
Actions: ${inc.recommended_actions.slice(0, 3).join('; ')}
Prevention: ${inc.prevention_advice.slice(0, 2).join('; ')}

Rules:
- Rephrase from a different user perspective or writing style
- Same technical issue and fix, different wording
- Keep arrays same length, just rephrase each item
- Do NOT change device_type, service_type, urgency, technician_profile

Return ONLY valid JSON, no markdown:
{"problem_description":"...","raw_solution":"...","probable_causes":["..."],"recommended_actions":["..."],"prevention_advice":["..."]}`;
}

async function generateVariant(incident: LabeledIncident): Promise<LabeledIncident | null> {
  const label = `Aug:${incident.id.slice(0, 8)}`;
  const maxRetries = config.labelMaxRetries;
  const maxTokens = 600;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const provider = getProvider();

    const waitMs = provider.rateLimitedUntil - Date.now();
    if (waitMs > 0) {
      logger.warn(`All providers rate-limited. Waiting ${Math.round(waitMs / 1000)}s... (${label})`);
      await sleep(waitMs + 500);
    }

    try {
      const messages = [
        { role: 'user' as const, content: buildVariantPrompt(incident) },
      ];

      const response = await axios.post(
        `${provider.baseUrl}/chat/completions`,
        { model: provider.model, messages, temperature: 0.7, max_tokens: maxTokens },
        {
          headers: { Authorization: `Bearer ${provider.apiKey}`, 'Content-Type': 'application/json' },
          timeout: provider.timeoutMs,
        }
      );

      const raw: string = response.data?.choices?.[0]?.message?.content ?? '';
      const content = raw.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

      // Extract JSON
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        logger.warn(`[${provider.name}] No JSON in variant response (${label})`);
        continue;
      }

      let parsed: {
        problem_description?: string;
        raw_solution?: string;
        probable_causes?: string[];
        recommended_actions?: string[];
        prevention_advice?: string[];
      };

      try {
        parsed = JSON.parse(jsonMatch[0]);
      } catch {
        logger.warn(`[${provider.name}] Bad JSON in variant (${label})`);
        continue;
      }

      if (!parsed.problem_description || !parsed.raw_solution) {
        logger.warn(`[${provider.name}] Missing required fields in variant (${label})`);
        continue;
      }

      provider.successCount++;

      const variant: LabeledIncident = {
        ...incident,
        id: `${incident.id}_v1`,
        source: `augmented/${incident.source}`,
        problem_description: parsed.problem_description.trim(),
        raw_solution: parsed.raw_solution.trim(),
        probable_causes: parsed.probable_causes ?? incident.probable_causes,
        recommended_actions: parsed.recommended_actions ?? incident.recommended_actions,
        prevention_advice: parsed.prevention_advice ?? incident.prevention_advice,
        labeled_at: new Date().toISOString(),
      };

      return variant;

    } catch (err) {
      const axErr = err as AxiosError;
      const status = axErr.response?.status;

      if (status === 429) {
        const retryAfter = parseInt(String(axErr.response?.headers?.['retry-after'] ?? '60'), 10);
        const lockMs = (isNaN(retryAfter) ? 60 : retryAfter) * 1000;
        logger.warn(`[${provider.name}] Rate limited. Locked for ${Math.round(lockMs / 1000)}s. (${label})`);
        provider.rateLimitedUntil = Date.now() + lockMs;
        continue;
      }

      if (status === 401 || status === 403) {
        logger.warn(`[${provider.name}] Auth error (${status}) — disabling provider.`);
        provider.rateLimitedUntil = Date.now() + 86400000;
        continue;
      }

      logger.warn(`[${provider.name}] Error (attempt ${attempt + 1}): ${axErr.message} (${label})`);
      if (attempt < maxRetries) await sleep(2000 * (attempt + 1));
    }
  }

  logger.warn(`Variant failed after ${maxRetries} attempts: ${label}`);
  return null;
}

// ────────────────────────────────────────────────────────────
// Main pipeline
// ────────────────────────────────────────────────────────────
export async function runAugmentationPipeline(): Promise<void> {
  logger.info('=== Starting Augmentation Pipeline ===');

  // Prefer cleaned labels if available
  const CLEANED_FILE = path.resolve(config.processedDataDir, 'cleaned_labeled_incidents.jsonl');
  const sourceFile = fs.existsSync(CLEANED_FILE) && fs.statSync(CLEANED_FILE).size > 0
    ? CLEANED_FILE
    : config.labeledFile;
  if (sourceFile === CLEANED_FILE) {
    logger.info('Using cleaned_labeled_incidents.jsonl as augmentation source');
  }

  // Load labeled incidents — deduplicate by ID (keep last occurrence)
  const raw = await readAllJsonl<LabeledIncident>(sourceFile);
  const byId = new Map<string, LabeledIncident>();
  for (const inc of raw) byId.set(inc.id, inc);
  const all = [...byId.values()];

  // Filter: only gold + silver (skip bronze)
  const eligible = all.filter(i => i.label_quality !== 'bronze');
  logger.info(`Eligible for augmentation: ${eligible.length} (gold+silver, bronze excluded)`);

  // Load checkpoint
  const done = loadCheckpoint();
  const todo = eligible.filter(i => !done.has(i.id));
  logger.info(`Already augmented (checkpoint): ${done.size}`);
  logger.info(`To augment: ${todo.length}`);

  if (todo.length === 0) {
    logger.info('All incidents already augmented.');
    return;
  }

  // Append mode
  const outStream = fs.createWriteStream(AUGMENTED_FILE, { flags: 'a' });

  const limit = pLimit(config.labelConcurrency);
  let processed = 0;
  let perProviderCount: Record<string, number> = {};

  const tasks = todo.map(incident =>
    limit(async () => {
      const variant = await generateVariant(incident);

      if (variant) {
        outStream.write(JSON.stringify(variant) + '\n');
        done.add(incident.id);
        processed++;

        const prov = providerPool?.find(p => p.successCount > 0)?.name ?? 'primary';
        perProviderCount[prov] = (perProviderCount[prov] || 0) + 1;

        if (processed % 10 === 0) {
          logger.info(`Augmented ${processed} so far`);
        }
        if (processed % 50 === 0) {
          saveCheckpoint(done);
        }
      }
    })
  );

  await Promise.all(tasks);

  outStream.end();
  saveCheckpoint(done);

  logger.success(`=== Augmentation complete: ${processed} variants generated ===`);
  logger.info(`Output: ${AUGMENTED_FILE}`);
}

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
const CLEANED_FILE = path.resolve(config.processedDataDir, 'cleaned_labeled_incidents.jsonl');
const CHECKPOINT_FILE = path.resolve(config.processedDataDir, 'label_cleaning_checkpoint.json');

// ────────────────────────────────────────────────────────────
// System prompt — the full audit specification
// ────────────────────────────────────────────────────────────
const AUDIT_SYSTEM_PROMPT = `You are a Senior IT Operations Engineer, Senior Network Engineer, Senior Systems Administrator, ITSM Data Curator, and Machine Learning Dataset Engineer.

IMPORTANT:

This dataset will be used to train a custom AI model for:

* IT incident classification
* Root cause analysis
* Technician routing
* Troubleshooting recommendation
* Intervention planning
* IT support automation

You are NOT generating documentation.

You are producing machine-learning training data.

Every incorrect label damages model quality.

Every hallucinated cause damages model quality.

Every hallucinated replacement part damages model quality.

Every fabricated technician assignment damages model quality.

Your objective is to maximize training quality.

=================================================
TASK
====

You will receive one incident record.

Your job is to:

1. Audit the record.
2. Detect bad labels.
3. Detect hallucinations.
4. Detect fabricated parts.
5. Detect impossible recommendations.
6. Correct the record.
7. Score quality.

DO NOT generate variants.

DO NOT augment.

DO NOT create synthetic examples.

ONLY CLEAN THE RECORD.

=================================================
ALLOWED DEVICE TYPES
====================

Desktop
Laptop
Server
Printer
Router
Switch
Firewall
Access Point
UPS
Camera
NVR
DVR

If uncertain:

use:

Unknown

=================================================
ALLOWED SERVICE TYPES
=====================

Installation
Configuration
Maintenance
Depannage
Reparation

Rules:

Installation
= deployment

Configuration
= settings/config

Maintenance
= preventive maintenance

Depannage
= troubleshooting

Reparation
= confirmed hardware repair

=================================================
ALLOWED URGENCY
===============

Faible
Normal
Haute
Critique

=================================================
ALLOWED TECHNICIAN PROFILES
===========================

Hardware Technician
Network Technician
Server Technician
Printer Technician
CCTV Technician
Helpdesk Technician

If uncertain:

Helpdesk Technician

=================================================
ROOT CAUSE RULES
================

Maximum 4 causes.

Do not invent causes.

Do not pretend certainty.

If evidence is weak:

use broader causes.

Bad:

* Motherboard failure
* PSU failure

when there is no evidence.

Good:

* Possible hardware failure
* Driver issue
* Configuration issue

=================================================
RECOMMENDED ACTIONS RULES
=========================

Actions must follow troubleshooting logic.

Good sequence:

1. Verify symptoms
2. Review logs
3. Reproduce issue
4. Test components
5. Repair or replace only if confirmed

Never jump directly to replacement.

=================================================
CRITICAL RULE:
REQUIRED PARTS
==============

This field is heavily corrupted.

Assume it is wrong unless proven otherwise.

Default:

required_parts = []

Only include parts when:

* replacement is clearly required
* replacement is technically justified
* replacement is supported by symptoms

Examples:

Driver issue:
[]

Configuration issue:
[]

Network issue:
[]

Firmware issue:
[]

Authentication issue:
[]

Only hardware failures should usually contain parts.

=================================================
HALLUCINATION DETECTION
=======================

Remove:

* IR LED Board
* IR Filter
* RAM Slot Cleaner
* Generic bundled parts
* Random hardware components
* Components unrelated to the device

unless explicitly justified.

=================================================
QUALITY SCORING
===============

gold

Requirements:

* technically correct
* realistic causes
* realistic actions
* realistic urgency
* realistic technician

silver

Mostly correct but uncertain.

bronze

Weak evidence or speculative.

=================================================
CONFIDENCE
==========

0.00-1.00

Reflect actual confidence.

Do not inflate.

=================================================
OUTPUT FORMAT
=============

Return ONLY JSON.

{"cleaned_record":{...},"quality_score":0.00,"changes_made":[...]}

No markdown.
No explanations.
No additional text.
No variants.
No comments.
No code fences.

The goal is dataset repair, not dataset expansion.`;

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
  return p;
}

// ────────────────────────────────────────────────────────────
// Checkpoint
// ────────────────────────────────────────────────────────────
function loadCheckpoint(): Set<string> {
  try {
    const raw = fs.readFileSync(CHECKPOINT_FILE, 'utf-8');
    const data = JSON.parse(raw) as { cleaned_ids: string[] };
    return new Set(data.cleaned_ids);
  } catch {
    return new Set();
  }
}

function saveCheckpoint(ids: Set<string>): void {
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify({ cleaned_ids: [...ids] }, null, 2));
}

// ────────────────────────────────────────────────────────────
// Remap legacy technician profiles
// ────────────────────────────────────────────────────────────
const VALID_TECHNICIANS = new Set([
  'Hardware Technician',
  'Network Technician',
  'Server Technician',
  'Printer Technician',
  'CCTV Technician',
  'Helpdesk Technician',
]);

function remapTechnician(profile: string): string {
  if (VALID_TECHNICIANS.has(profile)) return profile;
  if (profile === 'General Support Technician') return 'Helpdesk Technician';
  return 'Helpdesk Technician';
}

// ────────────────────────────────────────────────────────────
// Audit & clean a single incident
// ────────────────────────────────────────────────────────────
async function auditIncident(
  incident: LabeledIncident
): Promise<{ cleaned: LabeledIncident; changes: string[] } | null> {
  const label = `Clean:${incident.id.slice(0, 8)}`;
  const maxRetries = config.labelMaxRetries;

  // Compact incident for the prompt — exclude noise fields
  const incidentForPrompt = {
    id: incident.id,
    problem_description: incident.problem_description,
    device_type: incident.device_type,
    device_brand: incident.device_brand,
    device_model: incident.device_model,
    service_type: incident.service_type,
    urgency: incident.urgency,
    technician_profile: incident.technician_profile,
    probable_causes: incident.probable_causes,
    recommended_actions: incident.recommended_actions,
    required_parts: incident.required_parts,
    prevention_advice: incident.prevention_advice,
    raw_solution: incident.raw_solution,
  };

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const provider = getProvider();

    const waitMs = provider.rateLimitedUntil - Date.now();
    if (waitMs > 0) {
      logger.warn(`All providers rate-limited. Waiting ${Math.round(waitMs / 1000)}s... (${label})`);
      await sleep(waitMs + 500);
    }

    try {
      const messages = [
        { role: 'system' as const, content: AUDIT_SYSTEM_PROMPT },
        { role: 'user' as const, content: `Clean this incident record:\n\n${JSON.stringify(incidentForPrompt)}` },
      ];

      const response = await axios.post(
        `${provider.baseUrl}/chat/completions`,
        { model: provider.model, messages, temperature: 0.1, max_tokens: 900 },
        {
          headers: { Authorization: `Bearer ${provider.apiKey}`, 'Content-Type': 'application/json' },
          timeout: provider.timeoutMs,
        }
      );

      const raw: string = response.data?.choices?.[0]?.message?.content ?? '';
      const content = raw.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        logger.warn(`[${provider.name}] No JSON in audit response (${label})`);
        continue;
      }

      let parsed: {
        cleaned_record?: Partial<LabeledIncident>;
        quality_score?: number;
        changes_made?: string[];
      };

      try {
        parsed = JSON.parse(jsonMatch[0]);
      } catch {
        logger.warn(`[${provider.name}] Bad JSON in audit response (${label})`);
        continue;
      }

      if (!parsed.cleaned_record) {
        logger.warn(`[${provider.name}] Missing cleaned_record (${label})`);
        continue;
      }

      const cr = parsed.cleaned_record;
      const score = typeof parsed.quality_score === 'number'
        ? Math.min(1, Math.max(0, parsed.quality_score))
        : incident.confidence_score;

      const qualityTier = score >= 0.85 ? 'gold' : score >= 0.65 ? 'silver' : 'bronze';

      // Remap legacy technician
      const rawTech = String(cr.technician_profile ?? incident.technician_profile);
      const cleanedTech = remapTechnician(rawTech);

      const cleaned: LabeledIncident = {
        // Preserve immutable fields
        id: incident.id,
        source: incident.source,
        source_url: incident.source_url,
        created_at: incident.created_at,
        labeled_at: new Date().toISOString(),

        // Apply cleaned fields (fall back to original if missing)
        problem_description: String(cr.problem_description ?? incident.problem_description).trim(),
        device_type: (cr.device_type ?? incident.device_type) as LabeledIncident['device_type'],
        device_brand: String(cr.device_brand ?? incident.device_brand),
        device_model: String(cr.device_model ?? incident.device_model),
        service_type: (cr.service_type ?? incident.service_type) as LabeledIncident['service_type'],
        urgency: (cr.urgency ?? incident.urgency) as LabeledIncident['urgency'],
        technician_profile: cleanedTech as LabeledIncident['technician_profile'],
        probable_causes: Array.isArray(cr.probable_causes) ? cr.probable_causes.slice(0, 4) : incident.probable_causes,
        recommended_actions: Array.isArray(cr.recommended_actions) ? cr.recommended_actions : incident.recommended_actions,
        required_parts: Array.isArray(cr.required_parts) ? cr.required_parts : [],
        prevention_advice: Array.isArray(cr.prevention_advice) ? cr.prevention_advice : incident.prevention_advice,
        raw_solution: String(cr.raw_solution ?? incident.raw_solution).trim(),
        label_quality: qualityTier as LabeledIncident['label_quality'],
        confidence_score: score,
      };

      provider.successCount++;

      const changes = parsed.changes_made ?? [];
      return { cleaned, changes };

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

  logger.warn(`Audit failed after ${maxRetries} attempts: ${label}`);
  return null;
}

// ────────────────────────────────────────────────────────────
// Main pipeline
// ────────────────────────────────────────────────────────────
export async function runLabelCleaningPipeline(): Promise<void> {
  logger.info('=== Starting Label Cleaning Pipeline ===');

  // Load & deduplicate
  const raw = await readAllJsonl<LabeledIncident>(config.labeledFile);
  const byId = new Map<string, LabeledIncident>();
  for (const inc of raw) byId.set(inc.id, inc);
  const all = [...byId.values()];
  logger.info(`Loaded ${all.length} unique labeled incidents`);

  // Checkpoint
  const done = loadCheckpoint();
  const todo = all.filter(i => !done.has(i.id));
  logger.info(`Already cleaned (checkpoint): ${done.size}`);
  logger.info(`To clean: ${todo.length}`);

  if (todo.length === 0) {
    logger.info('All incidents already cleaned.');
    return;
  }

  const outStream = fs.createWriteStream(CLEANED_FILE, { flags: 'a' });
  const limit = pLimit(config.labelConcurrency);
  let processed = 0;
  let changeCount = 0;

  const tasks = todo.map(incident =>
    limit(async () => {
      const result = await auditIncident(incident);

      if (result) {
        outStream.write(JSON.stringify(result.cleaned) + '\n');
        done.add(incident.id);
        processed++;
        changeCount += result.changes.length;

        if (processed % 10 === 0) {
          logger.info(`Cleaned ${processed} so far (${changeCount} total corrections)`);
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

  logger.success(`=== Label cleaning complete ===`);
  logger.info(`Cleaned: ${processed} incidents | Corrections applied: ${changeCount}`);
  logger.info(`Output: ${CLEANED_FILE}`);
}

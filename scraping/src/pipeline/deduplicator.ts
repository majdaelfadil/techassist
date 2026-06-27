import { CleanedIncident } from '../types';
import { logger } from '../utils/logger';
import { readAllJsonl, writeJsonl, countLines } from '../utils/storage';
import { config } from '../config';

type EmbedFn = (texts: string[], opts: object) => Promise<{ data: Float32Array }>;
let embedder: EmbedFn | null = null;

async function getEmbedder(): Promise<EmbedFn> {
  if (embedder) return embedder;

  const { pipeline, env } = require('@xenova/transformers');

  // Try CUDA first (requires onnxruntime-node with GPU build).
  // Falls back to CPU automatically when CUDA is unavailable.
  if (config.useGpu) {
    try {
      env.backends.onnx.executionProviders = ['cuda', 'cpu'];
      logger.info('GPU mode enabled — trying CUDA execution provider');
    } catch {
      logger.info('CUDA provider unavailable — falling back to CPU');
    }
  }

  logger.info(`Loading multilingual-e5-base (batch=${config.embedBatchSize}, first run downloads ~300 MB)...`);
  const pipe = await pipeline('feature-extraction', 'Xenova/multilingual-e5-base', {
    quantized: true,
  });

  embedder = async (texts: string[], opts: object) => pipe(texts, opts);
  logger.success('Model loaded.');
  return embedder;
}

function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

async function batchEmbed(
  texts: string[],
  embed: EmbedFn,
  batchSize: number
): Promise<Float32Array[]> {
  const results: Float32Array[] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const prefixed = batch.map(t => `query: ${t.slice(0, 512)}`);

    const output = await embed(prefixed, { pooling: 'mean', normalize: true });
    const { data } = output as { data: Float32Array };

    const dims = data.length / batch.length;
    for (let j = 0; j < batch.length; j++) {
      results.push(data.slice(j * dims, (j + 1) * dims) as Float32Array);
    }

    logger.progress(Math.min(i + batchSize, texts.length), texts.length, 'Embedding');
  }

  return results;
}

function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

function buildDeduplicationText(incident: CleanedIncident): string {
  return `${incident.title} ${incident.cleaned_body.slice(0, 300)}`;
}

export async function runDeduplication(): Promise<void> {
  logger.info('=== Starting Deduplication ===');

  const inputCount = countLines(config.cleanedFile);
  logger.info(`Input: ${inputCount} cleaned incidents`);

  if (inputCount === 0) {
    logger.warn('No incidents to deduplicate.');
    return;
  }

  const incidents = await readAllJsonl<CleanedIncident>(config.cleanedFile);
  logger.info(`Loaded ${incidents.length} incidents`);

  // Sort by quality score descending to keep the best on conflict
  incidents.sort((a, b) => b.quality_score - a.quality_score);

  // ── Pass 1: exact URL dedup (O(n)) ─────────────────────────────────────
  const seenUrls = new Set<string>();
  const afterUrlDedup = incidents.filter(inc => {
    if (!inc.url || seenUrls.has(inc.url)) return false;
    seenUrls.add(inc.url);
    return true;
  });
  logger.info(`URL dedup removed: ${incidents.length - afterUrlDedup.length}`);

  // ── Pass 2: exact title dedup (O(n)) ──────────────────────────────────
  const titleHashes = new Set<string>();
  const afterTitleDedup = afterUrlDedup.filter(inc => {
    const h = normalizeTitle(inc.title);
    if (!h || titleHashes.has(h)) return false;
    titleHashes.add(h);
    return true;
  });
  logger.info(`Title dedup removed: ${afterUrlDedup.length - afterTitleDedup.length}`);
  logger.info(`After fast dedup: ${afterTitleDedup.length} incidents remain`);

  if (afterTitleDedup.length === 0) {
    writeJsonl(config.dedupFile, []);
    return;
  }

  // ── Pass 3: semantic dedup via embeddings (O(n²) on survivors) ─────────
  const texts = afterTitleDedup.map(buildDeduplicationText);
  const embed = await getEmbedder();

  logger.info('Generating embeddings...');
  const embeddings = await batchEmbed(texts, embed, config.embedBatchSize);
  logger.success(`Generated ${embeddings.length} embeddings`);

  const threshold = config.dedupSimilarityThreshold;
  const kept: boolean[] = new Array(afterTitleDedup.length).fill(true);
  const keptEmbeddings: Float32Array[] = [];
  const keptIndices: number[] = [];

  logger.info(`Semantic dedup at threshold ${threshold}...`);
  let removed = 0;

  for (let i = 0; i < afterTitleDedup.length; i++) {
    if (!kept[i]) continue;

    const emb = embeddings[i];
    let isDuplicate = false;

    // Scan from most-recent kept (most likely match) for early exit
    for (let j = keptIndices.length - 1; j >= 0; j--) {
      if (cosineSimilarity(emb, keptEmbeddings[j]) >= threshold) {
        isDuplicate = true;
        break;
      }
    }

    if (isDuplicate) {
      kept[i] = false;
      removed++;
    } else {
      keptEmbeddings.push(emb);
      keptIndices.push(i);
    }

    if (i % 500 === 0) logger.progress(i, afterTitleDedup.length, 'Semantic dedup');
  }

  const deduplicated = afterTitleDedup.filter((_, i) => kept[i]);

  writeJsonl(config.dedupFile, deduplicated);

  logger.success('Deduplication complete:');
  logger.info(`  Input:              ${incidents.length}`);
  logger.info(`  After URL dedup:    ${afterUrlDedup.length}`);
  logger.info(`  After title dedup:  ${afterTitleDedup.length}`);
  logger.info(`  After semantic:     ${deduplicated.length}`);
  logger.info(`  Total removed:      ${incidents.length - deduplicated.length}`);
  logger.info(`  File:               ${config.dedupFile}`);
}

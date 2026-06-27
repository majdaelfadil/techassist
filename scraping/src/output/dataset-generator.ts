import path from 'path';
import fs from 'fs';
import { createObjectCsvWriter } from 'csv-writer';
import { LabeledIncident, PipelineStats } from '../types';
import { logger } from '../utils/logger';
import { readAllJsonl, writeJsonl, countLines, ensureDir } from '../utils/storage';
import { config } from '../config';

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function splitDataset(
  incidents: LabeledIncident[]
): { train: LabeledIncident[]; validation: LabeledIncident[]; test: LabeledIncident[] } {
  // Stratified shuffle: sort gold first so splits include representation from all tiers
  const gold = shuffleArray(incidents.filter(i => i.label_quality === 'gold'));
  const silver = shuffleArray(incidents.filter(i => i.label_quality === 'silver'));
  const bronze = shuffleArray(incidents.filter(i => i.label_quality === 'bronze'));

  function splitTier(arr: LabeledIncident[]) {
    const trainEnd = Math.floor(arr.length * config.trainSplit);
    const validEnd = trainEnd + Math.floor(arr.length * config.validSplit);
    return {
      train: arr.slice(0, trainEnd),
      validation: arr.slice(trainEnd, validEnd),
      test: arr.slice(validEnd),
    };
  }

  const g = splitTier(gold);
  const s = splitTier(silver);
  const b = splitTier(bronze);

  return {
    train: shuffleArray([...g.train, ...s.train, ...b.train]),
    validation: shuffleArray([...g.validation, ...s.validation, ...b.validation]),
    test: shuffleArray([...g.test, ...s.test, ...b.test]),
  };
}

// Final training format — exact schema specified in requirements
function toTrainingFormat(incident: LabeledIncident): object {
  return {
    problem_description: incident.problem_description,
    device_type: incident.device_type,
    device_brand: incident.device_brand,
    device_model: incident.device_model,
    service_type: incident.service_type,
    urgency: incident.urgency,
    probable_causes: incident.probable_causes,
    recommended_actions: incident.recommended_actions,
    required_parts: incident.required_parts,
    technician_profile: incident.technician_profile,
    prevention_advice: incident.prevention_advice,
    label_quality: incident.label_quality,
    source: incident.source,
    source_url: incident.source_url,
    confidence_score: incident.confidence_score,
  };
}

function toFlatRecord(incident: LabeledIncident): Record<string, string> {
  return {
    id: incident.id,
    source: incident.source,
    source_url: incident.source_url,
    problem_description: incident.problem_description,
    device_type: incident.device_type,
    device_brand: incident.device_brand,
    device_model: incident.device_model,
    service_type: incident.service_type,
    urgency: incident.urgency,
    probable_causes: incident.probable_causes.join(' | '),
    recommended_actions: incident.recommended_actions.join(' | '),
    required_parts: incident.required_parts.join(' | '),
    technician_profile: incident.technician_profile,
    prevention_advice: incident.prevention_advice.join(' | '),
    label_quality: incident.label_quality,
    confidence_score: String(incident.confidence_score),
    created_at: incident.created_at,
    labeled_at: incident.labeled_at,
  };
}

async function writeCsv(filePath: string, incidents: LabeledIncident[]): Promise<void> {
  ensureDir(path.dirname(filePath));

  const writer = createObjectCsvWriter({
    path: filePath,
    header: [
      { id: 'id', title: 'id' },
      { id: 'source', title: 'source' },
      { id: 'source_url', title: 'source_url' },
      { id: 'problem_description', title: 'problem_description' },
      { id: 'device_type', title: 'device_type' },
      { id: 'device_brand', title: 'device_brand' },
      { id: 'device_model', title: 'device_model' },
      { id: 'service_type', title: 'service_type' },
      { id: 'urgency', title: 'urgency' },
      { id: 'probable_causes', title: 'probable_causes' },
      { id: 'recommended_actions', title: 'recommended_actions' },
      { id: 'required_parts', title: 'required_parts' },
      { id: 'technician_profile', title: 'technician_profile' },
      { id: 'prevention_advice', title: 'prevention_advice' },
      { id: 'label_quality', title: 'label_quality' },
      { id: 'confidence_score', title: 'confidence_score' },
      { id: 'created_at', title: 'created_at' },
      { id: 'labeled_at', title: 'labeled_at' },
    ],
  });

  await writer.writeRecords(incidents.map(toFlatRecord));
}

function printClassBalance(incidents: LabeledIncident[]): void {
  const total = incidents.length;
  const threshold_low = total * 0.05;

  const dimensions: Array<[string, keyof LabeledIncident]> = [
    ['Service Type', 'service_type'],
    ['Urgency', 'urgency'],
    ['Device Type', 'device_type'],
    ['Technician', 'technician_profile'],
    ['Quality Tier', 'label_quality'],
  ];

  for (const [label, key] of dimensions) {
    const dist: Record<string, number> = {};
    for (const inc of incidents) {
      const v = String(inc[key] ?? 'Unknown');
      dist[v] = (dist[v] || 0) + 1;
    }

    const underrep = Object.entries(dist)
      .filter(([, c]) => c < threshold_low)
      .map(([k]) => k);

    const lines = Object.entries(dist)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `    ${k.padEnd(28)} ${v} (${((v / total) * 100).toFixed(1)}%)`)
      .join('\n');

    logger.info(`${label}:\n${lines}`);
    if (underrep.length > 0) {
      logger.warn(`  Underrepresented: ${underrep.join(', ')}`);
    }
  }
}

const AUGMENTED_FILE = path.join(path.dirname(config.labeledFile), 'augmented_incidents.jsonl');
const CLEANED_FILE = path.join(path.dirname(config.labeledFile), 'cleaned_labeled_incidents.jsonl');

export async function runDatasetGeneration(): Promise<PipelineStats> {
  logger.info('=== Starting Dataset Generation ===');

  ensureDir(config.outputDataDir);

  const inputCount = countLines(config.labeledFile);
  logger.info(`Input: ${inputCount} labeled incidents`);

  if (inputCount === 0) {
    throw new Error('No labeled incidents found. Run the labeling pipeline first.');
  }

  // Prefer cleaned labels if available, otherwise fall back to raw labeled
  const sourceFile = fs.existsSync(CLEANED_FILE) && countLines(CLEANED_FILE) > 0
    ? CLEANED_FILE
    : config.labeledFile;
  if (sourceFile === CLEANED_FILE) {
    logger.info('Using cleaned_labeled_incidents.jsonl (post-audit)');
  }

  // Load labeled incidents — deduplicate by ID (keep last occurrence)
  const rawIncidents = await readAllJsonl<LabeledIncident>(sourceFile);
  const byId = new Map<string, LabeledIncident>();
  for (const inc of rawIncidents) byId.set(inc.id, inc);

  // Merge augmented variants if available
  if (fs.existsSync(AUGMENTED_FILE) && countLines(AUGMENTED_FILE) > 0) {
    const variants = await readAllJsonl<LabeledIncident>(AUGMENTED_FILE);
    for (const v of variants) byId.set(v.id, v);
    logger.info(`Merged ${variants.length} augmented variants`);
  }

  const incidents = [...byId.values()];
  logger.info(`Loaded ${incidents.length} labeled incidents`);

  // Quality breakdown
  const gold = incidents.filter(i => i.label_quality === 'gold').length;
  const silver = incidents.filter(i => i.label_quality === 'silver').length;
  const bronze = incidents.filter(i => i.label_quality === 'bronze').length;
  logger.info(`Quality: gold=${gold} silver=${silver} bronze=${bronze}`);

  // Stratified train/val/test split
  const { train, validation, test } = splitDataset(incidents);
  logger.info(`Split: ${train.length} train / ${validation.length} validation / ${test.length} test`);

  // Full dataset (all fields including metadata)
  writeJsonl(config.datasetJsonl, incidents);
  logger.success(`Written: ${config.datasetJsonl}`);

  // CSV (flat representation)
  await writeCsv(config.datasetCsv, incidents);
  logger.success(`Written: ${config.datasetCsv}`);

  // Split files (training format — exact final schema)
  writeJsonl(config.trainingDataset, train.map(toTrainingFormat));
  logger.success(`Written: ${config.trainingDataset} (${train.length} records)`);

  writeJsonl(config.validationDataset, validation.map(toTrainingFormat));
  logger.success(`Written: ${config.validationDataset} (${validation.length} records)`);

  writeJsonl(config.testDataset, test.map(toTrainingFormat));
  logger.success(`Written: ${config.testDataset} (${test.length} records)`);

  // Pipeline stats
  const stats: PipelineStats = {
    raw_count: countLines(config.rawIncidentsFile),
    after_cleaning: countLines(config.cleanedFile),
    after_dedup: countLines(config.dedupFile),
    after_labeling: incidents.length,
    train_count: train.length,
    validation_count: validation.length,
    test_count: test.length,
  };

  const statsPath = path.join(config.outputDataDir, 'pipeline_stats.json');
  fs.writeFileSync(statsPath, JSON.stringify(stats, null, 2));
  logger.success(`Written: ${statsPath}`);

  // Class balance report
  logger.info('--- Class Balance Analysis ---');
  printClassBalance(incidents);

  logger.success('=== Dataset generation complete ===');
  logger.info(`Total records: ${incidents.length}  |  Train: ${train.length}  |  Val: ${validation.length}  |  Test: ${test.length}`);

  return stats;
}

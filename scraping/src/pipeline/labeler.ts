import pLimit from 'p-limit';
import { CleanedIncident, LabeledIncident, ResolutionScore } from '../types';
import { logger } from '../utils/logger';
import { readAllJsonl, appendJsonl, countLines } from '../utils/storage';
import { config } from '../config';
import { applyRuleEngine } from './rule-engine';
import { scoreResolution } from './resolution-filter';
import { labelOneIncident, loadCheckpoint, saveCheckpoint } from './grok-labeler';

export async function runLabelingPipeline(): Promise<void> {
  logger.info('=== Starting Grok Labeling Pipeline ===');

  if (!config.grokApiKey) {
    throw new Error('GROK_API_KEY is not set. Copy .env.example to .env and configure the key.');
  }

  const inputCount = countLines(config.dedupFile);
  logger.info(`Input: ${inputCount} deduplicated incidents`);
  logger.info(`Model: ${config.grokModel}`);
  logger.info(`Confidence threshold: ${config.confidenceThreshold}`);
  logger.info(`Concurrency: ${config.labelConcurrency}`);

  const labeledIds = loadCheckpoint(config.labelingCheckpointFile);
  logger.info(`Already labeled (checkpoint): ${labeledIds.size}`);

  const incidents = await readAllJsonl<CleanedIncident & { resolution?: ResolutionScore }>(config.dedupFile);
  const toLabel = incidents.filter(inc => !labeledIds.has(inc.id));
  logger.info(`To label: ${toLabel.length}`);

  if (toLabel.length === 0) {
    logger.success('All incidents already labeled.');
    return;
  }

  let labeled = 0;
  let failed = 0;
  let skipped = 0;
  let completed = 0;

  const limit = pLimit(config.labelConcurrency);

  const tasks = toLabel.map(incident =>
    limit(async () => {
      const resolution = incident.resolution ?? scoreResolution(incident);

      if (resolution.score < config.resolutionScoreThreshold) {
        skipped++;
        labeledIds.add(incident.id);
        completed++;
        if (completed % 50 === 0) saveCheckpoint(config.labelingCheckpointFile, labeledIds);
        return;
      }

      let grokResult = null;
      try {
        grokResult = await labelOneIncident({ ...incident, resolution });
      } catch (err) {
        logger.warn(`Grok labeling failed for ${incident.id}: ${(err as Error).message}`);
      }

      if (!grokResult) {
        failed++;
        labeledIds.add(incident.id);
        completed++;
        if (completed % 50 === 0) saveCheckpoint(config.labelingCheckpointFile, labeledIds);
        return;
      }

      // Reject incidents where the AI found no real technical problem
      const noIssueSignals = [
        'no technical', 'not a technical', 'no problem described', 'no issue described',
        'not described', 'no technical issue', 'no technical problem', 'showcase',
        'sharing', 'show off', 'no incident', 'not an incident',
      ];
      const descLower = grokResult.problem_description.toLowerCase();
      if (noIssueSignals.some(s => descLower.includes(s))) {
        skipped++;
        labeledIds.add(incident.id);
        completed++;
        return;
      }

      const ruleEngineResult = applyRuleEngine(
        incident.title,
        incident.cleaned_body,
        grokResult.device_type
      );

      const labeledIncident: LabeledIncident = {
        id: incident.id,
        source: incident.source,
        source_url: incident.url,
        problem_description: grokResult.problem_description,
        device_type: grokResult.device_type,
        device_brand: grokResult.device_brand,
        device_model: grokResult.device_model,
        service_type: ruleEngineResult.service_type,
        urgency: ruleEngineResult.urgency,
        technician_profile: ruleEngineResult.technician_profile,
        probable_causes: grokResult.probable_causes,
        recommended_actions: grokResult.recommended_actions,
        required_parts: grokResult.required_parts,
        prevention_advice: grokResult.prevention_advice,
        label_quality: grokResult.label_quality,
        confidence_score: grokResult.confidence_score,
        raw_solution: incident.cleaned_solution || incident.accepted_solution,
        created_at: incident.created_at,
        labeled_at: new Date().toISOString(),
      };

      appendJsonl(config.labeledFile, labeledIncident);
      labeledIds.add(incident.id);
      labeled++;
      completed++;

      if (completed % 50 === 0) {
        saveCheckpoint(config.labelingCheckpointFile, labeledIds);
        logger.progress(completed, toLabel.length, 'Labeling');
      }
    })
  );

  await Promise.all(tasks);

  // Final checkpoint
  saveCheckpoint(config.labelingCheckpointFile, labeledIds);

  const total = countLines(config.labeledFile);
  logger.success('Labeling complete:');
  logger.info(`  Labeled this run:  ${labeled}`);
  logger.info(`  Failed:            ${failed}`);
  logger.info(`  Skipped (quality): ${skipped}`);
  logger.info(`  Total in file:     ${total}`);
  logger.info(`  Output:            ${config.labeledFile}`);
}

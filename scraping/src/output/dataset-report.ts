import fs from 'fs';
import { LabeledIncident, DatasetReport, ClassBalance, ClassBalanceReport } from '../types';
import { logger } from '../utils/logger';
import { readAllJsonl, countLines, ensureDir } from '../utils/storage';
import { config } from '../config';

// ────────────────────────────────────────────────────────────
// Distribution helpers
// ────────────────────────────────────────────────────────────

function countDistribution(incidents: LabeledIncident[], key: keyof LabeledIncident): Record<string, number> {
  const dist: Record<string, number> = {};
  for (const inc of incidents) {
    const val = String(inc[key] ?? 'Unknown');
    dist[val] = (dist[val] || 0) + 1;
  }
  return dist;
}

function topN(items: string[], n: number): Array<{ value: string; count: number }> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    const v = item.trim();
    if (v) counts[v] = (counts[v] || 0) + 1;
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([value, count]) => ({ value, count }));
}

// ────────────────────────────────────────────────────────────
// Class balance analysis
// ────────────────────────────────────────────────────────────

function analyzeClassBalance(distribution: Record<string, number>, total: number): ClassBalance {
  const entries = Object.entries(distribution);
  const counts = entries.map(([, c]) => c);
  const max = Math.max(...counts, 1);
  const min = Math.min(...counts, 1);
  const imbalance_ratio = max / min;

  const threshold_low = total * 0.05;   // < 5% = underrepresented
  const threshold_high = total * 0.50;  // > 50% = overrepresented

  const underrepresented = entries
    .filter(([, c]) => c < threshold_low)
    .map(([k]) => k);

  const overrepresented = entries
    .filter(([, c]) => c > threshold_high)
    .map(([k]) => k);

  return { distribution, underrepresented, overrepresented, imbalance_ratio };
}

// ────────────────────────────────────────────────────────────
// Main report generator
// ────────────────────────────────────────────────────────────

export async function generateDatasetReport(): Promise<DatasetReport> {
  logger.info('=== Generating Dataset Report ===');

  ensureDir(config.outputDataDir);

  const total = countLines(config.labeledFile);
  if (total === 0) {
    throw new Error('No labeled incidents found. Run the labeling pipeline first.');
  }

  const incidents = await readAllJsonl<LabeledIncident>(config.labeledFile);
  logger.info(`Loaded ${incidents.length} labeled incidents`);

  // Quality tier counts
  const gold_count = incidents.filter(i => i.label_quality === 'gold').length;
  const silver_count = incidents.filter(i => i.label_quality === 'silver').length;
  const bronze_count = incidents.filter(i => i.label_quality === 'bronze').length;

  // Distributions
  const device_distribution = countDistribution(incidents, 'device_type');
  const service_type_distribution = countDistribution(incidents, 'service_type');
  const urgency_distribution = countDistribution(incidents, 'urgency');
  const technician_distribution = countDistribution(incidents, 'technician_profile');
  const source_distribution = countDistribution(incidents, 'source');

  // Top causes and parts
  const allCauses = incidents.flatMap(i => i.probable_causes);
  const allParts = incidents.flatMap(i => i.required_parts);
  const top_causes = topN(allCauses, 20);
  const top_parts = topN(allParts, 20);

  // Average confidence
  const avg_confidence_score = incidents.length > 0
    ? Math.round((incidents.reduce((sum, i) => sum + i.confidence_score, 0) / incidents.length) * 100) / 100
    : 0;

  // Class balance analysis
  const class_balance: ClassBalanceReport = {
    service_type: analyzeClassBalance(service_type_distribution, incidents.length),
    urgency: analyzeClassBalance(urgency_distribution, incidents.length),
    device_type: analyzeClassBalance(device_distribution, incidents.length),
    technician_profile: analyzeClassBalance(technician_distribution, incidents.length),
  };

  const report: DatasetReport = {
    total_incidents: incidents.length,
    gold_count,
    silver_count,
    bronze_count,
    device_distribution,
    service_type_distribution,
    urgency_distribution,
    technician_distribution,
    source_distribution,
    top_causes,
    top_parts,
    class_balance,
    avg_confidence_score,
    generated_at: new Date().toISOString(),
  };

  fs.writeFileSync(config.datasetReportFile, JSON.stringify(report, null, 2), 'utf-8');
  logger.success(`Report written: ${config.datasetReportFile}`);

  // Print summary to console
  printReportSummary(report);

  return report;
}

function printReportSummary(report: DatasetReport): void {
  const pct = (n: number) => `${((n / report.total_incidents) * 100).toFixed(1)}%`;
  const dist = (d: Record<string, number>) =>
    Object.entries(d)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `    ${k.padEnd(25)} ${v} (${pct(v)})`)
      .join('\n');

  logger.info('');
  logger.info('════════════════════════════════════════');
  logger.info(' DATASET QUALITY REPORT');
  logger.info('════════════════════════════════════════');
  logger.info(`Total incidents:     ${report.total_incidents}`);
  logger.info(`Gold:   ${report.gold_count} (${pct(report.gold_count)})`);
  logger.info(`Silver: ${report.silver_count} (${pct(report.silver_count)})`);
  logger.info(`Bronze: ${report.bronze_count} (${pct(report.bronze_count)})`);
  logger.info(`Avg confidence:      ${report.avg_confidence_score}`);
  logger.info('');
  logger.info('Service Types:\n' + dist(report.service_type_distribution));
  logger.info('');
  logger.info('Urgency Levels:\n' + dist(report.urgency_distribution));
  logger.info('');
  logger.info('Device Types:\n' + dist(report.device_distribution));
  logger.info('');
  logger.info('Technician Profiles:\n' + dist(report.technician_distribution));
  logger.info('');

  // Class balance warnings
  const { service_type, urgency, device_type, technician_profile } = report.class_balance;
  const allUnder = [
    ...service_type.underrepresented.map(c => `service_type:${c}`),
    ...urgency.underrepresented.map(c => `urgency:${c}`),
    ...device_type.underrepresented.map(c => `device_type:${c}`),
    ...technician_profile.underrepresented.map(c => `technician_profile:${c}`),
  ];

  if (allUnder.length > 0) {
    logger.warn('Underrepresented classes (< 5% of total):');
    for (const c of allUnder) logger.warn(`  - ${c}`);
    logger.warn('Consider collecting more incidents for these classes.');
  }

  const imbalanceRatios = [
    service_type.imbalance_ratio,
    urgency.imbalance_ratio,
    device_type.imbalance_ratio,
    technician_profile.imbalance_ratio,
  ];
  const maxRatio = Math.max(...imbalanceRatios);
  if (maxRatio > 10) {
    logger.warn(`High class imbalance detected (ratio: ${maxRatio.toFixed(1)}x). Consider oversampling minority classes.`);
  }

  logger.info('');
  logger.info(`Top 10 probable causes:`);
  report.top_causes.slice(0, 10).forEach(({ value, count }) =>
    logger.info(`  ${count.toString().padStart(5)}x  ${value}`)
  );
  logger.info('');
  logger.info(`Top 10 required parts:`);
  report.top_parts.slice(0, 10).forEach(({ value, count }) =>
    logger.info(`  ${count.toString().padStart(5)}x  ${value}`)
  );
  logger.info('════════════════════════════════════════');
}

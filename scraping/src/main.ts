import path from 'path';
import fs from 'fs';
import { config } from './config';
import { logger } from './utils/logger';
import { ensureDir, countLines } from './utils/storage';
import { ScraperManager, SourceName } from './scrapers/scraper-manager';
import { runCleaningPipeline } from './pipeline/cleaner';
import { runQualityFilter } from './pipeline/quality-filter';
import { runDeduplication } from './pipeline/deduplicator';
import { runResolutionFilter } from './pipeline/resolution-filter';
import { runLabelingPipeline } from './pipeline/labeler';
import { runAugmentationPipeline } from './pipeline/augmentor';
import { runLabelCleaningPipeline } from './pipeline/label-cleaner';
import { runDatasetGeneration } from './output/dataset-generator';
import { generateDatasetReport } from './output/dataset-report';
import { testGrokConnection } from './pipeline/grok-labeler';

function ensureDirectories(): void {
  ensureDir(config.rawDataDir);
  ensureDir(config.processedDataDir);
  ensureDir(config.outputDataDir);
  ensureDir(config.knowledgeDir);
}

function printStats(): void {
  logger.info('=== Pipeline Statistics ===');
  logger.info(`Raw incidents:         ${countLines(config.rawIncidentsFile)}`);
  logger.info(`Cleaned incidents:     ${countLines(config.cleanedFile)}`);
  logger.info(`Deduplicated:          ${countLines(config.dedupFile)}`);
  logger.info(`Labeled incidents:     ${countLines(config.labeledFile)}`);
  logger.info(`Training dataset:      ${countLines(config.trainingDataset)}`);
  logger.info(`Validation dataset:    ${countLines(config.validationDataset)}`);
  logger.info(`Test dataset:          ${countLines(config.testDataset)}`);

  const statsFile = path.join(config.outputDataDir, 'pipeline_stats.json');
  if (fs.existsSync(statsFile)) {
    logger.info('--- Output files ---');
    logger.info(`  ${config.datasetJsonl}`);
    logger.info(`  ${config.datasetCsv}`);
    logger.info(`  ${config.trainingDataset}`);
    logger.info(`  ${config.validationDataset}`);
    logger.info(`  ${config.testDataset}`);
    logger.info(`  ${config.datasetReportFile}`);
  }
}

function printHelp(): void {
  console.log(`
IT Maintenance Dataset Pipeline  (Grok-powered)
================================================
Usage: ts-node src/main.ts <command> [options]

Commands:
  scrape [--source <name>]   Scrape incidents from public sources
                             Sources: reddit, serverfault, spiceworks, tomshardware, vendors, all (default)
  clean                      Clean raw incidents and apply quality filters
  deduplicate                Remove near-duplicate incidents (multilingual-e5-base embeddings)
  filter                     Score resolution quality and assign gold/silver/bronze tiers
  label                      Label incidents using Grok AI (two-pass) + rule engine
  generate                   Generate final JSONL/CSV + train/validation/test splits
  report                     Generate dataset quality and class balance report
  pipeline                   Run all stages end-to-end
  stats                      Show pipeline file counts

Examples:
  ts-node src/main.ts scrape --source reddit
  ts-node src/main.ts clean
  ts-node src/main.ts deduplicate
  ts-node src/main.ts filter
  ts-node src/main.ts label
  ts-node src/main.ts generate
  ts-node src/main.ts report
  ts-node src/main.ts pipeline
  ts-node src/main.ts stats

Output files:
  data/raw/raw_incidents.jsonl
  data/processed/cleaned_incidents.jsonl
  data/processed/deduplicated_incidents.jsonl
  data/processed/labeled_incidents.jsonl
  data/output/dataset.jsonl
  data/output/dataset.csv
  data/output/training_dataset.jsonl
  data/output/validation_dataset.jsonl
  data/output/test_dataset.jsonl
  data/output/dataset_report.json

Environment:
  Copy .env.example to .env and set GROK_API_KEY before running 'label'.
  Grok models: grok-3-mini (fast/cheap), grok-3 (high quality), grok-2
`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === 'help' || command === '--help' || command === '-h') {
    printHelp();
    return;
  }

  ensureDirectories();

  switch (command) {
    case 'scrape': {
      const sourceIndex = args.indexOf('--source');
      const source: SourceName = sourceIndex >= 0 && args[sourceIndex + 1]
        ? (args[sourceIndex + 1] as SourceName)
        : 'all';

      const validSources: SourceName[] = ['reddit', 'reddit-html', 'serverfault', 'spiceworks', 'tomshardware', 'vendors', 'superuser', 'ifixit', 'community', 'bleepingcomputer', 'anandtech', 'all'];
      if (!validSources.includes(source)) {
        logger.error(`Unknown source: ${source}. Valid: ${validSources.join(', ')}`);
        process.exit(1);
      }

      const manager = new ScraperManager();
      await manager.run(source);
      break;
    }

    case 'clean': {
      await runCleaningPipeline();
      await runQualityFilter();
      break;
    }

    case 'deduplicate': {
      await runDeduplication();
      break;
    }

    case 'filter': {
      await runResolutionFilter();
      break;
    }

    case 'label': {
      if (!config.grokApiKey) {
        logger.error('GROK_API_KEY is not set. Copy .env.example to .env and set the key.');
        process.exit(1);
      }
      await runLabelingPipeline();
      break;
    }

    case 'clean-labels': {
      if (!config.grokApiKey) {
        logger.error('GROK_API_KEY is not set.');
        process.exit(1);
      }
      await runLabelCleaningPipeline();
      break;
    }

    case 'augment': {
      if (!config.grokApiKey) {
        logger.error('GROK_API_KEY is not set.');
        process.exit(1);
      }
      await runAugmentationPipeline();
      break;
    }

    case 'generate': {
      await runDatasetGeneration();
      break;
    }

    case 'report': {
      await generateDatasetReport();
      break;
    }

    case 'pipeline': {
      logger.info('=== Running full pipeline ===');

      logger.info('\n[1/7] Scraping...');
      const manager = new ScraperManager();
      await manager.run('all');

      logger.info('\n[2/7] Cleaning...');
      await runCleaningPipeline();
      await runQualityFilter();

      logger.info('\n[3/7] Deduplication...');
      await runDeduplication();

      logger.info('\n[4/7] Resolution filter...');
      await runResolutionFilter();

      logger.info('\n[5/7] Labeling...');
      if (!config.grokApiKey) {
        logger.warn('GROK_API_KEY not set — skipping AI labeling. Set it in .env to continue.');
        logger.warn('Run: ts-node src/main.ts label  after setting GROK_API_KEY');
      } else {
        await runLabelingPipeline();

        logger.info('\n[6/7] Generating dataset...');
        await runDatasetGeneration();

        logger.info('\n[7/7] Generating report...');
        await generateDatasetReport();
      }

      printStats();
      break;
    }

    case 'stats': {
      printStats();
      break;
    }

    case 'test-grok': {
      await testGrokConnection();
      break;
    }

    default: {
      logger.error(`Unknown command: ${command}`);
      printHelp();
      process.exit(1);
    }
  }
}

main().catch((err: Error) => {
  logger.error(`Fatal error: ${err.message}`);
  if (process.env.DEBUG) {
    console.error(err.stack);
  }
  process.exit(1);
});

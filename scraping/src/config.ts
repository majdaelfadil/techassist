import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export const REDDIT_SUBREDDITS = [
  'techsupport',
  'sysadmin',
  'networking',
  'homelab',
  'Ubiquiti',
  'Cisco',
  'HomeNetworking',
  'computerrepair',
  'printers',
  'cctv',
];

export const REDDIT_LISTING_TYPES = ['top', 'hot', 'new'] as const;

export const DEVICE_BRANDS = [
  'Cisco', 'Dell', 'HP', 'Lenovo', 'Hikvision',
  'Ubiquiti', 'MikroTik', 'TP-Link', 'APC', 'Synology',
  'Netgear', 'Asus', 'Linksys', 'D-Link', 'Juniper',
  'Fortinet', 'Palo Alto', 'Aruba', 'Ruckus', 'Meraki',
  'Samsung', 'Seagate', 'Western Digital', 'QNAP', 'Buffalo',
] as const;

export const DEVICE_CATEGORIES = [
  'Desktop', 'Laptop', 'Printer', 'Router', 'Switch',
  'Firewall', 'Camera', 'NVR', 'DVR', 'Access Point',
  'Server', 'UPS',
] as const;

export const SERVICE_TYPES = [
  'Reparation', 'Installation', 'Configuration', 'Maintenance', 'Depannage',
] as const;

export const URGENCY_LEVELS = ['Faible', 'Normal', 'Haute', 'Critique'] as const;

export const TECHNICIAN_PROFILES = [
  'Hardware Technician',
  'Network Technician',
  'CCTV Technician',
  'Server Technician',
  'General Support Technician',
] as const;

export const STACK_EXCHANGE_SITES = ['serverfault'] as const;

export const STACK_EXCHANGE_TAGS = [
  'troubleshooting',
  'networking',
  'windows-server',
  'hardware',
  'router',
  'firewall',
  'printer',
  'vpn',
  'active-directory',
  'dns',
  'dhcp',
  'storage',
  'backup',
  'virtualization',
  'linux',
] as const;

export const config = {
  // Grok API (x.ai)
  grokApiKey: process.env.GROK_API_KEY || '',
  grokModel: process.env.GROK_MODEL || 'grok-3-mini',
  grokBaseUrl: process.env.GROK_BASE_URL || 'https://api.x.ai/v1',
  grokTimeoutMs: parseInt(process.env.GROK_TIMEOUT_MS || '30000'),

  // Stack Exchange / Reddit API
  stackExchangeApiKey: process.env.STACK_EXCHANGE_API_KEY || '',
  redditClientId: process.env.REDDIT_CLIENT_ID || '',
  redditClientSecret: process.env.REDDIT_CLIENT_SECRET || '',
  redditUserAgent: process.env.REDDIT_USER_AGENT || 'ITDatasetScraper/1.0',

  // Scraping
  maxIncidentsPerSource: parseInt(process.env.MAX_INCIDENTS_PER_SOURCE || '500000'),
  scraperRateLimitMs: parseInt(process.env.SCRAPER_RATE_LIMIT_MS || '1500'),
  scraperMaxRetries: parseInt(process.env.SCRAPER_MAX_RETRIES || '3'),
  scraperConcurrency: parseInt(process.env.SCRAPER_CONCURRENCY || '5'),
  headless: process.env.HEADLESS !== 'false',

  // Pipeline quality thresholds
  minBodyLength: parseInt(process.env.MIN_BODY_LENGTH || '50'),
  dedupSimilarityThreshold: parseFloat(process.env.DEDUP_SIMILARITY_THRESHOLD || '0.92'),
  confidenceThreshold: parseFloat(process.env.CONFIDENCE_THRESHOLD || '0.60'),
  resolutionScoreThreshold: parseInt(process.env.RESOLUTION_SCORE_THRESHOLD || '1'),

  // Labeling
  labelBatchSize: parseInt(process.env.LABEL_BATCH_SIZE || '5'),
  labelConcurrency: parseInt(process.env.LABEL_CONCURRENCY || '5'),
  labelMaxRetries: parseInt(process.env.LABEL_MAX_RETRIES || '3'),

  // Reddit Bulk scraper (JSON-based, no browser)
  redditBulkPagesPerSub: parseInt(process.env.REDDIT_BULK_PAGES_PER_SUB || '500'),
  redditBulkMinScore: parseInt(process.env.REDDIT_BULK_MIN_SCORE || '3'),
  redditBulkCommentScoreThreshold: parseInt(process.env.REDDIT_BULK_COMMENT_SCORE_THRESHOLD || '30'),

  // Stack Exchange HTML scraper concurrency
  sePagesPerTag: parseInt(process.env.SE_PAGES_PER_TAG || '20'),
  seConcurrency: parseInt(process.env.SE_CONCURRENCY || '5'),

  // GPU / embedding
  useGpu: process.env.USE_GPU !== 'false',
  embedBatchSize: parseInt(process.env.EMBED_BATCH_SIZE || '64'),

  // Dataset splits
  trainSplit: parseFloat(process.env.TRAIN_SPLIT || '0.80'),
  validSplit: parseFloat(process.env.VALID_SPLIT || '0.10'),
  testSplit: parseFloat(process.env.TEST_SPLIT || '0.10'),

  // Directories
  rawDataDir: path.resolve(process.env.RAW_DATA_DIR || './data/raw'),
  processedDataDir: path.resolve(process.env.PROCESSED_DATA_DIR || './data/processed'),
  outputDataDir: path.resolve(process.env.OUTPUT_DATA_DIR || './data/output'),
  knowledgeDir: path.resolve(process.env.KNOWLEDGE_DIR || './data/knowledge'),

  // Processed file paths
  rawIncidentsFile: path.resolve(process.env.RAW_DATA_DIR || './data/raw', 'raw_incidents.jsonl'),
  progressFile: path.resolve(process.env.RAW_DATA_DIR || './data/raw', 'scraping_progress.json'),
  cleanedFile: path.resolve(process.env.PROCESSED_DATA_DIR || './data/processed', 'cleaned_incidents.jsonl'),
  dedupFile: path.resolve(process.env.PROCESSED_DATA_DIR || './data/processed', 'deduplicated_incidents.jsonl'),
  labeledFile: path.resolve(process.env.PROCESSED_DATA_DIR || './data/processed', 'labeled_incidents.jsonl'),
  labelingCheckpointFile: path.resolve(process.env.PROCESSED_DATA_DIR || './data/processed', 'labeling_checkpoint.json'),

  // Output file paths
  datasetJsonl: path.resolve(process.env.OUTPUT_DATA_DIR || './data/output', 'dataset.jsonl'),
  datasetCsv: path.resolve(process.env.OUTPUT_DATA_DIR || './data/output', 'dataset.csv'),
  trainingDataset: path.resolve(process.env.OUTPUT_DATA_DIR || './data/output', 'training_dataset.jsonl'),
  validationDataset: path.resolve(process.env.OUTPUT_DATA_DIR || './data/output', 'validation_dataset.jsonl'),
  testDataset: path.resolve(process.env.OUTPUT_DATA_DIR || './data/output', 'test_dataset.jsonl'),
  datasetReportFile: path.resolve(process.env.OUTPUT_DATA_DIR || './data/output', 'dataset_report.json'),

  // Knowledge base
  repairPartsMapFile: path.resolve(process.env.KNOWLEDGE_DIR || './data/knowledge', 'repair-parts-map.json'),
};

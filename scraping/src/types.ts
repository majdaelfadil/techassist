export interface Comment {
  author: string;
  body: string;
  score: number;
  is_accepted: boolean;
  created_at: string;
}

export interface RawIncident {
  id: string;
  source: string;
  url: string;
  title: string;
  body: string;
  comments: Comment[];
  accepted_solution: string;
  created_at: string;
  device_name: string;
  device_brand: string;
  device_model: string;
  scraped_at: string;
}

export interface CleanedIncident extends RawIncident {
  cleaned_body: string;
  cleaned_solution: string;
  quality_score: number;
}

export type DeviceType =
  | 'Desktop'
  | 'Laptop'
  | 'Printer'
  | 'Router'
  | 'Switch'
  | 'Firewall'
  | 'Camera'
  | 'NVR'
  | 'DVR'
  | 'Access Point'
  | 'Server'
  | 'UPS'
  | 'Unknown';

export type ServiceType =
  | 'Reparation'
  | 'Installation'
  | 'Configuration'
  | 'Maintenance'
  | 'Depannage';

export type Urgency = 'Faible' | 'Normal' | 'Haute' | 'Critique';

export type TechnicianProfile =
  | 'Hardware Technician'
  | 'Network Technician'
  | 'CCTV Technician'
  | 'Server Technician'
  | 'Printer Technician'
  | 'Helpdesk Technician'
  | 'General Support Technician'; // legacy — remapped to Helpdesk Technician during cleaning

export type LabelQuality = 'gold' | 'silver' | 'bronze';

// Internal type returned by Grok with per-value confidence
export interface ConfidentValue {
  value: string;
  confidence: number;
}

// Internal Grok Pass 1 output
export interface Pass1Result {
  problem_summary: string;
  device_type: DeviceType;
  brand: string;
  model: string;
}

// Internal Grok Pass 2 output
export interface GrokPass2Result {
  probable_causes: ConfidentValue[];
  recommended_actions: ConfidentValue[];
  required_parts: ConfidentValue[];
  prevention_advice: ConfidentValue[];
}

// Resolution quality analysis result
export interface ResolutionScore {
  score: number;
  quality: LabelQuality;
  has_accepted_answer: boolean;
  has_op_confirmation: boolean;
  has_solved_keyword: boolean;
  technical_comment_count: number;
  device_model_detected: boolean;
}

// Rule engine output (deterministic fields)
export interface RuleEngineResult {
  service_type: ServiceType;
  urgency: Urgency;
  technician_profile: TechnicianProfile;
  service_type_confidence: number;
  urgency_confidence: number;
}

// Final labeled record — used in all output files
export interface LabeledIncident {
  id: string;
  source: string;
  source_url: string;
  problem_description: string;
  device_type: DeviceType;
  device_brand: string;
  device_model: string;
  service_type: ServiceType;
  urgency: Urgency;
  probable_causes: string[];
  recommended_actions: string[];
  required_parts: string[];
  technician_profile: TechnicianProfile;
  prevention_advice: string[];
  label_quality: LabelQuality;
  confidence_score: number;
  raw_solution: string;
  created_at: string;
  labeled_at: string;
}

export interface ScrapingProgress {
  source: string;
  last_cursor: string;
  incidents_collected: number;
  last_updated: string;
}

export interface PipelineStats {
  raw_count: number;
  after_cleaning: number;
  after_dedup: number;
  after_labeling: number;
  train_count: number;
  validation_count: number;
  test_count: number;
}

export interface DeviceInfo {
  device_name: string;
  device_brand: string;
  device_model: string;
  device_type: DeviceType;
}

// Dataset report types
export interface DatasetReport {
  total_incidents: number;
  gold_count: number;
  silver_count: number;
  bronze_count: number;
  device_distribution: Record<string, number>;
  service_type_distribution: Record<string, number>;
  urgency_distribution: Record<string, number>;
  technician_distribution: Record<string, number>;
  source_distribution: Record<string, number>;
  top_causes: Array<{ value: string; count: number }>;
  top_parts: Array<{ value: string; count: number }>;
  class_balance: ClassBalanceReport;
  avg_confidence_score: number;
  generated_at: string;
}

export interface ClassBalanceReport {
  service_type: ClassBalance;
  urgency: ClassBalance;
  device_type: ClassBalance;
  technician_profile: ClassBalance;
}

export interface ClassBalance {
  distribution: Record<string, number>;
  underrepresented: string[];
  overrepresented: string[];
  imbalance_ratio: number;
}

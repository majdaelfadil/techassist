import { DeviceType, ServiceType, Urgency, TechnicianProfile, RuleEngineResult } from '../types';

// ────────────────────────────────────────────────────────────
// Service Type keyword sets
// ────────────────────────────────────────────────────────────

const INSTALLATION_KEYWORDS = [
  'install', 'installing', 'installed', 'deployment', 'deploy', 'deploying',
  'new setup', 'set up new', 'setting up new', 'mount', 'mounting', 'provisioning',
  'provision', 'onboarding', 'add a new', 'adding new', 'adding a', 'first time',
  'brand new', 'out of the box', 'fresh install', 'clean install',
  'new camera', 'new router', 'new switch', 'new printer', 'new server',
  'new device', 'new access point', 'new firewall',
];

const REPARATION_KEYWORDS = [
  'repair', 'repairing', 'repaired', 'replace', 'replacing', 'replaced',
  'broken', 'break', 'cracked', 'damaged', 'physical damage',
  'hardware failure', 'hardware fault', 'dead', 'burned', 'burnt',
  'shorted', 'motherboard failure', 'fan failure', 'hdd failure', 'ssd failure',
  'psu failure', 'power supply failure', 'screen cracked', 'display broken',
  'keyboard broken', 'port damaged', 'component failure', 'dead on arrival',
  'physically damaged', 'water damage', 'liquid damage', 'overheated and died',
  'needs replacement', 'need to replace', 'swap out', 'swap the',
];

const CONFIGURATION_KEYWORDS = [
  'configure', 'configuring', 'configuration', 'config', 'reconfigure',
  'vlan', 'ip address', 'ip config', 'subnet', 'gateway', 'dns server',
  'dhcp', 'nat', 'port forward', 'port forwarding', 'acl', 'access control',
  'firewall rule', 'firewall policy', 'routing', 'route', 'bgp', 'ospf',
  'ssid', 'wpa', 'wireless settings', 'setup vpn', 'vpn config',
  'active directory', 'group policy', 'gpo', 'ldap', 'radius',
  'trunking', 'spanning tree', 'qos', 'traffic shaping',
  'setup email', 'exchange config', 'smtp settings', 'ssl certificate',
  'setup monitoring', 'snmp', 'syslog', 'ntp', 'time zone',
  'onvif', 'rtsp', 'motion detection settings', 'recording schedule',
];

const MAINTENANCE_KEYWORDS = [
  'maintenance', 'preventive maintenance', 'scheduled maintenance',
  'preventative', 'cleaning', 'clean the', 'clean dust', 'dust removal',
  'inspection', 'routine check', 'routine inspection', 'annual check',
  'firmware update', 'firmware upgrade', 'update firmware', 'patch',
  'patching', 'software update', 'os update', 'bios update',
  'disk check', 'chkdsk', 'defrag', 'defragment', 'health check',
  'battery replacement', 'ups test', 'replace filter', 'air filter',
  'thermal paste', 'reapply thermal', 'clean fan', 'clean heatsink',
  'backup job', 'test backup', 'verify backup', 'restore test',
];

const DEPANNAGE_KEYWORDS = [
  'offline', 'not working', 'not connecting', 'cannot connect', 'can\'t connect',
  'down', 'went down', 'stopped working', 'stopped responding', 'not responding',
  'no internet', 'lost connection', 'lost access', 'dropped', 'disconnecting',
  'outage', 'service down', 'system down', 'unavailable', 'unreachable',
  'crash', 'crashing', 'crashed', 'freeze', 'frozen', 'freezing', 'hangs', 'hung',
  'bsod', 'blue screen', 'kernel panic', 'reboot loop', 'boot loop',
  'not printing', 'print error', 'print job stuck', 'printer queue stuck',
  'camera offline', 'cameras offline', 'no video', 'no recording',
  'error', 'failure', 'failed', 'fault', 'issue', 'problem',
  'keeps disconnecting', 'intermittent', 'packet loss', 'high latency',
  'slow network', 'slow internet', 'slow performance', 'unresponsive',
];

// ────────────────────────────────────────────────────────────
// Urgency keyword sets
// ────────────────────────────────────────────────────────────

const CRITIQUE_KEYWORDS = [
  'server down', 'servers down', 'production down', 'all users',
  'entire company', 'whole company', 'company-wide', 'site down',
  'total outage', 'complete outage', 'network down', 'internet down',
  'data loss', 'losing data', 'lost data', 'ransomware', 'malware',
  'security breach', 'hacked', 'compromised', 'critical failure',
  'cannot work', 'nobody can', 'no one can access', 'everyone is down',
  'entire office', 'whole office', 'all employees', 'all staff',
  'domain controller down', 'dc down', 'active directory down',
  'email server down', 'database down', 'production server',
  'factory floor', 'pos down', 'point of sale', 'urgent',
  'all cameras offline', 'nvr down', 'emergency',
];

const HAUTE_KEYWORDS = [
  'multiple users', 'several users', 'many users', 'multiple computers',
  'several computers', 'multiple devices', 'several devices',
  'department', 'floor', 'building', 'campus', 'branch',
  'vpn down', 'vpn not working', 'remote access down',
  'email down', 'exchange down', 'file server', 'nas down',
  'major', 'significant impact', 'high priority', 'affecting many',
  'multiple cameras', 'several cameras', 'half the cameras',
  'backup failed', 'raid degraded', 'raid failure',
  'switch down', 'core switch', 'core router', 'firewall down',
  'wireless down', 'wifi down', 'entire ssid',
];

const NORMAL_KEYWORDS = [
  'one user', 'a user', 'single user', 'employee', 'staff member',
  'workstation', 'one workstation', 'one laptop', 'one computer',
  'my laptop', 'my computer', 'my workstation', 'my printer',
  'one printer', 'a printer', 'single printer',
  'one camera', 'a camera', 'one access point',
  'moderate', 'normal priority', 'can work around',
];

const FAIBLE_KEYWORDS = [
  'cosmetic', 'minor', 'not urgent', 'low priority',
  'home network', 'home lab', 'homelab', 'home office', 'personal',
  'at home', 'home use', 'residential',
  'one port', 'single port', 'a port not working',
  'slow fan', 'noise', 'cosmetic issue', 'aesthetic',
  'eventually', 'when you get a chance', 'not critical',
  'testing', 'lab environment', 'test environment',
];

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

function countKeywords(text: string, keywords: string[]): number {
  const lower = text.toLowerCase();
  return keywords.filter(kw => lower.includes(kw)).length;
}

function normalize(scores: Record<string, number>): Record<string, number> {
  const total = Object.values(scores).reduce((a, b) => a + b, 0);
  if (total === 0) return scores;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(scores)) {
    out[k] = v / total;
  }
  return out;
}

// ────────────────────────────────────────────────────────────
// Service Type
// ────────────────────────────────────────────────────────────

export function determineServiceType(
  title: string,
  body: string
): { service_type: ServiceType; confidence: number } {
  const text = `${title} ${body}`.toLowerCase();

  const raw: Record<ServiceType, number> = {
    Installation: countKeywords(text, INSTALLATION_KEYWORDS) * 3,
    Reparation: countKeywords(text, REPARATION_KEYWORDS) * 3,
    Configuration: countKeywords(text, CONFIGURATION_KEYWORDS) * 2,
    Maintenance: countKeywords(text, MAINTENANCE_KEYWORDS) * 2,
    Depannage: countKeywords(text, DEPANNAGE_KEYWORDS) * 1,
  };

  // Depannage is the baseline — most IT issues are troubleshooting
  if (raw.Depannage === 0) raw.Depannage = 1;

  const sorted = (Object.entries(raw) as [ServiceType, number][])
    .sort((a, b) => b[1] - a[1]);

  const best = sorted[0];
  const total = sorted.reduce((s, [, v]) => s + v, 0);
  const confidence = total > 0 ? best[1] / total : 0.5;

  return { service_type: best[0], confidence: Math.min(confidence, 1) };
}

// ────────────────────────────────────────────────────────────
// Urgency
// ────────────────────────────────────────────────────────────

export function determineUrgency(
  title: string,
  body: string,
  deviceType: DeviceType
): { urgency: Urgency; confidence: number; reasoning_score: number } {
  const text = `${title} ${body}`.toLowerCase();

  let score = 0;

  // Server/network device type raises base urgency
  if (deviceType === 'Server') score += 2;
  if (deviceType === 'Router' || deviceType === 'Switch' || deviceType === 'Firewall') score += 1;

  const critiqueMentions = countKeywords(text, CRITIQUE_KEYWORDS);
  const hauteMentions = countKeywords(text, HAUTE_KEYWORDS);
  const normalMentions = countKeywords(text, NORMAL_KEYWORDS);
  const faibleMentions = countKeywords(text, FAIBLE_KEYWORDS);

  score += critiqueMentions * 4;
  score += hauteMentions * 2;
  score -= normalMentions * 1;
  score -= faibleMentions * 2;

  let urgency: Urgency;
  let confidence: number;

  if (score >= 5) {
    urgency = 'Critique';
    confidence = Math.min(0.6 + (score - 5) * 0.05, 0.95);
  } else if (score >= 2) {
    urgency = 'Haute';
    confidence = 0.55 + (score - 2) * 0.05;
  } else if (score >= -1) {
    urgency = 'Normal';
    confidence = 0.55 + Math.abs(score) * 0.05;
  } else {
    urgency = 'Faible';
    confidence = Math.min(0.55 + Math.abs(score) * 0.05, 0.90);
  }

  return { urgency, confidence, reasoning_score: score };
}

// ────────────────────────────────────────────────────────────
// Technician Profile
// ────────────────────────────────────────────────────────────

const DEVICE_PROFILE_MAP: Record<DeviceType, TechnicianProfile> = {
  Router: 'Network Technician',
  Switch: 'Network Technician',
  Firewall: 'Network Technician',
  'Access Point': 'Network Technician',
  Camera: 'CCTV Technician',
  NVR: 'CCTV Technician',
  DVR: 'CCTV Technician',
  Server: 'Server Technician',
  Desktop: 'Hardware Technician',
  Laptop: 'Hardware Technician',
  Printer: 'Hardware Technician',
  UPS: 'Hardware Technician',
  Unknown: 'General Support Technician',
};

const NETWORK_TEXT_SIGNALS = [
  'vlan', 'routing', 'bgp', 'ospf', 'switch port', 'trunk', 'spanning tree',
  'dhcp server', 'dns server', 'nat', 'wan', 'lan', 'firewall rule', 'vpn tunnel',
  'packet loss', 'latency', 'bandwidth', 'qos', 'poe switch',
];

const SERVER_TEXT_SIGNALS = [
  'active directory', 'domain controller', 'exchange', 'sql server', 'vmware',
  'hyper-v', 'esxi', 'vcenter', 'blade server', 'raid', 'san', 'nas',
  'windows server', 'linux server', 'apache', 'nginx', 'iis',
];

const CCTV_TEXT_SIGNALS = [
  'ip camera', 'ptz', 'onvif', 'rtsp', 'motion detection', 'recording',
  'nvr', 'dvr', 'hikvision', 'dahua', 'axis camera', 'surveillance',
];

export function determineTechnicianProfile(
  deviceType: DeviceType,
  title: string,
  body: string
): { technician_profile: TechnicianProfile; confidence: number } {
  // Start with the primary device-type mapping
  const base = DEVICE_PROFILE_MAP[deviceType];

  if (base !== 'General Support Technician') {
    return { technician_profile: base, confidence: 0.90 };
  }

  // For Unknown device type, use text signals to refine
  const text = `${title} ${body}`.toLowerCase();

  const networkScore = countKeywords(text, NETWORK_TEXT_SIGNALS);
  const serverScore = countKeywords(text, SERVER_TEXT_SIGNALS);
  const cctvScore = countKeywords(text, CCTV_TEXT_SIGNALS);

  const max = Math.max(networkScore, serverScore, cctvScore);

  if (max === 0) {
    return { technician_profile: 'General Support Technician', confidence: 0.60 };
  }

  if (networkScore === max) {
    return { technician_profile: 'Network Technician', confidence: 0.70 };
  }
  if (serverScore === max) {
    return { technician_profile: 'Server Technician', confidence: 0.70 };
  }
  return { technician_profile: 'CCTV Technician', confidence: 0.70 };
}

// ────────────────────────────────────────────────────────────
// Main entry point
// ────────────────────────────────────────────────────────────

export function applyRuleEngine(
  title: string,
  body: string,
  deviceType: DeviceType
): RuleEngineResult {
  const { service_type, confidence: svc_conf } = determineServiceType(title, body);
  const { urgency, confidence: urg_conf } = determineUrgency(title, body, deviceType);
  const { technician_profile } = determineTechnicianProfile(deviceType, title, body);

  return {
    service_type,
    urgency,
    technician_profile,
    service_type_confidence: svc_conf,
    urgency_confidence: urg_conf,
  };
}

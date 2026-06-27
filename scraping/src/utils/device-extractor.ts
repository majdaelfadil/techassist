import { DeviceInfo, DeviceType } from '../types';

const BRAND_PATTERNS: Record<string, string[]> = {
  'Cisco': ['cisco', 'meraki', 'linksys by cisco'],
  'Dell': ['dell', 'alienware', 'poweredge', 'optiplex', 'latitude', 'inspiron', 'precision workstation'],
  'HP': ['hp ', 'hewlett', 'proliant', 'elitebook', 'probook', 'laserjet', 'officejet', 'envy'],
  'Lenovo': ['lenovo', 'thinkpad', 'thinkcentre', 'ideapad', 'legion'],
  'Hikvision': ['hikvision', 'hik-connect', 'hikcentral'],
  'Ubiquiti': ['ubiquiti', 'unifi', 'edgerouter', 'airmax', 'usg', 'udm'],
  'MikroTik': ['mikrotik', 'routerboard', 'rb '],
  'TP-Link': ['tp-link', 'tp link', 'tplink', 'archer', 'deco'],
  'APC': ['apc ', 'smart-ups', 'back-ups', 'symmetra'],
  'Synology': ['synology', 'diskstation', 'rackstation'],
  'Netgear': ['netgear', 'nighthawk', 'readynas'],
  'Asus': ['asus', 'rt-', 'zenwifi'],
  'Fortinet': ['fortinet', 'fortigate', 'fortiswitch'],
  'Palo Alto': ['palo alto', 'panos'],
  'Aruba': ['aruba'],
  'Samsung': ['samsung'],
  'Seagate': ['seagate', 'barracuda', 'ironwolf'],
  'Western Digital': ['western digital', 'wd ', 'my cloud', 'my passport'],
  'QNAP': ['qnap', 'turbonas'],
  'D-Link': ['d-link', 'dlink'],
  'Juniper': ['juniper', 'junos'],
};

const DEVICE_TYPE_PATTERNS: Record<DeviceType, string[]> = {
  'Desktop': ['desktop', 'pc ', 'computer', 'tower', 'workstation', 'all-in-one', 'imac', 'optiplex', 'thinkcentre'],
  'Laptop': ['laptop', 'notebook', 'macbook', 'thinkpad', 'elitebook', 'probook', 'latitude', 'inspiron', 'ideapad', 'chromebook'],
  'Printer': ['printer', 'printing', 'laserjet', 'officejet', 'inkjet', 'laser printer', 'print queue', 'print server', 'mfp', 'multifunction'],
  'Router': ['router', 'routing', 'gateway', 'edgerouter', 'vyos', 'pfsense', 'opnsense', 'cisco 1900', 'cisco 2900', 'cisco 4000'],
  'Switch': ['switch', 'switching', 'vlan', 'cisco catalyst', 'cisco nexus', 'unifi switch', 'managed switch', 'layer 2', 'layer 3 switch'],
  'Firewall': ['firewall', 'fortigate', 'palo alto', 'asa ', 'fortios', 'utm', 'ngfw', 'checkpoint', 'juniper srx'],
  'Camera': ['camera', 'ip camera', 'ipcam', 'surveillance camera', 'cctv camera', 'hikvision camera', 'dahua camera', 'onvif'],
  'NVR': ['nvr', 'network video recorder', 'ivm', 'hik-connect nvr'],
  'DVR': ['dvr', 'digital video recorder', 'dvr recorder'],
  'Access Point': ['access point', 'ap ', 'wifi ap', 'wireless ap', 'unifi ap', 'aironet', 'aruba ap', 'ruckus ap', '802.11ac', '802.11ax', 'wi-fi 6'],
  'Server': ['server', 'proliant', 'poweredge', 'raid', 'esxi', 'vmware', 'hyper-v', 'active directory', 'domain controller', 'file server', 'web server', 'sql server', 'exchange server'],
  'UPS': ['ups ', 'uninterruptible', 'battery backup', 'apc ups', 'smart-ups', 'back-ups', 'power supply'],
  'Unknown': [],
};

const MODEL_PATTERNS = [
  /\b([A-Z]{1,3}[- ]?\d{3,5}[A-Z]{0,2})\b/,
  /\b(DGS-\d{4}[A-Z]?)\b/i,
  /\b(WS-C\d{4}[A-Z-]+)\b/i,
  /\b(ASA\s?\d{4}[A-Z-]*)\b/i,
  /\bmodel[:\s]+([A-Za-z0-9][-A-Za-z0-9]{3,15})/i,
  /\b(ProLiant\s[A-Z]{2,3}\d{3,4}[Ge]?)\b/i,
  /\b(PowerEdge\s[A-Z]\d{4})\b/i,
  /\b(ThinkPad\s[A-Z]\d{3}[a-z]?)\b/i,
  /\b(EliteBook\s\d{3}\s[A-Z]\d?)\b/i,
  /\b(LaserJet\s[A-Za-z]{0,3}\d{3,4}[A-Za-z]{0,3})\b/i,
  /\b(RT-[A-Z]{2}\d{4}[A-Z]{0,3})\b/i,
];

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/[^\w\s-]/g, ' ');
}

export function extractDeviceInfo(title: string, body: string): DeviceInfo {
  const combined = `${title} ${body}`;
  const normalized = normalizeText(combined);

  let device_brand = 'Unknown';
  for (const [brand, patterns] of Object.entries(BRAND_PATTERNS)) {
    if (patterns.some(p => normalized.includes(p.toLowerCase()))) {
      device_brand = brand;
      break;
    }
  }

  let device_type: DeviceType = 'Unknown';
  let maxScore = 0;
  for (const [dtype, patterns] of Object.entries(DEVICE_TYPE_PATTERNS) as [DeviceType, string[]][]) {
    if (dtype === 'Unknown') continue;
    const score = patterns.filter(p => normalized.includes(p.toLowerCase())).length;
    if (score > maxScore) {
      maxScore = score;
      device_type = dtype;
    }
  }

  let device_model = '';
  for (const pattern of MODEL_PATTERNS) {
    const match = combined.match(pattern);
    if (match) {
      device_model = match[1] || '';
      break;
    }
  }

  const device_name = device_brand !== 'Unknown' || device_model
    ? `${device_brand !== 'Unknown' ? device_brand : ''} ${device_model}`.trim()
    : device_type !== 'Unknown'
    ? device_type
    : '';

  return { device_name, device_brand, device_model, device_type };
}

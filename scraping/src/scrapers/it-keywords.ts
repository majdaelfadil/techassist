/**
 * Centralized IT failure keyword registry.
 * Used by bulk and community scrapers for targeted search.
 * Keywords are multi-word to be specific enough for search queries.
 */

export const IT_KEYWORDS_BY_CATEGORY: Record<string, string[]> = {
  desktop_pc: [
    'pc slow', 'computer slow', 'desktop slow', 'pc freezing', 'computer freezing',
    'pc lagging', 'high cpu usage', 'high ram usage', 'computer overheating', 'pc overheating',
    'computer not booting', 'pc not booting', 'black screen pc', 'blue screen', 'bsod',
    'boot loop', 'windows crash', 'computer restart loop', 'power supply failure', 'motherboard issue',
    'ssd failure', 'hard drive failure', 'ram failure', 'bios issue', 'fan noise',
    'computer shutdown', 'random restart', 'virus infection', 'malware infection', 'computer no display',
  ],
  laptop: [
    'laptop overheating', 'laptop battery issue', 'battery not charging', 'battery draining fast',
    'laptop not turning on', 'laptop shuts down', 'laptop black screen', 'screen flickering',
    'screen not working', 'keyboard not working', 'touchpad not working', 'charging port issue',
    'laptop fan noise', 'slow laptop', 'laptop freeze', 'laptop boot issue', 'wifi not working laptop',
    'bluetooth not working', 'broken hinge', 'laptop overheating while charging', 'battery swollen',
    'laptop restart loop', 'laptop crash', 'laptop lagging', 'laptop no display',
    'camera not working laptop', 'speaker not working laptop', 'usb port not working',
    'laptop power issue', 'laptop motherboard issue',
  ],
  printer: [
    'printer offline', 'printer not printing', 'paper jam', 'printer queue stuck',
    'printer connection issue', 'network printer issue', 'printer driver issue', 'printer error',
    'printer cartridge issue', 'printer toner issue', 'printer scan problem', 'printer not detected',
    'printer wireless issue', 'printer slow printing', 'printer print quality issue', 'printer streaks',
    'printer ink problem', 'printer maintenance kit issue', 'printer spooler issue', 'printer usb issue',
    'printer wifi issue', 'printer firmware issue', 'printer scanner not working', 'printer blank pages',
    'printer color issue', 'printer paper feed issue', 'printer communication error',
    'printer hardware failure', 'printer network timeout', 'printer unable to print',
  ],
  router: [
    'router offline', 'router not working', 'router rebooting', 'router internet down', 'wan down',
    'router configuration issue', 'router firmware issue', 'router packet loss', 'router power issue',
    'router overheating', 'router disconnecting', 'router dns issue', 'router nat issue',
    'router slow internet', 'router no internet', 'router login issue', 'router vpn issue',
    'router dhcp issue', 'router routing issue', 'router wan failure', 'router lan issue',
    'router port issue', 'router firewall issue', 'router bandwidth issue', 'router unstable connection',
    'router network outage', 'router ip conflict', 'router access issue', 'router wireless issue',
    'router authentication issue',
  ],
  switch: [
    'switch offline', 'switch not responding', 'switch port failure', 'switch configuration issue',
    'switch vlan issue', 'switch rebooting', 'switch power issue', 'switch packet loss',
    'switch uplink issue', 'switch network outage', 'switch firmware issue', 'switch spanning tree issue',
    'switch loop issue', 'switch stack issue', 'switch management issue', 'switch port down',
    'switch connectivity issue', 'switch trunk issue', 'switch access port issue', 'switch broadcast storm',
    'switch poe issue', 'switch fan failure', 'switch overheating', 'switch authentication issue',
    'switch latency issue', 'switch routing issue', 'switch mac table issue', 'switch network instability',
    'switch hardware failure', 'switch link down',
  ],
  firewall: [
    'firewall offline', 'firewall not working', 'firewall rule issue', 'firewall vpn issue',
    'firewall configuration issue', 'firewall firmware issue', 'firewall performance issue',
    'firewall rebooting', 'firewall internet issue', 'firewall access issue', 'firewall packet loss',
    'firewall latency issue', 'firewall authentication issue', 'firewall power issue',
    'firewall hardware issue', 'firewall ssl vpn issue', 'firewall site to site vpn issue',
    'firewall traffic issue', 'firewall policy issue', 'firewall nat issue', 'firewall logging issue',
    'firewall update issue', 'firewall network outage', 'firewall dns issue', 'firewall routing issue',
    'firewall interface down', 'firewall connection failure', 'firewall management issue',
    'firewall high cpu', 'firewall high memory',
  ],
  access_point: [
    'wifi not working', 'wifi disconnecting', 'wireless issue', 'access point offline',
    'access point rebooting', 'wifi slow', 'wifi coverage issue', 'wifi authentication issue',
    'wifi roaming issue', 'ssid not visible', 'wireless interference', 'wifi packet loss',
    'wifi latency issue', 'access point power issue', 'access point firmware issue',
    'wifi channel issue', 'wifi signal weak', 'wifi network outage', 'wifi bandwidth issue',
    'wifi client issue', 'wifi ip issue', 'wifi dhcp issue', 'wifi security issue',
    'wifi captive portal issue', 'wifi connection failed', 'wifi unstable', 'wifi access problem',
    'wifi login issue', 'wifi performance issue', 'wireless access issue',
  ],
  cctv_camera: [
    'camera offline', 'camera no video', 'camera blurry', 'camera image issue',
    'camera not recording', 'camera power issue', 'camera network issue', 'camera disconnected',
    'camera night vision issue', 'camera rebooting', 'camera not detected', 'ip camera issue',
    'camera storage issue', 'camera firmware issue', 'camera connection issue', 'camera video loss',
    'camera poor image quality', 'camera focus issue', 'camera lens issue', 'camera infrared issue',
    'camera motion detection issue', 'camera cable issue', 'camera poe issue', 'camera access issue',
    'camera authentication issue', 'camera lagging', 'camera stream issue', 'camera hardware issue',
    'camera signal loss', 'camera network timeout',
  ],
  nvr_dvr: [
    'nvr offline', 'nvr recording issue', 'nvr hard drive issue', 'nvr camera disconnect',
    'nvr storage full', 'nvr playback issue', 'dvr not recording', 'dvr offline', 'dvr power issue',
    'nvr rebooting', 'nvr network issue', 'nvr firmware issue', 'nvr disk failure',
    'nvr connection issue', 'nvr remote access issue', 'nvr authentication issue', 'nvr video loss',
    'nvr camera sync issue', 'nvr storage corruption', 'nvr backup issue', 'nvr hardware failure',
    'nvr overheating', 'nvr configuration issue', 'dvr video issue', 'dvr playback issue',
    'dvr storage issue', 'dvr hard drive issue', 'dvr camera issue', 'dvr firmware issue',
    'dvr connection issue',
  ],
  server: [
    'server down', 'server offline', 'server not booting', 'server crash', 'server performance issue',
    'server storage issue', 'server overheating', 'server disk failure', 'server raid issue',
    'server backup failure', 'server network issue', 'server power issue', 'server rebooting',
    'server hardware failure', 'server memory issue', 'server cpu issue',
    'server operating system issue', 'windows server issue', 'linux server issue', 'vmware issue',
    'hypervisor issue', 'virtual machine issue', 'server authentication issue', 'server update issue',
    'server replication issue', 'server database issue', 'server latency issue',
    'server connectivity issue', 'server access issue', 'server unavailable',
  ],
  ups: [
    'ups battery failure', 'ups battery replacement', 'ups alarm', 'ups not charging',
    'ups power issue', 'ups shutdown', 'ups overload', 'ups communication issue', 'ups firmware issue',
    'ups overheating', 'ups battery low', 'ups runtime issue', 'ups inverter issue',
    'ups output issue', 'ups input issue', 'ups hardware failure', 'ups maintenance issue',
    'ups connection issue', 'ups monitoring issue', 'ups voltage issue', 'ups surge issue',
    'ups startup issue', 'ups network card issue', 'ups fan issue', 'ups unexpected shutdown',
    'ups battery degradation', 'ups calibration issue', 'ups backup issue', 'ups charging failure',
    'ups fault alarm',
  ],
};

/** Resolution modifiers to combine with search terms for higher-quality results */
export const RESOLUTION_MODIFIERS = [
  'solved', 'fixed', 'resolved', 'troubleshooting', 'solution', 'root cause',
];

/** All device-specific keywords flattened */
export const ALL_DEVICE_KEYWORDS: string[] = Object.values(IT_KEYWORDS_BY_CATEGORY).flat();

/**
 * Keywords suitable for PullPush / SE search — multi-word device-specific terms.
 * Skips overly generic phrases that would match non-IT content.
 */
export const SEARCH_KEYWORDS: string[] = ALL_DEVICE_KEYWORDS.filter(k => {
  const words = k.trim().split(/\s+/);
  // Keep multi-word phrases; skip single generic words
  if (words.length < 2) return false;
  const generic = ['not working', 'offline', 'down', 'slow', 'freezing', 'lagging'];
  if (generic.includes(k)) return false;
  return true;
});

// ─────────────────────────────────────────────────────────────────
// Stack Exchange additional tags for expanded coverage
// ─────────────────────────────────────────────────────────────────
export const SE_EXTENDED_TAGS: string[] = [
  // Already in base list: networking, hardware, windows, router, printer, firewall, vpn,
  //   storage, server, wireless-networking, hard-drive, bios, drivers, switch, ups,
  //   linux, ubuntu, ssh, dns, dhcp, raid, backup, nas, virtualization, docker,
  //   ethernet, wifi, ip-address, troubleshooting, crash

  // Device categories not yet covered
  'ip-camera', 'cctv', 'surveillance', 'nvr', 'dvr',
  'power-supply', 'battery', 'laptop', 'desktop-computer',
  'access-point', 'ssid', 'vlan', 'spanning-tree', 'poe',
  'proxmox', 'vmware-esxi', 'hyper-v', 'kvm', 'virtualbox',
  'truenas', 'freenas', 'synology', 'qnap',
  'pfsense', 'opnsense', 'mikrotik', 'ubiquiti',
  'windows-server', 'active-directory', 'domain-controller',
  'raid', 'disk-failure', 'smart', 'boot',
  'blue-screen-of-death', 'kernel-panic', 'overheating',
];

// ─────────────────────────────────────────────────────────────────
// Community sites to scrape (beyond Reddit / Stack Exchange)
// ─────────────────────────────────────────────────────────────────
export interface CommunitySite {
  name: string;
  host: string;
  platform: 'discourse' | 'phpbb' | 'xenforo' | 'custom';
  categories: string[];   // category slugs or IDs
  maxPages: number;
}

export const COMMUNITY_SITES: CommunitySite[] = [
  // Tier 5: Servers / Sysadmin
  {
    name: 'proxmox',
    host: 'forum.proxmox.com',
    platform: 'discourse',
    categories: ['general-discussion', 'proxmox-ve', 'proxmox-backup-server', 'installation'],
    maxPages: 30,
  },
  {
    name: 'truenas',
    host: 'forums.truenas.com',
    platform: 'discourse',
    categories: ['general-discussion', 'plugins-jails-vms', 'networking', 'storage'],
    maxPages: 30,
  },
  // Tier 2: Enterprise Networking
  {
    name: 'tp-link',
    host: 'community.tp-link.com',
    platform: 'discourse',
    categories: ['routers', 'switches', 'access-points', 'deco-mesh'],
    maxPages: 20,
  },
  // Tier 4: CCTV / Surveillance
  {
    name: 'ipcamtalk',
    host: 'ipcamtalk.com',
    platform: 'xenforo',
    categories: ['general-ipcam-discussion', 'help-support', 'networking'],
    maxPages: 20,
  },
  // Tier 3: Hardware / PC
  {
    name: 'linuxquestions',
    host: 'www.linuxquestions.org',
    platform: 'custom',
    categories: [
      'questions/linux-hardware-18',
      'questions/linux-networking-3',
      'questions/linux-server-4',
      'questions/linux-general-1',
    ],
    maxPages: 15,
  },
  // Tier 2: Enterprise Networking (phpBB)
  {
    name: 'mikrotik',
    host: 'forum.mikrotik.com',
    platform: 'phpbb',
    categories: ['7', '9', '11', '23'],   // General, Wireless, IPv6, VPN forum IDs
    maxPages: 15,
  },
];

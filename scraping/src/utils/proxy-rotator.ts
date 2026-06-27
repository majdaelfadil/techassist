/**
 * Proxy rotator — round-robin with per-proxy cooldown on 429.
 * Configure via PROXY_LIST in .env:
 *   PROXY_LIST=http://user:pass@host1:port,http://user:pass@host2:port,...
 * If PROXY_LIST is empty/unset, all requests go direct (no proxy).
 */
import { HttpsProxyAgent } from 'https-proxy-agent';

interface ProxyState {
  url: string;
  agent: HttpsProxyAgent;
  cooldownUntil: number; // ms timestamp
  requests: number;
  errors: number;
}

class ProxyRotator {
  private proxies: ProxyState[] = [];
  private index = 0;
  private readonly COOLDOWN_MS = 60_000; // 1 minute cooldown after 429

  constructor() {
    const raw = process.env.PROXY_LIST || '';
    const urls = raw.split(',').map(s => s.trim()).filter(Boolean);
    this.proxies = urls.map(url => ({
      url,
      agent: new HttpsProxyAgent(url),
      cooldownUntil: 0,
      requests: 0,
      errors: 0,
    }));

    if (this.proxies.length > 0) {
      console.log(`[ProxyRotator] Loaded ${this.proxies.length} proxies`);
    }
  }

  get count(): number {
    return this.proxies.length;
  }

  /** Returns the next available proxy agent, or null if none configured. */
  next(): HttpsProxyAgent | null {
    if (this.proxies.length === 0) return null;

    const now = Date.now();
    // Try each proxy once looking for a non-cooling-down one
    for (let i = 0; i < this.proxies.length; i++) {
      const proxy = this.proxies[this.index % this.proxies.length];
      this.index++;
      if (proxy.cooldownUntil <= now) {
        proxy.requests++;
        return proxy.agent;
      }
    }

    // All proxies cooling down — return the one whose cooldown ends soonest
    const best = this.proxies.reduce((a, b) => a.cooldownUntil < b.cooldownUntil ? a : b);
    best.requests++;
    return best.agent;
  }

  /** Call when a proxy returns 429. Puts it in cooldown. */
  reportRateLimit(agent: HttpsProxyAgent): void {
    const proxy = this.proxies.find(p => p.agent === agent);
    if (proxy) {
      proxy.cooldownUntil = Date.now() + this.COOLDOWN_MS;
      proxy.errors++;
    }
  }

  stats(): string {
    if (this.proxies.length === 0) return 'no proxies (direct)';
    return this.proxies.map((p, i) => {
      const cooling = p.cooldownUntil > Date.now() ? '❄' : '✓';
      return `  [${i}] ${cooling} req=${p.requests} err=${p.errors}`;
    }).join('\n');
  }
}

// Singleton
export const proxyRotator = new ProxyRotator();

/**
 * Returns axios config extras (httpsAgent + httpAgent) for use in axios.get().
 * Returns {} when no proxies are configured (direct connection).
 */
export function getAxiosProxyConfig(): Record<string, unknown> {
  const agent = proxyRotator.next();
  if (!agent) return {};
  return { httpsAgent: agent, httpAgent: agent, _proxyAgent: agent };
}

/**
 * Report that a given axios response config had a 429.
 * Pass the config object returned by getAxiosProxyConfig().
 */
export function reportProxyRateLimit(axiosCfg: Record<string, unknown>): void {
  const agent = axiosCfg._proxyAgent as HttpsProxyAgent | undefined;
  if (agent) proxyRotator.reportRateLimit(agent);
}

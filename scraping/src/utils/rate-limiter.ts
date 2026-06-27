export class RateLimiter {
  private lastRequest = 0;
  private queue: Array<() => void> = [];
  private processing = false;

  constructor(private readonly delayMs: number) {}

  async throttle(): Promise<void> {
    return new Promise((resolve) => {
      this.queue.push(resolve);
      if (!this.processing) {
        void this.processQueue();
      }
    });
  }

  private async processQueue(): Promise<void> {
    this.processing = true;
    while (this.queue.length > 0) {
      const now = Date.now();
      const elapsed = now - this.lastRequest;
      if (elapsed < this.delayMs) {
        await sleep(this.delayMs - elapsed);
      }
      this.lastRequest = Date.now();
      const resolve = this.queue.shift();
      if (resolve) resolve();
    }
    this.processing = false;
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 1000,
  label: string = 'operation'
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const delay = baseDelayMs * Math.pow(2, attempt) + Math.random() * 500;

      if (attempt < maxRetries - 1) {
        await sleep(delay);
      }
    }
  }

  throw new Error(`${label} failed after ${maxRetries} attempts: ${lastError?.message}`);
}

export function randomDelay(minMs: number, maxMs: number): Promise<void> {
  const delay = minMs + Math.random() * (maxMs - minMs);
  return sleep(delay);
}

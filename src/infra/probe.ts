import type { Probe as Port } from '@/core/ingest/port';

export class Probe implements Port {
  constructor(private timeout = 5000) {}

  async code(url: string): Promise<number | null> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeout);
    try {
      return (await fetch(url, { signal: ctrl.signal })).status;
    } catch (err) {
      console.warn(`Uptime fetch failed for ${url}:`, (err as Error).message);
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
}

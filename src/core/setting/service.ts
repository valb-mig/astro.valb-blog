import { Fault } from '../error';
import type { Settings } from './port';

export class Service {
  constructor(private settings: Settings) {}

  get(key: string): Promise<string | null> {
    return this.settings.get(key);
  }

  all(): Promise<{ [key: string]: string }> {
    return this.settings.all();
  }

  async set(key: unknown, value: unknown): Promise<{ key: string; value: string }> {
    if (typeof key !== 'string' || typeof value !== 'string') throw new Fault('invalid', 'key e value são obrigatórios');
    await this.settings.set(key, value);
    return { key, value };
  }

  async maintenance(): Promise<boolean> {
    return (await this.settings.get('maintenance_mode')) === 'true';
  }

  async list(key: string): Promise<string[]> {
    const raw = await this.settings.get(key);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
    } catch {
      return [];
    }
  }

  async save(key: string, values: string[]): Promise<string[]> {
    const unique = [...new Set(values)].sort((a, b) => a.localeCompare(b));
    await this.settings.set(key, JSON.stringify(unique));
    return unique;
  }
}

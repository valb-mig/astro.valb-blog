import type { Settings as Port } from '@/core/setting/port';
import { must, type Db } from './client';

export class Settings implements Port {
  constructor(private db: Db) {}

  async get(key: string): Promise<string | null> {
    const r = must(await this.db.from('settings').select('value').eq('key', key).maybeSingle()) as {
      value: string;
    } | null;
    return r?.value ?? null;
  }

  async all(): Promise<{ [key: string]: string }> {
    const rows = must(await this.db.from('settings').select('key,value')) as { key: string; value: string }[];
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  }

  async set(key: string, value: string): Promise<void> {
    must(await this.db.from('settings').upsert({ key, value, updated_at: new Date().toISOString() }));
  }
}

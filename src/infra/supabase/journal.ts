import type { Journal as Port, Outcome } from '@/core/ingest/port';
import { must, type Db } from './client';

export class Journal implements Port {
  constructor(private db: Db) {}

  async start(date: string, trigger: string): Promise<string> {
    const r = must(
      await this.db.from('ingest_runs').insert({ target_date: date, trigger }).select('id').single(),
    ) as { id: string };
    return r.id;
  }

  async finish(id: string, o: Outcome): Promise<void> {
    const { error } = await this.db
      .from('ingest_runs')
      .update({
        status: o.status,
        events_created: o.created,
        llm_fallback_used: o.fallback,
        error_message: o.error,
        finished_at: new Date().toISOString(),
      })
      .eq('id', id);
    if (error) console.warn('ingest_run update failed:', error.message);
  }
}

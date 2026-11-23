import type { Runs as Port } from '@/core/run/port';
import type { Run, Status } from '@/core/run/run';
import { must, type Db } from './client';

type Row = {
  id: string;
  started_at: string;
  finished_at: string | null;
  status: Status;
  target_date: string;
  trigger: string;
  events_created: number;
  llm_fallback_used: boolean;
  error_message: string | null;
};

const run = (r: Row): Run => ({
  id: r.id,
  startedAt: r.started_at,
  finishedAt: r.finished_at,
  status: r.status,
  date: r.target_date,
  trigger: r.trigger,
  created: r.events_created,
  fallback: r.llm_fallback_used,
  error: r.error_message,
});

export class Runs implements Port {
  constructor(private db: Db) {}

  async recent(limit: number): Promise<Run[]> {
    const rows = must(
      await this.db.from('ingest_runs').select('*').order('started_at', { ascending: false }).limit(limit),
    ) as Row[];
    return rows.map(run);
  }
}

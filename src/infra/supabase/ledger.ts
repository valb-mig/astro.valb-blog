import type { Event } from '@/core/event/event';
import { key, type Fresh, type Ledger as Port } from '@/core/ingest/port';
import { must, type Db } from './client';

type Row = Omit<Event, 'externalId' | 'at' | 'createdAt'> & {
  external_id: string;
  occurred_at: string;
  created_at: string;
};

const event = (r: Row): Event => ({
  id: r.id,
  source: r.source,
  type: r.type,
  externalId: r.external_id,
  repo: r.repo,
  url: r.url,
  title: r.title,
  payload: r.payload,
  at: r.occurred_at,
  createdAt: r.created_at,
});

const row = (e: Fresh) => ({
  source: e.source,
  type: e.type,
  external_id: e.externalId,
  repo: e.repo,
  url: e.url,
  title: e.title,
  payload: e.payload,
  occurred_at: e.at,
});

export class Ledger implements Port {
  constructor(private db: Db) {}

  async known(events: Fresh[]): Promise<Set<string>> {
    if (!events.length) return new Set();
    const rows = must(
      await this.db
        .from('source_events')
        .select('type, external_id, repo')
        .in(
          'external_id',
          events.map((e) => e.externalId),
        ),
    ) as Pick<Row, 'type' | 'external_id' | 'repo'>[];
    return new Set(rows.map((r) => key({ type: r.type, externalId: r.external_id, repo: r.repo })));
  }

  async save(events: Fresh[]): Promise<Event[]> {
    const rows = must(
      await this.db
        .from('source_events')
        .upsert(events.map(row), { onConflict: 'source,type,external_id,repo', ignoreDuplicates: true })
        .select('*'),
    ) as Row[];
    return rows.map(event);
  }

  async attach(post: string, events: string[]): Promise<void> {
    must(
      await this.db
        .from('post_events')
        .upsert(
          events.map((event_id) => ({ post_id: post, event_id })),
          { onConflict: 'post_id,event_id', ignoreDuplicates: true },
        ),
    );
  }

  async of(post: string): Promise<Event[]> {
    const links = must(await this.db.from('post_events').select('event_id').eq('post_id', post)) as { event_id: string }[];
    if (!links.length) return [];
    const rows = must(
      await this.db
        .from('source_events')
        .select('*')
        .in(
          'id',
          links.map((l) => l.event_id),
        ),
    ) as Row[];
    return rows.map(event);
  }
}

import type { Updates as Port } from '@/core/update/port';
import type { Input, Update } from '@/core/update/update';
import { must, type Db } from './client';

type Row = Omit<Update, 'url' | 'createdAt'> & { ref_url: string | null; created_at: string };

const update = (r: Row): Update => ({
  id: r.id,
  message: r.message,
  source: r.source,
  kind: r.kind,
  url: r.ref_url,
  createdAt: r.created_at,
});

export class Updates implements Port {
  constructor(private db: Db) {}

  async latest(): Promise<Update | null> {
    const r = must(
      await this.db.from('updates').select('*').order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ) as Row | null;
    return r ? update(r) : null;
  }

  async page(size: number, before?: string): Promise<Update[]> {
    let q = this.db.from('updates').select('*').order('created_at', { ascending: false }).limit(size);
    if (before) q = q.lt('created_at', before);
    return (must(await q) as Row[]).map(update);
  }

  async create(input: Input): Promise<Update> {
    const r = must(
      await this.db
        .from('updates')
        .insert({ message: input.message, source: input.source, kind: input.kind, ref_url: input.url })
        .select()
        .single(),
    ) as Row;
    return update(r);
  }

  async remove(id: string): Promise<void> {
    must(await this.db.from('updates').delete().eq('id', id));
  }
}

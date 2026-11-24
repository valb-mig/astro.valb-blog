import type { Item } from '@/core/event/event';
import type { Events as Port, Query } from '@/core/event/port';
import { must, type Db } from './client';

const cols = 'id,type,repo,url,title,occurred_at';

type Row = Omit<Item, 'at'> & { occurred_at: string };

const item = ({ occurred_at, ...r }: Row): Item => ({
  id: r.id,
  type: r.type,
  repo: r.repo,
  url: r.url,
  title: r.title,
  at: occurred_at,
});

export class Events implements Port {
  constructor(private db: Db) {}

  async feed({ page, size, repo, linked }: Query): Promise<{ items: Item[]; total: number }> {
    const from = (page - 1) * size;
    let q = this.db
      .from('source_events')
      .select(linked ? `${cols},post_events!inner(post_id)` : cols, { count: 'exact' })
      .order('occurred_at', { ascending: false })
      .range(from, from + size - 1);
    if (repo) q = q.eq('repo', repo);

    const res = await q;
    if (res.error) throw new Error(res.error.message);
    return { items: (res.data as unknown as Row[]).map(item), total: res.count ?? 0 };
  }

  async recent(repo: string, limit: number): Promise<Item[]> {
    const rows = must(
      await this.db
        .from('source_events')
        .select(cols)
        .eq('repo', repo)
        .order('occurred_at', { ascending: false })
        .limit(limit),
    ) as Row[];
    return rows.map(item);
  }

  async last(repos: string[]): Promise<{ [repo: string]: string }> {
    const rows = await Promise.all(
      repos.map((repo) =>
        this.db
          .from('source_events')
          .select('occurred_at')
          .eq('repo', repo)
          .order('occurred_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ),
    );
    const out: { [repo: string]: string } = {};
    repos.forEach((repo, i) => {
      const at = (rows[i].data as { occurred_at: string } | null)?.occurred_at;
      if (at) out[repo] = at;
    });
    return out;
  }

  async since(from: string, linked: boolean, limit: number): Promise<Item[]> {
    const rows = must(
      await this.db
        .from('source_events')
        .select(linked ? `${cols},post_events!inner(post_id)` : cols)
        .gte('occurred_at', from)
        .order('occurred_at', { ascending: false })
        .limit(limit),
    ) as unknown as Row[];
    return rows.map(item);
  }

  async remove(id: string): Promise<void> {
    must(await this.db.from('post_events').delete().eq('event_id', id));
    must(await this.db.from('source_events').delete().eq('id', id));
  }
}

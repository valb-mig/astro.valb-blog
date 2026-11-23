import type { Catalog as Port, Seed, Tracked } from '@/core/ingest/port';
import type { Health, Languages } from '@/core/project/project';
import { defined, must, type Db } from './client';

type Row = {
  id: string;
  repo: string | null;
  uptime_url: string | null;
  ingest_private: boolean;
  mention_allowed: boolean;
};

export class Catalog implements Port {
  constructor(private db: Db) {}

  async tracked(): Promise<Tracked[]> {
    const rows = must(
      await this.db.from('projects').select('id,repo,uptime_url,ingest_private,mention_allowed'),
    ) as Row[];
    return rows.map((r) => ({
      id: r.id,
      repo: r.repo,
      uptimeUrl: r.uptime_url,
      private: r.ingest_private,
      mention: r.mention_allowed,
    }));
  }

  async taken(slug: string): Promise<boolean> {
    return !!must(await this.db.from('projects').select('id').eq('slug', slug).maybeSingle());
  }

  async seed(seed: Seed): Promise<void> {
    must(await this.db.from('projects').insert({ ...seed, draft: false }));
  }

  async languages(id: string, languages: Languages): Promise<void> {
    must(await this.db.from('projects').update({ languages }).eq('id', id));
  }

  async health(id: string, h: Partial<Health>): Promise<void> {
    const patch = defined({
      ci_status: h.ci,
      ci_checked_at: h.ciAt,
      latest_release: h.release,
      latest_release_at: h.releaseAt,
      last_status_code: h.code,
      last_uptime_check_at: h.codeAt,
      deploy_status: h.deploy,
      deploy_status_at: h.deployAt,
    });
    must(await this.db.from('projects').update(patch).eq('id', id));
  }

  async ids(repos: string[]): Promise<string[]> {
    return (must(await this.db.from('projects').select('id').in('repo', repos)) as { id: string }[]).map((r) => r.id);
  }
}

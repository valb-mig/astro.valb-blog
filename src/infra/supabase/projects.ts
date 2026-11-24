import type { Projects as Port, Query } from '@/core/project/port';
import type {
  Card,
  Deploy,
  Health,
  Image,
  Input,
  Key,
  Languages,
  Project,
  Repo,
  Status,
  Summary,
} from '@/core/project/project';
import { url } from './bucket';
import { counted, defined, must, type Db } from './client';

const brief = 'id,slug,title,description,date,tags,status,repo,draft,languages,images';

const card =
  'id,slug,title,languages,draft,repo,uptime_url,ci_status,ci_checked_at,latest_release,latest_release_at,last_status_code,last_uptime_check_at,deploy_status,deploy_status_at';

type Row = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  content: string | null;
  date: string;
  tags: string[] | null;
  status: Status;
  repo: string | null;
  draft: boolean;
  parent_project_id: string | null;
  languages: Languages | null;
  images: string[] | null;
  ingest_private: boolean;
  mention_allowed: boolean;
  uptime_url: string | null;
  status_token: string | null;
  ci_status: string | null;
  ci_checked_at: string | null;
  latest_release: string | null;
  latest_release_at: string | null;
  last_status_code: number | null;
  last_uptime_check_at: string | null;
  deploy_status: Deploy | null;
  deploy_status_at: string | null;
  created_at: string;
  updated_at: string;
};

const health = (r: Partial<Row>): Health => ({
  ci: r.ci_status ?? null,
  ciAt: r.ci_checked_at ?? null,
  release: r.latest_release ?? null,
  releaseAt: r.latest_release_at ?? null,
  code: r.last_status_code ?? null,
  codeAt: r.last_uptime_check_at ?? null,
  deploy: r.deploy_status ?? null,
  deployAt: r.deploy_status_at ?? null,
});

const base = (r: Row, images: Image[]): Omit<Summary, 'posts'> => ({
  id: r.id,
  slug: r.slug,
  title: r.title,
  description: r.description ?? '',
  date: r.date,
  tags: r.tags ?? [],
  status: r.status,
  repo: r.repo,
  draft: r.draft,
  languages: r.languages,
  images,
});

const project = (r: Row, images: Image[]): Project => ({
  ...base(r, images),
  content: r.content ?? '',
  parentId: r.parent_project_id,
  private: r.ingest_private,
  mention: r.mention_allowed,
  uptimeUrl: r.uptime_url,
  token: r.status_token,
  health: health(r),
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const row = (i: Partial<Input>) =>
  defined({
    slug: i.slug,
    title: i.title,
    description: i.description,
    content: i.content,
    date: i.date,
    tags: i.tags,
    status: i.status,
    repo: i.repo,
    draft: i.draft,
    parent_project_id: i.parentId,
    ingest_private: i.private,
    mention_allowed: i.mention,
    uptime_url: i.uptimeUrl,
    status_token: i.token,
  });

export class Projects implements Port {
  constructor(private db: Db) {}

  private images(r: Pick<Row, 'images'>): Image[] {
    return (r.images ?? []).map((path) => ({ path, url: url(this.db, path) }));
  }

  async list({ drafts, status, limit }: Query): Promise<Summary[]> {
    let q = this.db.from('projects').select(brief).order('date', { ascending: false });
    if (!drafts) q = q.eq('draft', false);
    if (status) q = q.eq('status', status);
    const [rows, counts] = await Promise.all([
      must(await (limit ? q.limit(limit) : q)) as Row[],
      this.counts(),
    ]);
    return rows.map((r) => ({ ...base(r, this.images(r)), posts: counts.get(r.id) ?? 0 }));
  }

  async find(key: Key, drafts: boolean): Promise<Project | null> {
    let q = this.db.from('projects').select('*');
    q = 'id' in key ? q.eq('id', key.id) : q.eq('slug', key.slug);
    if (!drafts) q = q.eq('draft', false);
    const r = must(await q.maybeSingle()) as Row | null;
    return r ? project(r, this.images(r)) : null;
  }

  async cards(drafts: boolean): Promise<Card[]> {
    let q = this.db.from('projects').select(card).order('title', { ascending: true });
    if (!drafts) q = q.eq('draft', false);
    return (must(await q) as Row[]).map((r) => ({
      id: r.id,
      slug: r.slug,
      title: r.title,
      languages: r.languages,
      draft: r.draft,
      repo: r.repo,
      uptimeUrl: r.uptime_url,
      health: health(r),
    }));
  }

  async repos(): Promise<Repo[]> {
    const rows = must(
      await this.db
        .from('projects')
        .select('id,title,repo,mention_allowed,ingest_private')
        .not('repo', 'is', null)
        .order('repo', { ascending: true }),
    ) as Row[];
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      repo: r.repo,
      mention: r.mention_allowed,
      private: r.ingest_private,
    }));
  }

  async create(input: Input): Promise<Project> {
    const r = must(await this.db.from('projects').insert(row(input)).select().single()) as Row;
    return project(r, this.images(r));
  }

  async update(id: string, input: Partial<Input>): Promise<Project> {
    const r = must(await this.db.from('projects').update(row(input)).eq('id', id).select().single()) as Row;
    return project(r, this.images(r));
  }

  async remove(id: string): Promise<void> {
    must(await this.db.from('projects').delete().eq('id', id));
  }

  async token(id: string): Promise<string | null> {
    const r = must(await this.db.from('projects').select('status_token').eq('id', id).maybeSingle()) as Row | null;
    return r?.status_token ?? null;
  }

  async report(id: string, deploy: Deploy): Promise<void> {
    must(
      await this.db
        .from('projects')
        .update({ deploy_status: deploy, deploy_status_at: new Date().toISOString() })
        .eq('id', id),
    );
  }

  async count(): Promise<number> {
    return counted(await this.db.from('projects').select('*', { count: 'exact', head: true }));
  }

  async paths(id: string): Promise<string[] | null> {
    const r = must(await this.db.from('projects').select('images').eq('id', id).maybeSingle()) as Pick<Row, 'images'> | null;
    return r ? (r.images ?? []) : null;
  }

  async gallery(id: string, paths: string[]): Promise<Image[]> {
    const r = must(await this.db.from('projects').update({ images: paths }).eq('id', id).select('images').single()) as Pick<Row, 'images'>;
    return this.images(r);
  }

  private async counts(): Promise<Map<string, number>> {
    const rows = must(
      await this.db.from('post_projects').select('project_id, posts!inner(draft)').eq('posts.draft', false),
    ) as { project_id: string }[];
    const map = new Map<string, number>();
    for (const r of rows) map.set(r.project_id, (map.get(r.project_id) ?? 0) + 1);
    return map;
  }
}

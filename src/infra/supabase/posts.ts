import type { Drafts } from '@/core/ingest/port';
import type { Posts as Port, Query } from '@/core/post/port';
import { byDate, type Data, type Key, type Post, type Ref, type Summary } from '@/core/post/post';
import { counted, defined, must, type Db } from './client';

const brief = 'id,slug,title,description,date,tags,draft,reading_time';

type Row = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  date: string;
  tags: string[] | null;
  draft: boolean;
  reading_time: number;
  content?: string;
  created_at?: string;
  updated_at?: string;
};

const summary = (r: Row, projects: Ref[]): Summary => ({
  id: r.id,
  slug: r.slug,
  title: r.title,
  description: r.description ?? '',
  date: r.date,
  tags: r.tags ?? [],
  draft: r.draft,
  readingTime: r.reading_time,
  projects,
});

const post = (r: Row, projects: Ref[]): Post => ({
  ...summary(r, projects),
  content: r.content ?? '',
  createdAt: r.created_at ?? '',
  updatedAt: r.updated_at ?? '',
});

const row = (d: Partial<Data>) =>
  defined({
    slug: d.slug,
    title: d.title,
    description: d.description,
    content: d.content,
    date: d.date,
    tags: d.tags,
    draft: d.draft,
    reading_time: d.readingTime,
  });

export class Posts implements Port, Drafts {
  constructor(private db: Db) {}

  async list(q: Query): Promise<Summary[]> {
    const [rows, refs] = await Promise.all([this.rows(q), this.refs()]);
    return rows.map((r) => summary(r, refs.get(r.id) ?? []));
  }

  async find(key: Key, drafts: boolean): Promise<Post | null> {
    let q = this.db.from('posts').select('*');
    q = 'id' in key ? q.eq('id', key.id) : q.eq('slug', key.slug);
    if (!drafts) q = q.eq('draft', false);
    const r = must(await q.maybeSingle()) as Row | null;
    if (!r) return null;

    const links = must(
      await this.db.from('post_projects').select('projects(id, slug, title)').eq('post_id', r.id),
    ) as unknown as { projects: Ref | null }[];
    return post(
      r,
      links.flatMap((l) => (l.projects ? [l.projects] : [])),
    );
  }

  async slugs(prefix: string, drafts: boolean): Promise<string[]> {
    let q = this.db.from('posts').select('slug').like('slug', `${prefix}%`);
    if (!drafts) q = q.eq('draft', false);
    return (must(await q) as { slug: string }[]).map((r) => r.slug);
  }

  async create(data: Data): Promise<Post> {
    const r = must(await this.db.from('posts').insert(row(data)).select().single()) as Row;
    return post(r, []);
  }

  async update(id: string, data: Partial<Data>): Promise<Post> {
    must(await this.db.from('posts').update(row(data)).eq('id', id).select().single());
    return (await this.find({ id }, true)) as Post;
  }

  async open(slug: string, title: string, description: string): Promise<string> {
    const r = must(
      await this.db
        .from('posts')
        .insert({ slug, title, description, content: '', draft: true, tags: ['activity'], reading_time: 1 })
        .select('id')
        .single(),
    ) as { id: string };
    return r.id;
  }

  async remove(id: string): Promise<void> {
    must(await this.db.from('posts').delete().eq('id', id));
  }

  async link(id: string, projects: string[]): Promise<void> {
    must(await this.db.from('post_projects').delete().eq('post_id', id));
    if (projects.length) {
      must(await this.db.from('post_projects').insert(projects.map((project_id) => ({ post_id: id, project_id }))));
    }
  }

  async count(): Promise<number> {
    return counted(await this.db.from('posts').select('*', { count: 'exact', head: true }));
  }

  private async rows({ drafts, limit, projects }: Query): Promise<Row[]> {
    if (projects) {
      if (!projects.length) return [];
      let q = this.db.from('post_projects').select(`posts!inner(${brief})`).in('project_id', projects);
      if (!drafts) q = q.eq('posts.draft', false);
      const rows = must(await q) as unknown as { posts: Row }[];
      return [...new Map(rows.map((r) => [r.posts.id, r.posts])).values()].sort(byDate).slice(0, limit);
    }

    let q = this.db.from('posts').select(brief).order('date', { ascending: false });
    if (!drafts) q = q.eq('draft', false);
    return must(await (limit ? q.limit(limit) : q)) as Row[];
  }

  private async refs(): Promise<Map<string, Ref[]>> {
    const rows = must(
      await this.db.from('post_projects').select('post_id, projects(id, slug, title)'),
    ) as unknown as { post_id: string; projects: Ref | null }[];

    const map = new Map<string, Ref[]>();
    for (const r of rows) if (r.projects) map.set(r.post_id, [...(map.get(r.post_id) ?? []), r.projects]);
    return map;
  }
}

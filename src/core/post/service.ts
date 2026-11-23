import * as activity from '../activity';
import { Fault } from '../error';
import type { Service as Updates } from '../update/service';
import type { Posts, Query } from './port';
import { byDate, readingTime, type Input, type Key, type Post, type Data, type Summary } from './post';

export type Related = {
  all: Summary[];
  byProject: { [project: string]: Summary[] };
};

export class Service {
  constructor(
    private posts: Posts,
    private updates: Updates,
  ) {}

  list(q: Query): Promise<Summary[]> {
    return this.posts.list(q);
  }

  find(key: Key, drafts: boolean): Promise<Post | null> {
    return this.posts.find(key, drafts);
  }

  async get(key: Key, drafts: boolean): Promise<Post> {
    const post = await this.posts.find(key, drafts);
    if (!post) throw new Fault('missing', 'Not found');
    return post;
  }

  async related(post: Post): Promise<Related> {
    const ids = post.projects.map((p) => p.id);
    if (!ids.length) return { all: [], byProject: {} };

    const siblings = (await this.posts.list({ drafts: false, projects: ids }))
      .filter((s) => s.id !== post.id)
      .sort(byDate);

    const byProject: Related['byProject'] = {};
    for (const s of siblings) {
      for (const p of s.projects) if (ids.includes(p.id)) (byProject[p.id] ??= []).push(s);
    }
    return { all: siblings, byProject };
  }

  async days(drafts: boolean): Promise<Set<string>> {
    return new Set((await this.posts.slugs(activity.prefix, drafts)).map(activity.day));
  }

  async create(input: Input, projects: string[] = []): Promise<Post> {
    const post = await this.posts.create(data(input));
    if (projects.length) await this.posts.link(post.id, projects);
    if (!post.draft) await this.updates.announce('post', `Novo post: ${post.title}`, `/posts/${post.slug}`);
    return post;
  }

  async update(id: string, input: Partial<Input>, projects?: string[]): Promise<Post> {
    const post = await this.posts.update(id, data(input));
    if (projects) await this.posts.link(id, projects);
    return post;
  }

  remove(id: string): Promise<void> {
    return this.posts.remove(id);
  }

  count(): Promise<number> {
    return this.posts.count();
  }
}

function data(input: Input): Data;
function data(input: Partial<Input>): Partial<Data>;
function data(input: Partial<Input>): Partial<Data> {
  return input.content === undefined ? input : { ...input, readingTime: readingTime(input.content) };
}

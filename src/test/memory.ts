import type { Events } from '@/core/event/port';
import type { Item } from '@/core/event/event';
import type { Hub, Repo } from '@/core/ingest/hub';
import type { Posts, Query as PostQuery } from '@/core/post/port';
import type { Data, Key as PostKey, Post, Ref } from '@/core/post/post';
import type { Projects } from '@/core/project/port';
import type { Card, Deploy, Input, Project, Summary } from '@/core/project/project';
import type { Emoji } from '@/core/reaction/emoji';
import type { Reactions } from '@/core/reaction/port';
import type { Settings } from '@/core/setting/port';
import type { Updates } from '@/core/update/port';
import type { Input as UpdateInput, Update } from '@/core/update/update';

let seq = 0;
const id = () => `id-${++seq}`;

const match = (key: PostKey, v: { id: string; slug: string }) => ('id' in key ? v.id === key.id : v.slug === key.slug);

export class MemoryUpdates implements Updates {
  items: Update[] = [];
  async latest() {
    return this.items.at(-1) ?? null;
  }
  async page(size: number) {
    return this.items.slice(-size).reverse();
  }
  async create(input: UpdateInput) {
    const u = { ...input, id: id(), createdAt: new Date().toISOString() };
    this.items.push(u);
    return u;
  }
  async remove(target: string) {
    this.items = this.items.filter((u) => u.id !== target);
  }
}

export class MemoryPosts implements Posts {
  items: Post[] = [];
  links = new Map<string, string[]>();
  refs: Ref[] = [];

  private withRefs(p: Post): Post {
    const ids = this.links.get(p.id) ?? [];
    return { ...p, projects: this.refs.filter((r) => ids.includes(r.id)) };
  }

  async list(q: PostQuery) {
    return this.items
      .filter((p) => q.drafts || !p.draft)
      .map((p) => this.withRefs(p))
      .filter((p) => !q.projects || p.projects.some((r) => q.projects!.includes(r.id)))
      .slice(0, q.limit);
  }
  async find(key: PostKey, drafts: boolean) {
    const p = this.items.find((i) => match(key, i) && (drafts || !i.draft));
    return p ? this.withRefs(p) : null;
  }
  async slugs(prefix: string, drafts: boolean) {
    return this.items.filter((p) => p.slug.startsWith(prefix) && (drafts || !p.draft)).map((p) => p.slug);
  }
  async create(data: Data) {
    const p: Post = { ...data, id: id(), projects: [], createdAt: '', updatedAt: '' };
    this.items.push(p);
    return p;
  }
  async update(target: string, data: Partial<Data>) {
    const i = this.items.findIndex((p) => p.id === target);
    this.items[i] = { ...this.items[i], ...data };
    return this.withRefs(this.items[i]);
  }
  async remove(target: string) {
    this.items = this.items.filter((p) => p.id !== target);
  }
  async link(target: string, projects: string[]) {
    this.links.set(target, projects);
  }
  async count() {
    return this.items.length;
  }
}

export class MemoryProjects implements Projects {
  items: Project[] = [];
  cardsList: Card[] = [];
  reports = new Map<string, Deploy>();

  async list() {
    return this.items.map((p): Summary => ({ ...p, posts: 0 }));
  }
  async find(key: PostKey, drafts: boolean) {
    return this.items.find((p) => match(key, p) && (drafts || !p.draft)) ?? null;
  }
  async cards() {
    return this.cardsList;
  }
  async repos() {
    return [];
  }
  async create(input: Input) {
    const p = { ...input, id: id() } as Project;
    this.items.push(p);
    return p;
  }
  async update(target: string, input: Partial<Input>) {
    const i = this.items.findIndex((p) => p.id === target);
    this.items[i] = { ...this.items[i], ...input };
    return this.items[i];
  }
  async remove(target: string) {
    this.items = this.items.filter((p) => p.id !== target);
  }
  async token(target: string) {
    return this.items.find((p) => p.id === target)?.token ?? null;
  }
  async report(target: string, deploy: Deploy) {
    this.reports.set(target, deploy);
  }
  async count() {
    return this.items.length;
  }
}

export class MemoryEvents implements Events {
  items: Item[] = [];
  linked = new Set<string>();
  queries: unknown[] = [];

  async feed(q: { page: number; size: number; repo?: string; linked: boolean }) {
    this.queries.push(q);
    const all = this.items.filter((e) => (!q.repo || e.repo === q.repo) && (!q.linked || this.linked.has(e.id)));
    const from = (q.page - 1) * q.size;
    return { items: all.slice(from, from + q.size), total: all.length };
  }
  async recent(repo: string, limit: number) {
    return this.items.filter((e) => e.repo === repo).slice(0, limit);
  }
  async last(repos: string[]) {
    const out: { [repo: string]: string } = {};
    for (const e of this.items) if (repos.includes(e.repo) && (!out[e.repo] || e.at > out[e.repo])) out[e.repo] = e.at;
    return out;
  }
  async remove(target: string) {
    this.items = this.items.filter((e) => e.id !== target);
  }
}

export class MemorySettings implements Settings {
  values = new Map<string, string>();
  async get(key: string) {
    return this.values.get(key) ?? null;
  }
  async all() {
    return Object.fromEntries(this.values);
  }
  async set(key: string, value: string) {
    this.values.set(key, value);
  }
}

export class MemoryReactions implements Reactions {
  items: { id: string; post: string; emoji: string; fingerprint: string }[] = [];
  async list(post: string) {
    return this.items.filter((r) => r.post === post);
  }
  async find(post: string, emoji: Emoji, fingerprint: string) {
    return this.items.find((r) => r.post === post && r.emoji === emoji && r.fingerprint === fingerprint)?.id ?? null;
  }
  async add(post: string, emoji: Emoji, fingerprint: string) {
    this.items.push({ id: id(), post, emoji, fingerprint });
  }
  async remove(target: string) {
    this.items = this.items.filter((r) => r.id !== target);
  }
  async count(post?: string, emoji?: Emoji) {
    return this.items.filter((r) => (!post || r.post === post) && (!emoji || r.emoji === emoji)).length;
  }
}

export class MemoryHub implements Hub {
  orgs = new Map<string, Repo[]>();
  member: string[] = [];
  async memberships() {
    return this.member;
  }
  async org(login: string) {
    return [...this.orgs.keys()].find((o) => o.toLowerCase() === login.toLowerCase()) ?? null;
  }
  async repos(org: string) {
    return this.orgs.get(org) ?? [];
  }
}

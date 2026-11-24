import type { Event } from '@/core/event/event';
import type { Catalog, Drafts, Fresh, Journal, Ledger, Log, Outcome, Probe, Remote, Seed, Source, Tracked } from '@/core/ingest/port';
import { key } from '@/core/ingest/port';
import type { Llm, Prompt } from '@/core/llm/port';
import type { Health, Languages } from '@/core/project/project';
import type { Tracker } from '@/core/time/port';
import type { Day } from '@/core/time/time';
import type { MemoryPosts } from './memory';

export const remote = (repo: string, over: Partial<Remote> = {}): Remote => ({
  repo,
  name: repo.split('/')[1],
  private: false,
  description: null,
  createdAt: '2025-01-01T00:00:00Z',
  topics: [],
  archived: false,
  fork: false,
  ...over,
});

export const commit = (repo: string, sha: string, title: string, at = '2026-11-20T10:00:00Z'): Fresh => ({
  source: 'github',
  type: 'commit',
  externalId: sha,
  repo,
  url: `https://github.com/${repo}/commit/${sha}`,
  title,
  payload: {},
  at,
});

export class FakeSource implements Source {
  mine: Remote[] = [];
  orgs = new Map<string, Remote[]>();
  mails = ['me@example.com'];
  async owned() {
    return this.mine;
  }
  async org(org: string) {
    return this.orgs.get(org) ?? [];
  }
  async emails() {
    return this.mails;
  }
  async readme() {
    return '# readme';
  }
  async description() {
    return 'a project';
  }
  async languages(): Promise<{ [lang: string]: number }> {
    return { TypeScript: 3, CSS: 1 };
  }
  async ci() {
    return 'success';
  }
  async release() {
    return null;
  }
}

export class FakeLog implements Log {
  commitsBy = new Map<string, Fresh[]>();
  calls: { repo: string; authors?: string[] }[] = [];
  async commits(repo: string, _date: string, authors?: string[]) {
    this.calls.push({ repo, authors });
    return this.commitsBy.get(repo) ?? [];
  }
}

export class FakeProbe implements Probe {
  async code() {
    return 200;
  }
}

export class FakeCatalog implements Catalog {
  items: (Tracked & { slug?: string })[] = [];
  seeds: Seed[] = [];
  langs = new Map<string, Languages>();
  healths = new Map<string, Partial<Health>>();
  async tracked() {
    return this.items;
  }
  async taken(slug: string) {
    return this.items.some((i) => i.slug === slug) || this.seeds.some((s) => s.slug === slug);
  }
  async seed(seed: Seed) {
    this.seeds.push(seed);
    this.items.push({ id: `p-${seed.slug}`, slug: seed.slug, repo: seed.repo, uptimeUrl: null, private: false, mention: true });
  }
  async languages(id: string, languages: Languages) {
    this.langs.set(id, languages);
  }
  async health(id: string, health: Partial<Health>) {
    this.healths.set(id, health);
  }
  async ids(repos: string[]) {
    return this.items.filter((i) => i.repo && repos.includes(i.repo)).map((i) => i.id);
  }
}

export class FakeLedger implements Ledger {
  rows: Event[] = [];
  links = new Map<string, string[]>();
  async known(events: Fresh[]) {
    const keys = new Set(this.rows.map(key));
    return new Set(events.map(key).filter((k) => keys.has(k)));
  }
  async save(events: Fresh[]) {
    for (const e of events) if (!this.rows.some((r) => key(r) === key(e))) this.rows.push({ ...e, id: `e-${this.rows.length + 1}`, createdAt: '' });
    return this.rows.filter((r) => events.some((e) => key(e) === key(r)));
  }
  async attach(post: string, events: string[]) {
    this.links.set(post, [...new Set([...(this.links.get(post) ?? []), ...events])]);
  }
  async of(post: string) {
    const ids = this.links.get(post) ?? [];
    return this.rows.filter((r) => ids.includes(r.id));
  }
}

export class FakeJournal implements Journal {
  runs: { date: string; trigger: string; outcome?: Outcome }[] = [];
  async start(date: string, trigger: string) {
    this.runs.push({ date, trigger });
    return `${this.runs.length - 1}`;
  }
  async finish(id: string, outcome: Outcome) {
    this.runs[Number(id)].outcome = outcome;
  }
}

export class FakeDrafts implements Drafts {
  constructor(private posts: MemoryPosts) {}
  async open(slug: string, title: string, description: string) {
    const p = await this.posts.create({ slug, title, description, content: '', date: '', tags: ['activity'], draft: true, readingTime: 1 });
    return p.id;
  }
}

export class FakeTracker implements Tracker {
  today: Day | null = null;
  async week() {
    return null;
  }
  async day() {
    return this.today;
  }
}

export class FakeLlm implements Llm {
  prompts: Prompt[] = [];
  fellBack = false;
  async complete(p: Prompt) {
    this.prompts.push(p);
    if (!p.json) return 'narrative';
    const repos = Object.keys(JSON.parse(p.user.split('\n').slice(1, -2).join('\n')));
    return JSON.stringify(Object.fromEntries(repos.map((r) => [r, `about ${r}`])));
  }
}

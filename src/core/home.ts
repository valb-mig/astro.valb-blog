import * as activity from './activity';
import type { Item } from './event/event';
import type { Service as Events } from './event/service';
import type { Summary as Post } from './post/post';
import type { Service as Posts } from './post/service';
import type { Pins } from './project/pins';
import type { Summary as Project } from './project/project';
import type { Service as Projects } from './project/service';

const day = 24 * 60 * 60 * 1000;

const shown = 6;

export type Work = { repo: string; commits: number; last: string; project: Project | null };

export type Today = { date: string; slug: string; lead: string };

export type Card = Project & { pinned: boolean; last: string | null };

export type Home = { today: Today | null; work: Work[]; posts: Post[]; projects: Card[] };

const work = (events: Item[], from: string, projects: Project[]): Work[] => {
  const map = new Map<string, Work>();
  for (const e of events) {
    if (e.at < from) continue;
    const w = map.get(e.repo);
    if (w) w.commits++;
    else {
      const project = projects.find((p) => p.repo?.toLowerCase() === e.repo.toLowerCase()) ?? null;
      map.set(e.repo, { repo: e.repo, commits: 1, last: e.at, project });
    }
  }
  return [...map.values()].sort((a, b) => b.last.localeCompare(a.last));
};

const order = (projects: Project[], pins: string[], last: Map<string, string>): Card[] => {
  const seen = (p: Project) => last.get(p.repo?.toLowerCase() ?? '') ?? '';
  const pinned = pins.flatMap((id) => projects.filter((p) => p.id === id)).map((p) => ({ ...p, pinned: true, last: seen(p) || null }));
  const rest = projects
    .filter((p) => p.status === 'active' && !pins.includes(p.id))
    .sort((a, b) => seen(b).localeCompare(seen(a)) || b.date.localeCompare(a.date))
    .map((p) => ({ ...p, pinned: false, last: seen(p) || null }));
  return [...pinned, ...rest].slice(0, Math.max(shown, pinned.length));
};

export class Service {
  constructor(
    private posts: Posts,
    private projects: Projects,
    private events: Events,
    private pins: Pins,
    private now: () => number = Date.now,
  ) {}

  async get(admin: boolean): Promise<Home> {
    const t = this.now();
    const [posts, projects, events, pins, latest] = await Promise.all([
      this.posts.list({ drafts: false, limit: 3 }),
      this.projects.list({ drafts: false }),
      this.events.since(new Date(t - 90 * day).toISOString(), admin),
      this.pins.list(),
      this.posts.latest(false),
    ]);

    const last = new Map<string, string>();
    for (const e of events) if (!last.has(e.repo.toLowerCase())) last.set(e.repo.toLowerCase(), e.at);

    const lead = latest && activity.lead(latest.content);
    return {
      today: latest && lead ? { date: activity.day(latest.slug), slug: latest.slug, lead } : null,
      work: work(events, new Date(t - 7 * day).toISOString(), projects),
      posts,
      projects: order(projects, pins, last),
    };
  }
}

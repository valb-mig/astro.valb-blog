import { Fault } from '../error';
import { days, type Day, type Item } from './event';
import type { Events } from './port';

const size = 40;

export type Feed = { days: Day[]; pages: number };

export class Service {
  constructor(private events: Events) {}

  async feed(page: number, admin: boolean, repo?: string): Promise<Feed> {
    const { items, total } = await this.events.feed({
      page,
      size,
      repo: admin && repo ? repo : undefined,
      linked: !admin,
    });
    return { days: days(items), pages: Math.max(1, Math.ceil(total / size)) };
  }

  recent(repo: string | null): Promise<Item[]> {
    if (!repo) throw new Fault('invalid', 'repo required');
    return this.events.recent(repo, 30);
  }

  last(repos: string[]): Promise<{ [repo: string]: string }> {
    return repos.length ? this.events.last(repos) : Promise.resolve({});
  }

  async seen(admin: boolean, days = 90, now = Date.now()): Promise<Map<string, string>> {
    const items = await this.since(new Date(now - days * 86_400_000).toISOString(), admin);
    const last = new Map<string, string>();
    for (const e of items) if (!last.has(e.repo.toLowerCase())) last.set(e.repo.toLowerCase(), e.at);
    return last;
  }

  since(from: string, admin: boolean, limit = 1000): Promise<Item[]> {
    return this.events.since(from, !admin, limit);
  }

  remove(id: string): Promise<void> {
    return this.events.remove(id);
  }
}

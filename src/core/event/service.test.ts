import { describe, expect, it } from 'vitest';
import { MemoryEvents } from '@/test/memory';
import { days, type Item } from './event';
import { Service } from './service';

const event = (n: number, at: string, repo = 'me/a'): Item => ({ id: `${n}`, type: 'commit', repo, url: '', title: '', at });

describe('event feed', () => {
  it('groups consecutive events by UTC day', () => {
    const out = days([
      event(1, '2026-11-02T23:00:00Z'),
      event(2, '2026-11-02T01:00:00Z'),
      event(3, '2026-11-01T12:00:00Z'),
    ]);
    expect(out.map((d) => [d.day, d.events.length])).toEqual([
      ['2026-11-02', 2],
      ['2026-11-01', 1],
    ]);
  });

  it('shows visitors only linked events and ignores their repo filter', async () => {
    const rows = new MemoryEvents();
    rows.items = [event(1, '2026-11-02T00:00:00Z'), event(2, '2026-11-01T00:00:00Z', 'me/b')];
    rows.linked.add('2');
    const feed = await new Service(rows).feed(1, false, 'me/a');
    expect(feed.days.flatMap((d) => d.events.map((e) => e.id))).toEqual(['2']);
    expect(rows.queries[0]).toMatchObject({ linked: true, repo: undefined });
  });

  it('lets admins filter by repo and see everything', async () => {
    const rows = new MemoryEvents();
    rows.items = [event(1, '2026-11-02T00:00:00Z'), event(2, '2026-11-01T00:00:00Z', 'me/b')];
    const feed = await new Service(rows).feed(1, true, 'me/b');
    expect(feed.days.flatMap((d) => d.events.map((e) => e.id))).toEqual(['2']);
    expect(feed.pages).toBe(1);
  });

  it('requires a repo for recent events', () => {
    expect(() => new Service(new MemoryEvents()).recent(null)).toThrow('repo required');
  });

  it('maps each repo to its latest commit within the window', async () => {
    const rows = new MemoryEvents();
    const now = Date.parse('2026-11-24T00:00:00Z');
    rows.items = [
      event(1, '2026-11-23T00:00:00Z', 'Me/A'),
      event(2, '2026-11-20T00:00:00Z', 'me/a'),
      event(3, '2026-11-10T00:00:00Z', 'me/b'),
      event(4, '2026-01-01T00:00:00Z', 'me/old'),
    ];
    const seen = await new Service(rows).seen(true, 90, now);
    expect([...seen]).toEqual([
      ['me/a', '2026-11-23T00:00:00Z'],
      ['me/b', '2026-11-10T00:00:00Z'],
    ]);
  });
});

import { beforeEach, describe, expect, it } from 'vitest';
import { MemoryEvents, MemoryPosts, MemoryProjects, MemorySettings, MemoryUpdates } from '@/test/memory';
import { Service as Events } from './event/service';
import { Service as Home } from './home';
import { Service as Posts } from './post/service';
import { Pins } from './project/pins';
import type { Project } from './project/project';
import { Service as Projects } from './project/service';
import { Service as Settings } from './setting/service';
import { Service as Updates } from './update/service';

const now = Date.parse('2026-11-24T12:00:00Z');

const project = (id: string, repo: string | null, over: Partial<Project> = {}) =>
  ({ id, slug: id, title: id, repo, status: 'active', draft: false, date: '2026-01-01', ...over }) as Project;

describe('home', () => {
  let posts: MemoryPosts;
  let projects: MemoryProjects;
  let events: MemoryEvents;
  let pins: Pins;
  let home: Home;

  beforeEach(() => {
    posts = new MemoryPosts();
    projects = new MemoryProjects();
    events = new MemoryEvents();
    pins = new Pins(new Settings(new MemorySettings()));
    const updates = new Updates(new MemoryUpdates());
    const eventService = new Events(events);
    home = new Home(
      new Posts(posts, updates),
      new Projects(projects, eventService, updates, (a, b) => a === b),
      eventService,
      pins,
      () => now,
    );
  });

  const commit = (id: string, repo: string, at: string) =>
    events.items.push({ id, type: 'commit', repo, url: '', title: '', at });

  it('lists repos with commits in the last 7 days, newest first, with their project', async () => {
    projects.items = [project('blog', 'me/blog')];
    commit('1', 'me/blog', '2026-11-24T10:00:00Z');
    commit('2', 'me/blog', '2026-11-23T10:00:00Z');
    commit('3', 'org/app', '2026-11-24T11:00:00Z');
    commit('4', 'me/old', '2026-11-01T10:00:00Z');
    events.linked = new Set(['1', '2', '3', '4']);

    const { work } = await home.get(false);
    expect(work.map((w) => [w.repo, w.commits, w.project?.slug ?? null])).toEqual([
      ['org/app', 1, null],
      ['me/blog', 2, 'blog'],
    ]);
  });

  it('hides unlinked commits from visitors but not from the admin', async () => {
    commit('1', 'me/secret', '2026-11-24T10:00:00Z');
    expect((await home.get(false)).work).toEqual([]);
    expect((await home.get(true)).work).toHaveLength(1);
  });

  it('puts pinned projects first in pin order, then active ones by last commit', async () => {
    projects.items = [
      project('a', 'me/a', { date: '2026-11-20' }),
      project('b', 'me/b'),
      project('c', 'me/c'),
      project('done', 'me/done', { status: 'completed' }),
    ];
    commit('1', 'me/b', '2026-11-24T10:00:00Z');
    commit('2', 'me/c', '2026-10-01T10:00:00Z');
    events.linked = new Set(['1', '2']);
    await pins.set('done', true);
    await pins.set('c', true);

    const { projects: cards } = await home.get(false);
    expect(cards.map((c) => [c.id, c.pinned])).toEqual([
      ['done', true],
      ['c', true],
      ['b', false],
      ['a', false],
    ]);
  });

  it('leads with the narrative of the latest activity post', async () => {
    await posts.create({ slug: 'atividade-2026-11-22', title: '', description: '', content: 'old day\n\n---\n\n## x', date: '', tags: [], draft: false, readingTime: 1 });
    await posts.create({ slug: 'atividade-2026-11-23', title: '', description: '', content: 'Fechei o ingest.\n\n---\n\n## me/blog', date: '', tags: [], draft: false, readingTime: 1 });
    await posts.create({ slug: 'atividade-2026-11-24', title: '', description: '', content: '', date: '', tags: [], draft: true, readingTime: 1 });
    expect((await home.get(false)).today).toEqual({ date: '2026-11-23', slug: 'atividade-2026-11-23', lead: 'Fechei o ingest.' });
  });

  it('skips the lead when the post has no narrative', async () => {
    await posts.create({ slug: 'atividade-2026-11-23', title: '', description: '', content: '## me/blog\n\nx', date: '', tags: [], draft: false, readingTime: 1 });
    expect((await home.get(false)).today).toBeNull();
  });
});

describe('pins', () => {
  it('keeps pin order and validates input', async () => {
    const pins = new Pins(new Settings(new MemorySettings()));
    await pins.set('b', true);
    await pins.set('a', true);
    expect(await pins.set('b', true)).toEqual(['a', 'b']);
    expect(await pins.set('a', false)).toEqual(['b']);
    await expect(pins.set('', true)).rejects.toMatchObject({ code: 'invalid' });
  });
});

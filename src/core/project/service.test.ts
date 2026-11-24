import { beforeEach, describe, expect, it } from 'vitest';
import { MemoryEvents, MemoryProjects, MemoryUpdates } from '@/test/memory';
import { Service as Events } from '../event/service';
import { Service as Updates } from '../update/service';
import { split } from './board';
import type { Card, Health, Project } from './project';
import { Service } from './service';

const health = (over: Partial<Health> = {}): Health => ({
  ci: null,
  ciAt: null,
  release: null,
  releaseAt: null,
  code: null,
  codeAt: null,
  deploy: null,
  deployAt: null,
  ...over,
});

const card = (slug: string, over: Partial<Card> = {}, h: Partial<Health> = {}): Card => ({
  id: slug,
  slug,
  title: slug,
  languages: null,
  draft: false,
  repo: null,
  uptimeUrl: null,
  health: health(h),
  ...over,
});

describe('project board', () => {
  it('drops untracked projects, splits web from ci and ranks ci by status', () => {
    const { web, ci } = split([
      card('idle'),
      card('site', { uptimeUrl: 'https://x' }),
      card('deployed', {}, { deploy: { url: 'https://y' } }),
      card('broken', {}, { ci: 'failure' }),
      card('released', {}, { release: 'v1' }),
      card('green', {}, { ci: 'success' }),
      card('queued', {}, { ci: 'queued' }),
    ]);
    expect(web.map((c) => c.slug)).toEqual(['site', 'deployed']);
    expect(ci.map((c) => c.slug)).toEqual(['green', 'queued', 'broken', 'released']);
  });
});

describe('project service', () => {
  let rows: MemoryProjects;
  let events: MemoryEvents;
  let news: MemoryUpdates;
  let projects: Service;

  beforeEach(() => {
    rows = new MemoryProjects();
    events = new MemoryEvents();
    news = new MemoryUpdates();
    projects = new Service(rows, new Events(events), new Updates(news), (a, b) => a === b);
  });

  it('attaches last commit per tracked repo to the board', async () => {
    rows.cardsList = [card('a', { repo: 'me/a' }, { ci: 'success' }), card('b', { repo: 'me/b' })];
    events.items = [
      { id: '1', type: 'commit', repo: 'me/a', url: '', title: '', at: '2026-11-01T10:00:00Z' },
      { id: '2', type: 'commit', repo: 'me/a', url: '', title: '', at: '2026-11-02T10:00:00Z' },
      { id: '3', type: 'commit', repo: 'me/b', url: '', title: '', at: '2026-11-03T10:00:00Z' },
    ];
    expect((await projects.board(false)).last).toEqual({ 'me/a': '2026-11-02T10:00:00Z' });
  });

  it('announces only published projects', async () => {
    await projects.create({ slug: 'x', title: 'X', draft: true } as Project);
    await projects.create({ slug: 'y', title: 'Y', draft: false } as Project);
    expect(news.items.map((u) => u.url)).toEqual(['/projects/y']);
  });

  it('accepts deploy reports only with the project token and an object payload', async () => {
    rows.items = [{ id: 'p', token: 'secret' } as Project];
    await expect(projects.report('p', '', {})).rejects.toMatchObject({ code: 'denied' });
    await expect(projects.report('p', 'wrong', {})).rejects.toMatchObject({ code: 'denied' });
    await expect(projects.report('p', 'secret', [1])).rejects.toMatchObject({ code: 'invalid' });
    await projects.report('p', 'secret', { version: '1.0' });
    expect(rows.reports.get('p')).toEqual({ version: '1.0' });
  });

  it('names the org of repos the user does not own', () => {
    const withUser = new Service(rows, new Events(events), new Updates(news), (a, b) => a === b, 'Me');
    expect(withUser.org('mindblow-org/site')).toBe('mindblow-org');
    expect(withUser.org('me/blog')).toBeNull();
    expect(withUser.org(null)).toBeNull();
    expect(projects.org('mindblow-org/site')).toBeNull();
  });
});

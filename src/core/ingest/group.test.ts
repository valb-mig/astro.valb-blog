import { describe, expect, it } from 'vitest';
import type { Event } from '../event/event';
import { counts, dedupe, group } from './group';

const event = (over: Partial<Event>): Event => ({
  id: '1',
  source: 'github',
  type: 'commit',
  externalId: 'x',
  repo: 'me/a',
  url: '',
  title: '',
  payload: {},
  at: '',
  createdAt: '',
  ...over,
});

describe('ingest grouping', () => {
  it('drops merge commits already covered by a merged PR', () => {
    const merge = event({ title: 'Merge pull request #7 from me/branch' });
    const pr = event({ type: 'pull_request', externalId: '7', payload: { merged: true } });
    const other = event({ title: 'Merge pull request #8 from me/x' });
    expect(dedupe([merge, pr, other])).toEqual([pr, other]);
  });

  it('groups by repo, busiest first, counting conventional types', () => {
    const groups = group([
      event({ repo: 'me/a', title: 'feat: one' }),
      event({ repo: 'me/b', title: 'fix(x): two' }),
      event({ repo: 'me/b', title: 'whatever' }),
      event({ repo: 'me/b', type: 'release', title: 'v1' }),
    ]);
    expect(groups.map((g) => g.repo)).toEqual(['me/b', 'me/a']);
    expect(groups[0].types).toEqual({ fix: 1, other: 1 });
    expect(counts({ chore: 1, feat: 2, wip: 1, other: 2 })).toBe('2 feat, 1 chore, 3 outros');
  });
});

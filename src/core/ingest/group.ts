import type { Event } from '../event/event';

const conventional = /^(\w+)(\([^)]*\))?:\s*(.+)$/;

const mergeCommit = /^Merge pull request #(\d+)/;

const order = ['feat', 'fix', 'docs', 'refactor', 'perf', 'test', 'build', 'ci', 'style', 'chore'];

export type Group = {
  repo: string;
  types: { [type: string]: number };
  commits: Event[];
  issues: Event[];
  releases: Event[];
  prs: Event[];
};

export const parse = (title: string) => {
  const m = title.match(conventional);
  return m ? { type: m[1].toLowerCase(), text: m[3] } : null;
};

export const merged = (e: Event) => !!(e.payload as { merged?: boolean } | null)?.merged;

export const dedupe = (events: Event[]) =>
  events.filter((e) => {
    if (e.type !== 'commit') return true;
    const pr = e.title.match(mergeCommit)?.[1];
    return !pr || !events.some((o) => o.type === 'pull_request' && o.repo === e.repo && o.externalId === pr && merged(o));
  });

const size = (g: Group) => g.commits.length + g.issues.length + g.releases.length + g.prs.length;

export const group = (events: Event[]): Group[] => {
  const map = new Map<string, Group>();
  for (const e of events) {
    const g = map.get(e.repo) ?? { repo: e.repo, types: {}, commits: [], issues: [], releases: [], prs: [] };
    map.set(e.repo, g);
    if (e.type === 'commit') {
      const type = parse(e.title)?.type ?? 'other';
      g.types[type] = (g.types[type] ?? 0) + 1;
      g.commits.push(e);
    } else if (e.type === 'issue') g.issues.push(e);
    else if (e.type === 'release') g.releases.push(e);
    else g.prs.push(e);
  }
  return [...map.values()].sort((a, b) => size(b) - size(a));
};

export const counts = (types: Group['types']) => {
  const parts = order.filter((t) => types[t]).map((t) => `${types[t]} ${t}`);
  const rest = Object.entries(types)
    .filter(([t]) => !order.includes(t))
    .reduce((sum, [, n]) => sum + n, 0);
  if (rest) parts.push(`${rest} outros`);
  return parts.join(', ');
};

export const titles = (g: Group) => [
  ...g.releases.map((r) => `release ${r.title}`),
  ...g.prs.filter(merged).map((pr) => `PR merged: ${pr.title}`),
];

import type { Day } from '../time/time';
import { merged, type Group } from './group';

const rule = '\n\n---\n\n';

export const blurb = 'Resumo automático da atividade do dia.';

export const title = (date: string) => `Atividade — ${new Date(`${date}T12:00:00.000Z`).toLocaleDateString('pt-BR')}`;

const details = (groups: Group[]) => {
  const total = groups.reduce((sum, g) => sum + g.commits.length, 0);
  if (!total) return '';
  const sections = groups
    .filter((g) => g.commits.length)
    .map((g) => `**${g.repo}**\n\n${g.commits.map((c) => `- [${c.title}](${c.url})`).join('\n')}`)
    .join('\n\n');
  return `<details>\n<summary>${total} commit${total > 1 ? 's' : ''}</summary>\n\n${sections}\n\n</details>`;
};

const section = (g: Group, narrative: string | undefined) => {
  const parts = [`## ${g.repo}`];
  if (narrative) parts.push(narrative);
  if (g.releases.length) parts.push(`### releases\n${g.releases.map((r) => `- 🚀 [${r.title}](${r.url})`).join('\n')}`);
  if (g.prs.length) {
    parts.push(`### PRs\n${g.prs.map((pr) => `- ${merged(pr) ? 'merged' : 'aberta'}: [${pr.title}](${pr.url})`).join('\n')}`);
  }
  if (g.issues.length) parts.push(`### issues\n${g.issues.map((i) => `- [${i.title}](${i.url})`).join('\n')}`);
  return parts.join('\n\n');
};

export const commits = (narrative: string, groups: Group[], narratives: { [repo: string]: string }) =>
  [narrative, groups.map((g) => section(g, narratives[g.repo])).join('\n\n'), details(groups)].filter(Boolean).join(rule);

export const time = (narrative: string, d: Day) => {
  const langs = d.languages.map((l) => `- ${l.name}: ${l.text} (${l.percent.toFixed(1)}%)`).join('\n');
  const block = d.languages.length
    ? `<details>\n<summary>Estatísticas do dia — ${d.total}</summary>\n\n${langs}\n\n</details>`
    : '';
  return [narrative, block].filter(Boolean).join(rule);
};

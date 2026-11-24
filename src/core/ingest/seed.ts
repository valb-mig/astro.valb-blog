import type { Languages } from '../project/project';
import type { Catalog, Remote } from './port';

export const slugify = (name: string) =>
  name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export const share = (bytes: { [lang: string]: number }): Languages | null => {
  const total = Object.values(bytes).reduce((sum, b) => sum + b, 0);
  if (!total) return null;
  return Object.fromEntries(Object.entries(bytes).map(([lang, b]) => [lang, Math.round((b / total) * 1000) / 10]));
};

export class Seeder {
  constructor(
    private catalog: Catalog,
    private now: () => string = () => new Date().toISOString(),
  ) {}

  async has(repo: string): Promise<boolean> {
    return (await this.catalog.tracked()).some((t) => t.repo?.toLowerCase() === repo.toLowerCase());
  }

  async seed(r: Remote, readme: string, languages: Languages | null = null): Promise<string> {
    const slug = await this.slug(r.name);
    await this.catalog.seed({
      slug,
      title: r.name,
      description: r.description ?? '',
      content: readme,
      date: r.createdAt ?? this.now(),
      tags: r.topics,
      status: r.archived ? 'archived' : 'active',
      repo: r.repo,
      languages,
    });
    return slug;
  }

  private async slug(name: string): Promise<string> {
    const base = slugify(name);
    let slug = base;
    for (let n = 2; await this.catalog.taken(slug); n++) slug = `${base}-${n}`;
    return slug;
  }
}

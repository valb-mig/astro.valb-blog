import type { Catalog, Remote } from './port';

export const slugify = (name: string) =>
  name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export class Seeder {
  constructor(
    private catalog: Catalog,
    private now: () => string = () => new Date().toISOString(),
  ) {}

  async has(repo: string): Promise<boolean> {
    return (await this.catalog.tracked()).some((t) => t.repo?.toLowerCase() === repo.toLowerCase());
  }

  async seed(r: Remote, readme: string): Promise<string> {
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

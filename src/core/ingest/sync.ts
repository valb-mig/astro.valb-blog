import type { Health } from '../project/project';
import type { Catalog, Probe, Remote, Source, Tracked } from './port';

const reason = (err: unknown) => (err instanceof Error ? err.message : String(err));

export const slugify = (name: string) =>
  name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export class Sync {
  constructor(
    private source: Source,
    private catalog: Catalog,
    private probe: Probe,
    private now: () => string = () => new Date().toISOString(),
  ) {}

  async projects(remotes: Remote[]): Promise<void> {
    const open = remotes.filter((r) => !r.private);
    if (!open.length) return;

    const known = new Set((await this.catalog.tracked()).flatMap((t) => (t.repo ? [t.repo] : [])));
    const fresh = open.filter((r) => !known.has(r.repo));
    if (!fresh.length) {
      console.log('No new GitHub projects to sync.');
      return;
    }

    for (const r of fresh) {
      try {
        await this.catalog.seed({
          slug: await this.slug(r.name),
          title: r.name,
          description: r.description ?? '',
          content: await this.source.readme(r.repo),
          date: r.createdAt ?? this.now(),
          tags: r.topics,
          status: r.archived ? 'archived' : 'active',
          repo: r.repo,
        });
      } catch (err) {
        console.warn(`Project seed failed for ${r.repo}:`, reason(err));
      }
    }
    console.log(`${fresh.length} new project(s) synced from GitHub.`);
  }

  async languages(tracked: Tracked[]): Promise<void> {
    const repos = tracked.filter((t) => t.repo);
    let done = 0;
    for (const t of repos) {
      try {
        const bytes = await this.source.languages(t.repo!);
        const total = Object.values(bytes).reduce((sum, b) => sum + b, 0);
        if (!total) continue;
        await this.catalog.languages(
          t.id,
          Object.fromEntries(Object.entries(bytes).map(([lang, b]) => [lang, Math.round((b / total) * 1000) / 10])),
        );
        done++;
      } catch (err) {
        console.warn(`Languages failed for ${t.repo}:`, reason(err));
      }
    }
    console.log(`Languages updated on ${done}/${repos.length} project(s).`);
  }

  async health(tracked: Tracked[]): Promise<void> {
    let done = 0;
    for (const t of tracked) {
      const patch: Partial<Health> = {};

      if (t.repo) {
        try {
          const ci = await this.source.ci(t.repo);
          if (ci) Object.assign(patch, { ci, ciAt: this.now() });
        } catch (err) {
          console.warn(`CI status failed for ${t.repo}:`, reason(err));
        }
        try {
          const release = await this.source.release(t.repo);
          if (release) Object.assign(patch, { release: release.tag, releaseAt: release.at });
        } catch (err) {
          console.warn(`Releases failed for ${t.repo}:`, reason(err));
        }
      }

      if (t.uptimeUrl) Object.assign(patch, { code: await this.probe.code(t.uptimeUrl), codeAt: this.now() });

      if (!Object.keys(patch).length) continue;
      try {
        await this.catalog.health(t.id, patch);
        done++;
      } catch (err) {
        console.warn(`Health save failed for ${t.repo ?? t.id}:`, reason(err));
      }
    }
    console.log(`Health updated on ${done}/${tracked.length} project(s).`);
  }

  private async slug(name: string): Promise<string> {
    const base = slugify(name);
    let slug = base;
    for (let n = 2; await this.catalog.taken(slug); n++) slug = `${base}-${n}`;
    return slug;
  }
}

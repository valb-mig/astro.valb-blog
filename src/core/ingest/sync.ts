import type { Health } from '../project/project';
import type { Catalog, Probe, Remote, Source, Tracked } from './port';
import { Seeder, share } from './seed';

const reason = (err: unknown) => (err instanceof Error ? err.message : String(err));

export class Sync {
  private seeder: Seeder;

  constructor(
    private source: Source,
    private catalog: Catalog,
    private probe: Probe,
    private now: () => string = () => new Date().toISOString(),
  ) {
    this.seeder = new Seeder(catalog, now);
  }

  async projects(remotes: Remote[]): Promise<void> {
    const open = remotes.filter((r) => !r.private && !r.fork);
    if (!open.length) return;

    const known = new Set((await this.catalog.tracked()).flatMap((t) => (t.repo ? [t.repo] : [])));
    const fresh = open.filter((r) => !known.has(r.repo));
    if (!fresh.length) {
      console.log('No new GitHub projects to sync.');
      return;
    }

    for (const r of fresh) {
      try {
        await this.seeder.seed(r, await this.source.readme(r.repo));
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
        const languages = share(await this.source.languages(t.repo!));
        if (!languages) continue;
        await this.catalog.languages(t.id, languages);
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
}

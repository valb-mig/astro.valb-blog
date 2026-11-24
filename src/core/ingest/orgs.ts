import { Fault } from '../error';
import type { Service as Settings } from '../setting/service';
import type { Hub, Repo } from './hub';
import type { Catalog } from './port';
import { Seeder } from './seed';

export const keys = { orgs: 'ingest_orgs', repos: 'ingest_org_repos' } as const;

export const missing = 'GH_READ_TOKEN não configurado';

const login = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;

const repoName = /^[^/\s]+\/[^/\s]+$/;

export const owner = (repo: string) => repo.split('/')[0].toLowerCase();

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

export type Overview = { configured: string[]; enabled: string[]; suggestions: string[]; tokenMissing: boolean };

export type Toggled = { repo: string; enabled: boolean; project: string | null };

export class Service {
  private seeder: Seeder | null;

  constructor(
    private settings: Settings,
    private hub: Hub | null,
    catalog: Catalog | null = null,
  ) {
    this.seeder = catalog ? new Seeder(catalog) : null;
  }

  configured(): Promise<string[]> {
    return this.settings.list(keys.orgs);
  }

  enabled(): Promise<string[]> {
    return this.settings.list(keys.repos);
  }

  async overview(): Promise<Overview> {
    const [configured, enabled] = await Promise.all([this.configured(), this.enabled()]);
    if (!this.hub) return { configured, enabled, suggestions: [], tokenMissing: true };

    let suggestions: string[] = [];
    try {
      suggestions = (await this.hub.memberships()).filter((o) => !configured.some((c) => same(c, o)));
    } catch (err) {
      console.warn('github org listing failed:', err instanceof Error ? err.message : err);
    }
    return { configured, enabled, suggestions, tokenMissing: false };
  }

  async add(org: unknown): Promise<string[]> {
    if (typeof org !== 'string' || !login.test(org.trim())) throw new Fault('invalid', 'nome de organização inválido');
    const hub = this.need();
    const canonical = await hub.org(org.trim());
    if (!canonical) throw new Fault('invalid', `organização "${org.trim()}" não encontrada`);

    const current = await this.configured();
    if (current.some((o) => same(o, canonical))) return current;
    return this.settings.save(keys.orgs, [...current, canonical]);
  }

  async remove(org: unknown): Promise<string[]> {
    if (typeof org !== 'string') throw new Fault('invalid', 'org é obrigatório');
    const current = await this.configured();
    return this.settings.save(
      keys.orgs,
      current.filter((o) => !same(o, org)),
    );
  }

  async repos(org: string): Promise<(Repo & { enabled: boolean })[]> {
    const hub = this.need();
    const [repos, enabled] = await Promise.all([hub.repos(org), this.enabled()]);
    return repos
      .map((r) => ({ ...r, enabled: enabled.some((e) => same(e, r.repo)) }))
      .sort((a, b) => (b.pushedAt ?? '').localeCompare(a.pushedAt ?? ''));
  }

  async toggle(repo: unknown, on: unknown): Promise<Toggled> {
    if (typeof repo !== 'string' || !repoName.test(repo) || typeof on !== 'boolean') {
      throw new Fault('invalid', 'repo (owner/name) e enabled são obrigatórios');
    }
    if (!(await this.configured()).some((o) => same(o, owner(repo)))) {
      throw new Fault('invalid', 'repo não pertence a uma organização configurada');
    }
    const rest = (await this.enabled()).filter((r) => !same(r, repo));
    await this.settings.save(keys.repos, on ? [...rest, repo] : rest);
    return { repo, enabled: on, project: on ? await this.seed(repo) : null };
  }

  private async seed(name: string): Promise<string | null> {
    if (!this.hub || !this.seeder) return null;
    try {
      if (await this.seeder.has(name)) return null;
      const remote = await this.hub.repo(name);
      if (!remote || remote.private) return null;
      return await this.seeder.seed(remote, await this.hub.readme(name));
    } catch (err) {
      console.warn(`project seed failed for ${name}:`, err instanceof Error ? err.message : err);
      return null;
    }
  }

  private need(): Hub {
    if (!this.hub) throw new Fault('config', missing);
    return this.hub;
  }
}

import { Octokit } from '@octokit/rest';
import { Fault } from '@/core/error';
import type { Hub as Port, Repo } from '@/core/ingest/hub';

const upstream = (err: unknown) => new Fault('upstream', err instanceof Error ? err.message : String(err));

export class Hub implements Port {
  private kit: Octokit;

  constructor(token: string) {
    this.kit = new Octokit({ auth: token });
  }

  async memberships(): Promise<string[]> {
    const orgs = await this.kit.paginate(this.kit.rest.orgs.listForAuthenticatedUser, { per_page: 100 });
    return orgs.map((o) => o.login);
  }

  async org(login: string): Promise<string | null> {
    try {
      return (await this.kit.rest.orgs.get({ org: login })).data.login;
    } catch (err) {
      if ((err as { status?: number }).status === 404) return null;
      throw upstream(err);
    }
  }

  async repos(org: string): Promise<Repo[]> {
    try {
      const repos = await this.kit.paginate(this.kit.rest.repos.listForOrg, { org, type: 'all', per_page: 100 });
      return repos.map((r) => ({
        repo: r.full_name,
        name: r.name,
        private: r.private,
        archived: r.archived ?? false,
        pushedAt: r.pushed_at ?? null,
      }));
    } catch (err) {
      throw upstream(err);
    }
  }
}

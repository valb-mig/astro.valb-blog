import { Octokit } from '@octokit/rest';
import { Fault } from '@/core/error';
import type { Hub as Port, Repo } from '@/core/ingest/hub';

const upstream = (err: unknown) => new Fault('upstream', err instanceof Error ? err.message : String(err));

const missing = (err: unknown) => (err as { status?: number }).status === 404;

type Raw = {
  full_name: string;
  name: string;
  private: boolean;
  description: string | null;
  created_at?: string | null;
  topics?: string[];
  archived?: boolean;
  pushed_at?: string | null;
};

const repo = (r: Raw): Repo => ({
  repo: r.full_name,
  name: r.name,
  private: r.private,
  description: r.description,
  createdAt: r.created_at ?? null,
  topics: r.topics ?? [],
  archived: r.archived ?? false,
  pushedAt: r.pushed_at ?? null,
});

const split = (name: string) => {
  const [owner, repo] = name.split('/');
  return { owner, repo };
};

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
      if (missing(err)) return null;
      throw upstream(err);
    }
  }

  async repos(org: string): Promise<Repo[]> {
    try {
      return (await this.kit.paginate(this.kit.rest.repos.listForOrg, { org, type: 'all', per_page: 100 })).map(repo);
    } catch (err) {
      throw upstream(err);
    }
  }

  async repo(name: string): Promise<Repo | null> {
    try {
      return repo((await this.kit.rest.repos.get(split(name))).data);
    } catch (err) {
      if (missing(err)) return null;
      throw upstream(err);
    }
  }

  async languages(name: string): Promise<{ [lang: string]: number }> {
    return (await this.kit.rest.repos.listLanguages(split(name))).data;
  }

  async readme(name: string): Promise<string> {
    try {
      const { data } = await this.kit.rest.repos.getReadme(split(name));
      return Buffer.from(data.content, 'base64').toString('utf-8');
    } catch {
      return '';
    }
  }
}

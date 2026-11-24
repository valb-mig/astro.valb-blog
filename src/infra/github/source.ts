import { Octokit } from '@octokit/rest';
import { retry } from '@octokit/plugin-retry';
import { throttling } from '@octokit/plugin-throttling';
import type { Release, Remote, Source as Port } from '@/core/ingest/port';

const Kit = Octokit.plugin(throttling, retry);

type Repo = {
  full_name: string;
  name: string;
  private: boolean;
  description: string | null;
  created_at?: string | null;
  topics?: string[];
  archived?: boolean;
  fork?: boolean;
};

const remote = (r: Repo): Remote => ({
  repo: r.full_name,
  name: r.name,
  private: r.private,
  description: r.description,
  createdAt: r.created_at ?? null,
  topics: r.topics ?? [],
  archived: r.archived ?? false,
  fork: r.fork ?? false,
});

const split = (repo: string) => {
  const [owner, name] = repo.split('/');
  return { owner, repo: name };
};

export class Source implements Port {
  private kit: InstanceType<typeof Kit>;

  constructor(token: string) {
    this.kit = new Kit({
      auth: token,
      throttle: {
        onRateLimit: (after: number, options: { method: string; url: string }) => {
          console.warn(`Primary rate limit on ${options.method} ${options.url}, retrying in ${after}s`);
          return true;
        },
        onSecondaryRateLimit: (after: number, options: { method: string; url: string }) => {
          console.warn(`Secondary rate limit on ${options.method} ${options.url}, retrying in ${after}s`);
          return true;
        },
      },
    });
  }

  async owned(): Promise<Remote[]> {
    return (await this.kit.paginate(this.kit.rest.repos.listForAuthenticatedUser, { affiliation: 'owner', per_page: 100 })).map(remote);
  }

  async org(org: string): Promise<Remote[]> {
    return (await this.kit.paginate(this.kit.rest.repos.listForOrg, { org, type: 'all', per_page: 100 })).map(remote);
  }

  async emails(): Promise<string[]> {
    const { data: me } = await this.kit.rest.users.getAuthenticated();
    const emails = new Set([`${me.id}+${me.login}@users.noreply.github.com`, `${me.login}@users.noreply.github.com`]);
    if (me.email) emails.add(me.email);
    try {
      const { data } = await this.kit.rest.users.listEmailsForAuthenticatedUser({ per_page: 100 });
      for (const e of data) if (e.verified) emails.add(e.email);
    } catch (err) {
      console.warn('Could not list account emails (missing user:email scope?) — author filter uses noreply only:', (err as Error).message);
    }
    return [...emails];
  }

  async readme(repo: string): Promise<string> {
    try {
      const { data } = await this.kit.rest.repos.getReadme(split(repo));
      return Buffer.from(data.content, 'base64').toString('utf-8');
    } catch {
      return '';
    }
  }

  async description(repo: string): Promise<string | null> {
    return (await this.kit.rest.repos.get(split(repo))).data.description ?? null;
  }

  async languages(repo: string): Promise<{ [lang: string]: number }> {
    return (await this.kit.rest.repos.listLanguages(split(repo))).data;
  }

  async ci(repo: string): Promise<string | null> {
    const run = (await this.kit.rest.actions.listWorkflowRunsForRepo({ ...split(repo), per_page: 1 })).data.workflow_runs[0];
    return run ? (run.conclusion ?? run.status ?? null) : null;
  }

  async release(repo: string): Promise<Release | null> {
    const r = (await this.kit.rest.repos.listReleases({ ...split(repo), per_page: 1 })).data[0];
    return r ? { tag: r.tag_name, at: r.published_at ?? r.created_at } : null;
  }
}

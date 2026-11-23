import { Fault } from '../error';
import type { Service as Events } from '../event/service';
import type { Service as Updates } from '../update/service';
import { split, type Board } from './board';
import type { Projects, Query } from './port';
import type { Input, Key, Project, Repo, Summary } from './project';

export class Service {
  constructor(
    private projects: Projects,
    private events: Events,
    private updates: Updates,
    private equal: (a: string, b: string) => boolean,
  ) {}

  list(q: Query): Promise<Summary[]> {
    return this.projects.list(q);
  }

  find(key: Key, drafts: boolean): Promise<Project | null> {
    return this.projects.find(key, drafts);
  }

  async get(key: Key, drafts: boolean): Promise<Project> {
    const project = await this.projects.find(key, drafts);
    if (!project) throw new Fault('missing', 'Not found');
    return project;
  }

  async board(drafts: boolean): Promise<Board> {
    const { web, ci } = split(await this.projects.cards(drafts));
    const repos = [...new Set([...web, ...ci].flatMap((c) => (c.repo ? [c.repo] : [])))];
    return { web, ci, last: await this.events.last(repos) };
  }

  repos(): Promise<Repo[]> {
    return this.projects.repos();
  }

  async create(input: Input): Promise<Project> {
    const project = await this.projects.create(input);
    if (!project.draft) {
      await this.updates.announce('project', `Novo projeto: ${project.title}`, `/projects/${project.slug}`);
    }
    return project;
  }

  update(id: string, input: Partial<Input>): Promise<Project> {
    return this.projects.update(id, input);
  }

  remove(id: string): Promise<void> {
    return this.projects.remove(id);
  }

  async report(id: string, token: string, payload: unknown): Promise<void> {
    const expected = token ? await this.projects.token(id) : null;
    if (!expected || !this.equal(token, expected)) throw new Fault('denied', 'Unauthorized');
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new Fault('invalid', 'Payload deve ser um objeto JSON');
    }
    await this.projects.report(id, payload as { [key: string]: unknown });
  }

  count(): Promise<number> {
    return this.projects.count();
  }
}

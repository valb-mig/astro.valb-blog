import type { Remote } from './port';

export type Repo = Remote & { pushedAt: string | null };

export interface Hub {
  memberships(): Promise<string[]>;
  org(login: string): Promise<string | null>;
  repos(org: string): Promise<Repo[]>;
  repo(name: string): Promise<Repo | null>;
  readme(name: string): Promise<string>;
  languages(name: string): Promise<{ [lang: string]: number }>;
}

export interface Trigger {
  run(): Promise<void>;
}

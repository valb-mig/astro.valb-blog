import type { Event } from '../event/event';
import type { Health, Languages, Status } from '../project/project';

export type Remote = {
  repo: string;
  name: string;
  private: boolean;
  description: string | null;
  createdAt: string | null;
  topics: string[];
  archived: boolean;
};

export type Fresh = Omit<Event, 'id' | 'createdAt'>;

export type Release = { tag: string; at: string | null };

export interface Source {
  owned(): Promise<Remote[]>;
  org(org: string): Promise<Remote[]>;
  emails(): Promise<string[]>;
  readme(repo: string): Promise<string>;
  description(repo: string): Promise<string | null>;
  languages(repo: string): Promise<{ [lang: string]: number }>;
  ci(repo: string): Promise<string | null>;
  release(repo: string): Promise<Release | null>;
}

export interface Log {
  commits(repo: string, date: string, authors?: string[]): Promise<Fresh[]>;
}

export interface Probe {
  code(url: string): Promise<number | null>;
}

export type Tracked = {
  id: string;
  repo: string | null;
  uptimeUrl: string | null;
  private: boolean;
  mention: boolean;
};

export type Seed = {
  slug: string;
  title: string;
  description: string;
  content: string;
  date: string;
  tags: string[];
  status: Status;
  repo: string;
  languages: Languages | null;
};

export interface Catalog {
  tracked(): Promise<Tracked[]>;
  taken(slug: string): Promise<boolean>;
  seed(seed: Seed): Promise<void>;
  languages(id: string, languages: Languages): Promise<void>;
  health(id: string, health: Partial<Health>): Promise<void>;
  ids(repos: string[]): Promise<string[]>;
}

export interface Ledger {
  known(events: Fresh[]): Promise<Set<string>>;
  save(events: Fresh[]): Promise<Event[]>;
  attach(post: string, events: string[]): Promise<void>;
  of(post: string): Promise<Event[]>;
}

export type Outcome = { status: 'success' | 'error'; created: number; fallback: boolean; error: string | null };

export interface Journal {
  start(date: string, trigger: string): Promise<string>;
  finish(id: string, outcome: Outcome): Promise<void>;
}

export const key = (e: Pick<Fresh, 'type' | 'externalId' | 'repo'>) => `${e.type}|${e.externalId}|${e.repo}`;

export interface Drafts {
  open(slug: string, title: string, description: string): Promise<string>;
}

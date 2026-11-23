import type { Key, Post, Data, Summary } from './post';

export type Query = {
  drafts: boolean;
  limit?: number;
  projects?: string[];
};

export interface Posts {
  list(q: Query): Promise<Summary[]>;
  find(key: Key, drafts: boolean): Promise<Post | null>;
  slugs(prefix: string, drafts: boolean): Promise<string[]>;
  create(data: Data): Promise<Post>;
  update(id: string, data: Partial<Data>): Promise<Post>;
  remove(id: string): Promise<void>;
  link(id: string, projects: string[]): Promise<void>;
  count(): Promise<number>;
}

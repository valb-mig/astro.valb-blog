import type { Card, Deploy, Image, Input, Key, Project, Repo, Status, Summary } from './project';

export type Query = {
  drafts: boolean;
  status?: Status;
  limit?: number;
};

export interface Projects {
  list(q: Query): Promise<Summary[]>;
  find(key: Key, drafts: boolean): Promise<Project | null>;
  cards(drafts: boolean): Promise<Card[]>;
  repos(): Promise<Repo[]>;
  create(input: Input): Promise<Project>;
  update(id: string, input: Partial<Input>): Promise<Project>;
  remove(id: string): Promise<void>;
  token(id: string): Promise<string | null>;
  report(id: string, deploy: Deploy): Promise<void>;
  count(): Promise<number>;
  paths(id: string): Promise<string[] | null>;
  gallery(id: string, paths: string[]): Promise<Image[]>;
}

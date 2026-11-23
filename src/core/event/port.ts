import type { Item } from './event';

export type Query = {
  page: number;
  size: number;
  repo?: string;
  linked: boolean;
};

export interface Events {
  feed(q: Query): Promise<{ items: Item[]; total: number }>;
  recent(repo: string, limit: number): Promise<Item[]>;
  last(repos: string[]): Promise<{ [repo: string]: string }>;
  remove(id: string): Promise<void>;
}

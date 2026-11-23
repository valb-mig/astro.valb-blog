import type { Emoji } from './emoji';

export type Vote = { emoji: string; fingerprint: string };

export interface Reactions {
  list(post: string): Promise<Vote[]>;
  find(post: string, emoji: Emoji, fingerprint: string): Promise<string | null>;
  add(post: string, emoji: Emoji, fingerprint: string): Promise<void>;
  remove(id: string): Promise<void>;
  count(post?: string, emoji?: Emoji): Promise<number>;
}

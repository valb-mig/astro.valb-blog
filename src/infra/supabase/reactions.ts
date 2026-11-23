import type { Emoji } from '@/core/reaction/emoji';
import type { Reactions as Port, Vote } from '@/core/reaction/port';
import { counted, must, type Db } from './client';

export class Reactions implements Port {
  constructor(private db: Db) {}

  async list(post: string): Promise<Vote[]> {
    return must(await this.db.from('post_reactions').select('emoji, fingerprint').eq('post_id', post)) as Vote[];
  }

  async find(post: string, emoji: Emoji, fingerprint: string): Promise<string | null> {
    const r = must(
      await this.db
        .from('post_reactions')
        .select('id')
        .eq('post_id', post)
        .eq('emoji', emoji)
        .eq('fingerprint', fingerprint)
        .maybeSingle(),
    ) as { id: string } | null;
    return r?.id ?? null;
  }

  async add(post: string, emoji: Emoji, fingerprint: string): Promise<void> {
    must(await this.db.from('post_reactions').insert({ post_id: post, emoji, fingerprint }));
  }

  async remove(id: string): Promise<void> {
    must(await this.db.from('post_reactions').delete().eq('id', id));
  }

  async count(post?: string, emoji?: Emoji): Promise<number> {
    let q = this.db.from('post_reactions').select('*', { count: 'exact', head: true });
    if (post) q = q.eq('post_id', post);
    if (emoji) q = q.eq('emoji', emoji);
    return counted(await q);
  }
}

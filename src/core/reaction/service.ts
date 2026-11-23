import { Fault } from '../error';
import type { Limiter } from '../limit';
import { emojis, valid } from './emoji';
import type { Reactions } from './port';

export type Tally = {
  counts: { [emoji: string]: number };
  reacted: { [emoji: string]: boolean };
};

export class Service {
  constructor(
    private reactions: Reactions,
    private limiter: Limiter,
  ) {}

  async tally(post: string | null, fingerprint: string): Promise<Tally> {
    if (!post) throw new Fault('invalid', 'post required');
    const counts: Tally['counts'] = {};
    const reacted: Tally['reacted'] = {};
    for (const e of emojis) {
      counts[e] = 0;
      reacted[e] = false;
    }
    for (const v of await this.reactions.list(post)) {
      counts[v.emoji] = (counts[v.emoji] ?? 0) + 1;
      if (v.fingerprint === fingerprint) reacted[v.emoji] = true;
    }
    return { counts, reacted };
  }

  async toggle(post: unknown, emoji: unknown, fingerprint: string): Promise<{ count: number; reacted: boolean }> {
    if (typeof post !== 'string' || !post || !valid(emoji)) throw new Fault('invalid', 'post/emoji inválido');
    if (this.limiter.hit(fingerprint)) throw new Fault('limited', 'Muitas reações, calma aí.');

    const existing = await this.reactions.find(post, emoji, fingerprint);
    if (existing) await this.reactions.remove(existing);
    else await this.reactions.add(post, emoji, fingerprint);

    return { count: await this.reactions.count(post, emoji), reacted: !existing };
  }

  total(): Promise<number> {
    return this.reactions.count();
  }
}

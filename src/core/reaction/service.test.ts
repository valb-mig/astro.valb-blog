import { describe, expect, it } from 'vitest';
import { MemoryReactions } from '@/test/memory';
import { Limiter } from '../limit';
import { Service } from './service';

describe('reaction service', () => {
  it('toggles a reaction on and off per fingerprint', async () => {
    const reactions = new Service(new MemoryReactions(), new Limiter(10, 60_000));
    expect(await reactions.toggle('p', '🔥', 'a')).toEqual({ count: 1, reacted: true });
    expect(await reactions.toggle('p', '🔥', 'b')).toEqual({ count: 2, reacted: true });
    expect(await reactions.toggle('p', '🔥', 'a')).toEqual({ count: 1, reacted: false });

    const tally = await reactions.tally('p', 'b');
    expect(tally.counts['🔥']).toBe(1);
    expect(tally.counts['👍']).toBe(0);
    expect(tally.reacted).toMatchObject({ '🔥': true, '👍': false });
  });

  it('rejects unknown emojis and missing posts', async () => {
    const reactions = new Service(new MemoryReactions(), new Limiter(10, 60_000));
    await expect(reactions.toggle('p', '💩', 'a')).rejects.toMatchObject({ code: 'invalid' });
    await expect(reactions.toggle(null, '🔥', 'a')).rejects.toMatchObject({ code: 'invalid' });
    await expect(reactions.tally(null, 'a')).rejects.toMatchObject({ code: 'invalid' });
  });

  it('rate limits bursts per fingerprint', async () => {
    const reactions = new Service(new MemoryReactions(), new Limiter(2, 60_000));
    await reactions.toggle('p', '🔥', 'a');
    await reactions.toggle('p', '🔥', 'a');
    await expect(reactions.toggle('p', '🔥', 'a')).rejects.toMatchObject({ code: 'limited' });
    await expect(reactions.toggle('p', '🔥', 'b')).resolves.toBeDefined();
  });
});

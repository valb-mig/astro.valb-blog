import { describe, expect, it } from 'vitest';
import { Limiter } from './limit';

describe('limiter', () => {
  it('allows max hits per window and frees up after it', () => {
    let now = 0;
    const limiter = new Limiter(2, 1000, () => now);
    expect([limiter.hit('k'), limiter.hit('k'), limiter.hit('k')]).toEqual([false, false, true]);
    expect(limiter.hit('other')).toBe(false);
    now = 1500;
    expect(limiter.hit('k')).toBe(false);
  });
});

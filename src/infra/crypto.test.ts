import { afterEach, describe, expect, it, vi } from 'vitest';
import { equal, Hmac } from './crypto';

describe('hmac tokens', () => {
  afterEach(() => vi.useRealTimers());

  it('round-trips a signed user and rejects tampering', () => {
    const hmac = new Hmac(() => 'secret', 60);
    const token = hmac.sign('me');
    expect(hmac.verify(token)).toBe('me');
    expect(new Hmac(() => 'other', 60).verify(token)).toBeNull();
    expect(hmac.verify('garbage')).toBeNull();
  });

  it('expires tokens after the max age', () => {
    vi.useFakeTimers();
    const hmac = new Hmac(() => 'secret', 60);
    const token = hmac.sign('me');
    vi.advanceTimersByTime(61_000);
    expect(hmac.verify(token)).toBeNull();
  });

  it('compares strings of different lengths safely', () => {
    expect(equal('a', 'a')).toBe(true);
    expect(equal('a', 'abc')).toBe(false);
  });
});

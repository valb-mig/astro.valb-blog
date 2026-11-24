import { describe, expect, it } from 'vitest';
import type { Llm } from './port';
import { Retry } from './retry';

const flaky = (errors: unknown[]): Llm & { calls: number } => {
  const llm = {
    calls: 0,
    async complete() {
      const err = errors[llm.calls++];
      if (err) throw err;
      return 'ok';
    },
  };
  return llm;
};

const fail = (status: number) => Object.assign(new Error(`http ${status}`), { status });

describe('llm retry', () => {
  it('retries transient errors with growing waits', async () => {
    const waits: number[] = [];
    const inner = flaky([fail(503), fail(429)]);
    const llm = new Retry(inner, 3, async (ms) => {
      waits.push(ms);
    });
    expect(await llm.complete({ system: '', user: '' })).toBe('ok');
    expect(inner.calls).toBe(3);
    expect(waits).toEqual([2000, 4000]);
  });

  it('gives up after the last attempt and never retries client errors', async () => {
    const sleep = async () => undefined;
    await expect(new Retry(flaky([fail(503), fail(503), fail(503)]), 3, sleep).complete({ system: '', user: '' })).rejects.toThrow('http 503');
    const bad = flaky([fail(404)]);
    await expect(new Retry(bad, 3, sleep).complete({ system: '', user: '' })).rejects.toThrow('http 404');
    expect(bad.calls).toBe(1);
  });
});

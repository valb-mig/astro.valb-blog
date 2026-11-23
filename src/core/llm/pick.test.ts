import { describe, expect, it } from 'vitest';
import { MemorySettings } from '@/test/memory';
import { Service as Settings } from '../setting/service';
import type { Llm } from './port';
import { pick } from './pick';

const fake = (name: string, fail = false): Llm => ({
  complete: async () => {
    if (fail) throw new Error(`${name} down`);
    return name;
  },
});

const setup = (values: { [key: string]: string }) => {
  const rows = new MemorySettings();
  for (const [k, v] of Object.entries(values)) rows.values.set(k, v);
  return new Settings(rows);
};

describe('llm pick', () => {
  it('defaults to groq', async () => {
    const llm = await pick(setup({}), { groq: 'g' }, { groq: () => fake('groq'), gemini: () => fake('gemini') });
    expect(await llm.complete({ system: '', user: '' })).toBe('groq');
  });

  it('falls back from gemini to groq when enabled and flags it', async () => {
    const llm = await pick(
      setup({ llm_provider: 'gemini' }),
      { groq: 'g', gemini: 'm' },
      { groq: () => fake('groq'), gemini: () => fake('gemini', true) },
    );
    expect(await llm.complete({ system: '', user: '' })).toBe('groq');
    expect(llm.fellBack).toBe(true);
  });

  it('does not fall back when disabled or without a groq key', async () => {
    const makers = { groq: () => fake('groq'), gemini: () => fake('gemini', true) };
    const off = await pick(setup({ llm_provider: 'gemini', llm_fallback_enabled: 'false' }), { groq: 'g', gemini: 'm' }, makers);
    await expect(off.complete({ system: '', user: '' })).rejects.toThrow('gemini down');
    const keyless = await pick(setup({ llm_provider: 'gemini' }), { gemini: 'm' }, makers);
    await expect(keyless.complete({ system: '', user: '' })).rejects.toThrow('gemini down');
  });

  it('fails fast when the chosen provider has no key', async () => {
    const makers = { groq: () => fake('groq'), gemini: () => fake('gemini') };
    await expect(pick(setup({ llm_provider: 'gemini' }), { groq: 'g' }, makers)).rejects.toMatchObject({ code: 'config' });
    await expect(pick(setup({}), {}, makers)).rejects.toMatchObject({ code: 'config' });
  });
});

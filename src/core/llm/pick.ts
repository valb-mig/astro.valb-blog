import { Fault } from '../error';
import type { Service as Settings } from '../setting/service';
import { Fallback } from './fallback';
import type { Llm } from './port';

export type Keys = { groq?: string; gemini?: string };

export type Makers = { groq: (key: string) => Llm; gemini: (key: string) => Llm };

export const pick = async (settings: Settings, keys: Keys, make: Makers): Promise<Llm> => {
  const provider = (await settings.get('llm_provider')) ?? 'groq';

  if (provider === 'gemini') {
    if (!keys.gemini) throw new Fault('config', 'llm_provider is "gemini" but GEMINI_API_KEY is not set.');
    const gemini = make.gemini(keys.gemini);
    const spare = ((await settings.get('llm_fallback_enabled')) ?? 'true') === 'true' ? keys.groq : undefined;
    return spare ? new Fallback(gemini, () => make.groq(spare)) : gemini;
  }

  if (!keys.groq) throw new Fault('config', 'llm_provider is "groq" but GROQ_API_KEY is not set.');
  return make.groq(keys.groq);
};

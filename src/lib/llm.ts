import Groq from 'groq-sdk';
import { GoogleGenAI } from '@google/genai';
import { db } from './db';

export type CompleteParams = {
  system: string;
  user: string;
  json?: boolean;
};

export interface LlmStrategy {
  complete(params: CompleteParams): Promise<string>;
  usedFallback?: boolean;
}

class GroqStrategy implements LlmStrategy {
  private client: Groq;

  constructor(apiKey: string) {
    this.client = new Groq({ apiKey });
  }

  async complete({ system, user, json }: CompleteParams): Promise<string> {
    const completion = await this.client.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      response_format: json ? { type: 'json_object' } : undefined,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    });
    return completion.choices[0]?.message?.content?.trim() ?? '';
  }
}

class GeminiStrategy implements LlmStrategy {
  private client: GoogleGenAI;

  constructor(apiKey: string) {
    this.client = new GoogleGenAI({ apiKey });
  }

  async complete({ system, user, json }: CompleteParams): Promise<string> {
    const response = await this.client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: user,
      config: {
        systemInstruction: system,
        responseMimeType: json ? 'application/json' : 'text/plain',
      },
    });
    return response.text?.trim() ?? '';
  }
}

// Cai pra Groq se Gemini falhar (erro de API, rate limit, indisponibilidade) e GROQ_API_KEY existir.
class GeminiWithGroqFallbackStrategy implements LlmStrategy {
  usedFallback = false;

  constructor(
    private gemini: GeminiStrategy,
    private groqApiKey: string,
  ) {}

  async complete(params: CompleteParams): Promise<string> {
    try {
      return await this.gemini.complete(params);
    } catch (err) {
      console.warn('[llm] Gemini falhou, caindo pra Groq:', err instanceof Error ? err.message : err);
      this.usedFallback = true;
      return new GroqStrategy(this.groqApiKey).complete(params);
    }
  }
}

const LLM_PROVIDER_SETTING_KEY = 'llm_provider';
const LLM_FALLBACK_SETTING_KEY = 'llm_fallback_enabled';
const DEFAULT_PROVIDER = 'groq';

// import.meta.env é preenchido pelo Vite/Astro; fora desse contexto (ex:
// scripts/ingest.ts rodando via tsx) cai pra process.env — mesmo padrão de src/lib/db.ts.
function envVar(key: string): string | undefined {
  return import.meta.env?.[key] ?? process.env[key];
}

async function getSetting(key: string): Promise<string | null> {
  const { data, error } = await db.from('settings').select('value').eq('key', key).maybeSingle();
  if (error) throw error;
  return data?.value ?? null;
}

export async function getLlmProviderName(): Promise<string> {
  return (await getSetting(LLM_PROVIDER_SETTING_KEY)) ?? DEFAULT_PROVIDER;
}

export async function getLlmProvider(): Promise<LlmStrategy> {
  const provider = await getLlmProviderName();

  if (provider === 'gemini') {
    const apiKey = envVar('GEMINI_API_KEY');
    if (!apiKey) throw new Error('llm_provider está setado como "gemini" mas GEMINI_API_KEY não está no env.');
    const groqApiKey = envVar('GROQ_API_KEY');
    const fallbackEnabled = ((await getSetting(LLM_FALLBACK_SETTING_KEY)) ?? 'true') === 'true';
    const gemini = new GeminiStrategy(apiKey);
    return groqApiKey && fallbackEnabled ? new GeminiWithGroqFallbackStrategy(gemini, groqApiKey) : gemini;
  }

  const apiKey = envVar('GROQ_API_KEY');
  if (!apiKey) throw new Error('llm_provider está setado como "groq" mas GROQ_API_KEY não está no env.');
  return new GroqStrategy(apiKey);
}

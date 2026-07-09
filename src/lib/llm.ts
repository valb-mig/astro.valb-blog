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

const LLM_PROVIDER_SETTING_KEY = 'llm_provider';
const DEFAULT_PROVIDER = 'groq';

// import.meta.env é preenchido pelo Vite/Astro; fora desse contexto (ex:
// scripts/ingest.ts rodando via tsx) cai pra process.env — mesmo padrão de src/lib/db.ts.
function envVar(key: string): string | undefined {
  return import.meta.env?.[key] ?? process.env[key];
}

export async function getLlmProviderName(): Promise<string> {
  const { data, error } = await db.from('settings').select('value').eq('key', LLM_PROVIDER_SETTING_KEY).maybeSingle();
  if (error) throw error;
  return data?.value ?? DEFAULT_PROVIDER;
}

export async function getLlmProvider(): Promise<LlmStrategy> {
  const provider = await getLlmProviderName();

  if (provider === 'gemini') {
    const apiKey = envVar('GEMINI_API_KEY');
    if (!apiKey) throw new Error('llm_provider está setado como "gemini" mas GEMINI_API_KEY não está no env.');
    return new GeminiStrategy(apiKey);
  }

  const apiKey = envVar('GROQ_API_KEY');
  if (!apiKey) throw new Error('llm_provider está setado como "groq" mas GROQ_API_KEY não está no env.');
  return new GroqStrategy(apiKey);
}

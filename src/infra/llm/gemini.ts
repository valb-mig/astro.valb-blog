import { GoogleGenAI } from '@google/genai';
import type { Llm, Prompt } from '@/core/llm/port';

export class Gemini implements Llm {
  private client: GoogleGenAI;

  constructor(
    key: string,
    private model = 'gemini-2.5-flash',
  ) {
    this.client = new GoogleGenAI({ apiKey: key });
  }

  async complete({ system, user, json }: Prompt): Promise<string> {
    const res = await this.client.models.generateContent({
      model: this.model,
      contents: user,
      config: { systemInstruction: system, responseMimeType: json ? 'application/json' : 'text/plain' },
    });
    return res.text?.trim() ?? '';
  }
}

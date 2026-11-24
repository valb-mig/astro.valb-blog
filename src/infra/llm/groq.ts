import Sdk from 'groq-sdk';
import type { Llm, Prompt } from '@/core/llm/port';

export class Groq implements Llm {
  private client: Sdk;

  constructor(
    key: string,
    private model = 'openai/gpt-oss-120b',
  ) {
    this.client = new Sdk({ apiKey: key });
  }

  async complete({ system, user, json }: Prompt): Promise<string> {
    const res = await this.client.chat.completions.create({
      model: this.model,
      response_format: json ? { type: 'json_object' } : undefined,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    });
    return res.choices[0]?.message?.content?.trim() ?? '';
  }
}

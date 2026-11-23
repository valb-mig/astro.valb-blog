import type { Llm, Prompt } from './port';

export class Fallback implements Llm {
  fellBack = false;

  constructor(
    private main: Llm,
    private spare: () => Llm,
  ) {}

  async complete(prompt: Prompt): Promise<string> {
    try {
      return await this.main.complete(prompt);
    } catch (err) {
      console.warn('[llm] primary failed, falling back:', err instanceof Error ? err.message : err);
      this.fellBack = true;
      return this.spare().complete(prompt);
    }
  }
}

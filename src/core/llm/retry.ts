import type { Llm, Prompt } from './port';

const transient = (err: unknown) => {
  const status = (err as { status?: number; code?: number }).status ?? (err as { code?: number }).code;
  return status === 429 || (typeof status === 'number' && status >= 500);
};

export class Retry implements Llm {
  constructor(
    private llm: Llm,
    private attempts = 3,
    private sleep: (ms: number) => Promise<void> = (ms) => new Promise((done) => setTimeout(done, ms)),
  ) {}

  get fellBack() {
    return this.llm.fellBack;
  }

  async complete(prompt: Prompt): Promise<string> {
    for (let n = 1; ; n++) {
      try {
        return await this.llm.complete(prompt);
      } catch (err) {
        if (n >= this.attempts || !transient(err)) throw err;
        await this.sleep(2_000 * 2 ** (n - 1));
      }
    }
  }
}

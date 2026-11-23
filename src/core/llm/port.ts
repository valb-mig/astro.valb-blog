export type Prompt = { system: string; user: string; json?: boolean };

export interface Llm {
  complete(prompt: Prompt): Promise<string>;
  fellBack?: boolean;
}

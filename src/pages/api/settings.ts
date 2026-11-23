import { app } from '@/app';
import { body, json, route } from '@/app/http';

export const GET = route(
  async () => json({ ...(await app.settings.all()), hasGroqKey: app.llm.groq, hasGeminiKey: app.llm.gemini }),
  true,
);

export const POST = route(async (ctx) => {
  const { key, value } = (await body(ctx)) ?? {};
  return json(await app.settings.set(key, value));
}, true);

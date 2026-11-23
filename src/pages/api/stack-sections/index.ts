import { app } from '@/app';
import { body, json, route } from '@/app/http';
import type { SectionInput } from '@/core/stack/stack';

export const GET = route(async () => json(await app.stack.sections()));

export const POST = route(
  async (ctx) => json(await app.stack.createSection((await body<SectionInput>(ctx)) ?? ({} as SectionInput)), 201),
  true,
);

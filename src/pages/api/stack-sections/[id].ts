import { app } from '@/app';
import { body, done, json, route } from '@/app/http';
import type { SectionInput } from '@/core/stack/stack';

export const PUT = route(
  async (ctx) => json(await app.stack.updateSection(ctx.params.id!, (await body<Partial<SectionInput>>(ctx)) ?? {})),
  true,
);

export const DELETE = route(async ({ params }) => {
  await app.stack.removeSection(params.id!);
  return done();
}, true);

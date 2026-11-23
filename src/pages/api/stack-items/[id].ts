import { app } from '@/app';
import { body, done, json, route } from '@/app/http';
import type { ItemInput } from '@/core/stack/stack';

export const PUT = route(
  async (ctx) => json(await app.stack.updateItem(ctx.params.id!, (await body<Partial<ItemInput>>(ctx)) ?? {})),
  true,
);

export const DELETE = route(async ({ params }) => {
  await app.stack.removeItem(params.id!);
  return done();
}, true);

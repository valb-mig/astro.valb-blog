import { app } from '@/app';
import { body, json, route } from '@/app/http';
import type { ItemInput } from '@/core/stack/stack';

export const POST = route(
  async (ctx) => json(await app.stack.createItem((await body<ItemInput>(ctx)) ?? ({} as ItemInput)), 201),
  true,
);

import { app } from '@/app';
import { body, json, route } from '@/app/http';

export const POST = route(async (ctx) => {
  const { id, pinned } = (await body(ctx)) ?? {};
  return json({ pinned: await app.pins.set(id, pinned) });
}, true);

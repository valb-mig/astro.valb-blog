import { app } from '@/app';
import { body, json, route } from '@/app/http';

export const GET = route(async ({ url }) => json(await app.updates.page(url.searchParams.get('before') ?? undefined)));

export const POST = route(async (ctx) => {
  const { message, url } = (await body(ctx)) ?? {};
  return json(await app.updates.post(message, typeof url === 'string' ? url : null), 201);
}, true);

import { app } from '@/app';
import { body, json, route, visitor } from '@/app/http';

export const GET = route(async (ctx) => json(await app.reactions.tally(ctx.url.searchParams.get('post'), visitor(ctx))));

export const POST = route(async (ctx) => {
  const { post, emoji } = (await body(ctx)) ?? {};
  return json(await app.reactions.toggle(post, emoji, visitor(ctx)));
});

import { app } from '@/app';
import { body, done, json, route } from '@/app/http';
import type { Input } from '@/core/post/post';

export const GET = route(async ({ params, locals }) => json(await app.posts.get({ id: params.id! }, locals.admin)));

export const PUT = route(async (ctx) => {
  const { projects, ...input } = ((await body(ctx)) ?? {}) as Partial<Input> & { projects?: string[] };
  return json(await app.posts.update(ctx.params.id!, input, projects));
}, true);

export const DELETE = route(async ({ params }) => {
  await app.posts.remove(params.id!);
  return done();
}, true);

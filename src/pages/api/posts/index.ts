import { app } from '@/app';
import { body, json, route } from '@/app/http';
import type { Input } from '@/core/post/post';

export const GET = route(async ({ locals }) => json(await app.posts.list({ drafts: locals.admin })));

export const POST = route(async (ctx) => {
  const { projects, ...input } = ((await body(ctx)) ?? {}) as Input & { projects?: string[] };
  return json(await app.posts.create(input, projects), 201);
}, true);

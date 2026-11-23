import { app } from '@/app';
import { body, done, json, route } from '@/app/http';
import type { Input } from '@/core/project/project';

export const GET = route(async ({ params, locals }) => json(await app.projects.get({ id: params.id! }, locals.admin)));

export const PUT = route(
  async (ctx) => json(await app.projects.update(ctx.params.id!, (await body<Partial<Input>>(ctx)) ?? {})),
  true,
);

export const DELETE = route(async ({ params }) => {
  await app.projects.remove(params.id!);
  return done();
}, true);

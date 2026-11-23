import { app } from '@/app';
import { body, json, route } from '@/app/http';

export const POST = route(async (ctx) => {
  const { repo, enabled } = (await body(ctx)) ?? {};
  return json(await app.orgs.toggle(repo, enabled));
}, true);

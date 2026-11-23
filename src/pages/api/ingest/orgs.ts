import { app } from '@/app';
import { body, json, route } from '@/app/http';

export const GET = route(async () => json(await app.orgs.overview()), true);

export const POST = route(async (ctx) => json({ configured: await app.orgs.add((await body(ctx))?.org) }), true);

export const DELETE = route(async (ctx) => json({ configured: await app.orgs.remove((await body(ctx))?.org) }), true);

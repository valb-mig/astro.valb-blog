import { app } from '@/app';
import { body, json, route } from '@/app/http';
import type { Input } from '@/core/project/project';

export const GET = route(async ({ locals }) => json(await app.projects.list({ drafts: locals.admin })));

export const POST = route(async (ctx) => json(await app.projects.create((await body<Input>(ctx)) ?? ({} as Input)), 201), true);

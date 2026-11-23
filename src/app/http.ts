import type { APIContext, APIRoute } from 'astro';
import { Fault, type Code } from '@/core/error';
import { fingerprint } from '@/infra/crypto';
import { app } from '.';

const status: { [c in Code]: number } = {
  invalid: 400,
  denied: 401,
  missing: 404,
  limited: 429,
  upstream: 502,
  config: 500,
};

type Ctx = Pick<APIContext, 'request' | 'clientAddress'>;

export const json = (body: unknown, code = 200) =>
  new Response(JSON.stringify(body), { status: code, headers: { 'Content-Type': 'application/json' } });

export const done = () => new Response(null, { status: 204 });

export const body = <T = { [key: string]: unknown }>(ctx: APIContext): Promise<T | null> =>
  ctx.request.json().catch(() => null);

export const route =
  (fn: (ctx: APIContext) => Promise<Response> | Response, admin = false): APIRoute =>
  async (ctx) => {
    if (admin && !ctx.locals.isAdmin) return json({ error: 'Unauthorized' }, 401);
    try {
      return await fn(ctx);
    } catch (err) {
      if (err instanceof Fault) return json({ error: err.message }, status[err.code]);
      return json({ error: err instanceof Error ? err.message : 'error' }, 500);
    }
  };

const forwarded = (ctx: Ctx) => ctx.request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();

export const ip = (ctx: Ctx) => ctx.clientAddress ?? forwarded(ctx) ?? 'unknown';

export const visitor = (ctx: Ctx) =>
  fingerprint(forwarded(ctx) ?? ctx.clientAddress ?? 'unknown', ctx.request.headers.get('user-agent') ?? 'unknown', app.salt);

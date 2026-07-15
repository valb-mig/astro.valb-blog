import type { APIRoute } from 'astro';
import { verifySession, SESSION_COOKIE } from '../../../lib/auth';
import { svgFor } from '../../../lib/simple-icons.server';

export const GET: APIRoute = async ({ params, cookies }) => {
  if (!verifySession(cookies.get(SESSION_COOKIE)?.value ?? '')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const svg = svgFor(params.slug!);
  if (!svg) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });

  return new Response(JSON.stringify({ slug: params.slug, svg }), {
    headers: { 'Content-Type': 'application/json' },
  });
};

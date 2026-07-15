import type { APIRoute } from 'astro';
import { verifySession, SESSION_COOKIE } from '../../../lib/auth';
import { searchIcons } from '../../../lib/simple-icons.server';

export const GET: APIRoute = async ({ url, cookies }) => {
  if (!verifySession(cookies.get(SESSION_COOKIE)?.value ?? '')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const q = url.searchParams.get('q') ?? '';
  const results = searchIcons(q);

  return new Response(JSON.stringify(results), {
    headers: { 'Content-Type': 'application/json' },
  });
};

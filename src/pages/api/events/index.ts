import type { APIRoute } from 'astro';
import { db } from '../../../lib/db';
import { verifySession, SESSION_COOKIE } from '../../../lib/auth';

export const GET: APIRoute = async ({ url, cookies }) => {
  if (!verifySession(cookies.get(SESSION_COOKIE)?.value ?? '')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const repo = url.searchParams.get('repo');
  if (!repo) return new Response(JSON.stringify({ error: 'repo required' }), { status: 400 });

  const { data, error } = await db
    .from('source_events')
    .select('id, type, title, url, occurred_at')
    .eq('repo', repo)
    .order('occurred_at', { ascending: false })
    .limit(30);

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
};

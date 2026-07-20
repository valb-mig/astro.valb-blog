import type { APIRoute } from 'astro';
import { db } from '../../../lib/db';
import { verifySession, SESSION_COOKIE } from '../../../lib/auth';

export const GET: APIRoute = async ({ cookies }) => {
  if (!verifySession(cookies.get(SESSION_COOKIE)?.value ?? '')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const { data, error } = await db
    .from('projects')
    .select('id,title,repo,mention_allowed,ingest_private')
    .not('repo', 'is', null)
    .order('repo', { ascending: true });

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
};

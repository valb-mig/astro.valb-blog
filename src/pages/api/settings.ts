import type { APIRoute } from 'astro';
import { db } from '../../lib/db';
import { verifySession, SESSION_COOKIE } from '../../lib/auth';

export const GET: APIRoute = async ({ cookies }) => {
  if (!verifySession(cookies.get(SESSION_COOKIE)?.value ?? '')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const { data, error } = await db.from('settings').select('key,value');
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  const settings = Object.fromEntries((data ?? []).map((s) => [s.key, s.value]));
  return new Response(JSON.stringify(settings), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!verifySession(cookies.get(SESSION_COOKIE)?.value ?? '')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const { key, value } = await request.json();
  if (typeof key !== 'string' || typeof value !== 'string') {
    return new Response(JSON.stringify({ error: 'key e value são obrigatórios' }), { status: 400 });
  }

  const { error } = await db.from('settings').upsert({ key, value, updated_at: new Date().toISOString() });
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  return new Response(JSON.stringify({ key, value }), {
    headers: { 'Content-Type': 'application/json' },
  });
};

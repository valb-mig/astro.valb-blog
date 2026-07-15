import type { APIRoute } from 'astro';
import { db } from '../../../lib/db';
import { verifySession, SESSION_COOKIE } from '../../../lib/auth';

const PAGE_SIZE = 20;

export const GET: APIRoute = async ({ url }) => {
  const before = url.searchParams.get('before');

  let query = db
    .from('updates')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(PAGE_SIZE);

  if (before) query = query.lt('created_at', before);

  const { data, error } = await query;
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!verifySession(cookies.get(SESSION_COOKIE)?.value ?? '')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const body = await request.json();
  if (typeof body.message !== 'string' || !body.message.trim()) {
    return new Response(JSON.stringify({ error: 'message é obrigatório' }), { status: 400 });
  }

  const { data, error } = await db
    .from('updates')
    .insert({ message: body.message, source: 'manual', kind: null, ref_url: body.ref_url ?? null })
    .select()
    .single();

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  return new Response(JSON.stringify(data), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  });
};

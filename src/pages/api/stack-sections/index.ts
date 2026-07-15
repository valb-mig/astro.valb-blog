import type { APIRoute } from 'astro';
import { db } from '../../../lib/db';
import { verifySession, SESSION_COOKIE } from '../../../lib/auth';

function authed(cookies: Parameters<APIRoute>[0]['cookies']): boolean {
  return !!verifySession(cookies.get(SESSION_COOKIE)?.value ?? '');
}

export const GET: APIRoute = async () => {
  const { data, error } = await db
    .from('stack_sections')
    .select('*, stack_items(*)')
    .order('order_index', { ascending: true })
    .order('order_index', { ascending: true, referencedTable: 'stack_items' });

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!authed(cookies)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }
  const body = await request.json();
  const { data, error } = await db.from('stack_sections').insert(body).select().single();
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify(data), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  });
};

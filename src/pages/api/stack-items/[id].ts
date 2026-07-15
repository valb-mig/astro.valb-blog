import type { APIRoute } from 'astro';
import { db } from '../../../lib/db';
import { verifySession, SESSION_COOKIE } from '../../../lib/auth';

function authed(cookies: Parameters<APIRoute>[0]['cookies']): boolean {
  return !!verifySession(cookies.get(SESSION_COOKIE)?.value ?? '');
}

export const PUT: APIRoute = async ({ params, request, cookies }) => {
  if (!authed(cookies)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }
  const body = await request.json();
  const { data, error } = await db
    .from('stack_items')
    .update(body)
    .eq('id', params.id!)
    .select()
    .single();
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
};

export const DELETE: APIRoute = async ({ params, cookies }) => {
  if (!authed(cookies)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }
  const { error } = await db.from('stack_items').delete().eq('id', params.id!);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(null, { status: 204 });
};

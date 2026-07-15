import type { APIRoute } from 'astro';
import { db } from '../../../lib/db';
import { verifySession, SESSION_COOKIE } from '../../../lib/auth';
import { createUpdate } from '../../../lib/updates';

export const GET: APIRoute = async ({ cookies }) => {
  const isAdmin = !!verifySession(cookies.get(SESSION_COOKIE)?.value ?? '');

  let query = db
    .from('projects')
    .select('id,slug,title,description,date,tags,status,repo,draft')
    .order('date', { ascending: false });

  if (!isAdmin) query = query.eq('draft', false);

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
  const { data, error } = await db.from('projects').insert(body).select().single();
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  if (!data.draft) {
    await createUpdate({
      message: `Novo projeto: ${data.title}`,
      source: 'auto',
      kind: 'project',
      ref_url: `/projects/${data.slug}`,
    });
  }

  return new Response(JSON.stringify(data), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  });
};

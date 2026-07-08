import type { APIRoute } from 'astro';
import { db, calcReadingTime } from '../../../lib/db';
import { verifySession, SESSION_COOKIE } from '../../../lib/auth';

function authed(cookies: Parameters<APIRoute>[0]['cookies']): boolean {
  return !!verifySession(cookies.get(SESSION_COOKIE)?.value ?? '');
}

export const GET: APIRoute = async ({ params, cookies }) => {
  const { data, error } = await db.from('posts').select('*').eq('id', params.id!).single();
  if (error) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
  if (data.draft && !authed(cookies)) {
    return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
  }

  const { data: links } = await db.from('post_projects').select('project_id').eq('post_id', data.id);
  const projectIds = (links ?? []).map((l) => l.project_id);

  return new Response(JSON.stringify({ ...data, projectIds }), { headers: { 'Content-Type': 'application/json' } });
};

export const PUT: APIRoute = async ({ params, request, cookies }) => {
  if (!authed(cookies)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }
  const body = await request.json();
  const { projectIds, ...postFields } = body;

  const { data, error } = await db
    .from('posts')
    .update({ ...postFields, reading_time: calcReadingTime(postFields.content ?? '') })
    .eq('id', params.id!)
    .select()
    .single();
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  if (Array.isArray(projectIds)) {
    await db.from('post_projects').delete().eq('post_id', params.id!);
    if (projectIds.length) {
      const { error: linkError } = await db
        .from('post_projects')
        .insert(projectIds.map((project_id: string) => ({ post_id: params.id!, project_id })));
      if (linkError) return new Response(JSON.stringify({ error: linkError.message }), { status: 500 });
    }
  }

  return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
};

export const DELETE: APIRoute = async ({ params, cookies }) => {
  if (!authed(cookies)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }
  const { error } = await db.from('posts').delete().eq('id', params.id!);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(null, { status: 204 });
};

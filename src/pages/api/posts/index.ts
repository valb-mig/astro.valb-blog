import type { APIRoute } from 'astro';
import { db, calcReadingTime } from '../../../lib/db';
import { verifySession, SESSION_COOKIE } from '../../../lib/auth';
import { createUpdate } from '../../../lib/updates';

export const GET: APIRoute = async ({ cookies }) => {
  const isAdmin = !!verifySession(cookies.get(SESSION_COOKIE)?.value ?? '');

  let query = db
    .from('posts')
    .select('id,slug,title,description,date,tags,draft,reading_time')
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
  const { projectIds, ...postFields } = body;

  const { data, error } = await db
    .from('posts')
    .insert({ ...postFields, reading_time: calcReadingTime(postFields.content ?? '') })
    .select()
    .single();

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  if (Array.isArray(projectIds) && projectIds.length) {
    const { error: linkError } = await db
      .from('post_projects')
      .insert(projectIds.map((project_id: string) => ({ post_id: data.id, project_id })));
    if (linkError) return new Response(JSON.stringify({ error: linkError.message }), { status: 500 });
  }

  if (!data.draft) {
    await createUpdate({
      message: `Novo post: ${data.title}`,
      source: 'auto',
      kind: 'post',
      ref_url: `/posts/${data.slug}`,
    });
  }

  return new Response(JSON.stringify(data), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  });
};

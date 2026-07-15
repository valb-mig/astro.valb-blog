import type { APIRoute } from 'astro';
import { db } from '../../../lib/db';
import { verifySession, SESSION_COOKIE } from '../../../lib/auth';
import { createUpdate } from '../../../lib/updates';

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!verifySession(cookies.get(SESSION_COOKIE)?.value ?? '')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const body = await request.json();
  const { data, error } = await db.from('stack_items').insert(body).select().single();
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  const { data: section } = await db
    .from('stack_sections')
    .select('title')
    .eq('id', data.section_id)
    .single();

  await createUpdate({
    message: section ? `Nova ferramenta em ${section.title}: ${data.label}` : `Nova ferramenta: ${data.label}`,
    source: 'auto',
    kind: 'stack_item',
    ref_url: data.url ?? null,
  });

  return new Response(JSON.stringify(data), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  });
};

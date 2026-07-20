import type { APIRoute } from 'astro';
import { db } from '../../../../lib/db';
import { timingSafeStringEqual } from '../../../../lib/auth';

// Sem cookie de sessão admin — chamado por CI de fora (workflow_call em
// report-status.yml), autenticado por um token opaco por projeto
// (projects.status_token) via Authorization: Bearer.
export const POST: APIRoute = async ({ params, request }) => {
  const auth = request.headers.get('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice('Bearer '.length) : '';
  if (!token) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  const { data: project, error } = await db
    .from('projects')
    .select('status_token')
    .eq('id', params.id!)
    .single();
  if (error || !project?.status_token || !timingSafeStringEqual(token, project.status_token)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const payload = await request.json().catch(() => null);
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return new Response(JSON.stringify({ error: 'Payload deve ser um objeto JSON' }), { status: 400 });
  }

  const { error: updateError } = await db
    .from('projects')
    .update({ deploy_status: payload, deploy_status_at: new Date().toISOString() })
    .eq('id', params.id!);
  if (updateError) return new Response(JSON.stringify({ error: updateError.message }), { status: 500 });

  return new Response(null, { status: 204 });
};

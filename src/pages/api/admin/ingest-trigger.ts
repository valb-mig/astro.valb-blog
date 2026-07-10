import type { APIRoute } from 'astro';
import { Octokit } from '@octokit/rest';
import { verifySession, SESSION_COOKIE } from '../../../lib/auth';

export const POST: APIRoute = async ({ cookies }) => {
  if (!verifySession(cookies.get(SESSION_COOKIE)?.value ?? '')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const token = import.meta.env.GH_DISPATCH_TOKEN;
  const repo = import.meta.env.GH_REPO;
  if (!token || !repo) {
    return new Response(JSON.stringify({ error: 'GH_DISPATCH_TOKEN ou GH_REPO não configurados' }), {
      status: 500,
    });
  }

  const [owner, name] = repo.split('/');
  const octokit = new Octokit({ auth: token });

  try {
    await octokit.rest.actions.createWorkflowDispatch({
      owner,
      repo: name,
      workflow_id: 'ingest.yml',
      ref: 'main',
      headers: { 'X-GitHub-Api-Version': '2022-11-28' },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Falha ao disparar workflow' }),
      { status: 502 },
    );
  }

  return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
};

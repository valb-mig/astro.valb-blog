import type { APIRoute } from 'astro';
import { verifySession, SESSION_COOKIE } from '../../../lib/auth';
import {
  getIngestOrgs,
  getIngestOrgRepos,
  saveStringArraySetting,
  repoOwner,
  INGEST_ORG_REPOS_KEY,
} from '../../../lib/ingest-config';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

// Liga/desliga um repo de org no ingest. Read-modify-write fica no servidor
// (cliente só manda o delta), e o painel serializa os toggles — evita um
// clique rápido sobrescrever o outro com uma lista velha.
export const POST: APIRoute = async ({ request, cookies }) => {
  if (!verifySession(cookies.get(SESSION_COOKIE)?.value ?? '')) return json({ error: 'Unauthorized' }, 401);

  const { repo, enabled } = await request.json().catch(() => ({}));
  if (typeof repo !== 'string' || !/^[^/\s]+\/[^/\s]+$/.test(repo) || typeof enabled !== 'boolean') {
    return json({ error: 'repo (owner/name) e enabled são obrigatórios' }, 400);
  }

  const orgs = await getIngestOrgs();
  if (!orgs.some((o) => o.toLowerCase() === repoOwner(repo))) {
    return json({ error: 'repo não pertence a uma organização configurada' }, 400);
  }

  const current = await getIngestOrgRepos();
  const without = current.filter((r) => r.toLowerCase() !== repo.toLowerCase());

  try {
    await saveStringArraySetting(INGEST_ORG_REPOS_KEY, enabled ? [...without, repo] : without);
    return json({ repo, enabled });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
};

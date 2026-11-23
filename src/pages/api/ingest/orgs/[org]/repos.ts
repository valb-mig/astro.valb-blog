import type { APIRoute } from 'astro';
import { verifySession, SESSION_COOKIE } from '../../../../../lib/auth';
import { getIngestOrgRepos } from '../../../../../lib/ingest-config';
import { getReadOctokit, MISSING_READ_TOKEN_ERROR } from '../../../../../lib/github.server';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

// Repos da org (públicos + privados que o token enxerga) com o estado de
// opt-in de cada um. Ordenado por push mais recente — repo que você mexe
// hoje aparece no topo, não perdido no meio de dezenas de repos parados.
export const GET: APIRoute = async ({ params, cookies }) => {
  if (!verifySession(cookies.get(SESSION_COOKIE)?.value ?? '')) return json({ error: 'Unauthorized' }, 401);

  const octokit = getReadOctokit();
  if (!octokit) return json({ error: MISSING_READ_TOKEN_ERROR }, 500);

  try {
    const [repos, enabled] = await Promise.all([
      octokit.paginate(octokit.rest.repos.listForOrg, { org: params.org!, type: 'all', per_page: 100 }),
      getIngestOrgRepos(),
    ]);
    const enabledLower = new Set(enabled.map((r) => r.toLowerCase()));

    const data = repos
      .map((r) => ({
        repo: r.full_name,
        name: r.name,
        private: r.private,
        archived: r.archived ?? false,
        pushed_at: r.pushed_at ?? null,
        enabled: enabledLower.has(r.full_name.toLowerCase()),
      }))
      .sort((a, b) => (b.pushed_at ?? '').localeCompare(a.pushed_at ?? ''));

    return json(data);
  } catch (err) {
    return json({ error: (err as Error).message }, 502);
  }
};

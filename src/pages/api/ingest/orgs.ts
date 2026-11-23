import type { APIRoute } from 'astro';
import { verifySession, SESSION_COOKIE } from '../../../lib/auth';
import { getIngestOrgs, saveStringArraySetting, INGEST_ORGS_KEY } from '../../../lib/ingest-config';
import { getReadOctokit, MISSING_READ_TOKEN_ERROR } from '../../../lib/github.server';

const ORG_LOGIN_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

// Organizações configuradas + sugestões (orgs em que o usuário do token é
// membro). Sem token, devolve só as configuradas — o resto do painel avisa.
export const GET: APIRoute = async ({ cookies }) => {
  if (!verifySession(cookies.get(SESSION_COOKIE)?.value ?? '')) return json({ error: 'Unauthorized' }, 401);

  const configured = await getIngestOrgs();
  const octokit = getReadOctokit();
  if (!octokit) return json({ configured, suggestions: [], tokenMissing: true });

  let suggestions: string[] = [];
  try {
    const orgs = await octokit.paginate(octokit.rest.orgs.listForAuthenticatedUser, { per_page: 100 });
    const configuredLower = new Set(configured.map((o) => o.toLowerCase()));
    suggestions = orgs.map((o) => o.login).filter((login) => !configuredLower.has(login.toLowerCase()));
  } catch (err) {
    console.warn('Falha ao listar organizações do GitHub:', (err as Error).message);
  }

  return json({ configured, suggestions, tokenMissing: false });
};

// Valida a org no GitHub antes de salvar e grava o login canônico (case
// certo) — `repos.listForOrg` devolve full_name nesse case.
export const POST: APIRoute = async ({ request, cookies }) => {
  if (!verifySession(cookies.get(SESSION_COOKIE)?.value ?? '')) return json({ error: 'Unauthorized' }, 401);

  const { org } = await request.json().catch(() => ({ org: null }));
  if (typeof org !== 'string' || !ORG_LOGIN_RE.test(org.trim())) {
    return json({ error: 'nome de organização inválido' }, 400);
  }

  const octokit = getReadOctokit();
  if (!octokit) return json({ error: MISSING_READ_TOKEN_ERROR }, 500);

  let login: string;
  try {
    const { data } = await octokit.rest.orgs.get({ org: org.trim() });
    login = data.login;
  } catch (err) {
    const status = (err as { status?: number }).status;
    if (status === 404) return json({ error: `organização "${org.trim()}" não encontrada` }, 400);
    return json({ error: (err as Error).message }, 502);
  }

  const current = await getIngestOrgs();
  if (current.some((o) => o.toLowerCase() === login.toLowerCase())) return json({ configured: current });

  try {
    const configured = await saveStringArraySetting(INGEST_ORGS_KEY, [...current, login]);
    return json({ configured });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
};

// Remove só a org da lista — repos dela que estavam ligados continuam salvos
// em `ingest_org_repos` (inertes, o ingest só lista repos de org configurada),
// então readicionar a org restaura a seleção anterior.
export const DELETE: APIRoute = async ({ request, cookies }) => {
  if (!verifySession(cookies.get(SESSION_COOKIE)?.value ?? '')) return json({ error: 'Unauthorized' }, 401);

  const { org } = await request.json().catch(() => ({ org: null }));
  if (typeof org !== 'string') return json({ error: 'org é obrigatório' }, 400);

  const current = await getIngestOrgs();
  try {
    const configured = await saveStringArraySetting(
      INGEST_ORGS_KEY,
      current.filter((o) => o.toLowerCase() !== org.toLowerCase()),
    );
    return json({ configured });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
};

import { db } from './db';
import { getSetting } from './settings';

// Organizações do GitHub cujos repos podem entrar no ingest, e quais repos
// delas foram ligados (opt-in por repo, `owner/name`). Ficam na tabela
// `settings` como array JSON — sem schema novo. Lido pelo admin (modal de
// settings) e por `scripts/ingest.ts`.
export const INGEST_ORGS_KEY = 'ingest_orgs';
export const INGEST_ORG_REPOS_KEY = 'ingest_org_repos';

function parseStringArray(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

export async function getIngestOrgs(): Promise<string[]> {
  return parseStringArray(await getSetting(INGEST_ORGS_KEY));
}

export async function getIngestOrgRepos(): Promise<string[]> {
  return parseStringArray(await getSetting(INGEST_ORG_REPOS_KEY));
}

export async function saveStringArraySetting(key: string, values: string[]): Promise<string[]> {
  const unique = [...new Set(values)].sort((a, b) => a.localeCompare(b));
  const { error } = await db
    .from('settings')
    .upsert({ key, value: JSON.stringify(unique), updated_at: new Date().toISOString() });
  if (error) throw error;
  return unique;
}

export function repoOwner(fullName: string): string {
  return fullName.split('/')[0].toLowerCase();
}

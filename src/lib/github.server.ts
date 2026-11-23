import { Octokit } from '@octokit/rest';

// Token só-leitura usado pelo admin pra listar organizações/repos no modal de
// settings. Separado do GH_TOKEN do ingest (que roda no GitHub Actions) pra
// não precisar expor um token com escopo amplo no runtime da Vercel.
export function getReadOctokit(): Octokit | null {
  const token = import.meta.env.GH_READ_TOKEN;
  return token ? new Octokit({ auth: token }) : null;
}

export const MISSING_READ_TOKEN_ERROR = 'GH_READ_TOKEN não configurado';

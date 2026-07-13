import { Octokit as OctokitCore } from '@octokit/rest';
import { throttling } from '@octokit/plugin-throttling';
import { retry } from '@octokit/plugin-retry';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';
import { db, calcReadingTime, type SourceEvent } from '../src/lib/db.ts';
import { getLlmProvider, type LlmStrategy } from '../src/lib/llm.ts';
import { getWakatimeSummaryForDate, type WakatimeDaySummary } from '../src/lib/wakatime.ts';

const execFileAsync = promisify(execFile);

const GH_TOKEN = process.env.GH_TOKEN;
const GH_USERNAME = process.env.GH_USERNAME;

if (!GH_TOKEN || !GH_USERNAME) {
  throw new Error('Faltam env vars: GH_TOKEN, GH_USERNAME');
}

// throttling/retry tratam rate limit primário e secundário (respeita
// Retry-After em vez de estourar erro e matar a run inteira por um 403/429).
const Octokit = OctokitCore.plugin(throttling, retry);
const octokit = new Octokit({
  auth: GH_TOKEN,
  throttle: {
    onRateLimit: (retryAfter: number, options: any) => {
      console.warn(`Rate limit primário atingido em ${options.method} ${options.url}, retry em ${retryAfter}s`);
      return true;
    },
    onSecondaryRateLimit: (retryAfter: number, options: any) => {
      console.warn(`Rate limit secundário (abuso) em ${options.method} ${options.url}, retry em ${retryAfter}s`);
      return true;
    },
  },
});
type NewEvent = Omit<SourceEvent, 'id' | 'created_at'>;

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function uniqueProjectSlug(name: string): Promise<string> {
  const base = slugify(name);
  let slug = base;
  let n = 2;
  while (true) {
    const { data } = await db.from('projects').select('id').eq('slug', slug).maybeSingle();
    if (!data) return slug;
    slug = `${base}-${n++}`;
  }
}

async function fetchOwnedRepos() {
  return octokit.paginate(octokit.rest.repos.listForAuthenticatedUser, {
    affiliation: 'owner',
    per_page: 100,
  });
}

async function fetchRepoReadme(owner: string, repo: string): Promise<string> {
  try {
    const { data } = await octokit.rest.repos.getReadme({ owner, repo });
    return Buffer.from(data.content, 'base64').toString('utf-8');
  } catch {
    return '';
  }
}

// Sync diário: cria projeto pra cada repo público do GitHub que ainda não tem
// registro em `projects` (match pela coluna repo = "owner/name"). Nunca
// sobrescreve um projeto existente — edição manual no admin nunca se perde.
// Repos privados nunca entram aqui — o blog é público, não deve expor nome,
// descrição nem URL de repositório privado.
async function syncProjectsFromGithub(ownedRepos: Awaited<ReturnType<typeof fetchOwnedRepos>>): Promise<void> {
  const repos = ownedRepos.filter((r) => !r.private);

  if (!repos.length) return;

  const { data: existing, error: existingError } = await db.from('projects').select('repo').not('repo', 'is', null);
  if (existingError) throw existingError;

  const existingRepos = new Set((existing ?? []).map((p) => p.repo));
  const newRepos = repos.filter((r) => !existingRepos.has(r.full_name));

  if (!newRepos.length) {
    console.log('Nenhum projeto novo pra sincronizar do GitHub.');
    return;
  }

  for (const repo of newRepos) {
    const slug = await uniqueProjectSlug(repo.name);
    const [owner, name] = repo.full_name.split('/');
    const content = await fetchRepoReadme(owner, name);
    const { error } = await db.from('projects').insert({
      slug,
      title: repo.name,
      description: repo.description ?? '',
      content,
      date: repo.created_at ?? new Date().toISOString(),
      tags: repo.topics ?? [],
      status: repo.archived ? 'archived' : 'active',
      repo: repo.full_name,
      draft: false,
    });
    if (error) console.warn(`Falha ao criar projeto pro repo ${repo.full_name}:`, error.message);
  }

  console.log(`${newRepos.length} projeto(s) novo(s) sincronizado(s) do GitHub.`);
}

// Roda todo dia junto do sync de projetos: recalcula % de linguagens por
// repo (via GitHub linguist) pra todo projeto com `repo` setado, novo ou
// existente. Falha por projeto (repo renomeado/deletado) não derruba a run.
async function syncProjectLanguages(): Promise<void> {
  const { data: projects, error } = await db.from('projects').select('id, repo').not('repo', 'is', null);
  if (error) throw error;
  if (!projects?.length) return;

  let updated = 0;
  for (const project of projects) {
    const [owner, name] = (project.repo as string).split('/');
    try {
      const { data: bytesByLanguage } = await octokit.rest.repos.listLanguages({ owner, repo: name });
      const total = Object.values(bytesByLanguage).reduce((sum, bytes) => sum + bytes, 0);
      if (!total) continue;

      const languages = Object.fromEntries(
        Object.entries(bytesByLanguage).map(([lang, bytes]) => [lang, Math.round((bytes / total) * 1000) / 10]),
      );

      const { error: updateError } = await db.from('projects').update({ languages }).eq('id', project.id);
      if (updateError) console.warn(`Falha ao salvar linguagens de ${project.repo}:`, updateError.message);
      else updated++;
    } catch (err) {
      console.warn(`Falha ao buscar linguagens de ${project.repo}:`, (err as Error).message);
    }
  }
  console.log(`Linguagens atualizadas em ${updated}/${projects.length} projeto(s).`);
}

const INGEST_CACHE_DIR = new URL('../.ingest-cache/', import.meta.url).pathname;

function mirrorDirFor(fullName: string): string {
  return `${INGEST_CACHE_DIR}${fullName.replace('/', '__')}.git`;
}

// Bare mirror por repo em `.ingest-cache/` — sem checkout de working tree,
// só objetos+refs, suficiente pra `git log`. `--depth` limita o fetch a N
// commits (não clone completo), barato mesmo pra repo antigo.
// `--shallow-since` faria mais sentido semanticamente, mas bate num bug
// conhecido do git client contra o smart-HTTP do GitHub ("error processing
// shallow info: 4") em vários repos reais testados aqui — `--depth` não tem
// esse problema e cobre o mesmo caso de uso (volume de commit diário é
// sempre << 100).
const MIRROR_DEPTH = 100;

async function syncRepoMirror(fullName: string): Promise<string> {
  const dir = mirrorDirFor(fullName);
  const authedUrl = `https://x-access-token:${GH_TOKEN}@github.com/${fullName}.git`;

  if (existsSync(dir)) {
    await execFileAsync('git', ['--git-dir', dir, 'fetch', '--depth', String(MIRROR_DEPTH), 'origin', '+refs/heads/*:refs/heads/*']);
  } else {
    await execFileAsync('git', ['clone', '--bare', '--depth', String(MIRROR_DEPTH), authedUrl, dir]);
  }
  return dir;
}

const GIT_LOG_SEP = '\x1f';

async function fetchCommitsFromGitLog(fullName: string, dir: string, date: string): Promise<NewEvent[]> {
  const since = `${date}T00:00:00Z`;
  const until = `${date}T23:59:59Z`;
  const { stdout } = await execFileAsync('git', [
    '--git-dir',
    dir,
    'log',
    '--all',
    `--since=${since}`,
    `--until=${until}`,
    `--pretty=format:%H${GIT_LOG_SEP}%s${GIT_LOG_SEP}%aI${GIT_LOG_SEP}%an`,
  ]);

  if (!stdout.trim()) return [];

  return stdout
    .trim()
    .split('\n')
    .map((line) => {
      const [sha, subject, authorDate, authorName] = line.split(GIT_LOG_SEP);
      return {
        source: 'github',
        type: 'commit' as const,
        external_id: sha,
        repo: fullName,
        url: `https://github.com/${fullName}/commit/${sha}`,
        title: subject,
        payload: { message: subject, author: authorName ?? null },
        occurred_at: authorDate,
      };
    });
}

// Troca a Events API (retém ~90 dias, só commit sobrevive dessa troca — issue/PR/release
// não são mais capturados) por leitura direta de `git log` num mirror bare local.
async function fetchRecentEvents(publicRepoNames: Set<string>, date: string): Promise<NewEvent[]> {
  const mapped: NewEvent[][] = [];
  for (const fullName of publicRepoNames) {
    try {
      const dir = await syncRepoMirror(fullName);
      mapped.push(await fetchCommitsFromGitLog(fullName, dir, date));
    } catch (err) {
      console.warn(`Falha ao ler git log de ${fullName}:`, (err as Error).message);
    }
  }
  return mapped.flat();
}

// `.upsert(..., { ignoreDuplicates: true }).select('*')` não retorna de forma
// determinística só as linhas realmente inseridas — o RETURNING do
// ON CONFLICT DO NOTHING varia por versão do PostgREST, às vezes vindo com
// linhas que já existiam. Calcula o subconjunto novo consultando antes do
// upsert, em vez de confiar em `inserted.length` (que fazia o log imprimir
// contagem errada e, pior, podia pular o `if (!insertedCount && !force) return`
// e reconstruir o post à toa num rerun sem evento novo de fato).
async function filterTrulyNewEvents(events: NewEvent[]): Promise<NewEvent[]> {
  if (!events.length) return [];

  const { data: existing, error } = await db
    .from('source_events')
    .select('type, external_id, repo')
    .in(
      'external_id',
      events.map((e) => e.external_id),
    );
  if (error) throw error;

  const existingKeys = new Set((existing ?? []).map((e) => `${e.type}|${e.external_id}|${e.repo}`));
  return events.filter((e) => !existingKeys.has(`${e.type}|${e.external_id}|${e.repo}`));
}

const CONVENTIONAL_COMMIT_RE = /^(\w+)(\([^)]*\))?:\s*(.+)$/;
const MERGE_PR_RE = /^Merge pull request #(\d+)/;

function parseConventionalCommit(title: string): { type: string; description: string } | null {
  const match = title.match(CONVENTIONAL_COMMIT_RE);
  if (!match) return null;
  return { type: match[1].toLowerCase(), description: match[3] };
}

function extractMergedPrNumber(title: string): string | null {
  const match = title.match(MERGE_PR_RE);
  return match ? match[1] : null;
}

// GitHub gera um commit "Merge pull request #N..." pro mesmo merge que já vira
// um PullRequestEvent(action: closed, merged: true) — sem isso a mesma ação
// conta duas vezes no resumo do dia.
function dedupeMergeCommits(events: SourceEvent[]): SourceEvent[] {
  return events.filter((e) => {
    if (e.type !== 'commit') return true;
    const prNumber = extractMergedPrNumber(e.title);
    if (!prNumber) return true;

    const hasMergedPr = events.some(
      (other) =>
        other.type === 'pull_request' &&
        other.repo === e.repo &&
        other.external_id === prNumber &&
        (other.payload as { merged?: boolean })?.merged,
    );
    return !hasMergedPr;
  });
}

type RepoGroup = {
  commitsByType: Record<string, number>;
  commitEvents: SourceEvent[];
  issues: SourceEvent[];
  releases: SourceEvent[];
  pullRequests: SourceEvent[];
};

function groupByRepo(events: SourceEvent[]): Record<string, RepoGroup> {
  const groups: Record<string, RepoGroup> = {};

  for (const e of events) {
    const group = (groups[e.repo] ??= {
      commitsByType: {},
      commitEvents: [],
      issues: [],
      releases: [],
      pullRequests: [],
    });

    if (e.type === 'commit') {
      const type = parseConventionalCommit(e.title)?.type ?? 'other';
      group.commitsByType[type] = (group.commitsByType[type] ?? 0) + 1;
      group.commitEvents.push(e);
    } else if (e.type === 'issue') {
      group.issues.push(e);
    } else if (e.type === 'release') {
      group.releases.push(e);
    } else if (e.type === 'pull_request') {
      group.pullRequests.push(e);
    }
  }

  return groups;
}

function repoActivityCount(g: RepoGroup): number {
  return g.commitEvents.length + g.issues.length + g.releases.length + g.pullRequests.length;
}

function sortedRepoEntries(groups: Record<string, RepoGroup>): Array<[string, RepoGroup]> {
  return Object.entries(groups).sort(([, a], [, b]) => repoActivityCount(b) - repoActivityCount(a));
}

const COMMIT_TYPE_ORDER = ['feat', 'fix', 'docs', 'refactor', 'perf', 'test', 'build', 'ci', 'style', 'chore'];

function formatCommitCounts(commitsByType: Record<string, number>): string {
  const parts = COMMIT_TYPE_ORDER.filter((t) => commitsByType[t]).map((t) => `${commitsByType[t]} ${t}`);
  const otherCount = Object.entries(commitsByType)
    .filter(([t]) => !COMMIT_TYPE_ORDER.includes(t))
    .reduce((sum, [, n]) => sum + n, 0);
  if (otherCount) parts.push(`${otherCount} outros`);
  return parts.join(', ');
}

function buildRepoSummaryLines(groups: Record<string, RepoGroup>): string[] {
  return sortedRepoEntries(groups).map(([repo, g]) => {
    const parts: string[] = [];
    if (g.commitEvents.length) {
      parts.push(`${g.commitEvents.length} commit(s) (${formatCommitCounts(g.commitsByType)})`);
    }
    if (g.pullRequests.length) parts.push(`${g.pullRequests.length} PR(s)`);
    if (g.issues.length) parts.push(`${g.issues.length} issue(s)`);
    if (g.releases.length) parts.push(`${g.releases.length} release(s)`);
    return `${repo}: ${parts.join(', ')}`;
  });
}

function buildHighlightLines(groups: Record<string, RepoGroup>): string[] {
  const lines: string[] = [];
  for (const [repo, g] of sortedRepoEntries(groups)) {
    for (const r of g.releases) lines.push(`release ${r.title} em ${repo}`);
    for (const pr of g.pullRequests) {
      if ((pr.payload as { merged?: boolean })?.merged) lines.push(`PR merged em ${repo}: ${pr.title}`);
    }
  }
  return lines;
}

function repoHighlightTitles(g: RepoGroup): string[] {
  const titles: string[] = [];
  for (const r of g.releases) titles.push(`release ${r.title}`);
  for (const pr of g.pullRequests) {
    if ((pr.payload as { merged?: boolean })?.merged) titles.push(`PR merged: ${pr.title}`);
  }
  return titles;
}

const SAMPLE_DESCRIPTIONS_PER_REPO = 5;

function buildRepoNarrativeInput(
  groups: Record<string, RepoGroup>,
  newRepos: Set<string>,
  repoDescriptions: Record<string, string | null>,
): Record<string, unknown> {
  const input: Record<string, unknown> = {};
  for (const [repo, g] of sortedRepoEntries(groups)) {
    const sampleDescriptions = g.commitEvents
      .slice(0, SAMPLE_DESCRIPTIONS_PER_REPO)
      .map((c) => parseConventionalCommit(c.title)?.description ?? c.title);

    input[repo] = {
      isNewProject: newRepos.has(repo),
      repoDescription: repoDescriptions[repo] ?? null,
      totalCommits: g.commitEvents.length,
      commitSummary: g.commitEvents.length ? formatCommitCounts(g.commitsByType) : null,
      sampleDescriptions,
      issueCount: g.issues.length,
      prCount: g.pullRequests.length,
      releaseCount: g.releases.length,
      highlights: repoHighlightTitles(g),
    };
  }
  return input;
}

// Compara com a data de criação real do repo no GitHub — não com o histórico
// de `source_events` no banco. Esse histórico só existe a partir de quando o
// pipeline passou a rodar; num backfill (ou logo após o pipeline nascer) todo
// repo aparece "sem histórico antes da data" e seria marcado como novo, mesmo
// tendo sido criado meses atrás.
function detectNewRepos(repos: string[], date: string, repoCreatedAt: Map<string, string | null>): Set<string> {
  const result = new Set<string>();
  for (const repo of repos) {
    const createdAt = repoCreatedAt.get(repo);
    if (createdAt && createdAt.slice(0, 10) === date) result.add(repo);
  }
  return result;
}

// Descrição do repo no GitHub costuma carregar o "porquê" do projeto — a
// única fonte pra isso além de commit messages. Só busca pros repos novos do
// dia (baixo volume); falha isolada não derruba a run, só fica sem descrição.
async function fetchRepoDescriptions(repos: string[]): Promise<Record<string, string | null>> {
  const entries: Array<[string, string | null]> = [];
  for (const repo of repos) {
    const [owner, name] = repo.split('/');
    try {
      const { data } = await octokit.rest.repos.get({ owner, repo: name });
      entries.push([repo, data.description ?? null]);
    } catch (err) {
      console.warn(`Não consegui buscar a descrição de ${repo}:`, (err as Error).message);
      entries.push([repo, null]);
    }
  }
  return Object.fromEntries(entries);
}

async function normalizeActivity(llm: LlmStrategy, groups: Record<string, RepoGroup>): Promise<string> {
  const summaryLines = buildRepoSummaryLines(groups);
  const highlightLines = buildHighlightLines(groups);

  const system = [
    'Você normaliza atividade técnica de GitHub em um parágrafo curto de blog pessoal, em primeira pessoa, tom direto e informal, em português do Brasil.',
    'Não invente detalhes que não estão no resumo.',
    'Nunca cite nomes ou mensagens de commits individuais — eles não aparecem no texto, só os totais por projeto e os destaques (release/PR) importam.',
    'Não liste os projetos um por um em formato de lista — fale em tom corrido, como quem está contando o dia pra alguém.',
    'Evite aberturas genéricas tipo "Hoje foi um dia produtivo" — comece pelo destaque mais concreto do dia (um release, um PR importante) se houver algum; se não houver destaque, seja específico sobre o volume real (quantos commits, em quantos projetos) em vez de frase de efeito vazia.',
    'Máximo 4 frases.',
  ].join(' ');
  const user = `Resumo por projeto:\n${summaryLines.join('\n')}\n\nDestaques do dia:\n${highlightLines.length ? highlightLines.join('\n') : 'nenhum'}\n\nEscreva o parágrafo.`;

  const text = await llm.complete({ system, user });
  return text || summaryLines.join('\n');
}

// 1 chamada só pedindo JSON com todos os repos, em vez de 1 chamada por repo —
// evita repetir o system prompt N vezes no mesmo dia. Se o JSON vier
// malformado, degrada pra "sem parágrafo por repo" em vez de derrubar a run.
async function generateRepoNarratives(
  llm: LlmStrategy,
  groups: Record<string, RepoGroup>,
  date: string,
  repoCreatedAt: Map<string, string | null>,
): Promise<Record<string, string>> {
  const repos = Object.keys(groups);
  if (!repos.length) return {};

  const newRepos = detectNewRepos(repos, date, repoCreatedAt);
  const repoDescriptions = await fetchRepoDescriptions([...newRepos]);
  const input = buildRepoNarrativeInput(groups, newRepos, repoDescriptions);

  const system = [
    'Você recebe dados de atividade técnica de GitHub por projeto e devolve APENAS um objeto JSON válido, sem markdown, sem texto fora do JSON.',
    'O objeto tem uma chave por nome de projeto (exatamente igual ao que veio no input) e o valor é um parágrafo curto (1 a 2 frases) em primeira pessoa, tom direto e informal, em português do Brasil, contando o que foi feito naquele projeto.',
    'Use "sampleDescriptions" pra dar contexto real e específico — parafraseie o que elas indicam sobre o trabalho, mas nunca cite a string literal de uma descrição. Não cite títulos de issues, eles já aparecem em bullets logo abaixo no post.',
    'Se "isNewProject" for true, mencione naturalmente que o projeto foi criado hoje (ex: "criei o projeto X hoje para..."). Se "repoDescription" não for null, use ele como fonte primária do propósito do projeto (é a descrição real que o usuário escreveu no GitHub); senão infira a partir de sampleDescriptions se der pra perceber algo concreto; se nenhum dos dois ajudar, só diga que criou o projeto.',
    'Não invente detalhes que não estão nos dados do projeto.',
    'Cite pelo nome os destaques (release/PR merged) quando existirem.',
    'Se o projeto teve só 1 ou 2 commits e não é novo, o parágrafo pode ter só 1 frase curta.',
  ].join(' ');
  const user = `Dados por projeto:\n${JSON.stringify(input, null, 2)}\n\nDevolva o JSON com um parágrafo por projeto.`;

  const raw = await llm.complete({ system, user, json: true });

  try {
    const parsed = JSON.parse(raw);
    const narratives: Record<string, string> = {};
    for (const repo of repos) {
      if (typeof parsed[repo] === 'string') narratives[repo] = parsed[repo];
    }
    return narratives;
  } catch {
    console.warn('LLM devolveu JSON inválido pras narrativas por repo — post sai sem esses parágrafos.', raw);
    return {};
  }
}

// Ignora dia com pouquíssimo tempo registrado (IDE aberto sem uso real etc.) —
// só vira post quando há atividade de fato pra contar.
const WAKATIME_MIN_SECONDS = 5 * 60;

function buildWakatimeSummaryLine(summary: WakatimeDaySummary): string {
  const langs = summary.languages.map((l) => `${l.name} (${l.text})`).join(', ');
  const projects = summary.projects.map((p) => `${p.name} (${p.text})`).join(', ');
  return `Tempo total codando: ${summary.totalText}.${langs ? ` Linguagens: ${langs}.` : ''}${projects ? ` Projetos: ${projects}.` : ''}`;
}

async function normalizeWakatimeActivity(llm: LlmStrategy, summary: WakatimeDaySummary): Promise<string> {
  const system = [
    'Você normaliza estatísticas de tempo de código em um parágrafo curto de blog pessoal, em primeira pessoa, tom direto e informal, em português do Brasil.',
    'O usuário não fez nenhum commit nesse dia, mas passou tempo codando — conte isso normalmente, como só mais um tipo de dia de trabalho, sem soar como desculpa ou pedido de desculpas.',
    'Não invente detalhes que não estão no resumo — fale só em termos de tempo total e das linguagens/projetos predominantes que vieram nos dados.',
    'Não cite a ferramenta de tracking pelo nome nem a palavra "commit".',
    'Máximo 3 frases.',
  ].join(' ');
  const user = `${buildWakatimeSummaryLine(summary)}\n\nEscreva o parágrafo.`;

  const text = await llm.complete({ system, user });
  return text || buildWakatimeSummaryLine(summary);
}

function buildWakatimeDetailsBlock(summary: WakatimeDaySummary): string {
  if (!summary.languages.length) return '';
  const langLines = summary.languages.map((l) => `- ${l.name}: ${l.text} (${l.percent.toFixed(1)}%)`).join('\n');
  return `<details>\n<summary>Estatísticas do dia — ${summary.totalText}</summary>\n\n${langLines}\n\n</details>`;
}

function buildWakatimePostContent(narrative: string, summary: WakatimeDaySummary): string {
  return [narrative, buildWakatimeDetailsBlock(summary)].filter(Boolean).join('\n\n---\n\n');
}

// Chamado só quando o dia não teve nenhum commit em nenhum repo — em vez de
// não gerar post nenhum, usa o tempo de código real (Wakatime) pra montar o
// mesmo tipo de post "atividade" do dia, só que com narrativa baseada em
// tempo/linguagem em vez de commits/PRs/releases.
async function tryBuildWakatimeFallbackPost(
  date: string,
  slug: string,
  force: boolean,
): Promise<{ built: boolean; llmFallbackUsed: boolean }> {
  const summary = await getWakatimeSummaryForDate(date);
  if (!summary || summary.totalSeconds < WAKATIME_MIN_SECONDS) {
    console.log(`Nenhum commit e sem dado relevante de Wakatime em ${date}.`);
    return { built: false, llmFallbackUsed: false };
  }

  const { data: existingPost } = await db.from('posts').select('id').eq('slug', slug).maybeSingle();
  if (existingPost && !force) {
    console.log(`Post "${slug}" já existe, não reconstruído a partir do Wakatime sem --force.`);
    return { built: false, llmFallbackUsed: false };
  }

  const llm = await getLlmProvider();
  const narrative = await normalizeWakatimeActivity(llm, summary);
  const content = buildWakatimePostContent(narrative, summary);

  const postId = existingPost ? existingPost.id : await getOrCreatePostId(slug, date);
  const { error: updateError } = await db
    .from('posts')
    .update({ content, reading_time: calcReadingTime(content) })
    .eq('id', postId);
  if (updateError) throw updateError;

  await linkPostToProjects(postId, []);

  console.log(`Post "${slug}" construído a partir de dados do Wakatime (sem commits em ${date}).`);
  return { built: true, llmFallbackUsed: llm.usedFallback ?? false };
}

function buildCommitsDetailsBlock(groups: Record<string, RepoGroup>): string {
  const total = Object.values(groups).reduce((sum, g) => sum + g.commitEvents.length, 0);
  if (!total) return '';

  const sections = sortedRepoEntries(groups)
    .filter(([, g]) => g.commitEvents.length > 0)
    .map(([repo, g]) => {
      const lines = g.commitEvents.map((c) => `- [${c.title}](${c.url})`).join('\n');
      return `**${repo}**\n\n${lines}`;
    })
    .join('\n\n');

  return `<details>\n<summary>${total} commit${total > 1 ? 's' : ''}</summary>\n\n${sections}\n\n</details>`;
}

function buildRepoSection(repo: string, g: RepoGroup, narrative: string | undefined): string {
  const parts = [`## ${repo}`];
  if (narrative) parts.push(narrative);

  if (g.releases.length) {
    parts.push(`### releases\n${g.releases.map((r) => `- 🚀 [${r.title}](${r.url})`).join('\n')}`);
  }
  if (g.pullRequests.length) {
    parts.push(
      `### PRs\n${g.pullRequests
        .map((pr) => `- ${(pr.payload as { merged?: boolean })?.merged ? 'merged' : 'aberta'}: [${pr.title}](${pr.url})`)
        .join('\n')}`,
    );
  }
  if (g.issues.length) {
    parts.push(`### issues\n${g.issues.map((issue) => `- [${issue.title}](${issue.url})`).join('\n')}`);
  }

  return parts.join('\n\n');
}

function buildPostContent(
  narrative: string,
  groups: Record<string, RepoGroup>,
  repoNarratives: Record<string, string>,
): string {
  const repoSections = sortedRepoEntries(groups)
    .map(([repo, g]) => buildRepoSection(repo, g, repoNarratives[repo]))
    .join('\n\n');

  return [narrative, repoSections, buildCommitsDetailsBlock(groups)].filter(Boolean).join('\n\n---\n\n');
}

function slugForDate(date: string): string {
  return `atividade-${date}`;
}

async function getOrCreatePostId(slug: string, date: string): Promise<string> {
  const { data: existing } = await db.from('posts').select('id').eq('slug', slug).maybeSingle();
  if (existing) return existing.id;

  const { data: inserted, error } = await db
    .from('posts')
    .insert({
      slug,
      title: `Atividade — ${new Date(`${date}T12:00:00.000Z`).toLocaleDateString('pt-BR')}`,
      description: 'Resumo automático da atividade do dia.',
      content: '',
      draft: true,
      tags: ['activity'],
      reading_time: 1,
    })
    .select('id')
    .single();

  if (error || !inserted) throw error ?? new Error('Falha ao criar post de atividade');
  return inserted.id;
}

// Conteúdo é sempre reconstruído a partir de TODOS os eventos do dia (não só
// os novos desta run) — evita que uma segunda run no mesmo dia sobrescreva o
// post perdendo referências já linkadas antes.
async function fetchAllEventsForPost(postId: string): Promise<SourceEvent[]> {
  const { data: links, error: linksError } = await db
    .from('post_events')
    .select('event_id')
    .eq('post_id', postId);
  if (linksError) throw linksError;

  const eventIds = (links ?? []).map((l) => l.event_id);
  if (!eventIds.length) return [];

  const { data: events, error: eventsError } = await db.from('source_events').select('*').in('id', eventIds);
  if (eventsError) throw eventsError;

  return (events ?? []) as SourceEvent[];
}

// Post do dia linkado aos projetos com atividade (match projects.repo).
// Substitui os links a cada rebuild — reflete só os repos do dia atual.
async function linkPostToProjects(postId: string, repos: string[]): Promise<void> {
  await db.from('post_projects').delete().eq('post_id', postId);
  if (!repos.length) return;

  const { data: matched, error } = await db.from('projects').select('id').in('repo', repos);
  if (error) throw error;
  if (!matched?.length) return;

  const { error: linkError } = await db
    .from('post_projects')
    .insert(matched.map((p) => ({ post_id: postId, project_id: p.id })));
  if (linkError) throw linkError;
}

async function rebuildPostContent(
  postId: string,
  date: string,
  repoCreatedAt: Map<string, string | null>,
): Promise<{ totalEvents: number; fallbackUsed: boolean }> {
  const allEvents = await fetchAllEventsForPost(postId);
  const groups = groupByRepo(dedupeMergeCommits(allEvents));
  const llm = await getLlmProvider();

  const [narrative, repoNarratives] = await Promise.all([
    normalizeActivity(llm, groups),
    generateRepoNarratives(llm, groups, date, repoCreatedAt),
  ]);
  const content = buildPostContent(narrative, groups, repoNarratives);

  const { error: updateError } = await db
    .from('posts')
    .update({ content, reading_time: calcReadingTime(content) })
    .eq('id', postId);
  if (updateError) throw updateError;

  await linkPostToProjects(postId, Object.keys(groups));

  return { totalEvents: allEvents.length, fallbackUsed: llm.usedFallback ?? false };
}

// `ingest_runs` alimenta o dashboard do admin — grava início/fim de toda run,
// venha ela do cron, de um dispatch manual (admin) ou de `pnpm ingest:local`.
// GITHUB_EVENT_NAME é setado automaticamente pelo runner do GitHub Actions
// ('schedule' | 'workflow_dispatch'); fora dele (local) cai pra 'local'.
async function startIngestRun(date: string): Promise<string> {
  const trigger = process.env.GITHUB_EVENT_NAME ?? 'local';
  const { data, error } = await db.from('ingest_runs').insert({ target_date: date, trigger }).select('id').single();
  if (error || !data) throw error ?? new Error('Falha ao criar ingest_run');
  return data.id;
}

async function finishIngestRun(
  runId: string,
  update: {
    status: 'success' | 'error';
    events_created: number;
    llm_fallback_used: boolean;
    error_message: string | null;
  },
): Promise<void> {
  const { error } = await db
    .from('ingest_runs')
    .update({ ...update, finished_at: new Date().toISOString() })
    .eq('id', runId);
  if (error) console.warn('Falha ao atualizar ingest_run:', error.message);
}

function targetDate(): string {
  const arg = process.argv.find((a) => a.startsWith('--date='));
  const date = arg ? arg.slice('--date='.length) : new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`--date inválido: "${date}" (esperado YYYY-MM-DD)`);
  return date;
}

async function main(): Promise<void> {
  const force = process.argv.includes('--force');
  const date = targetDate();
  const slug = slugForDate(date);
  const runId = await startIngestRun(date);

  try {
    const ownedRepos = await fetchOwnedRepos();
    const publicRepoNames = new Set(ownedRepos.filter((r) => !r.private).map((r) => r.full_name));
    const repoCreatedAt = new Map(ownedRepos.map((r) => [r.full_name, r.created_at]));

    await syncProjectsFromGithub(ownedRepos);
    await syncProjectLanguages();

    const newEvents = await fetchRecentEvents(publicRepoNames, date);
    const trulyNewEvents = await filterTrulyNewEvents(newEvents);
    let insertedCount = 0;

    if (newEvents.length) {
      const { data: inserted, error } = await db
        .from('source_events')
        .upsert(newEvents, { onConflict: 'source,type,external_id,repo', ignoreDuplicates: true })
        .select('*');
      if (error) throw error;
      insertedCount = trulyNewEvents.length;

      if (inserted?.length) {
        const postId = await getOrCreatePostId(slug, date);
        const links = inserted.map((e) => ({ post_id: postId, event_id: e.id }));
        const { error: linkError } = await db
          .from('post_events')
          .upsert(links, { onConflict: 'post_id,event_id', ignoreDuplicates: true });
        if (linkError) throw linkError;
      }
    }

    if (!newEvents.length) {
      const { llmFallbackUsed } = await tryBuildWakatimeFallbackPost(date, slug, force);
      await finishIngestRun(runId, {
        status: 'success',
        events_created: 0,
        llm_fallback_used: llmFallbackUsed,
        error_message: null,
      });
      return;
    }

    if (!insertedCount && !force) {
      console.log('Eventos encontrados já haviam sido processados (dedupe).');
      await finishIngestRun(runId, {
        status: 'success',
        events_created: 0,
        llm_fallback_used: false,
        error_message: null,
      });
      return;
    }

    const { data: existingPost } = await db.from('posts').select('id').eq('slug', slug).maybeSingle();
    if (!existingPost) {
      console.log(`Nada pra reconstruir — nenhum post existente em ${date} e nenhum evento novo.`);
      await finishIngestRun(runId, {
        status: 'success',
        events_created: insertedCount,
        llm_fallback_used: false,
        error_message: null,
      });
      return;
    }

    const { totalEvents, fallbackUsed } = await rebuildPostContent(existingPost.id, date, repoCreatedAt);
    console.log(
      `Post rascunho "${slug}" atualizado com ${insertedCount} evento(s) novo(s), ${totalEvents} no total do dia.`,
    );
    await finishIngestRun(runId, {
      status: 'success',
      events_created: insertedCount,
      llm_fallback_used: fallbackUsed,
      error_message: null,
    });
  } catch (err) {
    await finishIngestRun(runId, {
      status: 'error',
      events_created: 0,
      llm_fallback_used: false,
      error_message: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

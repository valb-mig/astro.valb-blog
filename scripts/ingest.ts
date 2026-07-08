import { Octokit } from '@octokit/rest';
import Groq from 'groq-sdk';
import { db, calcReadingTime, type SourceEvent } from '../src/lib/db.ts';

const GH_TOKEN = process.env.GH_TOKEN;
const GH_USERNAME = process.env.GH_USERNAME;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

if (!GH_TOKEN || !GH_USERNAME || !GROQ_API_KEY) {
  throw new Error('Faltam env vars: GH_TOKEN, GH_USERNAME, GROQ_API_KEY');
}

const octokit = new Octokit({ auth: GH_TOKEN });
const groq = new Groq({ apiKey: GROQ_API_KEY });

type NewEvent = Omit<SourceEvent, 'id' | 'created_at'>;

async function fetchPushCommits(
  repo: string,
  before: string,
  head: string,
): Promise<Array<{ sha: string; message: string; author?: { name?: string } }>> {
  const [owner, name] = repo.split('/');
  const { data } = await octokit.rest.repos.compareCommitsWithBasehead({
    owner,
    repo: name,
    basehead: `${before}...${head}`,
  });
  return data.commits.map((c) => ({
    sha: c.sha,
    message: c.commit.message,
    author: { name: c.commit.author?.name ?? undefined },
  }));
}

async function mapGithubEvent(event: {
  type: string | null;
  repo: { name: string };
  created_at: string | null;
  payload: Record<string, any>;
}): Promise<NewEvent[]> {
  const repo = event.repo.name;
  const occurred_at = event.created_at ?? new Date().toISOString();

  switch (event.type) {
    case 'PushEvent': {
      const commits = await fetchPushCommits(repo, event.payload.before, event.payload.head);
      return commits.map((c) => ({
        source: 'github',
        type: 'commit' as const,
        external_id: c.sha,
        repo,
        url: `https://github.com/${repo}/commit/${c.sha}`,
        title: c.message.split('\n')[0],
        payload: { message: c.message, author: c.author?.name ?? null },
        occurred_at,
      }));
    }
    case 'IssuesEvent': {
      const issue = event.payload.issue;
      if (!issue?.html_url || !issue?.title) {
        console.warn(`Evento IssuesEvent sem url/title (repo pode ter virado privado): ${repo}#${issue?.number}`);
        return [];
      }
      return [
        {
          source: 'github',
          type: 'issue' as const,
          external_id: String(issue.number),
          repo,
          url: issue.html_url,
          title: issue.title,
          payload: { action: event.payload.action },
          occurred_at,
        },
      ];
    }
    case 'PullRequestEvent': {
      const pr = event.payload.pull_request;
      if (!pr?.html_url || !pr?.title) {
        console.warn(`Evento PullRequestEvent sem url/title (repo pode ter virado privado): ${repo}#${pr?.number}`);
        return [];
      }
      return [
        {
          source: 'github',
          type: 'pull_request' as const,
          external_id: String(pr.number),
          repo,
          url: pr.html_url,
          title: pr.title,
          payload: { action: event.payload.action, merged: !!pr.merged },
          occurred_at,
        },
      ];
    }
    case 'ReleaseEvent': {
      const release = event.payload.release;
      if (!release?.html_url || !(release?.name || release?.tag_name)) {
        console.warn(`Evento ReleaseEvent sem url/title (repo pode ter virado privado): ${repo}`);
        return [];
      }
      return [
        {
          source: 'github',
          type: 'release' as const,
          external_id: release.tag_name,
          repo,
          url: release.html_url,
          title: release.name || release.tag_name,
          payload: { body: release.body ?? null },
          occurred_at,
        },
      ];
    }
    default:
      return [];
  }
}

async function fetchRecentEvents(): Promise<NewEvent[]> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const { data } = await octokit.rest.activity.listEventsForAuthenticatedUser({
    username: GH_USERNAME!,
    per_page: 100,
  });

  const recent = data.filter((e) => e.created_at && new Date(e.created_at) >= since);
  const mapped = await Promise.all(recent.map((e) => mapGithubEvent(e as any)));
  return mapped.flat();
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

// Repo sem nenhum source_event anterior a hoje = provavelmente criado hoje.
// Dá pro Groq um fato concreto ("criei o projeto hoje") em vez de genérico.
async function detectNewRepos(repos: string[]): Promise<Set<string>> {
  if (!repos.length) return new Set();

  const todayStart = `${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`;
  const { data, error } = await db
    .from('source_events')
    .select('repo')
    .in('repo', repos)
    .lt('occurred_at', todayStart);
  if (error) throw error;

  const reposWithHistory = new Set((data ?? []).map((r) => r.repo));
  return new Set(repos.filter((r) => !reposWithHistory.has(r)));
}

// Descrição do repo no GitHub costuma carregar o "porquê" do projeto — a
// única fonte pra isso além de commit messages. Só busca pros repos novos do
// dia (baixo volume); falha isolada não derruba a run, só fica sem descrição.
async function fetchRepoDescriptions(repos: string[]): Promise<Record<string, string | null>> {
  const entries = await Promise.all(
    repos.map(async (repo): Promise<[string, string | null]> => {
      const [owner, name] = repo.split('/');
      try {
        const { data } = await octokit.rest.repos.get({ owner, repo: name });
        return [repo, data.description ?? null];
      } catch (err) {
        console.warn(`Não consegui buscar a descrição de ${repo}:`, (err as Error).message);
        return [repo, null];
      }
    }),
  );
  return Object.fromEntries(entries);
}

async function normalizeWithGroq(groups: Record<string, RepoGroup>): Promise<string> {
  const summaryLines = buildRepoSummaryLines(groups);
  const highlightLines = buildHighlightLines(groups);

  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      {
        role: 'system',
        content: [
          'Você normaliza atividade técnica de GitHub em um parágrafo curto de blog pessoal, em primeira pessoa, tom direto e informal, em português do Brasil.',
          'Não invente detalhes que não estão no resumo.',
          'Nunca cite nomes ou mensagens de commits individuais — eles não aparecem no texto, só os totais por projeto e os destaques (release/PR) importam.',
          'Não liste os projetos um por um em formato de lista — fale em tom corrido, como quem está contando o dia pra alguém.',
          'Evite aberturas genéricas tipo "Hoje foi um dia produtivo" — comece pelo destaque mais concreto do dia (um release, um PR importante) se houver algum; se não houver destaque, seja específico sobre o volume real (quantos commits, em quantos projetos) em vez de frase de efeito vazia.',
          'Máximo 4 frases.',
        ].join(' '),
      },
      {
        role: 'user',
        content: `Resumo por projeto:\n${summaryLines.join('\n')}\n\nDestaques do dia:\n${highlightLines.length ? highlightLines.join('\n') : 'nenhum'}\n\nEscreva o parágrafo.`,
      },
    ],
  });

  return completion.choices[0]?.message?.content?.trim() ?? summaryLines.join('\n');
}

// 1 chamada só pedindo JSON com todos os repos, em vez de 1 chamada por repo —
// evita repetir o system prompt N vezes no mesmo dia. Se o JSON vier
// malformado, degrada pra "sem parágrafo por repo" em vez de derrubar a run.
async function generateRepoNarratives(groups: Record<string, RepoGroup>): Promise<Record<string, string>> {
  const repos = Object.keys(groups);
  if (!repos.length) return {};

  const newRepos = await detectNewRepos(repos);
  const repoDescriptions = await fetchRepoDescriptions([...newRepos]);
  const input = buildRepoNarrativeInput(groups, newRepos, repoDescriptions);

  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: [
          'Você recebe dados de atividade técnica de GitHub por projeto e devolve APENAS um objeto JSON válido, sem markdown, sem texto fora do JSON.',
          'O objeto tem uma chave por nome de projeto (exatamente igual ao que veio no input) e o valor é um parágrafo curto (1 a 2 frases) em primeira pessoa, tom direto e informal, em português do Brasil, contando o que foi feito naquele projeto.',
          'Use "sampleDescriptions" pra dar contexto real e específico — parafraseie o que elas indicam sobre o trabalho, mas nunca cite a string literal de uma descrição. Não cite títulos de issues, eles já aparecem em bullets logo abaixo no post.',
          'Se "isNewProject" for true, mencione naturalmente que o projeto foi criado hoje (ex: "criei o projeto X hoje para..."). Se "repoDescription" não for null, use ele como fonte primária do propósito do projeto (é a descrição real que o usuário escreveu no GitHub); senão infira a partir de sampleDescriptions se der pra perceber algo concreto; se nenhum dos dois ajudar, só diga que criou o projeto.',
          'Não invente detalhes que não estão nos dados do projeto.',
          'Cite pelo nome os destaques (release/PR merged) quando existirem.',
          'Se o projeto teve só 1 ou 2 commits e não é novo, o parágrafo pode ter só 1 frase curta.',
        ].join(' '),
      },
      {
        role: 'user',
        content: `Dados por projeto:\n${JSON.stringify(input, null, 2)}\n\nDevolva o JSON com um parágrafo por projeto.`,
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content?.trim() ?? '';

  try {
    const parsed = JSON.parse(raw);
    const narratives: Record<string, string> = {};
    for (const repo of repos) {
      if (typeof parsed[repo] === 'string') narratives[repo] = parsed[repo];
    }
    return narratives;
  } catch {
    console.warn('Groq devolveu JSON inválido pras narrativas por repo — post sai sem esses parágrafos.', raw);
    return {};
  }
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

function todaySlug(): string {
  return `atividade-${new Date().toISOString().slice(0, 10)}`;
}

async function getOrCreatePostId(slug: string): Promise<string> {
  const { data: existing } = await db.from('posts').select('id').eq('slug', slug).maybeSingle();
  if (existing) return existing.id;

  const { data: inserted, error } = await db
    .from('posts')
    .insert({
      slug,
      title: `Atividade — ${new Date().toLocaleDateString('pt-BR')}`,
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

async function rebuildPostContent(postId: string): Promise<number> {
  const allEvents = await fetchAllEventsForPost(postId);
  const groups = groupByRepo(dedupeMergeCommits(allEvents));

  const [narrative, repoNarratives] = await Promise.all([
    normalizeWithGroq(groups),
    generateRepoNarratives(groups),
  ]);
  const content = buildPostContent(narrative, groups, repoNarratives);

  const { error: updateError } = await db
    .from('posts')
    .update({ content, reading_time: calcReadingTime(content) })
    .eq('id', postId);
  if (updateError) throw updateError;

  return allEvents.length;
}

async function main(): Promise<void> {
  const force = process.argv.includes('--force');
  const slug = todaySlug();

  const newEvents = await fetchRecentEvents();
  let insertedCount = 0;

  if (newEvents.length) {
    const { data: inserted, error } = await db
      .from('source_events')
      .upsert(newEvents, { onConflict: 'source,type,external_id,repo', ignoreDuplicates: true })
      .select('*');
    if (error) throw error;
    insertedCount = inserted?.length ?? 0;

    if (insertedCount) {
      const postId = await getOrCreatePostId(slug);
      const links = inserted!.map((e) => ({ post_id: postId, event_id: e.id }));
      const { error: linkError } = await db
        .from('post_events')
        .upsert(links, { onConflict: 'post_id,event_id', ignoreDuplicates: true });
      if (linkError) throw linkError;
    }
  }

  if (!insertedCount && !force) {
    console.log(
      newEvents.length ? 'Eventos encontrados já haviam sido processados (dedupe).' : 'Nenhum evento novo nas últimas 24h.',
    );
    return;
  }

  const { data: existingPost } = await db.from('posts').select('id').eq('slug', slug).maybeSingle();
  if (!existingPost) {
    console.log('Nada pra reconstruir — nenhum post existente hoje e nenhum evento novo.');
    return;
  }

  const totalEvents = await rebuildPostContent(existingPost.id);
  console.log(
    `Post rascunho "${slug}" atualizado com ${insertedCount} evento(s) novo(s), ${totalEvents} no total do dia.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

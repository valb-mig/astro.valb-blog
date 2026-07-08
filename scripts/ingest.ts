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
      return [
        {
          source: 'github',
          type: 'pull_request' as const,
          external_id: String(pr.number),
          repo,
          url: pr.html_url,
          title: pr.title,
          payload: { action: event.payload.action },
          occurred_at,
        },
      ];
    }
    case 'ReleaseEvent': {
      const release = event.payload.release;
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

async function normalizeWithGroq(events: SourceEvent[]): Promise<string> {
  const summary = events.map((e) => `- [${e.type}] ${e.title} (${e.repo})`).join('\n');

  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      {
        role: 'system',
        content:
          'Você normaliza atividade técnica de GitHub em um parágrafo curto de blog pessoal, em primeira pessoa, tom direto e informal, em português do Brasil. Não invente detalhes que não estão na lista.',
      },
      {
        role: 'user',
        content: `Atividade de hoje:\n${summary}\n\nEscreva um parágrafo (3 a 5 frases) contando o que foi feito hoje.`,
      },
    ],
  });

  return completion.choices[0]?.message?.content?.trim() ?? summary;
}

function todaySlug(): string {
  return `atividade-${new Date().toISOString().slice(0, 10)}`;
}

async function upsertDraftPost(body: string, events: SourceEvent[]): Promise<void> {
  const slug = todaySlug();
  const refs = events.map((e) => `- [${e.type}] [${e.title}](${e.url})`).join('\n');
  const content = `${body}\n\n---\n\n**Referências:**\n\n${refs}`;

  const { data: existing } = await db.from('posts').select('id').eq('slug', slug).maybeSingle();

  let postId: string;

  if (existing) {
    await db
      .from('posts')
      .update({ content, reading_time: calcReadingTime(content) })
      .eq('id', existing.id);
    postId = existing.id;
  } else {
    const { data: inserted, error } = await db
      .from('posts')
      .insert({
        slug,
        title: `Atividade — ${new Date().toLocaleDateString('pt-BR')}`,
        description: 'Resumo automático da atividade do dia.',
        content,
        draft: true,
        tags: ['activity'],
        reading_time: calcReadingTime(content),
      })
      .select('id')
      .single();

    if (error || !inserted) throw error ?? new Error('Falha ao criar post de atividade');
    postId = inserted.id;
  }

  const links = events.map((e) => ({ post_id: postId, event_id: e.id }));
  const { error: linkError } = await db
    .from('post_events')
    .upsert(links, { onConflict: 'post_id,event_id', ignoreDuplicates: true });

  if (linkError) throw linkError;
}

async function main(): Promise<void> {
  const newEvents = await fetchRecentEvents();

  if (!newEvents.length) {
    console.log('Nenhum evento novo nas últimas 24h.');
    return;
  }

  const { data: inserted, error } = await db
    .from('source_events')
    .upsert(newEvents, { onConflict: 'source,type,external_id,repo', ignoreDuplicates: true })
    .select('*');

  if (error) throw error;

  if (!inserted?.length) {
    console.log('Eventos encontrados já haviam sido processados (dedupe).');
    return;
  }

  const body = await normalizeWithGroq(inserted as SourceEvent[]);
  await upsertDraftPost(body, inserted as SourceEvent[]);

  console.log(`Post rascunho "${todaySlug()}" atualizado com ${inserted.length} evento(s).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

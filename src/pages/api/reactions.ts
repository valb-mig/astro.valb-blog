import type { APIRoute } from 'astro';
import { db } from '../../lib/db';
import { REACTION_EMOJIS, fingerprint, reactionRateLimitExceeded } from '../../lib/reactions';

export const GET: APIRoute = async (ctx) => {
  const postId = ctx.url.searchParams.get('post_id');
  if (!postId) return new Response(JSON.stringify({ error: 'post_id required' }), { status: 400 });

  const { data, error } = await db.from('post_reactions').select('emoji, fingerprint').eq('post_id', postId);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  const fp = fingerprint(ctx);
  const counts: Record<string, number> = {};
  const reacted: Record<string, boolean> = {};
  for (const emoji of REACTION_EMOJIS) {
    counts[emoji] = 0;
    reacted[emoji] = false;
  }
  for (const row of data ?? []) {
    counts[row.emoji] = (counts[row.emoji] ?? 0) + 1;
    if (row.fingerprint === fp) reacted[row.emoji] = true;
  }

  return new Response(JSON.stringify({ counts, reacted }), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const POST: APIRoute = async (ctx) => {
  const { post_id, emoji } = await ctx.request.json();

  if (!post_id || !REACTION_EMOJIS.includes(emoji)) {
    return new Response(JSON.stringify({ error: 'post_id/emoji inválido' }), { status: 400 });
  }

  const fp = fingerprint(ctx);
  if (reactionRateLimitExceeded(fp)) {
    return new Response(JSON.stringify({ error: 'Muitas reações, calma aí.' }), { status: 429 });
  }

  const { data: existing } = await db
    .from('post_reactions')
    .select('id')
    .eq('post_id', post_id)
    .eq('emoji', emoji)
    .eq('fingerprint', fp)
    .maybeSingle();

  // Toggle: se já reagiu com esse emoji, remove; senão, adiciona.
  const { error } = existing
    ? await db.from('post_reactions').delete().eq('id', existing.id)
    : await db.from('post_reactions').insert({ post_id, emoji, fingerprint: fp });

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  const { count } = await db
    .from('post_reactions')
    .select('*', { count: 'exact', head: true })
    .eq('post_id', post_id)
    .eq('emoji', emoji);

  return new Response(JSON.stringify({ count: count ?? 0, reacted: !existing }), {
    headers: { 'Content-Type': 'application/json' },
  });
};

import type { APIRoute } from 'astro';
import { db } from '../../lib/db';
import type { Post } from '../../lib/db';

export const GET: APIRoute = async ({ url }) => {
  const since = url.searchParams.get('since');

  let query = db
    .from('posts')
    .select('slug,title,description,date,tags')
    .eq('draft', false)
    .or('newsletter.eq.true,tags.cs.{"newsletter"}')
    .order('date', { ascending: false });

  if (since) query = query.gte('date', since);

  const { data, error } = await query;

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  const posts = (data ?? []).map((post: Pick<Post, 'slug'|'title'|'description'|'date'|'tags'>) => ({
    slug: post.slug,
    title: post.title,
    description: post.description,
    date: post.date,
    tags: post.tags,
    url: `/blog/${post.slug}`,
  }));

  return new Response(JSON.stringify(posts), {
    headers: { 'Content-Type': 'application/json' },
  });
};

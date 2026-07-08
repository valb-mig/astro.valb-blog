import rss from '@astrojs/rss';
import { db } from '../lib/db';
import type { Post } from '../lib/db';

export async function GET(context: { site: URL }) {
  const { data: posts } = await db
    .from('posts')
    .select('slug,title,description,date,tags')
    .eq('draft', false)
    .order('date', { ascending: false });

  return rss({
    title: '~/blog',
    description: 'Posts pessoais sobre dev e o que aparecer.',
    site: context.site,
    items: (posts ?? []).map((post: Pick<Post, 'slug'|'title'|'description'|'date'|'tags'>) => ({
      title: post.title,
      description: post.description,
      pubDate: new Date(post.date),
      link: `/blog/${post.slug}/`,
      categories: post.tags,
    })),
    customData: `<language>pt-BR</language>`,
  });
}

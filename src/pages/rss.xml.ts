import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { app } from '@/app';

export async function GET(context: APIContext) {
  const posts = await app.posts.list({ drafts: false });
  return rss({
    title: '~/posts',
    description: 'Posts pessoais sobre dev e o que aparecer.',
    site: context.site!,
    items: posts.map((post) => ({
      title: post.title,
      description: post.description,
      pubDate: new Date(post.date),
      link: `/posts/${post.slug}/`,
      categories: post.tags,
    })),
    customData: `<language>pt-BR</language>`,
  });
}

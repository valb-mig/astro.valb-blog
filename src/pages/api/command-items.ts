import type { APIRoute } from 'astro';
import { db } from '../../lib/db';

export const GET: APIRoute = async () => {
  const [postsRes, projectsRes] = await Promise.all([
    db.from('posts').select('slug,title,description,tags').eq('draft', false).order('date', { ascending: false }),
    db.from('projects').select('slug,title,description,status').eq('draft', false).order('date', { ascending: false }),
  ]);

  const items = [
    ...(postsRes.data ?? []).map((p) => ({
      type: 'post' as const,
      title: p.title,
      subtitle: p.description ?? '',
      href: `/posts/${p.slug}`,
    })),
    ...(projectsRes.data ?? []).map((p) => ({
      type: 'project' as const,
      title: p.title,
      subtitle: p.description ?? '',
      href: `/projects/${p.slug}`,
    })),
    { type: 'nav' as const, title: 'Home', subtitle: '/', href: '/' },
    { type: 'nav' as const, title: 'Posts', subtitle: 'todos os posts', href: '/posts' },
    { type: 'nav' as const, title: 'Projects', subtitle: 'projetos', href: '/projects' },
    { type: 'nav' as const, title: 'About', subtitle: 'sobre mim', href: '/about' },
    { type: 'nav' as const, title: 'RSS Feed', subtitle: '/rss.xml', href: '/rss.xml' },
    { type: 'action' as const, title: 'Copiar URL', subtitle: 'copia a URL atual', action: 'copy-url' },
  ];

  return new Response(JSON.stringify(items), {
    headers: { 'Content-Type': 'application/json' },
  });
};

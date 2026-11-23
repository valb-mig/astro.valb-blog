import { app } from '@/app';
import { json, route } from '@/app/http';

const nav = [
  { type: 'nav', title: 'Home', subtitle: '/', href: '/' },
  { type: 'nav', title: 'Posts', subtitle: 'todos os posts', href: '/posts' },
  { type: 'nav', title: 'Projects', subtitle: 'projetos', href: '/projects' },
  { type: 'nav', title: 'About', subtitle: 'sobre mim', href: '/about' },
  { type: 'nav', title: 'RSS Feed', subtitle: '/rss.xml', href: '/rss.xml' },
  { type: 'action', title: 'Copiar URL', subtitle: 'copia a URL atual', action: 'copy-url' },
] as const;

export const GET = route(async () => {
  const [posts, projects] = await Promise.all([
    app.posts.list({ drafts: false }),
    app.projects.list({ drafts: false }),
  ]);
  return json([
    ...posts.map((p) => ({ type: 'post', title: p.title, subtitle: p.description, href: `/posts/${p.slug}` })),
    ...projects.map((p) => ({ type: 'project', title: p.title, subtitle: p.description, href: `/projects/${p.slug}` })),
    ...nav,
  ]);
});

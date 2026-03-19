/**
 * GET /api/newsletter-posts
 *
 * Retorna posts com a tag "newsletter" (ou data-field newsletter: true),
 * prontos para serem consumidos por um serviço de envio (ex: Resend, Mailchimp, Loops).
 *
 * Uso futuro:
 *   - Um cron job (ex: GitHub Actions, Vercel Cron) chama esse endpoint
 *   - Compara com os já enviados (via KV store, banco, ou arquivo)
 *   - Envia os novos via API do serviço de email
 */
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

export const GET: APIRoute = async ({ url }) => {
  const posts = await getCollection('blog', ({ data }) => {
    if (data.draft) return false;
    // Inclui posts marcados com newsletter: true OU tag "newsletter"
    return data.newsletter || data.tags.includes('newsletter');
  });

  const sorted = posts.sort(
    (a, b) => b.data.date.valueOf() - a.data.date.valueOf()
  );

  // Opcional: filtrar por data via query param ?since=2024-01-01
  const since = url.searchParams.get('since');
  const filtered = since
    ? sorted.filter((p) => p.data.date > new Date(since))
    : sorted;

  const data = filtered.map((post) => ({
    slug: post.slug,
    title: post.data.title,
    description: post.data.description,
    date: post.data.date.toISOString(),
    tags: post.data.tags,
    url: `/blog/${post.slug}`,
  }));

  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' },
  });
};

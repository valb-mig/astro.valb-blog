/**
 * lib/newsletter.ts
 *
 * Utilitários para integração com serviços de newsletter.
 * Conecte aqui quando for implementar o envio automatizado.
 *
 * Serviços sugeridos:
 *   - Resend (https://resend.com) — simples, ótimo DX
 *   - Loops (https://loops.so) — voltado para devs
 *   - Buttondown (https://buttondown.com) — leve, focado em escrita
 */

export interface NewsletterPost {
  slug: string;
  title: string;
  description: string;
  date: string;
  tags: string[];
  url: string;
}

/**
 * Busca posts marcados para newsletter via API interna.
 * Útil em scripts de CI/CD ou edge functions.
 */
export async function fetchNewsletterPosts(
  siteUrl: string,
  since?: Date
): Promise<NewsletterPost[]> {
  const url = new URL('/api/newsletter-posts', siteUrl);
  if (since) url.searchParams.set('since', since.toISOString());

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Failed to fetch newsletter posts: ${res.status}`);
  return res.json();
}

/**
 * Formata posts em HTML simples para o corpo do email.
 * Customizar conforme o template do seu serviço.
 */
export function formatPostsAsEmail(posts: NewsletterPost[], siteUrl: string): string {
  const items = posts
    .map(
      (p) => `
    <div style="margin-bottom: 2rem;">
      <a href="${siteUrl}${p.url}" style="font-family: monospace; color: #34d399; font-size: 1rem; font-weight: bold; text-decoration: none;">
        ${p.title}
      </a>
      <p style="font-family: monospace; color: #a1a1aa; font-size: 0.875rem; margin-top: 0.5rem;">
        ${p.description}
      </p>
      <p style="font-family: monospace; color: #52525b; font-size: 0.75rem; margin-top: 0.25rem;">
        ${new Date(p.date).toLocaleDateString('pt-BR')} · ${p.tags.map((t) => `#${t}`).join(' ')}
      </p>
    </div>
  `
    )
    .join('');

  return `
    <div style="background: #09090b; padding: 2rem; max-width: 600px; margin: 0 auto;">
      <p style="font-family: monospace; color: #34d399; margin-bottom: 2rem;">~/newsletter</p>
      ${items}
      <hr style="border-color: #27272a; margin: 2rem 0;" />
      <p style="font-family: monospace; color: #52525b; font-size: 0.75rem;">
        <a href="${siteUrl}/blog" style="color: #52525b;">ver todos os posts</a>
      </p>
    </div>
  `;
}

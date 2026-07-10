import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';

// Conteúdo pode vir de README sincronizado do GitHub (projects) — não é confiável.
// marked não sanitiza HTML embutido no markdown, então filtra antes de renderizar.
const ALLOWED_TAGS = [...sanitizeHtml.defaults.allowedTags, 'img'];
const ALLOWED_ATTRIBUTES = {
  ...sanitizeHtml.defaults.allowedAttributes,
  a: [...sanitizeHtml.defaults.allowedAttributes.a, 'rel'],
  code: ['class'],
  span: ['class'],
  pre: ['class'],
  div: ['class'],
};

export async function renderMarkdown(content: string): Promise<string> {
  const html = await marked.parse(content ?? '');
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTRIBUTES,
    allowedSchemes: ['http', 'https', 'mailto'],
  });
}

import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';

const tags = [...sanitizeHtml.defaults.allowedTags, 'img'];
const attributes = {
  ...sanitizeHtml.defaults.allowedAttributes,
  a: [...sanitizeHtml.defaults.allowedAttributes.a, 'rel'],
  code: ['class'],
  span: ['class'],
  pre: ['class'],
  div: ['class'],
};

export async function render(content: string): Promise<string> {
  const html = await marked.parse(content ?? '');
  return sanitizeHtml(html, {
    allowedTags: tags,
    allowedAttributes: attributes,
    allowedSchemes: ['http', 'https', 'mailto'],
  });
}

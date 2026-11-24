import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';
import { raw, resolve } from '@/core/project/readme';

const tags = [...sanitizeHtml.defaults.allowedTags, 'img'];
const attributes = {
  ...sanitizeHtml.defaults.allowedAttributes,
  a: [...sanitizeHtml.defaults.allowedAttributes.a, 'rel'],
  code: ['class'],
  span: ['class'],
  pre: ['class'],
  div: ['class'],
};

const github = (repo: string): sanitizeHtml.IOptions['transformTags'] => ({
  img: (tag, attribs) => ({
    tagName: tag,
    attribs: { ...attribs, src: resolve(attribs.src, raw(repo)) ?? '' },
  }),
  a: (tag, attribs) => ({
    tagName: tag,
    attribs: { ...attribs, href: resolve(attribs.href, `https://github.com/${repo}/blob/HEAD/`) ?? '' },
  }),
});

export async function render(content: string, repo?: string | null): Promise<string> {
  const html = await marked.parse(content ?? '');
  return sanitizeHtml(html, {
    allowedTags: tags,
    allowedAttributes: attributes,
    allowedSchemes: ['http', 'https', 'mailto'],
    transformTags: repo ? github(repo) : undefined,
  });
}

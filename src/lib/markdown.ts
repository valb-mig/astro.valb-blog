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

const absolute = /^([a-z][a-z0-9+.-]*:|\/\/|#)/i;

export const resolve = (url: string | undefined, base: string) => {
  if (!url || absolute.test(url)) return url;
  const { pathname, search, hash } = new URL(url, 'https://repo.local/');
  return `${base}${pathname.slice(1)}${search}${hash}`;
};

const github = (repo: string): sanitizeHtml.IOptions['transformTags'] => ({
  img: (tag, attribs) => ({
    tagName: tag,
    attribs: { ...attribs, src: resolve(attribs.src, `https://raw.githubusercontent.com/${repo}/HEAD/`) ?? '' },
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

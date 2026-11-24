const absolute = /^([a-z][a-z0-9+.-]*:|\/\/|#)/i;

const badge = /shields\.io|badgen\.net|badge|\/workflows\/|codecov|coveralls|travis-ci|circleci|sonarcloud|deploy-button|vercel\.com\/button|buymeacoffee|ko-fi/i;

const iconish = /logo|icon|avatar|favicon|emoji|spinner/i;

const minimum = 300;

export const raw = (repo: string) => `https://raw.githubusercontent.com/${repo}/HEAD/`;

export const resolve = (url: string | undefined, base: string) => {
  if (!url || absolute.test(url)) return url;
  const { pathname, search, hash } = new URL(url, 'https://repo.local/');
  return `${base}${pathname.slice(1)}${search}${hash}`;
};

type Found = { src: string; width: number | null };

const attr = (tag: string, name: string) => tag.match(new RegExp(`\\b${name}\\s*=\\s*["']?([^"'\\s>]+)`, 'i'))?.[1];

const found = (content: string): Found[] => {
  const out: { at: number; found: Found }[] = [];
  for (const m of content.matchAll(/!\[[^\]]*\]\(\s*<?([^)\s>]+)/g)) out.push({ at: m.index ?? 0, found: { src: m[1], width: null } });
  for (const m of content.matchAll(/<img\b[^>]*>/gi)) {
    const src = attr(m[0], 'src');
    const width = Number.parseInt(attr(m[0], 'width') ?? '', 10);
    if (src) out.push({ at: m.index ?? 0, found: { src, width: Number.isNaN(width) ? null : width } });
  }
  return out.sort((a, b) => a.at - b.at).map((o) => o.found);
};

const fits = ({ src, width }: Found) => {
  if (src.startsWith('data:') || badge.test(src)) return false;
  if (width !== null && width < minimum) return false;
  const file = src.split(/[?#]/)[0].toLowerCase();
  if (iconish.test(file.split('/').pop() ?? '')) return false;
  return !file.endsWith('.svg') || (width !== null && width >= minimum);
};

export const hero = (content: string | null | undefined, repo: string | null) => {
  if (!content || !repo) return null;
  const pick = found(content).find(fits);
  return pick ? (resolve(pick.src, raw(repo)) ?? null) : null;
};

import iconSet from '@iconify-json/simple-icons/icons.json';

type IconEntry = { body: string; width?: number; height?: number };

const icons = iconSet.icons as Record<string, IconEntry>;
const width = iconSet.width ?? 24;
const height = iconSet.height ?? 24;
const names = Object.keys(icons);

export function svgFor(slug: string): string | null {
  const entry = icons[slug];
  if (!entry) return null;
  const w = entry.width ?? width;
  const h = entry.height ?? height;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">${entry.body}</svg>`;
}

export function searchIcons(query: string, limit = 30): { slug: string; svg: string }[] {
  const q = query.trim().toLowerCase();
  const matches = q ? names.filter((name) => name.includes(q)) : names;
  return matches.slice(0, limit).map((slug) => ({ slug, svg: svgFor(slug)! }));
}

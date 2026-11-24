export const prefix = 'atividade-';

export const slug = (date: string) => `${prefix}${date}`;

export const day = (slug: string) => slug.slice(prefix.length);

export const lead = (content: string) => {
  const first = content.split(/\n\s*---\s*\n/)[0].trim();
  return first && !first.startsWith('#') && !first.startsWith('<') ? first : null;
};

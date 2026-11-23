export const prefix = 'atividade-';

export const slug = (date: string) => `${prefix}${date}`;

export const day = (slug: string) => slug.slice(prefix.length);

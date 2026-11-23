export type Ref = { id: string; slug: string; title: string };

export type Summary = {
  id: string;
  slug: string;
  title: string;
  description: string;
  date: string;
  tags: string[];
  draft: boolean;
  readingTime: number;
  projects: Ref[];
};

export type Post = Summary & {
  content: string;
  createdAt: string;
  updatedAt: string;
};

export type Input = {
  slug: string;
  title: string;
  description: string;
  content: string;
  date: string;
  tags: string[];
  draft: boolean;
};

export type Data = Input & { readingTime: number };

export type Key = { id: string } | { slug: string };

export const readingTime = (content: string) => Math.max(1, Math.ceil(content.trim().split(/\s+/).length / 200));

export const byDate = (a: { date: string }, b: { date: string }) =>
  new Date(b.date).getTime() - new Date(a.date).getTime();

export type Status = 'active' | 'completed' | 'archived';

export type Languages = { [lang: string]: number };

export type Deploy = { [key: string]: unknown };

export type Health = {
  ci: string | null;
  ciAt: string | null;
  release: string | null;
  releaseAt: string | null;
  code: number | null;
  codeAt: string | null;
  deploy: Deploy | null;
  deployAt: string | null;
};

export type Summary = {
  id: string;
  slug: string;
  title: string;
  description: string;
  date: string;
  tags: string[];
  status: Status;
  repo: string | null;
  draft: boolean;
  languages: Languages | null;
  posts: number;
};

export type Project = Omit<Summary, 'posts'> & {
  content: string;
  parentId: string | null;
  private: boolean;
  mention: boolean;
  uptimeUrl: string | null;
  token: string | null;
  health: Health;
  createdAt: string;
  updatedAt: string;
};

export type Input = Pick<
  Project,
  | 'slug'
  | 'title'
  | 'description'
  | 'content'
  | 'date'
  | 'tags'
  | 'status'
  | 'repo'
  | 'draft'
  | 'parentId'
  | 'private'
  | 'mention'
  | 'uptimeUrl'
  | 'token'
>;

export type Card = Pick<Project, 'id' | 'slug' | 'title' | 'languages' | 'draft' | 'repo' | 'uptimeUrl' | 'health'>;

export type Repo = Pick<Project, 'id' | 'title' | 'repo' | 'mention' | 'private'>;

export type Key = { id: string } | { slug: string };

export const org = (repo: string | null, user: string | null) => {
  const owner = repo?.split('/')[0];
  return owner && user && owner.toLowerCase() !== user.toLowerCase() ? owner : null;
};

export type Source = 'manual' | 'auto';

export type Kind = 'post' | 'project' | 'stack_item';

export type Update = {
  id: string;
  message: string;
  source: Source;
  kind: Kind | null;
  url: string | null;
  createdAt: string;
};

export type Input = Omit<Update, 'id' | 'createdAt'>;

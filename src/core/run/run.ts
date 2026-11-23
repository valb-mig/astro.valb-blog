export type Status = 'running' | 'success' | 'error';

export type Run = {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  status: Status;
  date: string;
  trigger: string;
  created: number;
  fallback: boolean;
  error: string | null;
};

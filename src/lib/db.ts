import { createClient } from '@supabase/supabase-js';

export type Post = {
  id: string;
  slug: string;
  title: string;
  description: string;
  content: string;
  date: string;
  tags: string[];
  draft: boolean;
  newsletter: boolean;
  project: string | null;
  reading_time: number;
  created_at: string;
  updated_at: string;
};

export type Project = {
  id: string;
  slug: string;
  title: string;
  description: string;
  content: string;
  date: string;
  tags: string[];
  status: 'active' | 'completed' | 'archived';
  repo: string | null;
  url: string | null;
  draft: boolean;
  created_at: string;
  updated_at: string;
};

export const db = createClient(
  import.meta.env.SUPABASE_URL as string,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY as string
);

export function calcReadingTime(content: string): number {
  return Math.max(1, Math.ceil(content.trim().split(/\s+/).length / 200));
}

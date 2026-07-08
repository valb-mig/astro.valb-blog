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
  parent_project_id: string | null;
  created_at: string;
  updated_at: string;
};

export type SourceEvent = {
  id: string;
  source: string;
  type: 'commit' | 'issue' | 'pull_request' | 'release';
  external_id: string;
  repo: string;
  url: string;
  title: string;
  payload: Record<string, unknown>;
  occurred_at: string;
  created_at: string;
};

// import.meta.env é preenchido pelo Vite/Astro; fora desse contexto (ex:
// scripts/ingest.ts rodando via tsx) cai pra process.env.
const SUPABASE_URL = import.meta.env?.SUPABASE_URL ?? process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY =
  import.meta.env?.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

export const db = createClient(SUPABASE_URL as string, SUPABASE_SERVICE_ROLE_KEY as string);

export function calcReadingTime(content: string): number {
  return Math.max(1, Math.ceil(content.trim().split(/\s+/).length / 200));
}

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
  draft: boolean;
  parent_project_id: string | null;
  languages: Record<string, number> | null;
  ingest_private: boolean;
  mention_allowed: boolean;
  ci_status: string | null;
  ci_checked_at: string | null;
  latest_release: string | null;
  latest_release_at: string | null;
  uptime_url: string | null;
  last_status_code: number | null;
  last_uptime_check_at: string | null;
  status_token: string | null;
  deploy_status: Record<string, unknown> | null;
  deploy_status_at: string | null;
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

export type IngestRun = {
  id: string;
  started_at: string;
  finished_at: string | null;
  status: 'running' | 'success' | 'error';
  target_date: string;
  trigger: string;
  events_created: number;
  llm_fallback_used: boolean;
  error_message: string | null;
};

export type StackSection = {
  id: string;
  title: string;
  order_index: number;
  created_at: string;
};

export type StackItem = {
  id: string;
  section_id: string;
  label: string;
  url: string | null;
  icon: string | null;
  icon_color: string | null;
  order_index: number;
  created_at: string;
};

export type Update = {
  id: string;
  message: string;
  source: 'manual' | 'auto';
  kind: 'post' | 'project' | 'stack_item' | null;
  ref_url: string | null;
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

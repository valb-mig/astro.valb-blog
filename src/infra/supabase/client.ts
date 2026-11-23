import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type Db = SupabaseClient;

export const connect = (url: string, key: string): Db => createClient(url, key);

type Result<T> = { data: T | null; error: { message: string } | null };

export function must<T>(res: Result<T>): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

export function counted(res: { count: number | null; error: { message: string } | null }): number {
  if (res.error) throw new Error(res.error.message);
  return res.count ?? 0;
}

export const defined = <T extends object>(o: T): Partial<T> =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;

import { db } from './db';

export async function getSetting(key: string): Promise<string | null> {
  const { data, error } = await db.from('settings').select('value').eq('key', key).maybeSingle();
  if (error) throw error;
  return data?.value ?? null;
}

import { db } from './db';

type CreateUpdateInput = {
  message: string;
  source: 'manual' | 'auto';
  kind?: 'post' | 'project' | 'stack_item';
  ref_url?: string | null;
};

// Fire-and-forget: nunca deixa a criação de post/projeto/item de stack falhar
// por causa de um erro ao registrar a novidade.
export async function createUpdate(input: CreateUpdateInput): Promise<void> {
  const { error } = await db.from('updates').insert({
    message: input.message,
    source: input.source,
    kind: input.kind ?? null,
    ref_url: input.ref_url ?? null,
  });
  if (error) console.error('createUpdate failed:', error.message);
}

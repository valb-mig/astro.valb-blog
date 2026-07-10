import { createHash } from 'crypto';
import type { APIContext } from 'astro';

export { REACTION_EMOJIS, type ReactionEmoji } from './reaction-emojis';

function salt(): string {
  return (import.meta.env?.REACTION_SALT ?? process.env.REACTION_SALT ?? 'default-reaction-salt') as string;
}

export function fingerprint({ request, clientAddress }: Pick<APIContext, 'request' | 'clientAddress'>): string {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? clientAddress ?? 'unknown';
  const ua = request.headers.get('user-agent') ?? 'unknown';
  return createHash('sha256').update(`${ip}|${ua}|${salt()}`).digest('hex');
}

// Rate-limit em memória por fingerprint — barato o bastante pra impedir clique
// repetido/script (toggle liga/desliga reação), sem precisar de tabela nova.
// Reseta em cold start (serverless), aceitável: o objetivo é frear rajada, não
// contagem perfeita entre instâncias.
const REACTION_TOGGLE_LIMIT = 10;
const REACTION_TOGGLE_WINDOW_MS = 60 * 1000;
const reactionToggleLog = new Map<string, number[]>();

export function reactionRateLimitExceeded(fp: string): boolean {
  const now = Date.now();
  const recent = (reactionToggleLog.get(fp) ?? []).filter((t) => now - t < REACTION_TOGGLE_WINDOW_MS);
  recent.push(now);
  reactionToggleLog.set(fp, recent);
  return recent.length > REACTION_TOGGLE_LIMIT;
}

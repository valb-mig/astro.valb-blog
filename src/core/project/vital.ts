import type { Card } from './project';

export type Level = 'ok' | 'warn' | 'down' | 'unknown';

export type Vital = { level: Level; label: string };

export const up = (code: number | null) => code != null && code >= 200 && code < 300;

export const link = (c: Card) => ((c.health.deploy?.url as string | undefined) ?? c.uptimeUrl ?? null);

export const vital = (c: Card): Vital => {
  const { ci, code, deploy } = c.health;
  if (c.uptimeUrl) {
    if (code == null) return { level: 'unknown', label: 'uptime: sem resposta' };
    return up(code) ? { level: 'ok', label: 'online' } : { level: 'down', label: `offline (${code})` };
  }
  if (ci) {
    if (ci === 'success') return { level: 'ok', label: 'build ok' };
    if (ci === 'failure' || ci === 'timed_out') return { level: 'down', label: 'build falhou' };
    return { level: 'warn', label: `ci: ${ci}` };
  }
  if (deploy) return { level: 'ok', label: 'reportando deploy' };
  return { level: 'unknown', label: 'sem dado de status' };
};

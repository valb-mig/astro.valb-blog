import type { Card } from './project';

export type Board = {
  web: Card[];
  ci: Card[];
  last: { [repo: string]: string };
};

const rank: { [ci: string]: number } = { success: 0, in_progress: 1, queued: 1 };

const tracked = (c: Card) => c.health.ci != null || c.health.release != null || c.uptimeUrl != null || c.health.deploy != null;

const linked = (c: Card) => (c.health.deploy as { url?: string } | null)?.url != null || c.uptimeUrl != null;

const order = (c: Card) => rank[c.health.ci ?? ''] ?? (c.health.ci ? 2 : 3);

export const split = (cards: Card[]) => {
  const all = cards.filter(tracked);
  return {
    web: all.filter(linked),
    ci: all.filter((c) => !linked(c)).sort((a, b) => order(a) - order(b)),
  };
};

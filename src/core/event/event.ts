export type Type = 'commit' | 'issue' | 'pull_request' | 'release';

export type Event = {
  id: string;
  source: string;
  type: Type;
  externalId: string;
  repo: string;
  url: string;
  title: string;
  payload: { [key: string]: unknown };
  at: string;
  createdAt: string;
};

export type Item = Pick<Event, 'id' | 'type' | 'repo' | 'url' | 'title' | 'at'>;

export type Day = { day: string; events: Item[] };

export const days = (events: Item[]): Day[] => {
  const out: Day[] = [];
  for (const e of events) {
    const day = e.at.slice(0, 10);
    const last = out[out.length - 1];
    if (last?.day === day) last.events.push(e);
    else out.push({ day, events: [e] });
  }
  return out;
};

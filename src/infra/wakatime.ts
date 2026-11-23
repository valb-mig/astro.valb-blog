import type { Tracker } from '@/core/time/port';
import type { Day, Share, Week } from '@/core/time/time';

const ttl = 5 * 60 * 1000;

type Raw = { name: string; percent: number; text: string };

const share = (r: Raw): Share => ({ name: r.name, percent: r.percent, text: r.text });

export class Wakatime implements Tracker {
  private cache: { week: Week; until: number } | null = null;

  constructor(private key: string | undefined) {}

  async week(): Promise<Week | null> {
    if (this.cache && this.cache.until > Date.now()) return this.cache.week;
    const data = await this.get('stats/last_7_days');
    if (!data) return null;
    const week = { total: data.human_readable_total ?? '0 secs', languages: (data.languages ?? []).slice(0, 4).map(share) };
    this.cache = { week, until: Date.now() + ttl };
    return week;
  }

  async day(date: string): Promise<Day | null> {
    const day = (await this.get(`summaries?start=${date}&end=${date}`))?.[0];
    if (!day) return null;
    return {
      seconds: day.grand_total?.total_seconds ?? 0,
      total: day.grand_total?.text ?? '0 secs',
      languages: (day.languages ?? []).slice(0, 5).map(share),
      projects: (day.projects ?? []).slice(0, 5).map(share),
    };
  }

  private async get(path: string) {
    if (!this.key) return null;
    try {
      const res = await fetch(`https://wakatime.com/api/v1/users/current/${path}`, {
        headers: { Authorization: `Basic ${Buffer.from(this.key).toString('base64')}` },
      });
      return res.ok ? (await res.json()).data : null;
    } catch {
      return null;
    }
  }
}

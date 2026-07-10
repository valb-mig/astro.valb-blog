const CACHE_TTL_MS = 5 * 60 * 1000;

export type WakatimeStats = {
  totalText: string;
  languages: { name: string; percent: number; text: string }[];
};

let cache: { data: WakatimeStats; expiresAt: number } | null = null;

function apiKey(): string | undefined {
  return import.meta.env?.WAKATIME_API_KEY ?? process.env.WAKATIME_API_KEY;
}

export async function getWakatimeStats(): Promise<WakatimeStats | null> {
  if (cache && cache.expiresAt > Date.now()) return cache.data;

  const key = apiKey();
  if (!key) return null;

  try {
    const auth = Buffer.from(key).toString('base64');
    const res = await fetch('https://wakatime.com/api/v1/users/current/stats/last_7_days', {
      headers: { Authorization: `Basic ${auth}` },
    });
    if (!res.ok) return null;

    const json = await res.json();
    const data = json.data;

    const stats: WakatimeStats = {
      totalText: data.human_readable_total ?? '0 secs',
      languages: (data.languages ?? []).slice(0, 4).map((l: any) => ({
        name: l.name,
        percent: l.percent,
        text: l.text,
      })),
    };

    cache = { data: stats, expiresAt: Date.now() + CACHE_TTL_MS };
    return stats;
  } catch {
    return null;
  }
}

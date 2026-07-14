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

export type WakatimeDaySummary = {
  totalSeconds: number;
  totalText: string;
  languages: { name: string; percent: number; text: string }[];
  projects: { name: string; percent: number; text: string }[];
};

// Usado pelo ingest (dia específico, não "últimos 7 dias" como o widget) —
// endpoint "summaries" do Wakatime, não "stats". Sem cache: chamado no máximo
// 1x por run do pipeline, não por request de página. O dia retornado segue o
// timezone configurado na conta Wakatime, não UTC como o resto do pipeline —
// pode haver leve desalinhamento perto da virada do dia, aceitável pra esse uso.
export async function getWakatimeSummaryForDate(date: string): Promise<WakatimeDaySummary | null> {
  const key = apiKey();
  if (!key) return null;

  try {
    const auth = Buffer.from(key).toString('base64');
    const res = await fetch(`https://wakatime.com/api/v1/users/current/summaries?start=${date}&end=${date}`, {
      headers: { Authorization: `Basic ${auth}` },
    });
    if (!res.ok) return null;

    const json = await res.json();
    const day = json.data?.[0];
    if (!day) return null;

    return {
      totalSeconds: day.grand_total?.total_seconds ?? 0,
      totalText: day.grand_total?.text ?? '0 secs',
      languages: (day.languages ?? []).slice(0, 5).map((l: any) => ({
        name: l.name,
        percent: l.percent,
        text: l.text,
      })),
      projects: (day.projects ?? []).slice(0, 5).map((p: any) => ({
        name: p.name,
        percent: p.percent,
        text: p.text,
      })),
    };
  } catch {
    return null;
  }
}

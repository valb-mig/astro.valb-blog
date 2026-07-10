import type { APIRoute } from 'astro';
import { getWakatimeStats } from '../../lib/wakatime';

export const GET: APIRoute = async () => {
  const stats = await getWakatimeStats();
  if (!stats) return new Response(JSON.stringify({ error: 'unavailable' }), { status: 503 });
  return new Response(JSON.stringify(stats), { headers: { 'Content-Type': 'application/json' } });
};

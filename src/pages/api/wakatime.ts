import { app } from '@/app';
import { json, route } from '@/app/http';

export const GET = route(async () => {
  const week = await app.time.week();
  return week ? json(week) : json({ error: 'unavailable' }, 503);
});

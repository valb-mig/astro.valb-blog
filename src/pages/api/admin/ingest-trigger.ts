import { app } from '@/app';
import { json, route } from '@/app/http';

export const POST = route(async () => {
  await app.trigger.run();
  return json({ ok: true });
}, true);

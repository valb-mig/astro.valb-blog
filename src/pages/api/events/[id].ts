import { app } from '@/app';
import { done, route } from '@/app/http';

export const DELETE = route(async ({ params }) => {
  await app.events.remove(params.id!);
  return done();
}, true);

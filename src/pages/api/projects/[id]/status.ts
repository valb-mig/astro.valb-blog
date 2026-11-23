import { app } from '@/app';
import { done, route } from '@/app/http';

export const POST = route(async ({ params, request }) => {
  const auth = request.headers.get('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice('Bearer '.length) : '';
  await app.projects.report(params.id!, token, await request.json().catch(() => null));
  return done();
});

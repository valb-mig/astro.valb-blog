import { json, route } from '@/app/http';
import { cookie } from '@/core/auth/service';

export const POST = route(({ cookies }) => {
  cookies.delete(cookie, { path: '/' });
  return json({ ok: true });
});

import { app } from '@/app';
import { body, ip, json, route } from '@/app/http';
import { age, cookie } from '@/core/auth/service';

export const POST = route(async (ctx) => {
  const token = app.auth.login(ip(ctx), await body(ctx));
  ctx.cookies.set(cookie, token, {
    httpOnly: true,
    secure: import.meta.env.PROD,
    sameSite: 'lax',
    maxAge: age,
    path: '/',
  });
  return json({ ok: true });
});

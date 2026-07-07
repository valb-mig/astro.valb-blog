import { defineMiddleware } from 'astro:middleware';
import { verifySession, SESSION_COOKIE } from './lib/auth';

export const onRequest = defineMiddleware(async (ctx, next) => {
  const path = ctx.url.pathname;

  if (!path.startsWith('/admin')) return next();
  if (path === '/admin/login') return next();

  const token = ctx.cookies.get(SESSION_COOKIE)?.value ?? '';
  if (!verifySession(token)) {
    return ctx.redirect('/admin/login');
  }

  return next();
});

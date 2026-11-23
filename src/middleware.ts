import { defineMiddleware } from 'astro:middleware';
import { app } from './app';
import { cookie } from './core/auth/service';

const open = (path: string) =>
  path.startsWith('/admin') || path.startsWith('/api') || path === '/rss.xml' || path === '/manutencao';

export const onRequest = defineMiddleware(async (ctx, next) => {
  const path = ctx.url.pathname;
  const admin = app.auth.verify(ctx.cookies.get(cookie)?.value);
  ctx.locals.admin = admin;

  if (path.startsWith('/admin')) {
    if (path === '/admin/login') return next();
    return admin ? next() : ctx.redirect('/admin/login');
  }

  if (!admin && !open(path) && (await app.settings.maintenance())) return ctx.rewrite('/manutencao');

  return next();
});

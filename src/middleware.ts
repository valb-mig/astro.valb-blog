import { defineMiddleware } from 'astro:middleware';
import { verifySession, SESSION_COOKIE } from './lib/auth';
import { getSetting } from './lib/settings';

const MAINTENANCE_BYPASS = ['/manutencao'];

function isMaintenanceBypassed(path: string): boolean {
  return (
    path.startsWith('/admin') ||
    path.startsWith('/api') ||
    path === '/rss.xml' ||
    MAINTENANCE_BYPASS.includes(path)
  );
}

export const onRequest = defineMiddleware(async (ctx, next) => {
  const path = ctx.url.pathname;
  const token = ctx.cookies.get(SESSION_COOKIE)?.value ?? '';
  const isAdmin = !!verifySession(token);
  ctx.locals.isAdmin = isAdmin;

  if (path.startsWith('/admin')) {
    if (path === '/admin/login') return next();
    if (!isAdmin) return ctx.redirect('/admin/login');
    return next();
  }

  if (!isAdmin && !isMaintenanceBypassed(path)) {
    const maintenanceMode = await getSetting('maintenance_mode');
    if (maintenanceMode === 'true') return ctx.rewrite('/manutencao');
  }

  return next();
});

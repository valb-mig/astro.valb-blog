import type { APIRoute } from 'astro';
import { createSessionToken, SESSION_COOKIE, SESSION_MAX_AGE } from '../../../lib/auth';

export const POST: APIRoute = async ({ request, cookies }) => {
  const body = await request.json().catch(() => null);
  if (!body) {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  const { username, password } = body as { username: string; password: string };
  const adminUser = import.meta.env.ADMIN_USERNAME;
  const adminPass = import.meta.env.ADMIN_PASSWORD;

  if (!adminUser || !adminPass || username !== adminUser || password !== adminPass) {
    return new Response(JSON.stringify({ error: 'Credenciais inválidas' }), { status: 401 });
  }

  const token = createSessionToken(username);

  cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: import.meta.env.PROD,
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE,
    path: '/',
  });

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
};

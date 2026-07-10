import type { APIRoute } from 'astro';
import {
  createSessionToken,
  loginRateLimitExceeded,
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  timingSafeStringEqual,
} from '../../../lib/auth';

export const POST: APIRoute = async ({ request, cookies, clientAddress }) => {
  // clientAddress vem do runtime (IP real da conexão) — não é spoofável pelo cliente
  // como o header x-forwarded-for seria. Só cai pro header se o runtime não expuser IP.
  const ip = clientAddress ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (loginRateLimitExceeded(ip)) {
    return new Response(JSON.stringify({ error: 'Muitas tentativas. Tente novamente em alguns minutos.' }), {
      status: 429,
    });
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  const { username, password } = body as { username: string; password: string };
  const adminUser = import.meta.env.ADMIN_USERNAME;
  const adminPass = import.meta.env.ADMIN_PASSWORD;

  if (
    !adminUser ||
    !adminPass ||
    !timingSafeStringEqual(username ?? '', adminUser) ||
    !timingSafeStringEqual(password ?? '', adminPass)
  ) {
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

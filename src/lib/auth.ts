import { createHmac, timingSafeEqual } from 'crypto';

export const SESSION_COOKIE = 'blog_session';
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function secret(): string {
  const s = import.meta.env.SESSION_SECRET as string;
  if (!s) throw new Error('SESSION_SECRET not set');
  return s;
}

export function createSessionToken(username: string): string {
  const payload = `${username}:${Date.now()}`;
  const sig = createHmac('sha256', secret()).update(payload).digest('hex');
  return Buffer.from(`${payload}:${sig}`).toString('base64url');
}

export function verifySession(token: string): string | null {
  if (!token) return null;
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    const lastColon = decoded.lastIndexOf(':');
    const payload = decoded.slice(0, lastColon);
    const sig = decoded.slice(lastColon + 1);
    const expected = createHmac('sha256', secret()).update(payload).digest('hex');

    const sigBuf = Buffer.from(sig, 'hex');
    const expBuf = Buffer.from(expected, 'hex');
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) return null;

    const [username] = payload.split(':');
    return username ?? null;
  } catch {
    return null;
  }
}

import { createHash, createHmac, timingSafeEqual } from 'crypto';

export const SESSION_COOKIE = 'blog_session';
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

// Hasheia os dois lados pra um digest de tamanho fixo antes de comparar —
// timingSafeEqual exige buffers do mesmo tamanho, e comparar direto vazaria
// o tamanho da credencial certa via timing se os inputs tivessem tamanhos diferentes.
export function timingSafeStringEqual(a: string, b: string): boolean {
  const aHash = createHash('sha256').update(a).digest();
  const bHash = createHash('sha256').update(b).digest();
  return timingSafeEqual(aHash, bHash);
}

// Rate-limit em memória por IP — mesmo padrão de src/lib/reactions.ts.
// Reseta em cold start (serverless), aceitável: o objetivo é frear brute force
// de senha, não contagem perfeita entre instâncias.
const LOGIN_ATTEMPT_LIMIT = 5;
const LOGIN_ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const loginAttemptLog = new Map<string, number[]>();

export function loginRateLimitExceeded(ip: string): boolean {
  const now = Date.now();
  const recent = (loginAttemptLog.get(ip) ?? []).filter((t) => now - t < LOGIN_ATTEMPT_WINDOW_MS);
  recent.push(now);
  loginAttemptLog.set(ip, recent);
  return recent.length > LOGIN_ATTEMPT_LIMIT;
}

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

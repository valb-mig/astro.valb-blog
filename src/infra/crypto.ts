import { createHash, createHmac, timingSafeEqual } from 'crypto';
import type { Tokens } from '@/core/auth/port';

const sha = (s: string) => createHash('sha256').update(s).digest();

export const equal = (a: string, b: string) => timingSafeEqual(sha(a), sha(b));

export const fingerprint = (ip: string, ua: string, salt: string) =>
  createHash('sha256').update(`${ip}|${ua}|${salt}`).digest('hex');

export class Hmac implements Tokens {
  constructor(
    private secret: () => string,
    private age: number,
  ) {}

  equal = equal;

  sign(user: string): string {
    const payload = `${user}:${Date.now()}`;
    return Buffer.from(`${payload}:${this.mac(payload)}`).toString('base64url');
  }

  verify(token: string): string | null {
    try {
      const decoded = Buffer.from(token, 'base64url').toString('utf8');
      const cut = decoded.lastIndexOf(':');
      const payload = decoded.slice(0, cut);
      const sig = Buffer.from(decoded.slice(cut + 1), 'hex');
      const expected = Buffer.from(this.mac(payload), 'hex');
      if (sig.length !== expected.length || !timingSafeEqual(sig, expected)) return null;

      const [user, issued] = payload.split(':');
      if (!user || !issued || Date.now() - Number(issued) > this.age * 1000) return null;
      return user;
    } catch {
      return null;
    }
  }

  private mac(payload: string): string {
    return createHmac('sha256', this.secret()).update(payload).digest('hex');
  }
}

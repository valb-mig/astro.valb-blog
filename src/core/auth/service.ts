import { Fault } from '../error';
import type { Limiter } from '../limit';
import type { Tokens } from './port';

export const cookie = 'blog_session';

export const age = 60 * 60 * 24 * 7;

export type Admin = { user: string; pass: string } | null;

export class Service {
  constructor(
    private tokens: Tokens,
    private admin: Admin,
    private limiter: Limiter,
  ) {}

  login(ip: string, body: unknown): string {
    if (this.limiter.hit(ip)) throw new Fault('limited', 'Muitas tentativas. Tente novamente em alguns minutos.');
    if (!body || typeof body !== 'object') throw new Fault('invalid', 'Invalid JSON');

    const { username, password } = body as { username?: unknown; password?: unknown };
    const user = typeof username === 'string' ? username : '';
    const pass = typeof password === 'string' ? password : '';
    if (!this.admin || !this.tokens.equal(user, this.admin.user) || !this.tokens.equal(pass, this.admin.pass)) {
      throw new Fault('denied', 'Credenciais inválidas');
    }
    return this.tokens.sign(user);
  }

  verify(token: string | undefined): boolean {
    return !!token && !!this.tokens.verify(token);
  }
}

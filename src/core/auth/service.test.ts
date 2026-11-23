import { describe, expect, it } from 'vitest';
import { Limiter } from '../limit';
import type { Tokens } from './port';
import { Service } from './service';

const tokens: Tokens = {
  sign: (user) => `token:${user}`,
  verify: (token) => (token.startsWith('token:') ? token.slice(6) : null),
  equal: (a, b) => a === b,
};

const admin = { user: 'me', pass: 'pw' };

describe('auth service', () => {
  it('signs a token for valid credentials', () => {
    const auth = new Service(tokens, admin, new Limiter(5, 1000));
    expect(auth.login('ip', { username: 'me', password: 'pw' })).toBe('token:me');
    expect(auth.verify('token:me')).toBe(true);
    expect(auth.verify(undefined)).toBe(false);
  });

  it('rejects bad bodies, bad credentials and missing admin config', () => {
    const auth = new Service(tokens, admin, new Limiter(5, 1000));
    expect(() => auth.login('ip', null)).toThrow('Invalid JSON');
    expect(() => auth.login('ip', { username: 'me', password: 'no' })).toThrow('Credenciais inválidas');
    expect(() => new Service(tokens, null, new Limiter(5, 1000)).login('ip', admin)).toThrow('Credenciais inválidas');
  });

  it('rate limits attempts per ip before checking credentials', () => {
    const auth = new Service(tokens, admin, new Limiter(1, 60_000));
    expect(() => auth.login('ip', {})).toThrow('Credenciais inválidas');
    expect(() => auth.login('ip', { username: 'me', password: 'pw' })).toThrow('Muitas tentativas');
  });
});

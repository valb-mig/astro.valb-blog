export interface Tokens {
  sign(user: string): string;
  verify(token: string): string | null;
  equal(a: string, b: string): boolean;
}

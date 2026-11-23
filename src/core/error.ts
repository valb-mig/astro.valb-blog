export type Code = 'invalid' | 'denied' | 'missing' | 'limited' | 'upstream' | 'config';

export class Fault extends Error {
  constructor(
    readonly code: Code,
    message: string,
  ) {
    super(message);
  }
}

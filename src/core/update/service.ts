import { Fault } from '../error';
import type { Updates } from './port';
import type { Kind, Update } from './update';

const size = 20;

export class Service {
  constructor(private updates: Updates) {}

  latest(): Promise<Update | null> {
    return this.updates.latest();
  }

  page(before?: string): Promise<Update[]> {
    return this.updates.page(size, before);
  }

  post(message: unknown, url?: string | null): Promise<Update> {
    if (typeof message !== 'string' || !message.trim()) throw new Fault('invalid', 'message é obrigatório');
    return this.updates.create({ message, source: 'manual', kind: null, url: url ?? null });
  }

  async announce(kind: Kind, message: string, url: string | null): Promise<void> {
    try {
      await this.updates.create({ message, source: 'auto', kind, url });
    } catch (err) {
      console.error('update announce failed:', err instanceof Error ? err.message : err);
    }
  }

  remove(id: string): Promise<void> {
    return this.updates.remove(id);
  }
}

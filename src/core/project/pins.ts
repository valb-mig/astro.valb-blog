import { Fault } from '../error';
import type { Service as Settings } from '../setting/service';

const key = 'pinned_projects';

export class Pins {
  constructor(private settings: Settings) {}

  list(): Promise<string[]> {
    return this.settings.list(key);
  }

  async set(id: unknown, on: unknown): Promise<string[]> {
    if (typeof id !== 'string' || !id || typeof on !== 'boolean') throw new Fault('invalid', 'id e pinned são obrigatórios');
    const rest = (await this.list()).filter((p) => p !== id);
    const next = on ? [...rest, id] : rest;
    await this.settings.set(key, JSON.stringify(next));
    return next;
  }
}

import type { Input, Update } from './update';

export interface Updates {
  latest(): Promise<Update | null>;
  page(size: number, before?: string): Promise<Update[]>;
  create(input: Input): Promise<Update>;
  remove(id: string): Promise<void>;
}

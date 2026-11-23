import type { Run } from './run';

export interface Runs {
  recent(limit: number): Promise<Run[]>;
}

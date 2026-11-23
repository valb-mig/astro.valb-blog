import type { Day, Week } from './time';

export interface Tracker {
  week(): Promise<Week | null>;
  day(date: string): Promise<Day | null>;
}

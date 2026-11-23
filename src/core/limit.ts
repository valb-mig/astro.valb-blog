export class Limiter {
  private log = new Map<string, number[]>();

  constructor(
    private max: number,
    private window: number,
    private now: () => number = Date.now,
  ) {}

  hit(key: string): boolean {
    const t = this.now();
    const recent = (this.log.get(key) ?? []).filter((s) => t - s < this.window);
    recent.push(t);
    this.log.set(key, recent);
    return recent.length > this.max;
  }
}

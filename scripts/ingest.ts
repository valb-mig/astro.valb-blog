import { ingest } from '../src/app/ingest';

const day = /^\d{4}-\d{2}-\d{2}$/;

const flag = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);

const valid = (name: string, value: string) => {
  if (!day.test(value)) throw new Error(`Invalid --${name}: "${value}" (expected YYYY-MM-DD)`);
  return value;
};

const days = (from: string, to: string) => {
  const out: string[] = [];
  for (let t = Date.parse(`${from}T00:00:00Z`); t <= Date.parse(`${to}T00:00:00Z`); t += 86_400_000) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
};

const from = flag('from');
const dates = from
  ? days(valid('from', from), valid('to', flag('to') ?? new Date().toISOString().slice(0, 10)))
  : [valid('date', flag('date') ?? new Date().toISOString().slice(0, 10))];

const force = process.argv.includes('--force');
const trigger = process.env.GITHUB_EVENT_NAME ?? (from ? 'backfill' : 'local');
const pipeline = ingest(from ? 1000 : 100);

(async () => {
  const failed: string[] = [];
  for (const [i, date] of dates.entries()) {
    console.log(`\n== ${date}`);
    try {
      await pipeline.run(date, force, trigger, i === 0);
    } catch (err) {
      if (dates.length === 1) throw err;
      console.error(`${date} failed:`, err instanceof Error ? err.message : err);
      failed.push(date);
    }
  }
  if (failed.length) {
    console.error(`\nFailed days: ${failed.join(', ')}`);
    process.exit(1);
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});

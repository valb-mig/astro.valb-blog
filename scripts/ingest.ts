import { ingest } from '../src/app/ingest';

const arg = process.argv.find((a) => a.startsWith('--date='));
const date = arg ? arg.slice('--date='.length) : new Date().toISOString().slice(0, 10);
if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`Invalid --date: "${date}" (expected YYYY-MM-DD)`);

ingest()
  .run(date, process.argv.includes('--force'), process.env.GITHUB_EVENT_NAME ?? 'local')
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

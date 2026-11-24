import { Ingest } from '@/core/ingest/run';
import { Sync } from '@/core/ingest/sync';
import { pick } from '@/core/llm/pick';
import { Log } from '@/infra/git/log';
import { Source } from '@/infra/github/source';
import { Gemini } from '@/infra/llm/gemini';
import { Groq } from '@/infra/llm/groq';
import { Probe } from '@/infra/probe';
import { Catalog } from '@/infra/supabase/catalog';
import { Journal } from '@/infra/supabase/journal';
import { Ledger } from '@/infra/supabase/ledger';
import { Posts } from '@/infra/supabase/posts';
import { app } from '.';
import { db } from './db';
import { env } from './env';

const cache = new URL('../../.ingest-cache/', import.meta.url).pathname;

export const ingest = (depth = 100) => {
  const token = env('GH_TOKEN');
  const user = env('GH_USERNAME');
  if (!token || !user) throw new Error('Missing env vars: GH_TOKEN, GH_USERNAME');

  const source = new Source(token);
  const catalog = new Catalog(db);
  const posts = new Posts(db);

  return new Ingest({
    user,
    source,
    log: new Log(token, cache, depth),
    sync: new Sync(source, catalog, new Probe()),
    catalog,
    ledger: new Ledger(db),
    journal: new Journal(db),
    posts,
    drafts: posts,
    tracker: app.time,
    orgs: app.orgs,
    llm: () =>
      pick(
        app.settings,
        { groq: env('GROQ_API_KEY'), gemini: env('GEMINI_API_KEY') },
        {
          groq: (key) => new Groq(key, env('GROQ_MODEL')),
          gemini: (key) => new Gemini(key, env('GEMINI_MODEL')),
        },
      ),
  });
};

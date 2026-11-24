import { age, Service as Auth } from '@/core/auth/service';
import { Fault } from '@/core/error';
import { Service as Events } from '@/core/event/service';
import { Service as Orgs } from '@/core/ingest/orgs';
import { Limiter } from '@/core/limit';
import { Service as Posts } from '@/core/post/service';
import { Service as Projects } from '@/core/project/service';
import { Service as Reactions } from '@/core/reaction/service';
import { Service as Settings } from '@/core/setting/service';
import { Service as Stack } from '@/core/stack/service';
import { Service as Stats } from '@/core/stats';
import { Service as Updates } from '@/core/update/service';
import { equal, Hmac } from '@/infra/crypto';
import { Dispatch } from '@/infra/github/dispatch';
import { Hub } from '@/infra/github/hub';
import { Catalog } from '@/infra/supabase/catalog';
import { Events as EventRows } from '@/infra/supabase/events';
import { Posts as PostRows } from '@/infra/supabase/posts';
import { Projects as ProjectRows } from '@/infra/supabase/projects';
import { Reactions as ReactionRows } from '@/infra/supabase/reactions';
import { Runs } from '@/infra/supabase/runs';
import { Settings as SettingRows } from '@/infra/supabase/settings';
import { Stack as StackRows } from '@/infra/supabase/stack';
import { Updates as UpdateRows } from '@/infra/supabase/updates';
import { Wakatime } from '@/infra/wakatime';
import { db } from './db';
import { env } from './env';

const secret = () => {
  const s = env('SESSION_SECRET');
  if (!s) throw new Error('SESSION_SECRET not set');
  return s;
};

const user = env('ADMIN_USERNAME');
const pass = env('ADMIN_PASSWORD');
const read = env('GH_READ_TOKEN');
const dispatch = env('GH_DISPATCH_TOKEN');
const repo = env('GH_REPO');

const updates = new Updates(new UpdateRows(db));
const settings = new Settings(new SettingRows(db));
const events = new Events(new EventRows(db));
const posts = new Posts(new PostRows(db), updates);
const projects = new Projects(new ProjectRows(db), events, updates, equal);
const reactions = new Reactions(new ReactionRows(db), new Limiter(10, 60_000));

export const app = {
  posts,
  projects,
  events,
  reactions,
  updates,
  settings,
  stack: new Stack(new StackRows(db), updates),
  auth: new Auth(new Hmac(secret, age), user && pass ? { user, pass } : null, new Limiter(5, 15 * 60_000)),
  orgs: new Orgs(settings, read ? new Hub(read) : null, new Catalog(db)),
  stats: new Stats(posts, projects, reactions, new Runs(db)),
  trigger: {
    run: () =>
      dispatch && repo
        ? new Dispatch(dispatch, repo).run()
        : Promise.reject(new Fault('config', 'GH_DISPATCH_TOKEN ou GH_REPO não configurados')),
  },
  time: new Wakatime(env('WAKATIME_API_KEY')),
  llm: { groq: !!env('GROQ_API_KEY'), gemini: !!env('GEMINI_API_KEY') },
  salt: env('REACTION_SALT') ?? 'default-reaction-salt',
};

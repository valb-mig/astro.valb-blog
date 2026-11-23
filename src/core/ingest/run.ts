import * as activity from '../activity';
import type { Llm } from '../llm/port';
import type { Posts } from '../post/port';
import { readingTime } from '../post/post';
import type { Tracker } from '../time/port';
import { dedupe, group, type Group } from './group';
import { owner, type Service as Orgs } from './orgs';
import { key, type Catalog, type Drafts, type Fresh, type Journal, type Ledger, type Log, type Remote, type Source } from './port';
import * as prompt from './prompt';
import * as render from './render';
import type { Sync } from './sync';

const minimum = 5 * 60;

const reason = (err: unknown) => (err instanceof Error ? err.message : String(err));

export type Deps = {
  user: string;
  source: Source;
  log: Log;
  sync: Sync;
  catalog: Catalog;
  ledger: Ledger;
  journal: Journal;
  posts: Posts;
  drafts: Drafts;
  tracker: Tracker;
  orgs: Orgs;
  llm: () => Promise<Llm>;
};

type Result = { created: number; fallback: boolean };

export class Ingest {
  constructor(private d: Deps) {}

  async run(date: string, force: boolean, trigger: string): Promise<void> {
    const id = await this.d.journal.start(date, trigger);
    try {
      await this.d.journal.finish(id, { status: 'success', error: null, ...(await this.day(date, force)) });
    } catch (err) {
      await this.d.journal.finish(id, { status: 'error', created: 0, fallback: false, error: reason(err) });
      throw err;
    }
  }

  private own(repo: string): boolean {
    return owner(repo) === this.d.user.toLowerCase();
  }

  private async day(date: string, force: boolean): Promise<Result> {
    const { source, sync, catalog, ledger, posts } = this.d;

    const owned = await source.owned();
    const orgs = await this.orgRepos();
    const remotes = [...owned, ...orgs];
    const open = new Set(remotes.filter((r) => !r.private).map((r) => r.repo));
    const born = new Map(remotes.map((r) => [r.repo, r.createdAt]));
    const hidden = new Set(orgs.filter((r) => r.private).map((r) => r.repo));

    const tracked = await catalog.tracked();
    const extra = new Set(tracked.flatMap((t) => (t.private && t.repo && !open.has(t.repo) ? [t.repo] : [])));
    const quiet = new Set([...tracked.flatMap((t) => (!t.mention && t.repo ? [t.repo] : [])), ...hidden]);
    const all = new Set([...open, ...extra, ...hidden]);
    const authors = [...all].some((r) => !this.own(r)) ? await source.emails() : [];

    if (orgs.length) console.log(`Org repos in ingest: ${orgs.map((r) => r.repo).join(', ')}`);
    if (extra.size) console.log(`Private repos in ingest: ${[...extra].join(', ')}`);
    if (quiet.size) console.log(`Repos left out of the post: ${[...quiet].join(', ')}`);

    await sync.projects(remotes);
    const current = await catalog.tracked();
    await sync.languages(current);
    await sync.health(current);

    const loud = (e: { repo: string }) => !quiet.has(e.repo);
    const events = await this.collect(all, date, authors);
    const known = await ledger.known(events);
    const unseen = events.filter((e) => !known.has(key(e)));
    const created = unseen.length;

    if (events.length) {
      const shown = (await ledger.save(events)).filter(loud);
      if (shown.length) await ledger.attach(await this.open(date), shown.map((e) => e.id));
    }

    if (!events.some(loud)) {
      if (events.length) console.log(`${events.length} commit(s) only in repos left out of the post — falling back to coding time.`);
      return { created, fallback: await this.time(date, force) };
    }

    if (!unseen.some(loud) && !force) {
      console.log('Mentionable events were already processed (dedupe).');
      return { created, fallback: false };
    }

    const post = await posts.find({ slug: activity.slug(date) }, true);
    if (!post) {
      console.log(`Nothing to rebuild — no post on ${date} and no new events.`);
      return { created, fallback: false };
    }

    const { total, fallback } = await this.rebuild(post.id, date, born, quiet);
    console.log(`Draft "${post.slug}" rebuilt with ${unseen.filter(loud).length} new event(s), ${total} mentionable in the day.`);
    return { created, fallback };
  }

  private async orgRepos(): Promise<Remote[]> {
    const [orgs, enabled] = await Promise.all([this.d.orgs.configured(), this.d.orgs.enabled()]);
    if (!orgs.length || !enabled.length) return [];

    const on = new Set(enabled.map((r) => r.toLowerCase()));
    const out: Remote[] = [];
    for (const org of orgs) {
      try {
        out.push(...(await this.d.source.org(org)).filter((r) => on.has(r.repo.toLowerCase())));
      } catch (err) {
        console.warn(`Listing repos of ${org} failed:`, reason(err));
      }
    }
    return out;
  }

  private async collect(repos: Set<string>, date: string, authors: string[]): Promise<Fresh[]> {
    const out: Fresh[] = [];
    for (const repo of repos) {
      const own = this.own(repo);
      if (!own && !authors.length) {
        console.warn(`No author email to filter by — skipping ${repo}.`);
        continue;
      }
      try {
        out.push(...(await this.d.log.commits(repo, date, own ? undefined : authors)));
      } catch (err) {
        console.warn(`git log failed for ${repo}:`, reason(err));
      }
    }
    return out;
  }

  private async open(date: string): Promise<string> {
    const slug = activity.slug(date);
    return (await this.d.posts.find({ slug }, true))?.id ?? this.d.drafts.open(slug, render.title(date), render.blurb);
  }

  private async write(id: string, content: string, repos: string[]): Promise<void> {
    await this.d.posts.update(id, { content, readingTime: readingTime(content) });
    await this.d.posts.link(id, repos.length ? await this.d.catalog.ids(repos) : []);
  }

  private async rebuild(
    id: string,
    date: string,
    born: Map<string, string | null>,
    quiet: Set<string>,
  ): Promise<{ total: number; fallback: boolean }> {
    const events = (await this.d.ledger.of(id)).filter((e) => !quiet.has(e.repo));
    const groups = group(dedupe(events));
    const llm = await this.d.llm();

    const [narrative, narratives] = await Promise.all([
      llm.complete(prompt.day(groups)).then((t) => t || prompt.lines(groups).join('\n')),
      this.narratives(llm, groups, date, born),
    ]);
    await this.write(id, render.commits(narrative, groups, narratives), groups.map((g) => g.repo));
    return { total: events.length, fallback: llm.fellBack ?? false };
  }

  private async narratives(
    llm: Llm,
    groups: Group[],
    date: string,
    born: Map<string, string | null>,
  ): Promise<{ [repo: string]: string }> {
    const repos = groups.map((g) => g.repo);
    if (!repos.length) return {};

    const fresh = new Set(repos.filter((r) => born.get(r)?.slice(0, 10) === date));
    const descriptions: { [repo: string]: string | null } = {};
    for (const repo of fresh) {
      try {
        descriptions[repo] = await this.d.source.description(repo);
      } catch (err) {
        console.warn(`Description failed for ${repo}:`, reason(err));
        descriptions[repo] = null;
      }
    }

    const raw = await llm.complete({ ...prompt.repos(groups, fresh, descriptions), json: true });
    const parsed = prompt.narratives(raw, repos);
    if (!parsed) console.warn('LLM returned invalid JSON for per-repo narratives — post goes without them.', raw);
    return parsed ?? {};
  }

  private async time(date: string, force: boolean): Promise<boolean> {
    const d = await this.d.tracker.day(date);
    if (!d || d.seconds < minimum) {
      console.log(`No commits and no meaningful coding time on ${date}.`);
      return false;
    }

    const slug = activity.slug(date);
    const existing = await this.d.posts.find({ slug }, true);
    if (existing && !force) {
      console.log(`Post "${slug}" already exists, not rebuilt from coding time without --force.`);
      return false;
    }

    const llm = await this.d.llm();
    const narrative = (await llm.complete(prompt.time(d))) || prompt.summary(d);
    await this.write(existing?.id ?? (await this.d.drafts.open(slug, render.title(date), render.blurb)), render.time(narrative, d), []);
    console.log(`Post "${slug}" built from coding time (no commits on ${date}).`);
    return llm.fellBack ?? false;
  }
}

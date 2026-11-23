import { beforeEach, describe, expect, it } from 'vitest';
import { MemoryPosts, MemorySettings } from '@/test/memory';
import {
  commit,
  FakeCatalog,
  FakeDrafts,
  FakeJournal,
  FakeLedger,
  FakeLlm,
  FakeLog,
  FakeProbe,
  FakeSource,
  FakeTracker,
  remote,
} from '@/test/ingest';
import { Service as Settings } from '../setting/service';
import { keys, Service as Orgs } from './orgs';
import { Ingest } from './run';
import { Sync } from './sync';

const date = '2026-11-20';

describe('ingest run', () => {
  let source: FakeSource;
  let log: FakeLog;
  let catalog: FakeCatalog;
  let ledger: FakeLedger;
  let journal: FakeJournal;
  let posts: MemoryPosts;
  let tracker: FakeTracker;
  let llm: FakeLlm;
  let settings: MemorySettings;
  let ingest: Ingest;

  beforeEach(() => {
    source = new FakeSource();
    log = new FakeLog();
    catalog = new FakeCatalog();
    ledger = new FakeLedger();
    journal = new FakeJournal();
    posts = new MemoryPosts();
    tracker = new FakeTracker();
    llm = new FakeLlm();
    settings = new MemorySettings();
    ingest = new Ingest({
      user: 'me',
      source,
      log,
      sync: new Sync(source, catalog, new FakeProbe(), () => '2026-11-20T23:55:00Z'),
      catalog,
      ledger,
      journal,
      posts,
      drafts: new FakeDrafts(posts),
      tracker,
      orgs: new Orgs(new Settings(settings), null),
      llm: async () => llm,
    });
  });

  it('seeds projects for new public repos only and refreshes languages', async () => {
    source.mine = [remote('me/blog'), remote('me/secret', { private: true })];
    await ingest.run(date, false, 'local');
    expect(catalog.seeds.map((s) => s.slug)).toEqual(['blog']);
    expect(catalog.langs.get('p-blog')).toEqual({ TypeScript: 75, CSS: 25 });
    expect(catalog.healths.get('p-blog')).toMatchObject({ ci: 'success', ciAt: '2026-11-20T23:55:00Z' });
  });

  it('builds the day post from commits and links it to the projects', async () => {
    source.mine = [remote('me/blog')];
    log.commitsBy.set('me/blog', [commit('me/blog', 'a1', 'feat: heatmap'), commit('me/blog', 'a2', 'fix(ci): yaml')]);

    await ingest.run(date, false, 'schedule');

    const post = posts.items.find((p) => p.slug === 'atividade-2026-11-20')!;
    expect(post.draft).toBe(true);
    expect(post.title).toBe('Atividade — 20/11/2026');
    expect(post.content).toBe(
      [
        'narrative',
        '## me/blog\n\nabout me/blog',
        '<details>\n<summary>2 commits</summary>\n\n**me/blog**\n\n- [feat: heatmap](https://github.com/me/blog/commit/a1)\n- [fix(ci): yaml](https://github.com/me/blog/commit/a2)\n\n</details>',
      ].join('\n\n---\n\n'),
    );
    expect(posts.links.get(post.id)).toEqual(['p-blog']);
    expect(llm.prompts[0].user).toContain('me/blog: 2 commit(s) (1 feat, 1 fix)');
    expect(journal.runs[0]).toMatchObject({ trigger: 'schedule', outcome: { status: 'success', created: 2, fallback: false } });
  });

  it('skips the rebuild on a rerun without new events unless forced', async () => {
    source.mine = [remote('me/blog')];
    log.commitsBy.set('me/blog', [commit('me/blog', 'a1', 'feat: x')]);
    await ingest.run(date, false, 'local');
    const calls = llm.prompts.length;

    await ingest.run(date, false, 'local');
    expect(llm.prompts.length).toBe(calls);
    expect(journal.runs[1].outcome).toMatchObject({ created: 0 });

    await ingest.run(date, true, 'local');
    expect(llm.prompts.length).toBeGreaterThan(calls);
  });

  it('tracks but never mentions repos with mention off', async () => {
    source.mine = [remote('me/blog'), remote('me/quiet')];
    catalog.items = [{ id: 'q', repo: 'me/quiet', uptimeUrl: null, private: false, mention: false }];
    log.commitsBy.set('me/blog', [commit('me/blog', 'a1', 'feat: x')]);
    log.commitsBy.set('me/quiet', [commit('me/quiet', 'b1', 'feat: hidden')]);

    await ingest.run(date, false, 'local');

    expect(ledger.rows.map((r) => r.repo).sort()).toEqual(['me/blog', 'me/quiet']);
    const post = posts.items.find((p) => p.slug === 'atividade-2026-11-20')!;
    expect(post.content).not.toContain('me/quiet');
    expect(post.content).not.toContain('hidden');
  });

  it('only counts own commits on opted-in org repos and never mentions private ones', async () => {
    settings.values.set(keys.orgs, '["Acme"]');
    settings.values.set(keys.repos, '["Acme/web","Acme/core"]');
    source.orgs.set('Acme', [remote('Acme/web'), remote('Acme/core', { private: true }), remote('Acme/off')]);
    log.commitsBy.set('Acme/core', [commit('Acme/core', 'c1', 'feat: private')]);

    await ingest.run(date, false, 'local');

    expect(log.calls.map((c) => c.repo).sort()).toEqual(['Acme/core', 'Acme/web']);
    expect(log.calls.every((c) => c.authors?.[0] === 'me@example.com')).toBe(true);
    expect(catalog.seeds.map((s) => s.repo)).toEqual(['Acme/web']);
    expect(ledger.links.size).toBe(0);
  });

  it('falls back to coding time when there is nothing mentionable', async () => {
    tracker.today = {
      seconds: 3600,
      total: '1 hr',
      languages: [{ name: 'TypeScript', percent: 80, text: '48 mins' }],
      projects: [],
    };

    await ingest.run(date, false, 'local');

    const post = posts.items.find((p) => p.slug === 'atividade-2026-11-20')!;
    expect(post.content).toBe(
      'narrative\n\n---\n\n<details>\n<summary>Estatísticas do dia — 1 hr</summary>\n\n- TypeScript: 48 mins (80.0%)\n\n</details>',
    );
    expect(llm.prompts[0].user).toBe('Tempo total codando: 1 hr. Linguagens: TypeScript (48 mins).\n\nEscreva o parágrafo.');
  });

  it('ignores short coding days', async () => {
    tracker.today = { seconds: 120, total: '2 mins', languages: [], projects: [] };
    await ingest.run(date, false, 'local');
    expect(posts.items).toHaveLength(0);
  });

  it('records failed runs and rethrows', async () => {
    source.owned = async () => {
      throw new Error('boom');
    };
    await expect(ingest.run(date, false, 'local')).rejects.toThrow('boom');
    expect(journal.runs[0].outcome).toEqual({ status: 'error', created: 0, fallback: false, error: 'boom' });
  });
});

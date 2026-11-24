import { beforeEach, describe, expect, it } from 'vitest';
import { FakeCatalog, remote } from '@/test/ingest';
import { MemoryHub, MemorySettings } from '@/test/memory';
import { Service as Settings } from '../setting/service';
import { keys, Service } from './orgs';

describe('ingest orgs', () => {
  let rows: MemorySettings;
  let hub: MemoryHub;
  let catalog: FakeCatalog;
  let orgs: Service;

  beforeEach(() => {
    rows = new MemorySettings();
    hub = new MemoryHub();
    hub.orgs.set('Acme', [
      { ...remote('Acme/old', { description: 'legacy', topics: ['php'] }), pushedAt: '2026-01-01' },
      { ...remote('Acme/new', { private: true }), pushedAt: '2026-11-01' },
      { ...remote('Acme/fork', { fork: true }), pushedAt: '2026-10-01' },
    ]);
    catalog = new FakeCatalog();
    orgs = new Service(new Settings(rows), hub, catalog);
  });

  it('stores the canonical login and ignores case duplicates', async () => {
    expect(await orgs.add(' acme ')).toEqual(['Acme']);
    expect(await orgs.add('ACME')).toEqual(['Acme']);
    await expect(orgs.add('ghost')).rejects.toMatchObject({ code: 'invalid' });
    await expect(orgs.add('bad name!')).rejects.toMatchObject({ code: 'invalid' });
  });

  it('suggests memberships not yet configured', async () => {
    hub.member = ['Acme', 'Other'];
    await orgs.add('acme');
    await orgs.toggle('Acme/old', true);
    expect(await orgs.overview()).toEqual({ configured: ['Acme'], enabled: ['Acme/old'], suggestions: ['Other'], tokenMissing: false });
  });

  it('reports a missing token instead of calling GitHub', async () => {
    const offline = new Service(new Settings(rows), null);
    expect((await offline.overview()).tokenMissing).toBe(true);
    await expect(offline.add('acme')).rejects.toMatchObject({ code: 'config' });
  });

  it('toggles repos only for configured orgs and keeps them after the org is removed', async () => {
    await expect(orgs.toggle('Acme/new', true)).rejects.toMatchObject({ code: 'invalid' });
    await orgs.add('acme');
    await orgs.toggle('Acme/new', true);
    await orgs.toggle('acme/old', true);
    await orgs.toggle('ACME/OLD', false);
    expect(await orgs.enabled()).toEqual(['Acme/new']);

    await orgs.remove('acme');
    expect(await orgs.configured()).toEqual([]);
    expect(rows.values.get(keys.repos)).toBe('["Acme/new"]');
  });

  it('lists org repos newest push first with their opt-in flag', async () => {
    await orgs.add('acme');
    await orgs.toggle('Acme/old', true);
    expect((await orgs.repos('Acme')).map((r) => [r.name, r.enabled])).toEqual([
      ['new', false],
      ['fork', false],
      ['old', true],
    ]);
  });

  it('creates the project right away when a public repo is turned on', async () => {
    await orgs.add('acme');
    expect(await orgs.toggle('Acme/old', true)).toEqual({ repo: 'Acme/old', enabled: true, project: 'old' });
    expect(catalog.seeds).toEqual([
      expect.objectContaining({ slug: 'old', repo: 'Acme/old', description: 'legacy', tags: ['php'], content: '# Acme/old', status: 'active', languages: { Kotlin: 75, Shell: 25 } }),
    ]);
  });

  it('never creates projects for private repos, existing projects or when turning off', async () => {
    await orgs.add('acme');
    expect((await orgs.toggle('Acme/new', true)).project).toBeNull();
    expect((await orgs.toggle('Acme/fork', true)).project).toBeNull();
    await orgs.toggle('Acme/old', true);
    expect((await orgs.toggle('Acme/old', false)).project).toBeNull();
    expect((await orgs.toggle('Acme/old', true)).project).toBeNull();
    expect(catalog.seeds).toHaveLength(1);
  });

  it('keeps the toggle saved when project creation fails', async () => {
    await orgs.add('acme');
    catalog.seed = async () => {
      throw new Error('db down');
    };
    expect(await orgs.toggle('Acme/old', true)).toEqual({ repo: 'Acme/old', enabled: true, project: null });
    expect(await orgs.enabled()).toEqual(['Acme/old']);
  });
});

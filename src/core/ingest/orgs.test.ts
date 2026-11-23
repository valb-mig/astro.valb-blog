import { beforeEach, describe, expect, it } from 'vitest';
import { MemoryHub, MemorySettings } from '@/test/memory';
import { Service as Settings } from '../setting/service';
import { keys, Service } from './orgs';

describe('ingest orgs', () => {
  let rows: MemorySettings;
  let hub: MemoryHub;
  let orgs: Service;

  beforeEach(() => {
    rows = new MemorySettings();
    hub = new MemoryHub();
    hub.orgs.set('Acme', [
      { repo: 'Acme/old', name: 'old', private: false, archived: false, pushedAt: '2026-01-01' },
      { repo: 'Acme/new', name: 'new', private: true, archived: false, pushedAt: '2026-11-01' },
    ]);
    orgs = new Service(new Settings(rows), hub);
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
    expect(await orgs.overview()).toEqual({ configured: ['Acme'], suggestions: ['Other'], tokenMissing: false });
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
      ['old', true],
    ]);
  });
});

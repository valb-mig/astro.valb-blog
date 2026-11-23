import { describe, expect, it } from 'vitest';
import { MemorySettings } from '@/test/memory';
import { Service } from './service';

describe('setting service', () => {
  it('parses string arrays defensively', async () => {
    const rows = new MemorySettings();
    const settings = new Service(rows);
    rows.values.set('broken', '{nope');
    rows.values.set('mixed', JSON.stringify(['a', 1, 'b']));
    expect(await settings.list('missing')).toEqual([]);
    expect(await settings.list('broken')).toEqual([]);
    expect(await settings.list('mixed')).toEqual(['a', 'b']);
  });

  it('saves arrays deduplicated and sorted', async () => {
    const rows = new MemorySettings();
    expect(await new Service(rows).save('k', ['b', 'a', 'b'])).toEqual(['a', 'b']);
    expect(rows.values.get('k')).toBe('["a","b"]');
  });

  it('validates writes and reads maintenance flag', async () => {
    const settings = new Service(new MemorySettings());
    await expect(settings.set('k', 1)).rejects.toMatchObject({ code: 'invalid' });
    expect(await settings.maintenance()).toBe(false);
    await settings.set('maintenance_mode', 'true');
    expect(await settings.maintenance()).toBe(true);
  });
});

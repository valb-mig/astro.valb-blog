import { describe, expect, it } from 'vitest';
import type { Card, Health } from './project';
import { link, vital } from './vital';

const card = (over: Partial<Card>, h: Partial<Health> = {}): Card => ({
  id: 'x',
  slug: 'x',
  title: 'x',
  languages: null,
  draft: false,
  repo: null,
  uptimeUrl: null,
  health: { ci: null, ciAt: null, release: null, releaseAt: null, code: null, codeAt: null, deploy: null, deployAt: null, ...h },
  ...over,
});

describe('project vital', () => {
  it('prefers uptime over ci and deploy', () => {
    expect(vital(card({ uptimeUrl: 'u' }, { code: 200, ci: 'failure' })).level).toBe('ok');
    expect(vital(card({ uptimeUrl: 'u' }, { code: 503 }))).toEqual({ level: 'down', label: 'offline (503)' });
    expect(vital(card({ uptimeUrl: 'u' })).level).toBe('unknown');
  });

  it('falls back to ci, then deploy reports', () => {
    expect(vital(card({}, { ci: 'success' })).level).toBe('ok');
    expect(vital(card({}, { ci: 'timed_out' })).level).toBe('down');
    expect(vital(card({}, { ci: 'queued' })).level).toBe('warn');
    expect(vital(card({}, { deploy: {} })).level).toBe('ok');
    expect(vital(card({})).level).toBe('unknown');
  });

  it('links to the deployed url before the uptime endpoint', () => {
    expect(link(card({ uptimeUrl: 'health' }, { deploy: { url: 'site' } }))).toBe('site');
    expect(link(card({ uptimeUrl: 'health' }))).toBe('health');
    expect(link(card({}))).toBeNull();
  });
});

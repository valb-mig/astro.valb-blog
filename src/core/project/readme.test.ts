import { describe, expect, it } from 'vitest';
import { hero } from './readme';

const base = 'https://raw.githubusercontent.com/me/app/HEAD/';

describe('readme hero', () => {
  it('skips the logo and picks the first real screenshot', () => {
    const md = [
      '<img src="web/public/icon.svg" width="88" height="88" alt="">',
      '# app',
      '<img src="docs/images/grid-light.png" alt="grid">',
      '<img src="docs/images/board.png" alt="board">',
    ].join('\n');
    expect(hero(md, 'me/app')).toBe(`${base}docs/images/grid-light.png`);
  });

  it('ignores badges, small images, icon-named files and narrow svgs', () => {
    const md = [
      '![ci](https://github.com/me/app/actions/workflows/ci.yml/badge.svg)',
      '[![npm](https://img.shields.io/npm/v/app)](https://npm.im/app)',
      '<img src="art/logo-512.png">',
      '<img src="shot.png" width="120">',
      '![diagram](docs/flow.svg)',
      '![demo](./media/demo.gif)',
    ].join('\n');
    expect(hero(md, 'me/app')).toBe(`${base}media/demo.gif`);
  });

  it('keeps absolute urls and wide svgs', () => {
    expect(hero('![s](https://github.com/user-attachments/assets/abc)', 'me/app')).toBe(
      'https://github.com/user-attachments/assets/abc',
    );
    expect(hero('<img src="banner.svg" width="800">', 'me/app')).toBe(`${base}banner.svg`);
  });

  it('returns null without a usable image or repo', () => {
    expect(hero('<img src="icon.png" width="64">', 'me/app')).toBeNull();
    expect(hero('just text', 'me/app')).toBeNull();
    expect(hero('![s](shot.png)', null)).toBeNull();
    expect(hero(null, 'me/app')).toBeNull();
  });
});

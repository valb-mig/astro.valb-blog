import { describe, expect, it } from 'vitest';
import { resolve } from '@/core/project/readme';
import { render } from './markdown';

const raw = 'https://raw.githubusercontent.com/me/app/HEAD/';

describe('readme links', () => {
  it('resolves relative paths against the repo root', () => {
    expect(resolve('docs/icon.svg', raw)).toBe(`${raw}docs/icon.svg`);
    expect(resolve('./repo/img/a.png', raw)).toBe(`${raw}repo/img/a.png`);
    expect(resolve('/assets/a.png', raw)).toBe(`${raw}assets/a.png`);
    expect(resolve('../x.png?v=1#top', raw)).toBe(`${raw}x.png?v=1#top`);
    expect(resolve('.assets/dots.png', raw)).toBe(`${raw}.assets/dots.png`);
  });

  it('keeps absolute urls, anchors and other schemes', () => {
    for (const url of ['https://x.dev/a.png', 'http://x.dev', '//cdn.x/a.png', '#install', 'mailto:me@x.dev', 'data:image/png;base64,AA']) {
      expect(resolve(url, raw)).toBe(url);
    }
    expect(resolve(undefined, raw)).toBeUndefined();
  });

  it('rewrites images to raw and links to the repo blob only when a repo is given', async () => {
    const md = '<img src="docs/icon.svg" width="88">\n\n![shot](art/s.png) [docs](docs/README.md) [site](https://x.dev) [up](#top)';
    const html = await render(md, 'me/app');
    expect(html).toContain(`src="${raw}docs/icon.svg"`);
    expect(html).toContain(`src="${raw}art/s.png"`);
    expect(html).toContain('href="https://github.com/me/app/blob/HEAD/docs/README.md"');
    expect(html).toContain('href="https://x.dev"');
    expect(html).toContain('href="#top"');
    expect(await render(md)).toContain('src="docs/icon.svg"');
  });
});

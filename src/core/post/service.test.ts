import { beforeEach, describe, expect, it } from 'vitest';
import { MemoryPosts, MemoryUpdates } from '@/test/memory';
import { Service as Updates } from '../update/service';
import type { Input } from './post';
import { Service } from './service';

const input = (over: Partial<Input> = {}): Input => ({
  slug: 'hello',
  title: 'Hello',
  description: '',
  content: 'one two three',
  date: '2026-11-01',
  tags: [],
  draft: false,
  ...over,
});

describe('post service', () => {
  let rows: MemoryPosts;
  let news: MemoryUpdates;
  let posts: Service;

  beforeEach(() => {
    rows = new MemoryPosts();
    news = new MemoryUpdates();
    posts = new Service(rows, new Updates(news));
  });

  it('computes reading time, links projects and announces published posts', async () => {
    const post = await posts.create(input({ content: 'word '.repeat(450) }), ['p1']);
    expect(post.readingTime).toBe(3);
    expect(rows.links.get(post.id)).toEqual(['p1']);
    expect(news.items).toEqual([expect.objectContaining({ kind: 'post', source: 'auto', url: '/posts/hello' })]);
  });

  it('does not announce drafts', async () => {
    await posts.create(input({ draft: true }));
    expect(news.items).toHaveLength(0);
  });

  it('recomputes reading time only when content changes', async () => {
    const post = await posts.create(input());
    await posts.update(post.id, { title: 'New' });
    expect(rows.items[0].readingTime).toBe(1);
    await posts.update(post.id, { content: 'word '.repeat(401) });
    expect(rows.items[0].readingTime).toBe(3);
  });

  it('keeps links untouched when projects are not sent', async () => {
    const post = await posts.create(input(), ['p1']);
    await posts.update(post.id, { title: 'x' });
    expect(rows.links.get(post.id)).toEqual(['p1']);
    await posts.update(post.id, {}, []);
    expect(rows.links.get(post.id)).toEqual([]);
  });

  it('groups related published posts by shared project, newest first, excluding itself', async () => {
    rows.refs = [
      { id: 'a', slug: 'a', title: 'A' },
      { id: 'b', slug: 'b', title: 'B' },
    ];
    const main = await posts.create(input({ slug: 'main' }), ['a', 'b']);
    const old = await posts.create(input({ slug: 'old', date: '2026-01-01' }), ['a']);
    const fresh = await posts.create(input({ slug: 'fresh', date: '2026-12-01' }), ['a', 'b']);
    await posts.create(input({ slug: 'hidden', draft: true }), ['a']);

    const related = await posts.related((await posts.find({ id: main.id }, false))!);
    expect(related.all.map((p) => p.slug)).toEqual(['fresh', 'old']);
    expect(related.byProject.a.map((p) => p.id)).toEqual([fresh.id, old.id]);
    expect(related.byProject.b.map((p) => p.id)).toEqual([fresh.id]);
  });

  it('extracts activity days from post slugs', async () => {
    await posts.create(input({ slug: 'atividade-2026-11-02' }));
    await posts.create(input({ slug: 'atividade-2026-11-03', draft: true }));
    await posts.create(input({ slug: 'other' }));
    expect([...(await posts.days(false))]).toEqual(['2026-11-02']);
    expect((await posts.days(true)).size).toBe(2);
  });

  it('throws missing for unknown posts', async () => {
    await expect(posts.get({ slug: 'nope' }, true)).rejects.toMatchObject({ code: 'missing' });
  });
});

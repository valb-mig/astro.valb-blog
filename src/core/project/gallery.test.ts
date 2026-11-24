import { beforeEach, describe, expect, it } from 'vitest';
import { MemoryProjects } from '@/test/memory';
import { Gallery, type Bucket, type Upload } from './gallery';
import { cover, type Project } from './project';

class FakeBucket implements Bucket {
  stored = new Set<string>();
  fail = false;
  async put(path: string) {
    if (this.fail) throw new Error('storage down');
    this.stored.add(path);
  }
  async drop(paths: string[]) {
    for (const p of paths) this.stored.delete(p);
  }
}

const upload = (name: string, type = 'image/png', size = 10): Upload => ({ name, type, bytes: new Uint8Array(size) });

describe('gallery', () => {
  let projects: MemoryProjects;
  let bucket: FakeBucket;
  let gallery: Gallery;
  let n: number;

  beforeEach(() => {
    projects = new MemoryProjects();
    projects.items = [{ id: 'p' } as Project];
    bucket = new FakeBucket();
    n = 0;
    gallery = new Gallery(projects, bucket, () => `img${++n}`);
  });

  it('uploads under the project folder and appends in order', async () => {
    await gallery.add('p', [upload('a.png')]);
    const images = await gallery.add('p', [upload('b.webp', 'image/webp'), upload('c.jpg', 'image/jpeg')]);
    expect(images.map((i) => i.path)).toEqual(['p/img1.png', 'p/img2.webp', 'p/img3.jpg']);
    expect(images[0].url).toBe('https://cdn.test/p/img1.png');
    expect([...bucket.stored]).toHaveLength(3);
  });

  it('rejects unsupported types, oversized files and unknown projects before uploading', async () => {
    await expect(gallery.add('p', [upload('x.svg', 'image/svg+xml')])).rejects.toMatchObject({ code: 'invalid' });
    await expect(gallery.add('p', [upload('big.png', 'image/png', 5 * 1024 * 1024)])).rejects.toMatchObject({ code: 'invalid' });
    await expect(gallery.add('p', [])).rejects.toMatchObject({ code: 'invalid' });
    await expect(gallery.add('ghost', [upload('a.png')])).rejects.toMatchObject({ code: 'missing' });
    expect(bucket.stored.size).toBe(0);
  });

  it('cleans up already uploaded files when a later upload fails', async () => {
    const put = bucket.put.bind(bucket);
    bucket.put = async (path) => {
      if (path.endsWith('img2.png')) throw new Error('storage down');
      return put(path);
    };
    await expect(gallery.add('p', [upload('a.png'), upload('b.png')])).rejects.toThrow('storage down');
    expect(bucket.stored.size).toBe(0);
    expect(await projects.paths('p')).toEqual([]);
  });

  it('removes only images of the project, from list and storage', async () => {
    await gallery.add('p', [upload('a.png'), upload('b.png')]);
    expect((await gallery.remove('p', 'p/img1.png')).map((i) => i.path)).toEqual(['p/img2.png']);
    expect(bucket.stored.has('p/img1.png')).toBe(false);
    await expect(gallery.remove('p', 'other/img9.png')).rejects.toMatchObject({ code: 'invalid' });
  });

  it('reorders only with a permutation of the current images', async () => {
    await gallery.add('p', [upload('a.png'), upload('b.png')]);
    expect((await gallery.order('p', ['p/img2.png', 'p/img1.png'])).map((i) => i.path)).toEqual(['p/img2.png', 'p/img1.png']);
    await expect(gallery.order('p', ['p/img2.png'])).rejects.toMatchObject({ code: 'invalid' });
    await expect(gallery.order('p', ['p/img2.png', 'p/img2.png'])).rejects.toMatchObject({ code: 'invalid' });
    await expect(gallery.order('p', ['p/img2.png', 'x'])).rejects.toMatchObject({ code: 'invalid' });
  });

  it('uses the first image as cover, then the GitHub social preview', () => {
    expect(cover({ images: [{ path: 'p/1', url: 'u1' }], repo: 'me/x' })).toBe('u1');
    expect(cover({ images: [], repo: 'me/x' })).toBe('https://opengraph.githubassets.com/1/me/x');
    expect(cover({ images: [], repo: null })).toBeNull();
  });
});

import { Fault } from '../error';
import type { Projects } from './port';
import type { Image } from './project';

export type Upload = { name: string; type: string; bytes: Uint8Array };

export interface Bucket {
  put(path: string, upload: Upload): Promise<void>;
  drop(paths: string[]): Promise<void>;
}

export const types: { [mime: string]: string } = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
};

export const max = 4 * 1024 * 1024;

export class Gallery {
  constructor(
    private projects: Projects,
    private bucket: Bucket,
    private id: () => string = () => crypto.randomUUID(),
  ) {}

  async add(project: string, uploads: Upload[]): Promise<Image[]> {
    if (!uploads.length) throw new Fault('invalid', 'nenhuma imagem enviada');
    for (const u of uploads) {
      if (!types[u.type]) throw new Fault('invalid', `formato não suportado: ${u.name}`);
      if (u.bytes.byteLength > max) throw new Fault('invalid', `imagem maior que 4 MB: ${u.name}`);
    }
    const current = await this.current(project);
    const added: string[] = [];
    try {
      for (const u of uploads) {
        const path = `${project}/${this.id()}.${types[u.type]}`;
        await this.bucket.put(path, u);
        added.push(path);
      }
      return await this.projects.gallery(project, [...current, ...added]);
    } catch (err) {
      if (added.length) await this.bucket.drop(added).catch(() => undefined);
      throw err;
    }
  }

  async remove(project: string, path: unknown): Promise<Image[]> {
    const current = await this.current(project);
    if (typeof path !== 'string' || !current.includes(path)) throw new Fault('invalid', 'imagem não pertence ao projeto');
    const images = await this.projects.gallery(
      project,
      current.filter((p) => p !== path),
    );
    await this.bucket.drop([path]);
    return images;
  }

  async order(project: string, paths: unknown): Promise<Image[]> {
    const current = await this.current(project);
    const valid =
      Array.isArray(paths) &&
      paths.length === current.length &&
      new Set(paths).size === paths.length &&
      paths.every((p) => typeof p === 'string' && current.includes(p));
    if (!valid) throw new Fault('invalid', 'ordem inválida');
    return this.projects.gallery(project, paths as string[]);
  }

  private async current(project: string): Promise<string[]> {
    const paths = await this.projects.paths(project);
    if (!paths) throw new Fault('missing', 'Not found');
    return paths;
  }
}

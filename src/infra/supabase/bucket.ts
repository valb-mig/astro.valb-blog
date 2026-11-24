import type { Bucket as Port, Upload } from '@/core/project/gallery';
import type { Db } from './client';

export const name = 'projects';

export const url = (db: Db, path: string) => db.storage.from(name).getPublicUrl(path).data.publicUrl;

export class Bucket implements Port {
  private ready: Promise<void> | null = null;

  constructor(private db: Db) {}

  async put(path: string, upload: Upload): Promise<void> {
    await this.ensure();
    const { error } = await this.db.storage.from(name).upload(path, upload.bytes, { contentType: upload.type, upsert: false });
    if (error) throw new Error(error.message);
  }

  async drop(paths: string[]): Promise<void> {
    const { error } = await this.db.storage.from(name).remove(paths);
    if (error) throw new Error(error.message);
  }

  private ensure(): Promise<void> {
    this.ready ??= (async () => {
      const { data } = await this.db.storage.getBucket(name);
      if (data) return;
      const { error } = await this.db.storage.createBucket(name, { public: true });
      if (error && !/already exists/i.test(error.message)) throw new Error(error.message);
    })().catch((err) => {
      this.ready = null;
      throw err;
    });
    return this.ready;
  }
}

import { app } from '@/app';
import { body, json, route } from '@/app/http';
import { Fault } from '@/core/error';

export const POST = route(async ({ params, request }) => {
  const form = await request.formData().catch(() => null);
  if (!form) throw new Fault('invalid', 'envie as imagens como multipart/form-data');
  const files = form.getAll('files').filter((f): f is File => f instanceof File);
  const uploads = await Promise.all(
    files.map(async (f) => ({ name: f.name, type: f.type, bytes: new Uint8Array(await f.arrayBuffer()) })),
  );
  return json(await app.gallery.add(params.id!, uploads), 201);
}, true);

export const PUT = route(async (ctx) => json(await app.gallery.order(ctx.params.id!, (await body(ctx))?.paths)), true);

export const DELETE = route(async (ctx) => json(await app.gallery.remove(ctx.params.id!, (await body(ctx))?.path)), true);

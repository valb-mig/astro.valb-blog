import { useRef, useState, type DragEvent } from 'react';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, ImagePlus, Loader2, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Image } from '@/core/project/project';

const accept = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif'];

const edge = 1920;

async function shrink(file: File): Promise<File> {
  if (file.type === 'image/gif') return file;
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  const scale = Math.min(1, edge / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, 'image/webp', 0.85));
  if (!blob || (scale === 1 && blob.size >= file.size)) return file;
  return new File([blob], file.name.replace(/\.\w+$/, '') + '.webp', { type: 'image/webp' });
}

async function reason(res: Response, fallback: string): Promise<string> {
  const { error } = await res.json().catch(() => ({ error: null }));
  return error ?? fallback;
}

export function ImageManager({ project, images: initial }: { project: string; images: Image[] }) {
  const [images, setImages] = useState(initial);
  const [busy, setBusy] = useState(0);
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const base = `/api/projects/${project}/images`;

  const upload = async (files: File[]) => {
    const valid = files.filter((f) => accept.includes(f.type));
    if (valid.length < files.length) toast.error('alguns arquivos foram ignorados (formato não suportado)');
    if (!valid.length) return;

    setBusy(valid.length);
    let done = 0;
    for (const file of valid) {
      try {
        const form = new FormData();
        form.append('files', await shrink(file));
        const res = await fetch(base, { method: 'POST', body: form });
        if (!res.ok) throw new Error(await reason(res, `Erro ao enviar ${file.name}`));
        setImages(await res.json());
        done++;
      } catch (err) {
        toast.error((err as Error).message);
      }
      setBusy((b) => b - 1);
    }
    if (done) toast.success(done === 1 ? 'Imagem adicionada.' : `${done} imagens adicionadas.`);
  };

  const send = async (method: 'PUT' | 'DELETE', payload: object, previous: Image[]) => {
    const res = await fetch(base, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      toast.error(await reason(res, 'Erro ao salvar'));
      setImages(previous);
      return;
    }
    setImages(await res.json());
  };

  const move = (i: number, step: number) => {
    const j = i + step;
    if (j < 0 || j >= images.length) return;
    const next = [...images];
    [next[i], next[j]] = [next[j], next[i]];
    const previous = images;
    setImages(next);
    send('PUT', { paths: next.map((img) => img.path) }, previous);
  };

  const remove = (img: Image) => {
    if (!confirm('Remover esta imagem?')) return;
    const previous = images;
    setImages(images.filter((i) => i.path !== img.path));
    send('DELETE', { path: img.path }, previous);
  };

  const drop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    upload([...e.dataTransfer.files]);
  };

  return (
    <div className="flex flex-col gap-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={drop}
        className={`flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-6 text-center transition-colors ${over ? 'border-foreground/50 bg-muted/40' : 'border-border'}`}
      >
        {busy > 0 ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : (
          <ImagePlus className="h-5 w-5 text-muted-foreground" />
        )}
        <p className="text-xs text-muted-foreground">
          {busy > 0 ? `enviando ${busy}...` : 'arraste imagens aqui ou'}
        </p>
        <Button type="button" variant="outline" size="sm" disabled={busy > 0} onClick={() => input.current?.click()}>
          escolher arquivos
        </Button>
        <input
          ref={input}
          type="file"
          accept={accept.join(',')}
          multiple
          hidden
          onChange={(e) => {
            upload([...(e.target.files ?? [])]);
            e.target.value = '';
          }}
        />
        <p className="text-[11px] text-muted-foreground">
          png, jpg, webp, gif ou avif · reduzidas pra até 1920px · a primeira vira capa
        </p>
      </div>

      {images.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {images.map((img, i) => (
            <div key={img.path} className="group relative overflow-hidden rounded-lg border border-border">
              <img src={img.url} alt="" loading="lazy" className="aspect-[2/1] w-full object-cover" />
              {i === 0 && <Badge className="absolute top-2 left-2">capa</Badge>}
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-black/70 to-transparent p-1.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className="h-7 w-7"
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                    aria-label="mover pra esquerda"
                  >
                    <ArrowLeft />
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className="h-7 w-7"
                    disabled={i === images.length - 1}
                    onClick={() => move(i, 1)}
                    aria-label="mover pra direita"
                  >
                    <ArrowRight />
                  </Button>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => remove(img)}
                  aria-label="remover imagem"
                >
                  <X />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

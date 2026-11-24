import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export function ProjectGallery({ images, title }: { images: string[]; title: string }) {
  const [open, setOpen] = useState<number | null>(null);

  const step = (d: number) => setOpen((i) => (i === null ? i : (i + d + images.length) % images.length));

  useEffect(() => {
    if (open === null) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') step(-1);
      if (e.key === 'ArrowRight') step(1);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [open]);

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {images.map((url, i) => (
          <button
            key={url}
            type="button"
            onClick={() => setOpen(i)}
            className="overflow-hidden rounded-lg border border-border transition-opacity hover:opacity-85"
            aria-label={`abrir imagem ${i + 1} de ${title}`}
          >
            <img src={url} alt="" loading="lazy" className="aspect-[2/1] w-full object-cover" />
          </button>
        ))}
      </div>

      <Dialog open={open !== null} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-w-[calc(100%-2rem)] gap-2 bg-transparent p-0 ring-0 sm:max-w-5xl">
          <DialogTitle className="sr-only">
            {title} — imagem {(open ?? 0) + 1} de {images.length}
          </DialogTitle>
          {open !== null && (
            <img src={images[open]} alt="" className="max-h-[80vh] w-full rounded-lg object-contain" />
          )}
          {images.length > 1 && (
            <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground">
              <Button type="button" variant="secondary" size="icon" onClick={() => step(-1)} aria-label="anterior">
                <ChevronLeft />
              </Button>
              <span className="tabular-nums">
                {(open ?? 0) + 1} / {images.length}
              </span>
              <Button type="button" variant="secondary" size="icon" onClick={() => step(1)} aria-label="próxima">
                <ChevronRight />
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

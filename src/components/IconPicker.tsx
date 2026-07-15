import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import { X } from 'lucide-react';
import { InlineIcon, cacheIcon } from '@/components/InlineIcon';

type IconResult = { slug: string; svg: string };

interface Props {
  value: string | null;
  onChange: (slug: string | null) => void;
}

export function IconPicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<IconResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const handle = setTimeout(() => {
      fetch(`/api/icons/search?q=${encodeURIComponent(query.trim())}`)
        .then((res) => res.json())
        .then((data: IconResult[]) => setResults(data))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(handle);
  }, [open, query]);

  const select = (icon: IconResult) => {
    cacheIcon(icon.slug, icon.svg);
    onChange(icon.slug);
    setOpen(false);
    setQuery('');
  };

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-background hover:border-foreground/40"
        title="escolher ícone"
      >
        {value ? (
          <InlineIcon slug={value} className="size-4 [&_svg]:size-full" />
        ) : (
          <span className="text-xs text-muted-foreground">?</span>
        )}
      </button>
      {value && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="text-muted-foreground hover:text-destructive"
          aria-label="remover ícone"
        >
          <X className="size-3.5" />
        </button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="overflow-hidden p-0 sm:max-w-md" showCloseButton={false}>
          <DialogHeader className="sr-only">
            <DialogTitle>escolher ícone</DialogTitle>
            <DialogDescription>busca por nome (ex: github, vercel, docker)</DialogDescription>
          </DialogHeader>
          <Command shouldFilter={false}>
            <CommandInput placeholder="buscar ícone..." value={query} onValueChange={setQuery} />
            <CommandList>
              {!loading && results.length === 0 && <CommandEmpty>nenhum ícone encontrado.</CommandEmpty>}
              <CommandGroup>
                <div className="grid grid-cols-4 gap-1 p-1">
                  {results.map((icon) => (
                    <CommandItem
                      key={icon.slug}
                      value={icon.slug}
                      onSelect={() => select(icon)}
                      className="flex flex-col items-center gap-1 rounded-md py-2 text-center"
                    >
                      <span className="size-5 [&_svg]:size-full" dangerouslySetInnerHTML={{ __html: icon.svg }} />
                      <span className="w-full truncate text-[11px] text-muted-foreground">{icon.slug}</span>
                    </CommandItem>
                  ))}
                </div>
              </CommandGroup>
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </div>
  );
}

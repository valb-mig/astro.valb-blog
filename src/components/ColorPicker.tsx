import { useState } from 'react';
import { HexColorPicker, HexColorInput } from 'react-colorful';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface Props {
  value: string | null;
  onChange: (color: string | null) => void;
}

export function ColorPicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const color = value ?? '#a1a1aa';

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="size-8 shrink-0 rounded-md border border-border"
        style={{ backgroundColor: value ?? undefined }}
        title="escolher cor do ícone"
      >
        {!value && <span className="block size-full rounded-md bg-[repeating-conic-gradient(#71717a_0_25%,transparent_0_50%)] bg-[length:8px_8px] opacity-40" />}
      </button>
      {value && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="text-muted-foreground hover:text-destructive"
          aria-label="remover cor"
        >
          <X className="size-3.5" />
        </button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-auto p-4 sm:max-w-none" showCloseButton={false}>
          <DialogHeader className="sr-only">
            <DialogTitle>cor do ícone</DialogTitle>
            <DialogDescription>escolha a cor de preenchimento do ícone</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <HexColorPicker color={color} onChange={onChange} />
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">#</span>
              <HexColorInput
                color={color}
                onChange={onChange}
                prefixed={false}
                className="h-9 w-full rounded-md border border-border bg-background px-2.5 text-sm uppercase outline-none focus:border-foreground/40"
              />
            </div>
            <div className="flex justify-end">
              <Button type="button" size="sm" onClick={() => setOpen(false)}>
                concluído
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

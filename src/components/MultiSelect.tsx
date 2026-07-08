import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";

type Option = { value: string; label: string };

interface Props {
  hiddenInputId: string;
  initialValue: string[];
  options: Option[];
  creatable?: boolean;
  placeholder?: string;
  triggerLabel?: string;
}

export function MultiSelect({
  hiddenInputId,
  initialValue,
  options,
  creatable = false,
  placeholder = "Buscar...",
  triggerLabel = "adicionar",
}: Props) {
  const [value, setValue] = useState<string[]>(initialValue);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const labelFor = (v: string) => options.find((o) => o.value === v)?.label ?? v;

  const commit = (next: string[]) => {
    setValue(next);
    const hidden = document.getElementById(hiddenInputId) as HTMLInputElement | null;
    if (hidden) hidden.value = JSON.stringify(next);
  };

  const toggle = (v: string) => {
    commit(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  };

  const remove = (v: string) => commit(value.filter((x) => x !== v));

  const filtered = options.filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase()));
  const exactMatch = options.some((o) => o.value.toLowerCase() === query.trim().toLowerCase());

  const createNew = () => {
    const v = query.trim();
    if (!v || value.includes(v)) return;
    commit([...value, v]);
    setQuery("");
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {value.map((v) => (
          <Badge key={v} variant="secondary" className="gap-1">
            {labelFor(v)}
            <button
              type="button"
              onClick={() => remove(v)}
              className="ml-0.5 opacity-60 hover:opacity-100"
              aria-label={`remover ${labelFor(v)}`}
            >
              <X className="size-3" />
            </button>
          </Badge>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
          <Plus />
          {triggerLabel}
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="overflow-hidden p-0 sm:max-w-md" showCloseButton={false}>
          <DialogHeader className="sr-only">
            <DialogTitle>{triggerLabel}</DialogTitle>
            <DialogDescription>{placeholder}</DialogDescription>
          </DialogHeader>
          <Command shouldFilter={false}>
            <CommandInput placeholder={placeholder} value={query} onValueChange={setQuery} />
            <CommandList>
              {filtered.length === 0 && !(creatable && query.trim()) && (
                <CommandEmpty>Nenhum resultado.</CommandEmpty>
              )}
              <CommandGroup>
                {filtered.map((o) => (
                  <CommandItem
                    key={o.value}
                    data-checked={value.includes(o.value)}
                    onSelect={() => toggle(o.value)}
                  >
                    {o.label}
                  </CommandItem>
                ))}
                {creatable && query.trim() && !exactMatch && (
                  <CommandItem onSelect={createNew}>Criar "{query.trim()}"</CommandItem>
                )}
              </CommandGroup>
            </CommandList>
          </Command>
          <div className="flex justify-end border-t border-border p-2">
            <Button type="button" size="sm" onClick={() => setOpen(false)}>
              concluído
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

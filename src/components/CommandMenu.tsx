import { useEffect, useRef, useState } from "react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { FileText, FolderGit2, ArrowRight, Zap } from "lucide-react";

type PaletteItem = {
  type: "post" | "project" | "nav" | "action";
  title: string;
  subtitle?: string;
  href?: string;
  action?: string;
};

const GROUP_LABELS: Record<PaletteItem["type"], string> = {
  post: "Posts",
  project: "Projetos",
  nav: "Navegação",
  action: "Ações",
};

const ICONS: Record<PaletteItem["type"], React.ComponentType<{ className?: string }>> = {
  post: FileText,
  project: FolderGit2,
  nav: ArrowRight,
  action: Zap,
};

export function CommandMenu() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<PaletteItem[]>([]);
  const fetchedRef = useRef(false);

  useEffect(() => {
    const onKeydown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    const onOpenRequest = () => setOpen(true);

    document.addEventListener("keydown", onKeydown);
    document.addEventListener("open-command-menu", onOpenRequest);
    return () => {
      document.removeEventListener("keydown", onKeydown);
      document.removeEventListener("open-command-menu", onOpenRequest);
    };
  }, []);

  useEffect(() => {
    if (!open || fetchedRef.current) return;
    fetchedRef.current = true;
    fetch("/api/command-items")
      .then((res) => res.json())
      .then(setItems)
      .catch(() => {
        fetchedRef.current = false;
      });
  }, [open]);

  const runItem = (item: PaletteItem) => {
    setOpen(false);
    if (item.action === "copy-url") {
      navigator.clipboard.writeText(window.location.href);
      return;
    }
    if (item.href) window.location.href = item.href;
  };

  const groups = (["post", "project", "nav", "action"] as const)
    .map((type) => ({ type, entries: items.filter((i) => i.type === type) }))
    .filter((g) => g.entries.length > 0);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Buscar posts, projetos, páginas..." />
      <CommandList>
        <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
        {groups.map((group) => {
          const Icon = ICONS[group.type];
          return (
            <CommandGroup key={group.type} heading={GROUP_LABELS[group.type]}>
              {group.entries.map((item) => (
                <CommandItem
                  key={`${item.type}-${item.title}`}
                  value={`${item.title} ${item.subtitle ?? ""}`}
                  onSelect={() => runItem(item)}
                >
                  <Icon className="text-muted-foreground" />
                  <div className="flex flex-col">
                    <span>{item.title}</span>
                    {item.subtitle && (
                      <span className="text-xs text-muted-foreground">{item.subtitle}</span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          );
        })}
      </CommandList>
    </CommandDialog>
  );
}

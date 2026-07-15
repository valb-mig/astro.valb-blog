import { useEffect, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Update = {
  id: string;
  message: string;
  ref_url: string | null;
  created_at: string;
};

const PAGE_SIZE = 20;

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Update[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const fetchedRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const loadMore = async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    const last = items[items.length - 1];
    const url = last ? `/api/updates?before=${encodeURIComponent(last.created_at)}` : '/api/updates';
    const res = await fetch(url);
    const data: Update[] = await res.json();
    setItems((prev) => [...prev, ...data]);
    setHasMore(data.length === PAGE_SIZE);
    setLoading(false);
  };

  useEffect(() => {
    if (!open || fetchedRef.current) return;
    fetchedRef.current = true;
    loadMore();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  const onScroll = () => {
    const el = listRef.current;
    if (!el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 48) loadMore();
  };

  return (
    <div ref={containerRef} className="relative">
      <Button
        variant="ghost"
        size="icon"
        className="text-muted-foreground hover:text-foreground"
        aria-label="Notificações"
        onClick={() => setOpen((v) => !v)}
      >
        <Bell />
      </Button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-lg border border-border bg-popover shadow-md">
          <div className="border-b border-border px-3 py-2 text-sm font-medium">Novidades</div>
          <div ref={listRef} onScroll={onScroll} className="max-h-80 overflow-y-auto">
            {items.length === 0 && !loading && (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">nenhuma novidade ainda.</p>
            )}
            {items.map((item) => (
              <div key={item.id} className="border-b border-border/60 px-3 py-2.5 text-sm last:border-0">
                {item.ref_url ? (
                  <a href={item.ref_url} className="hover:underline">
                    {item.message}
                  </a>
                ) : (
                  item.message
                )}
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {new Date(item.created_at).toLocaleString('pt-BR')}
                </p>
              </div>
            ))}
            {loading && <p className="px-3 py-3 text-center text-xs text-muted-foreground">carregando...</p>}
          </div>
        </div>
      )}
    </div>
  );
}

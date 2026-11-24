import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Search } from 'lucide-react';
import type { Repo } from '@/core/project/project';

type Row = Repo & { repo: string };

type Field = 'mention' | 'private';

const col = { mention: 'w-[72px]', private: 'w-[56px]' } as const;

export function RepoIngestPanel() {
  const [projects, setProjects] = useState<Row[] | null>(null);
  const [search, setSearch] = useState('');
  const [updating, setUpdating] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch('/api/projects/ingest-settings')
      .then((r) => r.json())
      .then((data: Row[]) => setProjects(data))
      .catch(() => toast.error('Erro ao carregar repos'));
  }, []);

  const groups = useMemo(() => {
    const q = search.toLowerCase();
    const map = new Map<string, Row[]>();
    for (const p of projects ?? []) {
      if (q && !p.repo.toLowerCase().includes(q) && !p.title.toLowerCase().includes(q)) continue;
      const owner = p.repo.split('/')[0];
      map.set(owner, [...(map.get(owner) ?? []), p]);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [projects, search]);

  const toggle = async (project: Row, field: Field, value: boolean) => {
    const key = `${project.id}-${field}`;
    const flip = (v: boolean) =>
      setProjects((ps) => ps?.map((p) => (p.id === project.id ? { ...p, [field]: v } : p)) ?? null);

    setUpdating((u) => new Set([...u, key]));
    flip(value);

    const res = await fetch(`/api/projects/${project.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value }),
    });

    setUpdating((u) => {
      const next = new Set(u);
      next.delete(key);
      return next;
    });

    if (!res.ok) {
      toast.error('Erro ao salvar');
      flip(!value);
    }
  };

  if (!projects) return <p className="px-5 py-4 text-sm text-muted-foreground">carregando repos...</p>;

  if (!projects.length) {
    return <p className="px-5 py-4 text-sm text-muted-foreground">nenhum projeto com repo GitHub.</p>;
  }

  const mentioned = projects.filter((p) => p.mention).length;
  const mirrored = projects.filter((p) => p.private).length;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-col gap-2 border-b border-border px-5 py-3">
        <div className="relative">
          <Search className="pointer-events-none absolute top-2.5 left-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="filtrar repos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 pl-8"
          />
        </div>
        <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
          <p className="text-foreground/80">
            {projects.length} repos · {mentioned} mencionados · {mirrored} privados espelhados
          </p>
          <p>
            <strong className="font-medium text-foreground/80">mencionar</strong>: commits entram no post do dia.{' '}
            <strong className="font-medium text-foreground/80">privado</strong>: espelha o repo privado no ingest.
          </p>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-5 pb-4">
        <div className="sticky top-0 z-10 flex items-center bg-popover py-2 text-xs text-muted-foreground">
          <span className="min-w-0 flex-1">repo</span>
          <div className="flex shrink-0 items-center gap-3 pr-3">
            <span className={`${col.mention} text-center`}>mencionar</span>
            <span className={`${col.private} text-center`}>privado</span>
          </div>
        </div>

        {!groups.length ? (
          <p className="py-2 text-sm text-muted-foreground">nenhum resultado.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {groups.map(([owner, items]) => (
              <div key={owner} className="flex flex-col gap-1">
                <p className="px-1 text-xs font-medium text-muted-foreground">
                  {owner} <span className="opacity-60">· {items.length}</span>
                </p>
                <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
                  {items.map((p) => (
                    <div key={p.id} className="flex items-center gap-3 px-3 py-2">
                      <span className="min-w-0 flex-1 truncate font-mono text-sm" title={p.repo}>
                        {p.repo.split('/')[1] ?? p.repo}
                      </span>
                      <div className="flex shrink-0 items-center gap-3">
                        <div className={`${col.mention} flex justify-center`}>
                          <Switch
                            checked={p.mention}
                            onCheckedChange={(v) => toggle(p, 'mention', v)}
                            disabled={updating.has(`${p.id}-mention`)}
                            aria-label={`mencionar ${p.repo} no post`}
                          />
                        </div>
                        <div className={`${col.private} flex justify-center`}>
                          <Switch
                            checked={p.private}
                            onCheckedChange={(v) => toggle(p, 'private', v)}
                            disabled={updating.has(`${p.id}-private`)}
                            aria-label={`espelhar ${p.repo} privado`}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

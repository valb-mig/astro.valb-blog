import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Search } from 'lucide-react';

type RepoProject = {
  id: string;
  title: string;
  repo: string;
  mention_allowed: boolean;
  ingest_private: boolean;
};

export function RepoIngestPanel() {
  const [projects, setProjects] = useState<RepoProject[] | null>(null);
  const [search, setSearch] = useState('');
  const [updating, setUpdating] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch('/api/projects/ingest-settings')
      .then((r) => r.json())
      .then((data: RepoProject[]) => setProjects(data))
      .catch(() => toast.error('Erro ao carregar repos'));
  }, []);

  const filtered = useMemo(() => {
    if (!projects) return [];
    const q = search.toLowerCase();
    if (!q) return projects;
    return projects.filter(
      (p) => p.repo.toLowerCase().includes(q) || p.title.toLowerCase().includes(q),
    );
  }, [projects, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, RepoProject[]>();
    for (const p of filtered) {
      const org = p.repo.split('/')[0];
      if (!map.has(org)) map.set(org, []);
      map.get(org)!.push(p);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const toggle = async (
    project: RepoProject,
    field: 'mention_allowed' | 'ingest_private',
    value: boolean,
  ) => {
    const key = `${project.id}-${field}`;
    setUpdating((u) => new Set([...u, key]));
    setProjects((ps) => ps?.map((p) => (p.id === project.id ? { ...p, [field]: value } : p)) ?? null);

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
      setProjects((ps) => ps?.map((p) => (p.id === project.id ? { ...p, [field]: !value } : p)) ?? null);
    }
  };

  if (!projects) {
    return <p className="text-sm text-muted-foreground">carregando repos...</p>;
  }

  if (projects.length === 0) {
    return <p className="text-sm text-muted-foreground">nenhum projeto com repo GitHub.</p>;
  }

  const COL = { mention: 'w-[68px]', private: 'w-[52px]' } as const;

  return (
    <div className="flex flex-col gap-3 min-w-0">
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="filtrar repos..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8 h-9"
        />
      </div>

      {grouped.length === 0 ? (
        <p className="text-sm text-muted-foreground">nenhum resultado.</p>
      ) : (
        <div className="relative flex flex-col gap-2 max-h-72 overflow-y-auto overflow-x-hidden">
          <div className="sticky top-0 z-10 flex items-center px-3 py-1 bg-card border-b border-border">
            <span className="flex-1 min-w-0" />
            <div className="flex items-center gap-3 shrink-0 text-xs text-muted-foreground">
              <span className={`${COL.mention} text-center`}>mencionar</span>
              <span className={`${COL.private} text-center`}>privado</span>
            </div>
          </div>

          {grouped.map(([org, items]) => (
            <div key={org} className="flex flex-col gap-0.5">
              <p className="text-xs font-medium text-muted-foreground px-1">{org}</p>
              <div className="rounded-lg border border-border divide-y divide-border overflow-hidden">
                {items.map((p) => {
                  const repoName = p.repo.split('/')[1] ?? p.repo;
                  return (
                    <div key={p.id} className="flex items-center gap-3 px-3 py-2">
                      <span className="flex-1 min-w-0 text-sm font-mono truncate" title={p.repo}>
                        {repoName}
                      </span>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className={`${COL.mention} flex justify-center`}>
                          <Switch
                            checked={p.mention_allowed}
                            onCheckedChange={(v) => toggle(p, 'mention_allowed', v)}
                            disabled={updating.has(`${p.id}-mention_allowed`)}
                            aria-label="mencionar no post"
                          />
                        </div>
                        <div className={`${COL.private} flex justify-center`}>
                          <Switch
                            checked={p.ingest_private}
                            onCheckedChange={(v) => toggle(p, 'ingest_private', v)}
                            disabled={updating.has(`${p.id}-ingest_private`)}
                            aria-label="incluir privado"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

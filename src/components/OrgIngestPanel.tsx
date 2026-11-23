import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { ChevronRight, Lock, X } from 'lucide-react';

type OrgRepo = {
  repo: string;
  name: string;
  private: boolean;
  archived: boolean;
  pushed_at: string | null;
  enabled: boolean;
};

type OrgsResponse = { configured: string[]; suggestions: string[]; tokenMissing: boolean };

async function errorMessage(res: Response, fallback: string): Promise<string> {
  const { error } = await res.json().catch(() => ({ error: null }));
  return error ?? fallback;
}

function OrgRepoList({ org, enqueue }: { org: string; enqueue: (task: () => Promise<void>) => void }) {
  const [repos, setRepos] = useState<OrgRepo[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/ingest/orgs/${encodeURIComponent(org)}/repos`)
      .then(async (res) => {
        if (!res.ok) throw new Error(await errorMessage(res, 'Erro ao carregar repos'));
        return res.json();
      })
      .then((data: OrgRepo[]) => setRepos(data))
      .catch((err: Error) => setError(err.message));
  }, [org]);

  const toggle = (repo: OrgRepo, enabled: boolean) => {
    setRepos((rs) => rs?.map((r) => (r.repo === repo.repo ? { ...r, enabled } : r)) ?? null);
    enqueue(async () => {
      try {
        const res = await fetch('/api/ingest/org-repos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ repo: repo.repo, enabled }),
        });
        if (!res.ok) throw new Error(await errorMessage(res, 'Erro ao salvar'));
      } catch (err) {
        toast.error((err as Error).message);
        setRepos((rs) => rs?.map((r) => (r.repo === repo.repo ? { ...r, enabled: !enabled } : r)) ?? null);
      }
    });
  };

  if (error) return <p className="px-3 py-2 text-xs text-destructive">{error}</p>;
  if (!repos) return <p className="px-3 py-2 text-xs text-muted-foreground">carregando repos...</p>;
  if (!repos.length) return <p className="px-3 py-2 text-xs text-muted-foreground">nenhum repo visível.</p>;

  return (
    <div className="max-h-60 divide-y divide-border overflow-y-auto overflow-x-hidden">
      {repos.map((r) => (
        <div key={r.repo} className="flex items-center gap-3 px-3 py-2">
          <span className="flex min-w-0 flex-1 items-center gap-1.5">
            {r.private && <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-label="privado" />}
            <span className="truncate font-mono text-sm" title={r.repo}>
              {r.name}
            </span>
            {r.archived && (
              <Badge variant="outline" className="shrink-0">
                arquivado
              </Badge>
            )}
          </span>
          <Switch
            checked={r.enabled}
            onCheckedChange={(v) => toggle(r, v)}
            aria-label={`ingerir ${r.repo}`}
          />
        </div>
      ))}
    </div>
  );
}

export function OrgIngestPanel() {
  const [data, setData] = useState<OrgsResponse | null>(null);
  const [input, setInput] = useState('');
  const [adding, setAdding] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  // Toggles de repo rodam em fila — cada POST faz read-modify-write da lista
  // inteira no servidor, então dois em paralelo poderiam se sobrescrever.
  const queue = useRef<Promise<void>>(Promise.resolve());

  const enqueue = (task: () => Promise<void>) => {
    queue.current = queue.current.then(task);
  };

  useEffect(() => {
    fetch('/api/ingest/orgs')
      .then((res) => res.json())
      .then((d: OrgsResponse) => setData(d))
      .catch(() => toast.error('Erro ao carregar organizações'));
  }, []);

  const addOrg = async (org: string) => {
    if (!org.trim()) return;
    setAdding(true);
    const res = await fetch('/api/ingest/orgs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ org: org.trim() }),
    }).finally(() => setAdding(false));

    if (!res.ok) {
      toast.error(await errorMessage(res, 'Erro ao adicionar organização'));
      return;
    }
    const { configured } = await res.json();
    setData((d) =>
      d && {
        ...d,
        configured,
        suggestions: d.suggestions.filter((s) => !configured.some((c: string) => c.toLowerCase() === s.toLowerCase())),
      },
    );
    setInput('');
  };

  const removeOrg = async (org: string) => {
    const res = await fetch('/api/ingest/orgs', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ org }),
    });
    if (!res.ok) {
      toast.error(await errorMessage(res, 'Erro ao remover organização'));
      return;
    }
    const { configured } = await res.json();
    setData((d) => d && { ...d, configured, suggestions: [...d.suggestions, org].sort((a, b) => a.localeCompare(b)) });
    if (expanded === org) setExpanded(null);
  };

  if (!data) return <p className="text-sm text-muted-foreground">carregando organizações...</p>;

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {data.tokenMissing && (
        <p className="text-xs text-destructive">
          GH_READ_TOKEN não configurado — não dá pra listar organizações nem repos.
        </p>
      )}

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          addOrg(input);
        }}
      >
        <Input
          placeholder="adicionar organização..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          list="ingest-org-suggestions"
          className="h-9"
          disabled={data.tokenMissing}
        />
        <datalist id="ingest-org-suggestions">
          {data.suggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
        <Button type="submit" size="sm" disabled={adding || data.tokenMissing || !input.trim()} className="h-9">
          {adding ? 'adicionando...' : 'adicionar'}
        </Button>
      </form>

      {data.configured.length === 0 ? (
        <p className="text-sm text-muted-foreground">nenhuma organização adicionada.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {data.configured.map((org) => (
            <div key={org} className="overflow-hidden rounded-lg border border-border">
              <div className="flex items-center gap-2 px-3 py-2">
                <button
                  type="button"
                  onClick={() => setExpanded((e) => (e === org ? null : org))}
                  className="flex min-w-0 flex-1 items-center gap-1.5 text-left text-sm font-medium"
                  aria-expanded={expanded === org}
                >
                  <ChevronRight
                    className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${expanded === org ? 'rotate-90' : ''}`}
                  />
                  <span className="truncate">{org}</span>
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeOrg(org)}
                  title={`remover ${org}`}
                  aria-label={`remover ${org}`}
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                >
                  <X />
                </Button>
              </div>
              {expanded === org && (
                <div className="border-t border-border">
                  <OrgRepoList org={org} enqueue={enqueue} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

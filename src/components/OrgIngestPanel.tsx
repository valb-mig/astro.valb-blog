import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { ChevronRight, ExternalLink, Globe, KeyRound, Lock, Plus, Search, X } from 'lucide-react';
import type { Repo } from '@/core/ingest/hub';
import type { Overview, Toggled } from '@/core/ingest/orgs';

type Row = Repo & { enabled: boolean };

const tokenUrl = 'https://github.com/settings/tokens/new?scopes=read:org,repo&description=valb-blog%20(leitura)';

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

async function reason(res: Response, fallback: string): Promise<string> {
  const { error } = await res.json().catch(() => ({ error: null }));
  return error ?? fallback;
}

function Setup() {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
      <p className="flex items-center gap-2 text-sm font-medium">
        <KeyRound className="h-4 w-4 text-amber-500" />
        falta o GH_READ_TOKEN
      </p>
      <ol className="flex list-decimal flex-col gap-1.5 pl-4 text-xs text-muted-foreground">
        <li>
          crie um token clássico só com <code className="text-foreground/80">read:org</code> e{' '}
          <code className="text-foreground/80">repo</code>:{' '}
          <a
            href={tokenUrl}
            target="_blank"
            rel="noopener"
            className="inline-flex items-center gap-1 text-foreground underline-offset-2 hover:underline"
          >
            criar token <ExternalLink className="h-3 w-3" />
          </a>
        </li>
        <li>
          adicione no <code className="text-foreground/80">.env</code> (e nas env vars da Vercel):{' '}
          <code className="text-foreground/80">GH_READ_TOKEN=ghp_...</code>
        </li>
        <li>reinicie o servidor e abra esta aba de novo.</li>
      </ol>
      <p className="text-xs text-muted-foreground">
        fine-grained não serve: fica preso a um owner só. nunca reuse o GH_TOKEN do ingest aqui.
      </p>
    </div>
  );
}

function Repos({
  org,
  enqueue,
  onToggle,
}: {
  org: string;
  enqueue: (task: () => Promise<void>) => void;
  onToggle: (repo: string, on: boolean) => void;
}) {
  const [repos, setRepos] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch(`/api/ingest/orgs/${encodeURIComponent(org)}/repos`)
      .then(async (res) => {
        if (!res.ok) throw new Error(await reason(res, 'Erro ao carregar repos'));
        return res.json();
      })
      .then((data: Row[]) => setRepos(data))
      .catch((err: Error) => setError(err.message));
  }, [org]);

  const shown = useMemo(() => {
    const q = search.toLowerCase();
    return (repos ?? []).filter((r) => !q || r.name.toLowerCase().includes(q));
  }, [repos, search]);

  const set = (repo: Row, on: boolean) => {
    setRepos((rs) => rs?.map((r) => (r.repo === repo.repo ? { ...r, enabled: on } : r)) ?? null);
    onToggle(repo.repo, on);
  };

  const toggle = (repo: Row, on: boolean) => {
    set(repo, on);
    enqueue(async () => {
      try {
        const res = await fetch('/api/ingest/org-repos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ repo: repo.repo, enabled: on }),
        });
        if (!res.ok) throw new Error(await reason(res, 'Erro ao salvar'));
        const { project }: Toggled = await res.json();
        if (project) {
          toast.success(`projeto criado: ${project}`, {
            action: { label: 'abrir', onClick: () => window.open(`/projects/${project}`, '_blank') },
          });
        }
      } catch (err) {
        toast.error((err as Error).message);
        set(repo, !on);
      }
    });
  };

  if (error) return <p className="px-3 py-2 text-xs text-destructive">{error}</p>;
  if (!repos) return <p className="px-3 py-2 text-xs text-muted-foreground">carregando repos...</p>;
  if (!repos.length) return <p className="px-3 py-2 text-xs text-muted-foreground">nenhum repo visível.</p>;

  return (
    <div className="flex flex-col">
      {repos.length > 8 && (
        <div className="relative border-b border-border p-2">
          <Search className="pointer-events-none absolute top-4 left-4 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder={`filtrar ${repos.length} repos...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-7 text-xs"
          />
        </div>
      )}
      <div className="max-h-80 divide-y divide-border overflow-x-hidden overflow-y-auto">
        {shown.map((r) => (
          <label key={r.repo} className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-muted/30">
            {r.private ? (
              <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-label="privado" />
            ) : (
              <Globe className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-label="público" />
            )}
            <span className="min-w-0 flex-1 truncate font-mono text-sm" title={r.repo}>
              {r.name}
            </span>
            {r.archived && (
              <Badge variant="outline" className="shrink-0">
                arquivado
              </Badge>
            )}
            {r.fork && (
              <Badge variant="outline" className="shrink-0" title="fork: commits entram no ingest, mas não vira projeto">
                fork
              </Badge>
            )}
            <Switch checked={r.enabled} onCheckedChange={(v) => toggle(r, v)} aria-label={`ingerir ${r.repo}`} />
          </label>
        ))}
        {!shown.length && <p className="px-3 py-2 text-xs text-muted-foreground">nenhum resultado.</p>}
      </div>
    </div>
  );
}

export function OrgIngestPanel() {
  const [data, setData] = useState<Overview | null>(null);
  const [input, setInput] = useState('');
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());

  const enqueue = (task: () => Promise<void>) => {
    queue.current = queue.current.then(task);
  };

  useEffect(() => {
    fetch('/api/ingest/orgs')
      .then((res) => res.json())
      .then((d: Overview) => setData(d))
      .catch(() => toast.error('Erro ao carregar organizações'));
  }, []);

  const add = async (org: string) => {
    if (!org.trim()) return;
    setAdding(true);
    const res = await fetch('/api/ingest/orgs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ org: org.trim() }),
    }).finally(() => setAdding(false));

    if (!res.ok) {
      toast.error(await reason(res, 'Erro ao adicionar organização'));
      return;
    }
    const { configured }: { configured: string[] } = await res.json();
    setData((d) => d && { ...d, configured, suggestions: d.suggestions.filter((s) => !configured.some((c) => same(c, s))) });
    setOpen(configured.find((c) => same(c, org.trim())) ?? null);
    setInput('');
  };

  const remove = async (org: string) => {
    const res = await fetch('/api/ingest/orgs', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ org }),
    });
    if (!res.ok) {
      toast.error(await reason(res, 'Erro ao remover organização'));
      return;
    }
    const { configured }: { configured: string[] } = await res.json();
    setData((d) => d && { ...d, configured, suggestions: [...d.suggestions, org].sort((a, b) => a.localeCompare(b)) });
    if (open === org) setOpen(null);
  };

  const track = (repo: string, on: boolean) =>
    setData(
      (d) =>
        d && { ...d, enabled: on ? [...d.enabled.filter((r) => !same(r, repo)), repo] : d.enabled.filter((r) => !same(r, repo)) },
    );

  if (!data) return <p className="px-5 py-4 text-sm text-muted-foreground">carregando organizações...</p>;

  const count = (org: string) => data.enabled.filter((r) => same(r.split('/')[0], org)).length;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-col gap-3 border-b border-border px-5 py-3">
        {data.tokenMissing ? (
          <Setup />
        ) : (
          <>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                add(input);
              }}
            >
              <Input
                placeholder="nome da organização no GitHub..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="h-9"
              />
              <Button type="submit" size="sm" disabled={adding || !input.trim()} className="h-9">
                {adding ? 'adicionando...' : 'adicionar'}
              </Button>
            </form>
            {data.suggestions.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-muted-foreground">suas orgs:</span>
                {data.suggestions.map((s) => (
                  <Button
                    key={s}
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={adding}
                    onClick={() => add(s)}
                    className="h-7 gap-1 px-2 text-xs"
                  >
                    <Plus className="h-3 w-3" />
                    {s}
                  </Button>
                ))}
              </div>
            )}
          </>
        )}
        <p className="text-xs text-muted-foreground">
          repo ligado entra no ingest só com commits seus. <strong className="font-medium text-foreground/80">público</strong>{' '}
          vira projeto na hora; <strong className="font-medium text-foreground/80">privado</strong> é rastreado mas nunca
          mencionado no post. desligar não apaga o projeto.
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {!data.configured.length ? (
          <p className="text-sm text-muted-foreground">nenhuma organização adicionada.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {data.configured.map((org) => (
              <div key={org} className="overflow-hidden rounded-lg border border-border">
                <div className="flex items-center gap-2 px-3 py-2">
                  <button
                    type="button"
                    onClick={() => setOpen((o) => (o === org ? null : org))}
                    disabled={data.tokenMissing}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm font-medium disabled:cursor-not-allowed"
                    aria-expanded={open === org}
                  >
                    <ChevronRight
                      className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open === org ? 'rotate-90' : ''}`}
                    />
                    <span className="truncate">{org}</span>
                    <Badge variant={count(org) ? 'default' : 'outline'} className="shrink-0">
                      {count(org)} {count(org) === 1 ? 'ligado' : 'ligados'}
                    </Badge>
                  </button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => remove(org)}
                    title={`remover ${org}`}
                    aria-label={`remover ${org}`}
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  >
                    <X />
                  </Button>
                </div>
                {open === org && (
                  <div className="border-t border-border">
                    <Repos org={org} enqueue={enqueue} onToggle={track} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

import { useEffect, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Building2, FolderGit2, SlidersHorizontal } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RepoIngestPanel } from '@/components/RepoIngestPanel';
import { OrgIngestPanel } from '@/components/OrgIngestPanel';

type Settings = {
  llm_provider?: string;
  llm_fallback_enabled?: string;
  maintenance_mode?: string;
  hasGroqKey: boolean;
  hasGeminiKey: boolean;
};

type Form = { provider: string; fallback: boolean; maintenance: boolean };

const form = (s: Settings): Form => ({
  provider: s.llm_provider ?? 'groq',
  fallback: (s.llm_fallback_enabled ?? 'true') === 'true',
  maintenance: (s.maintenance_mode ?? 'false') === 'true',
});

async function put(key: string, value: string) {
  const res = await fetch('/api/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, value }),
  });
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({ error: null }));
    throw new Error(error ?? 'Erro ao salvar');
  }
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border p-4">
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-medium">{title}</h3>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function Key({ name, ok }: { name: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md bg-muted/40 px-3 py-2">
      <span className="font-mono text-xs">{name}</span>
      <Badge variant={ok ? 'default' : 'outline'}>{ok ? 'ok' : 'faltando'}</Badge>
    </div>
  );
}

function General() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saved, setSaved] = useState<Form | null>(null);
  const [draft, setDraft] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/settings')
      .then((res) => res.json())
      .then((data: Settings) => {
        setSettings(data);
        setSaved(form(data));
        setDraft(form(data));
      })
      .catch(() => toast.error('Erro ao carregar settings'));
  }, []);

  if (!settings || !draft || !saved) {
    return <p className="px-5 py-4 text-sm text-muted-foreground">carregando...</p>;
  }

  const dirty =
    draft.provider !== saved.provider || draft.fallback !== saved.fallback || draft.maintenance !== saved.maintenance;

  const save = async () => {
    setSaving(true);
    try {
      await Promise.all([
        put('llm_provider', draft.provider),
        put('llm_fallback_enabled', String(draft.fallback)),
        put('maintenance_mode', String(draft.maintenance)),
      ]);
      setSaved(draft);
      toast.success('Salvo.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar');
    }
    setSaving(false);
  };

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
        <Section title="LLM do ingest" hint="normaliza a atividade de GitHub em texto de post.">
          <div className="grid gap-2 sm:grid-cols-2">
            <Key name="GROQ_API_KEY" ok={settings.hasGroqKey} />
            <Key name="GEMINI_API_KEY" ok={settings.hasGeminiKey} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>provider</Label>
            <Select value={draft.provider} onValueChange={(provider) => setDraft({ ...draft, provider })}>
              <SelectTrigger className="w-full sm:w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="groq">groq</SelectItem>
                <SelectItem value="gemini">gemini</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <label className="flex items-start gap-3">
            <Switch checked={draft.fallback} onCheckedChange={(fallback) => setDraft({ ...draft, fallback })} />
            <span className="flex flex-col gap-1">
              <span className="text-sm font-medium">fallback automático Gemini → Groq</span>
              <span className="text-xs text-muted-foreground">
                se o gemini falhar (erro de API, rate limit), tenta de novo via groq. precisa da GROQ_API_KEY.
              </span>
            </span>
          </label>
        </Section>

        <Section title="Site">
          <label className="flex items-start gap-3">
            <Switch checked={draft.maintenance} onCheckedChange={(maintenance) => setDraft({ ...draft, maintenance })} />
            <span className="flex flex-col gap-1">
              <span className="text-sm font-medium">modo manutenção</span>
              <span className="text-xs text-muted-foreground">
                quem não estiver logado como admin vê a tela de manutenção. API e RSS continuam funcionando.
              </span>
            </span>
          </label>
        </Section>
      </div>

      <footer className="flex items-center justify-end gap-3 border-t border-border px-5 py-3">
        {dirty && <span className="text-xs text-muted-foreground">alterações não salvas</span>}
        <Button onClick={save} disabled={saving || !dirty}>
          {saving ? 'salvando...' : 'salvar'}
        </Button>
      </footer>
    </>
  );
}

export function SettingsAdminPanel() {
  return (
    <Tabs defaultValue="general" className="min-h-0 flex-1 gap-0">
      <div className="border-b border-border px-5">
        <TabsList variant="line" className="h-10 w-full justify-start gap-4 overflow-x-auto">
          <TabsTrigger value="general" className="flex-none px-0">
            <SlidersHorizontal />
            geral
          </TabsTrigger>
          <TabsTrigger value="repos" className="flex-none px-0">
            <FolderGit2 />
            repos
          </TabsTrigger>
          <TabsTrigger value="orgs" className="flex-none px-0">
            <Building2 />
            organizações
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="general" className="flex min-h-0 flex-col">
        <General />
      </TabsContent>
      <TabsContent value="repos" className="flex min-h-0 flex-col">
        <RepoIngestPanel />
      </TabsContent>
      <TabsContent value="orgs" className="flex min-h-0 flex-col">
        <OrgIngestPanel />
      </TabsContent>
    </Tabs>
  );
}

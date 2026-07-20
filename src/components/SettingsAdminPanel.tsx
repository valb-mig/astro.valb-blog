import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { RepoIngestPanel } from '@/components/RepoIngestPanel';

type Settings = {
  llm_provider?: string;
  llm_fallback_enabled?: string;
  maintenance_mode?: string;
  hasGroqKey: boolean;
  hasGeminiKey: boolean;
};

export function SettingsAdminPanel() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [provider, setProvider] = useState('groq');
  const [fallbackEnabled, setFallbackEnabled] = useState(true);
  const [maintenanceEnabled, setMaintenanceEnabled] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/settings')
      .then((res) => res.json())
      .then((data: Settings) => {
        setSettings(data);
        setProvider(data.llm_provider ?? 'groq');
        setFallbackEnabled((data.llm_fallback_enabled ?? 'true') === 'true');
        setMaintenanceEnabled((data.maintenance_mode ?? 'false') === 'true');
      });
  }, []);

  const saveSetting = async (key: string, value: string) => {
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value }),
    });
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: null }));
      throw new Error(error ?? 'Erro ao salvar');
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      await Promise.all([
        saveSetting('llm_provider', provider),
        saveSetting('llm_fallback_enabled', String(fallbackEnabled)),
        saveSetting('maintenance_mode', String(maintenanceEnabled)),
      ]);
      toast.success('Salvo.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar');
    }
    setSaving(false);
  };

  if (!settings) return <p className="text-sm text-muted-foreground">carregando...</p>;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 rounded-lg border border-border p-4">
        <p className="text-sm font-medium">API keys do provider de LLM</p>
        <div className="flex items-center gap-2 text-sm">
          <Badge variant={settings.hasGroqKey ? 'default' : 'outline'}>{settings.hasGroqKey ? 'ok' : 'faltando'}</Badge>
          <span className="text-muted-foreground">GROQ_API_KEY</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Badge variant={settings.hasGeminiKey ? 'default' : 'outline'}>
            {settings.hasGeminiKey ? 'ok' : 'faltando'}
          </Badge>
          <span className="text-muted-foreground">GEMINI_API_KEY</span>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>provider de normalização (ingest)</Label>
        <Select value={provider} onValueChange={setProvider}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="groq">groq</SelectItem>
            <SelectItem value="gemini">gemini</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          modelo usado pra normalizar a atividade de GitHub em texto de post no pipeline de ingest.
        </p>
      </div>

      <div className="flex items-start gap-2.5">
        <Switch checked={fallbackEnabled} onCheckedChange={setFallbackEnabled} />
        <div className="flex flex-col gap-1">
          <Label>fallback automático Gemini → Groq</Label>
          <p className="text-xs text-muted-foreground">
            se o provider ativo for gemini e ele falhar (erro de API, rate limit), tenta de novo via groq. só
            funciona com GROQ_API_KEY configurada.
          </p>
        </div>
      </div>

      <div className="flex items-start gap-2.5">
        <Switch checked={maintenanceEnabled} onCheckedChange={setMaintenanceEnabled} />
        <div className="flex flex-col gap-1">
          <Label>modo manutenção</Label>
          <p className="text-xs text-muted-foreground">
            bloqueia as páginas públicas do site (mostra uma tela de manutenção) pra quem não estiver logado como
            admin. API e RSS continuam funcionando.
          </p>
        </div>
      </div>

      <Button onClick={save} disabled={saving} className="w-fit">
        {saving ? 'salvando...' : 'salvar'}
      </Button>

      <Separator />

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">repos no ingest</p>
        <p className="text-xs text-muted-foreground">
          <strong>mencionar</strong>: commits rastreados e incluídos no post. <strong>privado</strong>: espelha repos privados no ingest.
        </p>
        <RepoIngestPanel />
      </div>
    </div>
  );
}

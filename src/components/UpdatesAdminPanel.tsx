import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DeleteButton } from '@/components/DeleteButton';

type Update = {
  id: string;
  message: string;
  source: 'manual' | 'auto';
  kind: string | null;
  ref_url: string | null;
  created_at: string;
};

export function UpdatesAdminPanel() {
  const [updates, setUpdates] = useState<Update[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [refUrl, setRefUrl] = useState('');
  const [saving, setSaving] = useState(false);

  const load = () => {
    fetch('/api/updates')
      .then((res) => res.json())
      .then((data: Update[]) => setUpdates(data))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  useEffect(() => {
    const onRowDeleted = (e: Event) => {
      const { id } = (e as CustomEvent).detail;
      setUpdates((prev) => prev.filter((u) => u.id !== id));
    };
    document.addEventListener('row-deleted', onRowDeleted);
    return () => document.removeEventListener('row-deleted', onRowDeleted);
  }, []);

  const publish = async () => {
    if (!message.trim()) return;
    setSaving(true);
    const res = await fetch('/api/updates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: message.trim(), ref_url: refUrl.trim() || null }),
    });
    if (res.ok) {
      setMessage('');
      setRefUrl('');
      toast.success('Novidade publicada.');
      load();
    } else {
      const { error } = await res.json().catch(() => ({ error: null }));
      toast.error(error ?? 'Erro ao publicar');
    }
    setSaving(false);
  };

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted-foreground">
        novidades exibidas na barra da home e no sino de notificações. auto = disparada por post/projeto/ferramenta
        publicados; manual = criada aqui.
      </p>

      <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="update-message">mensagem *</Label>
          <Textarea
            id="update-message"
            value={message}
            onChange={(e) => setMessage((e.target as HTMLTextAreaElement).value)}
            placeholder="Ex: agora dá pra reagir com emoji nos posts"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="update-ref-url">link (opcional)</Label>
          <Input
            id="update-ref-url"
            value={refUrl}
            onChange={(e) => setRefUrl((e.target as HTMLInputElement).value)}
            placeholder="/posts/algum-slug"
          />
        </div>
        <Button onClick={publish} disabled={saving} className="w-fit">
          {saving ? 'publicando...' : 'publicar novidade'}
        </Button>
      </div>

      {loading && <p className="text-sm text-muted-foreground">carregando...</p>}
      {!loading && updates.length === 0 && <p className="text-sm text-muted-foreground">nenhuma novidade ainda.</p>}
      {updates.length > 0 && (
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
          {updates.map((u) => (
            <li key={u.id} data-id={u.id} className="flex items-start justify-between gap-4 p-4">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant={u.source === 'auto' ? 'secondary' : 'default'}>{u.source}</Badge>
                  {u.kind && <span>{u.kind}</span>}
                  <span>{new Date(u.created_at).toLocaleString('pt-BR')}</span>
                </div>
                <p className="text-sm">{u.message}</p>
                {u.ref_url && (
                  <a href={u.ref_url} className="text-xs text-muted-foreground hover:underline">
                    {u.ref_url}
                  </a>
                )}
              </div>
              <DeleteButton id={u.id} title={u.message} resource="updates" />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

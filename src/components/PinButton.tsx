import { useState } from 'react';
import { toast } from 'sonner';
import { Pin, PinOff } from 'lucide-react';

export function PinButton({ id, pinned }: { id: string; pinned: boolean }) {
  const [on, setOn] = useState(pinned);
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    setBusy(true);
    const res = await fetch('/api/projects/pins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, pinned: !on }),
    }).finally(() => setBusy(false));
    if (!res.ok) {
      toast.error('Erro ao fixar projeto');
      return;
    }
    setOn(!on);
    toast.success(on ? 'Projeto desafixado.' : 'Projeto fixado na home.');
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      title={on ? 'desafixar da home' : 'fixar na home'}
      aria-label={on ? 'desafixar da home' : 'fixar na home'}
      aria-pressed={on}
      className={`flex size-6 items-center justify-center rounded-md transition-colors disabled:opacity-50 ${on ? 'text-amber-400 hover:text-amber-300' : 'text-muted-foreground hover:text-foreground'}`}
    >
      {on ? <PinOff size={12} /> : <Pin size={12} />}
    </button>
  );
}

import { toast } from 'sonner';

const key = 'flash-toast';

type Kind = 'success' | 'error';

export function flash(type: Kind, message: string) {
  sessionStorage.setItem(key, JSON.stringify({ type, message }));
}

export function replay() {
  const raw = sessionStorage.getItem(key);
  if (!raw) return;
  sessionStorage.removeItem(key);
  const { type, message } = JSON.parse(raw) as { type: Kind; message: string };
  toast[type](message);
}

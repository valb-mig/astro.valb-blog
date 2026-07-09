import { toast } from 'sonner';

const FLASH_KEY = 'flash-toast';

type ToastType = 'success' | 'error';

export function flashToast(type: ToastType, message: string) {
  sessionStorage.setItem(FLASH_KEY, JSON.stringify({ type, message }));
}

export function consumeFlashedToast() {
  const raw = sessionStorage.getItem(FLASH_KEY);
  if (!raw) return;
  sessionStorage.removeItem(FLASH_KEY);
  const { type, message } = JSON.parse(raw) as { type: ToastType; message: string };
  toast[type](message);
}

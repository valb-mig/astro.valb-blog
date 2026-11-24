import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Settings } from 'lucide-react';
import { SettingsAdminPanel } from '@/components/SettingsAdminPanel';

export function SettingsDialog() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
        title="Settings"
        aria-label="Settings"
        className="text-muted-foreground hover:text-foreground"
      >
        <Settings />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex h-[85vh] max-h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
          <DialogHeader className="px-5 pt-5 pb-3">
            <DialogTitle>Settings</DialogTitle>
            <DialogDescription>configurações do site e do ingest</DialogDescription>
          </DialogHeader>
          <SettingsAdminPanel />
        </DialogContent>
      </Dialog>
    </>
  );
}

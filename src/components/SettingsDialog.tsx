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
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Settings</DialogTitle>
            <DialogDescription>configurações do site</DialogDescription>
          </DialogHeader>
          <SettingsAdminPanel />
        </DialogContent>
      </Dialog>
    </>
  );
}

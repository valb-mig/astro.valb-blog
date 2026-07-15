import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Megaphone } from 'lucide-react';
import { UpdatesAdminPanel } from '@/components/UpdatesAdminPanel';

export function UpdatesConfigDialog() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
        title="gerenciar novidades"
        aria-label="gerenciar novidades"
        className="text-muted-foreground hover:text-foreground"
      >
        <Megaphone />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Updates</DialogTitle>
            <DialogDescription>gerenciar novidades manuais</DialogDescription>
          </DialogHeader>
          <UpdatesAdminPanel />
        </DialogContent>
      </Dialog>
    </>
  );
}

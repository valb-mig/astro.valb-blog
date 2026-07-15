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
import { StackAdminPanel } from '@/components/StackAdminPanel';

export function StackConfigDialog() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="gap-1.5">
        <Settings size={14} />
        configurar
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Ferramentas — seções e itens</DialogTitle>
            <DialogDescription>
              editado aqui, refletido direto no /about público.
            </DialogDescription>
          </DialogHeader>
          <StackAdminPanel />
        </DialogContent>
      </Dialog>
    </>
  );
}

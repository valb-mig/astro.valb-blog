import { useState } from "react";
import { toast } from "sonner";
import { flashToast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Trash2 } from "lucide-react";

interface Props {
  id: string;
  title: string;
  resource: "posts" | "projects";
  /** Se definido, redireciona após deletar. Caso contrário, dispara "row-deleted" no document. */
  redirectTo?: string;
  label?: string;
}

export function DeleteButton({ id, title, resource, redirectTo, label = "deletar" }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  const handleDelete = async () => {
    setPending(true);
    const res = await fetch(`/api/${resource}/${id}`, { method: "DELETE" });
    if (res.ok) {
      if (redirectTo) {
        flashToast("success", `"${title}" deletado.`);
        window.location.href = redirectTo;
      } else {
        toast.success(`"${title}" deletado.`);
        document.dispatchEvent(new CustomEvent("row-deleted", { detail: { id } }));
        setOpen(false);
      }
    } else {
      setPending(false);
      toast.error("Erro ao deletar.");
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive">
          <Trash2 />
          {label}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Deletar "{title}"?</AlertDialogTitle>
          <AlertDialogDescription>Essa ação não pode ser desfeita.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction variant="destructive" disabled={pending} onClick={handleDelete}>
            {pending ? "Deletando..." : "Deletar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { deleteTemplate } from "@/lib/training/actions";

export function TemplateDelete({ id }: { id: string }) {
  const router = useRouter();
  return <ConfirmButton label={<><Trash2 />Supprimer</>} confirmLabel="Supprimer le modèle" onConfirm={async () => { await deleteTemplate(id); router.refresh(); }} />;
}

"use client";
import { Trash2 } from "lucide-react";
import { deleteStaff } from "@/app/(app)/staff/actions";
import { ConfirmButton } from "@/components/ui/confirm-button";

export function DeleteStaff({ id }: { id: string }) {
  return <ConfirmButton onConfirm={() => deleteStaff(id)} label={<Trash2 aria-label="Supprimer" />} confirmLabel="Supprimer" />;
}

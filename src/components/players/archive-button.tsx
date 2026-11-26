"use client";

import { archivePlayer } from "@/app/(app)/effectif/actions";
import { ConfirmButton } from "@/components/ui/confirm-button";

export function ArchiveButton({ id, archived }: { id: string; archived: boolean }) {
  return (
    <ConfirmButton
      onConfirm={() => archivePlayer(id, !archived)}
      label={archived ? "Réactiver la fiche" : "Archiver la fiche"}
      confirmLabel={archived ? "Confirmer la réactivation" : "Confirmer l'archivage"}
      variant={archived ? "secondary" : "destructive"}
      size="default"
    />
  );
}

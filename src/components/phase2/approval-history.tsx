import { History } from "lucide-react";
import { WORKFLOW_LABELS, LINEUP_STATUS_LABELS } from "@/lib/phase2/labels";
import { formatDateTime } from "@/lib/utils";

export function ApprovalHistory({ items, lineup = false }: { items: { id: number; from_status: string | null; to_status: string; created_at: string; actor: string }[]; lineup?: boolean }) {
  const L = lineup ? LINEUP_STATUS_LABELS : WORKFLOW_LABELS;
  if (!items.length) return null;
  return (
    <details className="rounded-lg border bg-card p-3 text-sm">
      <summary className="flex cursor-pointer items-center gap-2 font-semibold"><History className="size-4" aria-hidden />Historique des validations ({items.length})</summary>
      <ul className="mt-2 flex flex-col gap-1 text-xs text-muted-foreground">
        {items.map((h) => (
          <li key={h.id}>
            {formatDateTime(h.created_at)} — {h.actor} : {h.from_status ? `${L[h.from_status] ?? h.from_status} → ` : "création en "}
            <strong className="text-foreground">{L[h.to_status] ?? h.to_status}</strong>
          </li>
        ))}
      </ul>
    </details>
  );
}

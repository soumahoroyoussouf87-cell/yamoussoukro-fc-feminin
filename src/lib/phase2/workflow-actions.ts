"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { dbError } from "@/lib/phase2/forms";

const TABLES = ["microcycles", "training_sessions", "match_squads", "delegations"] as const;
type WorkflowTable = (typeof TABLES)[number];
const STATUSES = ["brouillon", "soumis", "valide", "publie", "archive"] as const;

/**
 * Changement de statut générique. Les droits (valider, publier, archiver,
 * modifier un élément validé) sont appliqués par la base : trigger
 * app.guard_workflow + RLS. L'historique est écrit par app.track_status.
 */
export async function setWorkflowStatus(table: WorkflowTable, id: string, path: string, to: string) {
  await requireStaff();
  if (!TABLES.includes(table) || !(STATUSES as readonly string[]).includes(to) || !path.startsWith("/")) return { error: "Action invalide." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from(table)
    .update({ status: to as (typeof STATUSES)[number] })
    .eq("id", id)
    .select("id");
  if (error || !data?.length) return { error: dbError(error, "Changement de statut refusé pour votre rôle.") };
  revalidatePath(path);
  return {};
}

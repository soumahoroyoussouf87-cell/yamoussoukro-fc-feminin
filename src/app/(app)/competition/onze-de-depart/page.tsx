import { requirePermission } from "@/lib/auth";
import { ModuleIndex } from "../module-index";

export const metadata = { title: "Onze de départ" };

export default async function Page() {
  const ctx = await requirePermission("matches.read");
  return <ModuleIndex ctx={ctx} module="onze" />;
}

import { requirePermission } from "@/lib/auth";
import { ModuleIndex } from "../module-index";

export const metadata = { title: "Délégations" };

export default async function Page() {
  const ctx = await requirePermission("matches.read");
  return <ModuleIndex ctx={ctx} module="delegation" />;
}

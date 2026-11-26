import { requireStaff } from "@/lib/auth";
import { getClubHeader } from "@/lib/club";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";
import { ClubLogo } from "@/components/shell/club-logo";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const ctx = await requireStaff();
  const club = await getClubHeader(ctx);
  const supabase = await createClient();
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", ctx.userId)
    .is("read_at", null);

  const brand = (
    <div className="flex items-center gap-3">
      <ClubLogo src={club.logoUrl ?? undefined} size={44} />
      <div className="leading-tight">
        <p className="font-display text-base font-bold uppercase tracking-wide text-white">{club.name}</p>
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-fuchsia">Centre de Haute Performance</p>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen">
      <Sidebar permissions={[...ctx.permissions]} brand={brand} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar ctx={ctx} club={club} unread={count ?? 0} />
        <main id="contenu" className="mx-auto w-full max-w-[1600px] flex-1 p-4 sm:p-6">{children}</main>
        <footer className="border-t px-6 py-3 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          Observer • Évaluer • Planifier • Développer • Performer
        </footer>
      </div>
    </div>
  );
}

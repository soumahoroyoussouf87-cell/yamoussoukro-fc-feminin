import Link from "next/link";
import { Bell } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDateTime } from "@/lib/utils";
import { markAllRead } from "./actions";

export const metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const ctx = await requireStaff();
  const supabase = await createClient();
  const { data } = await supabase.from("notifications").select("*").eq("user_id", ctx.userId).order("created_at", { ascending: false }).limit(100);
  const unread = (data ?? []).some((n) => !n.read_at);
  return (
    <>
      <PageHeader
        eyebrow="Pilotage"
        title="Notifications"
        description="Les notifications automatiques (séances, convocations, vidéos, évaluations…) s'activent avec les modules des phases 2 à 4."
        actions={unread ? <form action={markAllRead}><Button type="submit" variant="outline">Tout marquer comme lu</Button></form> : null}
      />
      <Card className="p-4">
        {!data?.length ? <EmptyState icon={Bell} title="Aucune notification" /> : (
          <ul className="divide-y">
            {data.map((n) => (
              <li key={n.id} className={`flex gap-3 py-3 ${n.read_at ? "opacity-70" : ""}`}>
                {!n.read_at ? <span className="mt-1.5 size-2 rounded-full bg-primary" aria-label="Non lue" /> : <span className="size-2" />}
                <div className="flex-1">
                  <p className="font-semibold">{n.link ? <Link href={n.link} className="hover:text-primary-text">{n.title}</Link> : n.title}</p>
                  {n.body ? <p className="text-sm text-muted-foreground">{n.body}</p> : null}
                  <p className="text-xs text-muted-foreground">{formatDateTime(n.created_at)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

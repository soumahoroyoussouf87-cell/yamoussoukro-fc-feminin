import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { signOut } from "@/app/(app)/actions";

export function StatusPage({ title, children, back = true }: { title: string; children: React.ReactNode; back?: boolean }) {
  return (
    <AuthShell title={title}>
      <div className="flex flex-col gap-4 text-sm text-white/80">{children}</div>
      <div className="mt-6 flex items-center justify-between text-xs">
        {back ? <Link href="/tableau-de-bord" className="underline-offset-4 hover:underline">Retour au tableau de bord</Link> : <span />}
        <form action={signOut}><button className="underline-offset-4 hover:underline" type="submit">Se déconnecter</button></form>
      </div>
    </AuthShell>
  );
}

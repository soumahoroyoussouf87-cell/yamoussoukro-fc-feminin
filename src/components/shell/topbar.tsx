import Link from "next/link";
import { Bell, LogOut, Search } from "lucide-react";
import { signOut } from "@/app/(app)/actions";
import { ThemeToggle } from "./theme-toggle";
import type { AccessContext } from "@/lib/auth";
import type { ClubHeader } from "@/lib/club";

export function Topbar({ ctx, club, unread }: { ctx: AccessContext; club: ClubHeader; unread: number }) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/85 pl-16 pr-4 backdrop-blur lg:pl-6">
      <form action="/recherche" className="relative hidden max-w-md flex-1 md:block" role="search">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <label htmlFor="global-search" className="sr-only">Recherche globale</label>
        <input
          id="global-search"
          name="q"
          placeholder="Rechercher une joueuse, un membre du staff…"
          className="h-10 w-full rounded-md border border-input bg-card pl-9 pr-3 text-sm placeholder:text-muted-foreground"
          minLength={2}
        />
      </form>
      <div className="ml-auto flex items-center gap-2">
        <div className="hidden text-right text-xs leading-tight xl:block">
          <p className="font-semibold">{club.season ? `Saison ${club.season.label}` : "Aucune saison active"}</p>
          <p className="text-muted-foreground">{club.competition?.name ?? "Aucune compétition active"}</p>
        </div>
        <Link href="/recherche" className="inline-flex size-10 items-center justify-center rounded-md border border-input hover:bg-accent md:hidden" aria-label="Recherche">
          <Search className="size-4" />
        </Link>
        <Link
          href="/notifications"
          className="relative inline-flex size-10 items-center justify-center rounded-md border border-input hover:bg-accent"
          aria-label={`Notifications${unread ? ` (${unread} non lues)` : ""}`}
        >
          <Bell className="size-4" />
          {unread > 0 && (
            <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-primary px-1 text-center text-[10px] font-bold leading-5 text-white">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Link>
        <ThemeToggle initial={ctx.theme} />
        <Link href="/mon-compte" className="hidden items-center gap-2 rounded-md px-2 py-1 hover:bg-accent sm:flex">
          <span className="flex size-8 items-center justify-center rounded-full bg-secondary text-xs font-bold text-white">
            {ctx.fullName.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
          </span>
          <span className="text-left text-xs leading-tight">
            <span className="block max-w-36 truncate font-semibold">{ctx.fullName}</span>
            <span className="block max-w-36 truncate text-muted-foreground">{ctx.roles.map((r) => r.roleLabel).join(", ")}</span>
          </span>
        </Link>
        <form action={signOut}>
          <button type="submit" className="inline-flex size-10 items-center justify-center rounded-md border border-input hover:bg-accent" aria-label="Se déconnecter">
            <LogOut className="size-4" />
          </button>
        </form>
      </div>
    </header>
  );
}

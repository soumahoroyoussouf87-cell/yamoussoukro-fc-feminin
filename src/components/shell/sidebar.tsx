"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ChevronDown, Menu, X } from "lucide-react";
import { NAVIGATION } from "@/lib/navigation";
import { cn } from "@/lib/utils";

export function Sidebar({ permissions, brand }: { permissions: string[]; brand: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const allowed = new Set(permissions);

  const nav = (
    <nav aria-label="Navigation principale" className="flex flex-col gap-4 px-3 pb-8">
      {NAVIGATION.map((section) => {
        const items = section.items.filter((i) => !i.href || !i.permission || allowed.has(i.permission));
        if (!items.length) return null;
        const isCollapsed = collapsed[section.title] ?? !items.some((i) => i.href);
        return (
          <div key={section.title}>
            <button
              type="button"
              onClick={() => setCollapsed((c) => ({ ...c, [section.title]: !isCollapsed }))}
              className="flex w-full items-center justify-between px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-sidebar-muted hover:text-white"
              aria-expanded={!isCollapsed}
            >
              {section.title}
              <ChevronDown className={cn("size-3.5 transition-transform", isCollapsed && "-rotate-90")} aria-hidden />
            </button>
            {!isCollapsed && (
              <ul className="mt-1 flex flex-col gap-0.5">
                {items.map((item) => {
                  const Icon = item.icon;
                  if (!item.href) {
                    return (
                      <li key={item.label}>
                        <span
                          aria-disabled="true"
                          title={`Module prévu en Phase ${item.phase} — non disponible`}
                          className="flex cursor-not-allowed items-center gap-3 rounded-md px-2 py-1.5 text-sm text-sidebar-muted/70"
                        >
                          <Icon className="size-4 shrink-0 opacity-60" aria-hidden />
                          <span className="flex-1 truncate">{item.label}</span>
                          <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] font-semibold">P{item.phase}</span>
                        </span>
                      </li>
                    );
                  }
                  const base = item.href.split("#")[0];
                  const active = pathname === base || (base !== "/" && pathname.startsWith(`${base}/`));
                  return (
                    <li key={item.label}>
                      <Link
                        href={item.href}
                        onClick={() => setOpen(false)}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex items-center gap-3 rounded-md px-2 py-1.5 text-sm text-sidebar-foreground transition-colors hover:bg-white/5",
                          active && "bg-sidebar-active font-semibold text-white shadow-[inset_3px_0_0_var(--yfc-fuchsia)]",
                        )}
                      >
                        <Icon className={cn("size-4 shrink-0", active ? "text-fuchsia" : "opacity-80")} aria-hidden />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
      <p className="px-2 text-[11px] leading-relaxed text-sidebar-muted/80">
        Les entrées grisées « P2 » à « P7 » sont des modules prévus dans la roadmap. Elles ne sont pas encore disponibles.
      </p>
    </nav>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed left-3 top-3 z-40 inline-flex size-10 items-center justify-center rounded-md bg-night text-white lg:hidden"
        aria-label="Ouvrir le menu"
      >
        <Menu className="size-5" />
      </button>
      {open && <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={() => setOpen(false)} aria-hidden />}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-sidebar text-sidebar-foreground transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-start justify-between gap-2 border-b border-white/10 p-4">
          {brand}
          <button type="button" onClick={() => setOpen(false)} className="lg:hidden" aria-label="Fermer le menu">
            <X className="size-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto pt-4">{nav}</div>
      </aside>
    </>
  );
}

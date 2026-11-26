"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/** Onglets de navigation secondaires (liens). */
export function SubNav({ items }: { items: { href: string; label: string; exact?: boolean }[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Sections" className="mb-5 flex gap-1 overflow-x-auto border-b">
      {items.map((i) => {
        const base = i.href.split("?")[0];
        const active = i.exact ? pathname === base : pathname === base || pathname.startsWith(`${base}/`);
        return (
          <Link
            key={i.href}
            href={i.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground",
              active ? "border-fuchsia text-foreground" : "border-transparent",
            )}
          >
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}

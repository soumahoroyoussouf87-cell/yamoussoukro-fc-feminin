import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Period } from "@/lib/performance/data";

export function PeriodPicker({ periods, current, base }: { periods: Period[]; current: string; base: string }) {
  return (
    <nav aria-label="Période" className="mb-4 flex flex-wrap gap-2">
      {periods.map((p) => (
        <Link key={p.key} href={`${base}?periode=${p.key}`} aria-current={p.key === current ? "true" : undefined}
          className={cn("rounded-full border px-3 py-1 text-xs font-semibold", p.key === current ? "border-fuchsia bg-fuchsia/10" : "text-muted-foreground hover:bg-muted")}>
          {p.label}
        </Link>
      ))}
    </nav>
  );
}

export function pickPeriod(periods: Period[], key: string | string[] | undefined) {
  const k = Array.isArray(key) ? key[0] : key;
  return periods.find((p) => p.key === k) ?? periods[0];
}

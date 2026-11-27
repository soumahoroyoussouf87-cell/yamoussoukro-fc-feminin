import { Badge } from "@/components/ui/badge";
import { RELIABILITY_LABELS, type Reliability } from "@/lib/performance/engine";

export function ReliabilityBadge({ value }: { value: Reliability }) {
  const variant = value === "elevee" ? "success" : value === "moyenne" ? "default" : value === "faible" ? "warning" : "outline";
  return <Badge variant={variant}>{RELIABILITY_LABELS[value]}</Badge>;
}

export const fmtIndex = (n: number | null) => (n == null ? "—" : String(n).replace(".", ","));

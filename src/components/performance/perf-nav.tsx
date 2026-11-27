import { SubNav } from "@/components/phase2/sub-nav";

export function PerfNav() {
  return (
    <SubNav
      items={[
        { href: "/performance/individuelle", label: "Performance individuelle" },
        { href: "/performance/evaluations", label: "Évaluations" },
        { href: "/performance/tests", label: "Tests techniques" },
        { href: "/performance/referentiels", label: "Référentiels" },
      ]}
    />
  );
}

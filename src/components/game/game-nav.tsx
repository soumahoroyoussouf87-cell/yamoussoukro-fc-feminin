import { SubNav } from "@/components/phase2/sub-nav";

export function GameNav() {
  return (
    <SubNav
      items={[
        { href: "/projet-de-jeu", label: "Projet de jeu" },
        { href: "/projet-de-jeu/systemes", label: "Systèmes et animations" },
        { href: "/performance/collective", label: "Performance collective" },
      ]}
    />
  );
}

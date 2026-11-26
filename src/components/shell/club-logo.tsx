import { cn } from "@/lib/utils";

/**
 * Emplacement du logo officiel. Le logo est affiché tel quel (object-contain,
 * sans recadrage ni filtre) pour respecter ses proportions et ses couleurs.
 * Tant qu'aucun fichier officiel n'est déposé, un emplacement neutre est affiché :
 * aucun logo de substitution n'est dessiné.
 */
export const OFFICIAL_LOGO = "/brand/logo-officiel-yfc.png";

export function ClubLogo({ src = OFFICIAL_LOGO, size = 44, className }: { src?: string | null; size?: number; className?: string }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="Logo officiel du club" width={size} height={size} className={cn("object-contain", className)} style={{ width: size, height: size }} />;
  }
  return (
    <div
      role="img"
      aria-label="Logo officiel non encore fourni"
      title="Logo officiel à déposer dans Administration › Paramètres"
      className={cn("flex shrink-0 items-center justify-center rounded-md border border-dashed border-white/30 text-center text-[8px] font-semibold uppercase leading-tight text-white/60", className)}
      style={{ width: size, height: size }}
    >
      Logo
      <br />
      officiel
    </div>
  );
}

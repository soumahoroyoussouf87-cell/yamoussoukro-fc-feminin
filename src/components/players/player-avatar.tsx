import { cn, initials } from "@/lib/utils";

export function PlayerAvatar({ src, first, last, size = 40, className }: { src?: string | null; first?: string | null; last?: string | null; size?: number; className?: string }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" width={size} height={size} loading="lazy" className={cn("shrink-0 rounded-full object-cover", className)} style={{ width: size, height: size }} />
  ) : (
    <span
      aria-hidden
      className={cn("flex shrink-0 items-center justify-center rounded-full bg-secondary font-display font-bold text-white", className)}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials(first, last)}
    </span>
  );
}

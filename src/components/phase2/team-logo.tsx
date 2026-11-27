import { cn } from "@/lib/utils";

/** Logos des adversaires : fichiers statiques sous /public/adversaires (chemin commençant par « / »). */
export function logoSrc(path: string | null | undefined) {
  return path && path.startsWith("/") ? path : null;
}

const initials = (name: string) =>
  name.split(/[\s'’-]+/).filter((w) => w.length > 1 && !/^(fc|club|de|d)$/i.test(w)).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || name.slice(0, 2).toUpperCase();

export function TeamLogo({ name, path, size = 28, className }: { name: string; path?: string | null; size?: number; className?: string }) {
  const src = logoSrc(path);
  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-white align-middle ring-1 ring-black/10", className)}
      style={{ width: size, height: size }}
      title={name}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={`Logo ${name}`} width={size} height={size} className="h-[86%] w-[86%] object-contain" />
      ) : (
        <span className="text-[0.6rem] font-bold text-slate-700">{initials(name)}</span>
      )}
    </span>
  );
}

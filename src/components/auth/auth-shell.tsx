import { ClubLogo } from "@/components/shell/club-logo";

export function AuthShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="hero-gradient flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-night/80 p-8 text-white shadow-2xl backdrop-blur">
        <div className="mb-8 flex items-center gap-4">
          <ClubLogo size={56} />
          <div className="leading-tight">
            <p className="font-display text-2xl font-bold uppercase">Yamoussoukro FC Féminin</p>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-fuchsia">Centre de Haute Performance</p>
          </div>
        </div>
        <h1 className="mb-6 font-display text-xl font-semibold uppercase tracking-wide">{title}</h1>
        {children}
        <p className="mt-8 text-center text-[10px] uppercase tracking-[0.2em] text-white/50">
          Observer • Évaluer • Planifier • Développer • Performer
        </p>
      </div>
    </div>
  );
}

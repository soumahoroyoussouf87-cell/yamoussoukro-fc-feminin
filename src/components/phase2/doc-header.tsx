/* eslint-disable @next/next/no-img-element */
/** En-tête institutionnel des documents officiels (logo officiel non retouché). */
export function DocHeader({ title, subtitle, reference }: { title: string; subtitle?: string; reference?: string }) {
  return (
    <header className="mb-5 flex items-center gap-4 border-b-4 border-[#ff0068] pb-3">
      <img src="/brand/logo-officiel-yfc.png" alt="Logo officiel du Yamoussoukro FC Féminin" className="h-20 w-auto" />
      <div className="flex-1">
        <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#d1005a]">Yamoussoukro FC Féminin · Centre de Haute Performance</p>
        <h1 className="font-display text-3xl font-extrabold uppercase leading-tight text-[#07162E]">{title}</h1>
        {subtitle ? <p className="text-sm font-semibold text-[#334]">{subtitle}</p> : null}
      </div>
      {reference ? <p className="self-start text-right text-[10px] text-[#667]">{reference}</p> : null}
    </header>
  );
}

export function DocFooter({ note }: { note?: string }) {
  return (
    <footer className="mt-8 border-t pt-2 text-center text-[9px] text-[#667]">
      {note ?? "Document interne — Yamoussoukro FC Féminin."} Édité le {new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short", timeZone: "Africa/Abidjan" }).format(new Date())}.
    </footer>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useMemo, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/phase2/notice";
import { dayLong, hm, WORKFLOW_LABELS, workflowVariant } from "@/lib/phase2/labels";
import { progress, sheetChecks, STEPS } from "@/lib/training/completeness";
import { saveSessionPatch } from "@/lib/training/actions";
import { cn } from "@/lib/utils";
import type { StepProps } from "./types";
import { StepInfos } from "./step-infos";
import { StepThemes } from "./step-themes";
import { StepBuild } from "./step-build";
import { StepExercises } from "./step-exercises";
import { StepSquad } from "./step-squad";
import { StepLoad } from "./step-load";
import { StepEvaluation } from "./step-evaluation";
import { StepValidate } from "./step-validate";

type Props = Omit<StepProps, "refresh"> & { step: number; notice: string | null };

export function SessionWizard({ step, notice, ...rest }: Props) {
  const router = useRouter();
  const path = usePathname();
  const [, start] = useTransition();
  const refresh = () => start(() => router.refresh());
  const { data, perms, today } = rest;
  const s = data.session;
  const checks = useMemo(() => sheetChecks(data, today), [data, today]);
  const prog = progress(checks);

  // Mémorise l'étape en cours pour reprendre la fiche au même endroit.
  useEffect(() => {
    if (perms.editable && step !== s.wizard_step) void saveSessionPatch(s.id, { wizard_step: step });
  }, [step, perms.editable, s.id, s.wizard_step]);

  const props: StepProps = { ...rest, refresh };
  const href = (n: number) => `${path}?etape=${n}`;
  const stepOk = (n: number) => checks.filter((c) => c.step === n).every((c) => c.ok || !c.required) && checks.some((c) => c.step === n && c.ok);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-text">
              Séance n°{s.number} · <span className="capitalize">{dayLong(s.session_date)}</span>
              {s.starts_at ? ` · ${hm(s.starts_at)}${s.ends_at ? `–${hm(s.ends_at)}` : ""}` : ""}
              {s.match_ref ? ` · ${s.match_ref}` : ""}
            </p>
            <h1 className="font-display text-2xl font-extrabold uppercase leading-tight sm:text-3xl">{s.theme ?? "Séance sans thème"}</h1>
            {s.sub_theme ? <p className="text-sm text-muted-foreground">{s.sub_theme}</p> : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={workflowVariant(s.status)}>{WORKFLOW_LABELS[s.status]}</Badge>
            {!perms.editable ? <Badge variant="outline"><Lock className="size-3" aria-hidden />Lecture seule</Badge> : null}
            <Button asChild variant="outline" size="sm"><Link href="/entrainement/seances">Toutes les séances</Link></Button>
          </div>
        </div>
        <div>
          <div className="mb-1 flex justify-between text-xs text-muted-foreground">
            <span>Fiche complétée à {prog.pct} %</span>
            <span>{prog.done}/{prog.total} points</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={prog.pct} aria-valuemin={0} aria-valuemax={100} aria-label="Progression de la fiche">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${prog.pct}%` }} />
          </div>
        </div>
        <nav aria-label="Étapes de la fiche" className="-mx-1 overflow-x-auto">
          <ol className="flex min-w-max gap-1 px-1">
            {STEPS.map((t) => (
              <li key={t.n}>
                <Link
                  href={href(t.n)}
                  scroll={false}
                  aria-current={t.n === step ? "step" : undefined}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-semibold transition-colors",
                    t.n === step ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent",
                  )}
                >
                  <span className={cn("grid size-5 place-items-center rounded-full text-[10px]", t.n === step ? "bg-white/25" : stepOk(t.n) ? "bg-success/20 text-success" : "bg-muted")}>
                    {stepOk(t.n) && t.n !== step ? <Check className="size-3" aria-label="complète" /> : t.n}
                  </span>
                  <span className="hidden sm:inline">{t.short}</span>
                </Link>
              </li>
            ))}
          </ol>
        </nav>
      </header>

      {notice ? <Notice>{notice}</Notice> : null}

      <section aria-labelledby="step-title" className="flex flex-col gap-4">
        <h2 id="step-title" className="font-display text-xl font-bold uppercase">
          <span className="text-primary-text">{step}.</span> {STEPS[step - 1].label}
        </h2>
        {step === 1 ? <StepInfos {...props} /> : null}
        {step === 2 ? <StepThemes {...props} /> : null}
        {step === 3 ? <StepBuild {...props} /> : null}
        {step === 4 ? <StepExercises {...props} /> : null}
        {step === 5 ? <StepSquad {...props} /> : null}
        {step === 6 ? <StepLoad {...props} /> : null}
        {step === 7 ? <StepEvaluation {...props} /> : null}
        {step === 8 ? <StepValidate {...props} checks={checks} /> : null}
      </section>

      <div className="flex items-center justify-between gap-2 border-t pt-3">
        {step > 1 ? <Button asChild variant="outline"><Link href={href(step - 1)} scroll={false}><ArrowLeft />Précédent</Link></Button> : <span />}
        {step < 8 ? <Button asChild><Link href={href(step + 1)} scroll={false}>Suivant : {STEPS[step].short}<ArrowRight /></Link></Button> : null}
      </div>
    </div>
  );
}

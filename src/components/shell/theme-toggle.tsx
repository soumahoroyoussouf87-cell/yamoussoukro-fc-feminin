"use client";

import { Moon, Sun } from "lucide-react";
import { useTransition } from "react";
import { saveThemePreference } from "@/app/(app)/actions";

export function ThemeToggle({ initial }: { initial: "dark" | "light" }) {
  const [, startTransition] = useTransition();
  function toggle() {
    const root = document.documentElement;
    const next = root.classList.contains("dark") ? "light" : "dark";
    root.classList.toggle("dark", next === "dark");
    document.cookie = `yfc-theme=${next}; path=/; max-age=31536000; samesite=lax`;
    startTransition(() => saveThemePreference(next));
  }
  return (
    <button
      type="button"
      onClick={toggle}
      className="inline-flex size-10 items-center justify-center rounded-md border border-input hover:bg-accent"
      aria-label="Basculer entre mode sombre et mode clair"
      data-initial={initial}
    >
      <Sun className="hidden size-4 dark:block" aria-hidden />
      <Moon className="size-4 dark:hidden" aria-hidden />
    </button>
  );
}

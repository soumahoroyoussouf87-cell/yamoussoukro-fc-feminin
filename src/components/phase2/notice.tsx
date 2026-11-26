export function Notice({ children, tone = "success" }: { children: React.ReactNode; tone?: "success" | "warning" | "danger" | "info" }) {
  const cls =
    tone === "success" ? "bg-success/10 text-success" : tone === "warning" ? "bg-warning/10 text-warning" : tone === "danger" ? "bg-danger/10 text-danger" : "bg-accent text-accent-foreground";
  return <p role="status" className={`mb-4 rounded-md px-4 py-3 text-sm font-medium ${cls}`}>{children}</p>;
}

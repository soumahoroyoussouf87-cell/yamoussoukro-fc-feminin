import { requireStaff } from "@/lib/auth";

export const metadata = { robots: { index: false } };

export default async function PrintLayout({ children }: LayoutProps<"/impression">) {
  await requireStaff();
  return <div className="min-h-screen bg-[#4b5468] pb-10 print:bg-white print:pb-0">{children}</div>;
}

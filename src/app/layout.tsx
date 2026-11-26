import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Inter } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";
import { ServiceWorkerRegister } from "@/components/shell/sw-register";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });
const barlow = Barlow_Condensed({
  variable: "--font-barlow",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "YFC Féminin — Centre de Haute Performance", template: "%s · YFC Féminin" },
  description: "Plateforme interne de management et de développement de la performance — Yamoussoukro FC Féminin.",
  applicationName: "YFC Féminin — Centre de Haute Performance",
  robots: { index: false, follow: false },
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: "#07162E",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Mode sombre par défaut ; le choix de l'utilisateur est mémorisé (cookie + profil).
  const theme = (await cookies()).get("yfc-theme")?.value === "light" ? "light" : "dark";
  return (
    <html lang="fr" className={`${inter.variable} ${barlow.variable} ${theme === "dark" ? "dark" : ""} h-full`}>
      <body className="min-h-full">
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}

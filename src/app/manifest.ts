import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "YFC Féminin — High Performance Center",
    short_name: "YFC HPC",
    description: "Plateforme interne de management de la performance — Yamoussoukro FC Féminin",
    start_url: "/tableau-de-bord",
    display: "standalone",
    background_color: "#07162E",
    theme_color: "#07162E",
    lang: "fr",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

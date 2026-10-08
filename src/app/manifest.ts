import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "JM Poissonnerie",
    short_name: "JM Poissonnerie",
    description: "Poisson frais, carpes, poulet, rognons, tripes et livraison.",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0a1a52",
    theme_color: "#0a1a52",
    lang: "fr",
    categories: ["shopping", "food"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Produits", url: "/produits", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Mon panier", url: "/panier", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Mes commandes", url: "/mon-espace/commandes", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}

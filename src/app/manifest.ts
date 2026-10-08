import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "JM Poissonnerie",
    short_name: "JM Poissonnerie",
    description: "Poisson frais, carpes, poulet, rognons, tripes et livraison.",
    start_url: "/",
    display: "standalone",
    background_color: "#0a1a52",
    theme_color: "#0a1a52",
    lang: "fr",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}

import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Tareekh",
    short_name: "Tareekh",
    description: "Practice memory for a litigator: every hearing, note and order, searchable in seconds.",
    start_url: "/",
    display: "standalone",
    background_color: "#f3f4f1",
    theme_color: "#141414",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

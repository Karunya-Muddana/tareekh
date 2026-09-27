import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Tareekh",
    short_name: "Tareekh",
    description: "Practice memory for a litigator: every hearing, note and order, searchable in seconds.",
    start_url: "/",
    display: "standalone",
    background_color: "#fbfbf9",
    theme_color: "#1f3c86",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

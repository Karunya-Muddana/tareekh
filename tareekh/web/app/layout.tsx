import type { Metadata, Viewport } from "next";
import { Anek_Latin, Eczar, Martian_Mono } from "next/font/google";
import localFont from "next/font/local";
import { TooltipProvider } from "@/components/ui/tooltip";
import { themeScript } from "@/lib/theme-script";
import "./globals.css";

// Type from Indian foundries: Anek Latin (Ek Type, Mumbai) for the interface, Eczar (Rosetta) for headings,
// Martian Mono for small data labels. Samarkan is the wordmark only.
const anek = Anek_Latin({ variable: "--font-anek", subsets: ["latin"], axes: ["wdth"] });
const martian = Martian_Mono({ variable: "--font-martian", subsets: ["latin"], preload: false });
// Samarkan (Titivillus Foundry): the Indic-style display face, used for the wordmark, Today's weekday and sign-in only.
const samarkan = localFont({ src: "./fonts/samarkan.woff2", variable: "--font-samarkan", display: "block" });
const eczar = Eczar({ variable: "--font-eczar", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Tareekh",
  description: "Practice memory for a litigator: every hearing, note and order, searchable in seconds.",
  appleWebApp: { capable: true, title: "Tareekh", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3f4f1" },
    { media: "(prefers-color-scheme: dark)", color: "#0f0f0e" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-IN" suppressHydrationWarning>
      <head>
        {/* Blocking on purpose: picks light/dark before first paint, so there is no flash. */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${anek.variable} ${martian.variable} ${eczar.variable} ${samarkan.variable} font-sans antialiased`}>
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}

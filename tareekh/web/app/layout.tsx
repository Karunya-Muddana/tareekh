import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const serif = Instrument_Serif({ variable: "--font-instrument-serif", subsets: ["latin"], weight: "400" });

export const metadata: Metadata = {
  title: "Tareekh",
  description: "Practice memory for a litigator: every hearing, note and order, searchable in seconds.",
  manifest: "/backend/manifest.webmanifest",
  icons: { icon: "/backend/icon.svg", apple: "/backend/icon.svg" },
  appleWebApp: { capable: true, title: "Tareekh", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfbf9" },
    { media: "(prefers-color-scheme: dark)", color: "#111814" },
  ],
};

// Follow the system theme before first paint (no flash), and keep following it.
const themeScript = `(()=>{const m=matchMedia('(prefers-color-scheme: dark)');const s=()=>document.documentElement.classList.toggle('dark',m.matches);s();m.addEventListener('change',s)})()`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${geist.variable} ${geistMono.variable} ${serif.variable} font-sans antialiased`}>
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}

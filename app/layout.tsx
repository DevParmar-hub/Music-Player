import type { Metadata } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";

import { AppShell } from "@/components/shell/AppShell";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Display face for large titles and Now Playing: a warm serif that
// suits the vintage record-player story.
const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "Music Player",
  description: "Your local music library",
};

// Runs before first paint so the saved theme never flashes the wrong
// one. Mirrors resolveTheme() in lib/stores/settings.ts.
const themeScript = `(() => {
  let theme = 'system';
  try { theme = localStorage.getItem('theme') || 'system'; } catch {}
  if (theme === 'system') {
    theme = matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  document.documentElement.dataset.theme = theme;
})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-theme="dark"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}

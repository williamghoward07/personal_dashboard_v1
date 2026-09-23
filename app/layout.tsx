import type { Metadata } from "next";
import { Bricolage_Grotesque, Instrument_Sans, IBM_Plex_Mono } from "next/font/google";
import AppChrome from "./components/AppChrome";
import "./globals.css";

const bricolageGrotesque = Bricolage_Grotesque({
  variable: "--font-bricolage-grotesque",
  subsets: ["latin"],
});

const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

// The tab title is driven at runtime by lib/page-title.ts, because every
// page here is client-rendered under this one layout and no route defines
// its own metadata — `generateMetadata` is server-only and can't see, say, a
// workspace's name. These stay as the pre-hydration default and as the
// template any future server route would inherit; the `%s — Study Copilot`
// shape matches `formatDocumentTitle`.
export const metadata: Metadata = {
  title: {
    default: "Study Copilot",
    template: "%s — Study Copilot",
  },
  description: "Personal study, health, money and research dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${bricolageGrotesque.variable} ${instrumentSans.variable} ${ibmPlexMono.variable} dark h-full antialiased`}
    >
      <body className="min-h-full bg-surface text-on-surface">
        <AppChrome>{children}</AppChrome>
      </body>
    </html>
  );
}

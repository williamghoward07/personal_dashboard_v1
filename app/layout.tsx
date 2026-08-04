import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import AppChrome from "./components/AppChrome";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Study Copilot",
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
      className={`${geistSans.variable} ${geistMono.variable} ${inter.variable} dark h-full antialiased`}
    >
      <body className="min-h-full bg-surface text-on-surface">
        <AppChrome>{children}</AppChrome>
      </body>
    </html>
  );
}

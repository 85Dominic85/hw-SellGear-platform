import type { Metadata } from "next";
import { DM_Sans, Space_Mono } from "next/font/google";
import "./globals.css";

// Tipografía de marca Qamarero: DM Sans (texto/títulos) + Space Mono (números/datos).
const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});

const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-space-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "MainOperation — Hardware",
  description: "Plataforma de gestión de operaciones de Hardware",
  // Herramienta interna: bloquear indexacion, archivado y scraping de IA.
  // Se complementa con public/robots.txt y X-Robots-Tag en next.config.ts.
  robots: {
    index: false,
    follow: false,
    noarchive: true,
    nosnippet: true,
    noimageindex: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={`${dmSans.variable} ${spaceMono.variable}`}>
      <body className="font-sans bg-gray-50 text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}

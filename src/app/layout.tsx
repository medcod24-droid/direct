import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Direct Conseil — gestion de cabinet comptable",
  description:
    "Dossiers clients, documents, échéances et honoraires pour les cabinets comptables au Maroc.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" dir="ltr">
      <body>{children}</body>
    </html>
  );
}

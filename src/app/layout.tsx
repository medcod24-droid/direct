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
    // `suppressHydrationWarning` : le script ci-dessous pose `data-theme` sur
    // <html> avant l'hydratation, donc l'attribut diffère volontairement du HTML
    // rendu côté serveur. La suppression ne porte que sur cet élément.
    <html lang="fr" dir="ltr" suppressHydrationWarning>
      <head>
        <script
          // Exécuté avant la peinture : évite d'afficher brièvement le thème
          // système alors que l'utilisateur a choisi l'autre. Clé partagée avec
          // `ThemeToggle` (THEME_KEY).
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var t=localStorage.getItem('dc-theme');" +
              "if(t==='light'||t==='dark'){document.documentElement.dataset.theme=t;}}catch(e){}})();",
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}

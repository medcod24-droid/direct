import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

/**
 * En-têtes de sécurité.
 *
 * `'unsafe-eval'` n'est ajouté qu'en développement : le rafraîchissement à chaud de
 * Next.js en a besoin. En production, la directive reste stricte.
 *
 * Limite connue : `'unsafe-inline'` sur les scripts est encore nécessaire pour les
 * scripts d'amorçage de Next. Le remplacement par un nonce (middleware + en-tête par
 * requête) est décrit dans SECURITY.md comme durcissement à faire avant mise en ligne.
 */
const scriptSrc = ["'self'", "'unsafe-inline'", isDev ? "'unsafe-eval'" : null]
  .filter(Boolean)
  .join(" ");

const csp = [
  "default-src 'self'",
  "img-src 'self' data: blob:",
  "style-src 'self' 'unsafe-inline'",
  `script-src ${scriptSrc}`,
  "connect-src 'self'" + (isDev ? " ws: wss:" : ""),
  "font-src 'self' data:",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "upgrade-insecure-requests",
].join("; ");

const nextConfig: NextConfig = {
  // Dossier de build paramétrable : permet de produire un build de production
  // sans écraser le `.next` d'un serveur de développement en cours d'exécution,
  // les deux se corrompant mutuellement.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  reactStrictMode: true,
  poweredByHeader: false,
  serverExternalPackages: ["@prisma/client", "bcryptjs"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Content-Security-Policy", value: csp },
          ...(isDev
            ? []
            : [
                {
                  key: "Strict-Transport-Security",
                  value: "max-age=63072000; includeSubDomains; preload",
                },
              ]),
        ],
      },
      {
        // Les documents ne doivent jamais être mis en cache par un intermédiaire.
        source: "/api/documents/:path*",
        headers: [{ key: "Cache-Control", value: "private, no-store, max-age=0" }],
      },
    ];
  },
};

export default nextConfig;

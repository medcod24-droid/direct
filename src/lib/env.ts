import { z } from "zod";

/**
 * Validation de l'environnement au démarrage. Un secret manquant doit faire échouer
 * le boot, pas produire un comportement silencieusement non sécurisé.
 * Aucune de ces valeurs n'est exposée au client (pas de préfixe NEXT_PUBLIC_).
 */
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1),
  /** Clé de signature des sessions et des jetons de téléchargement. 32+ caractères. */
  APP_SECRET: z.string().min(32),
  /** Racine de stockage privée des documents (hors racine web). */
  STORAGE_ROOT: z.string().min(1).default("./var/storage"),
  MAX_UPLOAD_MB: z.coerce.number().int().positive().default(25),
  APP_URL: z.string().url().default("http://localhost:3000"),
  /** Fournisseur d'e-mail : "console" en dev, un vrai fournisseur en production. */
  EMAIL_PROVIDER: z.enum(["console", "smtp"]).default("console"),
  SMTP_URL: z.string().optional(),
  EMAIL_FROM: z.string().default("Direct Conseil <no-reply@directconseil.ma>"),
});

let cached: z.infer<typeof schema> | null = null;

export function env() {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const missing = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(
      `Configuration invalide. Variables manquantes ou invalides : ${missing}. Voir .env.example.`,
    );
  }
  cached = parsed.data;
  return cached;
}

export const isProduction = () => env().NODE_ENV === "production";

/**
 * Noms des variables refusées par `env()`, extraits de son message d'erreur.
 * Les valeurs ne sont jamais lues : seuls les noms sortent d'ici, ce qui permet
 * de diagnostiquer une configuration incomplète sans rien divulguer.
 */
export function invalidEnvNames(error: unknown): string[] {
  const detail = error instanceof Error ? error.message : "";
  const listed = detail.match(/invalides\s*:\s*(.+?)\.\s*Voir/)?.[1] ?? "";
  return listed
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
}

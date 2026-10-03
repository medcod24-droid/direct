import { platformDb } from "@/lib/db/tenant";
import { env, invalidEnvNames } from "@/lib/env";
import { mailStatus } from "@/lib/mail/send";

/**
 * Sonde de santé pour la supervision. N'expose aucune donnée métier.
 *
 * La configuration est vérifiée en plus de la base. Sans cela, une variable
 * d'environnement manquante restait invisible : les pages s'affichent, parce que
 * `env()` n'est atteint qu'au moment de créer une session, et l'inscription
 * échouait avec un message générique alors que la sonde répondait « ok ».
 *
 * Seuls les noms des variables en défaut sont renvoyés, jamais leurs valeurs.
 */
export async function GET() {
  const startedAt = Date.now();

  let config: "ok" | "invalid" = "ok";
  let invalid: string[] = [];
  try {
    env();
  } catch (error) {
    config = "invalid";
    invalid = invalidEnvNames(error);
  }

  let database: "ok" | "unreachable" = "ok";
  try {
    await platformDb.$queryRaw`SELECT 1`;
  } catch {
    database = "unreachable";
  }

  // « console » en production n'est pas une panne : c'est un choix, signalé mais
  // pas alarmant. Un fournisseur sans sa clé, en revanche, est une erreur.
  const email = config === "ok" ? mailStatus() : "incomplet";
  const healthy = config === "ok" && database === "ok" && email !== "incomplet";

  return Response.json(
    {
      status: healthy ? "ok" : "degraded",
      database,
      config,
      email,
      ...(invalid.length ? { invalidEnv: invalid } : {}),
      latencyMs: Date.now() - startedAt,
    },
    { status: healthy ? 200 : 503 },
  );
}

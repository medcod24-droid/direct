import { platformDb } from "@/lib/db/tenant";

/** Sonde de santé pour la supervision. N'expose aucune donnée métier. */
export async function GET() {
  const startedAt = Date.now();
  try {
    await platformDb.$queryRaw`SELECT 1`;
    return Response.json({
      status: "ok",
      database: "ok",
      latencyMs: Date.now() - startedAt,
    });
  } catch {
    return Response.json({ status: "degraded", database: "unreachable" }, { status: 503 });
  }
}

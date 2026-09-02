import { PrismaClient } from "@prisma/client";

/**
 * Isolation multi-tenant.
 *
 * Toute donnée appartenant à un cabinet est lue et écrite via `tenantDb()`, un client
 * Prisma étendu qui injecte `cabinetId` dans le `where` de chaque lecture et dans le
 * `data` de chaque écriture. Un développeur qui oublie un filtre obtient quand même une
 * requête isolée : l'isolation ne dépend jamais du code appelant ni du frontend.
 *
 * `platformDb` est le client non filtré. Il est réservé à l'authentification, aux plans
 * et à l'administration de la plateforme. Son nom explicite rend tout usage visible en
 * revue de code (voir le test tests/security/tenant-isolation.test.ts).
 */

const globalForPrisma = globalThis as unknown as { __daftarPrisma?: PrismaClient };

export const platformDb =
  globalForPrisma.__daftarPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.__daftarPrisma = platformDb;

/** Modèles dont chaque ligne appartient à un cabinet (cabinetId non nul). */
const TENANT_MODELS = new Set([
  "Client",
  "Contact",
  "ClientAssignment",
  "Document",
  "DocumentRequest",
  "Task",
  "TaskComment",
  "Deadline",
  "Message",
  "Notification",
  "ClientInvoice",
  "Activity",
  "AuditLog",
  "Membership",
  "Subscription",
  "Invitation",
]);

/**
 * Modèles partagés : cabinetId nul = ligne système fournie par la plateforme.
 * Lecture = lignes du cabinet + lignes système. Écriture = cabinet uniquement :
 * un cabinet ne peut jamais modifier une ligne système.
 */
const SHARED_MODELS = new Set(["DocumentCategory", "DeadlineRule"]);

/** Modèles portant un clientId, pour la restriction « collaborateur assigné ». */
const STRICT_CLIENT_MODELS = new Set([
  "Contact",
  "ClientAssignment",
  "Document",
  "DocumentRequest",
  "Deadline",
  "Message",
  "ClientInvoice",
]);
/** clientId nullable : les lignes sans client sont internes au cabinet, donc visibles. */
const NULLABLE_CLIENT_MODELS = new Set(["Task", "Activity"]);

const READ_OPS = new Set([
  "findUnique",
  "findUniqueOrThrow",
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "count",
  "aggregate",
  "groupBy",
]);
const WHERE_WRITE_OPS = new Set(["update", "updateMany", "delete", "deleteMany"]);

export type TenantScope = {
  cabinetId: string;
  /**
   * null = accès à tous les dossiers du cabinet.
   * tableau = accès restreint à ces dossiers (collaborateur assigné, compte client).
   */
  clientIds?: string[] | null;
};

/**
 * Ajoute le filtre du cabinet sans écraser le `where` d'origine.
 *
 * Le filtre est ajouté dans `AND` et les clés d'origine restent au premier niveau :
 * `findUnique`, `update` et `delete` exigent leur champ unique au premier niveau
 * (Prisma « extendedWhereUnique »). Un `AND` englobant casserait ces opérations.
 */
function and(where: unknown, extra: Record<string, unknown>) {
  if (!where || typeof where !== "object" || Array.isArray(where)) return extra;
  const current = where as Record<string, unknown>;
  const existing = Array.isArray(current.AND)
    ? (current.AND as unknown[])
    : current.AND
      ? [current.AND]
      : [];
  return { ...current, AND: [...existing, extra] };
}

function readFilter(model: string, scope: TenantScope): Record<string, unknown> {
  // Le cabinet lui-même est identifié par son id, pas par un champ cabinetId.
  if (model === "Cabinet") return { id: scope.cabinetId };

  const filter: Record<string, unknown> = SHARED_MODELS.has(model)
    ? { OR: [{ cabinetId: scope.cabinetId }, { cabinetId: null }] }
    : { cabinetId: scope.cabinetId };

  const ids = scope.clientIds;
  if (ids) {
    if (model === "Client") return { AND: [filter, { id: { in: ids } }] };
    if (STRICT_CLIENT_MODELS.has(model)) return { AND: [filter, { clientId: { in: ids } }] };
    if (NULLABLE_CLIENT_MODELS.has(model))
      return { AND: [filter, { OR: [{ clientId: { in: ids } }, { clientId: null }] }] };
  }
  return filter;
}

function writeFilter(model: string, scope: TenantScope): Record<string, unknown> {
  if (model === "Cabinet") return { id: scope.cabinetId };
  // À l'écriture, on force l'appartenance exacte : jamais les lignes système.
  const filter: Record<string, unknown> = { cabinetId: scope.cabinetId };
  const ids = scope.clientIds;
  if (ids) {
    if (model === "Client") return { AND: [filter, { id: { in: ids } }] };
    if (STRICT_CLIENT_MODELS.has(model)) return { AND: [filter, { clientId: { in: ids } }] };
    if (NULLABLE_CLIENT_MODELS.has(model))
      return { AND: [filter, { OR: [{ clientId: { in: ids } }, { clientId: null }] }] };
  }
  return filter;
}

function stampData<T>(data: T, cabinetId: string): T {
  if (Array.isArray(data)) return data.map((d) => ({ ...d, cabinetId })) as unknown as T;
  if (data && typeof data === "object") return { ...(data as object), cabinetId } as T;
  return data;
}

/**
 * Client Prisma restreint à un cabinet (et éventuellement à une liste de dossiers).
 * @throws si aucun cabinetId n'est fourni — pas de repli silencieux sur « tout voir ».
 */
export function tenantDb(scope: TenantScope) {
  if (!scope?.cabinetId) {
    throw new Error("tenantDb requiert un cabinetId : accès refusé par défaut.");
  }
  const { cabinetId } = scope;

  return platformDb.$extends({
    name: "tenant-isolation",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          // Les types Prisma sont propres à chaque modèle ; l'extension est générique.
          // Les casts ci-dessous portent sur la forme des arguments, pas sur la sécurité :
          // le filtre injecté est appliqué quoi qu'il arrive.
          const run = query as (a: unknown) => Promise<unknown>;
          const scoped =
            TENANT_MODELS.has(model) || SHARED_MODELS.has(model) || model === "Cabinet";
          if (!scoped) return query(args);


          const a = (args ?? {}) as Record<string, unknown>;

          if (READ_OPS.has(operation)) {
            return run({ ...a, where: and(a.where, readFilter(model, scope)) });
          }

          if (WHERE_WRITE_OPS.has(operation)) {
            return run({ ...a, where: and(a.where, writeFilter(model, scope)) });
          }

          if (operation === "create" || operation === "createMany" || operation === "createManyAndReturn") {
            // Un cabinet ne se crée jamais depuis un contexte déjà rattaché à un cabinet.
            if (model === "Cabinet") throw new Error("Création de cabinet interdite dans un contexte tenant.");
            return run({ ...a, data: stampData(a.data, cabinetId) });
          }

          if (operation === "upsert") {
            return run({
              ...a,
              where: and(a.where, writeFilter(model, scope)),
              create: stampData(a.create, cabinetId),
            });
          }

          // Opération inconnue sur un modèle tenant : refus explicite plutôt que fuite.
          throw new Error(
            `Opération « ${operation} » non couverte par l'isolation multi-tenant sur ${model}.`,
          );
        },
      },
    },
  });
}

export type TenantClient = ReturnType<typeof tenantDb>;

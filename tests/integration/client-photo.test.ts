import { beforeAll, describe, expect, it } from "vitest";
import type { AuthContext } from "@/lib/authz/guard";
import { can } from "@/lib/authz/permissions";
import { parsePhotoDataUrl, PHOTO_FIELD } from "@/lib/clients/photo";
import { tenantDb } from "@/lib/db/tenant";
import { NotFoundError } from "@/lib/errors";
import {
  expectedScans,
  fieldScans,
  openClientPhoto,
  removeClientPhoto,
  setClientPhoto,
} from "@/server/services/documents";
import { makeCabinet, makeClient, makeUser } from "../factories";

/**
 * Photo ou logo du dossier.
 *
 * Une seule photo active par dossier, lisible par qui voit le dossier et par
 * personne d'autre, et qui ne compte pas parmi les pièces attendues.
 */
function contextFor(cabinetId: string, userId: string): AuthContext {
  const scope = { cabinetId, clientIds: null };
  return {
    sessionId: "test",
    user: { id: userId, email: "t@directconseil.ma", name: "Test", locale: "fr" },
    cabinet: { id: cabinetId, name: "Cabinet", slug: "c", cndpMode: "declaration" },
    membership: { id: "m", role: "owner", restrictedToAssigned: false, clientId: null },
    scope,
    db: tenantDb(scope),
    ip: null,
    userAgent: "vitest",
    can: (p) => can("owner", p),
  };
}

const PNG_1PX =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
const photo = () => parsePhotoDataUrl(`data:image/png;base64,${PNG_1PX}`);

async function readAll(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk as Buffer));
  return Buffer.concat(chunks);
}

describe("photo du dossier", () => {
  let ctx: AuthContext;
  let other: AuthContext;
  let clientId: string;

  beforeAll(async () => {
    const [cabinet, cabinetB, user] = await Promise.all([
      makeCabinet("Photos"),
      makeCabinet("Photos bis"),
      makeUser(),
    ]);
    const client = await makeClient(cabinet.id);
    clientId = client.id;
    ctx = contextFor(cabinet.id, user.id);
    other = contextFor(cabinetB.id, user.id);
  });

  it("enregistre la photo et la relit telle quelle", async () => {
    await setClientPhoto(ctx, clientId, photo());
    const { document, stream } = await openClientPhoto(ctx, clientId);
    expect(document.mimeType).toBe("image/png");
    expect(document.fieldKey).toBe(PHOTO_FIELD);
    expect((await readAll(stream)).equals(photo().buffer)).toBe(true);
  });

  it("ne garde qu'une photo par dossier", async () => {
    await setClientPhoto(ctx, clientId, photo());
    await setClientPhoto(ctx, clientId, photo());
    const photos = await ctx.db.document.count({ where: { clientId, fieldKey: PHOTO_FIELD } });
    expect(photos).toBe(1);
  });

  it("reste introuvable depuis un autre cabinet", async () => {
    await expect(openClientPhoto(other, clientId)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("n'entre pas dans les pièces attendues", async () => {
    const client = await ctx.db.client.findFirstOrThrow({ where: { id: clientId } });
    const scans = await fieldScans(ctx, clientId);
    const keys = expectedScans(client, scans).map((row) => row.key);
    expect(keys).not.toContain(PHOTO_FIELD);
  });

  it("se retire, et le dossier redevient sans photo", async () => {
    await removeClientPhoto(ctx, clientId);
    await expect(openClientPhoto(ctx, clientId)).rejects.toBeInstanceOf(NotFoundError);
  });
});

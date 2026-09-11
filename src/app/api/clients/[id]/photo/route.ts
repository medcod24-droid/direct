import type { NextRequest } from "next/server";
import { requirePermission } from "@/lib/authz/guard";
import { toPublicError } from "@/lib/errors";
import { openClientPhoto } from "@/server/services/documents";

/**
 * Photo ou logo d'un dossier, pour l'affichage.
 *
 * Distincte de la route de téléchargement : elle ne demande que le droit de voir
 * le dossier — un collaborateur qui ouvre la fiche doit voir la photo sans avoir
 * le droit de télécharger les pièces — et ne journalise pas chaque affichage.
 * L'adresse porte l'identifiant de la pièce (`?v=`) : une nouvelle photo change
 * d'adresse, ce qui autorise un cache privé.
 */
export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requirePermission("client.view");
    const { id } = await context.params;
    const { document, stream } = await openClientPhoto(ctx, id);

    return new Response(stream as unknown as ReadableStream, {
      headers: {
        "Content-Type": document.mimeType,
        "Content-Length": String(document.size),
        "Content-Disposition": "inline",
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const { status, message, code } = toPublicError(error);
    return Response.json({ error: code, message }, { status });
  }
}

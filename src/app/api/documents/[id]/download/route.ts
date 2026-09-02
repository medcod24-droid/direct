import type { NextRequest } from "next/server";
import { requirePermission } from "@/lib/authz/guard";
import { toPublicError } from "@/lib/errors";
import { openDocument } from "@/server/services/documents";

/**
 * Téléchargement d'un document.
 *
 * Aucun fichier n'est servi statiquement : cette route est le seul chemin d'accès.
 * L'autorisation est vérifiée ici (permission + cabinet + portée dossier), le fichier est
 * lu depuis le stockage privé, et chaque accès est inscrit au journal d'audit.
 */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requirePermission("document.download");
    const { id } = await context.params;
    const { document, stream } = await openDocument(ctx, id);

    const disposition = request.nextUrl.searchParams.get("inline") === "1" ? "inline" : "attachment";
    // Le nom d'origine est réencodé : il ne sert jamais à construire un chemin.
    const safeName = encodeURIComponent(document.filename);

    return new Response(stream as unknown as ReadableStream, {
      headers: {
        "Content-Type": document.mimeType,
        "Content-Length": String(document.size),
        "Content-Disposition": `${disposition}; filename*=UTF-8''${safeName}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const { status, message, code } = toPublicError(error);
    return Response.json({ error: code, message }, { status });
  }
}

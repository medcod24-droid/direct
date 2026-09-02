import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "@/lib/env";
import { ValidationError } from "@/lib/errors";

/**
 * Stockage privé des documents.
 *
 * - Les fichiers vivent hors de la racine web : aucune URL publique n'existe.
 * - Le nom d'origine n'est jamais utilisé sur le disque (traversée de chemin, collisions).
 * - Chaque écriture calcule un SHA-256 : intégrité au sens de la loi 53-05 et détection
 *   de doublons.
 * - L'implémentation locale est remplaçable par un stockage objet privé (S3, OVH, cloud
 *   marocain) sans toucher au code métier : seule cette interface est utilisée.
 */
export type StoredFile = {
  storageKey: string;
  size: number;
  checksum: string;
  mimeType: string;
  filename: string;
};

const ALLOWED_MIME: Record<string, string[]> = {
  "application/pdf": [".pdf"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
  "image/heic": [".heic"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
  "application/vnd.ms-excel": [".xls"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
  "application/msword": [".doc"],
  "text/csv": [".csv"],
  "text/plain": [".txt"],
  "application/zip": [".zip"],
};

/** Signatures binaires vérifiées : le type déclaré par le navigateur ne suffit pas. */
const MAGIC: Array<{ mime: string; bytes: number[] }> = [
  { mime: "application/pdf", bytes: [0x25, 0x50, 0x44, 0x46] },
  { mime: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
  { mime: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47] },
  { mime: "application/zip", bytes: [0x50, 0x4b, 0x03, 0x04] }, // xlsx / docx sont des zip
  { mime: "image/webp", bytes: [0x52, 0x49, 0x46, 0x46] }, // RIFF, puis WEBP à l'offset 8
  { mime: "application/msword", bytes: [0xd0, 0xcf, 0x11, 0xe0] }, // OLE2 (.doc, .xls)
  { mime: "application/vnd.ms-excel", bytes: [0xd0, 0xcf, 0x11, 0xe0] },
];

const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g;
const UNSAFE_CHARS = /[^\p{L}\p{N}._ -]/gu;

export function sanitizeFilename(name: string): string {
  const base = path.basename(name).replace(CONTROL_CHARS, "");
  const cleaned = base.replace(UNSAFE_CHARS, "_").replace(/^\.+/, "").trim();
  return (cleaned || "document").slice(0, 180);
}

export function assertUploadAllowed(input: { filename: string; mimeType: string; size: number }): void {
  const maxBytes = env().MAX_UPLOAD_MB * 1024 * 1024;
  if (input.size <= 0) throw new ValidationError("Fichier vide.");
  if (input.size > maxBytes)
    throw new ValidationError(`Fichier trop volumineux (maximum ${env().MAX_UPLOAD_MB} Mo).`);

  const extensions = ALLOWED_MIME[input.mimeType];
  if (!extensions) throw new ValidationError(`Type de fichier non autorisé : ${input.mimeType}.`);

  const ext = path.extname(sanitizeFilename(input.filename)).toLowerCase();
  if (!extensions.includes(ext))
    throw new ValidationError(
      `L'extension ${ext || "(absente)"} ne correspond pas au type du fichier.`,
    );
}

/** Vérifie la signature binaire quand le format en possède une connue. */
export function assertContentMatchesType(buffer: Buffer, mimeType: string): void {
  const direct = MAGIC.filter((m) => m.mime === mimeType);
  const zipBased =
    mimeType.includes("openxmlformats") || mimeType === "application/zip"
      ? MAGIC.filter((m) => m.mime === "application/zip")
      : [];
  const candidates = direct.length ? direct : zipBased;
  if (!candidates.length) return;
  const ok = candidates.some((c) => c.bytes.every((byte, index) => buffer[index] === byte));
  if (!ok) throw new ValidationError("Le contenu du fichier ne correspond pas à son type déclaré.");
}

function resolveKey(storageKey: string): string {
  const root = path.resolve(env().STORAGE_ROOT);
  const target = path.resolve(root, storageKey);
  // Défense contre la traversée de chemin, même si la clé provient de la base.
  if (target !== root && !target.startsWith(root + path.sep)) {
    throw new ValidationError("Chemin de stockage invalide.");
  }
  return target;
}

export async function putFile(input: {
  cabinetId: string;
  filename: string;
  mimeType: string;
  buffer: Buffer;
}): Promise<StoredFile> {
  const filename = sanitizeFilename(input.filename);
  assertUploadAllowed({ filename, mimeType: input.mimeType, size: input.buffer.length });
  assertContentMatchesType(input.buffer, input.mimeType);

  const year = new Date().getUTCFullYear();
  const storageKey = path.join(input.cabinetId, String(year), `${randomUUID()}.bin`);
  const target = resolveKey(storageKey);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, input.buffer, { mode: 0o600 });

  return {
    storageKey,
    size: input.buffer.length,
    checksum: createHash("sha256").update(input.buffer).digest("hex"),
    mimeType: input.mimeType,
    filename,
  };
}

export function readFileStream(storageKey: string) {
  return createReadStream(resolveKey(storageKey));
}

export async function fileExists(storageKey: string): Promise<boolean> {
  // resolveKey est appelé hors du try : une clé invalide est un bug à signaler,
  // pas un fichier « absent ».
  const target = resolveKey(storageKey);
  try {
    await stat(target);
    return true;
  } catch {
    return false;
  }
}

export async function deleteFile(storageKey: string): Promise<void> {
  await rm(resolveKey(storageKey), { force: true });
}

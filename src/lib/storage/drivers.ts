import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import { Readable } from "node:stream";
import path from "node:path";
import { env } from "@/lib/env";
import { ValidationError } from "@/lib/errors";

/**
 * Pilotes de stockage.
 *
 * Le disque local reste le mode par défaut : rien ne change en développement, en
 * test, ni sur un serveur avec disque persistant. Le pilote Vercel Blob n'est
 * choisi que si son jeton est présent, c'est-à-dire sur un hébergeur sans
 * système de fichiers durable.
 */
export type StorageDriver = {
  name: string;
  put(storageKey: string, buffer: Buffer): Promise<void>;
  read(storageKey: string): Promise<NodeJS.ReadableStream>;
  exists(storageKey: string): Promise<boolean>;
  remove(storageKey: string): Promise<void>;
};

/** Défense contre la traversée de chemin, même si la clé provient de la base. */
export function assertSafeKey(storageKey: string): string {
  const normalized = path.normalize(storageKey);
  if (
    path.isAbsolute(normalized) ||
    normalized.split(path.sep).includes("..") ||
    normalized.startsWith("..")
  ) {
    throw new ValidationError("Chemin de stockage invalide.");
  }
  return normalized;
}

// --- disque local ------------------------------------------------------------

function resolveKey(storageKey: string): string {
  const root = path.resolve(env().STORAGE_ROOT);
  const target = path.resolve(root, assertSafeKey(storageKey));
  if (target !== root && !target.startsWith(root + path.sep)) {
    throw new ValidationError("Chemin de stockage invalide.");
  }
  return target;
}

const filesystemDriver: StorageDriver = {
  name: "filesystem",
  async put(storageKey, buffer) {
    const target = resolveKey(storageKey);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, buffer, { mode: 0o600 });
  },
  async read(storageKey) {
    return createReadStream(resolveKey(storageKey));
  },
  async exists(storageKey) {
    const target = resolveKey(storageKey);
    try {
      await stat(target);
      return true;
    } catch {
      return false;
    }
  },
  async remove(storageKey) {
    await rm(resolveKey(storageKey), { force: true });
  },
};

// --- Vercel Blob -------------------------------------------------------------

/**
 * Chiffrement du contenu avant dépôt.
 *
 * Vercel Blob ne propose qu'un accès public : l'adresse est imprévisible, mais
 * un fichier déposé tel quel serait lisible par quiconque obtiendrait l'URL. Le
 * produit garantit qu'aucun document n'est accessible sans passer par le
 * contrôle d'autorisation ; le contenu est donc chiffré, et l'URL seule ne
 * donne rien d'exploitable.
 *
 * AES-256-GCM : le déchiffrement échoue si l'objet a été modifié.
 */
const IV_BYTES = 12;
const TAG_BYTES = 16;

function contentKey(): Buffer {
  return createHash("sha256").update(`document-storage:${env().APP_SECRET}`).digest();
}

function encrypt(plain: Buffer): Buffer {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", contentKey(), iv);
  const body = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]);
}

function decrypt(stored: Buffer): Buffer {
  if (stored.length < IV_BYTES + TAG_BYTES) {
    throw new ValidationError("Document illisible : contenu tronqué.");
  }
  const iv = stored.subarray(0, IV_BYTES);
  const tag = stored.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const decipher = createDecipheriv("aes-256-gcm", contentKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(stored.subarray(IV_BYTES + TAG_BYTES)), decipher.final()]);
}

/** Chargé à la demande : le paquet n'est requis que sur un hébergeur sans disque. */
async function blob() {
  return import("@vercel/blob");
}

const blobDriver: StorageDriver = {
  name: "vercel-blob",
  async put(storageKey, buffer) {
    const { put } = await blob();
    await put(assertSafeKey(storageKey), encrypt(buffer), {
      access: "public",
      addRandomSuffix: false,
      // Type neutre : le contenu déposé est chiffré, pas le fichier d'origine.
      contentType: "application/octet-stream",
    });
  },
  async read(storageKey) {
    const { head } = await blob();
    const info = await head(assertSafeKey(storageKey));
    const response = await fetch(info.url);
    if (!response.ok) throw new ValidationError("Document introuvable dans le stockage.");
    const stored = Buffer.from(await response.arrayBuffer());
    return Readable.from(decrypt(stored));
  },
  async exists(storageKey) {
    const { head } = await blob();
    try {
      await head(assertSafeKey(storageKey));
      return true;
    } catch {
      return false;
    }
  },
  async remove(storageKey) {
    const { del, head } = await blob();
    try {
      const info = await head(assertSafeKey(storageKey));
      await del(info.url);
    } catch {
      // Déjà absent : la suppression est idempotente.
    }
  },
};

/**
 * Pilote actif. Le jeton de Vercel Blob n'existe que là où il n'y a pas de
 * disque durable : sa présence est donc le bon signal, sans réglage à tenir.
 */
export function storageDriver(): StorageDriver {
  return process.env.BLOB_READ_WRITE_TOKEN ? blobDriver : filesystemDriver;
}

export const __testing = { encrypt, decrypt, filesystemDriver };

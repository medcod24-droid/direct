import { createHash, randomUUID } from "node:crypto";
import { readFile, rm, stat } from "node:fs/promises";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { ValidationError } from "@/lib/errors";
import {
  assertContentMatchesType,
  assertUploadAllowed,
  deleteFile,
  fileExists,
  putFile,
  readFileStream,
  sanitizeFilename,
} from "@/lib/storage";

/**
 * Tests du stockage privé des documents.
 *
 * Trois garanties sont vérifiées ici : le nom d'origine ne touche jamais le disque,
 * le type déclaré est confronté à la signature binaire, et aucune clé ne peut sortir
 * de la racine de stockage.
 */

const STORAGE_ROOT = path.resolve(process.env.STORAGE_ROOT ?? "./var/test-storage");
const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB ?? 25);
const cabinetId = `cab-test-${randomUUID()}`;

const PDF = Buffer.concat([
  Buffer.from("%PDF-1.7\n", "latin1"),
  Buffer.from("1 0 obj << /Type /Catalog >> endobj\n%%EOF\n", "latin1"),
]);

afterAll(async () => {
  await rm(path.join(STORAGE_ROOT, cabinetId), { recursive: true, force: true });
});

describe("sanitizeFilename", () => {
  it("neutralise une traversée de chemin", () => {
    const cleaned = sanitizeFilename("../../etc/passwd");
    expect(cleaned).toBe("passwd");
    expect(cleaned).not.toContain("/");
    expect(cleaned.startsWith(".")).toBe(false);
  });

  it("neutralise aussi les séparateurs Windows", () => {
    const cleaned = sanitizeFilename("..\\..\\Windows\\system32\\config");
    expect(cleaned).not.toContain("\\");
    expect(cleaned).not.toContain("/");
    expect(cleaned.startsWith(".")).toBe(false);
  });

  it("retire les points de tête d'un fichier caché", () => {
    expect(sanitizeFilename(".env")).toBe("env");
    expect(sanitizeFilename("..gitignore")).toBe("gitignore");
  });

  it("supprime les caractères de contrôle", () => {
    const avecControles = `fact${String.fromCharCode(0)}ure${String.fromCharCode(31)}.pdf`;
    expect(sanitizeFilename(avecControles)).toBe("facture.pdf");
    expect(sanitizeFilename("bulletin\n\t.pdf")).toBe("bulletin.pdf");
  });

  it("conserve les accents et les lettres arabes", () => {
    expect(sanitizeFilename("Déclaration TVA août 2026.pdf")).toBe("Déclaration TVA août 2026.pdf");
    expect(sanitizeFilename("فاتورة.pdf")).toBe("فاتورة.pdf");
    expect(sanitizeFilename("relevé-bancaire_01.pdf")).toBe("relevé-bancaire_01.pdf");
  });

  it("remplace les caractères dangereux restants", () => {
    expect(sanitizeFilename("fact;rm -rf *.pdf")).not.toMatch(/[;*]/);
  });

  it("plafonne la longueur du nom", () => {
    const cleaned = sanitizeFilename(`${"a".repeat(300)}.pdf`);
    expect(cleaned).toHaveLength(180);
  });

  it("retombe sur un nom par défaut quand il ne reste rien", () => {
    expect(sanitizeFilename("...")).toBe("document");
    expect(sanitizeFilename("/")).toBe("document");
    expect(sanitizeFilename("")).toBe("document");
  });
});

describe("assertUploadAllowed", () => {
  it("accepte un fichier conforme", () => {
    expect(() =>
      assertUploadAllowed({ filename: "facture.pdf", mimeType: "application/pdf", size: 2048 }),
    ).not.toThrow();
    expect(() =>
      assertUploadAllowed({ filename: "photo.JPEG", mimeType: "image/jpeg", size: 2048 }),
    ).not.toThrow();
  });

  it("refuse un type MIME inconnu", () => {
    expect(() =>
      assertUploadAllowed({ filename: "virus.exe", mimeType: "application/x-msdownload", size: 2048 }),
    ).toThrow(ValidationError);
    expect(() =>
      assertUploadAllowed({ filename: "script.sh", mimeType: "application/x-sh", size: 10 }),
    ).toThrow(/non autorisé/);
  });

  it("refuse une extension qui ne correspond pas au type déclaré", () => {
    expect(() =>
      assertUploadAllowed({ filename: "facture.png", mimeType: "application/pdf", size: 2048 }),
    ).toThrow(/extension/);
    expect(() =>
      assertUploadAllowed({ filename: "facture", mimeType: "application/pdf", size: 2048 }),
    ).toThrow(/extension/);
  });

  it("refuse un fichier vide", () => {
    expect(() =>
      assertUploadAllowed({ filename: "facture.pdf", mimeType: "application/pdf", size: 0 }),
    ).toThrow(/vide/);
  });

  it("refuse un fichier au-delà de la taille maximale", () => {
    const tropGros = MAX_UPLOAD_MB * 1024 * 1024 + 1;
    expect(() =>
      assertUploadAllowed({ filename: "scan.pdf", mimeType: "application/pdf", size: tropGros }),
    ).toThrow(/volumineux/);
    // La borne exacte reste acceptée.
    expect(() =>
      assertUploadAllowed({ filename: "scan.pdf", mimeType: "application/pdf", size: MAX_UPLOAD_MB * 1024 * 1024 }),
    ).not.toThrow();
  });
});

describe("assertContentMatchesType", () => {
  it("accepte un vrai en-tête PDF", () => {
    expect(() => assertContentMatchesType(PDF, "application/pdf")).not.toThrow();
  });

  it("refuse un fichier qui se déclare PDF sans en avoir la signature", () => {
    const faux = Buffer.from("Ceci n'est pas un PDF", "utf8");
    expect(() => assertContentMatchesType(faux, "application/pdf")).toThrow(ValidationError);
    expect(() => assertContentMatchesType(faux, "application/pdf")).toThrow(/ne correspond pas/);
  });

  it("vérifie aussi PNG et JPEG", () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(() => assertContentMatchesType(png, "image/png")).not.toThrow();
    expect(() => assertContentMatchesType(png, "image/jpeg")).toThrow(ValidationError);
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
    expect(() => assertContentMatchesType(jpeg, "image/jpeg")).not.toThrow();
  });

  it("traite les formats Office comme des archives zip", () => {
    const zip = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]);
    const xlsx = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    expect(() => assertContentMatchesType(zip, xlsx)).not.toThrow();
    expect(() => assertContentMatchesType(PDF, xlsx)).toThrow(ValidationError);
  });

  it("laisse passer un type sans signature connue", () => {
    const csv = Buffer.from("date;libelle;montant\n2026-01-01;Achat;120", "utf8");
    expect(() => assertContentMatchesType(csv, "text/csv")).not.toThrow();
    expect(() => assertContentMatchesType(csv, "text/plain")).not.toThrow();
  });

  it("refuse un buffer trop court pour contenir la signature", () => {
    expect(() => assertContentMatchesType(Buffer.from([0x25]), "application/pdf")).toThrow(
      ValidationError,
    );
  });
});

describe("putFile", () => {
  it("écrit sous la racine de stockage sans exposer le nom d'origine", async () => {
    const stored = await putFile({
      cabinetId,
      filename: "Déclaration TVA confidentielle.pdf",
      mimeType: "application/pdf",
      buffer: PDF,
    });

    expect(stored.filename).toBe("Déclaration TVA confidentielle.pdf");
    expect(stored.storageKey).not.toContain("Déclaration");
    expect(stored.storageKey).not.toContain("TVA");
    expect(stored.storageKey).not.toContain("confidentielle");
    expect(stored.storageKey.endsWith(".bin")).toBe(true);
    expect(stored.storageKey.startsWith(`${cabinetId}${path.sep}`)).toBe(true);
    expect(stored.storageKey).toContain(String(new Date().getUTCFullYear()));

    const target = path.resolve(STORAGE_ROOT, stored.storageKey);
    expect(target.startsWith(STORAGE_ROOT + path.sep)).toBe(true);
    expect(await readFile(target)).toEqual(PDF);
    expect(await fileExists(stored.storageKey)).toBe(true);

    await deleteFile(stored.storageKey);
    expect(await fileExists(stored.storageKey)).toBe(false);
  });

  it("calcule un SHA-256 conforme et la taille réelle", async () => {
    const stored = await putFile({
      cabinetId,
      filename: "bilan.pdf",
      mimeType: "application/pdf",
      buffer: PDF,
    });
    expect(stored.checksum).toBe(createHash("sha256").update(PDF).digest("hex"));
    expect(stored.checksum).toMatch(/^[0-9a-f]{64}$/);
    expect(stored.size).toBe(PDF.length);
    await deleteFile(stored.storageKey);
  });

  it("écrit le fichier en lecture seule pour le propriétaire", async () => {
    const stored = await putFile({
      cabinetId,
      filename: "confidentiel.pdf",
      mimeType: "application/pdf",
      buffer: PDF,
    });
    const info = await stat(path.resolve(STORAGE_ROOT, stored.storageKey));
    expect(info.mode & 0o777).toBe(0o600);
    await deleteFile(stored.storageKey);
  });

  it("assainit le nom conservé en base", async () => {
    const stored = await putFile({
      cabinetId,
      filename: "../../etc/passwd.pdf",
      mimeType: "application/pdf",
      buffer: PDF,
    });
    expect(stored.filename).toBe("passwd.pdf");
    await deleteFile(stored.storageKey);
  });

  it("deux écritures du même contenu produisent des clés différentes mais le même empreinte", async () => {
    const a = await putFile({ cabinetId, filename: "a.pdf", mimeType: "application/pdf", buffer: PDF });
    const b = await putFile({ cabinetId, filename: "a.pdf", mimeType: "application/pdf", buffer: PDF });
    expect(a.storageKey).not.toBe(b.storageKey);
    expect(a.checksum).toBe(b.checksum);
    await deleteFile(a.storageKey);
    await deleteFile(b.storageKey);
  });

  it("refuse un contenu qui ne correspond pas au type déclaré", async () => {
    await expect(
      putFile({
        cabinetId,
        filename: "faux.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from("MZ ceci est un exécutable", "utf8"),
      }),
    ).rejects.toThrow(ValidationError);
  });

  it("refuse un fichier vide avant toute écriture", async () => {
    await expect(
      putFile({ cabinetId, filename: "vide.pdf", mimeType: "application/pdf", buffer: Buffer.alloc(0) }),
    ).rejects.toThrow(/vide/);
  });

  it("refuse un identifiant de cabinet qui tenterait de sortir de la racine", async () => {
    await expect(
      putFile({
        cabinetId: "../../..",
        filename: "facture.pdf",
        mimeType: "application/pdf",
        buffer: PDF,
      }),
    ).rejects.toThrow(ValidationError);
  });
});

describe("protection contre la traversée de chemin", () => {
  const clesMalveillantes = ["../../../etc/passwd", "../secret.bin", "/etc/passwd", "..", "../"];

  it("la lecture d'une clé sortant de la racine est refusée", () => {
    for (const cle of clesMalveillantes) {
      expect(() => readFileStream(cle)).toThrow(ValidationError);
      expect(() => readFileStream(cle)).toThrow(/Chemin de stockage invalide/);
    }
  });

  it("la suppression d'une clé sortant de la racine est refusée", async () => {
    for (const cle of clesMalveillantes) {
      await expect(deleteFile(cle)).rejects.toThrow(ValidationError);
    }
  });

  it("une clé légitime n'est pas bloquée", async () => {
    const stored = await putFile({
      cabinetId,
      filename: "ok.pdf",
      mimeType: "application/pdf",
      buffer: PDF,
    });
    expect(() => readFileStream(stored.storageKey).close()).not.toThrow();
    await expect(deleteFile(stored.storageKey)).resolves.toBeUndefined();
  });
});

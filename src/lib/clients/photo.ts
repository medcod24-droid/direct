import { ValidationError } from "@/lib/errors";

/** Clé de champ de la photo du dossier, parmi les justificatifs de la fiche. */
export const PHOTO_FIELD = "photo";

/** Au-delà, ce n'est pas une photo d'identité ni un logo : c'est un scan mal réduit. */
export const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

export type ClientPhoto = { type: "image/png" | "image/jpeg"; buffer: Buffer };

const SIGNATURES: Record<ClientPhoto["type"], number[]> = {
  "image/png": [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  "image/jpeg": [0xff, 0xd8, 0xff],
};

/**
 * Photo ou logo envoyé avec la fiche.
 *
 * Le navigateur réduit l'image avant l'envoi et la transmet en data URL, dans
 * un champ caché du formulaire : c'est ce qui permet de la joindre dès la
 * création du dossier, quand il n'existe encore rien à quoi rattacher un dépôt.
 * Le type annoncé ne suffit pas — il est vérifié sur les premiers octets.
 */
export function parsePhotoDataUrl(value: string): ClientPhoto {
  const match = /^data:(image\/png|image\/jpeg);base64,([A-Za-z0-9+/=]+)$/.exec(value.trim());
  if (!match) {
    throw new ValidationError("Image non reconnue : choisissez une photo JPG ou PNG.", {
      photo: ["Image non reconnue : choisissez une photo JPG ou PNG."],
    });
  }

  const type = match[1] as ClientPhoto["type"];
  const buffer = Buffer.from(match[2] ?? "", "base64");

  if (buffer.length === 0 || buffer.length > MAX_PHOTO_BYTES) {
    throw new ValidationError("Image trop lourde : 2 Mo au plus.", {
      photo: ["Image trop lourde : 2 Mo au plus."],
    });
  }

  const signature = SIGNATURES[type];
  if (!signature.every((byte, index) => buffer[index] === byte)) {
    throw new ValidationError("Le contenu ne correspond pas à une image JPG ou PNG.", {
      photo: ["Le contenu ne correspond pas à une image JPG ou PNG."],
    });
  }

  return { type, buffer };
}

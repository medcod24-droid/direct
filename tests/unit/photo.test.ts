import { describe, expect, it } from "vitest";
import { ValidationError } from "@/lib/errors";
import { MAX_PHOTO_BYTES, parsePhotoDataUrl } from "@/lib/clients/photo";

/**
 * Photo ou logo envoyé avec la fiche, en data URL.
 *
 * Le type annoncé par le navigateur n'est qu'une déclaration : c'est le contenu
 * qui décide. Un PDF renommé en image ne doit pas passer.
 */
const PNG_1PX =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
const JPEG_HEAD = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);

describe("photo du dossier", () => {
  it("accepte un PNG et un JPEG", () => {
    const png = parsePhotoDataUrl(`data:image/png;base64,${PNG_1PX}`);
    expect(png.type).toBe("image/png");
    expect(png.buffer.length).toBeGreaterThan(0);

    const jpeg = parsePhotoDataUrl(`data:image/jpeg;base64,${JPEG_HEAD.toString("base64")}`);
    expect(jpeg.type).toBe("image/jpeg");
  });

  it("refuse un contenu qui n'est pas l'image annoncée", () => {
    const pdf = Buffer.from("%PDF-1.4\n").toString("base64");
    expect(() => parsePhotoDataUrl(`data:image/png;base64,${pdf}`)).toThrow(ValidationError);
    expect(() => parsePhotoDataUrl(`data:image/jpeg;base64,${PNG_1PX}`)).toThrow(ValidationError);
  });

  it("refuse les autres formats et ce qui n'est pas une data URL", () => {
    expect(() => parsePhotoDataUrl("data:image/svg+xml;base64,PHN2Zz4=")).toThrow(ValidationError);
    expect(() => parsePhotoDataUrl("https://exemple.ma/logo.png")).toThrow(ValidationError);
    expect(() => parsePhotoDataUrl("")).toThrow(ValidationError);
  });

  it("refuse une image trop lourde", () => {
    const big = Buffer.alloc(MAX_PHOTO_BYTES + 1);
    big.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(() => parsePhotoDataUrl(`data:image/png;base64,${big.toString("base64")}`)).toThrow(
      "2 Mo",
    );
  });
});

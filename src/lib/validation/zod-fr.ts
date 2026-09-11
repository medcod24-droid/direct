import { z, ZodIssueCode, type ZodErrorMap } from "zod";

/**
 * Messages de validation par défaut, en français.
 *
 * Les schémas portent leurs propres messages là où ils comptent (« ICE : 15
 * chiffres »), mais un champ sans message explicite renvoyait celui de Zod —
 * « Required », « Expected number, received nan » — que le comptable lisait tel
 * quel sous le champ. Cette table ne remplace aucun message explicite : Zod ne la
 * consulte qu'à défaut.
 */
const frenchErrorMap: ZodErrorMap = (issue) => {
  switch (issue.code) {
    case ZodIssueCode.invalid_type:
      if (issue.received === "undefined" || issue.received === "null") {
        return { message: "Champ requis." };
      }
      if (issue.expected === "number" || issue.expected === "bigint") {
        return { message: "Nombre invalide." };
      }
      if (issue.expected === "date") return { message: "Date invalide." };
      return { message: "Valeur invalide." };
    case ZodIssueCode.invalid_date:
      return { message: "Date invalide." };
    case ZodIssueCode.too_small:
      if (issue.type === "string") {
        return {
          message: Number(issue.minimum) <= 1 ? "Champ requis." : `Au moins ${issue.minimum} caractères.`,
        };
      }
      if (issue.type === "number") return { message: `Valeur minimale : ${issue.minimum}.` };
      if (issue.type === "array") return { message: `Au moins ${issue.minimum} ligne(s).` };
      return { message: "Valeur trop petite." };
    case ZodIssueCode.too_big:
      if (issue.type === "string") return { message: `${issue.maximum} caractères au plus.` };
      if (issue.type === "number") return { message: `Valeur maximale : ${issue.maximum}.` };
      if (issue.type === "array") return { message: `${issue.maximum} lignes au plus.` };
      return { message: "Valeur trop grande." };
    case ZodIssueCode.invalid_enum_value:
      return { message: "Choix invalide." };
    case ZodIssueCode.invalid_string:
      if (issue.validation === "email") return { message: "Adresse e-mail invalide." };
      if (issue.validation === "url") return { message: "Adresse web invalide." };
      return { message: "Format invalide." };
    case ZodIssueCode.not_multiple_of:
      return { message: "Valeur invalide." };
    default:
      return { message: "Valeur invalide." };
  }
};

z.setErrorMap(frenchErrorMap);

export { frenchErrorMap };

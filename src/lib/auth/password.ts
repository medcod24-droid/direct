import bcrypt from "bcryptjs";
import { ValidationError } from "@/lib/errors";

const ROUNDS = 12;
const MIN_LENGTH = 12;

/** Mots de passe trop courants, refusés quelle que soit leur complexité. */
const BLOCKLIST = new Set([
  "motdepasse123", "password1234", "azerty123456", "123456789012",
  "daftar123456", "administrateur", "comptable2026",
]);

export function assertPasswordPolicy(password: string, email?: string): void {
  const errors: string[] = [];
  if (password.length < MIN_LENGTH) errors.push(`Au moins ${MIN_LENGTH} caractères.`);
  if (!/[a-z]/.test(password)) errors.push("Au moins une minuscule.");
  if (!/[A-Z]/.test(password)) errors.push("Au moins une majuscule.");
  if (!/[0-9]/.test(password)) errors.push("Au moins un chiffre.");
  if (BLOCKLIST.has(password.toLowerCase())) errors.push("Ce mot de passe est trop courant.");
  const localPart = email?.split("@")[0]?.toLowerCase() ?? "";
  // Une partie locale très courte rendrait la règle absurde (elle rejetterait tout).
  if (localPart.length >= 3 && password.toLowerCase().includes(localPart))
    errors.push("Le mot de passe ne doit pas contenir votre identifiant.");
  if (errors.length) throw new ValidationError(errors.join(" "), { password: errors });
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Erreurs applicatives. Le message `publicMessage` est le seul texte montré à
 * l'utilisateur : aucune trace technique ne doit fuiter en production.
 */
export class AppError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly publicMessage: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class UnauthenticatedError extends AppError {
  constructor(message = "Session absente ou expirée") {
    super(message, 401, "unauthenticated", "Votre session a expiré. Reconnectez-vous.");
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Autorisation refusée", publicMessage = "Vous n'avez pas l'autorisation d'accéder à cet élément.") {
    super(message, 403, "forbidden", publicMessage);
  }
}

export class NotFoundError extends AppError {
  constructor(resource = "ressource") {
    super(`${resource} introuvable`, 404, "not_found", "Cet élément n'existe pas ou n'est plus accessible.");
  }
}

export class ValidationError extends AppError {
  constructor(
    message: string,
    readonly fieldErrors: Record<string, string[]> = {},
  ) {
    super(message, 422, "validation", message);
  }
}

export class LimitExceededError extends AppError {
  constructor(publicMessage: string) {
    super("Limite du plan atteinte", 402, "limit_exceeded", publicMessage);
  }
}

export class RateLimitError extends AppError {
  constructor(publicMessage = "Trop de tentatives. Réessayez dans quelques minutes.") {
    super("Rate limit", 429, "rate_limited", publicMessage);
  }
}

/** Convertit n'importe quelle erreur en réponse sûre pour l'utilisateur. */
export function toPublicError(error: unknown): { status: number; code: string; message: string } {
  if (error instanceof AppError) {
    return { status: error.status, code: error.code, message: error.publicMessage };
  }
  return {
    status: 500,
    code: "internal",
    message: "Une erreur inattendue s'est produite. Réessayez ou contactez le support.",
  };
}

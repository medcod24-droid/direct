import type { MailMessage } from "./send";

/**
 * Courriels du cabinet.
 *
 * Mise en page sobre et styles en ligne : les clients de messagerie ignorent les
 * feuilles de style et les images distantes. Les couleurs sont celles de la
 * plateforme — vert profond, or — écrites en dur ici, car un courriel ne lit pas
 * les jetons CSS de l'application.
 *
 * Chaque message porte sa version texte : elle n'est pas un repli, c'est elle
 * que lisent les messageries d'entreprise qui bloquent le HTML.
 */
const VERT = "#0e6a59";
const ENCRE = "#0b1a16";
const MUET = "#5d7873";

function page(titre: string, corps: string, pied: string): string {
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;background:#f2f6f4;padding:24px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${ENCRE}">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #d3e0dc;border-radius:14px;overflow:hidden">
    <div style="background:${ENCRE};padding:18px 24px">
      <span style="color:#ffffff;font-size:15px;font-weight:600;letter-spacing:.04em">DIRECT CONSEIL</span>
    </div>
    <div style="padding:24px">
      <h1 style="margin:0 0 12px;font-size:19px;line-height:1.3">${titre}</h1>
      ${corps}
    </div>
    <div style="padding:14px 24px;border-top:1px solid #d3e0dc;color:${MUET};font-size:12px;line-height:1.5">
      ${pied}
    </div>
  </div>
</body></html>`;
}

function bouton(url: string, libelle: string): string {
  return `<p style="margin:20px 0"><a href="${url}" style="display:inline-block;background:${VERT};color:#ffffff;text-decoration:none;padding:11px 18px;border-radius:10px;font-weight:600">${libelle}</a></p>
<p style="margin:0 0 4px;color:${MUET};font-size:12px">Si le bouton ne fonctionne pas, copiez cette adresse dans votre navigateur :</p>
<p style="margin:0;font-size:12px;word-break:break-all"><a href="${url}" style="color:${VERT}">${url}</a></p>`;
}

const PIED_CABINET =
  "Vous recevez ce message parce qu'un compte a été ouvert à votre adresse sur Direct Conseil, la plateforme de gestion de votre cabinet comptable.";

/** Inscription d'un cabinet : le compte vient d'être créé par la personne elle-même. */
export function bienvenueCabinet(input: {
  nom: string;
  cabinet: string;
  email: string;
  lienConnexion: string;
}): MailMessage {
  const titre = `Votre cabinet est enregistré sur Direct Conseil`;
  const corps = `<p style="margin:0 0 12px;line-height:1.6">Bonjour ${input.nom},</p>
<p style="margin:0 0 12px;line-height:1.6">Le cabinet <strong>${input.cabinet}</strong> est enregistré sur Direct Conseil. Vous vous connectez avec l'adresse <strong>${input.email}</strong> et le mot de passe que vous venez de choisir.</p>
${bouton(input.lienConnexion, "Ouvrir mon cabinet")}`;

  return {
    to: input.email,
    subject: titre,
    html: page(titre, corps, PIED_CABINET),
    text: `Bonjour ${input.nom},

Le cabinet ${input.cabinet} est enregistré sur Direct Conseil.
Vous vous connectez avec l'adresse ${input.email} et le mot de passe que vous venez de choisir.

${input.lienConnexion}

${PIED_CABINET}`,
  };
}

/** Compte ouvert par l'administration du cabinet pour un collaborateur. */
export function bienvenueCollaborateur(input: {
  nom: string;
  cabinet: string;
  email: string;
  lienConnexion: string;
  lienMotDePasse: string;
}): MailMessage {
  const titre = `Un compte vous a été ouvert sur Direct Conseil`;
  const corps = `<p style="margin:0 0 12px;line-height:1.6">Bonjour ${input.nom},</p>
<p style="margin:0 0 12px;line-height:1.6">Le cabinet <strong>${input.cabinet}</strong> vous a ouvert un compte sur Direct Conseil, à l'adresse <strong>${input.email}</strong>. Le mot de passe initial vous est communiqué par votre administration.</p>
${bouton(input.lienConnexion, "Me connecter")}
<p style="margin:16px 0 0;line-height:1.6;font-size:13px;color:${MUET}">Vous ne l'avez pas reçu ? Définissez le vôtre depuis <a href="${input.lienMotDePasse}" style="color:${VERT}">mot de passe oublié</a>.</p>`;

  return {
    to: input.email,
    subject: titre,
    html: page(titre, corps, PIED_CABINET),
    text: `Bonjour ${input.nom},

Le cabinet ${input.cabinet} vous a ouvert un compte sur Direct Conseil, à l'adresse ${input.email}.
Le mot de passe initial vous est communiqué par votre administration.

Connexion : ${input.lienConnexion}
Mot de passe oublié : ${input.lienMotDePasse}

${PIED_CABINET}`,
  };
}

/** Réinitialisation demandée depuis l'écran de connexion. */
export function reinitialisationMotDePasse(input: {
  nom: string;
  email: string;
  lien: string;
  minutes: number;
}): MailMessage {
  const titre = "Réinitialiser votre mot de passe";
  const pied = `Vous n'avez rien demandé ? Ignorez ce message : votre mot de passe actuel reste valable, et ce lien expirera seul.`;
  const corps = `<p style="margin:0 0 12px;line-height:1.6">Bonjour ${input.nom},</p>
<p style="margin:0 0 12px;line-height:1.6">Voici le lien qui vous permet de choisir un nouveau mot de passe. Il est valable <strong>${input.minutes} minutes</strong> et ne sert qu'une fois.</p>
${bouton(input.lien, "Choisir un nouveau mot de passe")}`;

  return {
    to: input.email,
    subject: titre,
    html: page(titre, corps, pied),
    text: `Bonjour ${input.nom},

Voici le lien qui vous permet de choisir un nouveau mot de passe.
Il est valable ${input.minutes} minutes et ne sert qu'une fois.

${input.lien}

${pied}`,
  };
}

/** Confirmation après changement : c'est le signal d'alerte si l'utilisateur n'y est pour rien. */
export function motDePasseChange(input: { nom: string; email: string; lienConnexion: string }): MailMessage {
  const titre = "Votre mot de passe a été changé";
  const pied =
    "Ce n'était pas vous ? Changez-le immédiatement depuis « mot de passe oublié » et prévenez l'administration de votre cabinet.";
  const corps = `<p style="margin:0 0 12px;line-height:1.6">Bonjour ${input.nom},</p>
<p style="margin:0 0 12px;line-height:1.6">Le mot de passe de votre compte Direct Conseil vient d'être modifié. Toutes les sessions ouvertes ont été fermées.</p>
${bouton(input.lienConnexion, "Me reconnecter")}`;

  return {
    to: input.email,
    subject: titre,
    html: page(titre, corps, pied),
    text: `Bonjour ${input.nom},

Le mot de passe de votre compte Direct Conseil vient d'être modifié.
Toutes les sessions ouvertes ont été fermées.

${input.lienConnexion}

${pied}`,
  };
}

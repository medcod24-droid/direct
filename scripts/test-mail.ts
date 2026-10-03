/**
 * Essai d'envoi réel.
 *
 *   npm run mail:test -- vous@exemple.ma
 *
 * Il part par le transport configuré dans `.env` (ou dans l'environnement du
 * serveur), sans passer par l'application : c'est le moyen le plus court de
 * savoir si une clé, un expéditeur et un domaine sont acceptés par le
 * fournisseur — avant de chercher pourquoi un courriel de bienvenue n'arrive pas.
 */
import { env } from "../src/lib/env";
import { mailStatus, sendMail } from "../src/lib/mail/send";

async function main() {
  const destinataire = process.argv[2];
  if (!destinataire) {
    console.error("Usage : npm run mail:test -- adresse@exemple.ma");
    process.exit(1);
  }

  const config = env();
  console.log(`Fournisseur : ${config.EMAIL_PROVIDER}`);
  console.log(`Expéditeur  : ${config.EMAIL_FROM}`);
  console.log(`État        : ${mailStatus()}`);
  console.log(`Destinataire: ${destinataire}`);

  const envoye = await sendMail({
    to: destinataire,
    subject: "Essai d'envoi — Direct Conseil",
    html: `<p style="font-family:system-ui,sans-serif">Cet essai confirme que Direct Conseil peut envoyer des courriels avec la configuration en cours.</p>`,
    text: "Cet essai confirme que Direct Conseil peut envoyer des courriels avec la configuration en cours.",
  });

  if (envoye) {
    console.log("\nMessage remis au fournisseur. S'il n'arrive pas, regardez les indésirables,");
    console.log("puis le tableau de bord du fournisseur : c'est lui qui dit s'il a été rejeté.");
  } else {
    console.error("\nÉchec : la cause est indiquée au-dessus (clé absente, expéditeur refusé…).");
    process.exit(1);
  }
}

void main();

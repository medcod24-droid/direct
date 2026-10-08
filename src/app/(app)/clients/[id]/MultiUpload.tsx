"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { uploadDocumentAction } from "@/app/actions/app";
import { Alert, Button, Modal } from "@/components/ui";

/** Limite du serveur (MAX_UPLOAD_MB) : autant la dire avant l'envoi. */
const MAX_MO = 25;

/**
 * Dépôt de plusieurs pièces en une fois.
 *
 * Les fichiers partent **un par un**, pas en un seul envoi : la limite de
 * taille d'une requête est vite atteinte avec quelques PDF, et un lot entier
 * échouerait à cause d'un seul fichier. Chaque échec est nommé, les autres
 * passent, et le compteur dit où l'on en est — un dépôt de vingt pièces sans
 * retour visible est indistinguable d'un écran figé.
 */
export function MultiUpload({ clientId, categoryId }: { clientId: string; categoryId?: string }) {
  const input = useRef<HTMLInputElement | null>(null);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [envoi, setEnvoi] = useState<{ faits: number; total: number } | null>(null);
  const [echecs, setEchecs] = useState<string[]>([]);
  const [deposes, setDeposes] = useState(0);

  const tropLourds = files.filter((file) => file.size > MAX_MO * 1024 * 1024);
  const occupe = envoi !== null;

  function fermer() {
    if (occupe) return;
    setOpen(false);
    setFiles([]);
    setEchecs([]);
    setDeposes(0);
  }

  async function deposer() {
    setEchecs([]);
    setDeposes(0);
    const rates: string[] = [];
    let reussis = 0;

    for (const [index, file] of files.entries()) {
      setEnvoi({ faits: index, total: files.length });
      const form = new FormData();
      form.set("clientId", clientId);
      if (categoryId) form.set("categoryId", categoryId);
      form.set("file", file);

      const resultat = await uploadDocumentAction({}, form);
      if (resultat.error) rates.push(`${file.name} — ${resultat.error}`);
      else reussis += 1;
    }

    setEnvoi(null);
    setEchecs(rates);
    setDeposes(reussis);
    setFiles([]);
    if (input.current) input.current.value = "";
    // La liste du dossier est rendue côté serveur : elle ne se met à jour qu'ici.
    router.refresh();
  }

  return (
    <>
      <Button variant="secondary" size="sm" iconName="upload" onClick={() => setOpen(true)}>
        Déposer des fichiers
      </Button>

      <Modal open={open} onClose={fermer} title="Déposer plusieurs documents" size="lg">
        <div className="grid gap-3">
          {deposes > 0 && echecs.length === 0 ? (
            <Alert tone="success">
              {deposes} document{deposes > 1 ? "s" : ""} déposé{deposes > 1 ? "s" : ""}.
            </Alert>
          ) : null}
          {echecs.length > 0 ? (
            <Alert tone="danger" title={`${echecs.length} fichier(s) refusé(s)`}>
              <ul className="grid gap-0.5">
                {echecs.map((echec) => (
                  <li key={echec}>{echec}</li>
                ))}
              </ul>
            </Alert>
          ) : null}

          <div className="grid gap-1.5">
            <p className="text-sm font-650 text-ink">Fichiers</p>
            <p className="text-xs text-muted">
              PDF, images, Excel ou Word. Sélectionnez-en autant que nécessaire, {MAX_MO} Mo par
              fichier au plus. Ils partent les uns après les autres.
            </p>
            <input
              ref={input}
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.xls,.xlsx,.doc,.docx"
              disabled={occupe}
              onChange={(event) => {
                setFiles([...(event.target.files ?? [])]);
                setEchecs([]);
                setDeposes(0);
              }}
              className="text-sm file:me-3 file:rounded-control file:border file:border-line file:bg-surface2 file:px-3 file:py-1.5 file:text-sm file:text-ink"
            />
          </div>

          {files.length > 0 ? (
            <ul className="max-h-56 overflow-y-auto rounded-card border border-line divide-y divide-line">
              {files.map((file) => (
                <li
                  key={`${file.name}-${file.size}`}
                  className="flex items-center justify-between gap-3 px-3 py-1.5 text-sm"
                >
                  <span className="min-w-0 truncate">{file.name}</span>
                  <span
                    className={`shrink-0 text-xs tabular ${
                      file.size > MAX_MO * 1024 * 1024 ? "text-danger" : "text-muted"
                    }`}
                  >
                    {Math.max(1, Math.round(file.size / 1024))} Ko
                  </span>
                </li>
              ))}
            </ul>
          ) : null}

          {tropLourds.length > 0 ? (
            <Alert tone="warning" title="Fichiers trop lourds">
              {tropLourds.map((file) => file.name).join(", ")} dépasse{tropLourds.length > 1 ? "nt" : ""}{" "}
              {MAX_MO} Mo et sera{tropLourds.length > 1 ? "ont" : ""} refusé
              {tropLourds.length > 1 ? "s" : ""} par le serveur.
            </Alert>
          ) : null}

          {envoi ? (
            <p className="text-sm text-ink2 tabular" aria-live="polite">
              Envoi en cours : {envoi.faits} sur {envoi.total} déposé(s)…
            </p>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" disabled={occupe} onClick={fermer}>
              {deposes > 0 ? "Fermer" : "Annuler"}
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={occupe || files.length === 0}
              onClick={() => void deposer()}
            >
              {occupe
                ? "Envoi…"
                : `Déposer ${files.length > 0 ? files.length : ""} fichier${files.length > 1 ? "s" : ""}`}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

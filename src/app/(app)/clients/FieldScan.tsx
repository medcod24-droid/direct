"use client";

import { useRef, useState, useTransition } from "react";
import { uploadFieldScanAction } from "@/app/actions/app";

export type ScanInfo = { id: string; filename: string };

export type FieldScanProps = {
  /** Dossier concerné ; absent tant que le dossier n'est pas créé. */
  clientId: string | null;
  /** Champ justifié : « cin », « rc:<id> »… */
  fieldKey: string;
  /** Justificatif déjà déposé pour ce champ, s'il y en a un. */
  current?: ScanInfo;
};

/**
 * Dépôt du justificatif d'un champ, à côté du champ lui-même.
 *
 * L'envoi part dès le choix du fichier, sans attendre l'enregistrement de la
 * fiche, et l'action serveur est appelée directement plutôt que par un
 * formulaire : ces champs vivent à l'intérieur du formulaire de la fiche, et un
 * `<form>` imbriqué est interdit en HTML — le navigateur l'ignore
 * silencieusement, et rien n'était envoyé. Les ajouter au formulaire principal
 * n'était pas une option non plus : une dizaine de scans dans une même
 * soumission auraient fait un corps de requête de plusieurs centaines de
 * mégaoctets, et un refus aurait emporté toute la saisie.
 *
 * Rien ne s'affiche tant que le dossier n'existe pas : un document a besoin d'un
 * dossier auquel se rattacher. Le comptable enregistre d'abord, puis revient
 * déposer les pièces — ce qui est de toute façon l'usage, les scans arrivant
 * rarement en même temps que la saisie.
 */
export function FieldScan({ clientId, fieldKey, current }: FieldScanProps) {
  const [pending, startTransition] = useTransition();
  const [scan, setScan] = useState<ScanInfo | undefined>(current);
  const [error, setError] = useState<string | undefined>();
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = `scan-${fieldKey.replace(/[^a-zA-Z0-9]/g, "-")}`;

  if (!clientId) return null;

  const send = (file: File) => {
    setError(undefined);
    const form = new FormData();
    form.set("clientId", clientId);
    form.set("fieldKey", fieldKey);
    form.set("file", file);

    startTransition(async () => {
      const result = await uploadFieldScanAction(form);
      if (result.ok && result.document) setScan(result.document);
      else setError(result.error ?? "Dépôt refusé.");
      // Vidé pour que le même fichier puisse être redéposé après une erreur.
      if (inputRef.current) inputRef.current.value = "";
    });
  };

  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
      {scan ? (
        <a
          href={`/api/documents/${scan.id}/download`}
          className="text-accent underline underline-offset-2 hover:no-underline"
        >
          {scan.filename}
        </a>
      ) : (
        <span className="text-muted">Aucun justificatif</span>
      )}

      {/* Sans `name`, le champ n'est pas embarqué dans la soumission de la fiche.
          Masqué visuellement seulement : un `display: none` empêcherait le clic
          sur l'étiquette d'ouvrir le sélecteur de fichier. */}
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        className="sr-only"
        disabled={pending}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) send(file);
        }}
      />
      <label
        htmlFor={inputId}
        className="cursor-pointer rounded px-1 text-ink2 underline underline-offset-2 hover:text-ink"
      >
        {pending ? "Envoi…" : scan ? "Remplacer" : "Joindre un scan"}
      </label>

      {error ? <span className="text-danger">{error}</span> : null}
    </div>
  );
}

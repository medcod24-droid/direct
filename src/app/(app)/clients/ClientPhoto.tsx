"use client";

import { useRef, useState } from "react";
import { Button, Icon } from "@/components/ui";
import type { ScanInfo } from "./FieldScan";

/** Côté le plus long après réduction : assez pour un tirage de 4 cm, léger à envoyer. */
const MAX_SIDE = 640;

/**
 * Photo ou logo du dossier.
 *
 * Logo pour une société, photo pour une personne : elle identifie le dossier à
 * l'écran et s'imprime en tête de la fiche. L'image est réduite ici, dans le
 * navigateur, puis envoyée avec le formulaire dans un champ caché — ce qui
 * permet de la joindre dès la création du dossier. La transparence d'un logo PNG
 * est conservée ; une photo part en JPEG.
 */
export function ClientPhoto({
  clientId,
  current,
  error,
}: {
  clientId: string | null;
  current?: ScanInfo;
  error?: string;
}) {
  const input = useRef<HTMLInputElement | null>(null);
  const saved = clientId && current ? `/api/clients/${clientId}/photo?v=${current.id}` : null;
  const [data, setData] = useState("");
  const [removed, setRemoved] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const preview = data || (removed ? null : saved);

  async function choose(file: File | undefined) {
    if (!file) return;
    setProblem(null);
    setBusy(true);
    try {
      setData(await shrink(file));
      setRemoved(false);
    } catch {
      setProblem("Image illisible : choisissez une photo JPG ou PNG.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="grid h-24 w-20 shrink-0 place-items-center overflow-hidden rounded-control border border-dashed border-line bg-surface2">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element -- image privée, servie par une route authentifiée
          <img src={preview} alt="Photo ou logo du dossier" className="h-full w-full object-contain" />
        ) : (
          <span className="grid justify-items-center gap-1 text-muted">
            <Icon name="clients" size={20} />
            <span className="text-2xs">Aucune</span>
          </span>
        )}
      </div>

      <div className="grid min-w-0 flex-1 gap-1.5">
        <p className="text-sm font-650 text-ink">Photo ou logo</p>
        <p className="text-xs text-muted">
          Logo de la société ou photo de la personne : elle identifie le dossier et s&apos;imprime
          sur la fiche. Sans image, la fiche garde un cadre vide pour y coller une photo.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            iconName="upload"
            disabled={busy}
            onClick={() => input.current?.click()}
          >
            {busy ? "Préparation…" : preview ? "Remplacer" : "Choisir une image"}
          </Button>
          {preview ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setData("");
                setRemoved(Boolean(saved));
              }}
            >
              Retirer
            </Button>
          ) : null}
          {removed ? <span className="text-xs text-muted">Retirée à l&apos;enregistrement.</span> : null}
        </div>
        {problem || error ? <p className="text-xs text-danger">{problem ?? error}</p> : null}
      </div>

      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        tabIndex={-1}
        aria-label="Photo ou logo du dossier"
        onChange={(event) => void choose(event.target.files?.[0])}
      />
      <input type="hidden" name="photoData" value={data} />
      <input type="hidden" name="photoRemove" value={removed && !data ? "1" : ""} />
    </div>
  );
}

/** Réduit l'image à `MAX_SIDE` et la rend en data URL, PNG si elle peut être transparente. */
async function shrink(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("image illisible"));
      element.src = url;
    });
    const scale = Math.min(1, MAX_SIDE / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("canvas indisponible");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const transparent = file.type === "image/png" || file.type === "image/webp";
    return transparent ? canvas.toDataURL("image/png") : canvas.toDataURL("image/jpeg", 0.88);
  } finally {
    URL.revokeObjectURL(url);
  }
}

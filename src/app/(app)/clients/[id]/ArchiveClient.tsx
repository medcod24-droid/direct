"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { archiveClientAction } from "@/app/actions/app";
import { Alert, Button, Modal } from "@/components/ui";

/**
 * Archivage d'un dossier.
 *
 * Le dossier sort des listes et ne génère plus d'échéances, mais rien n'est
 * effacé : documents, factures et historique restent consultables, ce que la
 * confirmation dit explicitement — un cabinet a l'obligation de conserver.
 */
export function ArchiveClient({ clientId, legalName }: { clientId: string; legalName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        Archiver
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Archiver ce dossier ?"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button
              variant="danger"
              disabled={pending}
              onClick={() => {
                setError(null);
                start(async () => {
                  const result = await archiveClientAction(clientId);
                  if (result.error) setError(result.error);
                  else {
                    setOpen(false);
                    router.push("/clients");
                  }
                });
              }}
            >
              {pending ? "Archivage…" : "Archiver le dossier"}
            </Button>
          </>
        }
      >
        {error ? (
          <div className="mb-3">
            <Alert tone="danger">{error}</Alert>
          </div>
        ) : null}
        <p>
          <strong>{legalName}</strong> sortira des listes et cessera de générer des échéances.
        </p>
        <p className="mt-2 text-xs text-muted">
          Rien n&apos;est supprimé : documents, honoraires et historique restent conservés et
          consultables. À utiliser quand le cabinet ne suit plus le dossier.
        </p>
      </Modal>
    </>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { EditPencil, Plus, Trash } from "iconoir-react";
import { Alert, Button, Dialog, Text, TextField } from "../../../ui";
import { ConfirmationToast } from "../../../app/components/confirmation-toast";
import { panelRequest } from "../../../app/backoffice/panel-request";

type Table = { id: string; name: string; status: "active" | "archived" };

export function LocationTables({
  location,
}: {
  location: { id: string; name: string };
}) {
  const [isOpen, setIsOpen] = useState(true);
  const onClose = () => setIsOpen(false);
  const url = `/api/modules/tables/locations/${encodeURIComponent(location.id)}`;
  const [tables, setTables] = useState<Table[] | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<{
    id: string | null;
    name: string;
  } | null>(null);
  const [removing, setRemoving] = useState<Table | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const locked = useRef(false);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    let active = true;
    setError(null);
    void panelRequest<{ tables: Table[] }>(url)
      .then((data) => {
        if (active)
          setTables(data.tables.filter((table) => table.status === "active"));
      })
      .catch((cause: unknown) => {
        if (active)
          setError(
            cause instanceof Error
              ? cause.message
              : "No pudimos cargar las mesas.",
          );
      });
    return () => {
      active = false;
    };
  }, [url, attempt]);

  async function save(archive: boolean) {
    if (
      locked.current ||
      !tables ||
      (archive ? !removing : !draft?.name.trim())
    )
      return;
    locked.current = true;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const { table } = await panelRequest<{ table: Table }>(
        archive
          ? `${url}/${encodeURIComponent(removing!.id)}/status`
          : draft!.id
            ? `${url}/${encodeURIComponent(draft!.id)}`
            : url,
        archive || !draft?.id ? "POST" : "PATCH",
        archive ? { status: "archived" } : { name: draft!.name.trim() },
      );
      if (!mounted.current) return;
      setTables((current) => {
        const next = current?.some((item) => item.id === table.id)
          ? current.map((item) => (item.id === table.id ? table : item))
          : [...(current ?? []), table];
        return next.filter((item) => item.status === "active");
      });
      setDraft(null);
      setRemoving(null);
      setNotice(
        archive
          ? "Mesa quitada"
          : draft?.id
            ? "Mesa actualizada"
            : "Mesa añadida",
      );
    } catch (cause) {
      if (mounted.current)
        setError(
          cause instanceof Error
            ? cause.message
            : "No pudimos guardar la mesa.",
        );
    } finally {
      locked.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <>
      <Dialog
        isOpen={isOpen}
        onOpenChange={(open) => {
          if (!open && !locked.current) onClose();
        }}
        isDismissable={!busy}
        title={`Mesas · ${location.name}`}
      >
        <div className="grid gap-4">
          {error && <Alert kind="error" title={error} />}
          {!tables ? (
            error ? (
              <Button
                variant="secondary"
                onPress={() => setAttempt((value) => value + 1)}
              >
                Reintentar mesas
              </Button>
            ) : (
              <Text>Cargando mesas…</Text>
            )
          ) : (
            <>
              <div className="grid max-h-64 gap-3 overflow-y-auto">
                {!tables.length && (
                  <Text>No hay mesas añadidas en este local.</Text>
                )}
                {tables.map((table) => (
                  <div
                    className="flex items-center justify-between gap-3 border-b border-border pb-3"
                    key={table.id}
                  >
                    <Text className="min-w-0 break-words">{table.name}</Text>
                    <div className="flex shrink-0 gap-2">
                      <Button
                        variant="quiet"
                        aria-label={`Renombrar ${table.name}`}
                        isDisabled={busy}
                        onPress={() => {
                          setError(null);
                          setRemoving(null);
                          setDraft({ id: table.id, name: table.name });
                        }}
                      >
                        <EditPencil aria-hidden="true" className="size-5" />
                      </Button>
                      <Button
                        variant="quiet"
                        className="text-danger!"
                        aria-label={`Quitar ${table.name}`}
                        isDisabled={busy}
                        onPress={() => {
                          setError(null);
                          setDraft(null);
                          setRemoving(table);
                        }}
                      >
                        <Trash aria-hidden="true" className="size-5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              {removing ? (
                <div className="grid gap-3">
                  <Text>
                    ¿Quitar {removing.name}? Las órdenes anteriores se
                    conservan.
                  </Text>
                  <div className="flex flex-wrap gap-3">
                    <Button
                      variant="secondary"
                      isDisabled={busy}
                      onPress={() => {
                        setRemoving(null);
                        setError(null);
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button
                      variant="danger"
                      isLoading={busy}
                      onPress={() => void save(true)}
                    >
                      Confirmar
                    </Button>
                  </div>
                </div>
              ) : draft ? (
                <div className="grid gap-3">
                  <TextField
                    label={draft.id ? "Nuevo nombre de mesa" : "Nombre de mesa"}
                    value={draft.name}
                    maxLength={60}
                    isRequired
                    isDisabled={busy}
                    onChange={(name) => setDraft({ ...draft, name })}
                    autoFocus
                  />
                  <div className="flex flex-wrap gap-3">
                    <Button
                      variant="secondary"
                      isDisabled={busy}
                      onPress={() => {
                        setDraft(null);
                        setError(null);
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button
                      isLoading={busy}
                      isDisabled={!draft.name.trim()}
                      onPress={() => void save(false)}
                    >
                      Confirmar
                    </Button>
                  </div>
                </div>
              ) : (
                <div>
                  <Button
                    variant="secondary"
                    onPress={() => {
                      setError(null);
                      setDraft({ id: null, name: "" });
                    }}
                  >
                    <Plus aria-hidden="true" className="size-5" /> Añadir mesa
                  </Button>
                </div>
              )}
            </>
          )}
          <div className="flex justify-end">
            <Button variant="secondary" isDisabled={busy} onPress={onClose}>
              Cerrar
            </Button>
          </div>
        </div>
      </Dialog>
      <ConfirmationToast message={notice} onDismiss={() => setNotice(null)} />
    </>
  );
}

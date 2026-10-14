"use client";

import { useEffect, useState } from "react";
import { Alert, Button, Text, TextField } from "../../../ui";
import { PosError, posRequest } from "./pos-types";

type PosTable = { id: string; name: string; openOrderId: string | null };
export function usePosTables(
  locationId: string,
  revision: number,
  onError: (cause: unknown) => void,
  enabled = true,
) {
  const [attempt, setAttempt] = useState(0);
  const [snapshot, setSnapshot] = useState<{
    location: string;
    tables: PosTable[] | null;
    error: string | null;
  }>({ location: "", tables: null, error: null });
  useEffect(() => {
    let active = true;
    setSnapshot({ location: locationId, tables: null, error: null });
    if (!locationId || !enabled) return;
    void posRequest<{ tables: PosTable[] }>(
      `/api/modules/pos/tables?locationId=${encodeURIComponent(locationId)}`,
    )
      .then((data) => {
        if (active)
          setSnapshot({
            location: locationId,
            tables: data.tables,
            error: null,
          });
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setSnapshot({
          location: locationId,
          tables: null,
          error:
            cause instanceof Error
              ? cause.message
              : "No pudimos cargar las mesas.",
        });
        if (cause instanceof PosError && [401, 403].includes(cause.status ?? 0))
          onError(cause);
      });
    return () => {
      active = false;
    };
  }, [locationId, revision, attempt, onError, enabled]);
  return {
    enabled,
    tables: !enabled
      ? []
      : snapshot.location === locationId
        ? snapshot.tables
        : null,
    error: enabled && snapshot.location === locationId ? snapshot.error : null,
    retry: () => setAttempt((value) => value + 1),
  };
}

export function tableUnavailable(
  tables: PosTable[] | null,
  tableId: string | null,
  orderId?: string,
) {
  if (!tableId || !tables) return false;
  const table = tables.find((item) => item.id === tableId);
  return !table || !!(table.openOrderId && table.openOrderId !== orderId);
}

export function PosTablePicker({
  tableId,
  name,
  onChange,
  orderId,
  disabled,
  tables,
  error,
  retry,
  enabled,
  hideOccupied = false,
}: {
  tableId: string | null;
  name: string;
  onChange: (id: string | null, name: string) => void;
  orderId?: string;
  disabled: boolean;
  hideOccupied?: boolean;
} & ReturnType<typeof usePosTables>) {
  return (
    <div className="grid gap-3">
      {enabled &&
        (error ? (
          <Alert kind="error" title={error}>
            <Button variant="secondary" isDisabled={disabled} onPress={retry}>
              Reintentar mesas
            </Button>
          </Alert>
        ) : tables === null ? (
          <Text>Cargando mesas…</Text>
        ) : tables.length ? (
          <>
            <Text variant="label">Mesas del local</Text>
            <div className="flex max-h-64 flex-wrap items-start gap-2 overflow-y-auto p-1">
              {tables
                .filter(
                  (table) =>
                    !hideOccupied ||
                    !table.openOrderId ||
                    table.openOrderId === orderId,
                )
                .map((table) => {
                  const occupied = !!(
                    table.openOrderId && table.openOrderId !== orderId
                  );
                  const status = occupied
                    ? "Ocupada"
                    : table.openOrderId
                      ? "En esta orden"
                      : "Libre";
                  return (
                    <Button
                      key={table.id}
                      variant="secondary"
                      className={`max-w-full rounded-full! px-4! py-2! ${tableId === table.id ? "border-accent! bg-accent-soft!" : ""}`}
                      aria-pressed={tableId === table.id}
                      aria-label={`${table.name} · ${status}`}
                      isDisabled={disabled || occupied}
                      onPress={() => onChange(table.id, table.name)}
                    >
                      <Text variant="label" className="min-w-0 break-words">
                        {table.name}
                      </Text>
                      <Text variant="small" className="shrink-0">
                        · {status}
                      </Text>
                    </Button>
                  );
                })}
            </div>
          </>
        ) : (
          <Text>
            No hay mesas añadidas en este local. Puedes escribir un nombre.
          </Text>
        ))}
      {tableUnavailable(tables, tableId, orderId) && (
        <Alert
          kind="error"
          title={
            tables?.length === 0
              ? "La mesa seleccionada ya no está disponible. Escribe un nombre."
              : "La mesa seleccionada ya no está disponible. Elige otra."
          }
        />
      )}
      {tables?.length === 0 && (
        <TextField
          label="Nombre de mesa"
          value={name}
          onChange={(value) => onChange(null, value)}
          maxLength={60}
          isRequired
          isDisabled={disabled}
          placeholder="Ej.: Mesa 4"
        />
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { EditPencil, Package, Plus, Xmark } from "iconoir-react";
import { Alert, Button, Dialog, Text } from "../../../ui";
import { ModuleHeader } from "../../../app/components/ui";
import { StockInputModal } from "./stock-input-modal";
import { StockLogSkeleton } from "./stock-skeleton";
import {
  posRequest,
  type PosSession,
} from "../../../app/backoffice/pos/pos-types";
import { formatAmount, type StockMovement } from "./stock-types";

export function StockLog() {
  const [entries, setEntries] = useState<StockMovement[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [timezone, setTimezone] = useState<string | undefined>();
  const [currency, setCurrency] = useState<string | undefined>();
  useEffect(() => {
    let active = true;
    void posRequest<PosSession>("/api/merchant/session")
      .then((session) => {
        if (active) {
          setTimezone(session.business?.timezone);
          setCurrency(session.business?.currencyCode);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    let active = true;
    void posRequest<{ movements: StockMovement[] }>(
      "/api/modules/stock/movements?limit=200",
    )
      .then((data) => {
        if (active) setEntries(data.movements);
      })
      .catch((cause) => {
        if (active)
          setError(
            cause instanceof Error
              ? cause.message
              : "No pudimos leer el registro.",
          );
      });
    return () => {
      active = false;
    };
  }, [attempt]);
  function reload() {
    setError(null);
    setEntries(null);
    setAttempt((value) => value + 1);
  }
  const dateFormat = new Intl.DateTimeFormat("es", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
  });
  const [menuOpen, setMenuOpen] = useState(false);
  const [registration, setRegistration] = useState<"adjustment" | "new" | null>(
    null,
  );

  function cancel() {
    setRegistration(null);
  }

  return (
    <main className="merchant-shell">
      <div className="brand-page catalog-page grid gap-6">
        <ModuleHeader
          eyebrow="Stock"
          title="Stock"
          description="Consulta los registros de stock de tu negocio."
          closeHref="/backoffice"
        />
        <div className="flex flex-wrap justify-end gap-3">
          <Button
            onPress={() => setMenuOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={menuOpen}
          >
            <Plus className="size-5" aria-hidden="true" />
            Registrar stock
          </Button>
        </div>
        {error && (
          <Alert kind="error" title={error}>
            <Button variant="secondary" onPress={reload}>
              Reintentar registro
            </Button>
          </Alert>
        )}
        {!entries && !error && <StockLogSkeleton />}
        {entries?.length === 0 && (
          <Text variant="muted">
            Todavía no tienes registros. Registra tu primera compra o un conteo
            de stock.
          </Text>
        )}
        <Dialog
          isOpen={menuOpen}
          onOpenChange={setMenuOpen}
          title="Registrar stock"
          headerAction={
            <Button
              variant="quiet"
              aria-label="Cerrar opciones de stock"
              className="close-module size-11 shrink-0 rounded-full! bg-primary-soft! p-0!"
              onPress={() => setMenuOpen(false)}
            >
              <Xmark aria-hidden="true" className="size-6" />
            </Button>
          }
        >
          <div className="grid gap-3">
            <Button
              variant="secondary"
              onPress={() => {
                setMenuOpen(false);
                setRegistration("new");
              }}
            >
              <Package aria-hidden="true" className="size-5" />
              Nuevo stock
            </Button>
            <Button
              variant="secondary"
              onPress={() => {
                setMenuOpen(false);
                setRegistration("adjustment");
              }}
            >
              <EditPencil aria-hidden="true" className="size-5" />
              Ajustar stock
            </Button>
          </div>
        </Dialog>
        {registration && (
          <StockInputModal
            kind={registration}
            onClose={cancel}
            onSaved={() => {
              cancel();
              reload();
            }}
          />
        )}
        {entries && entries.length > 0 && (
          <div
            role="table"
            aria-label="Registros de stock"
            className="overflow-hidden rounded-lg border border-border bg-surface"
          >
            <div role="rowgroup">
              <div
                role="row"
                className="grid grid-cols-3 gap-4 border-b border-border bg-surface-subtle px-4 py-3 md:px-6"
              >
                <div role="columnheader">
                  <Text variant="label">Fecha de creación</Text>
                </div>
                <div role="columnheader" className="col-span-2">
                  <Text variant="label">Resumen</Text>
                </div>
              </div>
            </div>
            <div role="rowgroup">
              {entries.map((entry) => (
                <div
                  role="row"
                  key={entry.id}
                  className="grid grid-cols-3 gap-4 border-b border-border px-4 py-4 last:border-b-0 md:px-6"
                >
                  <div role="cell">
                    <Text variant="muted">
                      {dateFormat.format(new Date(entry.createdAt))}
                    </Text>
                  </div>
                  <div role="cell" className="col-span-2 min-w-0 break-words">
                    <div className="grid gap-1">
                      <Text variant="label">
                        {entry.kind === "purchase" ? "Compra" : "Conteo"} ·{" "}
                        {entry.itemName}
                      </Text>
                      <Text>
                        {formatAmount(
                          entry.kind === "adjustment"
                            ? entry.countedQuantity
                            : entry.quantity,
                        )}{" "}
                        {entry.unit === "unit" ? "unidades" : entry.unit}
                        {entry.kind === "purchase"
                          ? entry.totalCost === null
                            ? " · Sin precio"
                            : ` · Total: ${formatAmount(entry.totalCost)}${currency ? ` ${currency}` : ""}`
                          : " contados"}
                      </Text>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {entries && entries.length >= 200 && (
          <Text variant="small">Se muestran los últimos 200 movimientos.</Text>
        )}
      </div>
    </main>
  );
}

"use client";

import { useState } from "react";
import { EditPencil, Package, Plus, Xmark } from "iconoir-react";
import { Button, Dialog, PageHeader, Text } from "../../../ui";
import { StockInputModal } from "./stock-input-modal";

const examples = [
  {
    id: "example-1",
    date: "2026-10-12T09:30:00-05:00",
    summary: "Harina, huevos, tomates, leche y mantequilla.",
  },
  {
    id: "example-2",
    date: "2026-10-11T16:15:00-05:00",
    summary: "Azúcar, café, chocolate y crema.",
  },
  {
    id: "example-3",
    date: "2026-10-10T10:00:00-05:00",
    summary: "Pollo, queso, cebollas y aceite.",
  },
];

const dateFormat = new Intl.DateTimeFormat("es", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Guayaquil",
});

/** Prototipo visual L1: registros de muestra, sin API ni persistencia. */
export function StockLog() {
  const [entries, setEntries] = useState(examples);
  const [menuOpen, setMenuOpen] = useState(false);
  const [registration, setRegistration] = useState<"adjustment" | "new" | null>(
    null,
  );

  function cancel() {
    setRegistration(null);
  }

  return (
    <main className="merchant-shell">
      <div className="backoffice-home grid gap-6">
        <PageHeader
          title="Stock"
          description="Consulta los registros de stock de tu negocio."
          actions={
            <Button
              onPress={() => setMenuOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={menuOpen}
            >
              <Plus className="size-5" aria-hidden="true" />
              Registrar stock
            </Button>
          }
        />
        <Text variant="small">
          Vista de muestra. Los registros que añadas aquí se borran al recargar.
        </Text>
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
            onRegister={(summary) => {
              setEntries((current) => [
                {
                  id: crypto.randomUUID(),
                  date: new Date().toISOString(),
                  summary,
                },
                ...current,
              ]);
              cancel();
            }}
          />
        )}
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
                    {dateFormat.format(new Date(entry.date))}
                  </Text>
                </div>
                <div role="cell" className="col-span-2 min-w-0 break-words">
                  <Text>{entry.summary}</Text>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}

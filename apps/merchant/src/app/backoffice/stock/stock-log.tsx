"use client";

import { useState } from "react";
import { Plus } from "iconoir-react";
import {
  Button,
  Card,
  Form,
  FormActions,
  Heading,
  PageHeader,
  Text,
  TextAreaField,
} from "../../../ui";

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
  const [adding, setAdding] = useState(false);
  const [summary, setSummary] = useState("");

  function cancel() {
    setAdding(false);
    setSummary("");
  }

  return (
    <main className="merchant-shell">
      <div className="backoffice-home grid gap-6">
        <PageHeader
          title="Stock"
          description="Consulta los registros de stock de tu negocio."
          actions={
            <Button onPress={() => setAdding(true)} isDisabled={adding}>
              <Plus className="size-5" aria-hidden="true" />
              Añadir Stock
            </Button>
          }
        />
        <Text variant="small">
          Vista de muestra. Los registros que añadas aquí se borran al recargar.
        </Text>
        {adding && (
          <Card className="grid gap-4">
            <Heading level={2}>Añadir Stock</Heading>
            <Form
              onSubmit={(event) => {
                event.preventDefault();
                if (!summary.trim()) return;
                setEntries((current) => [
                  {
                    id: crypto.randomUUID(),
                    date: new Date().toISOString(),
                    summary: summary.trim(),
                  },
                  ...current,
                ]);
                cancel();
              }}
            >
              <TextAreaField
                label="Resumen del stock"
                placeholder="Por ejemplo: harina, huevos, tomates…"
                value={summary}
                onChange={setSummary}
                maxLength={500}
                autoFocus
              />
              <FormActions>
                <Button variant="secondary" onPress={cancel}>
                  Cancelar
                </Button>
                <Button type="submit" isDisabled={!summary.trim()}>
                  Añadir a la vista
                </Button>
              </FormActions>
            </Form>
          </Card>
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

"use client";
import { useState } from "react";
import type { MassUnit } from "@mi-pasaporte/domain/measures";
import { Button, Text } from "../../../ui";
import { MeasuredQuantityDialog } from "./measured-quantity-dialog";
import {
  cartLineAmount,
  editorPresentation,
  editQuantity,
  resolveQuantity,
  quantityEditor,
  unitLabel,
  type MeasuredCartLine,
} from "./measured-cart-model";

export function MeasuredCart({
  lines,
  enabledUnits,
  currencyCode,
  busy = false,
  onChange,
}: {
  lines: MeasuredCartLine[];
  enabledUnits: readonly MassUnit[];
  currencyCode: string;
  busy?: boolean;
  onChange: (lines: MeasuredCartLine[]) => void;
}) {
  const [editing, setEditing] = useState<{
    key: string;
    original: MeasuredCartLine;
  } | null>(null);
  const update = (line: MeasuredCartLine) =>
    onChange(lines.map((item) => (item.key === line.key ? line : item)));
  const selected = lines.find((line) => line.key === editing?.key);
  let selectedError: string | undefined;
  if (selected) {
    try {
      cartLineAmount(selected, enabledUnits, currencyCode);
    } catch {
      selectedError =
        "Revisa la cantidad y el límite del importe antes de confirmar.";
    }
  }
  return (
    <>
      <div
        role="region"
        aria-label="Productos del pedido"
        className="grid gap-4"
      >
        {!lines.length && (
          <Text variant="muted">
            El pedido está vacío. Añade un producto para empezar.
          </Text>
        )}
        {lines.map((line, position) => {
          const view = editorPresentation(line.editor);
          let amount: string | undefined;
          try {
            amount = cartLineAmount(line, enabledUnits, currencyCode);
          } catch {
            /* Invalid edits remain visible and cannot become a stale amount. */
          }
          const label = `${line.snapshot.name}, línea ${position + 1}`;
          return (
            <div
              key={line.key}
              role="group"
              aria-label={label}
              className="grid gap-3 border-b border-border pb-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1 break-words">
                  <Text variant="label">{line.snapshot.name}</Text>
                  <Text variant="small">
                    {currencyCode} {line.snapshot.unitPrice.replace(".", ",")}{" "}
                    por {unitLabel(line.snapshot.measure.priceUnit)}
                  </Text>
                </div>
                <Text variant="label" className="shrink-0">
                  {amount === undefined
                    ? "Revisa la cantidad"
                    : `${currencyCode} ${amount.replace(".", ",")}`}
                </Text>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {line.snapshot.measure.kind === "unit" && (
                  <Button
                    variant="secondary"
                    isDisabled={
                      busy ||
                      !amount ||
                      !/^\d+$/.test(view.display) ||
                      BigInt(view.display) <= 1n
                    }
                    aria-label={`Quitar una unidad de ${label}`}
                    onPress={() =>
                      update({
                        ...line,
                        editor: editQuantity(
                          line.editor,
                          String(BigInt(view.display) - 1n),
                        ),
                      })
                    }
                  >
                    Quitar unidad
                  </Button>
                )}
                <Button
                  variant="secondary"
                  isDisabled={busy}
                  aria-label={`Editar cantidad de ${label}`}
                  onPress={() => setEditing({ key: line.key, original: line })}
                >
                  {view.approximate ? "≈ " : ""}
                  {view.display.replace(".", ",") || "Sin cantidad"}{" "}
                  {line.editor.unit === "unit" && view.display !== "1"
                    ? "unidades"
                    : unitLabel(line.editor.unit)}
                </Button>
                {line.snapshot.measure.kind === "unit" && (
                  <Button
                    variant="secondary"
                    isDisabled={busy || !amount}
                    aria-label={`Añadir una unidad de ${label}`}
                    onPress={() =>
                      update({
                        ...line,
                        editor: editQuantity(
                          line.editor,
                          String(BigInt(view.display) + 1n),
                        ),
                      })
                    }
                  >
                    Añadir unidad
                  </Button>
                )}
                <Button
                  variant="quiet"
                  isDisabled={busy}
                  aria-label={`Quitar ${label}`}
                  onPress={() =>
                    onChange(lines.filter((item) => item.key !== line.key))
                  }
                >
                  Quitar
                </Button>
              </div>
            </div>
          );
        })}
      </div>
      {selected && editing && (
        <MeasuredQuantityDialog
          key={selected.key}
          name={selected.snapshot.name}
          editor={selected.editor}
          error={selectedError}
          enabledUnits={enabledUnits}
          onChange={(editor) => update({ ...selected, editor })}
          onConfirm={() => {
            const source = resolveQuantity(selected.editor, enabledUnits);
            update({
              ...selected,
              editor: quantityEditor(source, selected.editor.unit),
            });
            setEditing(null);
          }}
          onCancel={() => {
            update(editing.original);
            setEditing(null);
          }}
        />
      )}
    </>
  );
}

"use client";

import { Plus, Trash } from "iconoir-react";
import { Button, SelectField, Text, TextField } from "../../../ui";
import {
  baseUnit,
  units,
  type EntryUnit,
  type StockItem,
} from "../stock/stock-types";
import { blankIngredient, type RecipeLine } from "./recipe-types";

export function RecipeLines({
  lines,
  items,
  busy,
  onChange,
}: {
  lines: RecipeLine[];
  items: StockItem[];
  busy: boolean;
  onChange: (lines: RecipeLine[]) => void;
}) {
  function patch(key: string, value: Partial<RecipeLine>) {
    onChange(
      lines.map((line) => (line.key === key ? { ...line, ...value } : line)),
    );
  }
  return (
    <div className="grid gap-4">
      {lines.map((line, index) => {
        const existing = items.find((item) => item.id === line.itemId);
        return (
          <div
            key={line.key}
            className="grid gap-3 border-b border-border pb-4"
          >
            <div className="flex items-center justify-between gap-3">
              <Text variant="label">
                Ingrediente {index + 1}
                {!line.itemId && line.name.trim()
                  ? " · Insumo nuevo"
                  : existing?.status === "archived"
                    ? " · Archivado"
                    : ""}
              </Text>
              <Button
                variant="quiet"
                aria-label={`Quitar ingrediente ${index + 1}`}
                isDisabled={busy}
                onPress={() =>
                  onChange(lines.filter((entry) => entry.key !== line.key))
                }
              >
                <Trash aria-hidden="true" className="size-5" />
              </Button>
            </div>
            <SelectField
              label="Insumo"
              options={[
                { id: "new", label: "Crear insumo nuevo" },
                ...items
                  .filter(
                    (item) =>
                      item.status === "active" || item.id === line.itemId,
                  )
                  .map((item) => ({
                    id: item.id,
                    label:
                      item.name +
                      (item.status === "archived" ? " (archivado)" : ""),
                  })),
              ]}
              selectedKey={line.itemId ?? "new"}
              isDisabled={busy}
              onSelectionChange={(id) => {
                if (id === null) return;
                const item = items.find((item) => item.id === id);
                patch(line.key, {
                  itemId: item?.id ?? null,
                  name: item?.name ?? "",
                  unit: item?.unit ?? "g",
                });
              }}
            />
            {!line.itemId && (
              <TextField
                label="Nombre del insumo nuevo"
                value={line.name}
                onChange={(name) => patch(line.key, { name })}
                maxLength={80}
                isDisabled={busy}
              />
            )}
            <div className="grid grid-cols-2 gap-3">
              <TextField
                label="Cantidad por unidad del producto"
                inputMode="decimal"
                value={line.quantity}
                onChange={(quantity) => patch(line.key, { quantity })}
                placeholder={line.quantity ? undefined : "Completa la cantidad"}
                isDisabled={busy}
              />
              <SelectField
                label="Unidad"
                options={units.filter(
                  (unit) =>
                    !existing ||
                    baseUnit(unit.id as EntryUnit) === existing.unit,
                )}
                selectedKey={line.unit}
                onSelectionChange={(unit) => {
                  if (unit !== null)
                    patch(line.key, { unit: unit as EntryUnit });
                }}
                isDisabled={busy}
              />
            </div>
            {line.sourceText && (
              <Text variant="small">Texto original: {line.sourceText}</Text>
            )}
          </div>
        );
      })}
      <div>
        <Button
          variant="secondary"
          isDisabled={busy || lines.length >= 50}
          onPress={() =>
            onChange([...lines, blankIngredient(crypto.randomUUID())])
          }
        >
          <Plus aria-hidden="true" className="size-5" />
          Añadir ingrediente
        </Button>
      </div>
    </div>
  );
}

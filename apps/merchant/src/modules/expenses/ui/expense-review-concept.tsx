"use client";

import { useId, useState } from "react";
import { Button, SelectField, Text, TextField } from "../../../ui";
import type { ExpenseConcept, ExpenseContext } from "../types";
import type { EditableExpense } from "./expenses-model";

export function ExpenseReviewConcept({
  line,
  context,
  concepts,
  patch,
  isDisabled,
}: {
  line: EditableExpense;
  context: ExpenseContext;
  concepts: ExpenseConcept[];
  patch: (patch: Partial<EditableExpense>) => void;
  isDisabled: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const optionsId = useId();
  const selected = concepts.find((entry) => entry.id === line.conceptId);
  const category = context.categories.find(
    (entry) => entry.id === line.category,
  );
  const showOptions = expanded || !category || (!!line.conceptId && !selected);
  return (
    <div className="grid gap-3">
      <TextField
        label="Qué pagaste"
        placeholder="Alquiler, agua, sueldo de Luis…"
        value={line.conceptName}
        maxLength={120}
        onChange={(conceptName) =>
          patch({
            conceptName,
            ...(selected && conceptName !== selected.name
              ? { conceptId: null }
              : {}),
          })
        }
        isDisabled={isDisabled}
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        {category && (
          <Text variant="small">
            {category.label}
            {selected ? " · Concepto reconocido" : ""}
          </Text>
        )}
        <Button
          variant="quiet"
          aria-expanded={showOptions}
          aria-controls={optionsId}
          isDisabled={isDisabled}
          onPress={() => setExpanded((value) => !value)}
        >
          Cambiar concepto
        </Button>
      </div>
      {showOptions && (
        <div id={optionsId} className="grid items-start gap-4 sm:grid-cols-2">
          <SelectField
            label="Categoría"
            selectedKey={line.category || null}
            options={[...context.categories]}
            onSelectionChange={(key) => {
              const category =
                context.categories.find((entry) => entry.id === key)?.id ?? "";
              setExpanded(true);
              patch({ category, conceptId: null });
            }}
            isDisabled={isDisabled}
          />
          <SelectField
            label="Concepto"
            selectedKey={line.conceptId ?? "new"}
            options={[
              { id: "new", label: "Nuevo concepto" },
              ...concepts.map((entry) => ({
                id: entry.id,
                label: `${context.categories.find((category) => category.id === entry.category)?.label ?? entry.category} · ${entry.name}`,
              })),
            ]}
            onSelectionChange={(key) => {
              const concept = concepts.find((entry) => entry.id === key);
              patch(
                concept
                  ? {
                      conceptId: concept.id,
                      conceptName: concept.name,
                      category: concept.category,
                    }
                  : { conceptId: null },
              );
            }}
            isDisabled={isDisabled}
          />
        </div>
      )}
    </div>
  );
}

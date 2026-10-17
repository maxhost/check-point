"use client";

import { CheckboxField, SelectField, Text, TextField } from "../../../ui";
import type { ExpenseConcept, ExpenseContext } from "../types";
import type { EditableExpense } from "./expenses-model";

export function ExpenseLocationField({
  context,
  value,
  onChange,
  isDisabled,
  label = "Local del pago",
}: {
  context: ExpenseContext;
  value: string;
  onChange: (value: string) => void;
  isDisabled?: boolean;
  label?: string;
}) {
  return (
    <SelectField
      label={label}
      placeholder="Elige un local o Todo el negocio"
      selectedKey={value || null}
      onSelectionChange={(key) => onChange(key === null ? "" : String(key))}
      isDisabled={isDisabled}
      options={[
        ...context.locations.map((location) => ({
          id: location.id,
          label:
            location.name +
            (location.status === "archived" ? " · Archivado" : ""),
        })),
        { id: "business", label: "Todo el negocio" },
      ]}
    />
  );
}

export function ExpenseLineFields({
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
  const selected = concepts.find((entry) => entry.id === line.conceptId);
  return (
    <div className="grid gap-4">
      {line.sourceText && (
        <Text variant="small">Texto reconocido: {line.sourceText}</Text>
      )}
      <div className="grid items-start gap-4 sm:grid-cols-2">
        <TextField
          label="Fecha de pago"
          description="AAAA-MM-DD. Puedes registrar pagos de meses pasados."
          placeholder="2026-10-16"
          value={line.paidOn}
          onChange={(paidOn) => patch({ paidOn })}
          isDisabled={isDisabled}
        />
        <TextField
          label={`Monto (${context.currencyCode})`}
          inputMode="decimal"
          value={line.amount}
          onChange={(amount) => patch({ amount })}
          isDisabled={isDisabled}
        />
        <SelectField
          label="Categoría"
          selectedKey={line.category || null}
          options={[...context.categories]}
          onSelectionChange={(key) => {
            const category =
              context.categories.find((entry) => entry.id === key)?.id ?? "";
            patch({ category, conceptId: null });
          }}
          isDisabled={isDisabled}
        />
        <SelectField
          label="Concepto"
          description="Usa uno existente o crea el concepto correcto para este pago."
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
      {selected ? (
        <Text variant="small">
          Concepto reconocido: {selected.name}. Cambiarlo solo afecta este pago.
        </Text>
      ) : (
        <TextField
          label="Nombre del concepto"
          description="Por ejemplo: Alquiler, Luis o Luis horas extras."
          value={line.conceptName}
          maxLength={120}
          onChange={(conceptName) => patch({ conceptName })}
          isDisabled={isDisabled}
        />
      )}
      <TextField
        label="Nombre del pago"
        description="Describe qué pagaste. Para sueldos puedes escribir un nombre libre."
        value={line.name}
        maxLength={120}
        onChange={(name) => patch({ name })}
        isDisabled={isDisabled}
      />
      <ExpenseLocationField
        context={context}
        value={line.location}
        onChange={(location) => patch({ location })}
        isDisabled={isDisabled}
      />
      <CheckboxField
        label="Gasto fijo"
        description="Puedes corregir esta propuesta. La categoría no determina si es fijo."
        isSelected={line.isFixed}
        onChange={(isFixed) => patch({ isFixed })}
        isDisabled={isDisabled}
      />
    </div>
  );
}

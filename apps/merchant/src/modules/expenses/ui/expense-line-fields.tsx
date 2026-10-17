"use client";

import { useState } from "react";
import {
  Button,
  CheckboxField,
  DateField,
  Text,
  TextAreaField,
  TextField,
} from "../../../ui";
import type { ExpenseConcept, ExpenseContext } from "../types";
import type { EditableExpense } from "./expenses-model";
import { ExpenseReviewConcept } from "./expense-review-concept";
import { ExpenseReviewLocation } from "./expense-review-location";

export { ExpenseLocationField } from "./expense-review-location";

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
  const [detailExpanded, setDetailExpanded] = useState(false);
  return (
    <div className="grid gap-4">
      <ExpenseReviewConcept
        line={line}
        context={context}
        concepts={concepts}
        patch={patch}
        isDisabled={isDisabled}
      />
      <div className="grid items-start gap-4 sm:grid-cols-2">
        <DateField
          label="Fecha de pago"
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
      </div>
      <ExpenseReviewLocation
        context={context}
        value={line.location}
        onChange={(location) => patch({ location })}
        isDisabled={isDisabled}
      />
      <CheckboxField
        label="Gasto fijo"
        isSelected={line.isFixed}
        onChange={(isFixed) => patch({ isFixed })}
        isDisabled={isDisabled}
      />
      <div className="grid gap-3">
        <div>
          <Button
            variant="quiet"
            aria-expanded={detailExpanded}
            isDisabled={isDisabled}
            onPress={() => setDetailExpanded((value) => !value)}
          >
            {line.name.trim() ? "Editar detalle" : "Añadir detalle"}
          </Button>
        </div>
        {detailExpanded && (
          <>
            <TextAreaField
              label="Detalle (opcional)"
              value={line.name}
              maxLength={120}
              onChange={(name) => patch({ name })}
              isDisabled={isDisabled}
            />
            {line.sourceText && (
              <Text variant="small">Texto reconocido: {line.sourceText}</Text>
            )}
          </>
        )}
      </div>
    </div>
  );
}

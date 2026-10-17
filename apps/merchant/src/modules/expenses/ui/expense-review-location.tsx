"use client";

import { useState } from "react";
import { Button, SelectField, Text } from "../../../ui";
import type { ExpenseContext } from "../types";

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

export function ExpenseReviewLocation({
  context,
  value,
  onChange,
  isDisabled,
}: {
  context: ExpenseContext;
  value: string;
  onChange: (value: string) => void;
  isDisabled: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const location = context.locations.find((entry) => entry.id === value);
  const valid = value === "business" || !!location;
  const name =
    value === "business"
      ? "Todo el negocio"
      : location
        ? location.name + (location.status === "archived" ? " · Archivado" : "")
        : "";
  return (
    <div className="grid gap-3">
      {valid && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Text variant="small">Local: {name}</Text>
          <Button
            variant="quiet"
            aria-expanded={expanded}
            isDisabled={isDisabled}
            onPress={() => setExpanded((value) => !value)}
          >
            Cambiar local
          </Button>
        </div>
      )}
      {(!valid || expanded) && (
        <ExpenseLocationField
          context={context}
          value={value}
          isDisabled={isDisabled}
          onChange={(location) => {
            onChange(location);
            setExpanded(false);
          }}
        />
      )}
    </div>
  );
}

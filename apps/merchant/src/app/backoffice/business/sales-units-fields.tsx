"use client";
import type { BusinessSalesUnits } from "../../../lib/business-contract";
import { CheckboxField, Text } from "../../../ui";
export function SalesUnitsFields({
  draft,
  onChange,
  disabled,
  error,
}: {
  draft: BusinessSalesUnits;
  onChange: (draft: BusinessSalesUnits) => void;
  disabled: boolean;
  error?: string | null;
}) {
  return (
    <div className="grid gap-3">
      {(
        [
          ["kg", "Kilogramo (kg)"],
          ["lb", "Libra (lb)"],
          ["g", "Gramo (g)"],
        ] as const
      ).map(([unit, label]) => (
        <CheckboxField
          key={unit}
          label={label}
          isSelected={draft.salesMassUnits.includes(unit)}
          isDisabled={disabled}
          onChange={(selected) =>
            onChange({
              ...draft,
              salesMassUnits: selected
                ? [...draft.salesMassUnits, unit]
                : draft.salesMassUnits.filter((value) => value !== unit),
            })
          }
        />
      ))}
      {error && <Text>{error}</Text>}
    </div>
  );
}

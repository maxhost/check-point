"use client";
import { CheckboxField } from "../../../ui";
import type { Location } from "./marketing-types";

export function MarketingLocationPicker({
  locations,
  selectedIds,
  onChange,
  title,
  description,
  error,
  usableLocationIds,
}: {
  locations: Location[] | null;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  title: string;
  description?: string;
  error?: string;
  usableLocationIds?: string[];
}) {
  if (!locations) return null;
  const active = locations.filter((location) => location.status === "active");
  return (
    <fieldset className="grid gap-3 rounded-md border border-border p-4">
      <legend className="px-1 font-bold">{title}</legend>
      {description && (
        <p className="text-sm text-content-muted">{description}</p>
      )}
      {active.map((location) => (
        <div key={location.id}>
          <CheckboxField
            label={location.name}
            description={location.addressLabel}
            isSelected={selectedIds.includes(location.id)}
            onChange={(checked) =>
              onChange(
                checked
                  ? [...selectedIds, location.id]
                  : selectedIds.filter((id) => id !== location.id),
              )
            }
          />
          {selectedIds.includes(location.id) &&
            usableLocationIds &&
            !usableLocationIds.includes(location.id) && (
              <p className="mt-1 text-sm text-warning">
                Este local no tiene ubicación en el mapa.
              </p>
            )}
        </div>
      ))}
      {active.length === 0 && <p>No hay locales activos.</p>}
      {error && <p className="text-sm font-semibold text-danger">{error}</p>}
    </fieldset>
  );
}

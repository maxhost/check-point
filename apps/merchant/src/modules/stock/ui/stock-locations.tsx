"use client";

import { useEffect, useState } from "react";
import { SelectField, Text } from "../../../ui";
import { panelRequest } from "../../../app/backoffice/panel-request";

export type StockLocation = {
  id: string;
  name: string;
  status: "active" | "archived";
};
type LocationResponse = {
  locations: StockLocation[];
  defaultLocationId: string | null;
};

/** La elección vive en esta pantalla; nunca se persiste en el dispositivo. */
export function useStockLocations(endpoint: string) {
  const [locations, setLocations] = useState<StockLocation[] | null>(null);
  const [locationId, setLocationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    void panelRequest<LocationResponse>(endpoint)
      .then((data) => {
        if (!active) return;
        setLocations(data.locations);
        setLocationId((current) =>
          data.locations.some((local) => local.id === current)
            ? current
            : data.defaultLocationId,
        );
        setError(null);
      })
      .catch((cause) => {
        if (active)
          setError(
            cause instanceof Error
              ? cause.message
              : "No pudimos leer tus locales. Reintenta la carga.",
          );
      });
    return () => {
      active = false;
    };
  }, [endpoint, attempt]);
  return {
    locations,
    locationId,
    setLocationId,
    error,
    reload: () => setAttempt((value) => value + 1),
  };
}

export function StockLocationField({
  locations,
  locationId,
  onChange,
}: {
  locations: StockLocation[];
  locationId: string | null;
  onChange: (id: string) => void;
}) {
  if (locations.length < 2 && locations[0]?.status === "active") return null;
  if (!locations.length)
    return (
      <Text variant="muted">
        No tienes locales disponibles. Crea un local para registrar stock.
      </Text>
    );
  return (
    <SelectField
      label="Local"
      selectedKey={locationId}
      onSelectionChange={(key) => {
        if (key !== null) onChange(String(key));
      }}
      options={locations.map((local) => ({
        id: local.id,
        label: local.name + (local.status === "archived" ? " · Archivado" : ""),
      }))}
    />
  );
}

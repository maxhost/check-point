"use client";

import dynamic from "next/dynamic";

export type SelectedAddress = {
  label: string;
  longitude: number;
  latitude: number;
  featureId?: string;
  snapshot: Record<string, unknown>;
};

const MapboxPlaceSearch = dynamic(() => import("./address-autofill-mapbox"), {
  ssr: false,
  loading: () => <p className="field-help">Cargando buscador de lugares…</p>,
});

export function AddressAutofillField({
  onSelect,
}: {
  onSelect: (address: SelectedAddress) => void;
}) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  if (!token) {
    return (
      <p className="field-help">
        La búsqueda de dirección se habilitará al configurar Mapbox.
      </p>
    );
  }
  return <MapboxPlaceSearch token={token} onSelect={onSelect} />;
}

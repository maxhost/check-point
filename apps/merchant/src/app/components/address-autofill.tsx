"use client";

import dynamic from "next/dynamic";

export type SelectedAddress = {
  label: string;
  longitude: number;
  latitude: number;
  provider: "geoapify";
  featureId?: string;
  snapshot: Record<string, unknown>;
};

const GeoapifyPlaceSearch = dynamic(
  () => import("./address-autofill-geoapify"),
  {
    ssr: false,
    loading: () => <p className="field-help">Cargando buscador de lugares…</p>,
  },
);

export function AddressAutofillField({
  onSelect,
  countryCode,
}: {
  onSelect: (address: SelectedAddress) => void;
  countryCode: string;
}) {
  const geoapifyToken = process.env.NEXT_PUBLIC_GEOAPIFY_API_KEY;
  if (!geoapifyToken) {
    return (
      <p className="field-help">
        La búsqueda de lugares se habilitará al configurar Geoapify.
      </p>
    );
  }
  return (
    <GeoapifyPlaceSearch
      token={geoapifyToken}
      countryCode={countryCode}
      onSelect={onSelect}
    />
  );
}

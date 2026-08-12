"use client";

import { AddressAutofill } from "@mapbox/search-js-react";
import type { SelectedAddress } from "./address-autofill";

type Retrieval = {
  features: Array<{
    geometry?: { coordinates?: number[] };
    properties?: {
      full_address?: string;
      place_formatted?: string;
      mapbox_id?: string;
      [key: string]: unknown;
    };
  }>;
};

export default function MapboxAddressAutofill({
  token,
  onSelect,
}: {
  token: string;
  onSelect: (address: SelectedAddress) => void;
}) {
  return (
    <AddressAutofill
      accessToken={token}
      options={{ country: "EC,AR,CL,PY,UY,PE,CO,MX,BR" }}
      onRetrieve={(response) => {
        const feature = (response as unknown as Retrieval).features[0];
        const coordinates = feature?.geometry?.coordinates;
        if (!feature || !coordinates || coordinates.length < 2) return;
        onSelect({
          label:
            feature.properties?.full_address ??
            feature.properties?.place_formatted ??
            "",
          longitude: coordinates[0],
          latitude: coordinates[1],
          featureId: feature.properties?.mapbox_id,
          snapshot: feature.properties as Record<string, unknown>,
        });
      }}
    >
      <input
        name="address"
        placeholder="Busca y selecciona una dirección"
        autoComplete="address-line1"
      />
    </AddressAutofill>
  );
}

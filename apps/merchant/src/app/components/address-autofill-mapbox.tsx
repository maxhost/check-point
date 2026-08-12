"use client";

import { SearchBox } from "@mapbox/search-js-react";
import { useState } from "react";
import type { SelectedAddress } from "./address-autofill";

type Retrieval = {
  features: Array<{
    geometry?: { coordinates?: number[] };
    properties?: {
      mapbox_id?: string;
      full_address?: string;
      place_formatted?: string;
      name?: string;
      [key: string]: unknown;
    };
  }>;
};

export default function MapboxPlaceSearch({
  token,
  countryCode,
  onSelect,
}: {
  token: string;
  countryCode: string;
  onSelect: (address: SelectedAddress) => void;
}) {
  const [value, setValue] = useState("");
  return (
    <div className="mapbox-place-search">
      <SearchBox
        key={countryCode}
        accessToken={token}
        value={value}
        onChange={(nextValue) => setValue(nextValue)}
        placeholder="Busca un local, lugar o dirección"
        options={{
          country: countryCode,
          language: "es",
          limit: 10,
          types: "poi,address,street,place,locality,neighborhood",
        }}
        theme={{
          variables: {
            unit: "16px",
            padding: "13px",
            colorText: "#17251d",
            colorPrimary: "#176548",
            colorSecondary: "#5e6c63",
            colorBackground: "#ffffff",
            colorBackgroundHover: "#edf8f0",
            border: "1px solid #cbd7ce",
            borderRadius: "11px",
            boxShadow: "none",
            lineHeight: "normal",
            fontFamily: "Arial, sans-serif",
            fontWeight: "400",
          },
          cssText: `
            .SearchBox { min-height: 46px; }
            .Input { height: 44px; }
            .Input:focus { border: 0; outline: 0; }
          `,
        }}
        onClear={() => setValue("")}
        onRetrieve={(response) => {
          const feature = (response as unknown as Retrieval).features[0];
          const coordinates = feature?.geometry?.coordinates;
          if (!feature || !coordinates || coordinates.length < 2) return;
          const label =
            feature.properties?.full_address ??
            feature.properties?.place_formatted ??
            feature.properties?.name;
          if (!label) return;
          setValue(label);
          onSelect({
            label,
            longitude: coordinates[0],
            latitude: coordinates[1],
            provider: "mapbox",
            featureId: feature.properties?.mapbox_id,
            snapshot: feature.properties as Record<string, unknown>,
          });
        }}
      />
    </div>
  );
}

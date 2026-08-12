"use client";

import { Search } from "iconoir-react";
import { useEffect, useId, useState, type ReactNode } from "react";
import type { SelectedAddress } from "./address-autofill";
import { canonicalAddress } from "../../lib/location-address";

type GeoapifyResult = {
  formatted?: string;
  lat?: number;
  lon?: number;
  place_id?: string;
  [key: string]: unknown;
};

export default function GeoapifyPlaceSearch({
  token,
  countryCode,
  onSelect,
  renderMapboxFallback,
}: {
  token: string;
  countryCode: string;
  onSelect: (address: SelectedAddress) => void;
  renderMapboxFallback?: (query: string) => ReactNode;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeoapifyResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [useMapboxFallback, setUseMapboxFallback] = useState(false);
  const [selectionFinalized, setSelectionFinalized] = useState(false);
  const listId = useId();

  useEffect(() => {
    setQuery("");
    setResults([]);
    setUseMapboxFallback(false);
    setSelectionFinalized(false);
  }, [countryCode]);

  useEffect(() => {
    if (selectionFinalized) {
      setResults([]);
      setLoading(false);
      return;
    }

    const text = query.trim();
    if (text.length < 3) {
      setResults([]);
      return;
    }
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          text,
          format: "json",
          lang: "es",
          limit: "8",
          filter: `countrycode:${countryCode.toLowerCase()}`,
          apiKey: token,
        });
        const response = await fetch(
          `https://api.geoapify.com/v1/geocode/autocomplete?${params.toString()}`,
          { signal: controller.signal },
        );
        const body = (await response.json()) as { results?: GeoapifyResult[] };
        setResults(response.ok ? (body.results ?? []) : []);
        if (!response.ok) {
          setUseMapboxFallback(Boolean(renderMapboxFallback));
        }
      } catch (error) {
        if ((error as { name?: string }).name !== "AbortError") {
          setResults([]);
          setUseMapboxFallback(Boolean(renderMapboxFallback));
        }
      } finally {
        setLoading(false);
      }
    }, 280);
    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [countryCode, query, renderMapboxFallback, selectionFinalized, token]);

  function select(result: GeoapifyResult) {
    const label = canonicalAddress(result);
    if (
      !label ||
      typeof result.lon !== "number" ||
      typeof result.lat !== "number"
    ) {
      return;
    }
    setSelectionFinalized(true);
    setResults([]);
    setQuery(label);
    onSelect({
      label,
      longitude: result.lon,
      latitude: result.lat,
      provider: "geoapify",
      featureId: result.place_id,
      snapshot: result,
    });
  }

  if (useMapboxFallback && renderMapboxFallback) {
    return (
      <div className="geoapify-place-search provider-fallback">
        {renderMapboxFallback(query)}
      </div>
    );
  }

  return (
    <div className="geoapify-place-search">
      <div className="geoapify-input-wrap">
        <Search aria-hidden="true" />
        <input
          value={query}
          onChange={(event) => {
            setSelectionFinalized(false);
            setQuery(event.target.value);
          }}
          placeholder="Busca un local, lugar o dirección"
          autoComplete="off"
          role="combobox"
          aria-controls={listId}
          aria-expanded={results.length > 0}
          aria-autocomplete="list"
        />
      </div>
      {loading && <p className="field-help">Buscando lugares…</p>}
      {results.length > 0 && (
        <ul className="geoapify-results" id={listId} role="listbox">
          {results.map((result) => (
            <li key={result.place_id ?? result.formatted} role="option">
              <button type="button" onClick={() => select(result)}>
                {result.formatted}
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="location-attribution">
        Datos de ubicación © OpenStreetMap contributors, © Geoapify
      </p>
    </div>
  );
}

"use client";

import { Search } from "iconoir-react";
import { useEffect, useId, useState } from "react";
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
}: {
  token: string;
  countryCode: string;
  onSelect: (address: SelectedAddress) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeoapifyResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [selectionFinalized, setSelectionFinalized] = useState(false);
  const listId = useId();

  useEffect(() => {
    setQuery("");
    setResults([]);
    setFailed(false);
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
        setFailed(!response.ok);
      } catch (error) {
        if ((error as { name?: string }).name !== "AbortError") {
          setResults([]);
          setFailed(true);
        }
      } finally {
        setLoading(false);
      }
    }, 280);
    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [countryCode, query, selectionFinalized, token]);

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
    setFailed(false);
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

  return (
    <div className="geoapify-place-search">
      <div className="geoapify-input-wrap">
        <Search aria-hidden="true" />
        <input
          value={query}
          onChange={(event) => {
            setSelectionFinalized(false);
            setFailed(false);
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
      {failed && !loading && (
        <p className="field-help">
          No pudimos buscar lugares ahora. Revisá tu conexión y volvé a
          intentar.
        </p>
      )}
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

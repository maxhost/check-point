"use client";

import { NavArrowDown, Search } from "iconoir-react";
import { useEffect, useId, useState, type ReactNode } from "react";
import type { SelectedAddress } from "./address-autofill";

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
  renderFallback,
}: {
  token: string;
  countryCode: string;
  onSelect: (address: SelectedAddress) => void;
  renderFallback?: () => ReactNode;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeoapifyResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [fallbackOpen, setFallbackOpen] = useState(false);
  const listId = useId();

  useEffect(() => {
    setQuery("");
    setResults([]);
    setSearched(false);
    setFallbackOpen(false);
  }, [countryCode]);

  useEffect(() => {
    const text = query.trim();
    if (text.length < 3) {
      setResults([]);
      setSearched(false);
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
        setSearched(true);
      } catch (error) {
        if ((error as { name?: string }).name !== "AbortError") {
          setResults([]);
          setSearched(true);
        }
      } finally {
        setLoading(false);
      }
    }, 280);
    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [countryCode, query, token]);

  function select(result: GeoapifyResult) {
    if (
      !result.formatted ||
      typeof result.lon !== "number" ||
      typeof result.lat !== "number"
    ) {
      return;
    }
    setQuery(result.formatted);
    setResults([]);
    onSelect({
      label: result.formatted,
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
            setQuery(event.target.value);
            setFallbackOpen(false);
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
      {searched && !loading && results.length === 0 && renderFallback && (
        <div className="address-fallback">
          <p className="field-help">
            No encontramos ese lugar. Puedes ingresar su dirección exacta.
          </p>
          <button
            className="text-button"
            type="button"
            aria-expanded={fallbackOpen}
            onClick={() => setFallbackOpen(!fallbackOpen)}
          >
            Buscar dirección exacta <NavArrowDown aria-hidden="true" />
          </button>
          {fallbackOpen && (
            <div className="address-fallback-search">{renderFallback()}</div>
          )}
        </div>
      )}
      <p className="location-attribution">
        Datos de ubicación © OpenStreetMap contributors, © Geoapify
      </p>
    </div>
  );
}

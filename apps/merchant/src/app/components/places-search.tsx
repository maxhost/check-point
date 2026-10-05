"use client";

import { useEffect, useRef, useState } from "react";
import type {
  PlaceSelection,
  PlaceSuggestion,
} from "../[locale]/(merchant)/business/onboarding/_lib/contracts";
import {
  autocompletePlaces,
  selectPlace,
  WizardApiError,
} from "../[locale]/(merchant)/business/onboarding/_lib/onboarding-api";

export function PlacesSearch({
  label,
  onSelect,
}: {
  label: string;
  onSelect: (selection: PlaceSelection) => void;
}) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "selecting">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);
  const token = useRef<string | null>(null);
  const request = useRef(0);

  useEffect(() => {
    const input = query.trim();
    const version = ++request.current;
    if (input.length < 3 || input.length > 120) {
      setSuggestions([]);
      setStatus("idle");
      return;
    }
    if (!token.current) token.current = crypto.randomUUID();
    const sessionToken = token.current;
    const timer = window.setTimeout(async () => {
      setStatus("loading");
      setError(null);
      try {
        const result = await autocompletePlaces(input, sessionToken);
        if (version === request.current) setSuggestions(result.suggestions);
      } catch (caught) {
        if (version === request.current) {
          setSuggestions([]);
          setError(
            caught instanceof WizardApiError
              ? caught.message
              : "No pudimos buscar lugares.",
          );
        }
      } finally {
        if (version === request.current) setStatus("idle");
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  async function choose(suggestion: PlaceSuggestion) {
    const sessionToken = token.current;
    if (!sessionToken) return;
    ++request.current;
    setStatus("selecting");
    setError(null);
    try {
      const result = await selectPlace(suggestion.placeId, sessionToken);
      setSuggestions([]);
      onSelect({ ...result, suggestion });
    } catch (caught) {
      setError(
        caught instanceof WizardApiError
          ? caught.message
          : "No pudimos elegir este lugar.",
      );
    } finally {
      token.current = null;
      setStatus("idle");
    }
  }

  return (
    <div className="places-search">
      <label className="location-form-label" htmlFor="places-search-input">
        {label}
      </label>
      <input
        id="places-search-input"
        className="places-search-input"
        type="search"
        autoComplete="off"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setError(null);
        }}
        placeholder="Busca un negocio o una dirección"
        aria-controls="places-search-results"
        aria-expanded={suggestions.length > 0}
      />
      {status === "loading" && <p role="status">Buscando…</p>}
      {error && (
        <p role="alert" className="text-danger">
          {error}
        </p>
      )}
      {query.trim().length >= 3 &&
        status === "idle" &&
        !error &&
        suggestions.length === 0 && (
          <p className="field-help">
            No encontramos resultados. Prueba otra búsqueda.
          </p>
        )}
      {suggestions.length > 0 && (
        <ul id="places-search-results" className="places-search-results">
          {suggestions.map((suggestion) => (
            <li key={suggestion.placeId}>
              <button
                type="button"
                disabled={status === "selecting"}
                onClick={() => void choose(suggestion)}
              >
                <strong>{suggestion.mainText}</strong>
                {suggestion.secondaryText && (
                  <span>{suggestion.secondaryText}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

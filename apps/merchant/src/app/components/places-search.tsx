"use client";

import { useEffect, useRef, useState } from "react";
import { Combobox } from "../../ui";
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

  const searching = query.trim().length >= 3;
  return (
    <Combobox
      label={label}
      placeholder="Busca un negocio o una dirección"
      items={suggestions.map((suggestion) => ({
        id: suggestion.placeId,
        label: suggestion.mainText,
        description: suggestion.secondaryText || undefined,
      }))}
      inputValue={query}
      onInputChange={(value) => {
        // Al elegir, React Aria escribe el texto de la opcion: no es una busqueda nueva (con
        // `details` lento disparaba otro `autocomplete`; e2e «elegir una sugerencia…»).
        if (status === "selecting") return;
        setQuery(value);
        setError(null);
      }}
      onSelectionChange={(id) => {
        const suggestion = suggestions.find((item) => item.placeId === id);
        if (suggestion && status !== "selecting") void choose(suggestion);
      }}
      status={
        status === "loading"
          ? "Buscando…"
          : searching && status === "idle" && !error && suggestions.length === 0
            ? "No encontramos resultados. Prueba otra búsqueda."
            : undefined
      }
      errorMessage={error ?? undefined}
    />
  );
}

"use client";

import { Search } from "iconoir-react";
import { useEffect, useMemo, useState } from "react";
import {
  FieldError,
  Input,
  Label,
  ListBox,
  ListBoxItem,
  Text,
  TextField,
  type Key,
} from "react-aria-components";
import { cx } from "../../../../../../ui/cx";
import type { SelectedAddress } from "../_lib/contracts";

type GeoapifyResult = {
  formatted?: string;
  lat?: number;
  lon?: number;
  place_id?: string;
  [key: string]: unknown;
};

type AddressOption = {
  id: string;
  label: string;
  result: GeoapifyResult;
};

export function AddressCombobox({
  countryCode,
  bias,
  onSelect,
  errorMessage,
}: {
  countryCode: string;
  bias: { latitude: number; longitude: number } | null;
  onSelect: (address: SelectedAddress | null) => void;
  errorMessage?: string;
}) {
  const token = process.env.NEXT_PUBLIC_GEOAPIFY_API_KEY;
  const [inputValue, setInputValue] = useState("");
  const [selectedKey, setSelectedKey] = useState<Key | null>(null);
  const [results, setResults] = useState<AddressOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchError, setSearchError] = useState<
    "credentials" | "unavailable" | null
  >(null);

  useEffect(() => {
    setInputValue("");
    setSelectedKey(null);
    setResults([]);
    setHasSearched(false);
    setSearchError(null);
    onSelect(null);
  }, [countryCode, onSelect]);

  useEffect(() => {
    const query = inputValue.trim();
    if (!token || !countryCode || query.length < 3 || selectedKey) {
      setResults([]);
      setIsLoading(false);
      setHasSearched(false);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setIsLoading(true);
      setHasSearched(false);
      setSearchError(null);
      try {
        const params = new URLSearchParams({
          text: query,
          format: "json",
          lang: "es",
          limit: "8",
          filter: `countrycode:${countryCode.toLowerCase()}`,
          apiKey: token,
        });
        if (bias) {
          params.set("bias", `proximity:${bias.longitude},${bias.latitude}`);
        }
        const response = await fetch(
          `https://api.geoapify.com/v1/geocode/autocomplete?${params.toString()}`,
          { signal: controller.signal },
        );
        if (response.status === 401 || response.status === 403) {
          throw new Error("geoapify-credentials");
        }
        if (!response.ok) {
          throw new Error("geoapify-unavailable");
        }
        const body = (await response.json()) as { results?: GeoapifyResult[] };
        const nextResults = (body.results ?? []).flatMap((result, index) => {
          if (
            !result.formatted ||
            typeof result.lat !== "number" ||
            typeof result.lon !== "number"
          ) {
            return [];
          }
          return [
            {
              id: result.place_id ?? `${result.formatted}-${index}`,
              label: result.formatted,
              result,
            },
          ];
        });
        setResults(nextResults);
        setHasSearched(true);
      } catch (error) {
        if ((error as { name?: string }).name !== "AbortError") {
          setResults([]);
          setHasSearched(false);
          setSearchError(
            (error as Error).message === "geoapify-credentials"
              ? "credentials"
              : "unavailable",
          );
        }
      } finally {
        setIsLoading(false);
      }
    }, 280);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [bias, countryCode, inputValue, selectedKey, token]);

  const resultById = useMemo(
    () => new Map(results.map((option) => [option.id, option])),
    [results],
  );

  function select(key: Key | null) {
    setSelectedKey(key);
    if (key === null) {
      onSelect(null);
      return;
    }
    const option = resultById.get(String(key));
    if (!option) return;
    setInputValue(option.label);
    onSelect({
      label: option.label,
      provider: "geoapify",
      longitude: option.result.lon as number,
      latitude: option.result.lat as number,
      featureId: option.result.place_id,
      snapshot: option.result,
    });
  }

  if (!token) {
    return (
      <div className="rounded-md bg-warning-soft p-4 text-sm text-content">
        El buscador de direcciones necesita la configuración pública de
        Geoapify.
      </div>
    );
  }

  return (
    <div className="grid gap-1.5">
      <TextField
        value={inputValue}
        onChange={(value) => {
          setInputValue(value);
          setSelectedKey(null);
          setHasSearched(false);
          setSearchError(null);
          onSelect(null);
        }}
        validationBehavior="aria"
        isInvalid={Boolean(errorMessage)}
        className="grid gap-1.5"
      >
        <Label className="cp-field-label text-base font-bold leading-5 text-content">
          Dirección del local
        </Label>
        <div className="grid grid-cols-[auto_1fr] items-center rounded-md border border-border-strong bg-surface text-content focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus has-[[data-invalid]]:border-danger">
          <Search className="ml-3.5 size-5" aria-hidden="true" />
          <Input
            autoComplete="off"
            placeholder="Calle, número y ciudad"
            className="cp-combobox-input min-h-12 min-w-0 border-0 bg-transparent px-3 py-2.5 text-base outline-none placeholder:text-content-muted"
          />
        </div>
        <Text
          slot="description"
          className="text-sm leading-5 text-content-muted"
        >
          Escribí al menos tres letras y elegí una dirección de la lista.
        </Text>
        <FieldError className="text-sm font-semibold leading-5 text-danger">
          {errorMessage}
        </FieldError>
      </TextField>
      {(isLoading || searchError) && (
        <p
          className={cx(
            "text-sm",
            searchError ? "text-danger" : "text-content-muted",
          )}
          role="status"
        >
          {isLoading
            ? "Buscando lugares…"
            : searchError === "credentials"
              ? "El buscador de direcciones no está autorizado. Revisá la clave y los dominios permitidos de Geoapify."
              : "No pudimos buscar lugares. Revisá tu conexión e intentá otra vez."}
        </p>
      )}
      {hasSearched && results.length === 0 && !searchError && (
        <p role="status" className="text-sm text-content-muted">
          No encontramos direcciones en el país seleccionado. Probá con calle,
          número y ciudad.
        </p>
      )}
      {results.length > 0 && (
        <div className="rounded-md border border-border bg-surface-raised p-1 shadow-lg">
          <ListBox
            aria-label="Direcciones sugeridas"
            items={results}
            onAction={select}
            className="max-h-72 overflow-auto outline-none"
          >
            {(option) => (
              <ListBoxItem
                textValue={option.label}
                className={({ isFocused, isSelected }) =>
                  cx(
                    "flex min-h-11 cursor-default items-center rounded-sm px-3 py-2 text-sm text-content outline-none",
                    (isFocused || isSelected) && "bg-primary-soft",
                  )
                }
              >
                {option.label}
              </ListBoxItem>
            )}
          </ListBox>
        </div>
      )}
      <p className="text-xs text-content-muted">
        Datos de ubicación © OpenStreetMap contributors, © Geoapify
      </p>
    </div>
  );
}

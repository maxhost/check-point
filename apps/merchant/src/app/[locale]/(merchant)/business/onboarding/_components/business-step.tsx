"use client";

import { useState } from "react";
import { Button, SelectField, TextField } from "../../../../../../ui";
import { PlacesSearch } from "../../../../../components/places-search";
import type {
  OnboardingPrefill,
  PlaceSelection,
  SignupBusiness,
} from "../_lib/contracts";
import { InlineApiError, StepHeader } from "./wizard-shared";
import type { WizardApiError } from "../_lib/onboarding-api";

export function BusinessStep({
  prefill,
  apiError,
  initialSelection,
  initialBusiness,
  onComplete,
  onLogin,
}: {
  prefill: OnboardingPrefill;
  apiError: WizardApiError | null;
  initialSelection?: PlaceSelection | null;
  initialBusiness?: SignupBusiness | null;
  onComplete: (business: SignupBusiness, selection: PlaceSelection) => void;
  onLogin: () => void;
}) {
  const [selection, setSelection] = useState<PlaceSelection | null>(
    initialSelection ?? null,
  );
  const [name, setName] = useState(initialBusiness?.name ?? "");
  const [category, setCategory] = useState<string | null>(
    initialBusiness?.categoryGcid ?? null,
  );
  const [error, setError] = useState<string | null>(null);
  const [searchKey, setSearchKey] = useState(0);

  function choose(value: PlaceSelection) {
    setSelection(value);
    setName(
      value.suggestion.kind === "business" ? value.suggestion.mainText : "",
    );
    const suggested = value.place.suggestedCategoryGcid;
    setCategory(
      prefill.categories.some((item) => item.gcid === suggested)
        ? suggested
        : null,
    );
    setError(null);
  }

  function changePlace() {
    setSelection(null);
    setName("");
    setCategory(null);
    setSearchKey((key) => key + 1);
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selection) return setError("Elige un lugar de la lista.");
    if (!name.trim() || name.trim().length > 120)
      return setError("Escribe un nombre de hasta 120 caracteres.");
    if (!category) return setError("Selecciona una categoría.");
    setError(null);
    onComplete(
      {
        name: name.trim(),
        categoryGcid: category,
        selectionToken: selection.selectionToken,
      },
      selection,
    );
  }

  return (
    <>
      <StepHeader
        step={1}
        title="Encuentra tu negocio"
        description="Busca tu negocio o su dirección y completa los datos básicos."
      />
      <InlineApiError
        error={
          apiError?.code === "invalid_business" && apiError.field
            ? null
            : apiError
        }
      />
      <form onSubmit={submit} className="grid gap-5">
        {selection ? (
          <div className="places-selected">
            <span>Dirección</span>
            <strong>{selection.place.addressLabel}</strong>
            <button type="button" onClick={changePlace}>
              Cambiar
            </button>
          </div>
        ) : (
          <PlacesSearch
            key={searchKey}
            label="Busca tu negocio o dirección"
            onSelect={choose}
          />
        )}
        {selection && (
          <>
            <TextField
              label="Nombre del negocio"
              value={name}
              onChange={setName}
              maxLength={120}
              isRequired
              isInvalid={apiError?.field === "name"}
              errorMessage={
                apiError?.field === "name" ? apiError.message : undefined
              }
            />
            <SelectField
              label="Categoría"
              selectedKey={category}
              onSelectionChange={(key) =>
                setCategory(key === null ? null : String(key))
              }
              options={prefill.categories.map((item) => ({
                id: item.gcid,
                label: item.displayName,
              }))}
              isRequired
              isInvalid={apiError?.field === "categoryGcid"}
              errorMessage={
                apiError?.field === "categoryGcid"
                  ? apiError.message
                  : undefined
              }
            />
          </>
        )}
        {error && (
          <p role="alert" className="text-danger">
            {error}
          </p>
        )}
        <Button type="submit" fullWidth>
          Continuar
        </Button>
      </form>
      <p className="mt-8 text-center text-sm text-content-muted">
        ¿Ya tienes cuenta?{" "}
        <button
          type="button"
          className="font-bold text-primary underline"
          onClick={onLogin}
        >
          Iniciar sesión
        </button>
      </p>
    </>
  );
}

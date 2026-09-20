"use client";

import { useCallback, useState } from "react";
import { Form } from "react-aria-components";
import { Button, SelectField, TextField } from "../../../../../../ui";
import { AddressCombobox } from "./address-combobox";
import type {
  BusinessSummary,
  OnboardingPrefill,
  SelectedAddress,
} from "../_lib/contracts";
import { createBusiness, WizardApiError } from "../_lib/onboarding-api";
import { InlineApiError, StepHeader } from "./wizard-shared";

type FieldErrors = Record<string, string | undefined>;

function currencyDescription(currencyCode: string) {
  return `Moneda: ${currencyCode}`;
}

export function BusinessStep({
  prefill,
  apiError,
  onError,
  onComplete,
  onAlreadyExists,
}: {
  prefill: OnboardingPrefill;
  apiError: WizardApiError | null;
  onError: (error: WizardApiError | null) => void;
  onComplete: (business: BusinessSummary, currencyCode: string) => void;
  onAlreadyExists: () => void;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [country, setCountry] = useState(
    prefill.suggestedCountryCode ?? prefill.countries[0]?.code ?? "",
  );
  const [address, setAddress] = useState<SelectedAddress | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const selectAddress = useCallback((value: SelectedAddress | null) => {
    setAddress(value);
    if (value) setErrors((current) => ({ ...current, address: undefined }));
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: FieldErrors = {};
    if (!name.trim()) nextErrors.name = "Escribí el nombre de tu negocio.";
    if (!category) nextErrors.category = "Seleccioná una categoría.";
    if (!country) nextErrors.country = "Seleccioná un país.";
    if (!address) nextErrors.address = "Elegí una dirección de la lista.";
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean) || !category || !address)
      return;

    setIsSubmitting(true);
    onError(null);
    try {
      const created = await createBusiness({
        name: name.trim(),
        categoryGcid: category,
        countryCode: country,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        locationName: "Principal",
        address,
      });
      const selectedCountry = prefill.countries.find(
        (item) => item.code === country,
      );
      onComplete(created, selectedCountry?.currencyCode ?? "USD");
    } catch (caught) {
      const requestError =
        caught instanceof WizardApiError
          ? caught
          : new WizardApiError("No pudimos guardar tu negocio.", 503);
      if (requestError.status === 409) onAlreadyExists();
      else onError(requestError);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <StepHeader
        step={2}
        title="Contanos sobre tu negocio"
        description="Usamos estos datos para crear tu comercio y su primer local. Podés cambiarlos después."
      />
      <Form onSubmit={submit} className="grid gap-5">
        <InlineApiError error={apiError} />
        <TextField
          label="Nombre del negocio"
          name="businessName"
          placeholder="Ej.: Café del Barrio"
          value={name}
          onChange={setName}
          autoComplete="organization"
          isRequired
          isInvalid={Boolean(errors.name)}
          errorMessage={errors.name}
          description="El identificador público se generará automáticamente."
        />
        <SelectField
          label="Categoría"
          selectedKey={category}
          onSelectionChange={(key) => {
            if (key !== null) setCategory(String(key));
            setErrors((current) => ({ ...current, category: undefined }));
          }}
          options={prefill.categories.map((item) => ({
            id: item.gcid,
            label: item.displayName,
          }))}
          placeholder="Elegí la categoría"
          isRequired
          isInvalid={Boolean(errors.category)}
          errorMessage={errors.category}
        />
        <SelectField
          label="País"
          selectedKey={country}
          onSelectionChange={(key) => {
            if (key !== null) setCountry(String(key));
            setErrors((current) => ({ ...current, country: undefined }));
          }}
          options={prefill.countries.map((item) => ({
            id: item.code,
            label: item.name,
            description: currencyDescription(item.currencyCode),
          }))}
          placeholder="Elegí el país"
          isRequired
          isInvalid={Boolean(errors.country)}
          errorMessage={errors.country}
        />
        <AddressCombobox
          countryCode={country}
          bias={prefill.bias}
          onSelect={selectAddress}
          errorMessage={errors.address}
        />
        <Button type="submit" fullWidth isLoading={isSubmitting}>
          {isSubmitting ? "Guardando negocio…" : "Crear negocio y continuar"}
        </Button>
      </Form>
    </>
  );
}

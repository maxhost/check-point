"use client";

import { canonicalVatRate } from "@mi-pasaporte/domain/server/brand/vat";
import { SelectField, TextField } from "../../../ui";
import type { BusinessFiscal } from "../../../lib/business-contract";

const yesNo = [
  { id: "yes", label: "Sí" },
  { id: "no", label: "No" },
];

export function FiscalFields({
  draft,
  onChange,
  disabled,
}: {
  draft: BusinessFiscal;
  onChange: (draft: BusinessFiscal) => void;
  disabled: boolean;
}) {
  let rateError: string | undefined;
  if (draft.chargesVat) {
    try {
      if (canonicalVatRate(draft.saleVatRate) === null) {
        rateError = "Ingresa la tasa de IVA de venta para guardar.";
      }
    } catch {
      rateError =
        "Ingresa una tasa de IVA entre 0 y 100, con hasta dos decimales.";
    }
  }
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <SelectField
        label="¿Cobras IVA?"
        options={yesNo}
        selectedKey={draft.chargesVat ? "yes" : "no"}
        isDisabled={disabled}
        onSelectionChange={(key) =>
          onChange({ ...draft, chargesVat: key === "yes" })
        }
      />
      <TextField
        label="Tasa de IVA de venta (%)"
        inputMode="decimal"
        value={draft.saleVatRate ?? ""}
        isRequired={draft.chargesVat}
        isDisabled={disabled || !draft.chargesVat}
        errorMessage={rateError}
        onChange={(saleVatRate) =>
          onChange({
            ...draft,
            saleVatRate: saleVatRate === "" ? null : saleVatRate,
          })
        }
      />
      <SelectField
        label="¿Recuperas el IVA de tus compras?"
        options={yesNo}
        selectedKey={draft.recoversPurchaseVat ? "yes" : "no"}
        isDisabled={disabled}
        onSelectionChange={(key) =>
          onChange({ ...draft, recoversPurchaseVat: key === "yes" })
        }
      />
    </div>
  );
}

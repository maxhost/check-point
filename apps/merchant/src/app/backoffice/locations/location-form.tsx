"use client";

import {
  AddressAutofillField,
  type SelectedAddress,
} from "../../components/address-autofill";
import { TextField } from "../../../ui";
import { StaffFormModal } from "../staff/staff-form-modal";

export type LocationView = {
  id: string;
  name: string;
  addressLabel: string;
  status: "active" | "archived";
};

export type Draft = {
  id: string | null;
  name: string;
  addressLabel: string;
  /** The Geoapify suggestion the owner picked, or null when the address is plain text.
   * Typing in the address box clears it, so a hand-edited address is NEVER sent with the
   * coordinates of the suggestion it no longer matches (decision 3 of spec 0061). */
  selection: SelectedAddress | null;
  /** Whether the address must travel in the PATCH. False on a pure rename, so no
   * verification row is written and `active_verification_id` stays put. */
  addressChanged: boolean;
};

export const newDraft = (): Draft => ({
  id: null,
  name: "",
  addressLabel: "",
  selection: null,
  addressChanged: true,
});

export const editDraft = (location: LocationView): Draft => ({
  id: location.id,
  name: location.name,
  addressLabel: location.addressLabel,
  selection: null,
  addressChanged: false,
});

/** The `address` field of the request body. With a suggestion it carries the provider and
 * its coordinates (the server re-verifies them); without one it carries ONLY the text —
 * no coordinate is invented for it. */
export function addressBody(draft: Draft) {
  const { selection } = draft;
  if (selection) {
    return {
      label: selection.label,
      provider: selection.provider,
      longitude: selection.longitude,
      latitude: selection.latitude,
      featureId: selection.featureId,
    };
  }
  return { label: draft.addressLabel.trim() };
}

export function LocationForm({
  draft,
  countryCode,
  busy,
  onChange,
  onSave,
  onCancel,
}: {
  draft: Draft;
  countryCode: string;
  busy: boolean;
  onChange: (draft: Draft) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <StaffFormModal
      open
      eyebrow={draft.id ? "Editar local" : "Nuevo local"}
      title={draft.id ? "Actualizá sus datos" : "Sumá una nueva sucursal"}
      description="Usá un nombre fácil de reconocer y la dirección donde atendés."
      onClose={onCancel}
    >
      <form
        className="location-form"
        onSubmit={(event) => {
          event.preventDefault();
          onSave();
        }}
      >
        <TextField
          autoFocus
          className="staff-name-field"
          data-tour="location-name"
          label="Nombre del local"
          maxLength={120}
          placeholder="Ej. Sucursal Centro"
          value={draft.name}
          onChange={(name) => onChange({ ...draft, name })}
          isRequired
        />
        <div className="location-address-search" data-tour="location-address">
          <span className="location-form-label">Buscá la dirección</span>
          <p className="field-help">
            Elegí una sugerencia para verificarla automáticamente.
          </p>
          <AddressAutofillField
            countryCode={countryCode}
            onSelect={(selection) =>
              onChange({
                ...draft,
                selection,
                addressLabel: selection.label,
                addressChanged: true,
              })
            }
          />
        </div>
        <TextField
          className="staff-name-field"
          data-tour="location-manual-address"
          label="Dirección escrita"
          description="También podés escribirla si el buscador no la encuentra."
          maxLength={240}
          value={draft.addressLabel}
          placeholder="Ej. Av. Amazonas 123, Quito"
          onChange={(addressLabel) =>
            onChange({
              ...draft,
              addressLabel,
              selection: null,
              addressChanged: true,
            })
          }
          isRequired
        />
        <div className="location-form-actions">
          <button
            className="button alt"
            type="button"
            disabled={busy}
            onClick={onCancel}
          >
            Cancelar
          </button>
          <button
            className="button"
            data-tour="location-save"
            type="submit"
            disabled={busy}
          >
            {busy ? "Guardando…" : draft.id ? "Guardar cambios" : "Crear local"}
          </button>
        </div>
      </form>
    </StaffFormModal>
  );
}

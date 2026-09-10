"use client";

import {
  AddressAutofillField,
  type SelectedAddress,
} from "../../components/address-autofill";

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
    <section className="panel location-form">
      <h2>{draft.id ? "Editar local" : "Nuevo local"}</h2>
      <label>
        Nombre del local
        <input
          value={draft.name}
          onChange={(e) => onChange({ ...draft, name: e.target.value })}
        />
      </label>
      <p className="field-help">Buscá la dirección</p>
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
      <label>
        Dirección
        <input
          value={draft.addressLabel}
          placeholder="O escribila si el buscador no la encuentra"
          onChange={(e) =>
            onChange({
              ...draft,
              addressLabel: e.target.value,
              selection: null,
              addressChanged: true,
            })
          }
        />
      </label>
      <button className="button" disabled={busy} onClick={onSave}>
        {busy ? "Guardando…" : "Guardar local"}
      </button>
      <button className="button alt" onClick={onCancel}>
        Cancelar
      </button>
    </section>
  );
}

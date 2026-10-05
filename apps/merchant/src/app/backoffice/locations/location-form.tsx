"use client";

import { PlacesSearch } from "../../components/places-search";
import type { PlaceSelection } from "../../[locale]/(merchant)/business/onboarding/_lib/contracts";
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
  /** Writing an address by hand clears the selected Google place. */
  selection: PlaceSelection | null;
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

/** The server derives the coordinates from the signed selection token. */
export function addressBody(draft: Draft) {
  const { selection } = draft;
  if (selection) {
    return {
      label: selection.place.addressLabel,
      selectionToken: selection.selectionToken,
    };
  }
  return { label: draft.addressLabel.trim() };
}

export function LocationForm({
  draft,
  busy,
  onChange,
  onSave,
  onCancel,
}: {
  draft: Draft;
  busy: boolean;
  onChange: (draft: Draft) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <StaffFormModal
      open
      eyebrow={draft.id ? "Editar local" : "Nuevo local"}
      title={draft.id ? "Actualiza sus datos" : "Suma una nueva sucursal"}
      description="Usa un nombre fácil de reconocer y la dirección donde atiendes."
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
          {draft.selection ? (
            <div className="places-selected">
              <span>Dirección elegida</span>
              <strong>{draft.selection.place.addressLabel}</strong>
              <button
                type="button"
                onClick={() =>
                  onChange({ ...draft, selection: null, addressChanged: true })
                }
              >
                Cambiar
              </button>
            </div>
          ) : (
            <PlacesSearch
              label="Busca la dirección"
              onSelect={(selection) =>
                onChange({
                  ...draft,
                  selection,
                  addressLabel: selection.place.addressLabel,
                  addressChanged: true,
                })
              }
            />
          )}
        </div>
        <TextField
          className="staff-name-field"
          data-tour="location-manual-address"
          label="Dirección escrita"
          description="También puedes escribirla si el buscador no la encuentra."
          maxLength={240}
          value={draft.addressLabel}
          placeholder="Ej. Av. Amazonas 123, Quito"
          isReadOnly={Boolean(draft.selection)}
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

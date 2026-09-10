"use client";

import { useState } from "react";
import { ModuleHeader, Toast } from "../../components/ui";
import { ConfirmDialog } from "../../components/confirm-dialog";
import {
  addressBody,
  editDraft,
  LocationForm,
  newDraft,
  type Draft,
  type LocationView,
} from "./location-form";

const JSON_HEADERS = { "content-type": "application/json" };

export function LocationsConsole({
  initialLocations,
  countryCode,
  activeLimit,
}: {
  initialLocations: LocationView[];
  countryCode: string;
  activeLimit: number;
}) {
  const [locations, setLocations] = useState(initialLocations);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<LocationView | null>(null);

  const active = locations.filter((l) => l.status === "active");
  const archived = locations.filter((l) => l.status === "archived");
  const canAdd = active.length < activeLimit;

  function apply(location: LocationView) {
    setLocations((prev) =>
      prev.some((l) => l.id === location.id)
        ? prev.map((l) => (l.id === location.id ? location : l))
        : [...prev, location],
    );
  }

  async function send(url: string, method: string, body: unknown) {
    const res = await fetch(url, {
      method,
      headers: JSON_HEADERS,
      body: JSON.stringify(body),
    });
    const payload = (await res.json().catch(() => null)) as {
      location?: LocationView;
      error?: string;
    } | null;
    if (!res.ok || !payload?.location) {
      throw new Error(payload?.error ?? "No pudimos guardar el local.");
    }
    return payload.location;
  }

  async function save() {
    if (!draft || busy) return;
    if (!draft.name.trim()) return setError("El nombre es obligatorio.");
    if (!draft.selection && !draft.addressLabel.trim()) {
      return setError("Elegí o escribí una dirección.");
    }
    setBusy(true);
    setError(null);
    try {
      const location = draft.id
        ? await send(`/api/locations/${draft.id}`, "PATCH", {
            name: draft.name.trim(),
            ...(draft.addressChanged ? { address: addressBody(draft) } : {}),
          })
        : await send("/api/locations", "POST", {
            name: draft.name.trim(),
            address: addressBody(draft),
          });
      apply(location);
      setDraft(null);
      setToast(draft.id ? "Local actualizado." : "Local añadido.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos guardar el local.");
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(
    location: LocationView,
    status: "active" | "archived",
  ) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      apply(
        await send(`/api/locations/${location.id}/status`, "POST", { status }),
      );
      setToast(
        status === "archived" ? "Local archivado." : "Local reactivado.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos guardar el local.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="merchant-shell">
      <div className="backoffice-home">
        <ModuleHeader
          eyebrow="Locales"
          title="Las sucursales de tu negocio"
          description="Da de alta, corrige o archiva los locales donde operás."
          closeHref="/backoffice"
        />
        <Toast
          message={error ?? toast}
          kind={error ? "error" : "success"}
          onDismiss={() => {
            setError(null);
            setToast(null);
          }}
        />
        {!draft &&
          (canAdd ? (
            <button
              className="button add-location"
              onClick={() => setDraft(newDraft())}
            >
              + Añadir local
            </button>
          ) : (
            <p className="field-help">
              Tu plan permite {activeLimit}{" "}
              {activeLimit === 1 ? "local activo" : "locales activos"}. Archivá
              uno o mejorá tu plan para abrir otro.
            </p>
          ))}
        {draft && (
          <LocationForm
            draft={draft}
            countryCode={countryCode}
            busy={busy}
            onChange={setDraft}
            onSave={() => void save()}
            onCancel={() => setDraft(null)}
          />
        )}
        <section className="locations-list">
          <h2>Locales activos</h2>
          {active.length === 0 && (
            <p className="counter-hint">No tenés locales activos.</p>
          )}
          {active.map((location) => (
            <article className="location-card" key={location.id}>
              <div>
                <strong>{location.name}</strong>
                <span>⌖ {location.addressLabel}</span>
                <small>Activo</small>
              </div>
              <div>
                <button
                  className="small-button"
                  disabled={busy}
                  onClick={() => setDraft(editDraft(location))}
                >
                  Editar
                </button>
                <button
                  className="archive-button"
                  disabled={busy}
                  onClick={() => setArchiveTarget(location)}
                >
                  Archivar
                </button>
              </div>
            </article>
          ))}
        </section>
        {archived.length > 0 && (
          <section className="locations-list archived">
            <h2>Archivados</h2>
            {archived.map((location) => (
              <article className="location-card" key={location.id}>
                <div>
                  <strong>{location.name}</strong>
                  <span>⌖ {location.addressLabel}</span>
                  <small>Archivado</small>
                </div>
                <div>
                  <button
                    className="small-button"
                    disabled={busy}
                    onClick={() => void setStatus(location, "active")}
                  >
                    Reactivar
                  </button>
                </div>
              </article>
            ))}
          </section>
        )}
        <ConfirmDialog
          open={Boolean(archiveTarget)}
          title="¿Archivar este local?"
          description="Dejará de aparecer en el mostrador y no podrá acreditar ni canjear. Su historial y la visibilidad de sus productos se conservan."
          confirmLabel="Archivar"
          onCancel={() => setArchiveTarget(null)}
          onConfirm={() => {
            if (archiveTarget) void setStatus(archiveTarget, "archived");
            setArchiveTarget(null);
          }}
        />
      </div>
    </main>
  );
}

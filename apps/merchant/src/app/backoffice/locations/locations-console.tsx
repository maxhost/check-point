"use client";

import { useState } from "react";
import {
  Archive,
  EditPencil,
  MapPin,
  Plus,
  RefreshDouble,
  Shop,
} from "iconoir-react";
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
import { LocationErrorDialog } from "./location-error-dialog";
import { LocationsTourController } from "./locations-tour-controller";

const JSON_HEADERS = { "content-type": "application/json" };
type LocationToast = {
  message: string;
  kind: "success" | "info";
  pending?: boolean;
};

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
  const [toast, setToast] = useState<LocationToast | null>(null);
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
    setToast({
      message: draft.id
        ? "Revisando y guardando cambios"
        : "Revisando y creando local",
      kind: "info",
      pending: true,
    });
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
      setToast({
        message: draft.id ? "Local actualizado." : "Local añadido.",
        kind: "success",
      });
    } catch (e) {
      setToast(null);
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
    setToast({
      message:
        status === "archived"
          ? "Revisando y archivando local"
          : "Revisando y reactivando local",
      kind: "info",
      pending: true,
    });
    try {
      apply(
        await send(`/api/locations/${location.id}/status`, "POST", { status }),
      );
      setToast({
        message:
          status === "archived" ? "Local archivado." : "Local reactivado.",
        kind: "success",
      });
    } catch (e) {
      setToast(null);
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
        <LocationsTourController
          canAdd={canAdd}
          planAllowsMultiple={activeLimit > 1}
          hasActiveLocations={active.length > 0}
        />
        <Toast
          message={toast?.message ?? null}
          kind={toast?.kind}
          durationMs={toast?.pending ? null : undefined}
          onDismiss={() => setToast(null)}
        />
        <div className="locations-toolbar">
          <div>
            <strong>
              {active.length}{" "}
              {active.length === 1 ? "local activo" : "locales activos"}
            </strong>
            <span>
              {locations.length}{" "}
              {locations.length === 1 ? "local en total" : "locales en total"}
            </span>
          </div>
          {canAdd ? (
            <button
              className="button"
              data-tour="locations-add"
              onClick={() => setDraft(newDraft())}
            >
              <Plus aria-hidden="true" /> Añadir local
            </button>
          ) : null}
        </div>
        <p className="locations-plan-banner" data-tour="locations-limit">
          Tu plan permite {activeLimit}{" "}
          {activeLimit === 1 ? "local activo" : "locales activos"}.
          {!canAdd && " Archivá uno para poder añadir otro."}
        </p>
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
        <section className="locations-list" data-tour="locations-list">
          <div className="locations-section-title">
            <h2>Locales activos</h2>
            <span>{active.length}</span>
          </div>
          {active.length === 0 && (
            <div className="locations-empty">
              <Shop aria-hidden="true" />
              <p>No tenés locales activos.</p>
            </div>
          )}
          {active.map((location) => (
            <article className="location-card" key={location.id}>
              <span className="location-icon" aria-hidden="true">
                <Shop />
              </span>
              <div className="location-card-copy">
                <strong>{location.name}</strong>
                <span>
                  <MapPin aria-hidden="true" />
                  {location.addressLabel}
                </span>
                <small className="active">Activo</small>
              </div>
              <div className="location-card-actions">
                <button
                  className="small-button"
                  data-tour="location-edit"
                  disabled={busy}
                  onClick={() => setDraft(editDraft(location))}
                >
                  <EditPencil aria-hidden="true" /> Editar
                </button>
                <button
                  className="archive-button"
                  data-tour="location-archive"
                  disabled={busy}
                  onClick={() => setArchiveTarget(location)}
                >
                  <Archive aria-hidden="true" /> Archivar
                </button>
              </div>
            </article>
          ))}
        </section>
        {archived.length > 0 && (
          <section className="locations-list archived">
            <div className="locations-section-title">
              <h2>Archivados</h2>
              <span>{archived.length}</span>
            </div>
            {archived.map((location) => (
              <article className="location-card" key={location.id}>
                <span className="location-icon" aria-hidden="true">
                  <Archive />
                </span>
                <div className="location-card-copy">
                  <strong>{location.name}</strong>
                  <span>
                    <MapPin aria-hidden="true" />
                    {location.addressLabel}
                  </span>
                  <small>Archivado</small>
                </div>
                <div className="location-card-actions">
                  <button
                    className="small-button"
                    disabled={busy}
                    onClick={() => void setStatus(location, "active")}
                  >
                    <RefreshDouble aria-hidden="true" /> Reactivar
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
          confirmTourAnchor="location-archive-confirm"
          onCancel={() => setArchiveTarget(null)}
          onConfirm={() => {
            if (archiveTarget) void setStatus(archiveTarget, "archived");
            setArchiveTarget(null);
          }}
        />
        <LocationErrorDialog message={error} onClose={() => setError(null)} />
      </div>
    </main>
  );
}

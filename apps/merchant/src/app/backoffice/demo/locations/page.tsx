"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { read, save, type DemoState } from "../../../demo";
import { ModuleHeader, Toast } from "../../../components/ui";
import { ConfirmDialog } from "../../../components/confirm-dialog";

type Branch = DemoState["branches"][number];

export default function LocationsPage() {
  const [data, setData] = useState<DemoState | null>(null);
  const [editing, setEditing] = useState<Branch | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<Branch | null>(null);
  useEffect(() => setData(read()), []);
  if (!data)
    return (
      <main className="merchant-shell">
        <div className="module-placeholder">
          <h1>Primero completa el onboarding</h1>
          <Link className="button" href="/onboarding">
            Ir al onboarding
          </Link>
        </div>
      </main>
    );
  const branches = data.branches.map((branch, index) => ({
    ...branch,
    id: branch.id ?? `local-${index}`,
    status: branch.status ?? "active",
  }));
  const persist = (next: Branch[], message: string) => {
    const updated = { ...data, branches: next };
    setData(updated);
    save(updated);
    setToast(message);
  };
  const active = branches.filter((branch) => branch.status === "active");
  const archived = branches.filter((branch) => branch.status === "archived");
  const saveLocation = () => {
    if (!editing?.name || !editing.address)
      return setToast("Completa nombre y dirección.");
    const exists = branches.some((branch) => branch.id === editing.id);
    persist(
      exists
        ? branches.map((branch) =>
            branch.id === editing.id
              ? { ...editing, status: "active" }
              : branch,
          )
        : [
            ...branches,
            { ...editing, id: crypto.randomUUID(), status: "active" },
          ],
      exists ? "Local actualizado." : "Local añadido.",
    );
    setEditing(null);
  };
  return (
    <main className="merchant-shell">
      <div className="backoffice-home">
        <ModuleHeader
          eyebrow="Locales"
          title={`Las sucursales de ${data.businessName}`}
          closeHref="/backoffice/demo"
        />
        <Toast message={toast} onDismiss={() => setToast(null)} />
        <button
          className="button add-location"
          onClick={() =>
            setEditing({ name: "", address: "", status: "active" })
          }
        >
          + Añadir local
        </button>
        {editing && (
          <section className="panel location-form">
            <h2>{editing.id ? "Editar local" : "Nuevo local"}</h2>
            <label>
              Nombre del local
              <input
                value={editing.name}
                onChange={(e) =>
                  setEditing({ ...editing, name: e.target.value })
                }
              />
            </label>
            <label>
              Dirección
              <input
                value={editing.address}
                onChange={(e) =>
                  setEditing({ ...editing, address: e.target.value })
                }
                placeholder="Busca o escribe la dirección"
              />
            </label>
            <div className="map-placeholder">
              <strong>Mapa del local</strong>
              <span>
                Marcador de demostración · Mapbox se conectará más adelante.
              </span>
            </div>
            <button className="button" onClick={saveLocation}>
              Guardar local
            </button>
            <button className="button alt" onClick={() => setEditing(null)}>
              Cancelar
            </button>
          </section>
        )}
        <section className="locations-list">
          <h2>Locales activos</h2>
          {active.map((branch) => (
            <article className="location-card" key={branch.id}>
              <div>
                <strong>{branch.name}</strong>
                <span>⌖ {branch.address}</span>
              </div>
              <div>
                <button
                  className="small-button"
                  onClick={() => setEditing(branch)}
                >
                  Editar
                </button>
                <button
                  className="archive-button"
                  onClick={() => setArchiveTarget(branch)}
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
            {archived.map((branch) => (
              <article className="location-card" key={branch.id}>
                <div>
                  <strong>{branch.name}</strong>
                  <span>⌖ {branch.address}</span>
                </div>
              </article>
            ))}
          </section>
        )}
        <ConfirmDialog
          open={Boolean(archiveTarget)}
          title="¿Archivar este local?"
          description="Dejará de estar disponible para operar campañas, pero su historial se conserva."
          confirmLabel="Archivar"
          onCancel={() => setArchiveTarget(null)}
          onConfirm={() => {
            if (archiveTarget)
              persist(
                branches.map((item) =>
                  item.id === archiveTarget.id
                    ? { ...item, status: "archived" }
                    : item,
                ),
                "Local archivado.",
              );
            setArchiveTarget(null);
          }}
        />
      </div>
    </main>
  );
}

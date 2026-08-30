"use client";

import { useState } from "react";
import { ModuleHeader, Toast } from "../../components/ui";
import { ConfirmDialog } from "../../components/confirm-dialog";

type StaffDTO = {
  userId: string;
  name: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
};

const JSON_HEADERS = { "content-type": "application/json" };
const emptyDraft = { name: "", email: "", password: "" };

export function StaffConsole({ initialStaff }: { initialStaff: StaffDTO[] }) {
  const [staff, setStaff] = useState<StaffDTO[]>(initialStaff);
  const [draft, setDraft] = useState(emptyDraft);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [disableTarget, setDisableTarget] = useState<StaffDTO | null>(null);

  async function create() {
    if (busy) return;
    if (!draft.name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email)) {
      setError("Completa nombre y un email válido.");
      return;
    }
    if (draft.password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/staff", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify(draft),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload || !("staff" in payload)) {
        throw new Error(payload?.error ?? "No pudimos crear al integrante.");
      }
      setStaff((prev) => [...prev, payload.staff as StaffDTO]);
      setDraft(emptyDraft);
      setCreating(false);
      setToast("Integrante creado.");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No pudimos crear al integrante.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(member: StaffDTO, status: "active" | "disabled") {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/staff/${member.userId}/status`, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ status }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload || !("staff" in payload)) {
        throw new Error(payload?.error ?? "No pudimos actualizar el estado.");
      }
      const updated = payload.staff as StaffDTO;
      setStaff((prev) =>
        prev.map((s) => (s.userId === updated.userId ? updated : s)),
      );
      setToast(
        status === "disabled"
          ? "Integrante desactivado: acceso revocado."
          : "Integrante reactivado.",
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No pudimos actualizar el estado.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="merchant-shell">
      <div className="backoffice-home">
        <ModuleHeader
          eyebrow="Personal"
          title="Tu equipo"
          description="Da de alta a quienes operan el mostrador."
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
        {!creating && (
          <button
            className="button add-location"
            onClick={() => {
              setDraft(emptyDraft);
              setCreating(true);
            }}
          >
            + Añadir integrante
          </button>
        )}
        {creating && (
          <section className="panel location-form">
            <h2>Nuevo integrante</h2>
            <label>
              Nombre
              <input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </label>
            <label>
              Email
              <input
                type="email"
                autoComplete="off"
                value={draft.email}
                onChange={(e) => setDraft({ ...draft, email: e.target.value })}
              />
            </label>
            <label>
              Contraseña
              <input
                type="password"
                autoComplete="new-password"
                value={draft.password}
                onChange={(e) =>
                  setDraft({ ...draft, password: e.target.value })
                }
              />
            </label>
            <p className="field-help">Mínimo 8 caracteres.</p>
            <button
              className="button"
              disabled={busy}
              onClick={() => void create()}
            >
              {busy ? "Creando…" : "Crear integrante"}
            </button>
            <button
              className="button alt"
              onClick={() => {
                setCreating(false);
                setDraft(emptyDraft);
              }}
            >
              Cancelar
            </button>
          </section>
        )}
        <section className="locations-list">
          <h2>Personal</h2>
          {staff.length === 0 && (
            <p className="counter-hint">Todavía no diste de alta a nadie.</p>
          )}
          {staff.map((member) => (
            <article className="location-card" key={member.userId}>
              <div>
                <strong>{member.name}</strong>
                <span>{member.email}</span>
                <small>
                  {member.role === "owner" ? "Owner" : "Staff"} ·{" "}
                  {member.status === "active" ? "Activo" : "Desactivado"}
                </small>
              </div>
              <div>
                {member.status === "active" ? (
                  <button
                    className="archive-button"
                    disabled={busy}
                    onClick={() => setDisableTarget(member)}
                  >
                    Desactivar
                  </button>
                ) : (
                  <button
                    className="small-button"
                    disabled={busy}
                    onClick={() => void setStatus(member, "active")}
                  >
                    Reactivar
                  </button>
                )}
              </div>
            </article>
          ))}
        </section>
        <ConfirmDialog
          open={Boolean(disableTarget)}
          title="¿Desactivar a este integrante?"
          description="Cerrará sus sesiones y no podrá operar el mostrador hasta reactivarlo."
          confirmLabel="Desactivar"
          onCancel={() => setDisableTarget(null)}
          onConfirm={() => {
            if (disableTarget) void setStatus(disableTarget, "disabled");
            setDisableTarget(null);
          }}
        />
      </div>
    </main>
  );
}

"use client";

import { useEffect, useState } from "react";
import { ModuleHeader, Toast } from "../../../components/ui";
import { ConfirmDialog } from "../../../components/confirm-dialog";

type Member = {
  id: string;
  name: string;
  email: string;
  permissions: string[];
  status: "active" | "archived";
};
const storageKey = "merchant-demo-staff";
const permissions = ["Operar check-in", "Canjear beneficios", "Ver campañas"];
const initial: Member[] = [
  {
    id: "staff-demo",
    name: "Ana López",
    email: "ana@bardemo.ec",
    permissions: [permissions[0]],
    status: "active",
  },
];

export default function StaffPage() {
  const [members, setMembers] = useState<Member[]>(initial);
  const [editing, setEditing] = useState<Member | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Member | null>(null);
  useEffect(() => {
    const saved = sessionStorage.getItem(storageKey);
    if (saved) setMembers(JSON.parse(saved));
  }, []);
  const persist = (next: Member[], message: string) => {
    setMembers(next);
    sessionStorage.setItem(storageKey, JSON.stringify(next));
    setToast(message);
  };
  const save = () => {
    if (!editing?.name || !/^\S+@\S+\.\S+$/.test(editing.email))
      return setToast("Completa nombre y un email válido.");
    const exists = members.some((item) => item.id === editing.id);
    persist(
      exists
        ? members.map((item) => (item.id === editing.id ? editing : item))
        : [
            ...members,
            { ...editing, id: crypto.randomUUID(), status: "active" },
          ],
      exists ? "Staff actualizado." : "Invitación simulada enviada.",
    );
    setEditing(null);
  };
  const active = members.filter((member) => member.status === "active");
  const archived = members.filter((member) => member.status === "archived");
  return (
    <main className="merchant-shell">
      <div className="backoffice-home">
        <ModuleHeader
          eyebrow="Staff"
          title="Tu equipo"
          description="Gestiona quién puede operar tus locales."
          closeHref="/backoffice/demo"
        />
        <Toast message={toast} onDismiss={() => setToast(null)} />
        <button
          className="button add-location"
          onClick={() =>
            setEditing({
              id: "",
              name: "",
              email: "",
              permissions: [],
              status: "active",
            })
          }
        >
          + Añadir Staff
        </button>
        {editing && (
          <section className="panel location-form">
            <h2>{editing.id ? "Editar Staff" : "Nuevo miembro"}</h2>
            <label>
              Nombre
              <input
                value={editing.name}
                onChange={(e) =>
                  setEditing({ ...editing, name: e.target.value })
                }
              />
            </label>
            <label>
              Email
              <input
                type="email"
                value={editing.email}
                onChange={(e) =>
                  setEditing({ ...editing, email: e.target.value })
                }
              />
            </label>
            <h2 className="color-heading">Permisos</h2>
            {permissions.map((permission) => (
              <label className="permission-row" key={permission}>
                <input
                  type="checkbox"
                  checked={editing.permissions.includes(permission)}
                  onChange={() =>
                    setEditing({
                      ...editing,
                      permissions: editing.permissions.includes(permission)
                        ? editing.permissions.filter(
                            (item) => item !== permission,
                          )
                        : [...editing.permissions, permission],
                    })
                  }
                />
                {permission}
              </label>
            ))}
            <button className="button" onClick={save}>
              Guardar Staff
            </button>
            <button className="button alt" onClick={() => setEditing(null)}>
              Cancelar
            </button>
          </section>
        )}
        <section className="locations-list">
          <h2>Staff activo</h2>
          {active.map((member) => (
            <article className="location-card" key={member.id}>
              <div>
                <strong>{member.name}</strong>
                <span>{member.email}</span>
                <small>
                  {member.permissions.join(" · ") || "Sin permisos"}
                </small>
              </div>
              <div>
                <button
                  className="small-button"
                  onClick={() =>
                    setToast(`Email de acceso reenviado a ${member.email}.`)
                  }
                >
                  Reenviar email
                </button>
                <button
                  className="small-button"
                  onClick={() => setEditing(member)}
                >
                  Editar
                </button>
                <button
                  className="archive-button"
                  onClick={() =>
                    persist(
                      members.map((item) =>
                        item.id === member.id
                          ? { ...item, status: "archived" }
                          : item,
                      ),
                      "Staff archivado: acceso revocado.",
                    )
                  }
                >
                  Archivar
                </button>
                <button
                  className="delete-button"
                  onClick={() => setDeleteTarget(member)}
                >
                  Eliminar
                </button>
              </div>
            </article>
          ))}
        </section>
        {archived.length > 0 && (
          <section className="locations-list archived">
            <h2>Staff archivado · sin acceso</h2>
            {archived.map((member) => (
              <article className="location-card" key={member.id}>
                <div>
                  <strong>{member.name}</strong>
                  <span>{member.email}</span>
                </div>
              </article>
            ))}
          </section>
        )}
        <ConfirmDialog
          open={Boolean(deleteTarget)}
          title="¿Eliminar este miembro?"
          description="Esta acción lo quitará del Staff de este negocio en el demo."
          confirmLabel="Eliminar"
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => {
            if (deleteTarget)
              persist(
                members.filter((item) => item.id !== deleteTarget.id),
                "Staff eliminado.",
              );
            setDeleteTarget(null);
          }}
        />
      </div>
    </main>
  );
}

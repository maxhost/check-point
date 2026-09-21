import { PermissionPicker } from "./permission-picker";
import type { StaffMember } from "./staff-contract";
import { Skeleton, SkeletonScreen } from "../../components/ui";
import { TextField } from "../../../ui";
import { StaffFormModal } from "./staff-form-modal";

export type StaffDraft = {
  member: StaffMember;
  name: string;
  permissions: string[];
};
export type StaffConfirmation = {
  action: "status" | "pin";
  member: StaffMember;
};
export type StaffCredential = {
  member: StaffMember;
  pin: string;
  regenerated: boolean;
};

export function StaffSkeleton() {
  return (
    <SkeletonScreen className="staff-skeleton" label="Cargando equipo">
      <div className="staff-toolbar">
        <div>
          <Skeleton height={18} width={92} />
          <Skeleton height={13} width={128} />
        </div>
        <Skeleton className="staff-skeleton-button" height={44} width={162} />
      </div>
      <div className="staff-list">
        {["first", "second", "third"].map((key, index) => (
          <div className="staff-card" key={key}>
            <Skeleton height={42} radius={13} width={42} />
            <div className="staff-skeleton-copy">
              <div>
                <Skeleton height={16} width={index === 1 ? "52%" : "38%"} />
                <Skeleton height={20} radius={99} width={58} />
              </div>
              <Skeleton height={12} width={index === 2 ? "68%" : "56%"} />
              <Skeleton height={11} width={index === 1 ? "76%" : "62%"} />
            </div>
            <Skeleton
              className="staff-skeleton-manage"
              height={36}
              width={82}
            />
          </div>
        ))}
      </div>
    </SkeletonScreen>
  );
}

export function CreateStaffPanel({
  open,
  name,
  permissions,
  isOwner,
  busy,
  onName,
  onPermissions,
  onCancel,
  onCreate,
}: {
  open: boolean;
  name: string;
  permissions: string[];
  isOwner: boolean;
  busy: boolean;
  onName: (value: string) => void;
  onPermissions: (value: string[]) => void;
  onCancel: () => void;
  onCreate: () => void;
}) {
  if (!open) return null;
  return (
    <StaffFormModal
      open={open}
      eyebrow="Alta"
      title="Nuevo integrante"
      description="Definí su nombre y a qué partes del negocio tendrá acceso."
      onClose={onCancel}
    >
      <TextField
        className="staff-name-field"
        data-tour="staff-name"
        label="Nombre"
        placeholder="Ej.: Carla Gómez"
        maxLength={80}
        value={name}
        onChange={onName}
        autoComplete="off"
        isRequired
      />
      <PermissionPicker
        value={permissions}
        onChange={onPermissions}
        isOwner={isOwner}
        disabled={busy}
      />
      <button
        className="button"
        data-tour="staff-create"
        disabled={busy}
        onClick={onCreate}
      >
        {busy ? "Creando…" : "Crear y mostrar PIN"}
      </button>
    </StaffFormModal>
  );
}

export function StaffList({
  members,
  loading,
  onEdit,
}: {
  members: StaffMember[];
  loading: boolean;
  onEdit: (member: StaffMember) => void;
}) {
  if (loading) return null;
  if (!members.length)
    return (
      <section className="staff-empty" data-tour="staff-members">
        <h2>Sumá a tu primera persona</h2>
        <p>
          Elegí al menos un permiso. El identificador lo crea el sistema y el
          PIN aparecerá una sola vez.
        </p>
      </section>
    );
  return (
    <section
      className="staff-list"
      aria-label="Integrantes"
      data-tour="staff-members"
    >
      {members.map((member) => (
        <article className="staff-card" key={member.userId}>
          <div className="staff-avatar" aria-hidden="true">
            {member.name.slice(0, 1).toUpperCase()}
          </div>
          <div className="staff-card-copy">
            <div>
              <strong>{member.name}</strong>
              <span className={`staff-status ${member.status}`}>
                {member.status === "active" ? "Activo" : "Dado de baja"}
              </span>
            </div>
            <code>{member.identifier}</code>
            <p>
              {member.permissions
                .map((id) => (id === "staff" ? "Administrador" : id))
                .join(" · ")}
            </p>
          </div>
          <button
            className="small-button"
            data-tour="staff-member-manage"
            onClick={() => onEdit(member)}
          >
            Gestionar
          </button>
        </article>
      ))}
    </section>
  );
}

export function StaffEditor({
  draft,
  busy,
  isOwner,
  ownId,
  onDraft,
  onClose,
  onSave,
  onAction,
}: {
  draft: StaffDraft;
  busy: boolean;
  isOwner: boolean;
  ownId?: string;
  onDraft: (draft: StaffDraft) => void;
  onClose: () => void;
  onSave: () => void;
  onAction: (action: "status" | "pin") => void;
}) {
  const own = draft.member.userId === ownId;
  const protectedAdministrator =
    !isOwner && draft.member.permissions.includes("staff");
  return (
    <StaffFormModal
      open
      eyebrow="Integrante"
      title={draft.member.name}
      description={draft.member.identifier}
      onClose={onClose}
    >
      <TextField
        className="staff-name-field"
        data-tour="staff-edit-name"
        label="Nombre"
        placeholder="Ej.: Carla Gómez"
        maxLength={80}
        isDisabled={draft.member.status === "disabled" || busy}
        value={draft.name}
        onChange={(name) => onDraft({ ...draft, name })}
        autoComplete="off"
        isRequired
      />
      {draft.member.status === "disabled" && (
        <p className="staff-inline-warning">
          Está dado de baja. Reactivalo para poder renombrarlo.
        </p>
      )}
      {draft.name.trim() !== draft.member.name && (
        <p className="staff-inline-warning">
          <strong>Atención:</strong> al guardar el nombre cambiará su
          identificador de acceso. No recibirá ninguna notificación; tendrás que
          compartirle el nuevo.
        </p>
      )}
      <div data-tour="staff-edit-permissions">
        <PermissionPicker
          value={draft.permissions}
          onChange={(permissions) => onDraft({ ...draft, permissions })}
          isOwner={isOwner}
          disabled={busy || own || protectedAdministrator}
        />
      </div>
      {own && (
        <p className="field-help">
          No podés editar tus propios permisos, pero sí tu nombre.
        </p>
      )}
      {protectedAdministrator && (
        <p className="field-help">
          Sólo el owner puede modificar los permisos de un Administrador.
        </p>
      )}
      <button
        className="button"
        data-tour="staff-edit-save"
        disabled={busy}
        onClick={onSave}
      >
        Guardar cambios
      </button>
      <div className="staff-secondary-actions">
        <button
          className="small-button"
          data-tour="staff-status"
          disabled={busy}
          onClick={() => onAction("status")}
        >
          {draft.member.status === "active" ? "Dar de baja" : "Reactivar"}
        </button>
        {/* Enmienda §11 de la spec 0088: el boton NO es owner-only. La API ya delega
            `pin/regenerate` en el permiso `staff` (`api/staff/_auth.ts:66`,
            `requireApiPermission(request, "staff")`) y el copy del picker se lo promete con
            todas las letras («puede crear a terceros, ver sus PIN»). Con el gate `isOwner`
            puesto, la ayuda «Regenerar un PIN» —que el menu ofrece a cualquier
            administrador— quedaba esperando un `[data-tour="staff-pin"]` que para el nunca
            se renderizaba.

            **Y SE RENDERIZA SIEMPRE, deshabilitado en vez de ausente** (segunda vuelta de
            revision): con `{!own && …}` el anchor DESAPARECIA al abrir Gestionar sobre la
            propia fila, y `startOnboardingTour` corre con `skipMissingElement: false` y
            `waitForElement: 60_000` (`onboarding/onboarding-tour.ts:80-81`), o sea que el
            recorrido se quedaba hasta 60 s sin responder y despues dibujaba el popover sin
            anclar. Un control deshabilitado con su motivo al lado es la unica forma de que
            el corte exista Y el tour siga teniendo a que apuntar.

            El corte sobre uno mismo se conserva porque rotarse el PIN revoca las propias
            sesiones (el `DELETE` de la ruta): es un cierre de sesion sin aviso. La API NO lo
            frena —no tiene `assertNotSelf`, a diferencia de `staff-permissions.ts:114`—, asi
            que este disabled es la unica barrera y por eso lleva el motivo escrito. La
            membresia del OWNER no aparece en esta lista, asi que `own` solo se da entre
            integrantes. */}
        <button
          className="small-button pin"
          data-tour="staff-pin"
          disabled={busy || own}
          onClick={() => onAction("pin")}
        >
          Regenerar PIN
        </button>
      </div>
      {own && (
        <p className="field-help">
          No podés regenerar tu propio PIN: cerraría tu sesión al instante.
        </p>
      )}
    </StaffFormModal>
  );
}

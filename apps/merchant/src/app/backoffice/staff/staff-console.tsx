"use client";

import { useState } from "react";
import { ModuleHeader, Toast } from "../../components/ui";
import { ConfirmDialog } from "../../components/confirm-dialog";
import { CredentialDialog } from "./credential-dialog";
import type { StaffMember } from "./staff-contract";
import { createStaff, renameStaff, savePermissions } from "./staff-api";
import {
  CreateStaffPanel,
  StaffEditor,
  StaffList,
  StaffSkeleton,
  type StaffDraft,
} from "./staff-views";
import { useStaffActions } from "./use-staff-actions";
import { StaffTourController } from "./staff-tour-controller";
import {
  IDLE_RESULT as IDLE,
  saveResultToast,
  type SaveResult,
} from "./staff-save-result";
import { useStaffData } from "./use-staff-data";

export function StaffConsole() {
  const { error, loading, members, session, setError, setMembers } =
    useStaffData();
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createPermissions, setCreatePermissions] = useState<string[]>([
    "counter",
  ]);
  const [draft, setDraft] = useState<StaffDraft | null>(null);
  const [nameResult, setNameResult] = useState<SaveResult>(IDLE);
  const [permissionResult, setPermissionResult] = useState<SaveResult>(IDLE);
  const [busy, setBusy] = useState(false);

  const isOwner = session?.membership?.role === "owner";
  const ownId = session?.user?.id;
  const { message: saveToast, kind: saveToastKind } = saveResultToast(
    nameResult,
    permissionResult,
  );
  function closeCreate() {
    setCreateOpen(false);
    setCreateName("");
    setCreatePermissions(["counter"]);
    setError(null);
  }

  function apply(member: StaffMember) {
    setMembers((current) =>
      current.map((item) => (item.userId === member.userId ? member : item)),
    );
    setDraft((current) =>
      current?.member.userId === member.userId
        ? { ...current, member }
        : current,
    );
  }
  const {
    actionToast,
    setActionToast,
    confirm,
    setConfirm,
    credential,
    setCredential,
    runConfirmed,
  } = useStaffActions({ apply, setDraft, setBusy });

  async function createMember() {
    if (busy) return;
    if (!createName.trim())
      return setError("Escribí el nombre del integrante.");
    if (!createPermissions.length)
      return setError("Elegí al menos un permiso.");
    setBusy(true);
    setError(null);
    try {
      const payload = await createStaff(createName.trim(), createPermissions);
      setMembers((current) => [...current, payload.staff]);
      setCredential({
        member: payload.staff,
        pin: payload.pin,
        regenerated: false,
      });
      setCreateOpen(false);
      setCreateName("");
      setCreatePermissions(["counter"]);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "No pudimos crear al integrante.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function saveDraft() {
    if (!draft || busy) return;
    const nameChanged = draft.name.trim() !== draft.member.name;
    const permissionsChanged =
      JSON.stringify([...draft.permissions].sort()) !==
      JSON.stringify([...draft.member.permissions].sort());
    setBusy(true);
    setNameResult(
      nameChanged ? { kind: "idle", text: "Guardando nombre…" } : IDLE,
    );
    setPermissionResult(
      permissionsChanged ? { kind: "idle", text: "Guardando permisos…" } : IDLE,
    );
    if (nameChanged) {
      try {
        const payload = await renameStaff(draft.member, draft.name.trim());
        apply(payload.staff);
        setNameResult({
          kind: "success",
          text: `Nombre guardado. Nuevo identificador: ${payload.staff.identifier}. Compartilo: no se le notificará automáticamente.`,
        });
      } catch (reason) {
        setNameResult({
          kind: "error",
          text:
            reason instanceof Error
              ? reason.message
              : "No pudimos guardar el nombre.",
        });
      }
    }
    if (permissionsChanged) {
      try {
        const payload = await savePermissions(draft.member, draft.permissions);
        apply(payload.staff);
        setPermissionResult({ kind: "success", text: "Permisos guardados." });
      } catch (reason) {
        setPermissionResult({
          kind: "error",
          text:
            reason instanceof Error
              ? reason.message
              : "No pudimos guardar los permisos.",
        });
      }
    }
    setBusy(false);
  }

  return (
    <main className="merchant-shell">
      <div className="backoffice-home staff-page">
        <ModuleHeader
          eyebrow="Staff"
          title="Tu equipo"
          description="Definí quién entra al backoffice y qué puede gestionar."
          closeHref="/backoffice"
        />
        <StaffTourController
          loading={loading}
          hasMembers={members.length > 0}
        />
        <Toast
          message={actionToast?.message ?? saveToast}
          kind={actionToast?.kind ?? saveToastKind}
          durationMs={actionToast?.pending ? null : undefined}
          onDismiss={() => {
            if (actionToast) setActionToast(null);
            else {
              setNameResult(IDLE);
              setPermissionResult(IDLE);
            }
          }}
        />
        {error && (
          <div className="staff-alert error" role="alert">
            <span>{error}</span>
            <button onClick={() => setError(null)}>Cerrar</button>
          </div>
        )}
        {loading ? (
          <StaffSkeleton />
        ) : (
          <>
            <div className="staff-toolbar">
              <div>
                <strong>
                  {members.filter((m) => m.status === "active").length} activos
                </strong>
                <span>{members.length} integrantes en total</span>
              </div>
              <button
                className="button"
                data-tour="staff-add"
                onClick={() => setCreateOpen(true)}
              >
                + Añadir integrante
              </button>
            </div>
            <CreateStaffPanel
              open={createOpen}
              name={createName}
              permissions={createPermissions}
              isOwner={Boolean(isOwner)}
              busy={busy}
              onName={setCreateName}
              onPermissions={setCreatePermissions}
              onCancel={closeCreate}
              onCreate={() => void createMember()}
            />
            <StaffList
              members={members}
              loading={loading}
              onEdit={(member) => {
                setDraft({
                  member,
                  name: member.name,
                  permissions: member.permissions,
                });
                setNameResult(IDLE);
                setPermissionResult(IDLE);
              }}
            />
          </>
        )}
        {draft && (
          <StaffEditor
            draft={draft}
            busy={busy}
            isOwner={Boolean(isOwner)}
            ownId={ownId}
            onDraft={setDraft}
            onClose={() => setDraft(null)}
            onSave={() => void saveDraft()}
            onAction={(action) => setConfirm({ action, member: draft.member })}
          />
        )}
        <ConfirmDialog
          open={Boolean(confirm)}
          title={
            confirm?.action === "pin"
              ? "¿Regenerar el PIN?"
              : confirm?.member.status === "active"
                ? "¿Dar de baja al integrante?"
                : "¿Reactivar al integrante?"
          }
          description={
            confirm?.action === "pin"
              ? "El PIN actual dejará de funcionar y se cerrarán sus sesiones. El nuevo PIN se mostrará una sola vez."
              : confirm?.member.status === "active"
                ? "Perderá el acceso y se cerrarán sus sesiones. Podés reactivarlo cuando quieras."
                : "Recuperará el acceso con su identificador y PIN actuales."
          }
          confirmLabel={
            confirm?.action === "pin"
              ? "Regenerar PIN"
              : confirm?.member.status === "active"
                ? "Dar de baja"
                : "Reactivar"
          }
          confirmTourAnchor={
            confirm?.action === "pin"
              ? "staff-pin-confirm"
              : "staff-status-confirm"
          }
          onCancel={() => setConfirm(null)}
          onConfirm={() => void runConfirmed()}
        />
        {credential && (
          <CredentialDialog
            name={credential.member.name}
            identifier={credential.member.identifier}
            pin={credential.pin}
            regenerated={credential.regenerated}
            onClose={() => setCredential(null)}
          />
        )}
      </div>
    </main>
  );
}

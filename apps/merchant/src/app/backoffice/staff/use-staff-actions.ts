"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import { regeneratePin, saveStatus } from "./staff-api";
import type { StaffMember } from "./staff-contract";
import type {
  StaffConfirmation,
  StaffCredential,
  StaffDraft,
} from "./staff-views";

export function useStaffActions({
  apply,
  setDraft,
  setBusy,
}: {
  apply: (member: StaffMember) => void;
  setDraft: Dispatch<SetStateAction<StaffDraft | null>>;
  setBusy: Dispatch<SetStateAction<boolean>>;
}) {
  const [confirm, setConfirm] = useState<StaffConfirmation | null>(null);
  const [credential, setCredential] = useState<StaffCredential | null>(null);
  const [actionToast, setActionToast] = useState<{
    message: string;
    kind: "success" | "warning" | "error";
    pending?: boolean;
  } | null>(null);

  async function runConfirmed() {
    if (!confirm) return;
    const target = confirm;
    setConfirm(null);
    setDraft(null);
    setBusy(true);
    setActionToast({
      message:
        target.action === "pin"
          ? "Regenerando el PIN, esperá un momento…"
          : target.member.status === "active"
            ? "Dando de baja al integrante, esperá un momento…"
            : "Reactivando al integrante, esperá un momento…",
      kind: "warning",
      pending: true,
    });
    try {
      if (target.action === "status") {
        const status =
          target.member.status === "active" ? "disabled" : "active";
        const payload = await saveStatus(target.member, status);
        apply(payload.staff);
        setActionToast({
          message:
            status === "disabled"
              ? "Integrante dado de baja."
              : "Integrante reactivado.",
          kind: "success",
        });
      } else {
        const payload = await regeneratePin(target.member);
        apply(payload.staff);
        setCredential({
          member: payload.staff,
          pin: payload.pin,
          regenerated: true,
        });
        setActionToast({
          message: "PIN regenerado correctamente.",
          kind: "success",
        });
      }
    } catch (reason) {
      setActionToast({
        message:
          reason instanceof Error
            ? reason.message
            : "No pudimos completar la acción.",
        kind: "error",
      });
    } finally {
      setBusy(false);
    }
  }

  return {
    actionToast,
    setActionToast,
    confirm,
    setConfirm,
    credential,
    setCredential,
    runConfirmed,
  };
}

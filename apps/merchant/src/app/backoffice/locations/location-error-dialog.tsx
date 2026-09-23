"use client";

import { WarningTriangle } from "iconoir-react";
import { StaffFormModal } from "../staff/staff-form-modal";

export function LocationErrorDialog({
  message,
  onClose,
}: {
  message: string | null;
  onClose: () => void;
}) {
  return (
    <StaffFormModal
      open={Boolean(message)}
      eyebrow="No se pudo completar"
      title="Revisemos este local"
      onClose={onClose}
    >
      <div className="location-error-copy" role="alert">
        <span aria-hidden="true">
          <WarningTriangle />
        </span>
        <p>{message}</p>
      </div>
      <button className="button" type="button" onClick={onClose}>
        Entendido
      </button>
    </StaffFormModal>
  );
}

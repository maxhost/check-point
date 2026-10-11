"use client";

import Link from "next/link";
import { ConfirmDialog } from "../../components/confirm-dialog";
import { formatDate } from "./subscription-format";
import { BLOCK_ACTIONS } from "./block-actions";

/** Spec 0189: cancelación al fin del período, sin perder acceso al confirmar. */
export function CancelDialog({
  open,
  title,
  block,
  busy,
  renewalAt,
  timezone,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  /** La etiqueta de cancelación que decidió el servidor. */
  title: string;
  /** `null` = la baja procede. Si no, el mensaje del servidor y el `code` del bloqueo
   * (`null` en el genérico de la consola, que no tiene a dónde mandar). */
  block: { message: string; code: string | null } | null;
  busy: boolean;
  /** ISO string de la renovación, o `null` si Stripe no contestó. Decide si hay aviso. */
  renewalAt: string | null;
  timezone: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const action = block?.code == null ? undefined : BLOCK_ACTIONS[block.code];
  return (
    <ConfirmDialog
      open={open}
      title={title}
      confirmLabel={busy ? "Confirmando…" : "Confirmar"}
      cancelLabel="Volver"
      confirmDisabled={block !== null || busy}
      onCancel={onCancel}
      onConfirm={onConfirm}
      description={
        block === null ? (
          <>
            Tu suscripción seguirá activa hasta el final del período actual.
            {renewalAt !== null && (
              <> El acceso termina el {formatDate(renewalAt, timezone)}.</>
            )}{" "}
            Después se bloqueará el acceso al negocio. Puedes reanudarla antes
            de esa fecha.
          </>
        ) : (
          <>
            {block.message}
            {action !== undefined && (
              <>
                {" "}
                <Link href={action.href}>{action.label}</Link>
              </>
            )}
          </>
        )
      }
    />
  );
}

"use client";

import { ConfirmDialog } from "../../components/confirm-dialog";

/**
 * Spec 0064, F2-2 — LA CONFIRMACIÓN DEL CAMBIO DE INTERVALO.
 *
 * SALE DEL QA DEL OWNER SOBRE LA 0063: «Pasar a anual» aplicaba el cambio EN EL ACTO y cobraba
 * inmediato (`proration_behavior: "always_invoice"` en la ruta `interval`), o sea que un click
 * suelto movía plata sin una sola pantalla de confirmación. La spec 0063 nunca lo pidió; nadie
 * lo nota hasta que usa la pantalla.
 *
 * EL TEXTO DICE LAS TRES COSAS QUE HACEN QUE LA CONFIRMACIÓN SIRVA: que el cobro es INMEDIATO
 * (no al final del período), que se cobra la diferencia con crédito por lo que no se usó del
 * mes, y que a partir de ahí la renovación pasa a ser anual. Un modal que sólo dijera «¿estás
 * seguro?» no agrega información: sería un click más sobre la misma sorpresa.
 *
 * Reusa `ConfirmDialog` —igual que `CancelDialog`— en vez de reimplementar la trampa de foco y
 * el Escape, que tienen su propio oráculo en `confirm-dialog-focus.test.ts`.
 */
export function IntervalDialog({
  open,
  busy,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <ConfirmDialog
      open={open}
      title="Pasar a facturación anual"
      confirmLabel={busy ? "Confirmando…" : "Confirmar y pagar"}
      cancelLabel="Volver"
      confirmDisabled={busy}
      onCancel={onCancel}
      onConfirm={onConfirm}
      description="El cobro es INMEDIATO: al confirmar se te cobra ahora la diferencia hasta completar el año, con crédito por los días que no usaste del mes. Desde entonces tu plan se renueva una vez por año."
    />
  );
}

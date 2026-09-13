"use client";

import Link from "next/link";
import { ConfirmDialog } from "../../components/confirm-dialog";

/**
 * Spec 0063, D7 / ADR 0058 §8 — EL MODAL DE CONDICIONES DE LA BAJA.
 *
 * El botón que abre este modal NO se deshabilita nunca, ni con N locales activos: es la
 * respuesta literal del owner («el usuario no sabría qué debe hacer»). Se aprieta igual y
 * ACÁ se le dice qué falta, con el link para ir a hacerlo. Lo que no está disponible es
 * «Confirmar».
 *
 * EL TEXTO DEL BLOQUEO NO SE ESCRIBE ACÁ: llega en `block.message` y es LITERALMENTE el
 * mensaje que devolvería el 409 del servidor, porque sale de la misma llamada a
 * `decidePlanChange` (`page.tsx`). Escribir acá un segundo texto con el mismo conteo sería
 * la divergencia que D10 prohíbe: el día que cambie el tope de Free, uno de los dos
 * quedaría viejo mintiéndole al owner sobre cuántos locales archivar.
 *
 * Reusa `ConfirmDialog` en vez de reimplementar la trampa de foco y el Escape; lo que le
 * costó son dos props retrocompatibles, declaradas en ese archivo.
 */
export function CancelDialog({
  open,
  title,
  block,
  busy,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  /** La etiqueta del botón que lo abrió: «Bajar a Free» en `plus`, «Ajustarme y bajar a
   * Free» en `none`. El modal es el MISMO para los dos (D10: la misma rama, no una segunda
   * regla que pueda divergir). */
  title: string;
  /** `null` = la baja procede. Si no, el mensaje del servidor y cuántos locales archivar. */
  block: { message: string; archiveCount: number } | null;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
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
          "Tu plan Plus termina al final del período que ya pagaste y el negocio queda en Free. Podés reanudarlo antes de esa fecha."
        ) : (
          <>
            {block.message}{" "}
            <Link href="/backoffice/locations">Ir a Locales para archivar</Link>
          </>
        )
      }
    />
  );
}

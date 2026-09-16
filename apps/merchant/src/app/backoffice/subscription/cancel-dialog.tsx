"use client";

import Link from "next/link";
import { ConfirmDialog } from "../../components/confirm-dialog";
import { convenientDowngradeDate, formatDate } from "./subscription-format";

/**
 * Spec 0063, D7 / ADR 0058 §8 — EL MODAL DE CONDICIONES DE LA BAJA.
 * Spec 0064 / ADR 0063 — LA BAJA ES INMEDIATA Y SIN DEVOLUCIÓN, y ESTE MODAL ES DONDE SE DICE.
 *
 * El botón que abre este modal NO se deshabilita nunca, ni con N locales activos: es la
 * respuesta literal del owner («el usuario no sabría qué debe hacer»). Se aprieta igual y
 * ACÁ se le dice qué falta, con el link para ir a hacerlo. Lo que no está disponible es
 * «Confirmar».
 *
 * EL TEXTO VIEJO DECÍA LO CONTRARIO DE LO QUE EL PRODUCTO HACE HOY: «termina al final del
 * período que ya pagaste […] podés reanudarlo antes de esa fecha». Con el ADR 0063 la baja es
 * INMEDIATA, sin devolución, y `resume` no existe (spec 0064 §4). Dejarlo habría sido la peor
 * forma del problema: una promesa escrita en la pantalla que el servidor ya no cumple.
 *
 * EL AVISO DE CUÁNDO CONVIENE BAJAR VIVE ACÁ Y NO COMO CARTEL PERMANENTE (respuesta 3 del
 * owner): aparece en el momento exacto en que el merchant está por perder plata. Es un AVISO,
 * no un agendamiento — el ADR 0063 deja escrito que esto es peor UX que la baja programada que
 * reemplaza y que el owner lo eligió sabiéndolo.
 *
 * SIN `renewalAt` EL AVISO SE OMITE ENTERO y el modal sigue diciendo que la baja es inmediata
 * (DoD de la fase B). `readBillingFacts` devuelve `null` ante cualquier fallo de Stripe, y una
 * fecha inventada sobre la plata del merchant es peor que ninguna fecha: lo mandaría a esperar
 * hasta un día que no significa nada.
 *
 * EL TEXTO DEL BLOQUEO NO SE ESCRIBE ACÁ: llega en `block.message` y es LITERALMENTE el
 * mensaje que devolvería el 409 del servidor, porque sale de la misma llamada a
 * `decidePlanChange` (`page.tsx`). Escribir acá un segundo texto con el mismo conteo sería
 * la divergencia que D10 prohíbe: el día que cambie el tope de Free, uno de los dos
 * quedaría viejo mintiéndole al owner sobre cuántos locales archivar.
 *
 * LO QUE SÍ SE DECIDE ACÁ ES A DÓNDE MANDARLO (spec 0065, fase D): son dos bloqueos con
 * dos destinos —Locales para archivar, Campañas para desactivar— y el discriminante es el
 * `code` del servidor, no el texto. Un bloqueo sin destino conocido (`already_on_plan`,
 * que llega por el fallback de la consola) muestra el mensaje y ningún link: inventarle
 * uno mandaría al owner a una pantalla donde no hay nada que hacer.
 *
 * Reusa `ConfirmDialog` en vez de reimplementar la trampa de foco y el Escape; lo que le
 * costó son dos props retrocompatibles, declaradas en ese archivo.
 */
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
  /** La etiqueta del botón que lo abrió: «Bajar a Free» en `plus`, «Ajustarme y bajar a
   * Free» en `none`. El modal es el MISMO para los dos (D10: la misma rama, no una segunda
   * regla que pueda divergir). */
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
  const convenient = convenientDowngradeDate(renewalAt);
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
            La baja es inmediata: al confirmar perdés el acceso a Plus en el
            acto y no se devuelve el tiempo que ya pagaste.
            {convenient !== null && (
              <>
                {" "}
                Ya pagaste hasta el {formatDate(renewalAt, timezone)}. Si querés
                aprovecharlo, conviene volver y dar de baja el{" "}
                {formatDate(convenient, timezone)}.
              </>
            )}
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

/** El destino de cada bloqueo, por `code`. Una tabla y no una cadena de `if`: el día que un
 * tercer bloqueo traiga su propia pantalla, se agrega una fila. Un `code` que no está acá
 * —hoy `already_on_plan`— no tiene link, y eso es una decisión, no un olvido. */
const BLOCK_ACTIONS: Record<string, { href: string; label: string }> = {
  downgrade_blocked: {
    href: "/backoffice/locations",
    label: "Ir a Locales para archivar",
  },
  downgrade_blocked_campaigns: {
    href: "/backoffice/marketing",
    label: "Ir a Campañas para desactivar",
  },
};

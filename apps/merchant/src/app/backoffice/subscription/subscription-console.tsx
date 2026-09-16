"use client";

import { useState } from "react";
import { ModuleHeader, Toast } from "../../components/ui";
import { CancelDialog } from "./cancel-dialog";
import { IntervalDialog } from "./interval-dialog";
import { UpgradeCard } from "./upgrade-card";
import { formatAmount, formatDate } from "./subscription-format";
import type {
  SubscriptionOffers,
  SubscriptionView,
} from "../../../server/billing/view";
import type { BillingFactsView } from "../../../server/billing/facts";

const JSON_HEADERS = { "content-type": "application/json" };

/**
 * Spec 0063, D7 — LA SECCIÓN DE SUSCRIPCIÓN. Patrón de `locations-console.tsx`
 * (`ModuleHeader` + `Toast` + `ConfirmDialog`).
 *
 * ESTA CONSOLA NO DECIDE QUÉ SE OFRECE. Lee `offers`, que lo decidió `subscriptionOffers`
 * —función pura con su tabla de casos en `billing-offers.test.ts`— en el server component.
 * Un `if` de producto acá sería una segunda regla que puede divergir de esa tabla, y encima
 * sin oráculo: es el hueco exacto que la tarea 38 pagó tres veces.
 *
 * Los tipos se importan como `import type`, así que se borran en compilación y nada de
 * `server/` entra al bundle del cliente.
 *
 * DESPUÉS DE CADA OPERACIÓN SE RECARGA LA PÁGINA, no se parchea el estado local. Las rutas
 * devuelven `{subscription, activeLocations, canCancel}` pero NO las `offers` (las decide el
 * server), y D9 paso 6 es explícito: «la ruta devuelve 200 y la UI re-lee». Recargar además
 * vuelve a pasar por D8, así que lo que el owner ve después de operar está reconciliado con
 * Stripe. El precio es un round-trip; la alternativa es un estado de cliente que puede
 * contradecir a la base.
 *
 * SPEC 0064, FASE B — QUÉ CAMBIÓ Y POR QUÉ ESTE ARCHIVO SE DIVIDIÓ PRIMERO. El QA del owner
 * sobre la 0063 dejó cuatro huecos de UI que ninguna spec había pedido: la sección no decía si
 * el cobro era mensual o anual, no mostraba la fecha de renovación ni el importe cobrado, y el
 * cambio de intervalo movía plata sin confirmar. Sumarlos a un archivo que ya estaba en
 * 264/300 lo habría pasado del límite, así que la tarjeta de alta (`upgrade-card.tsx`), el
 * modal del intervalo (`interval-dialog.tsx`) y el formateo (`subscription-format.ts`) salieron
 * ANTES de agregar nada.
 *
 * EL ORDEN DE LOS `useState` ES PARTE DE UN CONTRATO DE PRUEBA: `billing-click-probe.test.ts`
 * los siembra POR POSICIÓN (su índice 0 es `billingInterval`). Los estados nuevos van AL
 * FINAL; insertar uno en el medio no rompe el typecheck y deja la sonda midiendo otro estado.
 */
export function SubscriptionConsole({
  subscription,
  offers,
  facts,
  activeLocations,
  canCancel,
  downgradeBlock,
  stripeUnconfirmed,
  timezone,
  notice,
}: {
  subscription: SubscriptionView;
  offers: SubscriptionOffers;
  /** Spec 0064, A4/O-2: la renovación y la última factura pagada, leídas de Stripe en el
   * render. Todo `null` es un estado LEGÍTIMO —Stripe no contestó, o el negocio es `free`— y
   * la sección OMITE el dato en vez de inventarlo. */
  facts: BillingFactsView;
  activeLocations: number;
  /** De `decidePlanChange`, la misma función que las 5 rutas. NO deshabilita nada: decide
   * el contenido del modal (ADR 0058 §8). */
  canCancel: boolean;
  downgradeBlock: { message: string; code: string } | null;
  /** D8: no pudimos confirmar el estado con Stripe. Avisa y NO bloquea la sección. */
  stripeUnconfirmed: boolean;
  timezone: string;
  notice: string | null;
}) {
  const [billingInterval, setBillingInterval] = useState<"month" | "year">(
    "month",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(notice);
  const [confirming, setConfirming] = useState(false);
  // Estado NUEVO de la spec 0064, y va al final a propósito (ver el docblock de arriba).
  const [confirmingInterval, setConfirmingInterval] = useState(false);

  /** El `error` que se muestra es el del SERVIDOR (`{error, code}` de D6). No se traduce ni
   * se reemplaza por un genérico: el 409 `downgrade_blocked` ya trae el conteo correcto, y
   * un texto propio acá sería una segunda versión de la misma regla. */
  async function send(endpoint: string, body: unknown, done: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    const response = await fetch(endpoint, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify(body),
    });
    const payload = (await response.json().catch(() => null)) as {
      url?: string;
      error?: string;
    } | null;
    if (!response.ok) {
      setBusy(false);
      setConfirming(false);
      setConfirmingInterval(false);
      setError(payload?.error ?? "No pudimos completar la operación.");
      return;
    }
    // `checkout` contesta `{url}` y no un estado: se sale a Stripe.
    window.location.assign(
      payload?.url ?? `/backoffice/subscription?done=${done}`,
    );
  }

  return (
    <main className="merchant-shell">
      <div className="backoffice-home">
        <ModuleHeader
          eyebrow="Suscripción"
          title="Tu plan"
          description="Mejorá, cambiá el período de facturación o volvé a Free."
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
        {stripeUnconfirmed && (
          <p className="field-help" role="status">
            No pudimos confirmar tu suscripción con Stripe. Te mostramos lo
            último que registramos.
          </p>
        )}
        <section className="locations-list">
          <h2>
            {/* Para `none` la etiqueta ya ES «Sin plan»: anteponer «Plan» imprimía «Plan
                Sin plan», el string exacto que la home dejó de imprimir (decisión 3).
                Desde la spec 0064 `offers.plan` trae el INTERVALO («Plus mensual» / «Plus
                anual»): lo compone `planWithInterval` en el servidor, no un ternario acá. */}
            {offers.noPlan ? offers.plan : `Plan ${offers.plan}`} ·{" "}
            {offers.status}
          </h2>
          <p className="counter-hint">
            {activeLocations}{" "}
            {activeLocations === 1 ? "local activo" : "locales activos"}.
          </p>
          {/* F2-3 — LA FECHA DE RENOVACIÓN, en mensual y en anual. NO se imprime cuando hay
              una baja programada: ahí no hay próximo pago, y las dos líneas juntas se
              contradirían («tu plan baja el X» + «tu próximo pago es el X»). El caso existe
              de verdad — es la cancelación hecha desde el dashboard de Stripe, lo único que
              todavía crea este estado (decisión n.º 1 de la spec). */}
          {facts.renewalAt !== null && offers.pendingDowngrade === null && (
            <p className="field-help">
              Tu próximo pago es el {formatDate(facts.renewalAt, timezone)}.
            </p>
          )}
          {/* F2-4 — EL IMPORTE COBRADO Y EL LINK AL RECIBO (decisión literal del owner). Es
              la ÚLTIMA FACTURA PAGADA —también literal: «claro que la última que tiene
              pagada»—, elegida por `created` máximo en `readBillingFacts`. El link es el que
              Stripe publica para mandarle al cliente por email (decisión O-2 del anexo); si
              Stripe no publicó ninguno, se muestra el importe SIN link en vez de esconder
              también el importe. */}
          {facts.lastPaidInvoice !== null && (
            <p className="field-help">
              Último cobro:{" "}
              {formatAmount(
                facts.lastPaidInvoice.amountPaid,
                facts.lastPaidInvoice.currency,
              )}
              .{" "}
              {facts.lastPaidInvoice.receiptUrl !== null && (
                <a
                  href={facts.lastPaidInvoice.receiptUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Ver el recibo
                </a>
              )}
            </p>
          )}
          {offers.noPlan && (
            <p className="field-help">
              Tu suscripción terminó. No estás en ningún plan.
            </p>
          )}
          {offers.paymentPending && (
            <p className="field-help">
              Hay un cobro pendiente. Actualizá el medio de pago con el link que
              te envió Stripe; mientras tanto no podés cambiar de plan ni de
              período.
            </p>
          )}
          {offers.pendingDowngrade === "with_date" && (
            <p className="field-help">
              Tu plan baja a Free el{" "}
              {formatDate(subscription.pendingPlanAt, timezone)}.
            </p>
          )}
          {offers.pendingDowngrade === "without_date" && (
            <p className="field-help">
              Tu plan baja a Free al final del período actual.
            </p>
          )}
          {offers.intervalUpgrade && (
            <>
              {/* F2-2 — EL BOTÓN YA NO COBRA: ABRE EL MODAL. Hasta la spec 0064 este
                  `onClick` posteaba a `/api/billing/interval` directo, y esa ruta cobra
                  inmediato (`always_invoice`). Era plata sin confirmar. */}
              <button
                className="button"
                type="button"
                disabled={busy}
                onClick={() => setConfirmingInterval(true)}
              >
                Pasar a anual
              </button>
              <p className="field-help">
                Se cobra ahora la diferencia, con crédito por los días que no
                usaste del mes.
              </p>
            </>
          )}
          {offers.downgrade && (
            <button
              className="archive-button"
              type="button"
              disabled={busy}
              onClick={() => setConfirming(true)}
            >
              {offers.downgrade.label}
            </button>
          )}
        </section>
        {offers.upgrade && (
          <UpgradeCard
            label={offers.upgrade}
            billingInterval={billingInterval}
            onSelectInterval={setBillingInterval}
            busy={busy}
            onCheckout={() =>
              void send(
                "/api/billing/checkout",
                // `from: "subscription"` decide a dónde vuelve Stripe ([R2-I8]): sin esto
                // el que paga acá aterriza en la home del backoffice.
                { interval: billingInterval, from: "subscription" },
                "checkout",
              )
            }
          />
        )}
        <IntervalDialog
          open={confirmingInterval}
          busy={busy}
          onCancel={() => setConfirmingInterval(false)}
          onConfirm={() =>
            void send("/api/billing/interval", { to: "year" }, "interval")
          }
        />
        {offers.downgrade && (
          <CancelDialog
            open={confirming}
            title={offers.downgrade.label}
            // `canCancel` y `downgradeBlock` salen de la MISMA decisión del servidor. Se
            // pasan los dos: el segundo trae el texto y el conteo, el primero es el
            // contrato de D7 y hace explícito que un `false` no deshabilita nada.
            block={canCancel ? null : (downgradeBlock ?? BLOCK_FALLBACK)}
            busy={busy}
            // Decide si el modal muestra el aviso de «cuándo conviene bajar». `null` =
            // Stripe no contestó = no hay aviso y NO se inventa una fecha.
            renewalAt={facts.renewalAt}
            timezone={timezone}
            onCancel={() => setConfirming(false)}
            onConfirm={() =>
              void send(offers.downgrade?.endpoint ?? "", {}, "cancel")
            }
          />
        )}
      </div>
    </main>
  );
}

/** `canCancel === false` SIN `downgradeBlock` significa que el servidor bloqueó por una
 * razón que no es ni el conteo de locales ni el de campañas (hoy, `already_on_plan`). No se
 * puede ofrecer «Confirmar» —el 409 está garantizado— y tampoco se puede decir «archivá N»,
 * que sería falso: se dice lo único cierto, y sin `code` el modal no ofrece ningún link. */
const BLOCK_FALLBACK = {
  message: "Esta baja no está disponible para tu plan actual.",
  code: null,
};

"use client";

import { useState } from "react";
import { ModuleHeader, Toast } from "../../components/ui";
import { CancelDialog } from "./cancel-dialog";
import type {
  SubscriptionOffers,
  SubscriptionView,
} from "../../../server/billing/view";

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
 */
export function SubscriptionConsole({
  subscription,
  offers,
  activeLocations,
  canCancel,
  downgradeBlock,
  stripeUnconfirmed,
  timezone,
  notice,
}: {
  subscription: SubscriptionView;
  offers: SubscriptionOffers;
  activeLocations: number;
  /** De `decidePlanChange`, la misma función que las 5 rutas. NO deshabilita nada: decide
   * el contenido del modal (ADR 0058 §8). */
  canCancel: boolean;
  downgradeBlock: { message: string; archiveCount: number } | null;
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
                Sin plan», el string exacto que la home dejó de imprimir (decisión 3). */}
            {offers.noPlan ? offers.plan : `Plan ${offers.plan}`} ·{" "}
            {offers.status}
          </h2>
          <p className="counter-hint">
            {activeLocations}{" "}
            {activeLocations === 1 ? "local activo" : "locales activos"}.
          </p>
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
          {offers.resume && (
            <button
              className="button"
              type="button"
              disabled={busy}
              onClick={() => void send("/api/billing/resume", {}, "resume")}
            >
              Reanudar suscripción
            </button>
          )}
          {offers.intervalUpgrade && (
            <>
              <button
                className="button"
                type="button"
                disabled={busy}
                onClick={() =>
                  void send("/api/billing/interval", { to: "year" }, "interval")
                }
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
          <article className="plan-card" aria-label="Plan Plus">
            <p className="plan-card-eyebrow">Para hacer crecer tu negocio</p>
            <h2>Plus</h2>
            <p className="plan-card-price">
              {billingInterval === "year" ? "USD 200" : "USD 20"}
              <small> / {billingInterval === "year" ? "año" : "mes"}</small>
            </p>
            <div className="billing-toggle" aria-label="Período de facturación">
              <button
                type="button"
                className={billingInterval === "month" ? "active" : ""}
                aria-pressed={billingInterval === "month"}
                onClick={() => setBillingInterval("month")}
              >
                Mensual
              </button>
              <button
                type="button"
                className={billingInterval === "year" ? "active" : ""}
                aria-pressed={billingInterval === "year"}
                onClick={() => setBillingInterval("year")}
              >
                Anual <span>Ahorra USD 40</span>
              </button>
            </div>
            <ul className="plan-card-features">
              <li>3 locales activos</li>
              <li>Campañas y beneficios avanzados</li>
              <li>Analíticas para hacer crecer el negocio</li>
            </ul>
            <button
              className="button"
              type="button"
              disabled={busy}
              onClick={() =>
                void send(
                  "/api/billing/checkout",
                  // `from: "subscription"` decide a dónde vuelve Stripe ([R2-I8]): sin esto
                  // el que paga acá aterriza en la home del backoffice.
                  { interval: billingInterval, from: "subscription" },
                  "checkout",
                )
              }
            >
              {offers.upgrade}
            </button>
          </article>
        )}
        {offers.downgrade && (
          <CancelDialog
            open={confirming}
            title={offers.downgrade.label}
            // `canCancel` y `downgradeBlock` salen de la MISMA decisión del servidor. Se
            // pasan los dos: el segundo trae el texto y el conteo, el primero es el
            // contrato de D7 y hace explícito que un `false` no deshabilita nada.
            block={canCancel ? null : (downgradeBlock ?? BLOCK_FALLBACK)}
            busy={busy}
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

/** `canCancel === false` SIN `downgradeBlock` significa que el servidor bloqueó por otra
 * razón que no es el conteo de locales (hoy, `already_on_plan`). No se puede ofrecer
 * «Confirmar» —el 409 está garantizado— y tampoco se puede decir «archivá N», que sería
 * falso: se dice lo único cierto. */
const BLOCK_FALLBACK = {
  message: "Esta baja no está disponible para tu plan actual.",
  archiveCount: 0,
};

/** La fecha llega como string ISO ([R2-M4]) y se formatea acá, con el `timeZone` del
 * negocio FIJADO: sin fijarlo, el server y el cliente pueden formatear distinto y React
 * reporta un mismatch de hidratación. Patrón de `app/backoffice/loyalty/ui.tsx:18`. */
function formatDate(value: string | null, timezone: string): string {
  return value === null
    ? "—"
    : new Intl.DateTimeFormat("es-EC", {
        timeZone: timezone,
        dateStyle: "long",
      }).format(new Date(value));
}

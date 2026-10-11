"use client";

import { useState } from "react";
import { ModuleHeader, Toast } from "../../components/ui";
import { Alert, Link, PageHeader } from "../../../ui";
import { BillingExtras } from "./billing-extras";
import { billingPlanName, type BillingState } from "./billing-state";
import { BLOCK_ACTIONS } from "./block-actions";
import { CancelDialog } from "./cancel-dialog";
import { IntervalDialog } from "./interval-dialog";
import { UpgradeCard } from "./upgrade-card";
import { SubscriptionFacts } from "./subscription-facts";
import { formatDate } from "./subscription-format";
import type {
  SubscriptionOffers,
  SubscriptionView,
} from "../../../server/billing/view";
import type { BillingFactsView } from "../../../server/billing/facts";

const JSON_HEADERS = { "content-type": "application/json" };

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

  facts: BillingFactsView;
  activeLocations: number;

  canCancel: boolean;
  downgradeBlock: { message: string; code: string } | null;

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

  const [selectedPlan, setSelectedPlan] = useState<"base" | "plus">("base");
  const [billingState, setBillingState] = useState<BillingState | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  async function send(endpoint: string, body: unknown, done: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify(body),
      });
      const payload = (await response.json().catch(() => null)) as {
        url?: string;
        error?: string;
        code?: string;
      } | null;
      if (!response.ok) {
        setBusy(false);
        setConfirming(false);
        setConfirmingInterval(false);
        setError(payload?.error ?? "No pudimos completar la operación.");
        setErrorCode(payload?.code ?? null);
        return;
      }
      // `checkout` contesta `{url}` y no un estado: se sale a Stripe.
      window.location.assign(
        payload?.url ?? `/backoffice/subscription?done=${done}`,
      );
    } catch {
      setBusy(false);
      setConfirming(false);
      setConfirmingInterval(false);
      setErrorCode(null);
      setError("No pudimos conectarnos. Vuelve a intentar.");
    }
  }

  return (
    <main className="merchant-shell">
      <div className="brand-page subscription-page pb-24 font-sans">
        {billingState?.access === "blocked" ? (
          <PageHeader
            title="Elige un plan para continuar"
            description="Recupera el acceso a tu negocio con Conecta o Impulso."
          />
        ) : (
          <ModuleHeader
            eyebrow="Suscripción"
            title="Tu plan"
            description="Consulta tu plan, tus cobros y las opciones disponibles para tu negocio."
            closeHref="/backoffice"
          />
        )}
        <Toast
          message={error ?? toast}
          kind={error ? "error" : "success"}
          onDismiss={() => {
            setError(null);
            setToast(null);
          }}
        />
        {error && errorCode && BLOCK_ACTIONS[errorCode] && (
          <Link href={BLOCK_ACTIONS[errorCode].href}>
            {BLOCK_ACTIONS[errorCode].label}
          </Link>
        )}
        <BillingExtras
          onState={setBillingState}
          onSend={send}
          busy={busy}
          timezone={timezone}
        />
        {stripeUnconfirmed && (
          <Alert
            kind="warning"
            className="mt-6"
            title="No pudimos confirmar tu suscripción con Stripe"
          >
            Te mostramos lo último que registramos.
          </Alert>
        )}
        <div
          className={`mt-6 grid items-start gap-6 ${offers.upgrade ? "md:grid-cols-2" : ""}`}
        >
          <section
            className="min-w-0 rounded-lg border border-border bg-surface p-4 text-content sm:p-6"
            aria-labelledby="subscription-current-title"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-semibold text-content-muted">
                Tu plan actual
              </p>
              <span
                className={`inline-flex rounded-full border px-3 py-1 text-sm font-semibold ${offers.paymentPending ? "border-warning bg-warning-soft text-warning" : "border-border-strong bg-surface-subtle text-content"}`}
              >
                {offers.status}
              </span>
            </div>
            <h2
              id="subscription-current-title"
              className="mt-3 text-xl font-bold"
            >
              {subscription.plan === "trial"
                ? "Prueba de 90 días"
                : subscription.plan === "none"
                  ? "Sin plan"
                  : `Plan ${billingPlanName(subscription.plan)}${subscription.interval === "year" ? " anual" : subscription.interval === "month" ? " mensual" : ""}`}
            </h2>
            <p className="mt-2 text-sm text-content-muted">
              {activeLocations}{" "}
              {activeLocations === 1 ? "local activo" : "locales activos"}
            </p>
            <SubscriptionFacts
              facts={facts}
              pendingDowngrade={offers.pendingDowngrade}
              timezone={timezone}
            />
            <div className="mt-5 grid gap-3 empty:hidden">
              {offers.noPlan && (
                <Alert title="Tu suscripción terminó">
                  No estás en ningún plan.
                </Alert>
              )}
              {offers.paymentPending && (
                <Alert kind="warning" title="Hay un cobro pendiente">
                  Actualiza el medio de pago con el link que te envió Stripe;
                  mientras tanto no puedes cambiar de plan ni de período.
                </Alert>
              )}
              {offers.pendingDowngrade === "with_date" && (
                <Alert title="Baja programada">
                  Tu suscripción termina el{" "}
                  {formatDate(subscription.pendingPlanAt, timezone)}.
                </Alert>
              )}
              {offers.pendingDowngrade === "without_date" && (
                <Alert title="Baja programada">
                  Tu suscripción termina al final del período actual.
                </Alert>
              )}
            </div>
            {(offers.intervalUpgrade || offers.downgrade) && (
              <div className="mt-6 grid gap-3 border-t border-border pt-6">
                {offers.intervalUpgrade && (
                  <>
                    <button
                      data-variant="primary"
                      className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-primary px-4 py-2.5 text-base font-bold text-on-primary transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:bg-disabled disabled:text-on-disabled"
                      type="button"
                      disabled={busy}
                      onClick={() => setConfirmingInterval(true)}
                    >
                      Pasar a anual
                    </button>
                    <p className="text-sm text-content-muted">
                      Se cobra ahora la diferencia, con crédito por los días que
                      no usaste del mes.
                    </p>
                  </>
                )}
                {offers.downgrade && (
                  <button
                    data-variant="secondary"
                    className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-border-strong bg-surface px-4 py-2.5 text-base font-bold text-content transition-colors hover:bg-surface-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:border-disabled disabled:bg-disabled disabled:text-on-disabled"
                    type="button"
                    disabled={busy}
                    onClick={() => setConfirming(true)}
                  >
                    {offers.downgrade.label}
                  </button>
                )}
              </div>
            )}
          </section>
          {offers.upgrade && (
            <UpgradeCard
              label={offers.upgrade}
              billingInterval={billingInterval}
              selectedPlan={selectedPlan}
              onSelectPlan={setSelectedPlan}
              prices={billingState?.prices ?? null}
              trialDaysLeft={billingState?.trialDaysLeft ?? null}
              onSelectInterval={setBillingInterval}
              busy={busy}
              onCheckout={() =>
                void send(
                  "/api/billing/checkout",
                  // `from: "subscription"` decide a dónde vuelve Stripe ([R2-I8]): sin esto
                  // el que paga acá aterriza en la home del backoffice.
                  {
                    plan: selectedPlan,
                    interval: billingInterval,
                    from: "subscription",
                  },
                  "checkout",
                )
              }
            />
          )}
        </div>
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

const BLOCK_FALLBACK = {
  message: "Esta baja no está disponible para tu plan actual.",
  code: null,
};

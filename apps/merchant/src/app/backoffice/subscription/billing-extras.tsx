"use client";

import { useEffect, useState } from "react";
import { Alert, Button, Card, ConfirmDialog, Heading, Text } from "../../../ui";
import { billingPlanName, type BillingState } from "./billing-state";
import { formatDate } from "./subscription-format";

export function BillingExtras({
  onState,
  onSend,
  busy,
  timezone,
}: {
  onState: (state: BillingState) => void;
  onSend: (endpoint: string, body: unknown, done: string) => Promise<void>;
  busy: boolean;
  timezone: string;
}) {
  const [state, setState] = useState<BillingState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [action, setAction] = useState<"base" | "plus" | "resume" | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/billing/state", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok)
          throw new Error(payload.error ?? "No pudimos leer tu suscripción.");
        setState(payload);
        onState(payload);
        setError(null);
      })
      .catch((failure) => {
        if (!controller.signal.aborted)
          setError(
            failure instanceof Error
              ? failure.message
              : "No pudimos leer tu suscripción.",
          );
      });
    return () => controller.abort();
  }, [onState, attempt]);

  if (error)
    return (
      <Alert kind="error" title={error}>
        <Button variant="secondary" onPress={() => setAttempt(attempt + 1)}>
          Reintentar
        </Button>
      </Alert>
    );
  if (!state)
    return (
      <Text variant="muted" className="mt-6">
        Consultando tu suscripción…
      </Text>
    );
  const scheduled = state.subscription.pendingPlan === "none";
  const target = state.subscription.plan === "base" ? "plus" : "base";
  const interval = state.subscription.interval;
  const resume = action === "resume";
  const description = resume
    ? "La cancelación quedará anulada y tu suscripción seguirá renovándose en el período actual."
    : action === "plus"
      ? "El cambio a Impulso se aplica ahora. Se cobra la diferencia correspondiente al tiempo restante del período actual."
      : "El cambio a Conecta se aplica ahora, mantiene tu período de facturación y no devuelve la diferencia del período ya pagado.";
  return (
    <div className="mt-6 grid gap-4">
      {state.access === "trial" && state.trialDaysLeft !== null && (
        <Alert
          title={`Te ${state.trialDaysLeft === 1 ? "queda 1 día" : `quedan ${state.trialDaysLeft} días`} de prueba`}
        >
          Puedes usar CheckPass durante la prueba. Elige un plan para continuar
          al terminar.
        </Alert>
      )}
      {state.access === "blocked" && (
        <Alert kind="warning" title="Tu negocio necesita un plan activo">
          Tu prueba o suscripción terminó. Elige un plan para recuperar el
          acceso al panel, al mostrador y al punto de venta. Tus registros se
          conservan.
        </Alert>
      )}
      {state.access === "subscribed" && (
        <Card className="grid gap-4">
          <Heading level={2}>
            {scheduled ? "Cancelación programada" : "Gestiona tu suscripción"}
          </Heading>
          {scheduled ? (
            <>
              <Text>
                Conservas el acceso{" "}
                {state.subscription.pendingPlanAt
                  ? `hasta el ${formatDate(state.subscription.pendingPlanAt, timezone)}`
                  : "hasta el final del período actual"}
                .
              </Text>
              <Button
                variant="secondary"
                isDisabled={busy}
                onPress={() => setAction("resume")}
              >
                Reanudar suscripción
              </Button>
            </>
          ) : (
            <>
              <Text>
                Tu plan actual es {billingPlanName(state.subscription.plan)}.
                Puedes cambiar al otro plan.
              </Text>
              <Button
                variant="secondary"
                isDisabled={busy}
                onPress={() => setAction(target)}
              >
                Cambiar a {billingPlanName(target)}
              </Button>
            </>
          )}
        </Card>
      )}
      <ConfirmDialog
        isOpen={action !== null}
        title={
          resume
            ? "Reanudar suscripción"
            : `Cambiar a ${billingPlanName(action ?? "none")}`
        }
        description={
          <>
            {description}
            {!resume &&
              action &&
              (interval === "month" || interval === "year") && (
                <>
                  {" "}
                  El nuevo precio es USD {
                    state.prices[action][interval]
                  } por {interval === "month" ? "mes" : "año"}.
                </>
              )}
          </>
        }
        confirmLabel={resume ? "Reanudar" : "Confirmar cambio"}
        isBusy={busy}
        onCancel={() => setAction(null)}
        onConfirm={() => {
          if (!action) return;
          void onSend(
            resume ? "/api/billing/resume" : "/api/billing/plan",
            resume ? {} : { to: action },
            resume ? "resume" : "plan",
          ).then(() => setAction(null));
        }}
      />
    </div>
  );
}

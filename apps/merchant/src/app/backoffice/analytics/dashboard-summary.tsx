"use client";
import { useEffect } from "react";
import { formatMoney, monthEnd } from "@mi-pasaporte/domain/analytics/date";
import { Alert, Button, Heading, Text } from "../../../ui";
import { useBackofficeContext } from "../backoffice-context";

const reasons = {
  closed_month:
    "Faltan datos de gastos como referencia para la estimación mensual.",
  expense_history:
    "Faltan referencias de gastos para completar la estimación mensual.",
  cost_coverage:
    "Falta completar los costos de tus ventas para calcular el equilibrio.",
  positive_margin:
    "Todavía falta un margen positivo con costos completos para calcular el equilibrio.",
};

export function DashboardSummary() {
  const { state, acquireSummary, refreshSummary } = useBackofficeContext();
  const { data, status } = state.summary;
  useEffect(() => acquireSummary(), [acquireSummary]);
  const money = (amount: number | null) =>
    amount === null
      ? "Pendiente"
      : formatMoney(amount, data!.currencyCode, data!.minorUnit);
  return (
    <section
      aria-labelledby="dashboard-summary-title"
      className="grid min-w-0 gap-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Heading level={2} id="dashboard-summary-title">
          Tus números de hoy
        </Heading>
        <Button
          variant="quiet"
          isDisabled={status === "restricted"}
          isLoading={status === "loading"}
          onPress={refreshSummary}
        >
          Actualizar números
        </Button>
      </div>
      <div role="status" aria-live="polite">
        {(status === "idle" || status === "loading") && (
          <Text variant="muted">
            {data ? "Actualizando tus números…" : "Leyendo tus números…"}
          </Text>
        )}
        {status === "restricted" && (
          <Alert title="No puedes consultar estos números con tu acceso actual." />
        )}
        {status === "unavailable" && (
          <Alert kind="error" title="No pudimos actualizar tus números.">
            {data
              ? "Mostramos tu lectura anterior. Puedes volver a intentar con Actualizar números."
              : "Puedes volver a intentar con Actualizar números."}
          </Alert>
        )}
      </div>
      <dl className="grid min-w-0 gap-3 border-y border-border py-3 sm:grid-cols-3">
        {[
          ["Objetivo total estimado del mes", data?.monthBreakEvenMinor],
          ["Promedio diario del objetivo", data?.dailyBreakEvenMinor],
          ["Cuánto vas hoy", data?.todayRevenueMinor],
        ].map(([label, amount]) => (
          <div
            key={label}
            className="flex min-w-0 items-baseline justify-between gap-3 sm:grid sm:gap-1"
          >
            <dt>
              <Text as="span" variant="small">
                {label}
              </Text>
            </dt>
            <dd className="m-0 break-words">
              <Text as="span" variant="label">
                {data ? money(amount as number | null) : "—"}
              </Text>
            </dd>
          </div>
        ))}
      </dl>
      {data && (
        <>
          <Text variant="small">
            Promedio del objetivo total entre los{" "}
            {Number(monthEnd(data.date).slice(8))} días calendario del mes; no
            es una meta para hoy.
            {data.estimated ? " Equilibrio estimado." : ""}
          </Text>
          {data.unavailableReason && (
            <Text variant="small">
              Aún no podemos estimarlo. {reasons[data.unavailableReason]}
            </Text>
          )}
          <Text variant="small">
            Ventas netas de todos tus locales. Consulta:{" "}
            {new Intl.DateTimeFormat("es-419", {
              dateStyle: "short",
              timeStyle: "short",
              timeZone: data.timezone,
            }).format(new Date(data.readAt))}{" "}
          </Text>
        </>
      )}
    </section>
  );
}

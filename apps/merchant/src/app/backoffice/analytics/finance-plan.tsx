"use client";
import { useId, useState } from "react";
import type {
  MonthlyFinance,
  MonthlyFinanceReason,
} from "@mi-pasaporte/domain/analytics/monthly-finance-contract";
import { formatMoney } from "@mi-pasaporte/domain/analytics/date";
import { Button, Heading, Text } from "../../../ui";
import { stockCostDate } from "./stock-cost-format";

const reasons: Record<MonthlyFinanceReason, string> = {
  sales_costs: "Falta completar los costos y las comisiones de tus ventas.",
  expense_history: "Faltan referencias de gastos para completar el mes.",
  reference_sales: "Faltan ventas con costos completos como referencia.",
  positive_margin:
    "Las ventas de referencia todavía no dejan un margen positivo.",
};

function unavailableReason(values: MonthlyFinanceReason[]) {
  if (values.includes("sales_costs") && values.includes("expense_history"))
    return "Faltan costos de ventas y referencias de gastos.";
  return (
    reasons[values[0]] ?? "Faltan datos para estimar las ventas necesarias."
  );
}

export function FinancePlan({
  finance,
  currencyCode,
  minorUnit,
}: {
  finance?: MonthlyFinance;
  currencyCode: string;
  minorUnit: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const detailsId = useId();
  const money = (amount: number) =>
    formatMoney(amount, currencyCode, minorUnit);
  return (
    <>
      <Heading level={2}>Para cubrir los gastos del mes</Heading>
      {!finance ? (
        <div className="grid gap-1">
          <Text variant="label">Aún no podemos estimarlo</Text>
          <Text variant="small">
            La estimación mensual todavía no está disponible.
          </Text>
        </div>
      ) : (
        <>
          <Text variant="small">
            {new Intl.DateTimeFormat("es-EC", {
              month: "long",
              year: "numeric",
              timeZone: "UTC",
            }).format(new Date(`${finance.from}T12:00:00Z`))}{" "}
            · Corte al {stockCostDate(finance.asOf)}
          </Text>
          {finance.status === "unavailable" ||
          finance.remainingSalesMinor === null ? (
            <>
              <div className="grid gap-1">
                <Text variant="label">Aún no podemos estimarlo</Text>
                <Text variant="small">
                  {unavailableReason(finance.reasons)}
                </Text>
              </div>
              <div className="flex flex-wrap justify-between gap-2">
                <Text variant="small">Ventas netas del mes</Text>
                <Text variant="label" className="break-words tabular-nums">
                  {money(finance.monthRevenueMinor)}
                </Text>
              </div>
            </>
          ) : (
            <>
              <dl className="m-0 grid min-w-0 gap-4 sm:grid-cols-2 sm:items-end">
                <div className="grid min-w-0 gap-2">
                  <dt>
                    <Text as="span" variant="small">
                      Te falta vender
                    </Text>
                  </dt>
                  <dd className="m-0 break-words">
                    <Text as="span" variant="metric">
                      {money(finance.remainingSalesMinor)}
                    </Text>
                  </dd>
                </div>
                <div className="grid min-w-0 gap-1">
                  <dt>
                    <Text as="span" variant="small">
                      Ventas netas del mes
                    </Text>
                  </dt>
                  <dd className="m-0 break-words tabular-nums">
                    <Text as="span" variant="label">
                      {money(finance.monthRevenueMinor)}
                    </Text>
                  </dd>
                </div>
              </dl>
              <Text variant="small">
                {finance.status === "covered"
                  ? "Tus ventas ya cubren los gastos previstos. "
                  : ""}
                Estimación después del costo de los productos y las comisiones.
              </Text>
            </>
          )}
          <dl className="m-0 grid grid-cols-1 gap-3 border-y border-border py-3 sm:grid-cols-3">
            {[
              ["Pagado este mes", money(finance.recordedExpensesMinor)],
              [
                "Pendiente estimado",
                finance.pendingExpensesMinor === null
                  ? "Sin referencia"
                  : money(finance.pendingExpensesMinor),
              ],
              [
                "Total previsto",
                finance.forecastExpensesMinor === null
                  ? "Sin estimación"
                  : money(finance.forecastExpensesMinor),
              ],
            ].map(([label, value]) => (
              <div
                key={label}
                className="flex min-w-0 items-baseline justify-between gap-2 sm:grid sm:content-start sm:gap-1"
              >
                <dt>
                  <Text as="span" variant="small">
                    {label}
                  </Text>
                </dt>
                <dd className="m-0 break-words tabular-nums">
                  <Text as="span" variant="label">
                    {value}
                  </Text>
                </dd>
              </div>
            ))}
          </dl>
          {finance.expenses.length > 0 && (
            <>
              <Button
                variant="quiet"
                aria-expanded={expanded}
                aria-controls={detailsId}
                onPress={() => setExpanded((value) => !value)}
              >
                {expanded
                  ? "Ocultar detalle de gastos"
                  : "Ver detalle de gastos"}
              </Button>
              {expanded && (
                <div id={detailsId} className="grid min-w-0 gap-3">
                  <Text variant="small">
                    Referencias de los tres meses anteriores con gastos
                    registrados. Los pendientes son estimaciones, no deudas
                    confirmadas.
                  </Text>
                  <ul
                    aria-label="Detalle de gastos del mes"
                    className="grid min-w-0 divide-y divide-border"
                  >
                    {finance.expenses.map((expense) => (
                      <li key={expense.id} className="grid min-w-0 gap-3 py-4">
                        <div className="grid gap-1">
                          <Text variant="label" className="break-words">
                            {expense.label}
                          </Text>
                          <Text variant="small">
                            {expense.kind === "fixed"
                              ? "Fijo"
                              : "Variables del conjunto"}{" "}
                            ·{" "}
                            {expense.referenceMonths
                              ? `${expense.referenceMonths} ${expense.referenceMonths === 1 ? "mes con registros" : "meses con registros"}`
                              : "Sin meses de referencia"}
                          </Text>
                        </div>
                        <dl className="m-0 grid grid-cols-2 gap-3">
                          {[
                            ["Pagado", money(expense.recordedMinor)],
                            [
                              "Referencia mensual",
                              expense.referenceMinor === null
                                ? "Sin referencia"
                                : money(expense.referenceMinor),
                            ],
                            [
                              "Pendiente estimado",
                              expense.pendingMinor === null
                                ? "Sin referencia"
                                : money(expense.pendingMinor),
                            ],
                            [
                              "Total previsto",
                              expense.forecastMinor === null
                                ? "Sin estimación"
                                : money(expense.forecastMinor),
                            ],
                          ].map(([label, value]) => (
                            <div key={label} className="grid min-w-0 gap-1">
                              <dt>
                                <Text as="span" variant="small">
                                  {label}
                                </Text>
                              </dt>
                              <dd className="m-0 break-words tabular-nums">
                                <Text as="span" variant="label">
                                  {value}
                                </Text>
                              </dd>
                            </div>
                          ))}
                        </dl>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </>
      )}
    </>
  );
}

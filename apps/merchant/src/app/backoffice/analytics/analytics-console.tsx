"use client";
import { useEffect, useState, type ReactNode } from "react";
import { Coins, Cart, StatsReport, Wallet, Archery } from "iconoir-react";
import type {
  buildDay,
  buildHistory,
  HistoryPeriod,
  RecentMovement,
} from "@mi-pasaporte/domain/analytics/history";
import { sumIntegers } from "@mi-pasaporte/domain/analytics/money";
import { formatMoney } from "@mi-pasaporte/domain/analytics/date";
import {
  Alert,
  Button,
  Card,
  DateField,
  Heading,
  Link,
  PageHeader,
  SelectField,
  SegmentedBar,
  Text,
} from "../../../ui";
import { panelRequest } from "../panel-request";
type History = ReturnType<typeof buildHistory> & {
  recentMovements?: RecentMovement[];
};
type Day = ReturnType<typeof buildDay>;
const periods = [
  { id: "month", label: "Mes en curso" },
  { id: "3m", label: "3 meses" },
  { id: "6m", label: "6 meses" },
  { id: "9m", label: "9 meses" },
  { id: "12m", label: "12 meses" },
];
function Metric({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  tone?: "success" | "danger";
}) {
  return (
    <div className="grid min-w-0 grid-cols-2 content-start gap-2 rounded-lg bg-surface-subtle p-4 sm:grid-cols-1">
      <dt>
        <Text as="span" variant="small">
          {label}
        </Text>
      </dt>
      <dd className="m-0 break-words text-right tabular-nums sm:text-left">
        <Text
          as="span"
          variant="label"
          className={
            tone === "danger"
              ? "text-danger"
              : tone === "success"
                ? "text-success"
                : undefined
          }
        >
          {value}
        </Text>
      </dd>
      {detail && (
        <dd className="col-span-2 m-0 sm:col-span-1">
          <Text as="span" variant="small">
            {detail}
          </Text>
        </dd>
      )}
    </div>
  );
}

export default function AnalyticsConsole({
  initialDate = "",
  initialPeriod = "month",
}: {
  initialDate?: string;
  initialPeriod?: HistoryPeriod;
}) {
  const [period, setPeriod] = useState<HistoryPeriod>(initialPeriod);
  const [locationId, setLocationId] = useState("");
  const [date, setDate] = useState(initialDate);
  const [history, setHistory] = useState<History | null>(null);
  const [day, setDay] = useState<Day | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    const query = new URLSearchParams({
      period,
      ...(locationId ? { locationId } : {}),
    });
    async function load() {
      setLoading(true);
      setError("");
      try {
        const [h, d] = await Promise.all([
          panelRequest<History>(`/api/analytics/history?${query}`),
          date
            ? panelRequest<Day>(
                `/api/analytics/day?${new URLSearchParams({ date, ...(locationId ? { locationId } : {}) })}`,
              )
            : Promise.resolve(null),
        ]);
        if (active) {
          setHistory(h);
          setDay(d);
        }
      } catch {
        if (active) setError("No pudimos leer este período. Intenta otra vez.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [period, locationId, date, reload]);
  const money = (n: number) =>
    formatMoney(n, history?.currencyCode ?? "USD", history?.minorUnit ?? 2);
  return (
    <main className="merchant-shell grid min-w-0 content-start gap-6">
      <PageHeader
        title="Analíticas"
        description="Tus ventas, costos, gastos, clientes y promos en números."
        actions={<Link href="/backoffice">Volver al inicio</Link>}
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <SelectField
          label="Período"
          options={periods}
          value={period}
          onChange={(key) => setPeriod(String(key) as HistoryPeriod)}
        />
        <SelectField
          label="Local"
          options={[
            { id: "", label: "Todos los locales" },
            ...(history?.locations.map((l) => ({ id: l.id, label: l.name })) ??
              []),
          ]}
          value={locationId}
          onChange={(key) => setLocationId(String(key))}
        />
        <DateField label="Ver un día" value={date} onChange={setDate} />
      </div>
      {day && !loading && !error && (
        <Card className="grid gap-4">
          <Heading level={2}>Ver un día</Heading>
          <Text>
            El {day.date} vendiste {money(day.revenueMinor)} en {day.tickets}{" "}
            tickets.
          </Text>
          {day.products.length ? (
            <ul className="grid divide-y divide-border">
              {day.products.map((p) => (
                <li
                  key={p.id}
                  className="grid min-w-0 grid-cols-1 gap-2 py-3 sm:grid-cols-3"
                >
                  <Text as="span" className="break-words sm:col-span-2">
                    {p.label} · {p.units} unidades
                  </Text>
                  <Text
                    as="span"
                    variant="label"
                    className="tabular-nums sm:text-right"
                  >
                    {money(p.revenueMinor)}
                  </Text>
                </li>
              ))}
            </ul>
          ) : (
            <Text variant="muted">No hay ventas registradas ese día.</Text>
          )}
        </Card>
      )}
      {error && (
        <Alert kind="error" title={error}>
          <Button variant="quiet" onPress={() => setReload((n) => n + 1)}>
            Volver a intentar
          </Button>
        </Alert>
      )}
      {loading && <Text variant="muted">Leyendo tus números…</Text>}
      {history && !loading && !error && (
        <div className="grid min-w-0 items-start gap-6 lg:grid-cols-12">
          <Card className="grid min-w-0 gap-4 lg:col-span-12">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <Heading level={2}>Ventas del período</Heading>
              <Text variant="small">
                Del {history.from} al {history.to}
              </Text>
            </div>
            <dl className="grid divide-y divide-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              {[
                {
                  label: "Ventas",
                  value: money(history.revenueMinor),
                  icon: <Coins className="size-6" aria-hidden="true" />,
                  tone: "bg-primary-soft text-primary",
                },
                {
                  label: "Tickets",
                  value: history.tickets,
                  icon: <Cart className="size-6" aria-hidden="true" />,
                  tone: "bg-info-soft text-info",
                },
                {
                  label: "Ticket promedio",
                  value: money(history.averageTicketMinor),
                  icon: <StatsReport className="size-6" aria-hidden="true" />,
                  tone: "bg-complement-soft text-complement",
                },
              ].map(({ label, value, icon, tone }) => (
                <div
                  key={label}
                  className="grid min-w-0 content-start gap-3 py-4 sm:px-4"
                >
                  <dt className="flex items-center gap-3">
                    <span
                      className={`flex size-10 shrink-0 items-center justify-center rounded-md ${tone}`}
                    >
                      {icon}
                    </span>
                    <Text as="span" variant="small">
                      {label}
                    </Text>
                  </dt>
                  <dd className="m-0 min-w-0 break-words">
                    <Text as="span" variant="metric">
                      {value}
                    </Text>
                  </dd>
                </div>
              ))}
            </dl>
            <Text
              variant="small"
              className={
                history.previous.variation === null ||
                history.previous.variation === 0
                  ? undefined
                  : history.previous.variation > 0
                    ? "text-success"
                    : "text-danger"
              }
            >
              {history.previous.variation === null
                ? "Sin ventas anteriores para comparar"
                : `${Math.round(Math.abs(history.previous.variation) * 100)}% ${history.previous.variation >= 0 ? "más" : "menos"} ventas que en el período anterior de igual duración`}
            </Text>
            {history.annual && (
              <Text variant="small">
                En el mismo período del año anterior vendiste{" "}
                {money(history.annual.revenueMinor)}.
              </Text>
            )}
          </Card>
          <div className="grid min-w-0 items-start gap-6 lg:col-span-12 lg:grid-cols-2">
            <div className="grid min-w-0 content-start gap-6">
              <Card className="grid min-w-0 content-start gap-4 self-start">
                <Heading level={2}>Ganancia y gastos</Heading>
                <dl>
                  <dt>
                    <Text as="span" variant="small">
                      Gastos del período
                    </Text>
                  </dt>
                  <dd className="m-0 mt-2 break-words">
                    <Text as="span" variant="metric">
                      {money(
                        sumIntegers([
                          history.fixedExpensesMinor,
                          history.variableExpensesMinor,
                        ]),
                      )}
                    </Text>
                  </dd>
                </dl>
                <SegmentedBar
                  label={`Distribución de gastos: fijos ${money(history.fixedExpensesMinor)}; variables ${money(history.variableExpensesMinor)}`}
                  segments={[
                    {
                      id: "fixed",
                      value: history.fixedExpensesMinor,
                      tone: "lavender",
                    },
                    {
                      id: "variable",
                      value: history.variableExpensesMinor,
                      tone: "sky",
                    },
                  ]}
                />
                <dl className="grid grid-cols-2 gap-4">
                  {[
                    {
                      label: "Gastos fijos",
                      value: history.fixedExpensesMinor,
                      tone: "bg-chart-lavender",
                    },
                    {
                      label: "Gastos variables",
                      value: history.variableExpensesMinor,
                      tone: "bg-chart-sky",
                    },
                  ].map(({ label, value, tone }) => (
                    <div key={label} className="grid min-w-0 gap-1">
                      <dt className="flex items-center gap-2">
                        <span
                          aria-hidden="true"
                          className={`size-3 shrink-0 rounded-full ${tone}`}
                        />
                        <Text as="span" variant="small">
                          {label}
                        </Text>
                      </dt>
                      <dd className="m-0 break-words tabular-nums">
                        <Text as="span" variant="label">
                          {money(value)}
                        </Text>
                      </dd>
                    </div>
                  ))}
                </dl>
                <dl className="grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
                  <div className="grid min-w-0 gap-1">
                    <dt>
                      <Text as="span" variant="small">
                        Ganancia bruta
                      </Text>
                    </dt>
                    <dd className="m-0 break-words tabular-nums">
                      <Text as="span" variant="label">
                        {history.soldUnits === 0 || history.coverage === 0
                          ? "Pendiente"
                          : history.coverage < 1
                            ? "Cálculo incompleto"
                            : money(history.grossProfitMinor)}
                      </Text>
                    </dd>
                  </div>
                  <div className="grid min-w-0 gap-1">
                    <dt>
                      <Text as="span" variant="small">
                        Resultado después de gastos
                      </Text>
                    </dt>
                    <dd className="m-0 break-words tabular-nums">
                      <Text
                        as="span"
                        variant="label"
                        className={
                          history.resultMinor === null
                            ? undefined
                            : "text-expense-variable"
                        }
                      >
                        {history.resultMinor === null
                          ? "Pendiente"
                          : money(history.resultMinor)}
                      </Text>
                    </dd>
                  </div>
                </dl>
                {history.soldUnits === 0 ? (
                  <Text>No hay unidades vendidas en este período.</Text>
                ) : history.coverage === 0 ? (
                  <>
                    <Text>Ventas: {money(history.revenueMinor)}.</Text>
                    <Text variant="muted">
                      Los costos de estas ventas todavía no están incluidos.
                    </Text>
                  </>
                ) : history.coverage < 1 ? (
                  <>
                    <Text>Ventas: {money(history.revenueMinor)}.</Text>
                    <Text variant="muted">
                      Falta conocer el costo de {history.unitsWithoutCost} de
                      las {history.soldUnits} unidades vendidas.
                    </Text>
                  </>
                ) : (
                  <>
                    <Text variant="muted">
                      Vendiste {money(history.revenueMinor)} y el costo de esos
                      productos fue {money(history.costOfGoodsMinor)}.
                      {history.paymentCommissionMinor !== 0 &&
                        ` También se descontaron ${money(history.paymentCommissionMinor)} de comisiones.`}
                    </Text>
                  </>
                )}
                {history.resultMinor === null ? (
                  <Text variant="muted">
                    Con el costo de al menos el 80% de lo vendido podrás ver el
                    resultado después de gastos.
                  </Text>
                ) : null}
              </Card>
              <Card className="grid min-w-0 gap-4">
                <Heading level={2}>Los productos que más vendieron</Heading>
                {history.topProducts.length ? (
                  <div
                    role="table"
                    aria-label="Productos más vendidos"
                    className="min-w-0"
                  >
                    <div
                      role="row"
                      className="grid grid-cols-4 gap-2 border-y border-border py-3 sm:grid-cols-6"
                    >
                      <div
                        role="columnheader"
                        className="col-span-2 sm:col-span-3"
                      >
                        <Text variant="small">Producto</Text>
                      </div>
                      <div role="columnheader" className="text-right">
                        <Text variant="small">Unidades</Text>
                      </div>
                      <div
                        role="columnheader"
                        className="text-right sm:col-span-2"
                      >
                        <Text variant="small">Ventas</Text>
                      </div>
                    </div>
                    {history.topProducts.map((product) => (
                      <div
                        key={product.id}
                        role="row"
                        className="grid min-w-0 grid-cols-4 items-center gap-2 border-b border-border py-4 last:border-b-0 sm:grid-cols-6"
                      >
                        <div
                          role="cell"
                          className="col-span-2 min-w-0 break-words sm:col-span-3"
                        >
                          <Text variant="label">{product.label}</Text>
                        </div>
                        <div
                          role="cell"
                          className="min-w-0 break-words text-right tabular-nums"
                        >
                          <Text>{product.units}</Text>
                        </div>
                        <div
                          role="cell"
                          className="min-w-0 break-words text-right tabular-nums sm:col-span-2"
                        >
                          <Text variant="label">
                            {money(product.revenueMinor)}
                          </Text>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <Text variant="muted">
                    No hay ventas de productos en este período.
                  </Text>
                )}
              </Card>
            </div>
            <div className="grid min-w-0 content-start gap-6">
              <section id="calculo" className="min-w-0">
                <Card className="grid h-full min-w-0 content-start gap-4">
                  <Heading level={2}>El cálculo de este mes</Heading>
                  {history.goal.breakEvenMinor === null ? (
                    <Text variant="muted">
                      {!history.goal.closedMonth
                        ? "La meta se calcula al cerrar tu primer mes con gastos."
                        : history.goal.coverage < 0.8
                          ? "Falta conocer el costo de al menos el 80% de lo vendido para calcular tu meta."
                          : "Tus ventas con costo conocido todavía no dejan un margen positivo para calcular una meta."}
                    </Text>
                  ) : (
                    <>
                      <dl className="grid gap-3 sm:grid-cols-2">
                        {[
                          {
                            label: "Para cubrir el mes",
                            value: money(history.goal.breakEvenMinor),
                            icon: (
                              <Archery className="size-6" aria-hidden="true" />
                            ),
                            tone: "bg-primary-soft text-primary",
                          },
                          {
                            label: "Ventas del mes",
                            value: money(history.goal.monthRevenueMinor),
                            icon: (
                              <Coins className="size-6" aria-hidden="true" />
                            ),
                            tone: "bg-info-soft text-info",
                          },
                        ].map(({ label, value, icon, tone }) => (
                          <div
                            key={label}
                            className="grid min-w-0 content-between gap-5 rounded-lg border border-border bg-surface p-4"
                          >
                            <dt className="flex items-center gap-3">
                              <span
                                className={`flex size-10 shrink-0 items-center justify-center rounded-full ${tone}`}
                              >
                                {icon}
                              </span>
                              <Text as="span" variant="label">
                                {label}
                              </Text>
                            </dt>
                            <dd className="m-0 min-w-0 break-words">
                              <Text as="span" variant="metric">
                                {value}
                              </Text>
                            </dd>
                          </div>
                        ))}
                      </dl>
                      <dl className="grid grid-cols-2 gap-3 border-y border-border py-3">
                        {[
                          [
                            history.goal.estimated
                              ? "Gastos estimados"
                              : "Gastos del mes",
                            money(history.goal.expensesMinor),
                          ],
                          ...(history.goal.targetMinor === null
                            ? []
                            : [
                                [
                                  "Meta de hoy",
                                  money(history.goal.targetMinor),
                                ],
                              ]),
                        ].map(([label, value]) => (
                          <div
                            key={label}
                            className="grid min-w-0 content-start gap-1"
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
                      {history.goal.targetMinor !== null && (
                        <Text variant="small">
                          {history.goal.remainingDays} días de venta restantes
                          para cubrir el mes.
                        </Text>
                      )}
                    </>
                  )}
                  <div className="grid gap-2 border-t border-border pt-4">
                    <Heading level={3}>
                      Movimientos recientes de este mes
                    </Heading>
                    {history.recentMovements?.length ? (
                      <ul className="grid divide-y divide-border">
                        {history.recentMovements.map((movement) => (
                          <li
                            key={movement.id}
                            className="flex min-w-0 items-center gap-3 py-3"
                          >
                            <span
                              aria-hidden="true"
                              className={
                                movement.kind === "sale"
                                  ? "flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary"
                                  : "flex size-10 shrink-0 items-center justify-center rounded-full bg-info-soft text-info"
                              }
                            >
                              {movement.kind === "sale" ? (
                                <Cart className="size-5" />
                              ) : (
                                <Wallet className="size-5" />
                              )}
                            </span>
                            <div className="grid min-w-0 flex-1 gap-1">
                              <Text variant="label" className="break-words">
                                {movement.label}
                              </Text>
                              <Text variant="small">
                                {movement.kind === "sale" ? "Venta" : "Gasto"} ·{" "}
                                {new Intl.DateTimeFormat("es-419", {
                                  day: "numeric",
                                  month: "short",
                                  timeZone: "UTC",
                                }).format(
                                  new Date(`${movement.date}T12:00:00Z`),
                                )}
                              </Text>
                            </div>
                            <Text
                              as="span"
                              variant="label"
                              className="max-w-40 break-words text-right tabular-nums"
                            >
                              {money(movement.amountMinor)}
                            </Text>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <Text variant="small">
                        No hay movimientos recientes disponibles de este mes.
                      </Text>
                    )}
                  </div>
                </Card>
              </section>
              <Card className="grid min-w-0 gap-4">
                <Heading level={2}>Stock e insumos</Heading>
                {history.stock.valueMinor !== null ? (
                  <Text>
                    Valor del stock al {history.to}:{" "}
                    {money(history.stock.valueMinor)}.
                  </Text>
                ) : history.stock.valuedItems > 0 ? (
                  <Text>
                    Valor conocido del stock:{" "}
                    {money(history.stock.knownValueMinor)}. Falta conocer el
                    costo de {history.stock.unvaluedItems}{" "}
                    {history.stock.unvaluedItems === 1 ? "insumo" : "insumos"}{" "}
                    para completar el total.
                  </Text>
                ) : (
                  <Text variant="muted">
                    Todavía no hay existencias con costo registrado para valorar
                    tu stock.
                  </Text>
                )}
                {history.stock.averageIncrease === null ? (
                  <Text variant="muted">
                    Necesitas al menos dos costos registrados de un mismo insumo
                    y local para comparar sus subas.
                  </Text>
                ) : history.stock.increaseDays === 0 ? (
                  <Text>
                    No se registraron subas de los insumos comparables en este
                    período.
                  </Text>
                ) : (
                  <Text>
                    En este período el costo de tus insumos varió en promedio{" "}
                    {new Intl.NumberFormat("es-EC", {
                      style: "percent",
                      maximumFractionDigits: 1,
                    }).format(history.stock.averageIncrease)}
                    , comparando el primer y el último costo conocidos.
                    {history.stock.averageDaysBetweenIncreases !== null
                      ? ` Pasaron unos ${Math.round(history.stock.averageDaysBetweenIncreases)} días entre subas de un mismo insumo.`
                      : " Todavía no hay subas repetidas de un mismo insumo para comparar su frecuencia."}
                  </Text>
                )}
              </Card>
            </div>
          </div>
          {history.customers && (
            <Card className="grid min-w-0 gap-4 lg:col-span-5">
              <Heading level={2}>Clientes del período</Heading>
              <dl className="grid gap-3 sm:grid-cols-3">
                <Metric label="Clientes" value={history.customers.count} />
                <Metric label="Visitas" value={history.customers.visits} />
                <Metric
                  label="Clientes que regresaron"
                  value={history.customers.returning}
                />
              </dl>
              <Text>
                {history.customers.count}{" "}
                {history.customers.count === 1
                  ? "cliente registró"
                  : "clientes registraron"}{" "}
                {history.customers.visits} visitas. De ellos,{" "}
                {history.customers.returning} ya habían venido antes del
                período.
              </Text>
              {history.customers.visits === 0 && (
                <Text variant="muted">
                  No hay visitas registradas en este período y local.
                </Text>
              )}
            </Card>
          )}
          {history.promos && (
            <Card className="grid min-w-0 gap-4 lg:col-span-7">
              <Heading level={2}>Promos del período</Heading>
              <Text variant="muted">
                Descuentos y ventas en los mismos tickets. Estas ventas no
                indican que la promo las haya causado.
              </Text>
              {history.promos.length ? (
                <ul className="grid divide-y divide-border">
                  {history.promos.map((p) => (
                    <li key={p.id} className="grid gap-2 py-3">
                      <Text>
                        {p.label}: {money(p.discountMinor)} en descuentos y{" "}
                        {money(p.salesMinor)} en ventas asociadas.
                      </Text>
                      {p.costMinor !== null && p.costMinor > 0 && (
                        <Text variant="small">
                          Costo de premios registrado: {money(p.costMinor)}.
                        </Text>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <Text variant="muted">
                  No hay promos registradas en este período y local.
                </Text>
              )}
            </Card>
          )}
        </div>
      )}
    </main>
  );
}

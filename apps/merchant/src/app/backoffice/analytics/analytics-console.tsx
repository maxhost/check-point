"use client";
import { useEffect, useState } from "react";
import type {
  buildDay,
  buildHistory,
  HistoryPeriod,
} from "@mi-pasaporte/domain/analytics/history";
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
  Text,
} from "../../../ui";
import { panelRequest } from "../panel-request";
type History = ReturnType<typeof buildHistory>;
type Day = ReturnType<typeof buildDay>;
const periods = [
  { id: "month", label: "Mes en curso" },
  { id: "3m", label: "3 meses" },
  { id: "6m", label: "6 meses" },
  { id: "9m", label: "9 meses" },
  { id: "12m", label: "12 meses" },
];
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
    <main className="merchant-shell grid gap-6">
      <PageHeader
        title="Analíticas"
        description="Tus ventas, costos y gastos en números."
        actions={<Link href="/backoffice">Volver al inicio</Link>}
      />
      <div className="grid gap-4 sm:grid-cols-2">
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
      </div>
      {error && (
        <Alert kind="error" title={error}>
          <Button variant="quiet" onPress={() => setReload((n) => n + 1)}>
            Volver a intentar
          </Button>
        </Alert>
      )}
      {loading && <Text variant="muted">Leyendo tus números…</Text>}
      {history && !loading && !error && (
        <>
          <Card className="grid gap-4">
            <Heading level={2}>Ventas del período</Heading>
            <Text variant="small">
              Del {history.from} al {history.to}
            </Text>
            <dl className="grid gap-3 sm:grid-cols-3">
              <div>
                <dt>Ventas</dt>
                <dd>{money(history.revenueMinor)}</dd>
              </div>
              <div>
                <dt>Tickets</dt>
                <dd>{history.tickets}</dd>
              </div>
              <div>
                <dt>Ticket promedio</dt>
                <dd>{money(history.averageTicketMinor)}</dd>
              </div>
            </dl>
            <Text variant="muted">
              {history.previous.variation === null
                ? "Todavía no hay ventas en el período anterior para comparar."
                : `${Math.round(Math.abs(history.previous.variation) * 100)}% ${history.previous.variation >= 0 ? "más" : "menos"} ventas que en el período anterior de igual duración.`}
            </Text>
            {history.annual && (
              <Text>
                En el mismo período del año anterior vendiste{" "}
                {money(history.annual.revenueMinor)}.
              </Text>
            )}
            <Heading level={3}>Los productos que más vendieron</Heading>
            {history.topProducts.length ? (
              <ul className="grid gap-2">
                {history.topProducts.map((p) => (
                  <li
                    key={p.id}
                    className="flex flex-wrap justify-between gap-2"
                  >
                    <Text as="span">
                      {p.label} · {p.units} unidades
                    </Text>
                    <Text as="span">{money(p.revenueMinor)}</Text>
                  </li>
                ))}
              </ul>
            ) : (
              <Text variant="muted">
                No hay ventas de productos en este período.
              </Text>
            )}
          </Card>
          <Card className="grid gap-4">
            <Heading level={2}>Ganancia y gastos</Heading>
            <Text>
              Ganancia bruta: {money(history.grossProfitMinor)}, calculada sobre
              el {Math.round(history.coverage * 100)}% de lo vendido.
            </Text>
            <Text>
              Gastos fijos: {money(history.fixedExpensesMinor)}. Gastos
              variables: {money(history.variableExpensesMinor)}.
            </Text>
            {history.resultMinor === null ? (
              <Text variant="muted">
                Con el costo de al menos el 80% de lo vendido podrás ver el
                resultado después de gastos.
              </Text>
            ) : (
              <Text>
                Resultado después de gastos: {money(history.resultMinor)}.
              </Text>
            )}
          </Card>
          <section id="calculo">
            <Card className="grid gap-4">
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
                  <Text>
                    Para cubrir el mes necesitas vender{" "}
                    {money(history.goal.breakEvenMinor)}. Llevas{" "}
                    {money(history.goal.monthRevenueMinor)}.
                  </Text>
                  <Text>
                    Margen de contribución:{" "}
                    {Math.round((history.goal.margin ?? 0) * 100)}%. Gastos del
                    mes: {money(history.goal.expensesMinor)}
                    {history.goal.estimated ? " (estimado)" : ""}.
                  </Text>
                  {history.goal.targetMinor !== null && (
                    <Text>
                      Meta de hoy: {money(history.goal.targetMinor)} en{" "}
                      {history.goal.remainingDays} días de venta restantes.
                    </Text>
                  )}
                  <ul className="grid gap-2">
                    {history.goal.concepts.map((c) => (
                      <li key={c.id}>
                        <Text>
                          {c.label}: {money(c.amountMinor)}
                          {c.estimated
                            ? " · estimado con meses anteriores"
                            : " · pagado este mes"}
                          .
                        </Text>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </Card>
          </section>
        </>
      )}
      <Card className="grid gap-4">
        <Heading level={2}>Ver un día</Heading>
        <DateField label="Fecha" value={date} onChange={setDate} />
        {day && !loading && !error && (
          <>
            <Text>
              El {day.date} vendiste {money(day.revenueMinor)} en {day.tickets}{" "}
              tickets.
            </Text>
            {day.products.length ? (
              <ul className="grid gap-2">
                {day.products.map((p) => (
                  <li
                    key={p.id}
                    className="flex flex-wrap justify-between gap-2"
                  >
                    <Text as="span">
                      {p.label} · {p.units} unidades
                    </Text>
                    <Text as="span">{money(p.revenueMinor)}</Text>
                  </li>
                ))}
              </ul>
            ) : (
              <Text variant="muted">No hay ventas registradas ese día.</Text>
            )}
          </>
        )}
      </Card>
    </main>
  );
}

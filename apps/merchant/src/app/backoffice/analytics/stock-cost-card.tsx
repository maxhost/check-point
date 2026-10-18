"use client";
import type { StockCostHistory } from "@mi-pasaporte/domain/analytics/stock-cost-contract";
import { Heading, LineChart, SelectField, Text } from "../../../ui";
import {
  compareStockCosts,
  formatStockCost,
  stockCostDate,
  stockCostGeometryValue,
  stockCostUnit,
} from "./stock-cost-format";

export function StockCostCard({
  history,
  selectedId,
  onSelect,
}: {
  history?: StockCostHistory;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const series =
    history?.series.find(({ id }) => id === selectedId) ??
    history?.series.find(({ id }) => id === history.defaultSeriesId);
  const format = (amount: string) =>
    formatStockCost(
      amount,
      history!.currencyCode,
      history!.minorUnit,
      series!.unit,
    );
  const points = series?.points ?? [];
  const geometry = points.map((point) => ({
    x: Date.parse(`${point.date}T00:00:00Z`),
    y: stockCostGeometryValue(point.amountMinor),
  }));
  const validGeometry = geometry.every(
    (point) => point.y !== null && Number.isFinite(point.x),
  );
  const sorted = [...points].sort((a, b) =>
    compareStockCosts(a.amountMinor, b.amountMinor),
  );
  const last = points.at(-1);
  return (
    <div className="grid min-w-0 gap-3 border-t border-border pt-4">
      <Heading level={3}>Evolución del costo</Heading>
      {!history?.series.length ? (
        <Text variant="muted">
          Todavía no hay costos registrados para este período y local.
        </Text>
      ) : (
        <>
          <SelectField
            className="min-w-0 grid-cols-1"
            label="Insumo y local"
            options={history.series.map((item) => ({
              id: item.id,
              label: `${item.label} · ${item.locationName}`,
            }))}
            value={series?.id ?? null}
            onChange={(key) => onSelect(String(key))}
          />
          {series && last && (
            <>
              {points.length < 2 ? (
                <Text variant="muted">
                  {format(last.amountMinor)} · {stockCostDate(last.date)}. Un
                  registro; falta otro costo para ver la evolución.
                </Text>
              ) : validGeometry ? (
                <LineChart
                  title={`Costos registrados de ${series.label} · ${series.locationName}`}
                  description={`Línea recta entre ${points.length} observaciones reales. Eje horizontal: fecha. Eje vertical: ${history.currencyCode} por ${stockCostUnit(series.unit)}. Cada nodo permite consultar fecha y costo.`}
                  points={geometry.map(({ x, y }, index) => ({
                    x,
                    y: y!,
                    label: `${stockCostDate(points[index].date)} · ${format(points[index].amountMinor)}${points[index].isBaseline ? " · Anterior al período" : ""}`,
                  }))}
                  firstDate={stockCostDate(points[0].date)}
                  lastDate={stockCostDate(last.date)}
                  minimum={format(sorted[0].amountMinor)}
                  maximum={format(sorted.at(-1)!.amountMinor)}
                />
              ) : (
                <Text variant="muted">
                  Estos valores no se pueden representar en el gráfico.
                </Text>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

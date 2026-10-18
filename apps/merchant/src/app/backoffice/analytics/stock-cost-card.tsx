"use client";
import { useState } from "react";
import type { StockCostHistory } from "@mi-pasaporte/domain/analytics/stock-cost-contract";
import { Button, Heading, LineChart, SelectField, Text } from "../../../ui";
import {
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
  const [showRecords, setShowRecords] = useState(false);
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
  const sorted = [...points].sort(
    (a, b) => Number(a.amountMinor) - Number(b.amountMinor),
  );
  const last = points.at(-1);
  return (
    <div className="grid min-w-0 gap-4 border-t border-border pt-6">
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
              <div className="grid min-w-0 gap-1" aria-live="polite">
                <Text variant="label" className="break-words">
                  {series.label} · {series.locationName}
                </Text>
                <Text variant="label" className="break-words tabular-nums">
                  {format(last.amountMinor)}
                </Text>
                <Text variant="small">
                  Último costo registrado · {stockCostDate(last.date)}
                </Text>
              </div>
              {points.length < 2 ? (
                <Text variant="muted">
                  Todavía no hay cambios para comparar.
                </Text>
              ) : validGeometry ? (
                <LineChart
                  title={`Costos registrados de ${series.label} · ${series.locationName}`}
                  description={`Línea recta entre ${points.length} observaciones reales. Eje horizontal: fecha. Eje vertical: ${history.currencyCode} por ${stockCostUnit(series.unit)}. Todos los valores están disponibles en Ver registros.`}
                  points={geometry.map(({ x, y }) => ({ x, y: y! }))}
                  firstDate={stockCostDate(points[0].date)}
                  lastDate={stockCostDate(last.date)}
                  minimum={format(sorted[0].amountMinor)}
                  maximum={format(sorted.at(-1)!.amountMinor)}
                />
              ) : (
                <Text variant="muted">
                  Revisa los importes exactos en los registros; estos valores no
                  se pueden representar en el gráfico.
                </Text>
              )}
              <Text variant="small">
                Costos registrados en {history.currencyCode} por{" "}
                {stockCostUnit(series.unit)}. La línea une los registros; no
                completa días sin datos.
              </Text>
              {points.some((point) => point.isBaseline) && (
                <Text variant="small">
                  La observación anterior al período conserva su fecha original
                  y sirve como referencia.
                </Text>
              )}
              <Button
                variant="quiet"
                aria-expanded={showRecords}
                onPress={() => setShowRecords((value) => !value)}
              >
                {showRecords
                  ? "Ocultar registros"
                  : `Ver registros (${points.length})`}
              </Button>
              {showRecords && (
                <ul
                  aria-label="Registros de costo"
                  className="grid min-w-0 divide-y divide-border"
                >
                  {points.map((point) => (
                    <li
                      key={point.date}
                      className="grid min-w-0 gap-1 py-3 sm:grid-cols-2"
                    >
                      <div className="grid gap-1">
                        <Text variant="small">{stockCostDate(point.date)}</Text>
                        {point.isBaseline && (
                          <Text variant="small">Anterior al período</Text>
                        )}
                      </div>
                      <Text
                        variant="label"
                        className="break-words tabular-nums sm:text-right"
                      >
                        {format(point.amountMinor)}
                      </Text>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

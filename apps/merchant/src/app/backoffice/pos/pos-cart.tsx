"use client";
import { useState } from "react";
import { Button, Text } from "../../../ui";
import type { CartLine, CounterProduct } from "../counter/types";
import { formatMoney } from "../counter/types";
import type { DraftLine } from "./pos-types";

/** Display quantities by product; writing always keeps each snapshot separate. */
export function productCart(lines: DraftLine[]): CartLine[] {
  const grouped = new Map<string, CartLine>();
  for (const line of lines) {
    if (!line.productId) continue;
    const current = grouped.get(line.productId);
    grouped.set(line.productId, {
      productId: line.productId,
      name: line.name,
      unitPrice: line.unitPrice,
      quantity: (current?.quantity ?? 0) + line.quantity,
      hasStoredPrice: !line.needsPrice,
    });
  }
  return [...grouped.values()];
}
export function addProduct(
  lines: DraftLine[],
  product: CounterProduct,
): DraftLine[] {
  const existing = lines.findLast((line) => line.productId === product.id);
  if (existing) return quantityForLine(lines, existing.key, 1);
  if (lines.length >= 200) return lines;
  return [
    ...lines,
    {
      key: crypto.randomUUID(),
      productId: product.id,
      name: product.name,
      unitPrice: product.unitPrice ?? 0,
      quantity: 1,
      needsPrice: product.unitPrice === null,
    },
  ];
}
export function quantityForLine(
  lines: DraftLine[],
  key: string,
  delta: number,
) {
  return lines
    .map((line) =>
      line.key === key ? { ...line, quantity: line.quantity + delta } : line,
    )
    .filter((line) => line.quantity > 0);
}
export function productQuantity(
  lines: DraftLine[],
  productId: string,
  delta: number,
) {
  const line = lines.findLast((item) => item.productId === productId);
  return line ? quantityForLine(lines, line.key, delta) : lines;
}
export function productPrice(
  lines: DraftLine[],
  productId: string,
  value: number,
) {
  const line = lines.findLast(
    (item) => item.productId === productId && item.needsPrice,
  );
  return lines.map((item) =>
    item.key === line?.key
      ? { ...item, unitPrice: Number.isFinite(value) && value > 0 ? value : 0 }
      : item,
  );
}
export function PosCart({
  lines,
  currencyCode,
  busy,
  onQty,
  children,
}: {
  lines: DraftLine[];
  currencyCode: string;
  busy: boolean;
  onQty: (key: string, delta: number) => void;
  children: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const count = lines.reduce((sum, line) => sum + line.quantity, 0);
  const total =
    lines.reduce(
      (sum, line) => sum + Math.round(line.unitPrice * 100) * line.quantity,
      0,
    ) / 100;
  return (
    <div className="counter-detailed-footer">
      <Button
        variant="quiet"
        fullWidth
        className="justify-between"
        aria-expanded={expanded}
        aria-controls="pos-cart-detail"
        onPress={() => setExpanded((current) => !current)}
      >
        <Text as="span" variant="label">
          {count} artículos · {formatMoney(total, currencyCode)}
        </Text>
        <Text as="span" variant="small">
          {expanded ? "Ocultar detalle" : "Ver detalle"}
        </Text>
      </Button>
      {expanded && (
        <div
          id="pos-cart-detail"
          className="grid max-h-64 gap-3 overflow-auto py-3"
        >
          {!lines.length && (
            <Text variant="muted">
              Puedes guardar la mesa y agregar productos después.
            </Text>
          )}
          {lines.map((line) => (
            <div
              key={line.key}
              className="grid gap-1 border-b border-border pb-3"
            >
              <div className="flex justify-between gap-3">
                <Text variant="label">
                  {line.quantity} × {line.name}
                </Text>
                <Text>
                  {formatMoney(
                    (Math.round(line.unitPrice * 100) * line.quantity) / 100,
                    currencyCode,
                  )}
                </Text>
              </div>
              <Text variant="small">
                {formatMoney(line.unitPrice, currencyCode)} por unidad
                {line.lineId ? " · Precio guardado" : ""}
              </Text>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  isDisabled={busy}
                  aria-label={`Quitar unidad de ${line.name} a ${line.unitPrice.toFixed(2)}`}
                  onPress={() => onQty(line.key, -1)}
                >
                  −
                </Button>
                <Text as="span" variant="label">
                  {line.quantity}
                </Text>
                <Button
                  variant="secondary"
                  isDisabled={busy}
                  aria-label={`Añadir unidad de ${line.name} a ${line.unitPrice.toFixed(2)}`}
                  onPress={() => onQty(line.key, 1)}
                >
                  +
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-3 pt-2">{children}</div>
    </div>
  );
}

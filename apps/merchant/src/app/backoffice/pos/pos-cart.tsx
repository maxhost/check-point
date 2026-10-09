"use client";
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
      hasStoredPrice: true,
    });
  }
  return [...grouped.values()];
}
export function addProduct(
  lines: DraftLine[],
  product: CounterProduct,
): DraftLine[] {
  if (product.unitPrice === null) return lines;
  const existing = lines.findLast((line) => line.productId === product.id);
  if (existing) return quantityForLine(lines, existing.key, 1);
  if (lines.length >= 200) return lines;
  return [
    ...lines,
    {
      key: crypto.randomUUID(),
      productId: product.id,
      name: product.name,
      unitPrice: product.unitPrice,
      quantity: 1,
      needsPrice: false,
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
export function PosCart({
  lines,
  currencyCode,
  busy,
  onQty,
  showPrices = true,
  onRemove,
}: {
  lines: DraftLine[];
  currencyCode: string;
  busy: boolean;
  onQty: (key: string, delta: number) => void;
  showPrices?: boolean;
  onRemove?: (key: string) => void;
}) {
  return (
    <section aria-label="Productos del pedido" className="grid gap-4">
      {!lines.length && (
        <Text variant="muted">
          El pedido está vacío. Añade productos o guarda la mesa para continuar
          después.
        </Text>
      )}
      {lines.map((line) => (
        <div key={line.key} className="grid gap-3 border-b border-border pb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1 break-words">
              <Text variant="label">{line.name}</Text>
              {showPrices && (
                <Text variant="small">
                  {formatMoney(line.unitPrice, currencyCode)} por unidad
                  {line.lineId ? " · Precio guardado" : ""}
                </Text>
              )}
            </div>
            {showPrices && (
              <Text variant="label" className="shrink-0 whitespace-nowrap">
                {formatMoney(
                  (Math.round(line.unitPrice * 100) * line.quantity) / 100,
                  currencyCode,
                )}
              </Text>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              className="size-11 p-0!"
              isDisabled={busy}
              aria-label={`Quitar unidad de ${line.name}${showPrices ? ` a ${line.unitPrice.toFixed(2)}` : ""}`}
              onPress={() => onQty(line.key, -1)}
            >
              −
            </Button>
            <Text as="span" variant="label">
              {line.quantity}
            </Text>
            <Button
              variant="secondary"
              className="size-11 p-0!"
              isDisabled={busy}
              aria-label={`Añadir unidad de ${line.name}${showPrices ? ` a ${line.unitPrice.toFixed(2)}` : ""}`}
              onPress={() => onQty(line.key, 1)}
            >
              +
            </Button>
            {onRemove && (
              <Button
                variant="quiet"
                className="ml-auto text-danger!"
                isDisabled={busy}
                aria-label={`Quitar producto ${line.name}`}
                onPress={() => onRemove(line.key)}
              >
                Quitar
              </Button>
            )}
          </div>
        </div>
      ))}
    </section>
  );
}

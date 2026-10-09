import { Heading, Text } from "../../../ui";
import { formatMoney, unitLabel } from "../counter/types";
import type { PosOrder } from "./pos-types";
export function PosTicket({
  order,
  compact = false,
}: {
  order: PosOrder;
  compact?: boolean;
}) {
  const money = (value: string) =>
    formatMoney(Number(value), order.business.currencyCode);
  return (
    <section
      aria-label="Ticket de la orden"
      className="grid gap-4 print:visible print:absolute print:inset-x-0 print:top-0 print:p-4"
    >
      <Heading level={2} className={compact ? "hidden print:block" : undefined}>
        {order.business.name}
      </Heading>
      {order.location && (
        <Text className={compact ? "hidden print:block" : undefined}>
          {order.location.name}
        </Text>
      )}
      <Heading level={3} className={compact ? "hidden print:block" : undefined}>
        {order.tableLabel} ·{" "}
        {order.status === "open"
          ? "Precuenta"
          : order.status === "voided"
            ? "Anulada"
            : "Venta cerrada"}
      </Heading>
      <Text variant="small">
        {new Date(order.createdAt).toLocaleString("es-EC")} · {order.createdBy}
      </Text>
      <div className="grid gap-3 border-y border-border py-4">
        {order.items.map((item) => (
          <div className="flex justify-between gap-4" key={item.lineId}>
            <div>
              <Text variant="label">
                {item.quantity} × {item.name}
              </Text>
              <Text variant="small">{money(item.unitPrice)} por unidad</Text>
            </div>
            <Text>{money(item.lineTotal)}</Text>
          </div>
        ))}
      </div>
      {order.sale?.coupon && (
        <>
          <Text>Bruto: {money(order.sale.grossTotal)}</Text>
          <Text>
            {order.sale.coupon.label} · Descuento: −
            {money(order.sale.coupon.discountAmount)}
          </Text>
          {order.sale.coupon.extraUnits != null && (
            <Text>
              +{order.sale.coupon.extraUnits}{" "}
              {unitLabel(order.sale.kind, order.sale.coupon.extraUnits)} del
              cupón
            </Text>
          )}
        </>
      )}
      <Text variant="label">
        Total: {money(order.sale?.total ?? order.total)}
      </Text>
      {order.closedAt && (
        <Text variant="small">
          {new Date(order.closedAt).toLocaleString("es-EC")} · {order.closedBy}
        </Text>
      )}
      <Text variant="small">No es comprobante fiscal.</Text>
    </section>
  );
}
export function PosResult({ order }: { order: PosOrder }) {
  if (order.status !== "closed") return null;
  const sale = order.sale;
  const extra = sale?.coupon?.extraUnits ?? 0;
  return (
    <div className="grid gap-2 rounded-md bg-success-soft p-4 print:hidden">
      <Heading level={2}>Venta cerrada</Heading>
      {sale ? (
        <>
          <Text>{sale.consumer}</Text>
          <Text variant="label">
            +{sale.unitsGranted + extra}{" "}
            {unitLabel(sale.kind, sale.unitsGranted + extra)} acreditados
          </Text>
          {extra > 0 && (
            <Text>
              {sale.unitsGranted} de la compra + {extra} del cupón
            </Text>
          )}
          <Text>
            Saldo: {sale.balanceAfter} {unitLabel(sale.kind, sale.balanceAfter)}
          </Text>
        </>
      ) : (
        <Text>Venta cerrada sin pase.</Text>
      )}
    </div>
  );
}

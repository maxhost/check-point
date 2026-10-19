"use client";

import { Notes, Printer } from "iconoir-react";
import { Alert, Button, Heading, Text } from "../../../ui";
import type { PosOrderV2 } from "../contracts";
import type { MeasuredPrinting } from "./measured-printing";
import { measuredMoney } from "./measured-money";
import { PosPrintFeedback } from "./pos-print-feedback";
import { PosPrintTicket } from "./pos-print-ticket";

/** Canonical receipt only: printing never repeats the payment command. */
export function MeasuredTicket({
  order,
  printing,
  timeZone = "America/Guayaquil",
  disabled = false,
  onBack,
}: {
  order: PosOrderV2;
  printing: MeasuredPrinting;
  timeZone?: string;
  disabled?: boolean;
  onBack?: () => void;
}) {
  const sale = order.status === "closed" ? order.sale : null;
  const unit = sale?.kind === "stamps" ? "sellos" : "puntos";
  const status =
    order.status === "open"
      ? "Precuenta"
      : order.status === "closed"
        ? "Venta cerrada"
        : "Orden anulada";
  const currency =
    order.settlement?.currencyCode ?? order.business.currencyCode;
  const money = (value: string) => measuredMoney(value, currency);
  const date = (value: string) => {
    const timestamp = new Date(value);
    return Number.isNaN(timestamp.getTime())
      ? value
      : new Intl.DateTimeFormat("es-EC", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "numeric",
          minute: "2-digit",
          second: "2-digit",
          timeZone,
        }).format(timestamp);
  };
  const discount = order.settlement?.discount ?? sale?.coupon?.discountAmount;
  const rounding = order.settlement?.roundingAdjustment;
  const total = order.settlement?.collected ?? sale?.total ?? order.total;
  return (
    <section
      aria-label="Resultado y ticket"
      className="mx-auto grid w-full min-w-0 max-w-2xl gap-6 rounded-xl border border-border bg-surface p-5 md:p-6"
    >
      <div className="grid min-w-0 gap-6 break-words print:hidden">
        <div
          className={`grid gap-2 rounded-lg p-4 ${order.status === "voided" ? "bg-warning-soft" : order.status === "closed" ? "bg-success-soft" : "bg-primary-soft"}`}
        >
          <Heading level={1}>{status}</Heading>
          {order.status === "closed" &&
            (sale ? (
              <>
                <Text>Cliente: {sale.consumer}</Text>
                <Text>
                  Acreditación: {sale.unitsGranted} {unit}
                </Text>
                <Text>
                  Saldo: {sale.balanceAfter} {unit}
                </Text>
                {sale.coupon && <Text>Cupón: {sale.coupon.label}</Text>}
                {sale.coupon?.extraUnits !== null &&
                  sale.coupon?.extraUnits !== undefined && (
                    <Text>
                      Extras: {sale.coupon.extraUnits} {unit}
                    </Text>
                  )}
              </>
            ) : (
              <Text>Venta cerrada sin pase.</Text>
            ))}
          {order.status === "voided" && (
            <Text>
              Esta orden está anulada. Su ticket no acredita una venta.
            </Text>
          )}
        </div>
        <div className="grid gap-4">
          <Heading level={2}>{order.business.name}</Heading>
          {order.location && <Text>{order.location.name}</Text>}
          <Heading level={3}>
            {order.orderLabel || order.tableLabel || order.id} · {status}
          </Heading>
          <Text variant="small">
            {date(order.createdAt)}
            {order.createdBy ? ` · ${order.createdBy}` : ""}
          </Text>
        </div>
        <div className="grid gap-4 border-y border-border py-4">
          {order.items.map((line) => {
            const snapshot =
              order.settlement?.lines.find(
                (item) => item.sourceLineId === line.lineId,
              ) ?? line.financialSnapshot;
            return (
              <div
                className="flex min-w-0 items-start justify-between gap-4"
                key={line.lineId}
              >
                <div className="min-w-0">
                  <Text variant="label">
                    {line.quantity}
                    {line.measure.quantityUnit === "unit"
                      ? ""
                      : ` ${line.measure.quantityUnit}`}{" "}
                    × {line.name}
                  </Text>
                  <Text variant="small">
                    {money(line.unitPrice)} por{" "}
                    {line.measure.priceUnit === "unit"
                      ? "unidad"
                      : line.measure.priceUnit}
                  </Text>
                </div>
                <Text className="shrink-0 tabular-nums">
                  {money(snapshot?.money.net ?? line.lineTotal)}
                </Text>
              </div>
            );
          })}
        </div>
        {order.note && (
          <div className="flex items-start gap-2">
            <Notes className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <Text variant="small" className="min-w-0 whitespace-pre-wrap">
              Notas: {order.note}
            </Text>
          </div>
        )}
        <div className="grid gap-2">
          {discount && !/^0(?:\.0+)?$/.test(discount) && (
            <>
              <Text>
                Subtotal:{" "}
                {money(
                  order.settlement?.gross ?? sale?.grossTotal ?? order.total,
                )}
              </Text>
              <Text>
                {sale?.coupon?.label ?? "Descuento"}: −{money(discount)}
              </Text>
            </>
          )}
          {rounding && !/^-?0(?:\.0+)?$/.test(rounding) && (
            <Text>
              Ajuste de redondeo: {rounding.startsWith("-") ? "" : "+"}
              {money(rounding)}
            </Text>
          )}
          <Text variant="label">Total: {money(total)}</Text>
        </div>
        {order.closedAt && (
          <Text variant="small">
            {date(order.closedAt)}
            {order.closedBy ? ` · ${order.closedBy}` : ""}
          </Text>
        )}
        <Text variant="small">No es comprobante fiscal.</Text>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="secondary"
            onPress={printing.print}
            isDisabled={disabled || !printing.doc}
            isLoading={printing.busy}
            aria-label={
              order.status === "open"
                ? "Imprimir precuenta"
                : "Reimprimir ticket"
            }
          >
            {!printing.busy && (
              <Printer className="size-5" aria-hidden="true" />
            )}
            Imprimir
          </Button>
          {onBack && (
            <Button variant="quiet" isDisabled={disabled} onPress={onBack}>
              Volver al historial
            </Button>
          )}
        </div>
        {printing.ready && !printing.enabled && (
          <Alert
            kind="info"
            title="Impresión desactivada en los ajustes del POS"
          >
            <Button variant="quiet" onPress={printing.retrySettings}>
              Volver a leer ajustes de impresión
            </Button>
          </Alert>
        )}
      </div>
      <PosPrintFeedback printing={printing} />
      {printing.doc && (
        <div className="hidden print:block">
          <PosPrintTicket doc={printing.browserDoc ?? printing.doc} />
        </div>
      )}
    </section>
  );
}

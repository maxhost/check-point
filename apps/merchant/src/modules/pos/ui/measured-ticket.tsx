"use client";

import { Alert, Button, Heading, Text } from "../../../ui";
import type { PosOrderV2 } from "../contracts";
import type { MeasuredPrinting } from "./measured-printing";
import { PosPrintFeedback } from "./pos-print-feedback";
import { PosPrintTicket } from "./pos-print-ticket";

/** Presentation only: the parent owns the canonical order and prepares printing.
 * A print failure cannot revisit checkout or create another monetary command. */
export function MeasuredTicket({
  order,
  printing,
}: {
  order: PosOrderV2;
  printing: MeasuredPrinting;
}) {
  const sale = order.status === "closed" ? order.sale : null;
  const unit = sale?.kind === "stamps" ? "sellos" : "puntos";
  return (
    <section aria-label="Resultado y ticket" className="grid min-w-0 gap-6 p-4">
      <div className="grid min-w-0 gap-3 break-words print:hidden">
        <Heading level={2}>
          {order.status === "open"
            ? "Precuenta"
            : order.status === "closed"
              ? "Venta cerrada"
              : "Orden anulada"}
        </Heading>
        <Text>{order.orderLabel || order.id}</Text>
        {order.status === "closed" &&
          (sale ? (
            <div className="grid gap-2">
              <Text>Cliente: {sale.consumer}</Text>
              <Text>
                Acreditación: {sale.unitsGranted} {unit}
              </Text>
              <Text>
                Saldo: {sale.balanceAfter} {unit}
              </Text>
              {sale.coupon && (
                <>
                  <Text>Cupón: {sale.coupon.label}</Text>
                  <Text>
                    Descuento del cupón: {sale.coupon.discountAmount}{" "}
                    {order.settlement?.currencyCode ??
                      order.business.currencyCode}
                  </Text>
                  {sale.coupon.extraUnits !== null && (
                    <Text>
                      Extras: {sale.coupon.extraUnits} {unit}
                    </Text>
                  )}
                </>
              )}
            </div>
          ) : (
            <Text>Venta cerrada sin pase.</Text>
          ))}
        {order.status === "closed" && (
          <Text>
            La venta ya está cerrada. Puedes volver a imprimir su ticket.
          </Text>
        )}
        {order.status === "voided" && (
          <Alert
            kind="info"
            title="Esta orden está anulada. Su ticket no acredita una venta."
          />
        )}
        <div>
          <Button
            onPress={printing.print}
            isDisabled={!printing.doc}
            isLoading={printing.busy}
          >
            {order.status === "open"
              ? "Imprimir precuenta"
              : "Reimprimir ticket"}
          </Button>
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
        <PosPrintTicket doc={printing.browserDoc ?? printing.doc} />
      )}
    </section>
  );
}

import { formatTicketMoney } from "./money";
import type { TicketDoc, TicketOrder, TicketSettings } from "./types";

/**
 * Spec 0184 — QUE SE IMPRIME. Orden + ajuste del comercio + opciones → `TicketDoc` (datos puros,
 * sin bytes ni DOM). La base (items, total, fecha, hora, QR) va siempre; cada bloque opcional
 * tiene su linea aca y su campo en `TicketSettings`.
 *
 * - `qr`: el contenido del QR. Sin `qr` el ticket sale sin QR (spec B lo llena).
 * - `now`: el momento de la impresion (inyectable para las pruebas).
 */
export function buildTicket(
  order: TicketOrder,
  settings: TicketSettings,
  opts: { qr?: string; now?: Date } = {},
): TicketDoc {
  const money = (value: string) =>
    formatTicketMoney(value, order.business.currencyCode);
  const now = opts.now ?? new Date();
  const table = order.tableLabel?.trim() || null;
  return {
    businessName: settings.showBusinessName ? order.business.name : null,
    table: settings.showTable ? table : null,
    lines: order.items.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      unitPrice: money(item.unitPrice),
      lineTotal: money(item.lineTotal),
    })),
    total: money(order.total),
    date: now.toLocaleDateString("es-EC"),
    time: now.toLocaleTimeString("es-EC", {
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }),
    qr: opts.qr?.trim() || null,
  };
}

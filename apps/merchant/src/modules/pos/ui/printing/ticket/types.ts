import type { FinancialSettlement } from "@mi-pasaporte/domain/financial";
/**
 * Spec 0184 / ADR 0133 — LOS TIPOS DEL TICKET. `TicketDoc` es el UNICO contrato entre capas:
 * `ticket/` lo arma, `escpos/` lo convierte en bytes y la vista HTML del `window.print()` (GPT)
 * lo dibuja. Lo que no esta en `TicketDoc` no se imprime por ningun camino.
 */

/** El ajuste del comercio, igual al DTO de `GET /api/modules/pos/ticket` (`modules/pos/server/ticket-settings.ts`).
 * Solo los bloques OPCIONALES; ninguno es obligatorio. */
export type TicketSettings = {
  showBusinessName: boolean;
  showTable: boolean;
};

/** Lo que el modulo lee de una orden del POS: un subconjunto de `PosOrder`, para no acoplarse
 * al resto del tipo de la pantalla. Montos como los devuelve la API (texto decimal). */
export type TicketOrder = {
  business: { name: string; currencyCode: string };
  tableLabel: string | null;
  items: {
    name: string;
    quantity: number;
    unitPrice: string;
    lineTotal: string;
  }[];
  total: string;
  sale?: { total: string } | null;
  settlement?: Pick<
    FinancialSettlement,
    "gross" | "discount" | "roundingAdjustment" | "collected"
  > | null;
};

export type TicketLine = {
  name: string;
  /** Measured tickets preserve the exact decimal and its unit as text. */
  quantity: number | string;
  /** Ya formateados con la moneda del negocio. */
  unitPrice: string;
  lineTotal: string;
};

export type TicketDoc = {
  /** Optional V2 headings shared by HTML and ESC/POS; legacy documents omit them. */
  metadata?: {
    kind: string;
    saleType: string;
    identifier: string;
    note: string | null;
  };
  summary?: {
    gross: string;
    discount: string;
    roundingAdjustment: string | null;
  };
  /** `null` si el comercio apago el bloque. */
  businessName: string | null;
  /** `null` si el comercio apago el bloque o la orden no tiene mesa. */
  table: string | null;
  lines: TicketLine[];
  total: string;
  /** Fecha y hora de la IMPRESION, ya formateadas. */
  date: string;
  time: string;
  /** Contenido del QR; `null` → el bloque no se imprime (lo llena la spec B, PARQUEADO #85). */
  qr: string | null;
};

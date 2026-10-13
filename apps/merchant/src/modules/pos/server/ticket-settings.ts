import { eq, sql } from "drizzle-orm";
import { getDb } from "@mi-pasaporte/db";
import { ticketSettings } from "@mi-pasaporte/db/schema";

/**
 * Spec 0184 / ADR 0133 — EL AJUSTE DEL TICKET por comercio: que bloques OPCIONALES lleva el ticket
 * impreso del POS. La base (items, total, fecha, hora, QR) no se configura.
 *
 * `businessId` sale SIEMPRE de la sesion (el despachador: `owner: true` para editar, permiso `pos`
 * para leer desde el POS), nunca del cuerpo ni de la query. Sin fila = `DEFAULT_TICKET_SETTINGS`. Ninguna opcion es obligatoria.
 *
 * Spec 0206: `printingEnabled` = si el negocio imprime tickets; APAGADO por defecto (owner
 * 2026-10-11). Apagarlo NO borra los bloques: quedan guardados para cuando se prenda.
 *
 * Para sumar un bloque: columna con default en `schema/modules/pos.ts`, campo en
 * `TicketSettings` y en `DEFAULT_TICKET_SETTINGS`, y en `parseTicketSettings`.
 */
export type TicketSettings = {
  printingEnabled: boolean;
  showBusinessName: boolean;
  showTable: boolean;
};

/** Iguales a los defaults de las columnas: un negocio sin fila lee lo mismo que con una nueva. */
export const DEFAULT_TICKET_SETTINGS: TicketSettings = {
  printingEnabled: false,
  showBusinessName: true,
  showTable: true,
};

export async function readTicketSettings(
  businessId: string,
): Promise<TicketSettings> {
  const [row] = await getDb()
    .select({
      printingEnabled: ticketSettings.printingEnabled,
      showBusinessName: ticketSettings.showBusinessName,
      showTable: ticketSettings.showTable,
    })
    .from(ticketSettings)
    .where(eq(ticketSettings.businessId, businessId))
    .limit(1);
  return row ?? { ...DEFAULT_TICKET_SETTINGS };
}

export async function saveTicketSettings(
  businessId: string,
  settings: TicketSettings,
): Promise<TicketSettings> {
  const [row] = await getDb()
    .insert(ticketSettings)
    .values({ businessId, ...settings })
    .onConflictDoUpdate({
      target: ticketSettings.businessId,
      set: { ...settings, updatedAt: sql`now()` },
    })
    .returning({
      printingEnabled: ticketSettings.printingEnabled,
      showBusinessName: ticketSettings.showBusinessName,
      showTable: ticketSettings.showTable,
    });
  return row!;
}

/** El cuerpo del `PUT`: los tres campos, booleanos y obligatorios (es el ajuste entero). `null` =
 * 422 `invalid_input` en la ruta. */
export function parseTicketSettings(
  body: Record<string, unknown>,
): TicketSettings | null {
  const { printingEnabled, showBusinessName, showTable } = body;
  if (
    typeof printingEnabled !== "boolean" ||
    typeof showBusinessName !== "boolean" ||
    typeof showTable !== "boolean"
  )
    return null;
  return { printingEnabled, showBusinessName, showTable };
}

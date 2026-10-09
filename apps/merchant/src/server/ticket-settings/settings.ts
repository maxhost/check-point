import { eq, sql } from "drizzle-orm";
import { getDb } from "@mi-pasaporte/db";
import { ticketSettings } from "@mi-pasaporte/db/schema";

/**
 * Spec 0184 / ADR 0133 — EL AJUSTE DEL TICKET por comercio: que bloques OPCIONALES lleva el ticket
 * impreso del POS. La base (items, total, fecha, hora, QR) no se configura.
 *
 * `businessId` sale SIEMPRE de la sesion (`requireApiOwner` / `requirePosOperator`), nunca del
 * cuerpo ni de la query. Sin fila = `DEFAULT_TICKET_SETTINGS`. Ninguna opcion es obligatoria.
 *
 * Para sumar un bloque: columna con default en `schema/ticket-settings.ts`, campo en
 * `TicketSettings` y en `DEFAULT_TICKET_SETTINGS`, y en `parseTicketSettings`.
 */
export type TicketSettings = {
  showBusinessName: boolean;
  showTable: boolean;
};

/** Iguales a los defaults de las columnas: un negocio sin fila lee lo mismo que con una nueva. */
export const DEFAULT_TICKET_SETTINGS: TicketSettings = {
  showBusinessName: true,
  showTable: true,
};

export async function readTicketSettings(
  businessId: string,
): Promise<TicketSettings> {
  const [row] = await getDb()
    .select({
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
      showBusinessName: ticketSettings.showBusinessName,
      showTable: ticketSettings.showTable,
    });
  return row!;
}

/** El cuerpo del `PUT`: los dos campos, booleanos. `null` = 422 `invalid_input` en la ruta. */
export function parseTicketSettings(
  body: Record<string, unknown>,
): TicketSettings | null {
  const { showBusinessName, showTable } = body;
  if (typeof showBusinessName !== "boolean" || typeof showTable !== "boolean")
    return null;
  return { showBusinessName, showTable };
}

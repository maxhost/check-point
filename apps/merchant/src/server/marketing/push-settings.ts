import { eq } from "drizzle-orm";
import { getDb } from "@mi-pasaporte/db";
import { businesses } from "@mi-pasaporte/db/schema";
import { CampaignError } from "./campaign-store";
import type { FieldErrors, ParseResult } from "./campaign-input";
import { asObject } from "./campaign-values";

/**
 * `GET`/`PATCH /api/marketing/settings` (spec 0103 §11 / ADR 0095 §6): the hours in which
 * a CAMPAIGN push of the business may go out, `[startHour, endHour)` in its `timeZone`.
 * Scoped by the SESSION's business; nothing in the body can name another.
 */

export type PushWindow = { startHour: number; endHour: number };

export type MarketingSettings = {
  pushWindow: PushWindow;
  timeZone: string;
};

const WINDOW_MESSAGE =
  "El horario tiene que ser de horas enteras: inicio 0–23, fin 1–24 y el inicio antes del fin.";

/** PURE. Same ranges as `core_business_push_window_check`, answered as a 400 first. */
export function parsePushWindowPatch(value: unknown): ParseResult<PushWindow> {
  const window = asObject(asObject(value).pushWindow);
  const { startHour, endHour } = window;
  const errors: FieldErrors = { pushWindow: WINDOW_MESSAGE };
  if (
    typeof startHour !== "number" ||
    typeof endHour !== "number" ||
    !Number.isInteger(startHour) ||
    !Number.isInteger(endHour) ||
    startHour < 0 ||
    startHour > 23 ||
    endHour < 1 ||
    endHour > 24 ||
    startHour >= endHour
  )
    return { ok: false, errors };
  return { ok: true, value: { startHour, endHour } };
}

export async function loadMarketingSettings(
  businessId: string,
): Promise<MarketingSettings> {
  const [row] = await getDb()
    .select({
      startHour: businesses.pushWindowStartHour,
      endHour: businesses.pushWindowEndHour,
      timeZone: businesses.timezone,
    })
    .from(businesses)
    .where(eq(businesses.id, businessId))
    .limit(1);
  if (!row)
    throw new CampaignError(404, "not_found", "No encontramos el negocio.");
  return {
    pushWindow: { startHour: row.startHour, endHour: row.endHour },
    timeZone: row.timeZone,
  };
}

export async function updateMarketingSettings(
  businessId: string,
  body: unknown,
): Promise<MarketingSettings> {
  const parsed = parsePushWindowPatch(body);
  if (!parsed.ok)
    throw new CampaignError(
      400,
      "validation",
      "Revisa el horario de envío.",
      parsed.errors,
    );
  await getDb()
    .update(businesses)
    .set({
      pushWindowStartHour: parsed.value.startHour,
      pushWindowEndHour: parsed.value.endHour,
    })
    .where(eq(businesses.id, businessId));
  return await loadMarketingSettings(businessId);
}

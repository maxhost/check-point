import { sql } from "drizzle-orm";
import { getDb, withDbTransaction } from "@mi-pasaporte/db";
import { isUuid } from "@mi-pasaporte/domain/server/counter/core";
import { CampaignError } from "./campaign-store";
import {
  type Db,
  rowsOf,
} from "@mi-pasaporte/domain/server/marketing/cross-store";
import { toDate } from "@mi-pasaporte/domain/server/marketing/driver-values";
import type { DetectionStatus } from "@mi-pasaporte/domain/server/marketing/valley-detect";
import { parseValleyWindows } from "./valley-input";
import { campaignKindEnabled } from "@mi-pasaporte/domain/server/marketing/enabled-campaigns";
import {
  type ValleyWindow,
  type WindowSource,
  effectiveWindows,
} from "@mi-pasaporte/domain/server/marketing/valley-rules";
import {
  heatmapOf,
  loadHours,
  loadScanCells,
  loadWindowRows,
  replaceWindows,
} from "@mi-pasaporte/domain/server/marketing/valley-store";

/**
 * THE MERCHANT'S «HORAS VALLE» API (spec 0113 H2 of `0113-contratos-de-api.md`): per
 * location, what the network proposed, the merchant's own windows, which of the two rule,
 * and the heat map that explains the proposal. Scoped by the SESSION's `business_id`: a
 * location of another business —or an id that is not one— is a 404, never a write.
 * Apart from `valley-store.ts` only for the size budget.
 *
 * Spec 0138 / ADR 0115: while «Horas valle» is OFF (`enabled-campaigns.ts`) the whole API
 * is a 404 `not_found` — the merchant does not see what is off.
 */

export type ValleyLocationView = {
  locationId: string;
  name: string;
  hoursSet: boolean;
  detection: {
    status: DetectionStatus;
    computedAt: Date;
    scans: number;
  } | null;
  networkWindows: ValleyWindow[];
  merchantWindows: ValleyWindow[];
  effective: WindowSource;
  heatmap: number[][];
};

type OwnLocation = { id: string; name: string; timeZone: string };

async function ownLocations(
  db: Db,
  businessId: string,
  locationId?: string,
): Promise<OwnLocation[]> {
  const result = await db.execute(sql`
    select l.id, l.name, b.timezone from core.location l
    join core.business b on b.id = l.business_id
    where l.business_id = ${businessId}
      ${locationId ? sql`and l.id = ${locationId}` : sql`and l.status = 'active'`}
    order by l.created_at, l.id`);
  return rowsOf<Record<string, unknown>>(result).map((row) => ({
    id: String(row.id),
    name: String(row.name),
    timeZone: String(row.timezone),
  }));
}

async function views(
  db: Db,
  businessId: string,
  own: OwnLocation[],
  now: Date,
): Promise<ValleyLocationView[]> {
  const ids = own.map((location) => location.id);
  const hours = await loadHours(db, ids);
  const windows = await loadWindowRows(db, ids);
  const detections = new Map(
    rowsOf<Record<string, unknown>>(
      ids.length === 0
        ? []
        : await db.execute(sql`
            select d.location_id, d.status, d.computed_at, d.scans
            from core.valley_detection d
            where d.location_id in (${sql.join(
              ids.map((id) => sql`${id}`),
              sql`, `,
            )})`),
    ).map((row) => [String(row.location_id), row]),
  );
  const out: ValleyLocationView[] = [];
  for (const location of own) {
    const rows = windows.get(location.id) ?? [];
    const of = (source: WindowSource) =>
      effectiveWindows(rows.filter((row) => row.source === source)).windows;
    const detection = detections.get(location.id);
    const cells = await loadScanCells(
      db,
      { id: location.id, businessId, timeZone: location.timeZone },
      now,
    );
    out.push({
      locationId: location.id,
      name: location.name,
      hoursSet: hours.has(location.id),
      detection: detection
        ? {
            status: String(detection.status) as DetectionStatus,
            computedAt: toDate(detection.computed_at) as Date,
            scans: Number(detection.scans),
          }
        : null,
      networkWindows: of("network"),
      merchantWindows: of("merchant"),
      effective: effectiveWindows(rows).effective,
      heatmap: heatmapOf(cells),
    });
  }
  return out;
}

function assertValleyOn(): void {
  if (!campaignKindEnabled("valley"))
    throw new CampaignError(404, "not_found", "No existe esa plantilla.");
}

/** `GET /api/marketing/valley/locations` — one entry per ACTIVE location. */
export async function listValleyLocations(
  businessId: string,
  now: Date = new Date(),
): Promise<ValleyLocationView[]> {
  assertValleyOn();
  const db = getDb();
  return await views(db, businessId, await ownLocations(db, businessId), now);
}

function unknownLocation(): CampaignError {
  return new CampaignError(404, "not_found", "No existe ese local.");
}

async function requireOwn(
  db: Db,
  businessId: string,
  locationId: string,
): Promise<OwnLocation> {
  const [own] = isUuid(locationId)
    ? await ownLocations(db, businessId, locationId)
    : [];
  if (!own) throw unknownLocation();
  return own;
}

/** `PUT …/{locationId}/windows` — replaces the merchant's windows of the location. */
export async function replaceMerchantWindows(
  businessId: string,
  locationId: string,
  body: unknown,
  now: Date = new Date(),
): Promise<ValleyLocationView> {
  assertValleyOn();
  const parsed = parseValleyWindows(body);
  if (!parsed.ok)
    throw new CampaignError(
      400,
      "validation",
      "Revisa las franjas.",
      parsed.fields,
    );
  const own = await withDbTransaction(async (tx) => {
    const location = await requireOwn(tx, businessId, locationId);
    await replaceWindows(tx, location.id, "merchant", parsed.windows);
    return location;
  });
  const [view] = await views(getDb(), businessId, [own], now);
  return view;
}

/** `DELETE …/{locationId}/windows` — back to the network's windows. */
export async function clearMerchantWindows(
  businessId: string,
  locationId: string,
): Promise<void> {
  assertValleyOn();
  const db = getDb();
  const location = await requireOwn(db, businessId, locationId);
  await replaceWindows(db, location.id, "merchant", []);
}

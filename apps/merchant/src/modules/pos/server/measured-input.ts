import type { PosCreateV2, PosUpdateV2, SaleType } from "../contracts";
import {
  inputObject,
  inputUuid,
  invalidPosInput,
  parseMeasuredLineInput,
} from "./measured-line-input";

function reference(raw: unknown, field: string): string | null {
  return raw === null ? null : inputUuid(raw, field);
}
function note(raw: unknown): string | null {
  if (raw === null) return null;
  if (typeof raw !== "string" || raw.trim().length > 1000) invalidPosInput();
  return raw.trim() || null;
}
function label(raw: unknown): string {
  if (typeof raw !== "string" || !raw.trim() || raw.trim().length > 60)
    invalidPosInput();
  return raw.trim();
}
/** Only the service's existing order may authorize a legacy update. */
export type TrustedPosOrderContext = Readonly<{ saleType: SaleType }>;
function context(
  value: Record<string, unknown>,
  existing?: TrustedPosOrderContext,
): Pick<
  PosUpdateV2,
  "saleType" | "orderLabel" | "locationId" | "tableId" | "note"
> {
  const saleType = value.saleType;
  if (
    saleType !== "table" &&
    saleType !== "pickup" &&
    saleType !== "delivery" &&
    saleType !== "counter" &&
    !(saleType === "legacy" && existing?.saleType === "legacy")
  )
    invalidPosInput();
  const tableId = reference(value.tableId, "tableId");
  const locationId = reference(value.locationId, "locationId");
  if (saleType !== "table" && saleType !== "legacy" && tableId !== null)
    invalidPosInput();
  if (saleType === "legacy" && tableId !== null) invalidPosInput();
  // Actual table labels and counter identifiers have no client authority. The service
  // resolves/generates them after replay; no current DB label enters the fingerprint.
  const orderLabel =
    saleType === "counter" || (saleType === "table" && tableId !== null)
      ? ""
      : label(value.orderLabel);
  return { saleType, orderLabel, locationId, tableId, note: note(value.note) };
}
function items(raw: unknown, existing: boolean) {
  if (!Array.isArray(raw) || raw.length > 200) invalidPosInput();
  const ids = new Set<string>();
  return Array.from(raw, (value) => {
    const line = parseMeasuredLineInput(value, existing);
    if (line.lineId) {
      if (ids.has(line.lineId)) invalidPosInput();
      ids.add(line.lineId);
    }
    return line;
  });
}
const CONTEXT_KEYS = [
  "saleType",
  "orderLabel",
  "locationId",
  "tableId",
  "note",
  "items",
];
/** Pure syntax/normalization only: no guard, tenant, table or catalog lookup. */
export function parsePosCreateV2(raw: unknown): PosCreateV2 {
  const value = inputObject(raw, ["createRequestId", ...CONTEXT_KEYS]);
  const parsed = context(value);
  // context without a trusted existing row always rejects legacy.
  if (parsed.saleType === "legacy") invalidPosInput();
  return {
    createRequestId: inputUuid(value.createRequestId, "createRequestId"),
    ...parsed,
    saleType: parsed.saleType,
    items: items(value.items, false) as PosCreateV2["items"],
  };
}
/** Existing line syntax remains provisional until resolveExistingMeasuredLine is called
 * with the authoritative order snapshots by the future transactional service. */
export function parsePosUpdateV2(
  raw: unknown,
  existing?: TrustedPosOrderContext,
): PosUpdateV2 {
  const value = inputObject(raw, ["version", ...CONTEXT_KEYS]);
  if (
    typeof value.version !== "number" ||
    !Number.isInteger(value.version) ||
    value.version < 1 ||
    value.version > 2147483647
  )
    invalidPosInput();
  return {
    version: value.version,
    ...context(value, existing),
    items: items(value.items, true),
  };
}

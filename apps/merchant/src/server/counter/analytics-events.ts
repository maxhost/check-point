import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import {
  originalMoney,
  toMinor,
  minorUnitForCurrency,
} from "@mi-pasaporte/domain/financial/rational";

/** Analytics-only namespace. Name is tenant UUID + ':' + consumer UUID, lowercase UTF-8. */
export const ANALYTICS_CUSTOMER_NAMESPACE =
  "9c60310e-6d2c-57a6-8f09-bb43b6506447";
export function analyticsCustomerId(
  businessId: string,
  consumerId: string,
): string {
  const bytes = createHash("sha1")
    .update(
      Buffer.from(ANALYTICS_CUSTOMER_NAMESPACE.replaceAll("-", ""), "hex"),
    )
    .update(`${businessId.toLowerCase()}:${consumerId.toLowerCase()}`, "utf8")
    .digest()
    .subarray(0, 16);
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
export function analyticsMoney(amount: string, currencyCode: string) {
  const minorUnit = minorUnitForCurrency(currencyCode);
  return {
    amountMinor: String(toMinor(originalMoney(amount), minorUnit)),
    currencyCode,
    minorUnit,
  };
}
/** Runs in the grant's single SQL statement, FROM ins only: retries and aborts publish nothing. */
export function visitEventCtes(input: {
  businessId: string;
  consumerId: string;
  locationId: string | null;
  total: string;
  currencyCode: string;
}) {
  const money = analyticsMoney(input.total, input.currencyCode);
  const customerId = analyticsCustomerId(input.businessId, input.consumerId);
  return sql`, analytics_visit AS (
    INSERT INTO core.module_event (business_id,event_type,event_version,source_id,location_id,payload)
    SELECT ins.business_id,'visit.recorded',1,ins.id,${input.locationId}::uuid,
      jsonb_build_object('eventVersion',1,'orderId',ins.id,'customerId',${customerId}::text,
        'customerLabel',(SELECT concat_ws(' ',first_name,last_name) FROM consumer.consumer_account WHERE id=ins.consumer_id),
        'locationId',${input.locationId}::uuid,'occurredAt',ins.created_at,
        'amountMinor',${money.amountMinor}::text,'currencyCode',${money.currencyCode}::text,'minorUnit',${money.minorUnit}::integer)
    FROM ins RETURNING id
  ), analytics_visit_delivery AS (
    INSERT INTO core.module_event_delivery (event_id,subscriber_id,state)
    SELECT id,'core.analytics','pending' FROM analytics_visit
  )`;
}
export type VisitRecorded = {
  eventVersion: 1;
  orderId: string;
  customerId: string;
  customerLabel: string;
  locationId: string | null;
  occurredAt: string;
  amountMinor: string;
  currencyCode: string;
  minorUnit: 0 | 2;
};
export type CouponRedeemed = {
  eventVersion: 1;
  couponId: string;
  orderId: string;
  campaignId: string;
  campaignLabel: string;
  locationId: string | null;
  occurredAt: string;
  discountMinor: string;
  salesMinor: string;
  costMinor: string;
  currencyCode: string;
  minorUnit: 0 | 2;
};

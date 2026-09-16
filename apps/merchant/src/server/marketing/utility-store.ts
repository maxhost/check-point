/**
 * The UTILITY bag of step 4 (spec 0065): the doors a consumer gets because of their OWN
 * balance, not because a business paid. It is never filtered by the marketing opt-out —
 * a consumer who switched promotions off keeps seeing their sellos.
 *
 * A membership qualifies with a LIVE relationship: an order in the last 30 days, or a
 * balance of points, or a balance of stamps. The door is attributed by the same rule as
 * a turn's (`attributableLocation`), over the business's `active` doors WITH
 * coordinates, and the sentence is `utilityText` — both pure, both shared, so «which
 * door» and «what it says» have exactly one definition in the codebase.
 */

import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import type { DbTransaction } from "../db";
import { locations, loyaltyRewards } from "../schema";
import { toLatLng } from "../wallet/pass-locations";
import { attributableLocation } from "./audience";
import { requireDate, toDate } from "./driver-values";
import type { UtilityCandidate } from "./placement-plan";
import { utilityText } from "./utility-text";

/** ORQUESTADOR (spec 0065): «relacion viva» counts an order this recent. */
export const UTILITY_FRESH_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

type MembershipRow = {
  membershipId: string;
  businessId: string;
  businessName: string;
  programId: string;
  programKind: string;
  programConfiguration: unknown;
  pointsBalance: number;
  stampsCount: number;
  originLocationId: string | null;
  enrolledAt: Date;
  lastOrderAt: Date | null;
  lastOrderLocationId: string | null;
};

/**
 * ⚠️ RAW SQL with an explicit alias (`m`) for the same measured reason as
 * `audience-store.ts`: drizzle renders a column embedded in a `sql` template
 * unqualified, so a correlated subquery silently binds to the INNER table's column of
 * the same name and stops being correlated. Here it would have made every membership
 * look «live».
 */
async function loadLiveMemberships(
  db: DbTransaction,
  consumerId: string,
  freshFloor: Date,
): Promise<MembershipRow[]> {
  const result = await db.execute<{
    membership_id: string;
    business_id: string;
    business_name: string;
    program_id: string;
    program_kind: string;
    program_configuration: unknown;
    points_balance: number;
    stamps_count: number;
    origin_location_id: string | null;
    enrolled_at: string;
    last_order_at: string | null;
    last_order_location_id: string | null;
  }>(sql`
    select
      m.id as membership_id,
      m.business_id,
      b.name as business_name,
      p.id as program_id,
      p.kind as program_kind,
      p.configuration as program_configuration,
      m.points_balance,
      m.stamps_count,
      m.origin_location_id,
      m.enrolled_at,
      (select max(o.created_at) from core."order" o
         where o.business_id = m.business_id and o.consumer_id = m.consumer_id) as last_order_at,
      (select o.location_id from core."order" o
         where o.business_id = m.business_id and o.consumer_id = m.consumer_id
         order by o.created_at desc, o.id desc limit 1) as last_order_location_id
    from consumer.program_membership m
    join core.loyalty_program p on p.id = m.program_id
    join core.business b on b.id = m.business_id
    where m.consumer_id = ${consumerId}
      and (
        m.points_balance > 0
        or m.stamps_count > 0
        or exists (select 1 from core."order" o
             where o.business_id = m.business_id and o.consumer_id = m.consumer_id
               and o.created_at >= ${freshFloor})
      )
  `);
  return result.rows.map((row) => ({
    membershipId: row.membership_id,
    businessId: row.business_id,
    businessName: row.business_name,
    programId: row.program_id,
    programKind: row.program_kind,
    programConfiguration: row.program_configuration,
    pointsBalance: Number(row.points_balance),
    stampsCount: Number(row.stamps_count),
    originLocationId: row.origin_location_id,
    enrolledAt: requireDate(row.enrolled_at),
    lastOrderAt: toDate(row.last_order_at),
    lastOrderLocationId: row.last_order_location_id,
  }));
}

/** The `active` doors WITH coordinates of each business, grouped. A door without
 * coordinates is not a candidate at all (`toLatLng` is the single home of that rule). */
async function loadUsableDoors(
  db: DbTransaction,
  businessIds: string[],
): Promise<
  Map<string, { locationId: string; latitude: number; longitude: number }[]>
> {
  const byBusiness = new Map<
    string,
    { locationId: string; latitude: number; longitude: number }[]
  >();
  if (businessIds.length === 0) return byBusiness;
  const rows = await db
    .select({
      locationId: locations.id,
      businessId: locations.businessId,
      latitude: locations.latitude,
      longitude: locations.longitude,
    })
    .from(locations)
    .where(
      and(
        inArray(locations.businessId, businessIds),
        eq(locations.status, "active"),
        isNotNull(locations.latitude),
        isNotNull(locations.longitude),
      ),
    );
  for (const row of rows) {
    const point = toLatLng(row.latitude, row.longitude);
    if (!point) continue;
    const list = byBusiness.get(row.businessId) ?? [];
    list.push({ locationId: row.locationId, ...point });
    byBusiness.set(row.businessId, list);
  }
  return byBusiness;
}

async function loadRewards(
  db: DbTransaction,
  programIds: string[],
): Promise<Map<string, { pointsCost: number | null }[]>> {
  const byProgram = new Map<string, { pointsCost: number | null }[]>();
  if (programIds.length === 0) return byProgram;
  const rows = await db
    .select({
      programId: loyaltyRewards.programId,
      pointsCost: loyaltyRewards.pointsCost,
    })
    .from(loyaltyRewards)
    .where(inArray(loyaltyRewards.programId, programIds));
  for (const row of rows) {
    const list = byProgram.get(row.programId) ?? [];
    list.push({ pointsCost: row.pointsCost });
    byProgram.set(row.programId, list);
  }
  return byProgram;
}

export async function loadUtilityCandidates(
  db: DbTransaction,
  consumerId: string,
  now: Date,
  freshDays: number = UTILITY_FRESH_DAYS,
): Promise<UtilityCandidate[]> {
  const memberships = await loadLiveMemberships(
    db,
    consumerId,
    new Date(now.getTime() - freshDays * DAY_MS),
  );
  if (memberships.length === 0) return [];
  const doors = await loadUsableDoors(db, [
    ...new Set(memberships.map((row) => row.businessId)),
  ]);
  const rewards = await loadRewards(db, [
    ...new Set(memberships.map((row) => row.programId)),
  ]);
  return memberships.flatMap((row) => {
    const usable = doors.get(row.businessId) ?? [];
    const locationId = attributableLocation(
      row,
      usable.map((door) => door.locationId),
    );
    const door = usable.find(
      (candidate) => candidate.locationId === locationId,
    );
    if (!door) return [];
    return [
      {
        membershipId: row.membershipId,
        businessId: row.businessId,
        businessName: row.businessName,
        locationId: door.locationId,
        latitude: door.latitude,
        longitude: door.longitude,
        text: utilityText(
          {
            businessName: row.businessName,
            pointsBalance: row.pointsBalance,
            stampsCount: row.stampsCount,
          },
          { kind: row.programKind, configuration: row.programConfiguration },
          rewards.get(row.programId) ?? [],
        ),
        // «Ultima actividad» orders the bag when it has more than three doors: the last
        // purchase, or the enrolment for a membership that never bought.
        lastActivityAt: row.lastOrderAt ?? row.enrolledAt,
      },
    ];
  });
}

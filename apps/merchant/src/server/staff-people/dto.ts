import type { DbTransaction } from "@mi-pasaporte/db";
import { memberships, staffPersons } from "@mi-pasaporte/db/schema";
import { and, asc, eq } from "drizzle-orm";
import { normalizeValidPermissions } from "../../modules/permissions";
import { listStaffLocationTimeline } from "../staff-location-timeline";
import { StaffError } from "../staff-error";

export type StaffPersonDTO = {
  id: string;
  name: string;
  revision: number;
  access: {
    state: "none" | "active" | "disabled";
    userId: string | null;
    identifier: string | null;
    permissions: string[];
  };
  locationsConfigured: boolean;
  locationIds: string[];
};
export async function personDTO(
  tx: DbTransaction,
  business: { id: string; slug: string },
  personId: string,
  month: string,
): Promise<StaffPersonDTO> {
  const [row] = await tx
    .select({
      id: staffPersons.id,
      name: staffPersons.name,
      revision: staffPersons.revision,
      userId: staffPersons.membershipUserId,
      status: memberships.status,
      handle: memberships.handle,
      permissions: memberships.permissions,
    })
    .from(staffPersons)
    .leftJoin(
      memberships,
      and(
        eq(memberships.businessId, staffPersons.businessId),
        eq(memberships.userId, staffPersons.membershipUserId),
      ),
    )
    .where(
      and(
        eq(staffPersons.businessId, business.id),
        eq(staffPersons.id, personId),
      ),
    );
  if (!row)
    throw new StaffError(404, "Esa persona no existe.", "person_not_found");
  const timeline = await listStaffLocationTimeline(tx, business.id, personId);
  const period = timeline.find(
    (p) =>
      p.fromMonth <= month && (p.untilMonth === null || month < p.untilMonth),
  );
  return {
    id: row.id,
    name: row.name,
    revision: row.revision,
    access: {
      state: !row.userId
        ? "none"
        : row.status === "active"
          ? "active"
          : "disabled",
      userId: row.userId,
      identifier: row.handle ? `${row.handle}@${business.slug}` : null,
      permissions: row.userId
        ? normalizeValidPermissions(row.permissions ?? [])
        : [],
    },
    locationsConfigured: !!period?.locationIds.length,
    locationIds: period?.locationIds ?? [],
  };
}
export async function personIds(tx: DbTransaction, businessId: string) {
  return tx
    .select({ id: staffPersons.id })
    .from(staffPersons)
    .where(eq(staffPersons.businessId, businessId))
    .orderBy(asc(staffPersons.createdAt), asc(staffPersons.id));
}

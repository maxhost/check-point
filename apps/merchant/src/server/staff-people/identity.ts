import type { DbTransaction } from "@mi-pasaporte/db";
import { memberships, users, staffPersons } from "@mi-pasaporte/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { lockStaffBusiness } from "../staff-location-timeline";

/** Legacy lookup remains user-scoped; lazily repairs a missing identity after writer rollout. */
export async function lockLinkedStaffPerson(
  tx: DbTransaction,
  businessId: string,
  userId: string,
) {
  await lockStaffBusiness(tx, businessId);
  const [target] = await tx
    .select({ name: users.name, role: memberships.role })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(
      and(
        eq(memberships.businessId, businessId),
        eq(memberships.userId, userId),
      ),
    );
  if (!target || target.role !== "staff") return null;
  await tx
    .insert(staffPersons)
    .values({ businessId, membershipUserId: userId, name: target.name })
    .onConflictDoNothing({
      target: [staffPersons.businessId, staffPersons.membershipUserId],
    });
  const [person] = await tx
    .select()
    .from(staffPersons)
    .where(
      and(
        eq(staffPersons.businessId, businessId),
        eq(staffPersons.membershipUserId, userId),
      ),
    )
    .for("update");
  return person ?? null;
}
export async function touchStaffPerson(
  tx: DbTransaction,
  businessId: string,
  personId: string,
  name?: string,
) {
  await tx
    .update(staffPersons)
    .set({
      ...(name === undefined ? {} : { name }),
      revision: sql`${staffPersons.revision} + 1`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(staffPersons.businessId, businessId),
        eq(staffPersons.id, personId),
      ),
    );
}

import type { DbTransaction } from "@mi-pasaporte/db";
import { memberships, sessions, staffPersons } from "@mi-pasaporte/db/schema";
import { and, eq } from "drizzle-orm";
import {
  assertDemotable,
  assertGrantable,
  assertNotSelf,
  parsePermissions,
} from "../staff-permissions";
import { assertTargetNotAdministrator } from "../staff-admin-target";
import { assertModulePermissionsGrantable } from "../staff-module-permissions";
import { StaffError } from "../staff-error";
import { generatePin, hashPin } from "../staff-pin";
import { createStaffAccess } from "./access-create";
import { touchStaffPerson } from "./identity";

/** Person is already locked. Access does not mutate salary or assignment history. */
export async function changePersonAccess(
  tx: DbTransaction,
  person: typeof staffPersons.$inferSelect,
  caller: { userId: string; role: string },
  enabled: boolean,
  rawPermissions: unknown,
) {
  const userId = person.membershipUserId;
  if (!enabled && !userId) return undefined;
  if (userId) assertNotSelf(caller.userId, userId);
  const [target] = userId
    ? await tx
        .select()
        .from(memberships)
        .where(
          and(
            eq(memberships.businessId, person.businessId),
            eq(memberships.userId, userId),
          ),
        )
        .for("update")
    : [];
  if (userId && (!target || target.role !== "staff"))
    throw new StaffError(
      409,
      "No puedes cambiar el acceso de la persona propietaria.",
      "target_is_owner",
    );
  if (target) assertTargetNotAdministrator(caller.role, target.permissions);
  if (!enabled) {
    await tx
      .update(memberships)
      .set({ status: "disabled" })
      .where(
        and(
          eq(memberships.businessId, person.businessId),
          eq(memberships.userId, userId!),
        ),
      );
    await tx.delete(sessions).where(eq(sessions.userId, userId!));
    if (target?.status !== "disabled")
      await touchStaffPerson(tx, person.businessId, person.id);
    return undefined;
  }
  const permissions = parsePermissions(rawPermissions);
  assertGrantable(caller.role, permissions);
  if (target) assertDemotable(caller.role, target.permissions);
  await assertModulePermissionsGrantable(
    person.businessId,
    permissions,
    target?.permissions,
  );
  let pin: string;
  if (!userId) {
    const created = await createStaffAccess(tx, person.businessId, {
      name: person.name,
      permissions,
    });
    pin = created.pin;
    await tx
      .update(staffPersons)
      .set({ membershipUserId: created.userId })
      .where(
        and(
          eq(staffPersons.businessId, person.businessId),
          eq(staffPersons.id, person.id),
        ),
      );
  } else {
    pin = generatePin();
    const pinHash = await hashPin(pin);
    await tx
      .update(memberships)
      .set({
        status: "active",
        permissions,
        pinHash,
        pinMustChange: true,
        pinUpdatedAt: new Date(),
      })
      .where(
        and(
          eq(memberships.businessId, person.businessId),
          eq(memberships.userId, userId),
        ),
      );
    await tx.delete(sessions).where(eq(sessions.userId, userId));
  }
  await touchStaffPerson(tx, person.businessId, person.id);
  return pin;
}

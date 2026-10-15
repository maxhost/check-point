import { withDbTransaction } from "@mi-pasaporte/db";
import {
  businesses,
  memberships,
  staffPersons,
  users,
} from "@mi-pasaporte/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { assertGrantable, parsePermissions } from "./staff-permissions";
import { assertModulePermissionsGrantable } from "./staff-module-permissions";
import { lockStaffBusiness, lockStaffPerson } from "./staff-location-timeline";
import { StaffError } from "./staff-error";
import { createStaffAccess } from "./staff-people/access-create";
import { changePersonAccess } from "./staff-people/access";
import { personDTO, personIds } from "./staff-people/dto";
import { assignStaffLocations } from "./staff-people/locations";
import {
  bodyObject,
  personName,
  assertRevision,
  staffMonth,
  monthInZone,
  locationIds,
} from "./staff-people/input";
import { freeHandle, isUniqueViolation } from "./staff-people/handles";
import { touchStaffPerson } from "./staff-people/identity";

type Business = { id: string; slug: string };
type Caller = { userId: string; role: string };
async function currentMonth(
  tx: Parameters<typeof lockStaffBusiness>[0],
  businessId: string,
) {
  const [business] = await tx
    .select({ timezone: businesses.timezone })
    .from(businesses)
    .where(eq(businesses.id, businessId));
  if (!business)
    throw new StaffError(
      503,
      "No pudimos consultar el equipo.",
      "staff_unavailable",
    );
  return monthInZone(business.timezone);
}
export async function listStaffPeople(
  business: Business,
  rawMonth?: string | null,
) {
  return withDbTransaction(async (tx) => {
    await tx.execute(
      sql`set transaction isolation level repeatable read read only`,
    );
    const month =
      rawMonth === undefined || rawMonth === null
        ? await currentMonth(tx, business.id)
        : staffMonth(rawMonth);
    const people = await personIds(tx, business.id);
    return Promise.all(people.map((p) => personDTO(tx, business, p.id, month)));
  });
}
export async function createStaffPerson(
  business: Business,
  caller: Caller,
  value: unknown,
) {
  const body = bodyObject(value),
    access = bodyObject(body.access);
  const name = personName(body.name),
    ids = locationIds(body.locationIds),
    fromMonth = staffMonth(body.fromMonth);
  if (typeof access.enabled !== "boolean")
    throw new StaffError(
      400,
      "Elige si la persona tendrá acceso.",
      "invalid_body",
    );
  const permissions = access.enabled
    ? parsePermissions(access.permissions)
    : [];
  if (access.enabled) {
    assertGrantable(caller.role, permissions);
    await assertModulePermissionsGrantable(business.id, permissions);
  }
  try {
    return await withDbTransaction(async (tx) => {
      await lockStaffBusiness(tx, business.id);
      const created = access.enabled
        ? await createStaffAccess(tx, business.id, { name, permissions })
        : null;
      const [person] = await tx
        .insert(staffPersons)
        .values({
          businessId: business.id,
          name,
          membershipUserId: created?.userId ?? null,
        })
        .returning();
      await assignStaffLocations(tx, business.id, person.id, fromMonth, ids);
      return {
        person: await personDTO(tx, business, person.id, fromMonth),
        ...(created ? { pin: created.pin } : {}),
      };
    });
  } catch (error) {
    if (isUniqueViolation(error))
      throw new StaffError(
        409,
        "Ese identificador ya está en uso.",
        "handle_taken",
      );
    throw error;
  }
}
export async function renameStaffPerson(
  business: Business,
  personId: string,
  value: unknown,
) {
  const body = bodyObject(value),
    name = personName(body.name);
  if ("permissions" in body || "access" in body)
    throw new StaffError(
      400,
      "El acceso se edita por separado.",
      "permissions_not_here",
    );
  return withDbTransaction(async (tx) => {
    const person = await lockStaffPerson(tx, business.id, personId);
    assertRevision(person.revision, body.expectedRevision);
    if (person.name !== name) {
      if (person.membershipUserId) {
        const handle = await freeHandle(
          business.id,
          name,
          person.membershipUserId,
          tx,
        );
        await tx
          .update(memberships)
          .set({ handle })
          .where(
            and(
              eq(memberships.businessId, business.id),
              eq(memberships.userId, person.membershipUserId),
              eq(memberships.role, "staff"),
            ),
          );
        await tx
          .update(users)
          .set({ name })
          .where(eq(users.id, person.membershipUserId));
      }
      await touchStaffPerson(tx, business.id, person.id, name);
    }
    return personDTO(
      tx,
      business,
      person.id,
      await currentMonth(tx, business.id),
    );
  });
}
export async function setStaffPersonAccess(
  business: Business,
  caller: Caller,
  personId: string,
  value: unknown,
) {
  const body = bodyObject(value);
  if (typeof body.enabled !== "boolean")
    throw new StaffError(400, "El estado no es válido.", "invalid_body");
  return withDbTransaction(async (tx) => {
    const person = await lockStaffPerson(tx, business.id, personId);
    assertRevision(person.revision, body.expectedRevision);
    const pin = await changePersonAccess(
      tx,
      person,
      caller,
      body.enabled as boolean,
      body.permissions,
    );
    return {
      person: await personDTO(
        tx,
        business,
        person.id,
        await currentMonth(tx, business.id),
      ),
      ...(pin === undefined ? {} : { pin }),
    };
  });
}
export async function setStaffPersonLocations(
  business: Business,
  personId: string,
  value: unknown,
) {
  const body = bodyObject(value),
    ids = locationIds(body.locationIds),
    fromMonth = staffMonth(body.fromMonth);
  return withDbTransaction(async (tx) => {
    const person = await lockStaffPerson(tx, business.id, personId);
    assertRevision(person.revision, body.expectedRevision);
    await assignStaffLocations(tx, business.id, person.id, fromMonth, ids);
    return personDTO(tx, business, person.id, fromMonth);
  });
}

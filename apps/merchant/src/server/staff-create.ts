import { withDbTransaction } from "@mi-pasaporte/db";
import { staffPersons } from "@mi-pasaporte/db/schema";
import {
  type CreateStaffInput,
  type CreatedStaff,
  StaffError,
  toStaffDTO,
} from "./staff";
import { assertGrantable, parsePermissions } from "./staff-permissions";
import { assertModulePermissionsGrantable } from "./staff-module-permissions";
import { lockStaffBusiness } from "./staff-location-timeline";
import { createStaffAccess } from "./staff-people/access-create";
import { isUniqueViolation } from "./staff-people/handles";
export { freeHandle, isUniqueViolation } from "./staff-people/handles";

export function parseCreateStaffInput(value: unknown): CreateStaffInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new StaffError(400, "El cuerpo no es válido.", "invalid_body");
  }
  const body = value as Record<string, unknown>;
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name)
    throw new StaffError(400, "El nombre es obligatorio.", "name_required");
  if (name.length > 80)
    throw new StaffError(400, "El nombre es muy largo.", "name_too_long");
  return { name, permissions: parsePermissions(body.permissions) };
}

/** Legacy contract: access + person are atomic; no locations are inferred. */
export async function createStaff(
  business: { id: string; slug: string },
  value: unknown,
  callerRole: string,
): Promise<CreatedStaff> {
  const input = parseCreateStaffInput(value);
  assertGrantable(callerRole, input.permissions);
  await assertModulePermissionsGrantable(business.id, input.permissions);
  try {
    return await withDbTransaction(async (tx) => {
      await lockStaffBusiness(tx, business.id);
      const created = await createStaffAccess(tx, business.id, input);
      await tx.insert(staffPersons).values({
        businessId: business.id,
        name: input.name,
        membershipUserId: created.userId,
      });
      return {
        staff: toStaffDTO({
          userId: created.userId,
          name: input.name,
          handle: created.handle,
          slug: business.slug,
          ...created.membership,
        }),
        pin: created.pin,
      };
    });
  } catch (error) {
    if (error instanceof StaffError) throw error;
    if (isUniqueViolation(error))
      throw new StaffError(
        409,
        "Ese identificador ya está en uso.",
        "handle_taken",
      );
    throw new StaffError(
      503,
      "No pudimos crear al integrante. Intenta de nuevo.",
      "staff_create_failed",
    );
  }
}

import { randomUUID } from "node:crypto";
import type { DbTransaction } from "@mi-pasaporte/db";
import { memberships, users } from "@mi-pasaporte/db/schema";
import { UNDELIVERABLE_EMAIL_DOMAIN } from "../auth-start";
import { generatePin, hashPin } from "../staff-pin";
import { freeHandle } from "./handles";

/** Caller validates permissions and owns identity + access transaction. */
export async function createStaffAccess(
  tx: DbTransaction,
  businessId: string,
  input: { name: string; permissions: string[] },
) {
  const handle = await freeHandle(businessId, input.name, undefined, tx);
  const pin = generatePin(),
    pinHash = await hashPin(pin),
    userId = randomUUID(),
    now = new Date();
  await tx.insert(users).values({
    id: userId,
    name: input.name,
    email: `staff-${userId}@${UNDELIVERABLE_EMAIL_DOMAIN}`,
    emailVerified: false,
    createdAt: now,
    updatedAt: now,
  });
  const [membership] = await tx
    .insert(memberships)
    .values({
      businessId,
      userId,
      role: "staff",
      status: "active",
      permissions: input.permissions,
      handle,
      pinHash,
      pinMustChange: true,
      pinUpdatedAt: now,
    })
    .returning({
      role: memberships.role,
      status: memberships.status,
      permissions: memberships.permissions,
      createdAt: memberships.createdAt,
    });
  return { userId, handle, pin, membership };
}

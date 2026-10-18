import type { DbTransaction } from "@mi-pasaporte/db";
import { businessModules } from "@mi-pasaporte/db/schema";
import type { ResourceMeasurementValidator } from "@mi-pasaporte/domain/resource-measurement";
import { and, eq } from "drizzle-orm";
import { SERVER_MODULES } from "../modules/server-registry";

/** Caller owns authorization, locks and transaction. Registry order is module id,
 * then declaration order within a module; database row order cannot affect errors. */
export const validateResourceMeasurementChange: ResourceMeasurementValidator<
  DbTransaction
> = async (change) => {
  const enabled = await change.tx
    .select({ moduleId: businessModules.moduleId })
    .from(businessModules)
    .where(
      and(
        eq(businessModules.businessId, change.businessId),
        eq(businessModules.enabled, true),
      ),
    );
  const active = new Set(enabled.map((row) => row.moduleId));
  for (const moduleId of Object.keys(SERVER_MODULES).sort()) {
    if (!active.has(moduleId)) continue;
    for (const provider of SERVER_MODULES[moduleId]
      .resourceMeasurementValidators ?? []) {
      if (provider.resourceType !== change.resourceType) continue;
      const error = await provider.validate(change);
      if (error) return error;
    }
  }
  return null;
};

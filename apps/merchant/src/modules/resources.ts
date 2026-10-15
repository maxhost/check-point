import type { DbTransaction } from "@mi-pasaporte/db";
import { SERVER_MODULES } from "./server-registry";
import type { ModuleResource } from "./route-table";
export type DirectoryResource = ModuleResource & { providerId: string };
/** Not an HTTP API: consumers must establish access and use their consistent transaction. */
export async function listModuleResources(
  tx: DbTransaction,
  businessId: string,
  resourceType: string,
): Promise<DirectoryResource[]> {
  const result: DirectoryResource[] = [];
  for (const [providerId, server] of Object.entries(SERVER_MODULES))
    for (const provider of server.resourceProviders ?? []) {
      if (provider.resourceType !== resourceType || !provider.list) continue;
      for (const resource of await provider.list(tx, businessId))
        result.push({ ...resource, providerId });
    }
  return result.sort(
    (a, b) =>
      a.providerId.localeCompare(b.providerId) ||
      a.resourceId.localeCompare(b.resourceId),
  );
}
export async function readModuleResources(
  tx: DbTransaction,
  businessId: string,
  resourceType: string,
  resourceIds: readonly string[],
): Promise<DirectoryResource[]> {
  if (!resourceIds.length) return [];
  const wanted = new Set(resourceIds),
    result: DirectoryResource[] = [];
  for (const [providerId, server] of Object.entries(SERVER_MODULES))
    for (const provider of server.resourceProviders ?? []) {
      if (provider.resourceType !== resourceType) continue;
      for (const resource of await provider.read(tx, businessId, [...wanted])) {
        if (!wanted.has(resource.resourceId))
          throw new Error("Resource provider returned an unrequested identity");
        result.push({ ...resource, providerId });
      }
    }
  return result;
}

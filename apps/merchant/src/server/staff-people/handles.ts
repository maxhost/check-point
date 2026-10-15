import type { DbTransaction } from "@mi-pasaporte/db";
import { getDb } from "@mi-pasaporte/db";
import { memberships } from "@mi-pasaporte/db/schema";
import { eq } from "drizzle-orm";
import { nextSuggestion, slugify } from "../slug";

export async function freeHandle(
  businessId: string,
  name: string,
  excludeUserId?: string,
  tx?: DbTransaction,
): Promise<string> {
  const rows = await (tx ?? getDb())
    .select({ handle: memberships.handle, userId: memberships.userId })
    .from(memberships)
    .where(eq(memberships.businessId, businessId));
  return nextSuggestion(
    slugify(name),
    rows
      .filter((row) => !excludeUserId || row.userId !== excludeUserId)
      .map((row) => row.handle)
      .filter((handle): handle is string => !!handle),
  );
}
export function isUniqueViolation(error: unknown): boolean {
  let current = error;
  for (let depth = 0; current && depth < 5; depth += 1) {
    if ((current as { code?: string }).code === "23505") return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

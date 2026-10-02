import { eq } from "drizzle-orm";
import { getDb } from "@mi-pasaporte/db";
import { consumerAccounts } from "@mi-pasaporte/db/schema";
import {
  type ConsumerAccountRow,
  type MembershipRow,
  generateOpaqueToken,
} from "@mi-pasaporte/domain/server/consumer/core";
import { enrollAccount } from "@mi-pasaporte/domain/server/consumer/enrollment";

/**
 * Spec 0119 — desde que la cuenta nace del proveedor (ADR 0111), el alta recibe una cuenta
 * EXISTENTE (`enrollAccount`). Las suites que sembraban clientes llamando al viejo
 * `enroll(programId, {nombre, telefono})` siembran ahora la cuenta aca —con telefono, como las
 * que nacen en el mostrador— y le dan el alta. Una cuenta con el mismo telefono se reusa: es la
 * clave con que estas suites la limpian y la vuelven a buscar.
 */
export type SeedAccountInput = {
  firstName: string;
  lastName: string;
  phoneE164: string;
  countryIso: string;
};

export async function seedAccount(
  input: SeedAccountInput,
): Promise<ConsumerAccountRow> {
  const db = getDb();
  const [existing] = await db
    .select()
    .from(consumerAccounts)
    .where(eq(consumerAccounts.phoneE164, input.phoneE164))
    .limit(1);
  if (existing) return existing;
  const [created] = await db
    .insert(consumerAccounts)
    .values({
      ...input,
      qrToken: generateOpaqueToken(),
      webViewToken: generateOpaqueToken(),
    })
    .returning();
  return created;
}

/** La cuenta sembrada (o reusada por telefono) + su alta en `programId`. */
export async function enrollSeeded(
  programId: string,
  input: SeedAccountInput,
  loc?: string | null,
): Promise<{ account: ConsumerAccountRow; membership: MembershipRow }> {
  const account = await seedAccount(input);
  const membership = await enrollAccount(programId, account.id, loc);
  return { account, membership };
}

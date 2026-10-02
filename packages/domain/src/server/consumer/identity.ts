import { and, eq, getTableColumns } from "drizzle-orm";
import { getDb, withDbTransaction } from "@mi-pasaporte/db";
import { consumerAccounts, consumerIdentities } from "@mi-pasaporte/db/schema";
import {
  type ConsumerAccountRow,
  generateOpaqueToken,
  pgErrorCode,
} from "./core";
import type { OAuthProvider } from "./oauth/state-cookie";

export type IdentityInput = {
  provider: OAuthProvider;
  subject: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
};

/** La cuenta de una identidad `(provider, subject)`, o `undefined`. */
async function accountByIdentity(
  provider: OAuthProvider,
  subject: string,
): Promise<ConsumerAccountRow | undefined> {
  const [row] = await getDb()
    .select(getTableColumns(consumerAccounts))
    .from(consumerIdentities)
    .innerJoin(
      consumerAccounts,
      eq(consumerAccounts.id, consumerIdentities.consumerId),
    )
    .where(
      and(
        eq(consumerIdentities.provider, provider),
        eq(consumerIdentities.subject, subject),
      ),
    )
    .limit(1);
  return row;
}

/**
 * La cuenta de quien vuelve del proveedor (spec 0119 / ADR 0111 §3 y §5).
 *
 * - **La unica clave es `(provider, subject)`.** NUNCA se busca por email: no hay union de
 *   cuentas (decision del owner), el email de Apple puede ser un reenvio, y unir por email le
 *   daria la cuenta de otro a quien controle una direccion igual en otro proveedor.
 * - **Una identidad existente devuelve su cuenta SIN ESCRIBIR NADA**: entrar es de solo-lectura
 *   sobre el perfil (el espiritu del ADR 0051). El nombre que manda Apple al volver se descarta.
 * - Si no existe: cuenta + identidad en UNA transaccion (sin telefono ni pais; nombres `""` si
 *   el proveedor no los dio). Una carrera que pierde contra otro alta de la misma identidad
 *   (`23505`) relee la cuenta ganadora.
 */
export async function findOrCreateAccountByIdentity(
  input: IdentityInput,
): Promise<ConsumerAccountRow> {
  const existing = await accountByIdentity(input.provider, input.subject);
  if (existing) return existing;
  try {
    return await withDbTransaction(async (tx) => {
      const [account] = await tx
        .insert(consumerAccounts)
        .values({
          phoneE164: null,
          countryIso: null,
          firstName: input.firstName ?? "",
          lastName: input.lastName ?? "",
          email: input.email,
          qrToken: generateOpaqueToken(),
          webViewToken: generateOpaqueToken(),
        })
        .returning();
      await tx.insert(consumerIdentities).values({
        consumerId: account.id,
        provider: input.provider,
        subject: input.subject,
        email: input.email,
      });
      return account;
    });
  } catch (error) {
    if (pgErrorCode(error) !== "23505") throw error;
    const winner = await accountByIdentity(input.provider, input.subject);
    if (!winner) throw error;
    return winner;
  }
}

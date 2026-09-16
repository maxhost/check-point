import { and, eq } from "drizzle-orm";
import { getDb } from "../db";
import { programMemberships } from "../schema";

/**
 * Spec 0065, fase D — EL OPT-OUT DE PROMOCIONES, escrito por el consumidor y por nadie más.
 *
 * `consumer.program_membership.marketing_opt_out_at` tiene UN solo escritor en todo el
 * código: esta función. La audiencia del tick lo LEE (`marketing/audience.ts:109`, motivo
 * `opt_out`) y el paso de cancelación del tick también, pero ninguna ruta del backoffice ni
 * el motor pueden apagarle las promociones a alguien: el consentimiento es del consumidor
 * (ADR 0033 §2, escanear = alta + consentimiento; por eso el default es ENCENDIDO y lo que
 * se persiste es el APAGADO).
 *
 * Un barrido estático sobre `marketingOptOutAt` —la ortografía que usa el código, no la
 * snake del schema— pinnea esa exclusividad; vive en `consumer-opt-out-writer.test.ts`.
 *
 * EL `where` LLEVA SIEMPRE `consumerId`, y esa es la autorización entera: no hay un chequeo
 * de pertenencia separado que pueda quedar desincronizado del `UPDATE`. Si el par
 * (consumidor, programa) no existe, no se escribe nada y el llamador contesta 404 — nunca
 * 403, que le confirmaría a un curioso que ese `programId` existe.
 */
export async function setMarketingOptOut(args: {
  consumerId: string;
  programId: string;
  optOut: boolean;
  now?: Date;
}): Promise<{ updated: boolean; marketingOptOut: boolean }> {
  const rows = await getDb()
    .update(programMemberships)
    .set({
      marketingOptOutAt: args.optOut ? (args.now ?? new Date()) : null,
    })
    .where(
      and(
        eq(programMemberships.consumerId, args.consumerId),
        eq(programMemberships.programId, args.programId),
      ),
    )
    .returning({ marketingOptOutAt: programMemberships.marketingOptOutAt });
  const row = rows[0];
  return {
    updated: row !== undefined,
    marketingOptOut: row?.marketingOptOutAt != null,
  };
}

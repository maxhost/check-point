import { sql } from "drizzle-orm";
import { campaigns } from "@mi-pasaporte/db/schema";

/** Same helper as `locations/shared.ts`: a body that is not an object is an empty one,
 * so every field reports its own `validation` error instead of the whole request
 * failing with one opaque message. */
export function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/**
 * «COMPRO EN SU VENTANA», UNA SOLA VEZ PARA TODO EL DOMINIO.
 *
 * Vive acá y no en `results-store.ts` porque tiene CUATRO consumidores en tres archivos —
 * los totales y el SQL crudo por puerta (`results-store.ts`), el listado del backoffice
 * (`campaign-list.ts`) y el ranking por mérito del tick (`merit.ts`)— y el docblock que
 * declaraba «ONE list feeding BOTH shapes» describía sólo a los dos primeros: los otros
 * dos escribían el literal inline. Lo cazó la revisión independiente de la fase B, y
 * verificarlo encontró la cuarta copia que el revisor no había visto.
 *
 * Que estén sincronizadas es load-bearing y no cosmética: el tick ORDENA la cola con esta
 * definición, así que una pantalla que contara sólo `'purchase'` contradiría el ranking de
 * la campaña que describe. El primer bug de esta familia ya se pagó en B2: 1 de 4 arriba y
 * 2 por la puerta, sin que nada fallara.
 *
 * La mitad de SQL crudo no puede reusar el fragmento del builder (drizzle renderiza la
 * columna sin calificar y ataría a la tabla equivocada — `CLAUDE.md`), así que lo que se
 * comparte son los VALORES.
 */
export const BOUGHT_OUTCOMES = ["purchase", "coupon_redeemed"] as const;

/** La lista lista para interpolar en un `in (…)`, cruda o del builder. */
export const boughtList = sql.join(
  BOUGHT_OUTCOMES.map((outcome) => sql`${outcome}`),
  sql`, `,
);

/** Spec 0103: the two channel booleans of `core.campaign` as the DTO's `channels`, always
 * in this order. The composer's campaigns come out `["proximity"]`. */
export function channelsOf(row: {
  channelProximity: boolean;
  channelPush: boolean;
}): ("proximity" | "push")[] {
  return [
    ...(row.channelProximity ? (["proximity"] as const) : []),
    ...(row.channelPush ? (["push"] as const) : []),
  ];
}

/** Spec 0107: «Bienvenida»'s parameters in the DTO; `null` in every other campaign. */
export type CampaignWelcome = {
  validDays: number;
  reminderDays: number;
  monthlyCap: number;
  redeemFrom: "next_day" | "same_visit";
};

/** The four columns as ONE nested select (`welcome` of the campaign reads). */
export const welcomeSelect = {
  validDays: campaigns.welcomeValidDays,
  reminderDays: campaigns.welcomeReminderDays,
  monthlyCap: campaigns.welcomeMonthlyCap,
  redeemFrom: campaigns.welcomeRedeemFrom,
};

/** `null` unless the four are there (`core_campaign_welcome_shape_check`: all or none). */
export function welcomeOf(row: {
  validDays: number | null;
  reminderDays: number | null;
  monthlyCap: number | null;
  redeemFrom: string | null;
}): CampaignWelcome | null {
  const { validDays, reminderDays, monthlyCap, redeemFrom } = row;
  if (validDays === null || reminderDays === null || monthlyCap === null)
    return null;
  return {
    validDays,
    reminderDays,
    monthlyCap,
    redeemFrom: redeemFrom as CampaignWelcome["redeemFrom"],
  };
}

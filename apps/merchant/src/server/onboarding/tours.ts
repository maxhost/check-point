import { sql } from "drizzle-orm";
import { getDb } from "../db";
import { businessOnboardingTours } from "../schema";

/**
 * Spec 0084 / ADR 0078 §2-3 — EL CATALOGO DE TOURS Y LA ESCRITURA DE SU PROGRESO.
 *
 * **Por que los cuatro ids viven ACA y no en la spec 0085** (la que lleva el checklist de uno
 * a cinco items): la escritura es fail-closed y tiene que rechazar un `tourId` desconocido con
 * `404`; para rechazarlo necesita la lista. Que la 0085 derive sus items de esta constante —y
 * no al reves— es lo que evita dos listas que se desincronizan.
 *
 * **Que los cuatro existan no implica que sus pantallas existan** (ADR 0078 §6). **`staff` ya
 * la tiene** desde la spec 0088 (`/backoffice/staff`, con su tour de onboarding y sus cuatro
 * ayudas); `catalog`, `program` y `brand` todavia no. No hay que esperarlas: un tour sin
 * pantalla simplemente nunca recibe un `POST`, su `done` queda en `false` y no traba a nadie
 * porque ningun tour es `required` (spec 0085: el unico obligatorio es `verify-email`).
 *
 * **Esta pieza es agnostica de la libreria de tours.** El ADR 0078 §5 eligio `driver.js`, que
 * vive del lado de la UI y **no se instala en esta spec**: aca se guarda ESTADO, no pasos.
 */
export const ONBOARDING_TOURS = [
  "staff",
  "catalog",
  "program",
  "brand",
] as const;
export type OnboardingTourId = (typeof ONBOARDING_TOURS)[number];

/** Los dos estados que se PERSISTEN distintos aunque los dos proyecten `done: true` por HTTP
 * (ADR 0078 §2). Con un booleano, «cuantos merchants saltearon todo» seria una pregunta que ya
 * no se puede hacer, y el owner pidio explicitamente conservar ese dato. */
export const TOUR_STATUSES = ["completed", "skipped"] as const;
export type TourStatus = (typeof TOUR_STATUSES)[number];

export const isOnboardingTourId = (value: unknown): value is OnboardingTourId =>
  typeof value === "string" &&
  (ONBOARDING_TOURS as readonly string[]).includes(value);

export const isTourStatus = (value: unknown): value is TourStatus =>
  typeof value === "string" &&
  (TOUR_STATUSES as readonly string[]).includes(value);

/**
 * El upsert del progreso. Idempotente por la PK `(business_id, tour_id)`.
 *
 * ### EL INVARIANTE: `completed` NUNCA se degrada a `skipped`
 *
 * Es lo unico que sostiene el `setWhere`. Un merchant que termina el tour y despues lo reabre
 * y lo cierra no debe perder su `completed`: los dos estados proyectan `done: true`, asi que
 * el efecto visible por HTTP es **nulo**, pero el dato que el owner pidio conservar —cuantos
 * saltearon— se destruiria en silencio. Sin ese `where`, el `do update` pisa siempre.
 *
 * El upgrade en el otro sentido (`skipped` → `completed`) SI pisa, que es lo que se quiere.
 *
 * ### El `on conflict` apunta a la PK, y la PK NO es un indice parcial
 *
 * Por eso **no lleva `where` en el *conflict target***. Es el gotcha de los unicos PARCIALES
 * de este repo (`core_campaign_turn_business_consumer_live_unique`): no aplica aca, y no hay
 * que "arreglarlo".
 *
 * ### `businessId` lo pone el llamador desde el GUARD
 *
 * Nunca del cuerpo ni de la query (ADR 0070 §15.3). Si viajara, seria el parametro con el que
 * un owner escribiria el progreso de otro negocio.
 */
export async function recordTourProgress(
  businessId: string,
  tourId: OnboardingTourId,
  status: TourStatus,
): Promise<void> {
  await getDb()
    .insert(businessOnboardingTours)
    .values({ businessId, tourId, status })
    .onConflictDoUpdate({
      target: [
        businessOnboardingTours.businessId,
        businessOnboardingTours.tourId,
      ],
      set: { status, updatedAt: sql`now()` },
      setWhere: sql`${businessOnboardingTours.status} <> 'completed'`,
    });
}

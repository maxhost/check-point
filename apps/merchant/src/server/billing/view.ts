import type { SubscriptionRow } from "./derive";
// Del dominio y no de `./plan-change`: ese módulo importa `planLabel` de acá (spec 0189 §D9,
// los mensajes de bloqueo nombran el plan con esta allow-list) y el import inverso cerraría
// un ciclo.
import { DEAD_STRIPE_STATUS } from "@mi-pasaporte/domain/server/entitlements/live-subscription";

/**
 * Spec 0063, D7 — CONTRATO. Lo dejó el orquestador antes de despachar; el implementador
 * añade `toSubscriptionView` y la allow-list de presentación en este mismo archivo.
 */

/**
 * LA ÚNICA forma de una suscripción que llega al navegador. Es una allow-list POSITIVA, no
 * un filtro: estas seis claves y ninguna más (spec 0189 §D10 sumó `trialEndsAt`). Nunca `stripeCustomerId`,
 * `stripeSubscriptionId` ni `downgradeRequestedAt`.
 *
 * Mismo patrón que `toClientProgram` (loyalty) y `brandResponse` (marca): un revisor
 * independiente ya cazó una fuga de claves internas de R2 en marca (spec 0025) y CLAUDE.md
 * lo tiene como regla.
 *
 * `pendingPlanAt` viaja como STRING ISO, no `Date` ([R2-M4]): el test de claves no ve la
 * diferencia — las claves son las mismas — y es la consola la que lo formatea. Un `Date`
 * cruzando el límite server→client de Next se serializa distinto según el camino.
 */
export type SubscriptionView = {
  plan: string;
  status: string;
  interval: string | null;
  pendingPlan: string | null;
  pendingPlanAt: string | null;
  /** Spec 0189 §D10: fin de la prueba, STRING ISO como `pendingPlanAt`. */
  trialEndsAt: string | null;
};

export type ToSubscriptionView = (row: SubscriptionRow) => SubscriptionView;

/**
 * NO se exporta acá ninguna constante con el conjunto de claves esperado. El unit
 * (`billing-view.test.ts`) escribe el conjunto A MANO: si aseverara contra una constante
 * de este mismo módulo, agregar una clave a las dos cosas dejaría el test verde y el
 * oráculo sería circular.
 *
 * Y el test de claves NO alcanza solo: pinnea la DECISIÓN («el DTO dice X»), no el
 * COMPORTAMIENTO («el usuario no recibe X»). El cableado —que la página use el DTO y no la
 * fila— queda sin oráculo, que es exactamente el hueco que `choosePushPromptView` dejó en
 * la tarea 38 y que costó tres guards rotos. Por eso el plan de pruebas exige ADEMÁS
 * renderizar el HTML con `renderToStaticMarkup` bajo el `environment: "node"` del vitest de
 * merchant (precedente en el repo:
 * `locations-backoffice-pages.neon.integration.test.ts:113`) y aseverar que los tres campos
 * sensibles no aparecen en el markup.
 */

/**
 * Lo que la UI necesita ADEMÁS del DTO llega como props SEPARADAS del server component, no
 * metiendo claves en `SubscriptionView`. Meterlas en el DTO haría que el test de claves
 * exactas tuviera que aceptarlas y el guard se aflojaría a cada necesidad de la UI.
 *
 * `canCancel` sale de `decidePlanChange` con `intent: "downgrade"` — NO es una segunda
 * regla de conteo que pueda divergir del servidor. Ojo: `canCancel === false` NO
 * deshabilita el botón (ADR 0058 §8, respuesta literal del owner: «el usuario no sabría que
 * debe hacer»). El botón se aprieta igual y abre el modal que dice cuántos locales archivar
 * y con qué link; lo que no está disponible es «Confirmar». El bloqueo duro es el 409 del
 * servidor, no la UI.
 */
export type SubscriptionSectionProps = {
  subscription: SubscriptionView;
  activeLocations: number;
  canCancel: boolean;
};

/**
 * ALLOW-LIST DE PRESENTACIÓN, compartida por la home (`app/backoffice/page.tsx`) y la
 * sección. Mismo patrón que la TABLA DE CÓDIGOS DE REBOTE del contrato
 * (`docs/specs/0067-contratos-de-api.md`, ADR 0055): un status desconocido NUNCA llega
 * crudo al DOM. El ejemplo canónico vivía en la pantalla de acceso vieja, que la spec
 * 0067 §7 borró; la allow-list se mudó al contrato.
 *
 * Vive acá y no en la página porque la home tenía su propio ternario de plan y status, y dos
 * copias de esta traducción es cómo las dos superficies divergen (un plan sin suscripción
 * con `status='canceled'` decía «confirmando pago» PARA SIEMPRE).
 *
 * Lo que el unit asevera: `none` → «Sin plan»; `canceled` → NO «confirmando pago»; status
 * desconocido → texto genérico.
 */
export type PlanLabel = (plan: string) => string;
export type StatusLabel = (status: string) => string;

export const toSubscriptionView: ToSubscriptionView = (row) => ({
  plan: row.plan,
  status: row.status,
  interval: row.interval,
  pendingPlan: row.pendingPlan,
  // String ISO, no `Date` ([R2-M4]): un `Date` cruzando el límite server→client de Next se
  // serializa distinto según el camino, y el test de claves no ve la diferencia.
  pendingPlanAt:
    row.pendingPlanAt === null ? null : row.pendingPlanAt.toISOString(),
  trialEndsAt: row.trialEndsAt === null ? null : row.trialEndsAt.toISOString(),
});

/** Traducción del PLAN (spec 0189 §D9). **ETIQUETAS PROVISORIAS**: cuando GPT proponga los
 * nombres comerciales se cambian ESTAS líneas, y con ellas los mensajes de bloqueo de
 * `plan-change.ts`, que las leen de acá. Un plan que no conocemos no se muestra crudo. */
export const planLabel: PlanLabel = (plan) => {
  switch (plan) {
    case "trial":
      return "Prueba gratis";
    case "base":
      return "Base";
    case "plus":
      return "Plus";
    case "none":
      return "Sin plan";
    default:
      return "Plan no disponible";
  }
};

/** Traducción del STATUS crudo de Stripe (D5.e lo guarda sin colapsar). Mismo patrón que
 * la tabla de códigos de rebote del contrato (`docs/specs/0067-contratos-de-api.md`, ADR
 * 0055): un status desconocido nunca llega crudo al DOM.
 * Ojo con el caso que motivó la allow-list: `canceled` no puede decir «confirmando pago». */
export const statusLabel: StatusLabel = (status) => {
  switch (status) {
    case "active":
      return "activo";
    case "trialing":
      return "en prueba";
    case "incomplete":
      return "confirmando pago";
    case "incomplete_expired":
      return "sin confirmar el pago";
    case "past_due":
      return "con un cobro pendiente";
    case "unpaid":
      return "con un cobro pendiente";
    case "paused":
      return "en pausa";
    case "canceled":
      return "cancelada";
    default:
      return "en revisión";
  }
};

/**
 * Spec 0064, F2-1 — EL PLAN CON SU INTERVALO. El owner lo pidió después de usar la pantalla:
 * «Plan Plus · activo» no dice si lo que se le cobra es mensual o anual, y ése es el dato con
 * el que decide si le conviene pasar a anual o bajar.
 *
 * Se compone sobre `planLabel` en vez de repetir la traducción: un segundo `switch` es
 * exactamente cómo las dos superficies divergen.
 *
 * SÓLO LOS PLANES PAGOS (`base`, `plus`) LLEVAN INTERVALO. `trial` y `none` no tienen
 * suscripción, así que «Prueba mensual» sería una invención. Un plan pago con `interval` NULL
 * se queda pelado: NO se adivina «mensual», porque una etiqueta inventada sobre la plata del
 * merchant es peor que una etiqueta incompleta.
 */
export function planWithInterval(
  plan: string,
  interval: string | null,
): string {
  const label = planLabel(plan);
  if (plan !== "base" && plan !== "plus") return label;
  if (interval === "month") return `${label} mensual`;
  if (interval === "year") return `${label} anual`;
  return label;
}

/**
 * LAS OFERTAS DE LA SECCIÓN DE SUSCRIPCIÓN, COMO FUNCIÓN PURA — no como `if`s repartidos por
 * el JSX (la lección de `choosePushPromptView`, tarea 38). La consume la pantalla actual
 * (`backoffice/subscription/page.tsx`, zona GPT) hasta que llegue la del contrato de la spec
 * 0189 §D10; se reescribió sobre los planes nuevos para que esa pantalla no ofrezca rutas
 * borradas ni un plan gratis que ya no existe.
 *
 * Lo que esta función NO prueba: que la página la llame y que la consola respete lo que
 * devuelve, ni que el servidor acepte lo que se ofrece — la autoridad es `decidePlanChange`
 * (ADR 0058 §8: el 409 manda).
 */
export type SubscriptionOffers = {
  /** Ya traducido por la allow-list, y CON EL INTERVALO si el plan es pago. */
  plan: string;
  status: string;
  /** `past_due`/`unpaid`: se avisa el cobro y NO se ofrece plan ni intervalo. */
  paymentPending: boolean;
  /** Cancelación programada (spec 0189: corta al fin del periodo); «sin fecha» es válido. */
  pendingDowngrade: "with_date" | "without_date" | null;
  /** `plan='none'`: el negocio no tiene plan y tiene que elegir uno. */
  noPlan: boolean;
  /** La etiqueta del botón de Checkout, o `null` si no se ofrece. */
  upgrade: string | null;
  /** El botón de cancelar la suscripción, o `null`. NUNCA se deshabilita (ADR 0058 §8). */
  downgrade: { label: string; endpoint: string } | null;
  /** Un solo sentido: mensual → anual. El inverso es la tarea 55. */
  intervalUpgrade: boolean;
};

/** Los dos status que avisan cobro pendiente. Se declaran acá y no se derivan de
 * `statusLabel` —que los colapsa al mismo texto— porque son dos hechos distintos. */
const PAYMENT_PENDING_STATUS = new Set(["past_due", "unpaid"]);

const CHOOSE_PLAN = "Elegir un plan";

/**
 * GUARDAS EN ORDEN, PRIMER MATCH GANA (cada fila tiene su caso en `billing-offers.test.ts`):
 *
 * 1. cobro pendiente (`past_due`/`unpaid`) → se avisa y no se ofrece nada más.
 * 2. cancelación programada → se INFORMA (con fecha o al fin del periodo) y nada más.
 * 3. `plan='none'` → «Elegir un plan» (Checkout).
 * 4. plan pago (`base`/`plus`) con un status que no es de los MUERTOS → cancelar
 *    (`/api/billing/cancel`, al fin del periodo) y «Pasar a anual» si el intervalo no es ya
 *    anual. Un plan pago solo lo escribe el webhook, que escribe el id en el mismo `SET`: el
 *    DTO no lleva el id (no cruza al navegador) y el status alcanza.
 * 5. resto (`trial`, un plan pago con la suscripción muerta, un plan desconocido) → «Elegir un
 *    plan». La autoridad es el servidor: su guarda `subscription_live` es la que rechazaría.
 *
 * El criterio de «hay cancelación programada» es el de `decidePlanChange` [R1-N8]: un string
 * vacío no lo es.
 */
export function subscriptionOffers(view: SubscriptionView): SubscriptionOffers {
  const base: SubscriptionOffers = {
    plan: planWithInterval(view.plan, view.interval),
    status: statusLabel(view.status),
    paymentPending: false,
    pendingDowngrade: null,
    noPlan: false,
    upgrade: null,
    downgrade: null,
    intervalUpgrade: false,
  };
  const scheduled =
    typeof view.pendingPlan === "string" && view.pendingPlan !== "";
  if (PAYMENT_PENDING_STATUS.has(view.status)) {
    return { ...base, paymentPending: true };
  }
  if (scheduled) {
    return {
      ...base,
      pendingDowngrade:
        view.pendingPlanAt === null ? "without_date" : "with_date",
    };
  }
  if (view.plan === "none") {
    return { ...base, noPlan: true, upgrade: CHOOSE_PLAN };
  }
  const paid = view.plan === "base" || view.plan === "plus";
  if (paid && !DEAD_STRIPE_STATUS.has(view.status)) {
    return {
      ...base,
      downgrade: {
        label: "Cancelar suscripción",
        endpoint: "/api/billing/cancel",
      },
      intervalUpgrade: view.interval !== "year",
    };
  }
  return { ...base, upgrade: CHOOSE_PLAN };
}

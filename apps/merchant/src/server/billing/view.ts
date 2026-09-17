import type { SubscriptionRow } from "./derive";
import { DEAD_STRIPE_STATUS } from "./plan-change";

/**
 * Spec 0063, D7 — CONTRATO. Lo dejó el orquestador antes de despachar; el implementador
 * añade `toSubscriptionView` y la allow-list de presentación en este mismo archivo.
 */

/**
 * LA ÚNICA forma de una suscripción que llega al navegador. Es una allow-list POSITIVA, no
 * un filtro: estas cinco claves y ninguna más. Nunca `stripeCustomerId`,
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
 * Vive acá y no en la página porque hoy la home hace
 * `Plan {plan === "plus" ? "Plus" : "Free"} · {status === "active" ? "activo" :
 * "confirmando pago"}` (`backoffice/page.tsx:62-63`), o sea que con esta spec `none` se
 * mostraría como «PLAN FREE» —justo lo que `none` existe para no hacer (ADR 0058 §12)— y un
 * `free` con `status='canceled'` diría «confirmando pago» PARA SIEMPRE. Dos copias de esta
 * traducción es cómo las dos superficies divergen.
 *
 * Lo que el DoD asevera: `none` → «Sin plan»; `free` + `canceled` → NO «confirmando pago»;
 * status desconocido → texto genérico.
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
});

/** Traducción del PLAN. `none` NO dice «Free»: es justo lo que el estado existe para no
 * hacer (ADR 0058 §12). Un plan que no conocemos tampoco se muestra crudo. */
export const planLabel: PlanLabel = (plan) => {
  switch (plan) {
    case "free":
      return "Free";
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
 * Se compone sobre `planLabel` en vez de repetir la traducción: un segundo `switch` con
 * «Plus»/«Free»/«Sin plan» es exactamente cómo las dos superficies divergen (el motivo por el
 * que `planLabel` existe y vive acá y no en la página).
 *
 * SÓLO `plus` LLEVA INTERVALO. `free` y `none` no tienen suscripción, así que «Free mensual»
 * sería una invención. Y un `plus` con `interval` NULL —el negocio A1 de prod, que existe— se
 * queda en «Plus» pelado: NO se adivina «mensual» por ser el caso más común, porque una
 * etiqueta inventada sobre la plata del merchant es peor que una etiqueta incompleta.
 */
export function planWithInterval(
  plan: string,
  interval: string | null,
): string {
  const label = planLabel(plan);
  if (plan !== "plus") return label;
  if (interval === "month") return `${label} mensual`;
  if (interval === "year") return `${label} anual`;
  return label;
}

/**
 * LA TABLA DE 12 FILAS DE D7, COMO FUNCIÓN PURA — no como `if`s repartidos por el JSX.
 *
 * Es la lección de `choosePushPromptView` (tarea 38): tres guards sintácticos escritos por
 * tres revisores fueron evadidos con los 5 gates en verde, y lo que funcionó fue extraer la
 * DECISIÓN a una función pura con una tabla de casos como oráculo.
 *
 * PERO ESO NO CIERRA LA PROPIEDAD, Y ACÁ SE DICE QUÉ QUEDA AFUERA (misma tarea 38: extraer
 * convierte «el usuario ve X» en «la decisión dice X» y deja el CABLEADO sin oráculo — un
 * revisor reintrodujo el bug exacto en el llamador, con los 5 gates verdes). Lo que esta
 * función NO prueba:
 *  - que la página la llame y que la consola respete lo que devuelve. Eso lo pinnea el
 *    RENDER del HTML (`billing-pages.neon.integration.test.ts`), no este módulo.
 *  - que el servidor acepte lo que se ofrece. La autoridad es `decidePlanChange`; acá se
 *    decide sólo qué se MUESTRA. Que un botón exista no es una promesa: el 409 manda
 *    (ADR 0058 §8).
 *
 * `activeLocations` y `canCancel` NO entran: no cambian QUÉ se ofrece, sólo qué dice el
 * modal. Meterlos acá haría que la tabla tuviera que multiplicarse por el conteo de locales
 * sin que ninguna fila cambiara.
 */
export type SubscriptionOffers = {
  /** Ya traducido por la allow-list, y CON EL INTERVALO si el plan es `plus` (spec 0064,
   * F2-1: la sección decía «Plan activo» a secas y el owner no podía saber si pagaba mensual
   * o anual). Nunca el string crudo de Stripe. */
  plan: string;
  status: string;
  /** `past_due`/`unpaid`: se avisa el cobro y NO se ofrece plan ni intervalo (DoD). */
  paymentPending: boolean;
  /** Los DOS estados de baja programada de D7; «sin fecha» es válido y está GARANTIZADO
   * entre el 200 de `cancel` y el paso 4 de D6. */
  pendingDowngrade: "with_date" | "without_date" | null;
  /** El estado `none` de D10: su texto, y sus DOS salidas (`upgrade` + `downgrade`). */
  noPlan: boolean;
  /** La etiqueta del botón de Checkout, o `null` si no se ofrece. */
  upgrade: string | null;
  /** El botón de bajar a Free, con la ruta que le corresponde al estado. NUNCA se
   * deshabilita (ADR 0058 §8): `canCancel` decide el contenido del MODAL, no si el botón
   * existe. */
  downgrade: { label: string; endpoint: string } | null;
  /** D9, un solo sentido: mensual → anual. El inverso es la tarea 55. */
  intervalUpgrade: boolean;
};

/** Los dos status del DoD que avisan cobro pendiente. Se declaran acá y no se derivan de
 * `statusLabel` —que los colapsa al mismo texto— porque son dos hechos distintos: uno es
 * cómo se LEE el status, el otro es qué se OFRECE. */
const PAYMENT_PENDING_STATUS = new Set(["past_due", "unpaid"]);

/**
 * GUARDAS EN ORDEN, PRIMER MATCH GANA. ES NORMATIVO, y cada fila tiene su caso en
 * `billing-offers.test.ts` — 15 filas de `it.each` más las dos de PRECEDENCIA (el orden
 * declarado no es el intuitivo) y la anti-degeneración de la salida 2 de D10. El corte a un
 * sibling es porque con el bloque adentro `billing-view.test.ts` daba 370 líneas contra el
 * límite de 300, medido al hook:
 *
 * 1. cobro pendiente (`past_due`/`unpaid`) → se avisa y no se ofrece cambio de plan ni de
 *    intervalo.
 * 2. baja programada → se INFORMA (con fecha o al fin del periodo) y nada más. Desde la spec
 *    0064 este estado ya NO lo crea nuestro flujo —la baja es inmediata (ADR 0063)— y sólo
 *    puede llegar del botón de cancelar del dashboard de Stripe, vía webhook. Por eso no hay
 *    nada que ofrecer: reanudar no existe (decisión n.º 1 de la spec 0064: se registra el
 *    hecho y se muestra como información), y ofrecer un upgrade acá es el 409
 *    `subscription_live`.
 * 3. `plan='none'` (D10) → las DOS salidas: «Volver a Plus» (Checkout) y «Ajustarme y bajar
 *    a Free» (`settle-free`). Sin las dos, el estado es un callejón.
 * 4. `plan='plus'` → bajar a Free por `cancel`, y «Pasar a anual» sólo si el intervalo no es
 *    ya anual Y el status no es de los MUERTOS. Ojo: con el status muerto el botón de bajar
 *    SIGUE ahí, y es load-bearing — es la salida 2 de D10 sobre «plus con la suscripción
 *    muerta», el estado del que `already_on_plan` sería un callejón.
 * 5. resto (`free` y cualquier plan desconocido) → sólo «Mejorar a Plus». Un plan que no
 *    conocemos se ofrece igual porque la autoridad es el servidor, y su guarda 2
 *    (`currentPlan === 'plus'`) es la única que lo rechazaría.
 *
 * El criterio de «hay baja programada» es el MISMO que `effectiveLocationLimit` [R1-N8]: un
 * string vacío no es una baja programada. Con `Boolean(pendingPlan)` bastaría hoy, pero el
 * tope de locales y lo que la UI dice tienen que coincidir o el owner lee «tu plan baja» con
 * el tope sin caer.
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
    return {
      ...base,
      noPlan: true,
      upgrade: "Volver a Plus",
      downgrade: {
        label: "Ajustarme y bajar a Free",
        endpoint: "/api/billing/settle-free",
      },
    };
  }
  if (view.plan === "plus") {
    return {
      ...base,
      downgrade: { label: "Bajar a Free", endpoint: "/api/billing/cancel" },
      intervalUpgrade:
        view.interval !== "year" && !DEAD_STRIPE_STATUS.has(view.status),
    };
  }
  return { ...base, upgrade: "Mejorar a Plus" };
}

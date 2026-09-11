import type { SubscriptionRow } from "./derive";

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
 * sección. Patrón de `app/login/login-notice.ts` (ADR 0055): un status desconocido NUNCA
 * llega crudo al DOM.
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

/** Traducción del STATUS crudo de Stripe (D5.e lo guarda sin colapsar). Patrón de
 * `app/login/login-notice.ts` (ADR 0055): un status desconocido nunca llega crudo al DOM.
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

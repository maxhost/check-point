/**
 * Spec 0072 §D2 / ADR 0073 §2-3 — EL CATALOGO DE ENTITLEMENTS.
 *
 * Es la **unica** fuente de verdad de «que permite cada plan». Antes de esta spec el
 * conocimiento vivia en tres lugares —el mapa de topes de `locations/core.ts`, la
 * constante del plan con campañas de `marketing/plan-gate.ts` y `PAID_PLANS` de
 * `billing/derive-rules.ts`— y **ya divergio una vez**: el `planAllows` de la fase B1
 * miraba solo `plan === 'plus'`, sin `pending_plan` ni suscripcion viva, y por eso una
 * baja programada no frenaba la activacion de una campaña.
 *
 * **Agregar un limite nuevo es UNA fila de este objeto** (requisito explicito del owner):
 * la clave se tipa sola (`EntitlementKey`) y `limitOf`/`can` la resuelven sin tocar nada
 * mas.
 *
 * **Lo que este archivo NO decide: `core.business.status`.** Los dos ejes no se mezclan
 * (ADR 0073 §1). Un `can()` que devolviera `false` por suspension haria que la superficie
 * diga «mejora tu plan» a un negocio suspendido, que es la accion contraria a la que
 * necesita. El estado del negocio se evalua ANTES, en `requireApiOwner`, y nunca aca.
 */

/**
 * Los planes que `core.subscription.plan` toma hoy (spec 0189 / ADR 0134 §1: no hay plan
 * gratis). NO es decoracion: `byPlan` esta tipado como `Record<KnownPlan, …>`, asi que
 * **agregar un plan aca sin declarar sus limites en cada entrada no compila**, y el recorrido
 * `ENTITLEMENTS × KNOWN_PLANS` (`entitlements-catalog.test.ts`) lo pone ademas en rojo.
 *
 *  - `trial`: la prueba de 90 dias, con todo lo del plan superior (ADR 0134 §2).
 *  - `base`: el plan pago chico — 1 local, Bienvenida y Venta cruzada (ADR 0134 §4).
 *  - `plus`: el plan pago superior — 3 locales y todas las campañas (ADR 0134 §5).
 *  - `none`: sin acceso. Es tambien el valor de un negocio BLOQUEADO (`effectivePlan`).
 *
 * Los ids internos no cambian cuando lleguen los nombres comerciales (ADR 0134 §1).
 */
export const KNOWN_PLANS = ["trial", "base", "plus", "none"] as const;

export type KnownPlan = (typeof KNOWN_PLANS)[number];

/** ADR 0134 §2: la prueba dura 90 dias. Se usa al ESCRIBIR `trial_ends_at` (alta, seed); el
 * acceso se decide por la fecha guardada, nunca recalculando con esto. */
export const TRIAL_DAYS = 90;

/** Precios de EXHIBICION (ADR 0134 §4/§5/§10, en USD). El cobro real es el precio de Stripe:
 * esto solo viaja a la UI (`GET /api/billing/state`). */
export const PLAN_PRICES_USD = {
  base: { month: 20, year: 200 },
  plus: { month: 49, year: 490 },
} as const;

/**
 * Spec 0090 §8 / ADR 0082 §10 — LA VENTANA de una entrada `kind: "limit"`.
 *
 * Existe porque el requisito del owner es poder mover el cupo de analisis (1/dia → 10/semana
 * → 5/mes por plan) **sin tocar codigo**. Las entradas que no la declaran —`locations.max`—
 * son topes de **stock** (cuantos hay ahora), no de **flujo** (cuantos en un periodo), y su
 * ausencia es lo que las distingue: `windowOf` devuelve `null` para ellas.
 */
export type EntitlementWindow = "day" | "week" | "month";

/**
 * Spec 0189 §D2: el valor sale de `byPlan[effectivePlan(ctx)]` (`index.ts`). Ya no hay reglas
 * por entrada (ni «exige suscripcion viva» ni «el menor con el pendiente»): el acceso
 * (suscripcion viva o prueba vigente) decide el plan EFECTIVO, y `pending_plan` solo toma `'none'` (cancelacion programada), que
 * por el ADR 0134 §8 no baja nada hasta el fin del periodo pagado.
 */
type EntitlementShape<Kind extends string, Value> = {
  kind: Kind;
  byPlan: Record<KnownPlan, Value>;
  /** El valor de un plan DESCONOCIDO (y el de una suscripcion viva cuyo plan no es pago).
   * Es el mas restrictivo. */
  fallback: Value;
  /** Solo en los topes de FLUJO (spec 0090 §8). Ausente = tope de stock, sin ventana. */
  window?: EntitlementWindow;
};

export type LimitEntitlement = EntitlementShape<"limit", number>;
export type FlagEntitlement = EntitlementShape<"flag", boolean>;
export type EntitlementDef = LimitEntitlement | FlagEntitlement;

export const ENTITLEMENTS = {
  /** Locales ACTIVOS que el plan admite (ADR 0134 §4/§5). `none` es 1 y no 0 (ADR 0058 §12):
   * el tope se usa tambien para el plan destino de una bajada y para archivar y salir. */
  "locations.max": {
    kind: "limit",
    byPlan: { trial: 3, base: 1, plus: 3, none: 1 },
    fallback: 1,
  },
  /** Componer y activar campañas: todas las plantillas salvo Bienvenida y Venta cruzada, y las
   * campañas propias (ADR 0134 §5). Solo `trial` y `plus`. */
  "campaigns.enabled": {
    kind: "flag",
    byPlan: { trial: true, base: false, plus: true, none: false },
    fallback: false,
  },
  /**
   * ADR 0112 + ADR 0134 §4 — LA BIENVENIDA: incluida en los planes con acceso (`trial`,
   * `base`, `plus`). Un negocio sin acceso (`none`) no la activa ni la entrega (ADR 0134 §7).
   * Solo la consulta la plantilla `welcome` (`campaignAllowedFor` en `marketing/plan-gate.ts`).
   */
  "campaigns.welcome": {
    kind: "flag",
    byPlan: { trial: true, base: true, plus: true, none: false },
    fallback: false,
  },
  /**
   * Spec 0189 §D2 / ADR 0134 §4 — LA VENTA CRUZADA: incluida en el plan base («sirve al comercio
   * y a la red»). Solo la consulta la plantilla `cross`; «Horas valle» sigue con
   * `campaigns.enabled`.
   */
  "campaigns.cross": {
    kind: "flag",
    byPlan: { trial: true, base: true, plus: true, none: false },
    fallback: false,
  },
  /**
   * Spec 0090 §8 — ANALISIS DE IMPORTACION QUE LLEGARON A `ready`, por ventana.
   *
   * **Solo lo consume un analisis que llego a `ready`** (ADR 0082 §10, decision del owner):
   * un fallo del proveedor o nuestro no le cuesta el dia al merchant. Es un control
   * operativo, no cuota comercial: vale lo mismo en todos los planes.
   *
   * **⚠️ VALOR DE PRUEBAS — 100, NO 1 (decision del owner, 2026-09-23).** El valor de
   * produccion es **1 por negocio por dia** y vuelve cuando la feature salga de pruebas.
   * Lo unico que se movio es el numero, y se mueve **solo acá**.
   */
  "catalog.imports.analyses": {
    kind: "limit",
    byPlan: { trial: 100, base: 100, plus: 100, none: 100 },
    fallback: 100,
    window: "day",
  },
  /**
   * El techo de SUBMITS ACEPTADOS por el proveedor en la ventana (ADR 0083). Un trabajo
   * aceptado cuenta aunque falle despues; configuracion/preparacion/rechazo de `start` no.
   *
   * **⚠️ TAMBIEN EN VALOR DE PRUEBAS — 100, NO 3.** Valor de produccion: **3**.
   */
  "catalog.imports.attempts": {
    kind: "limit",
    byPlan: { trial: 100, base: 100, plus: 100, none: 100 },
    fallback: 100,
    window: "day",
  },
} as const satisfies Record<string, EntitlementDef>;

export type EntitlementKey = keyof typeof ENTITLEMENTS;

type KeysOfKind<Kind extends EntitlementDef["kind"]> = {
  [Key in EntitlementKey]: (typeof ENTITLEMENTS)[Key]["kind"] extends Kind
    ? Key
    : never;
}[EntitlementKey];

/** Las claves que `limitOf` acepta; `can` no las compila y viceversa. */
export type LimitKey = KeysOfKind<"limit">;
export type FlagKey = KeysOfKind<"flag">;

/**
 * Los planes PAGOS (ADR 0134 §4/§5). Vive en el catalogo y no en `billing/derive-rules.ts`
 * (de donde se re-exporta) por el mismo motivo que los topes: «que plan es pago» era el
 * tercer lugar de la §P1 donde el conocimiento de plan estaba copiado.
 *
 * `ReadonlySet<string>` y no `ReadonlySet<KnownPlan>`: sus llamadores preguntan por un
 * `plan` que viene de la base como `string`, y un set tipado obligaria a castear en cada
 * `.has()`.
 */
export const PAID_PLANS: ReadonlySet<string> = new Set<KnownPlan>([
  "base",
  "plus",
]);

/** Las plantillas que incluye el plan BASE (spec 0189 §D2): una plantilla esta en el base si su
 * flag propio es `true` en `base`. DERIVADO del catalogo, no escrito a mano en otro lugar; lo
 * usan el bloqueo de bajada a base y el barrido. */
const TEMPLATE_FLAGS = {
  welcome: "campaigns.welcome",
  cross: "campaigns.cross",
} as const;

export const BASE_TEMPLATE_KEYS: readonly string[] = Object.entries(
  TEMPLATE_FLAGS,
)
  .filter(([, key]) => ENTITLEMENTS[key].byPlan.base)
  .map(([template]) => template);

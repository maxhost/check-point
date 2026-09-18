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
 * Los planes que `core.subscription.plan` toma hoy. NO es decoracion: `byPlan` esta tipado
 * como `Record<KnownPlan, …>`, asi que **agregar un plan aca sin declarar sus limites en
 * cada entrada no compila**, y el recorrido `ENTITLEMENTS × KNOWN_PLANS`
 * (`entitlements-catalog.test.ts`) lo pone ademas en rojo en la suite.
 *
 * El agujero que cierra (ADR 0073 §3): hasta esta spec un plan sin fila caia al valor mas
 * restrictivo **en silencio**, asi que introducir `enterprise` lo aterrizaba en 1 local —
 * el peligro estaba escrito como advertencia en `locations/core.ts` y no tenia oraculo.
 */
export const KNOWN_PLANS = ["free", "plus", "none"] as const;

export type KnownPlan = (typeof KNOWN_PLANS)[number];

/** Que hacer con `pending_plan`. Hoy hay una sola regla y es la del ADR 0063 D2: el valor
 * efectivo es el **menor** entre el plan vigente y el destino. Es `min` y no «gana el
 * pendiente» porque un upgrade programado no debe subir el tope antes de que el pago este
 * confirmado. Se declara por entrada —en vez de ser implicita— para que el dia que aparezca
 * una segunda regla el catalogo la pueda nombrar sin tocar a los llamadores. */
export type PendingRule = "min";

type EntitlementShape<Kind extends string, Value> = {
  kind: Kind;
  byPlan: Record<KnownPlan, Value>;
  /** El valor de un plan DESCONOCIDO, y tambien el de una entrada con
   * `requiresLiveSubscription` cuando no hay suscripcion viva. Es el mas restrictivo. */
  fallback: Value;
  /**
   * ADR 0073 §2 — se declara **por entrada** y NO se deriva un `effectivePlan` unico.
   *
   * La asimetria existe **a proposito**: un `plus` con `interval` NULL y sin
   * `stripe_subscription_id` (la forma A1 de la spec 0063, que existio en produccion) no
   * activa campañas pero **si conserva sus 3 locales**, porque el tope de un negocio sin
   * suscripcion es 1 «y no 0» para que pueda archivar y salir. Degradar a `free` en la
   * capa es mas simple de leer y **cambia el comportamiento de locales**.
   */
  requiresLiveSubscription: boolean;
  pendingRule: PendingRule;
};

export type LimitEntitlement = EntitlementShape<"limit", number>;
export type FlagEntitlement = EntitlementShape<"flag", boolean>;
export type EntitlementDef = LimitEntitlement | FlagEntitlement;

export const ENTITLEMENTS = {
  /** Locales ACTIVOS que el plan admite (spec 0061 decision 2, ADR 0063 D2). `none` es 1 y
   * no 0 a proposito (ADR 0058 §12): un negocio sin suscripcion sigue operando su local y
   * tiene que poder archivar para salir. */
  "locations.max": {
    kind: "limit",
    byPlan: { free: 1, plus: 3, none: 1 },
    fallback: 1,
    requiresLiveSubscription: false,
    pendingRule: "min",
  },
  /** Componer y activar campañas (spec 0065 fase D). Exige suscripcion viva: sin esto un
   * `plus` forma A1 activaria campañas sin pagar. */
  "campaigns.enabled": {
    kind: "flag",
    byPlan: { free: false, plus: true, none: false },
    fallback: false,
    requiresLiveSubscription: true,
    pendingRule: "min",
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
 * Los planes PAGOS. Vive en el catalogo y no en `billing/derive-rules.ts` (de donde se
 * re-exporta) por el mismo motivo que los topes: «que plan es pago / como se llama» era el
 * tercer lugar de la §P1 donde el conocimiento de plan estaba copiado.
 *
 * `ReadonlySet<string>` y no `ReadonlySet<KnownPlan>`: sus llamadores preguntan por un
 * `plan` que viene de la base como `string`, y un set tipado obligaria a castear en cada
 * `.has()`.
 */
export const PAID_PLANS: ReadonlySet<string> = new Set<KnownPlan>(["plus"]);

import type Stripe from "stripe";

/**
 * Spec 0063, §Archivos compartidos — LA COSTURA DE STRIPE. La dejó el orquestador antes de
 * despachar.
 *
 * Hoy `getStripeClient()` se llama DENTRO de las rutas (`checkout/route.ts:48`,
 * `stripe/webhook/route.ts:17`). Sin esta costura, la mitad del plan de pruebas de la spec
 * no se puede escribir: no hay forma de que un test haga que `subscriptions.update` tire
 * `StripeConnectionError` y aseverar que el estado QUEDA PUESTO, ni de contar que
 * `settle_to_free` hace CERO llamadas a Stripe.
 *
 * [R2-B7] EL PARÁMETRO INYECTADO ES `StripeGateway`, UNA INTERFAZ MÍNIMA PROPIA, NO LA
 * CLASE `Stripe`. Con la clase concreta todo fake necesita `as unknown as Stripe`, y ese
 * cast apaga justamente el typecheck que la costura se estaba comprando: el fake podría
 * tener la firma equivocada y el gate quedaría verde. Con la interfaz mínima, un fake mal
 * tipado no compila.
 *
 * Los métodos se toman con `Pick<Stripe["…"], …>`, no se re-escriben a mano: así las firmas
 * y los tipos de respuesta salen del SDK instalado y no de una copia nuestra que pueda
 * derivar. Si una operación nueva hace falta, se agrega acá — el fake deja de compilar
 * hasta que la implemente, que es el punto.
 */
export type StripeGateway = {
  /**
   * `cancel` entra con la spec 0064 (ADR 0063): la baja a Free es INMEDIATA, así que la ruta
   * ya no programa con `update({cancel_at_period_end:true})` sino que termina la suscripción
   * en el acto. Se pide el método ENTERO del SDK (`Pick`), así que `prorate` e `invoice_now`
   * quedan tipados con su default `false` — no hay que escribir nada para «sin devolución».
   */
  subscriptions: Pick<
    Stripe["subscriptions"],
    "retrieve" | "update" | "list" | "cancel"
  >;
  /**
   * `invoices.list` entra con la spec 0064, F2-4: el importe cobrado y el link al recibo salen
   * de la última factura PAGADA (respuesta literal del owner). Es la primera vez que este
   * dominio toca `invoices`, y por eso el fake tiene que implementarla para seguir compilando.
   */
  invoices: Pick<Stripe["invoices"], "list">;
  checkout: {
    sessions: Pick<Stripe["checkout"]["sessions"], "create" | "retrieve">;
  };
  customers: Pick<Stripe["customers"], "create">;
};

/**
 * QUIÉN RECIBE LA COSTURA, EN EL ÁRBOL REAL. El `gw` va PRIMERO en todas, por consistencia:
 *
 *   applySubscriptionEvent(gw, event, …)   bindCheckoutSession(gw, event, …)
 *   reconcileFromStripe(gw, args)
 *
 * [CORRECCIÓN DE LA FASE D1, cazada por el revisor independiente — ADR 0054 del lado del
 * docblock.] Esta lista decía `cancelSubscription(gw,…)`, `resumeSubscription(gw,…)`,
 * `changeInterval(gw,…)` y `createCheckoutSession(gw,…)`, y la §Archivos compartidos de la
 * spec la repetía: NINGUNA DE LAS CUATRO EXISTE. Las cuatro operaciones de plan viven en sus
 * rutas (`app/api/billing/<ruta>/route.ts`), que toman el gateway con `stripeContext()` y llaman a
 * `gw.subscriptions.update` / `retrieve` / `gw.checkout.sessions.create` /
 * `gw.customers.create` directo. La costura cumple igual su función —el fake se inyecta y los
 * tests pueden hacer fallar a Stripe— pero un docblock que describe funciones inexistentes es
 * una arquitectura afirmada y no verificada. Si alguna de esas operaciones se extrae a
 * `server/billing/`, se agrega acá con su firma REAL.
 *
 * Y CÓMO LLEGA EL FAKE A LAS DOS SUPERFICIES QUE NO TIENEN PARÁMETRO — queda decidido acá
 * para que no se improvise durante el código:
 *
 *  - la RUTA del webhook, que necesita `constructEvent` para verificar la firma y por lo
 *    tanto el cliente real, no el gateway;
 *  - la PÁGINA de D8, un server component que no recibe props de nadie.
 *
 * Las dos se testean mockeando el módulo `server/stripe-config` con `vi.mock`, igual que
 * `locations-routes.test.ts` mockea `ownerContext`. La firma sí tiene oráculo real: el
 * payload se construye con `stripe.webhooks.generateTestHeaderString({ payload, secret })`
 * (`cjs/Webhooks.d.ts:74`, verificado que existe), así que la ruta completa —firma, claim y
 * runtime— se ejerce de punta a punta y NO hace falta declarar ningún límite ahí.
 */

/**
 * `getStripeClient()` devuelve un `Stripe`, que satisface estructuralmente a
 * `StripeGateway`. Esta función existe para que ese paso sea UN solo lugar nombrado y para
 * que el compilador lo verifique, en vez de que cada ruta lo asuma.
 */
export function asStripeGateway(client: Stripe): StripeGateway {
  return client;
}

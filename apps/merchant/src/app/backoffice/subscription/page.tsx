import { requireOwner } from "../../../server/auth-guards";
import { withDbTransaction } from "../../../server/db";
import {
  activeLocationCount,
  lockBusiness,
} from "../../../server/locations/shared";
import {
  asStripeGateway,
  decidePlanChange,
  readSubscription,
  reconcileFromStripe,
  subscriptionOffers,
  toSubscriptionView,
} from "../../../server/billing";
import {
  getStripeClient,
  getStripeConfiguration,
} from "../../../server/stripe-config";
import { SubscriptionConsole } from "./subscription-console";

export const dynamic = "force-dynamic";

/**
 * Spec 0063, D7 + D8 — la sección de suscripción, SOLO OWNER (`requireOwner`, que manda al
 * staff al mostrador).
 *
 * EL ORDEN ES NORMATIVO: se reconcilia con Stripe ANTES de renderizar (D8). Al revés, el
 * owner vería la fila divergente que la reconciliación acaba de arreglar y el ítem del DoD
 * («fila divergente → reconcilia antes de renderizar») quedaría cumplido sólo por casualidad
 * en la recarga siguiente.
 *
 * NADA INTERNO CRUZA AL NAVEGADOR: lo único que baja es `toSubscriptionView(row)` (la
 * allow-list positiva de D7). El `stripe_customer_id` se lee acá porque es la llave con la
 * que D8 le pregunta a Stripe, y NO viaja: no está en el DTO ni en ninguna prop.
 * `CLAUDE.md` lo tiene como regla y un revisor ya cazó esa fuga en marca (spec 0025).
 *
 * EL ORÁCULO NO ES EL RENDER DEL HTML — y llevó CINCO vueltas llegar a la forma que sirve
 * (ADR 0062, que las cuenta todas). `renderToStaticMarkup` NO emite el payload RSC, así que
 * las props de la consola (un componente cliente) nunca aparecen en el markup: bajar la fila
 * cruda dejaba 66/66 en verde. El oráculo vive en `billing-pages.neon.integration.test.ts` y
 * hoy es `expectCrossesExactly` (en `billing-pages-support.ts`): `type`, `key`, UNA SOLA lectura
 * (`structuredClone`, que es lo que hace Flight) y VALOR EXACTO de todas las props — las cuatro
 * COMPLETAS en CADA estado, y cada estado en su propio `it`, sembrado con claves reales.
 * Las formas que se vieron suficientes y NO lo eran: el render del HTML, `JSON.stringify`, la
 * allow-list de CLAVES, la lectura doble y —la que abrió el fix de esa— aseverar el conjunto
 * completo en UN SOLO estado. Cada una tiene su mutación verde transcrita en el ADR.
 */
export default async function SubscriptionPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string; done?: string }>;
}) {
  const { business } = await requireOwner();
  const confirmedWithStripe = await reconcileOnOpen(business.id);
  const state = await readBillingState(business.id);
  const params = await searchParams;

  if (!state) {
    // Sin fila de suscripción no se puede decir NADA del plan, y decir «Free» sería la
    // mentira que `none` existe para no contar (ADR 0058 §12). El unique de D3 y la FK
    // hacen el caso improbable; una página no puede fijar el status HTTP (`CLAUDE.md`), así
    // que lo honesto es decirlo y no ofrecer ninguna operación.
    return (
      <main className="merchant-shell">
        <p className="toast error" role="status">
          No pudimos leer tu suscripción. Volvé a intentar en unos minutos.
        </p>
      </main>
    );
  }

  return (
    <SubscriptionConsole
      subscription={state.subscription}
      offers={subscriptionOffers(state.subscription)}
      activeLocations={state.activeLocations}
      canCancel={state.canCancel}
      downgradeBlock={state.downgradeBlock}
      stripeUnconfirmed={!confirmedWithStripe}
      timezone={business.timezone}
      notice={noticeFor(params)}
    />
  );
}

/**
 * D8 — RECONCILIACIÓN AL ABRIR. Devuelve si el estado que se va a renderizar quedó
 * CONFIRMADO contra Stripe; `false` es lo que enciende el aviso «no pudimos confirmar con
 * Stripe», que NO bloquea la sección (D8, última línea).
 *
 * Esta función NO PUEDE TIRAR. Es la diferencia entre «la sección se degrada» y «el owner ve
 * una pantalla de error»: cualquier fallo de red, de configuración o de Stripe se traduce en
 * el aviso. Por eso el `catch` es ancho a propósito — acá no hay ninguna clase de error que
 * amerite tumbar la página.
 *
 * QUÉ CUENTA COMO «CONFIRMADO», porque no es lo mismo que «escribió»:
 *  - `reconciled: true` → confirmado (y la fila puede haber cambiado: por eso el estado se
 *    lee DESPUÉS).
 *  - `no_customer` → confirmado. Es el caso de los 9 `free` de prod: nunca hubo customer, no
 *    hay nada que preguntar y no hay deriva posible. Avisar acá sería alarmar a todos los
 *    negocios gratis por un no-evento.
 *  - `no_subscriptions` y `ignored` → NO confirmado. En los dos le preguntamos a Stripe y lo
 *    que volvió no alcanza para respaldar la fila (lista vacía con `status:"all"`, o una
 *    suscripción que no es de esta fila). D8 es explícito en que con la lista vacía **no se
 *    escribe nada** y se avisa: vaciar un plan desde el render de una página no está
 *    permitido.
 *  - `no_subscription_row` → NO confirmado, pero ese caso no llega a renderizar la sección
 *    (`readBillingState` devuelve `null` antes).
 */
async function reconcileOnOpen(businessId: string): Promise<boolean> {
  try {
    const configuration = getStripeConfiguration();
    // El customer id SOLO se usa como llave para preguntarle a Stripe: no se decide nada con
    // esta lectura, así que va sin `lockBusiness`. Lo que sí decide y escribe es
    // `reconcileFromStripe`, que vuelve a leer la fila bajo su propio lock.
    const stripeCustomerId = await withDbTransaction(async (tx) => {
      const row = await readSubscription(tx, businessId);
      return row?.stripeCustomerId ?? null;
    });
    const outcome = await reconcileFromStripe(
      asStripeGateway(getStripeClient(configuration)),
      {
        businessId,
        stripeCustomerId,
        priceIds: {
          monthly: configuration.monthlyPriceId,
          yearly: configuration.yearlyPriceId,
        },
      },
    );
    return outcome.reconciled || outcome.reason === "no_customer";
  } catch {
    return false;
  }
}

/**
 * El estado que la sección muestra, leído DESPUÉS de la reconciliación y bajo
 * `lockBusiness`, igual que `billingStateResponse` (`api/billing/_auth.ts`) — el contrato de
 * `readSubscription` pide que la lectura y la decisión ocurran en la misma transacción
 * lockeada.
 *
 * `canCancel` y el mensaje del modal salen de `decidePlanChange`, LA MISMA función pura que
 * usan las 5 rutas: no hay una segunda regla de conteo que pueda divergir, y el texto que el
 * modal muestra es LITERALMENTE el que devolvería el 409. Lo que no cubre: esta composición
 * (lock → leer → contar → decidir) es una segunda escritura de la secuencia que ya vive en
 * `decideUnderLock`; ese helper no sirve acá porque LANZA un 409 ante `blocked`, que es justo
 * el estado que esta página tiene que RENDERIZAR. Queda declarado como hallazgo en el
 * handoff.
 */
async function readBillingState(businessId: string) {
  return withDbTransaction(async (tx) => {
    await lockBusiness(tx, businessId);
    const row = await readSubscription(tx, businessId);
    if (!row) return null;
    const activeLocations = await activeLocationCount(tx, businessId);
    const decision = decidePlanChange({
      currentPlan: row.plan,
      currentInterval: row.interval,
      pendingPlan: row.pendingPlan,
      status: row.status,
      stripeSubscriptionId: row.stripeSubscriptionId,
      activeLocations,
      intent: { kind: "downgrade" },
    });
    return {
      subscription: toSubscriptionView(row),
      activeLocations,
      canCancel:
        decision.kind === "schedule_downgrade" ||
        decision.kind === "settle_to_free",
      downgradeBlock:
        decision.kind === "blocked" && decision.code === "downgrade_blocked"
          ? {
              message: decision.message,
              archiveCount: decision.archiveCount ?? 0,
            }
          : null,
    };
  });
}

/** El aviso de vuelta de Stripe Checkout y de una operación propia, por ALLOW-LIST: un valor
 * que no esté acá no imprime nada. El patrón es el de `app/login/login-notice.ts` (ADR
 * 0055), y el motivo es el mismo — un `?done=` viene de la URL, o sea del atacante. */
function noticeFor(params: {
  checkout?: string;
  done?: string;
}): string | null {
  if (params.checkout === "success") {
    return "Recibimos tu pago. Tu plan se actualiza en cuanto Stripe lo confirme.";
  }
  if (params.checkout === "cancelled") {
    return "No completaste el pago: tu plan no cambió.";
  }
  switch (params.done) {
    case "cancel":
      return "Programamos la baja a Free.";
    case "resume":
      return "Tu suscripción sigue activa.";
    case "interval":
      return "Pasaste a facturación anual.";
    default:
      return null;
  }
}

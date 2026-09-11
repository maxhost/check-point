---
spec: 0063
fecha: 2026-09-10
estado: cerrada
resumen: Seccion propia de suscripcion en el backoffice — upgrade por Stripe Checkout, downgrade/cancelacion con bloqueo duro (archivar locales primero) y tope de locales que cae al plan DESTINO en cuanto la baja queda programada; cambio de intervalo mensual → anual (el inverso afuera, tarea 55); el webhook deja de escribir plan "plus" para cualquier evento y pasa a leer el estado real de Stripe. Un impago NO baja el plan y un `deleted` inesperado deja el negocio SIN suscripcion (`plan='none'`), nunca en free (ADR 0059 / 0058 §12).
disjunta: si
archivos: server/schema/business.ts, drizzle/0030_*.sql, server/billing/*, server/locations/{core,shared,index}.ts, app/api/billing/{checkout,cancel,resume,interval,settle-free}/*, app/api/stripe/webhook/route.ts, app/backoffice/subscription/*, app/backoffice/page.tsx, app/backoffice/locations/page.tsx, app/onboarding/page.tsx, server/locations-integration-support.ts
---

# 0063 — Cambio de plan y cancelacion de suscripcion

Implementa el **ADR 0058**. Cierra la **tarea 53**. El **ADR 0059** (el impago bloquea el
acceso) sale de esta spec pero se implementa en la **tarea 54**, no aca.

> **Historia de este documento, porque importa para leerlo.** Paso por **dos rondas de revision
> independiente** (cuatro revisores) y por verificacion empirica del orquestador: SQL contra la
> base de prod, `EXPLAIN` del claim, y los `.d.ts` de la version de Stripe instalada. **Cada
> ronda encontro bloqueantes reales**, y dos de ellos fueron esta spec cometiendo el error del
> ADR 0054 **sobre si misma**: afirmar «verificado empiricamente» sobre una cosa habiendo
> verificado otra. Los hallazgos van marcados **[R1]** y **[R2]** con la evidencia transcripta.
>
> **Lo mas importante que aprendio:** su version anterior elegia el discriminante de la decision
> mas critica «sin necesidad de ninguna columna nueva», y eso era falso de una forma que se
> demostraba leyendo la propia spec dos secciones mas abajo — el discriminante era
> **falsificable por el actor del que habia que defenderse**. Ver D3/[R2-1].

## Problema

Cuatro problemas, todos verificados en el arbol y en la base de prod:

1. **Un negocio `free` no tiene forma de pagar.** `POST /api/billing/checkout` es la unica ruta
   de billing y su unico llamador es `app/onboarding/page.tsx:158`.
2. **Nadie puede bajar de plan ni cancelar.** `plan` solo se LEE
   (`app/backoffice/page.tsx:62`); no existe UI ni ruta que lo escriba.
3. **El webhook escribe `plan: "plus"` para CUALQUIER evento `customer.subscription.*`**
   (`webhook/route.ts:59`), incluido `deleted`. **Ojo con el arreglo obvio, que es el
   equivocado:** «`deleted` → `free`» no es el fix — `free` es una suscripcion, y un `deleted`
   inesperado no es ninguna de las que existen (ADR 0058 §12).
4. **El webhook pierde eventos en silencio.** El `INSERT … onConflictDoNothing`
   (`webhook/route.ts:36-46`) marca el evento como recibido **antes** de procesarlo: si el
   procesamiento falla, el reintento de Stripe contesta `{duplicate:true}` y el evento **no se
   procesa nunca**.

### Estado real de prod (verificado por SQL el 2026-09-10)

```sql
select plan, status, interval, (stripe_subscription_id is not null) as has_sub,
       (stripe_customer_id is not null) as has_cust, count(*)
from core.subscription group by 1,2,3,4,5;
--  free | active | null  | false | false |  9
--  plus | active | null  | false | false |  1      <-- A1
--  plus | active | month | true  | true  |  1      <-- Negocio B

select payload_version, event_type, count(*) from core.stripe_webhook_event group by 1,2;
--  2020-08-27 | invoice.paid                  | 1
--  2020-08-27 | checkout.session.completed    | 1
--  2020-08-27 | customer.subscription.created | 1
```

Hechos que esto fija, y cada uno mato una version anterior de alguna regla de esta spec:

- **Los 11 negocios tienen `status='active'`.** Toda regla escrita como «hay suscripcion viva si
  `status ≠ 'canceled'`» los bloquea a los 11 **[R1]**.
- **A1 esta en `plus` sin `stripe_subscription_id`, con `interval` NULL y 1 local activo** (el
  `plus` se lo pusimos a mano por SQL en el QA de la 0061). **`interval` nulo con plan pago es un
  estado real de prod** **[R2]**.
- **Al endpoint llegan eventos que NO son `customer.subscription.*`** (`invoice.paid`,
  `checkout.session.completed`): todo algoritmo que asuma que el `id` del payload es un `sub_…`
  se rompe con ellos **[R2-3]**.
- **`payload_version` es `2020-08-27`**, seis años anterior a la del SDK (D5).
- **Ningun negocio esta hoy por encima de su tope**, y **no hay `business_id` duplicados** (0
  filas), asi que el unique de D3 es seguro de aplicar.

Y el invariante del owner (ADR 0058 §3 y §6): **no puede existir un downgrade sin llevar antes
los locales activos al tope del plan destino**, y **no se puede dar de alta ni desarchivar
locales si el plan no lo permite**.

## Alcance

**Entra:**

- Pagina `/backoffice/subscription` (solo owner).
- **Upgrade `free` → `plus`** por Stripe Checkout; el plan se aplica cuando el pago se confirma.
- **Downgrade `plus` → `free` (= cancelar)**, con bloqueo duro en el servidor y el modal del ADR
  0058 §8.
- **Endurecimiento del tope de locales** al plan destino en cuanto la baja esta programada.
- **Reanudar** una baja programada (§Decisiones del orquestador-1).
- **Cambio de intervalo mensual → anual** (D9). El inverso **no entra** (tarea 55).
- **El estado «sin suscripcion» (`plan='none'`) y su salida** (D10). El **bloqueo de acceso** de
  ese estado no entra (tarea 54); la **salida** si, para que el estado no sea un callejon.
- **Reescritura del webhook**: allow-list de tipos de evento, estado leido de Stripe,
  reprocesable, con lock del negocio.
- **Reconciliacion con Stripe al abrir la pagina** (D8) y **persistencia del
  `stripe_customer_id` en el momento del checkout**, sin la cual esa reconciliacion es un no-op
  **[R2-6]**.
- Gate de **owner activo** en las 5 rutas; el `businessId` deja de venir del body.

**No entra** (explicito):

- **`anual → mensual`** (tarea 55): exige `subscription_schedules` o quedarse con plata del
  cliente (D9).
- **Un tercer plan.** `PLAN_LOCATION_LIMITS` tiene `free`, `plus` y ahora `none`.
- **El bloqueante «sin campanas corriendo»** del ADR 0058 §3: las campanas no existen (diferidas
  por los ADR 0034/0057). La lista de bloqueantes queda en **una sola funcion**; la spec de
  campanas le suma el suyo ahi.
- **Reembolsos en plata.**
- **El bloqueo de acceso por impago** (ADR 0059, tarea 54).
- **Customer Portal de Stripe.** **Archivar locales automaticamente.**
- **Auditoria de los cambios de plan hechos por ruta** — se declara en D11 y se acepta.

## Diseño

### D0. Con los planes de hoy, «downgrade» y «cancelar» son la MISMA operacion

`free` (1 local) y `plus` (3 locales). El unico movimiento hacia abajo es `plus → free`, y `free`
no tiene suscripcion de Stripe: bajar de plan **es** terminar la suscripcion. Con un tercer plan
pago se generaliza (`subscriptions.update` de precio) y ahi si son dos caminos.

El boton exige archivar locales primero y **nunca se muestra bloqueado** (ADR 0058 §8): abre un
modal que explica que falta. Ver D7.

### D1. El invariante: el conteo de activos nunca AUMENTA por encima del tope efectivo

No puede ser «activos ≤ tope, siempre»: Stripe puede cancelar sin que nadie pase por la UI. El
que se sostiene es **de transicion**:

> Ninguna operacion puede **aumentar** la cantidad de locales activos por encima del tope
> efectivo del negocio.

Es la forma literal de la decision 6 del ADR 0058. Estar por encima del tope queda como estado
**tolerado y solo decreciente**: no se rechaza ninguna lectura, el mostrador sigue funcionando,
pero el negocio no puede crear ni desarchivar hasta volver por debajo.

Con el ADR 0059 + el 0058 §12, **ya no existe ningun camino por el que un negocio llegue a `free`
sin pasar por la verificacion de locales**: un impago no baja el plan (bloquea el acceso) y un
`deleted` inesperado va a `none` (bloquea), no a `free`.

> **[R2-1] Esa frase estuvo escrita sin ser cierta**, porque el discriminante que la sostenia se
> podia fabricar desde el dashboard de Stripe. Lo que la hace cierta ahora es la columna
> `downgrade_requested_at` de D3, no la buena voluntad del texto.

### D2. Tope efectivo = el menor entre el plan vigente y el plan destino

El agujero que cierra: `store.ts:70` compara contra `planLocationLimit`, que lee
`subscriptions.plan`, o sea el plan **vigente**. Con una baja ya programada el negocio sigue en
`plus` hasta el fin del periodo, asi que desarchivar hasta 3 locales es **valido** — y al cerrar
el periodo queda `free` con 3 activos.

En `locations/core.ts`, **una sola** funcion pura:

```ts
export function effectiveLocationLimit(
  plan: string | null | undefined,
  pendingPlan: string | null | undefined,
): number {
  const current = locationLimitForPlan(plan);
  // Un string vacio NO es una baja programada: sin esto el tope caeria a 1 sin que nadie
  // haya programado nada. [R1-N8]
  if (typeof pendingPlan !== "string" || pendingPlan === "") return current;
  return Math.min(current, locationLimitForPlan(pendingPlan));
}
```

Es `min` y no «el pendiente gana»: un futuro upgrade programado no debe **subir** el tope antes
de que el pago este confirmado.

`PLAN_LOCATION_LIMITS` gana la fila **`none: 1`**. Un plan desconocido ya cae al tope mas
restrictivo por el fallback (`core.ts:71-74`), asi que funcionaria igual — pero desde el ADR 0058
§12 `none` es un estado **deliberado**, y apoyarse en un fallback para un valor que usamos a
proposito es como no declararlo. Es 1 y no 0 porque un negocio sin suscripcion **sigue operando
su local** y tiene que poder archivar para salir del estado.

`planLocationLimit` (`shared.ts:75`) pasa a seleccionar `plan` **y** `pendingPlan`. Sus dos
llamadores (`address.ts:41`, `store.ts:70`) quedan cubiertos sin tocarlos, y los dos ya corren
bajo `lockBusiness`. La pagina de locales (`locations/page.tsx:30`) usa la misma funcion.

**[R2] `limitReached` (`shared.ts:84-92`) gana un mensaje para el caso de baja programada.** Hoy
dice «Tu plan permite 1 local activo. **Mejora tu plan** para abrir otro», que con una baja
programada es falso (el plan vigente permite 3) y manda al owner a la accion contraria. Pasa a
«Tu suscripcion baja a Free: no puedes reactivar locales. Reanuda tu plan si querias seguir en
Plus.»

### D3. Modelo de datos — migracion aditiva `0030`

En `core.subscription`:

| Columna | Tipo | Quien la escribe | Para que |
|---|---|---|---|
| `pending_plan` | `text` null | **el webhook** (del estado de Stripe) | «el tope tiene que caer». `NULL` = sin baja programada. Hoy solo toma `'free'`. |
| `pending_plan_at` | `timestamptz` null | el webhook / `cancel` con la respuesta de Stripe | cuando se aplica; es lo que la UI muestra. |
| `downgrade_requested_at` | `timestamptz` null | **SOLO nuestras rutas** (`cancel` lo pone; `resume` y `settle-free` lo limpian) | «esta baja la pedimos NOSOTROS». Discriminante de D5.d. El webhook **nunca** lo escribe. |
| `last_event_at` | `timestamptz` null | el webhook | `created` del ultimo evento **aplicado** (guard de orden, D5.h). |

**[R2-1] Por que existe `downgrade_requested_at`, y por que la version anterior estaba mal.** Esa
version afirmaba: «`pending_plan` es justo el registro de "esto lo pedimos nosotros", asi que
sirve como discriminante — y no hace falta ninguna columna nueva». **Es falso, y lo demuestra la
propia spec dos secciones mas abajo:** la jerarquia de D5.f escribe `pending_plan='free'` en
**todo** evento con `cancel_at_period_end === true` o `cancel_at !== null`, sin mirar quien
origino la baja — y eso es exactamente lo que setea el boton «Cancel subscription → at end of
billing period» del **dashboard de Stripe**. Secuencia que rompia el invariante central, con 3
locales activos:

1. el owner cancela **desde el dashboard**, sin archivar nada;
2. llega `updated` → `pending_plan='free'` (el tope cae a 1: correcto hasta aca);
3. fin de periodo → `deleted` → la regla vieja leia `pending_plan==='free'`, lo clasificaba
   **«esperado»** y escribia **`plan='free'` con 3 locales activos**.

El discriminante era **falsificable por el actor del que habia que defenderse**. Tiene que ser un
dato que **solo escriba nuestro codigo**; de ahi la columna. La separacion queda explicita:
`pending_plan` = «el tope debe caer» (lo dice Stripe), `downgrade_requested_at` = «nosotros lo
pedimos» (lo decimos nosotros).

**Y un `uniqueIndex` sobre `business_id`, llamado `core_subscription_business_unique`**
(**[R2-M1]**: el DoD lo verifica por SQL, asi que el nombre se fija aca). Hoy no existe: los
unicos son sobre `stripe_customer_id` y `stripe_subscription_id` (`schema/business.ts:234-238`),
y **todos** los lectores usan `.limit(1)` **sin `orderBy`** (`shared.ts:75-81`,
`backoffice/page.tsx:13-17`, `locations/page.tsx:15-22`): con dos filas, cual gana es indefinido
— y desde esta spec eso significa «el tope efectivo es indefinido». Verificado seguro: 0
duplicados.

En `core.stripe_webhook_event`: **`ignored_reason text` null** — por que un evento se marco
procesado sin efecto. Hoy un `invoice.paid` ignorado y un evento aplicado quedan
**indistinguibles**, y en prod ya llegaron de los dos tipos.

**No** se agrega `cancel_at_period_end` (segunda fuente de verdad de `pending_plan IS NOT NULL`).
**No** hace falta cambio de constraint para `plan='none'`: verificado que `core.subscription` no
tiene **ningun CHECK** sobre `plan` ni `status` (solo PK, la FK a `core.business` y 6 `NOT NULL`).

**Rollback (**[R2-M2]**):** `drizzle-kit` no genera `down`. La vuelta atras es SQL manual —
`DROP INDEX core.core_subscription_business_unique;`, `ALTER TABLE core.subscription DROP COLUMN
…` (×4), `ALTER TABLE core.stripe_webhook_event DROP COLUMN ignored_reason;`. Se acepta por
escrito: las 5 columnas son nullable y ningun lector hace `select()` sin lista de columnas, asi
que **el esquema nuevo es compatible con el codigo viejo** — que es lo que hace seguro el orden
de despliegue de §Handoff.

### D4. La decision de si un cambio de plan procede es una funcion PURA

`server/billing/plan-change.ts`. **[R2, los dos revisores por separado]** La version anterior
tenia `target: "plus" | "free"`, con lo cual **no podia expresar un cambio de intervalo** aunque
la misma seccion exigiera tres codigos de intervalo; y su tabla de 8 filas **no declaraba orden
de evaluacion**, con al menos cuatro entradas que matcheaban dos filas (incluida `none` + target
`free`, que matcheaba `no_subscription` **y** `settle_to_free` — o sea que la salida que D10
agrega para que `none` no sea un callejon era, leida literal, un 409). Con eso la matriz del plan
de pruebas se escribia adivinando, y el test habria pinneado lo que el implementador decidio.

El arreglo es estructural: la entrada lleva un **intent discriminado**, asi que cada movimiento
tiene sus propias guardas ordenadas y no hay solapamiento entre movimientos.

```ts
export type PlanIntent =
  | { kind: "upgrade"; interval: "month" | "year" } // free → plus, por Checkout
  | { kind: "downgrade" }                           // plus → free (cancelar) | none → free
  | { kind: "resume" }                              // deshacer una baja programada
  | { kind: "change_interval"; to: "month" | "year" };

export type PlanChangeInput = {
  currentPlan: string;              // 'free' | 'plus' | 'none' | cualquier otro
  currentInterval: string | null;   // en prod hay `plus` con NULL — [R2]
  pendingPlan: string | null;
  status: string;                   // el status CRUDO de Stripe (D5.e)
  stripeSubscriptionId: string | null;
  activeLocations: number;
  intent: PlanIntent;
};

export type PlanChangeDecision =
  | { kind: "checkout"; interval: "month" | "year" }
  | { kind: "schedule_downgrade" }  // hay suscripcion: se cancela al fin del periodo
  | { kind: "settle_to_free" }      // no hay suscripcion: se escribe `free` local (D10)
  | { kind: "resume" }
  | { kind: "change_interval"; to: "year" }
  | { kind: "blocked"; code: BlockCode; message: string; archiveCount?: number };
```

**Suscripcion viva — allow-list de estados MUERTOS, no de vivos:**

```ts
const DEAD_STRIPE_STATUS = new Set(["canceled", "incomplete_expired"]);
const hasLiveSubscription =
  input.stripeSubscriptionId !== null && !DEAD_STRIPE_STATUS.has(input.status);
```

**[R2-2] La polaridad importa y la version anterior la tenia al reves.** `Subscription.Status`
**no** tiene ocho valores: la linea que la propia spec citaba termina en **`| OtherString`**
(`Subscriptions.d.ts:473`, verificado — el tipo es abierto a proposito), y el endpoint esta
pineado seis años atras. Con una allow-list **positiva de vivos**, un status desconocido cae en
«no vivo» → `checkout` procede → **segunda suscripcion viva → doble cobro**, que es el daño que
este guard existe para prevenir. Con la lista **muerta**, lo desconocido se trata como vivo, que
es el default seguro para *este* guard. (Al reves en `planFromSubscription`, D5.d: ahi la
allow-list **positiva** es la correcta, porque lo desconocido no debe otorgar `plus`. Dos guards,
dos polaridades, cada una con su default seguro.)

**Guardas, en ORDEN. Primer match gana. Es normativo.**

`intent: "upgrade"`:
1. `hasLiveSubscription` → `blocked: subscription_live`. Si ademas hay baja programada, el camino
   correcto es `resume` y el mensaje lo dice.
2. `currentPlan === 'plus'` → `blocked: already_on_plan`.
3. en otro caso → `{ kind: "checkout", interval }`. **Cubre los 9 `free` de prod**
   (`status='active'`, sin id → no hay suscripcion viva → procede).

`intent: "downgrade"`:
1. `activeLocations > locationLimitForPlan("free")` → `blocked: downgrade_blocked` con
   `archiveCount = activeLocations - locationLimitForPlan("free")`. **Va PRIMERO**: es la
   condicion del owner y la que alimenta el modal. (El `1` no se hardcodea: el tope vive en un
   solo lugar.)
2. `currentPlan === 'free'` → `blocked: already_on_plan`.
3. `hasLiveSubscription` → `{ kind: "schedule_downgrade" }`.
4. en otro caso (`none`, o `plus` sin id como A1) → `{ kind: "settle_to_free" }`. **Aca muere el
   codigo `no_subscription`** de la version anterior, que era la fila que contradecia a D10: el
   estado «plan pago sin suscripcion» tiene ahora una salida real, lo que ademas resuelve el caso
   de A1 **sin** depender de que el owner lo arregle a mano.

`intent: "resume"`:
1. `pendingPlan === null` → `blocked: nothing_to_resume`.
2. `!hasLiveSubscription` → `blocked: subscription_dead` (el camino es `upgrade`).
3. en otro caso → `{ kind: "resume" }`.

`intent: "change_interval"`:
1. `to === "month"` → `blocked: interval_downgrade_unsupported` (D9, tarea 55).
2. `!hasLiveSubscription` → `blocked: interval_needs_subscription`.
3. `currentInterval === to` → `blocked: interval_unchanged`.
4. en otro caso (incluye `currentInterval === null`, el caso de A1) →
   `{ kind: "change_interval", to: "year" }`. Se permite con intervalo desconocido porque el real
   lo sabe Stripe y el `retrieve` de D9 lo confirma.

Todos los `BlockCode` responden **409**, salvo el `payment_failed` de D9 (402) y los de
configuracion (503).

### D5. Webhook: allow-list de eventos, el estado leido de Stripe

**El cambio de fondo, y lo forzo una consulta a prod.** La primera version derivaba todo del
payload y afirmaba —«verificado empiricamente»— que el periodo se leia de
`items.data[0].current_period_end`, citando los `.d.ts` de `stripe@22.5.0` (API
`2026-07-29.dahlia`). La cita es correcta **sobre los tipos**: `Subscription` no tiene
`current_period_end` (tiene `cancel_at`, `cancel_at_period_end`, `canceled_at` —
`Subscriptions.d.ts:127-138`) y ese campo vive en `SubscriptionItem`
(`SubscriptionItems.d.ts:54`).

**Pero la forma del payload ENTRANTE no la fija el SDK: la fija la API version pineada en el
endpoint.** En prod es `2020-08-27`, **anterior** a `2025-03-31.basil`, la version en la que el
campo se movio a los items. En los payloads que realmente llegan,
`subscription.current_period_end` **existe** y `items.data[0].current_period_end` es
**`undefined`** — con `typecheck` en verde. Es el ADR 0054 cometido por esta spec: se verifico el
**tipo** y se escribio una conclusion sobre el **payload**.

Por eso **el payload es un disparador, no una fuente de datos**: se usa
`stripe.<recurso>.retrieve(...)`, cuya respuesta viene en la API version del **SDK** (verificado:
`getStripeClient` no pinnea `apiVersion` — `stripe-config.ts:41` — y el SDK usa su default,
`cjs/stripe.core.js:177` + `cjs/apiVersion.js:5` = `2026-07-29.dahlia`), asi que esta
correctamente tipada.

**(a) Allow-list de tipos de evento. [R2-3/R2-4]** La version anterior decia «quedarse **solo con
dos datos del payload**: `event.type` y `event.data.object.id`» y despues
`subscriptions.retrieve(id)`. **En prod llega `invoice.paid`, cuyo `id` es un `in_…`**: ese
`retrieve` tira `resource_missing`, y como el claim iba despues, **no quedaba ninguna fila** →
Stripe reintenta → mismo error → hasta que desactiva el endpoint. Es el loop que la propia spec
declaraba inaceptable, disparado por un evento que ya esta en la base. Y
`checkout.session.completed` tiene un `cs_…`, no un `sub_…`.

| `event.type` | Que se recupera | Efecto |
|---|---|---|
| `customer.subscription.created` / `.updated` / `.deleted` | `subscriptions.retrieve(event.data.object.id)` | aplica (c)-(f) |
| `checkout.session.completed` | `checkout.sessions.retrieve(id, { expand: ["subscription"] })` | **solo bindea ids**: `businessId` de `client_reference_id`, y escribe `stripe_customer_id` / `stripe_subscription_id`. **No** toca el plan (una sesion puede completarse con `payment_status: 'unpaid'`). |
| cualquier otro | nada | claim + `processed_at` + `ignored_reason='event_type_not_handled'` |

Campos del payload que se leen, enumerados: `type`, `id`, `created` — y nada mas. (El DoD
anterior decia «ninguno mas que `type` e `id`», y era **inalcanzable con el propio diseño de la
spec**, porque el guard de orden necesita `created`.)

**(b) Orden de operaciones y de locks.**

1. Verificar la firma (`constructEvent`). Si falla: **400 sin fila** — no sabemos si el request
   era de Stripe.
2. **Claim, en su propia transaccion corta** (g). Sin fila → `200 {duplicate:true}` y `return`
   **inmediato**. **[R1-M1]** Un `ON CONFLICT DO UPDATE` que **falla** el filtro deja la fila del
   evento **lockeada hasta el commit** (un revisor lo ejecuto: una tercera sesion con
   `SELECT … FOR UPDATE` queda esperando en `Lock/transactionid`), asi que nada lento puede
   quedar despues del claim dentro de esa transaccion.
3. Tipo fuera de la allow-list → `processed_at` + `ignored_reason`, 200.
4. **`retrieve` — fuera de toda transaccion.** Si falla: 500 sin marcar procesado. **[R2-I12]**
   Como el claim ya ocurrio, queda **fila con `processed_at IS NULL`**, que es la señal de
   diagnostico; el reintento de Stripe la vuelve a tomar.
5. Segunda transaccion: resolver `businessId` (c) → **`lockBusiness`** → guard de orden (h) →
   escribir (d-f) → `processed_at`. **En ese orden de locks** (evento, negocio), fijado por
   convencion para que ningun camino futuro los tome al revés.

**[R2-B4] `lockBusiness` en el webhook es necesario, pero NO por el motivo que decia la version
anterior.** Decia que era para que un desarchivado concurrente no se pasara del tope; es falso:
el lock **serializa, no ordena**, asi que si el desarchivado gana el lock primero es una
operacion **valida** (3 ≤ 3) y el sobre-tope resultante es justo lo que D1 declara tolerado. El
motivo real es la **consistencia del read-modify-write de `core.subscription`** frente a `cancel`
/ `resume` / `settle-free`, que si toman `lockBusiness`: sin el, dos escrituras concurrentes se
pisan y se puede perder un `downgrade_requested_at`. El DoD y la mutacion M4 se corrigieron para
pinnear **eso**.

**(c) Resolucion del `businessId`, en orden.** La version anterior argumentaba —con razon— que el
`interval` no puede salir de la metadata «porque no existe si la suscripcion se creo desde el
dashboard», y dejaba el **`businessId`** saliendo de esa misma metadata (`webhook/route.ts:50`),
donde un `if (businessId)` falso hace que el evento **no haga nada en silencio**.

1. `subscription.metadata.businessId`;
2. `stripe_customer_id` → `WHERE stripe_customer_id = subscription.customer` (indice unico,
   resuelve sin ambiguedad);
3. ninguna resuelve → no se escribe nada, `processed_at` + `ignored_reason='unknown_business'`.

**(d) Derivacion del plan — allow-list positiva, condicionada al plan vigente.**

```
plan = 'plus'   si  algun item.price.id ∈ {monthlyPriceId, yearlyPriceId}
                 Y  status ∈ {active, trialing}
                 Y  pause_collection === null

plan = 'free'   si  (status ∈ {canceled, incomplete_expired} o type === 'deleted')
                 Y  ( downgrade_requested_at IS NOT NULL      // la baja la pedimos NOSOTROS
                      o currentPlan NO es un plan pago )       // [R2-7]

plan = 'none'   si  (status ∈ {canceled, incomplete_expired} o type === 'deleted')
                 Y  downgrade_requested_at IS NULL
                 Y  currentPlan ES un plan pago

status 'past_due' | 'incomplete' | 'unpaid' | 'paused'  →  el plan NO se toca
price desconocido / status desconocido                  →  el plan NO se toca + ignored_reason
```

**[R2-7] La condicion «`currentPlan` NO es un plan pago» evita convertir en `none` a un negocio
`free` que nunca tuvo nada.** Sin ella: uno de los 9 `free` aprieta «Mejorar a Plus», la tarjeta
se rechaza, la suscripcion queda `incomplete`, a las 23 h pasa a `incomplete_expired` («This is a
terminal status», `Subscriptions.d.ts:252`) y **el negocio quedaba `plan='none'` por haber
intentado pagar** — con el texto «Tu suscripcion termino. No estas en ningun plan.» y, en cuanto
aterrice la tarea 54, **bloqueado**. Contradecia el ADR 0058 §12 (el negocio estaba en `free`,
que **si** es una de las suscripciones que existen) y golpeaba el caso de uso central de la spec.

`unpaid` y `paused` **no** bajan el plan (ADR 0059): el impago bloquea el acceso, no degrada — es
lo que mantiene el invariante de locales sin tolerar sobre-tope. `pause_collection !== null`
igual impide **subir** a `plus`, porque **no cambia el `status`** («the subscription status will
be unchanged and will not be updated to `paused`», `Subscriptions.d.ts:220-223`).

El `interval` sale del **price que matcheo** — y el `price` de un `SubscriptionItem` es un objeto,
no un string (`SubscriptionItems.d.ts:90`), asi que no hace falta ninguna llamada extra.

**(e) `status`: se guarda el valor CRUDO de Stripe. [R2-I3]** Hoy la ruta colapsa
`active|trialing → 'active'` y deja el resto crudo (`webhook/route.ts:52-55`). Eso se **elimina**:
con el colapso, `'trialing'` dentro de las allow-lists de D4/D5 seria codigo muerto y la matriz
del unit describiria un dominio que la DB nunca contiene. La traduccion a texto humano vive en la
allow-list de presentacion (D7), no en la columna.

**(f) `pending_plan` / `pending_plan_at` — jerarquia, en este orden.**

```
si plan derivado ∈ {'free','none'}  →  pending_plan = NULL, pending_plan_at = NULL,
                                        downgrade_requested_at = NULL          (incondicional)
si no, si cancel_at !== null o cancel_at_period_end === true
                                    →  pending_plan = 'free'
                                       pending_plan_at = cancel_at
                                                      ?? items?.data?.[0]?.current_period_end
                                                      ?? null
si no                               →  pending_plan = NULL, pending_plan_at = NULL
```

La primera rama es incondicional **porque en un `deleted` `cancel_at_period_end` sigue en
`true`**: lo dice el propio campo — «Whether this subscription **will** (if `status=active`) or
**did** (if `status=canceled`) cancel at the end of the current billing period»
(`Subscriptions.d.ts:132`, verificado). Sin la jerarquia la fila quedaba `plan='free'` **y**
`pending_plan='free'`, con la UI diciendo «tu plan baja a Free el …» estando **ya** en free y un
boton *Reanudar* sobre una suscripcion muerta.

`cancel_at` entra en la condicion porque es **independiente** de `cancel_at_period_end` («A date
in the future at which the subscription will automatically get canceled»,
`Subscriptions.d.ts:129`) y se puede setear desde el dashboard.

El acceso al periodo es **defensivo**: `items` es un `ApiList` con `has_more`
(`Subscriptions.d.ts:195`, `lib.d.ts:181-192`), viene truncado a 10 y sin orden contractual;
`items.data[0]` pelado con la lista vacia tira `TypeError` **dentro** de la transaccion →
rollback → reintento → mismo `TypeError`. «No se pudo determinar la fecha» es un caso **valido**:
`pending_plan` puesto, `pending_plan_at` en `NULL`, y la UI lo dice sin fecha (D7).

**Las dos fechas son unix seconds** → `new Date(x * 1000)` contra una columna `timestamptz`. Sin
el `* 1000` la fecha cae en 1970 y el bug es visual, no de tipos.

**(g) El claim.**

```sql
INSERT INTO core.stripe_webhook_event (event_id, event_type, payload_version)
VALUES ($1, $2, $3)
ON CONFLICT (event_id) DO UPDATE SET received_at = now()
WHERE core.stripe_webhook_event.processed_at IS NULL
RETURNING event_id;
```

> **Premisa verificada por dos vias independientes.** El `EXPLAIN` real da
> `Conflict Filter: (stripe_webhook_event.processed_at IS NULL)` — **no** `InitPlan` ni
> `One-Time Filter`: es el nodo que se evalua sobre la fila **ya lockeada**, en su version mas
> nueva, que es la distincion del ADR 0054. Un revisor lo corrio contra prod y otro en Postgres
> 17.11 con cuatro carreras ejecutadas (evento nuevo, fila preexistente sin procesar, reproceso
> tras `ROLLBACK`, y filtro que no matchea → `INSERT 0 0` sin error). **El DoD lo exige de nuevo
> sobre Neon**: la evidencia es del motor, no del transporte.
>
> **La ortografia es load-bearing, demostrado mutandola:** con `WHERE excluded.processed_at IS
> NULL` —el error natural, porque `excluded` es la fila *propuesta* y ahi `processed_at` siempre
> es `NULL`— el claim sobre una fila **ya procesada** devuelve **1 fila: la otorga**. El guard se
> vuelve un no-op con el statement visualmente idéntico. Es la mutacion M7.

Expresable en el ORM instalado: `drizzle-orm@0.45.2` tiene
`onConflictDoUpdate({ target, set, setWhere })` (`pg-core/query-builders/insert.d.ts:63-66`); la
referencia calificada se escribe con `sql\`…\``.

**(h) Guard de orden.** Con el `retrieve` el desorden ya no puede escribir un estado viejo, pero
siguen haciendo falta dos reglas de **pertenencia**:

1. se ignora todo evento cuyo `subscription.id` **≠** `stripe_subscription_id` de la fila,
   **salvo** que la fila no tenga uno o su status este en `DEAD_STRIPE_STATUS` — solo ahi una
   suscripcion nueva puede adoptar la fila. **[R1-I8]** La v1 decia lo contrario («solo un id
   distinto puede volver a mover el plan»), que leida literal deja que un `deleted` tardio de
   `sub_1` ponga `free` sobre `sub_2` **viva y facturando**;
2. se ignora todo evento con `event.created` **menor** que `last_event_at`.

**[R2-M3]** Un evento **ignorado** (por tipo, pertenencia u orden) **no mueve `last_event_at`**:
si lo moviera, el guard (2) podria tapar un evento legitimo posterior con `created` menor.

### D6. Rutas

Bajo `app/api/billing/`, con `_auth.ts` calcado de `app/api/locations/_auth.ts` (reusa
`ownerContext`, que filtra `role='owner'` **y** `status='active'` — `staff.ts:38-55`) y un
`BillingError` calcado de `LocationError` (status + `code` estable + mensaje).

**El `businessId` no viene del body.** Hoy `checkout` lo toma del body y verifica membresia sobre
*ese* negocio (`checkout/route.ts:20-42`). La propiedad que `locations-routes.test.ts:165-186` ya
pinnea para locales — *«acts on the CALLER's business, never on one named by the request»* —
tiene que valer aca. Lo que hace **seguro** usar `ownerContext` (que devuelve el negocio mas
viejo, `staff.ts:33`) es que el onboarding rechaza un segundo negocio por usuario
(`api/onboarding/business/route.ts:89-99`, 409) — **[R2-M6]**: ese razonamiento no estaba escrito
y es el que sostiene el cambio.

**Contrato HTTP (**[R2-I5]**).** Exito: `{ subscription: SubscriptionView, activeLocations, canCancel }`
(salvo `checkout`, que devuelve `{ url }`). Fallo: `{ error, code, archiveCount? }`.

| Ruta | Body | Exito | Errores |
|---|---|---|---|
| `POST /api/billing/checkout` | `{ interval, from?: "onboarding"\|"subscription" }` | `200 { url }` | 401/403, 409 `already_on_plan`\|`subscription_live`\|`checkout_session_stale`, 503 `origin_not_configured`\|Stripe |
| `POST /api/billing/cancel` | `{}` | 200 | 401/403, 409 `downgrade_blocked` (con `archiveCount`)\|`already_on_plan`, 503 |
| `POST /api/billing/resume` | `{}` | 200 | 401/403, 409 `nothing_to_resume`\|`subscription_dead`, 503 |
| `POST /api/billing/interval` | `{ to }` | 200 | 401/403, 409 `interval_*`, **402 `payment_failed`**, 503 |
| `POST /api/billing/settle-free` | `{}` | 200 | 401/403, 409 `downgrade_blocked`\|`already_on_plan`, 503 |

**`idempotencyKey` — receta exacta (**[R1-Derivado-2 / R2-I9]**).** La version anterior escribia
`{ idempotencyKey: … }` con puntos suspensivos **tres veces**, y el patron del repo es una clave
**fija para siempre** (`checkout:${businessId}:${interval}`, `checkout/route.ts:75`) que esta
misma spec denuncia. Con una clave fija, `cancel → resume → cancel` dentro de 24 h hace que
Stripe **devuelva la respuesta cacheada sin aplicar nada**: la suscripcion queda sin
`cancel_at_period_end` mientras la DB dice `pending_plan='free'` → tope en 1, la baja nunca
ocurre, y la UI promete algo que no existe.

| Operacion | `idempotencyKey` |
|---|---|
| `cancel` | `billing:cancel:${subscriptionId}:${downgradeRequestedAt.toISOString()}` — cambia en cada pedido nuevo y **se repite** si el owner reintenta el mismo, que es el camino de reparacion |
| `resume` | `billing:resume:${subscriptionId}:${pendingPlanAt ?? "none"}` |
| `interval` | `billing:interval:${subscriptionId}:${to}:${currentPeriodEnd}` |
| `checkout` | **se conserva** `checkout:${businessId}:${interval}` (cambiarla permite varias sesiones abiertas). Con los `*_url` estables el `idempotency_error` desaparece, y antes de redirigir se verifica que la sesion este **abierta** (`status === "open"` y `url !== null`); si no, 409 `checkout_session_stale` |

**El origen de los `*_url` sale de una env canonica, no de `new URL(request.url).origin`**
(**[R2-I10]**). Nombre: **`MERCHANT_PUBLIC_ORIGIN`** (verificado que no hay ninguna env de origen
publico en el arbol: solo `BETTER_AUTH_URL` y `BETTER_AUTH_TRUSTED_ORIGINS`). **Si falta, 503
`origin_not_configured`** — un fallback silencioso al `request.url` devuelve el bug por la puerta
de atras. Hay que setearla en Vercel **antes** de pushear (§Handoff).

`success_url` = `${MERCHANT_PUBLIC_ORIGIN}/backoffice/subscription?checkout=success` con
`from === "subscription"`, y `${MERCHANT_PUBLIC_ORIGIN}/backoffice?checkout=success` con
`from === "onboarding"` (**[R2-I8]**: sin esto, el que paga en el onboarding aterriza en una
pantalla que no pidio — un cambio de UX del alta que ninguna decision del owner respalda).

**Orden de operaciones de `cancel`** (importa, y es lo contrario del reflejo natural):

1. `withDbTransaction` → `lockBusiness` → leer suscripcion + `activeLocationCount` →
   `decidePlanChange`. Si bloquea: 409 y nada mas.
2. **En la misma transaccion**, escribir `pending_plan='free'` **y
   `downgrade_requested_at=now()`**. Commit.
3. Recien ahora, **fuera del lock**, `subscriptions.update(id, { cancel_at_period_end: true },
   { idempotencyKey })`.
4. Con la respuesta, escribir `pending_plan_at` (de `cancel_at`) en una transaccion corta.

Escribir la intencion primero deja el tope efectivo en 1 **en el mismo commit que verifico el
conteo**, asi que no hay ventana para desarchivar entre la verificacion y la baja; y la llamada
de red no ocurre con el lock tomado (la regla que ya documenta `shared.ts:38-48`).

**Si el paso 3 falla, NO se revierte** (**[R1-B3]**). Un timeout o un 502 no distinguen «Stripe
no lo recibio» de «lo aplico y la respuesta se perdio»; en el segundo caso el revert deja Stripe
con la baja y la DB sin ella → tope de vuelta en 3 → `free` con 3 activos. Se devuelve 503 «no
pudimos confirmarlo, volve a intentar» y el estado **queda puesto** (capado en 1, conservador).
**Solo** se revierte ante un error determinista que pruebe que no se aplico
(`StripeInvalidRequestError` / 4xx `invalid_request_error`), nunca ante `StripeConnectionError`
ni timeout. Los dos son construibles en test: `constructor(raw?: StripeRawError)` y expuestos
como `Stripe.errors.*` (`cjs/Error.d.ts:104`, `:143`, `stripe.core.d.ts:134`).

**`cancel` es idempotente y es el camino de reparacion:** si ya hay baja programada, vuelve a
afirmar contra Stripe con la **misma** clave y devuelve 200.

`resume` es el espejo con el orden **inverso** (primero Stripe, despues limpiar `pending_plan` y
`downgrade_requested_at`), porque ahi el estado conservador es «seguir capado». **Su politica de
error es la misma que la de `cancel`** (**[R1-B6]**: la v1 solo especificaba la de `cancel`).

### D7. UI

`app/backoffice/subscription/page.tsx` (server, `requireOwner()`) + `subscription-console.tsx` +
`cancel-dialog.tsx` (patron de `locations-console.tsx`: `ModuleHeader`, `Toast`).

| Estado | Se ve |
|---|---|
| `free` | «Free · 1 local» como actual; «Plus · 3 locales» con selector mensual/anual y **Mejorar a Plus**. |
| `plus`/`none` con 1 local activo | Boton de bajar a Free con **«Confirmar»** habilitado. |
| `plus`/`none` con N>1 activos | **El boton NO se deshabilita** (ADR 0058 §8): se aprieta y el modal dice **que hay que hacer** — «Para volver a Free necesitas 1 local activo; hoy tenes N. Archiva N-1» + link a `/backoffice/locations` — y **«Confirmar» no esta disponible**. El 409 del servidor es el que manda. |
| `plus` **mensual** vivo | **«Pasar a anual»**, con el efecto en el propio boton: «se cobra ahora la diferencia, con credito por los dias no usados». |
| `plus` **anual** vivo | **No se ofrece** cambio de intervalo. |
| `plus` con `interval` **nulo** | Se ofrece «Pasar a anual» (el intervalo real lo confirma Stripe en D9). Es el caso de A1. |
| baja programada **con fecha** | «Tu plan baja a Free el {fecha}» + **Reanudar suscripcion**. |
| baja programada **sin fecha** | «Tu plan baja a Free al final del periodo actual» + Reanudar. Estado **garantizado** entre el 200 de `cancel` y el paso 4. |
| `plan = 'none'` | «Tu suscripcion termino. No estas en ningun plan.» + **Ajustarme y bajar a Free** (mismo modal) y **Volver a Plus**. |
| `status` ∈ {past_due, unpaid} | Se avisa que hay un cobro pendiente y **no** se ofrece cambio de plan ni de intervalo. El acceso **no** se bloquea en esta spec (tarea 54). |
| otro `status` | Se traduce por **allow-list** (patron de `app/login/login-notice.ts`), nunca el string crudo al DOM. |

**DTO.** `toSubscriptionView(row)` es una **allow-list positiva** —
`{ plan, status, interval, pendingPlan, pendingPlanAt }` y nada mas — con un test que asevera el
**conjunto exacto** de claves. Nunca `stripe_customer_id`, `stripe_subscription_id` ni
`downgrade_requested_at`. `pendingPlanAt` viaja como **string ISO**, no `Date` (**[R2-M4]**: el
test de claves no lo caza y la consola lo formatea).

Lo que la UI necesita **ademas** llega como props separadas del server component, no metiendo
claves en el DTO: `activeLocations: number` y `canCancel: boolean` (de `decidePlanChange`).

**Entrada y home (**[R2-I4]**).** Tarjeta «Suscripcion» en el grid de `app/backoffice/page.tsx` +
`"subscription"` en `realModules`. **Y ese archivo gana la traduccion de los estados nuevos:**
hoy hace `Plan {plan === "plus" ? "Plus" : "Free"} · {status === "active" ? "activo" :
"confirmando pago"}` (`backoffice/page.tsx:62-63`), o sea que `none` se mostraria como **«Plan
Free»** — justo lo que D10 dice que `none` existe para no hacer — y un `free` con
`status='canceled'` diria **«confirmando pago»** para siempre. La allow-list de presentacion vive
en **un modulo compartido** (`billing/view.ts`) que usan la home y la seccion.

### D8. Reconciliacion con Stripe al abrir la pagina

`subscription_live` (D4) es la pieza que evita facturar dos veces, y se calcula sobre **nuestra**
DB, cuyo unico escritor es el webhook. Si el webhook se perdio un evento, la DB queda divergente
sin forma de detectarlo: con `plan='free'` y `stripe_subscription_id=NULL`, `checkout` procede y
crea una **segunda suscripcion viva** → doble cobro.

**[R2-6] La version anterior era un no-op justamente en su caso motivador.** Decia «si la fila
tiene `stripe_customer_id`, `subscriptions.list({ customer, limit: 3 })`» — y el **unico**
escritor de `stripe_customer_id` en todo el repo es el webhook (verificado por grep:
`webhook/route.ts:63`, mas el schema). Si el evento se perdio, **el customer id tambien**, asi
que el `if` nunca entraba; verificado en prod que los 9 `free` lo tienen `NULL`. Ademas `list`
**sin `status` no devuelve las canceladas** — «*If no value is supplied, all subscriptions that
have not been canceled are returned*» (`Subscriptions.d.ts:2661`) — o sea que era ciego a la
mitad de la deriva.

Tres cambios:

1. **El `stripe_customer_id` se persiste en el momento del checkout**, no cuando llega un evento:
   la ruta crea (o reusa) el customer explicitamente —
   `customers.create({ metadata: { businessId } })` — y lo escribe en la fila **antes** de
   redirigir. Asi D8 siempre tiene por donde entrar, y de paso el checkout deja de crear un
   customer nuevo por intento (**[R1-N2]**).
2. **`subscriptions.list({ customer, status: "all", limit: 10 })`.**
3. **Algoritmo explicito** (`reconcileFromStripe`): se elige la suscripcion **no muerta mas
   reciente**; si no hay ninguna no muerta, la mas reciente. Con ella se aplica **la misma**
   derivacion de D5.d-f bajo `lockBusiness`, con el mismo guard de pertenencia. **Con la lista
   vacia no se escribe nada** y se muestra el aviso: vacio con `status:"all"` significa «este
   customer nunca tuvo suscripcion», que no alcanza para degradar un plan desde el render de una
   pagina.

Si Stripe no responde, la pagina renderiza con lo de la DB **y lo dice** («no pudimos confirmar
con Stripe»), sin bloquear la seccion.

**Lo que D8 NO cubre, declarado:** una fila atascada en `plus` cuyo customer id nunca se escribio
(residuo del bug del §Problema-3, si alguna vez hubo una). Para esas la unica salida es SQL
manual; hoy en prod no hay ninguna (los 2 `plus` estan verificados).

### D9. Cambio de intervalo: SOLO mensual → anual

Entra por el ADR 0058 §10, acotado por el owner el 2026-09-10 a **un solo sentido**. No cambia el
tope de locales, asi que no toca el invariante de D1.

**El dato de Stripe que decidio el recorte, verificado en la doc del propio SDK porque invierte
la intuicion:** `proration_behavior: 'none'` **no** significa «aplicalo al final del periodo»:

> «if you set `proration_behavior` to `none` when switching between different billing intervals
> (for example, from monthly to yearly), we don't generate any credits for the old subscription's
> unused time. **We still reset the billing date and bill immediately** for the new
> subscription.» — `cjs/resources/Subscriptions.d.ts:50`

O sea que `none` es la **peor** opcion: el cliente pierde lo que ya pago **y** se le cobra de
nuevo. «Al final del periodo» exige un `subscription_schedule`, superficie nueva de la API → el
sentido inverso es la **tarea 55**, y `decidePlanChange` lo rechaza con
`interval_downgrade_unsupported`.

**Orden de operaciones de `interval`** (**[R2-5]**: la v1 escribia `items: [{ id: itemId, … }]` y
`itemId` **no existia en ninguna parte del sistema** — ni columna, ni payload, ni body):

1. Gate + `decidePlanChange`. Si bloquea: 409.
2. **`subscriptions.retrieve(stripeSubscriptionId)`** — de aca sale el `itemId`. **No se
   persiste**: el item id puede cambiar y una copia nuestra seria una segunda fuente de verdad.
3. **Seleccion del item, explicita:** el unico item cuyo `price.id` esta en
   `{monthlyPriceId, yearlyPriceId}`. Si hay **0**, **mas de 1**, o `items.has_more === true` →
   **no se toca nada**, 409 `interval_ambiguous`. (La propia spec establecio en D5.f que `items`
   viene truncado y sin orden contractual: elegir `data[0]` para **escribir** un precio seria el
   mismo error que ahi se prohibe para leer.)
4. `subscriptions.update(id, { items: [{ id: itemId, price: yearlyPriceId }],
   proration_behavior: "always_invoice", payment_behavior: "error_if_incomplete" },
   { idempotencyKey })`. **`payment_behavior` es normativo:** el DoD afirma «cobra la diferencia
   en el acto», y con el default un cobro rechazado dejaria la factura abierta, la suscripcion
   hacia `past_due` **con el price anual ya aplicado** y el handler devolviendo 200 — la fila
   mintiendo. Con `error_if_incomplete` el `update` **falla** y no se aplica nada.
5. Si (4) tira `StripeCardError` → **402 `payment_failed`**, sin escribir nada.
6. **El `interval` de la fila lo escribe el WEBHOOK**, no la ruta, derivandolo del price que
   matcheo (D5.d). La ruta devuelve 200 y la UI re-lee. Asi no hay dos escritores del mismo campo
   y la fila nunca afirma un intervalo que Stripe no confirmo.

### D10. El estado «sin suscripcion» (`plan = 'none'`) y su salida

Del ADR 0058 §12: `free`, `plus` (y algun dia `enterprise`) **son suscripciones**; un `deleted`
inesperado no es ninguna, asi que el estado honesto es **`none`**.

- **Lo escribe** el webhook (D5.d) ante un `deleted` que el producto no pidio
  (`downgrade_requested_at IS NULL`) **sobre un plan pago**.
- **El tope es 1** (D2): sigue operando, no puede crear ni desarchivar.
- **Salida 1 — «Ajustarme y bajar a Free»** → `{ kind: "settle_to_free" }`, la unica operacion de
  plan que **no toca Stripe**. Su `SET` exacto (**[R2-5]**: la v1 solo decia «escribe
  `plan='free'`», y la eleccion natural rompia todo):

  ```
  plan = 'free', status = 'active', stripe_subscription_id = NULL, interval = NULL,
  pending_plan = NULL, pending_plan_at = NULL, downgrade_requested_at = NULL
  -- stripe_customer_id SE CONSERVA (es la llave de D8)
  ```

  **Por que el `SET` era load-bearing:** dejar `status='active'` (lo natural, porque en prod los
  11 negocios lo tienen) **con el `stripe_subscription_id` viejo sin limpiar** hace
  `hasLiveSubscription = true` → **`subscription_live` 409 para siempre**: el negocio no puede
  volver a Plus nunca. Y el guard de pertenencia de D5.h ignoraria el
  `customer.subscription.created` de la suscripcion nueva → el owner paga y se queda en `free`.
  Va bajo `lockBusiness`, con la **misma** condicion de locales y el mismo modal que el downgrade
  voluntario — es la **misma rama** de `decidePlanChange` (`intent: "downgrade"`), no una segunda
  regla que pueda divergir.
- **Salida 2 — «Volver a Plus»** → el `checkout` de siempre: con el id limpio,
  `hasLiveSubscription` es falso y no lo bloquea `subscription_live`.
- **Lo que NO entra:** el **bloqueo de acceso** de ese estado (tarea 54, ADR 0059). Hasta
  entonces `none` es un estado **visible y con salida**, pero sin bloqueo — mejor que el `free`
  silencioso de hoy, porque no miente sobre el plan.

### D11. Observabilidad, declarada

**[R2-I12]** Cuando alguien se queje de «pague y sigo en free», lo que se mira es
`core.subscription` y `core.stripe_webhook_event`. Con el orden de D5.b **el claim va antes del
`retrieve`**, asi que un `retrieve` fallido **deja fila** con `processed_at IS NULL`: se puede
distinguir «Stripe nunca entrego» (no hay fila) de «lo tomamos y fallo» (fila sin procesar) de
«lo ignoramos a proposito» (`ignored_reason`). Solo la **firma invalida** no deja rastro, y es
correcto: no sabemos si el request era de Stripe.

**Lo que NO se audita, y se acepta:** los cambios de plan hechos por las rutas no quedan
registrados mas alla de `subscription.updated_at`. No hay tabla de auditoria en `core` y crearla
para esto seria andamiaje sin su tarea. Si algun dia hace falta reconstruir la historia de un
plan, esta spec **no** la deja.

### Arquitectura de referencia

- **ADR 0058** (12 decisiones del owner) y **ADR 0059** (el impago bloquea el acceso).
- **ADR 0056** — **superado en su punto de checkout**: no restringio por rol porque «no existe
  una UI de upgrade posterior»; D6 crea exactamente eso. El resto de 0056 no se toca.
- **ADR 0054** — el guard de idempotencia vive en el `WHERE` de la fila que se actualiza y se
  **demuestra**. Y su version mas incomoda: esta spec lo violo dos veces sobre si misma (D5 y
  D3/[R2-1]).
- **ADR 0055** / `login-notice.ts` — traducir un motivo por allow-list.
- **spec 0061** — `PLAN_LOCATION_LIMITS`, `lockBusiness`, `activeLocationCount`.
- **spec 0062** — la integracion Neon corre en CI, asi que estos tests no se auto-skipean.

## Archivos

**[R2] El split esta decidido por adelantado**, porque el hook `file-size.sh` muerde a las 300
(`LIMIT=300`, `exit 2`) y decidir el corte a mitad de la tarea es la peor version. Referencias
medidas: `locations/core.ts`=207, `locations-console.tsx`=220, `locations-routes.test.ts`=293,
`schema/business.ts`=249, `locations.test.ts`=176.

| Archivo | Accion |
|---|---|
| `apps/merchant/src/server/schema/business.ts` | editar — 4 columnas + unique + `ignored_reason` (queda ~280: **si pasa 300, se parte en `schema/billing.ts`**) |
| `apps/merchant/drizzle/0030_*.sql` | crear — `drizzle-kit generate` |
| `apps/merchant/src/server/billing/plan-change.ts` | crear — tipos de D4 + `decidePlanChange` con las guardas ordenadas |
| `apps/merchant/src/server/billing/derive.ts` | crear — `planFromSubscription` + jerarquia de `pending_plan` + guard de pertenencia |
| `apps/merchant/src/server/billing/derive-rules.ts` | crear — **[fase A] NO estaba en esta tabla.** Los conjuntos y helpers puros de D5.d-f, sacados de `derive.ts` porque el contrato normativo de ese archivo ya ocupa ~200 lineas y el limite es 300 (`file-size`): dividir, no extender |
| `apps/merchant/src/server/billing/gateway.ts` | crear — **NO estaba en esta tabla.** La costura `StripeGateway` de §Archivos compartidos necesitaba un archivo; el orquestador la puso aca |
| `apps/merchant/src/server/billing/view.ts` | crear — `toSubscriptionView` + allow-list de presentacion (la usan la seccion **y** la home) |
| `apps/merchant/src/server/billing/store.ts` | crear — `readSubscription`, `scheduleDowngrade`, `clearPendingPlan`, `settleToFree`, `reconcileFromStripe` |
| `apps/merchant/src/server/billing/webhook.ts` | crear — allow-list de tipos, claim, locks, escritura |
| `apps/merchant/src/server/billing/index.ts` | crear — barrel |
| `apps/merchant/src/server/locations/core.ts` | editar — `effectiveLocationLimit` + `none: 1` |
| `apps/merchant/src/server/locations/shared.ts` | editar — `planLocationLimit` lee `pending_plan`; `limitReached` gana el mensaje de baja programada |
| `apps/merchant/src/server/locations/index.ts` | editar — export |
| `apps/merchant/src/app/api/billing/_auth.ts` | crear — gate + `BillingError` |
| `apps/merchant/src/app/api/billing/checkout/route.ts` | editar — gate, `from`, customer explicito, env de origen, sesion abierta |
| `apps/merchant/src/app/api/billing/cancel/route.ts` | crear |
| `apps/merchant/src/app/api/billing/resume/route.ts` | crear |
| `apps/merchant/src/app/api/billing/interval/route.ts` | crear |
| `apps/merchant/src/app/api/billing/settle-free/route.ts` | crear |
| `apps/merchant/src/app/api/stripe/webhook/route.ts` | editar — delega + `export const runtime = "nodejs"` |
| `apps/merchant/src/app/backoffice/subscription/page.tsx` | crear |
| `apps/merchant/src/app/backoffice/subscription/subscription-console.tsx` | crear |
| `apps/merchant/src/app/backoffice/subscription/cancel-dialog.tsx` | crear — el modal de condiciones |
| `apps/merchant/src/app/backoffice/page.tsx` | editar — tarjeta + `realModules` + presentacion de `none`/`canceled` |
| `apps/merchant/src/app/backoffice/locations/page.tsx` | editar — tope efectivo |
| `apps/merchant/src/app/onboarding/page.tsx` | editar — **[R2-I8]** saca el `businessId` del body y manda `from: "onboarding"` |
| `apps/merchant/src/server/locations-integration-support.ts` | editar — **[R2-I7]** el seed acepta el estado completo de la suscripcion |
| `apps/merchant/src/server/billing-integration-support.ts` | crear — **[R2-I7]** fake de Stripe, constructor de payload firmado, `readSubscriptionRow` por SQL |
| `apps/merchant/src/server/billing-plan-change.test.ts` | crear |
| `apps/merchant/src/server/billing-derive.test.ts` | crear |
| `apps/merchant/src/server/billing-derive-support.ts` | crear — **[fase A] NO estaba en esta tabla.** Constructores de `Stripe.Subscription` y de filas para los units; corte por el limite de 300 |
| `apps/merchant/src/server/billing-plan-change-rows.test.ts` | crear — **[fase A] NO estaba en esta tabla.** «Las filas que mataron una regla», separadas de la matriz por el limite de 300 |
| `apps/merchant/src/server/billing-applicability.test.ts` | crear — **[fase A] NO estaba en esta tabla, y NACE DE UN HALLAZGO REAL:** al correr **M15** por primera vez la suite entera quedaba VERDE — el guard de pertenencia de D5.h no tenia NINGUN oraculo. Con este archivo, M15 pone 8 rojos |
| `apps/merchant/src/server/billing-view.test.ts` | crear — allow-list exacta + render del HTML |
| `apps/merchant/src/server/billing-routes.test.ts` | crear — capa HTTP de las 5 rutas |
| `apps/merchant/src/server/locations.test.ts` | editar — extender con `effectiveLocationLimit` |
| `apps/merchant/src/server/locations-plan-cap.test.ts` | crear — **[fase A] NO estaba en esta tabla, y CIERRA EL BLOQUEANTE B1 de la 1a revision.** El oraculo de `limitReached` + `planLocationLimit`: sin el, anular la rama `pendingDowngrade` dejaba la suite en **620/620 VERDE** y el owner con una baja programada volvia a leer «Mejora tu plan». Va en un sibling y no dentro de `locations.test.ts` porque ese archivo esta en 233 lineas y el bloque ocupa ~90 (`file-size`, limite 300: dividir, no extender); `locations.test.ts` quedo con el puntero |
| `apps/merchant/src/server/billing.neon.integration.test.ts` | crear |
| `apps/merchant/src/server/billing-webhook.neon.integration.test.ts` | crear |
| `apps/merchant/src/server/locations-races.neon.integration.test.ts` | editar |

### Disjunta?

En el INDEX hay cuatro specs en `borrador`: 0003 (`app/**/campaigns/**`), 0007, 0009 y 0060
(portal del consumidor). Revisados los cuatro frontmatters: ninguna comparte archivo con esta.
**Disjunta: si.**

### Archivos compartidos

El orquestador los deja listos **antes de despachar**; los agentes solo consumen.

| Que | Detalle |
|---|---|
| `PlanIntent` + `PlanChangeInput` + `PlanChangeDecision` + `BlockCode` | tal cual D4, con la lista **ordenada** de guardas como comentario normativo |
| `planFromSubscription` | **[R2-I1]** firma y retorno explicitos: `(args: { event: { type: string; created: number }; subscription: Stripe.Subscription; row: SubscriptionRow; priceIds: { monthly: string; yearly: string } }) => SubscriptionWrite`, con `SubscriptionWrite = { plan?: string; interval?: string \| null; status: string; pendingPlan: string \| null; pendingPlanAt: Date \| null; clearDowngradeRequest: boolean; ignoredReason?: string }`. **`plan` ausente = «no tocar el plan»** — es el caso mas frecuente y necesita representacion explicita, no un `null` ambiguo |
| `SubscriptionView` + las props extra de D7 | conjunto exacto de claves; `pendingPlanAt` como string ISO |
| **La costura de Stripe** | **[R2-B7]** el parametro inyectado es `StripeGateway`, una interfaz **minima** propia (`{ subscriptions: Pick<Stripe["subscriptions"], "retrieve" \| "update" \| "list">; checkout: …; customers: … }`), **no** la clase `Stripe`: con la clase concreta todo fake necesita `as unknown as Stripe`, y ese cast apaga justamente el typecheck que se esta comprando. Firmas: `cancelSubscription(gw, …)`, `resumeSubscription(gw, …)`, `changeInterval(gw, …)`, `applySubscriptionEvent(gw, tx, …)`, `reconcileFromStripe(gw, …)`, `createCheckoutSession(gw, …)`. **Y como llega el fake a las dos superficies sin parametro:** la **ruta** del webhook (que necesita `constructEvent` para la firma) y la **pagina** de D8 se testean mockeando el modulo `server/stripe-config` con `vi.mock`, igual que `locations-routes.test.ts` mockea `ownerContext`. Queda dicho aca para que no se decida durante el codigo |

## Definition of Done

- [ ] Un negocio `free` llega a `plus` sin pasar por el onboarding, desde la tarjeta
      «Suscripcion».
- [ ] **Los 9 negocios `free` de prod pasan el gate de `checkout`** — ninguno recibe
      `subscription_live`.
- [ ] Un `plus` con 2+ activos que intenta cancelar recibe **409 `downgrade_blocked`** con
      `archiveCount` correcto, aunque el pedido venga por `curl`.
- [ ] Tras archivar hasta 1 activo, cancela y la fila queda `pending_plan='free'` **y
      `downgrade_requested_at` no nulo**.
- [ ] **Con la baja programada, desarchivar devuelve 409** aunque el plan vigente siga `plus`,
      **con el mensaje de baja programada** y no con «mejora tu plan». Verificado por SQL.
- [ ] **Una cancelacion hecha desde el dashboard de Stripe** (sin `downgrade_requested_at`)
      termina en **`plan='none'`**, no en `free` — **aunque Stripe haya seteado
      `cancel_at_period_end` y por lo tanto `pending_plan='free'`**. Es el bloqueante R2-1.
- [ ] Un `deleted` **con** `downgrade_requested_at` deja `plan='free'`, `pending_plan=NULL` y
      `downgrade_requested_at=NULL`: el owner que cancelo bien no termina en `none`.
- [ ] Un negocio **`free`** cuya primera factura expira (`incomplete_expired`) **sigue en
      `free`**, no pasa a `none`.
- [ ] `unpaid` / `paused`: **no** queda en `plus` por el price, **y tampoco baja el plan** (ADR
      0059) — el `status` se registra y el plan no se toca.
- [ ] Una suscripcion en `incomplete_expired` **no** bloquea un `checkout` nuevo.
- [ ] Un `status` **desconocido** (no de los 8) **bloquea** `checkout` (`subscription_live`) y
      **no** otorga `plus`.
- [ ] **`invoice.paid` y cualquier tipo fuera de la allow-list** quedan `processed_at` +
      `ignored_reason`, **sin** llamar a `subscriptions.retrieve`.
- [ ] Un evento cuyo `retrieve` falla deja **fila con `processed_at IS NULL`** y el reintento lo
      procesa.
- [ ] Dos entregas simultaneas del mismo evento: **una sola gana el claim** (observable abajo),
      con el `EXPLAIN` transcripto **corrido sobre Neon**.
- [ ] Un `cancel` concurrente con el webhook **no pierde** ninguna de las dos escrituras.
- [ ] **mensual → anual** cobra la diferencia en el acto y la fila queda `interval='year'`
      (escrito por el webhook). Con `items` ambiguo → 409 `interval_ambiguous` sin tocar nada.
      Con tarjeta rechazada → **402** y **nada aplicado**.
- [ ] **anual → mensual** → 409 `interval_downgrade_unsupported`.
- [ ] Desde `none` con 3 activos, bajar a Free → **409 `downgrade_blocked`** con el mismo
      `archiveCount` que el downgrade voluntario; con 1 activo escribe el `SET` completo de D10
      **sin** llamar a Stripe (cero llamadas al fake) y **despues** `checkout` procede.
- [ ] `cancel → resume → cancel` en la misma corrida: la segunda cancelacion **si** llega a
      Stripe (la `idempotencyKey` cambio).
- [ ] `checkout`, `cancel`, `resume`, `interval` y `settle-free` — **las cinco** — con sesion de
      **staff**: 403. La distincion activo/desactivado se pinnea en **integracion** (el unit con
      `ownerContext` mockeado no la puede ver).
- [ ] Ninguna ruta actua sobre un negocio nombrado en el body.
- [ ] Sin `MERCHANT_PUBLIC_ORIGIN`, `checkout` devuelve **503 `origin_not_configured`** (no cae
      al `request.url`).
- [ ] Ni las respuestas ni el **HTML** de `/backoffice/subscription` contienen
      `stripe_customer_id`, `stripe_subscription_id` ni `downgrade_requested_at`.
- [ ] La **home** muestra «Sin plan» para `none` y no dice «confirmando pago» para un `free` con
      `status='canceled'`.
- [ ] La `api_version` real del endpoint de Stripe queda **verificada y anotada** en el handoff,
      y el codigo no lee del payload ningun campo fuera de `type`, `id` y `created`.
- [ ] Migracion `0030` aplicada a prod **antes del push** (§Handoff) y verificada por SQL: 4
      columnas + `core_subscription_business_unique` + `ignored_reason`;
      `core`/`consumer`/`merchant_auth` intactos en cantidad de tablas.
- [ ] 5 gates verdes + integracion Neon **sin skips** (`pnpm test` reporta 0 skipped con las env
      puestas).

## Plan de pruebas y verificación

**Unit — `billing-plan-change.test.ts`:**

- [ ] `decidePlanChange` sobre la matriz: `currentPlan` ∈ {free, plus, none} × `currentInterval`
      ∈ {null, month, year} × `pendingPlan` ∈ {null, free} × `status` ∈ **los 8 conocidos + uno
      inventado (`"future_status"`)** × `stripeSubscriptionId` ∈ {null, "sub_x"} ×
      `activeLocations` ∈ {1, 2, 3} × los 4 `intent`, con el `kind`/`code` escrito **a mano**.
      **La lista ordenada de guardas de D4 es la fuente de verdad**: sin ella la matriz se
      escribiria adivinando.
- [ ] Filas explicitas, cada una porque mato una version anterior de la regla:
      `free/active/sin id/upgrade` → **`checkout`** (los 9 de prod);
      `plus/canceled/con id/upgrade` → **`already_on_plan`**;
      `plus/incomplete_expired/upgrade` → **`already_on_plan`**;
      `plus/"future_status"/con id/upgrade` → **`subscription_live`**; `none/downgrade` con 1
      activo → **`settle_to_free`**; `plus` sin id (A1)`/downgrade` con 1 activo →
      `settle_to_free`; `plus/interval null/change_interval year` → `change_interval`;
      `change_interval month` → `interval_downgrade_unsupported`.
- [ ] Precedencia declarada: `downgrade` con 2 activos **y** `currentPlan='free'` → gana
      `downgrade_blocked` (guarda 1 antes que la 2). Se asevera **el orden declarado**, no el
      intuitivo.

> **CORRECCION DEL ORQUESTADOR (2026-09-11), no una decision del owner — y el error es del mismo tipo que la
> tabla de mutaciones escrita de memoria.** Las dos filas de arriba decian `checkout` y **contradecian las
> guardas ordenadas de D4, que esta misma spec etiqueta «Es normativo»**: con `canceled` o
> `incomplete_expired` la guarda 1 NO dispara (no hay suscripcion viva), asi que gana la **guarda 2**
> (`currentPlan === 'plus'`) → **`already_on_plan`**. Eran filas **predichas en vez de derivadas** de la
> seccion normativa. Lo encontro el implementador de la fase A y lo dejo marcado como HALLAZGO en el nombre
> de dos tests, en vez de doblar el codigo para que coincidiera con el plan de pruebas — que es exactamente
> lo correcto. Manda la seccion normativa y se corrigen las filas.
>
> **DE QUE CUELGA ESTA CORRECCION, porque no es gratis** — *y la primera version de este parrafo lo atribuyo
> MAL; lo corrigio el revisor independiente de la fase A (hallazgo m2) y se verifico leyendo las guardas.*
> «Plan `plus` con la suscripcion muerta» solo es un estado transitorio si algo lo repara, y hay **DOS**
> mecanismos independientes, no uno:
>
> 1. la **reconciliacion de D8**, que lee el estado real de Stripe al abrir la pagina y reescribe la fila a
>    `none`/`free`, y ahi `checkout` si procede; y
> 2. **la salida de D10**, que NO depende de D8: sobre ese mismo estado, `intent: "downgrade"` no matchea las
>    guardas 1-3 (con 1 activo no hay bloqueo por locales, el plan no es `free`, y la suscripcion esta muerta)
>    y cae a la **guarda 4 → `settle_to_free`**, que limpia `stripe_subscription_id` y deja pasar el
>    `checkout`. Verificado en `decideDowngrade` y pinneado en `billing-plan-change-rows.test.ts:51-69`.
>
> O sea que la dependencia real es «**D8 o el boton de salida de D10**», las dos de fase C. **Si la fase C
> recorta o debilita LAS DOS, estas filas vuelven a estar abiertas** y `already_on_plan` pasa a ser un
> callejon sin salida («Ya estas en el plan Plus» sobre una suscripcion que no existe). Item explicito para el
> revisor de la fase C: vigilar **las dos salidas**, no solo D8.

**Unit — `billing-derive.test.ts`:**

- [ ] `planFromSubscription`: los 8 status + el inventado con su `SubscriptionWrite` esperado;
      `deleted` **con** y **sin** `downgrade_requested_at` (las dos filas: es el bloqueante
      R2-1); `incomplete_expired` con `currentPlan='free'` → sigue `free`; con `'plus'` → `none`;
      `pause_collection` no nulo con status `active` → **no** `plus`; price desconocido → `plan`
      **ausente** + `ignoredReason`.
- [ ] Jerarquia de `pending_plan`: `deleted` con `cancel_at_period_end: true` → `pending_plan`
      **`NULL`**; activa con `cancel_at` seteado y `cancel_at_period_end: false` →
      `pending_plan='free'`; `items.data` vacio → no tira y `pendingPlanAt = null`; fechas unix →
      asercion de **año** (caza el bug de 1970).
- [ ] Guard de pertenencia: evento de `sub_1` con la fila en `sub_2` **viva** → ignorado; con
      `sub_2` **muerta** → adoptado; evento con `created < last_event_at` → ignorado **y
      `last_event_at` no se mueve**.

**Unit — `billing-view.test.ts`:**

- [ ] `Object.keys(toSubscriptionView(row))` **igual exacto** al conjunto esperado, con una fila
      que trae los dos ids de Stripe y `downgrade_requested_at` con valores reconocibles, y
      asercion de que no aparecen en `JSON.stringify`.
- [ ] **Render del HTML** con `react-dom/server` (`renderToStaticMarkup`), bajo el
      `environment: "node"` del vitest de merchant (`vitest.config.ts:10`) — precedente en el
      repo: `renderToStaticMarkup(await BackofficePage())`
      (`locations-backoffice-pages.neon.integration.test.ts:113`). La pagina con una fila que
      trae los tres campos sensibles no los emite en el markup. **Sin esto el DTO pinnea la
      decision y el cableado queda sin oraculo** — el hueco de `choosePushPromptView`.
- [ ] La allow-list de presentacion: `none` → «Sin plan»; `free` + `canceled` → **no**
      «confirmando pago»; `status` desconocido → texto generico, nunca el string crudo.

**Unit — `billing-routes.test.ts`:** por cada una de las **5** rutas: sin sesion → 401; staff
(mock de `ownerContext` a `null`) → 403; «actua sobre el negocio del CALLER, nunca sobre uno
nombrado en el body»; y la forma del error (`{error, code}`). Con el piso de archivos escaneados
del barrido de la tarea 52.

**Integracion Neon:** un caso por cada item del DoD que diga «por SQL», mas:

- [ ] `cancel` con el fake tirando `StripeConnectionError` → 503 y el estado **queda puesto**;
      con `StripeInvalidRequestError` → 503 y revertido.
- [ ] staff activo **y desactivado** × las 5 rutas → 403 (sesiones reales, no mocks).
- [ ] `locations-races`: `pending_plan='free'` sembrado, 1 activo + 2 archivados, **8
      desarchivados concurrentes** → `count(active) = 1` por SQL. El oraculo es el `count`, **no
      «exito 0»**: `setLocationStatus` tiene un early-return idempotente (`store.ts:59`) que
      devuelve exito sin cambiar el conteo.
- [ ] `locations-races`: **`cancel` concurrente con el webhook** → ninguna de las dos escrituras
      se pierde (`downgrade_requested_at` presente **y** el `status` del evento aplicado).
- [ ] D8: fila divergente (DB `free` sin id, Stripe con suscripcion viva para ese customer) →
      reconcilia antes de renderizar; lista vacia → **no escribe nada**; Stripe caido → renderiza
      con el aviso.
- [ ] El webhook con **firma valida**, construida con
      `stripe.webhooks.generateTestHeaderString({ payload, secret })` (`cjs/Webhooks.d.ts:74`) —
      verificado que existe, asi que la ruta completa (firma + claim + runtime) tiene oraculo y
      **no** hace falta declarar ningun limite ahi.

**El observable de «una sola vez» NO es el estado final.** El efecto de un evento es un `UPDATE`
de `core.subscription`: aplicarlo dos veces deja **exactamente la misma fila**, sin contador ni
saldo, asi que un test del estado final es **identico** con y sin el guard y la mutacion M3
quedaria **verde** (la leccion de la 0055). La propiedad observable es **«una sola entrega gana el
claim»**: la segunda responde `{duplicate:true}` **y** la fila del evento tiene un solo
`processed_at` con un unico `received_at` movido.

**Plan de mutaciones — se EJECUTA y se transcribe, no se predice.** Son **hipotesis**; el
implementador las corre, transcribe que se pone rojo de verdad y **corrige la tabla si no
coincide**. Toda mutacion se etiqueta con `MUTATION` mientras esta puesta y se revierte con
`shasum` antes de cualquier otra cosa (hook `no-mutations-left.sh`).

| # | Mutacion | Rojo esperado (hipotesis) / **RESULTADO REAL cuando ya se ejecuto** |
|---|---|---|
| M1 | `effectiveLocationLimit` ignora `pendingPlan` | **EJECUTADA 2026-09-11 (orquestador). La hipotesis era MITAD FALSA y se corrige aca.** Rojo: 3 casos de `locations.test.ts` (`plan plus + pendiente free → 1`, `plan plus + pendiente enterprise → 1`, `un pending_plan vacio NO es una baja programada [R1-N8]`). **La «carrera de desarchivado» quedo VERDE**, y no porque el guard falle: esa carrera **todavia no existe** — es el `locations-races.neon.integration.test.ts | editar` de la FASE C. Escrita como estaba, la fila prometia un oraculo de concurrencia que en fase A no se puede correr. Re-ejecutar M1 al cerrar la fase C |
| M2 | `planFromSubscription` vuelve a `plus` fijo | **EJECUTADA 2026-09-11 (revisor): CONFIRMADA, mas amplia que la hipotesis.** 17 rojos en `billing-derive.test.ts` (la hipotesis decia 9+2): los 7 status no-`plus`, las dos filas de `deleted`, el par [R2-7], `pause_collection`, `unknown_price`, el intervalo del price que matcheo y las 3 de la jerarquia de pendiente |
| M3 | sacar el `WHERE processed_at IS NULL` del claim | el observable del claim (**no** el estado final) |
| M4 | **quitar `lockBusiness` del webhook** | la carrera `cancel` vs. webhook (escritura perdida). **NO** la de desarchivado: ahi el lock serializa pero no ordena, asi que ese test pasa igual — **corregido respecto de la version anterior, donde esta fila era falsa** |
| M5 | invertir el orden de `cancel` (Stripe antes de escribir) | el fake dispara un desarchivado durante el `update` y asevera que ya ve `pending_plan` |
| M6 | `checkout` vuelve al chequeo «existe fila en `memberships`» | los casos de staff |
| M7 | `WHERE excluded.processed_at IS NULL` en vez de la tabla | el observable del claim (un revisor lo ejecuto: **otorga** el claim) |
| M8 | mirar solo `cancel_at_period_end`, sin `cancel_at` | **EJECUTADA 2026-09-11 (revisor): CONFIRMADA, exacta.** 1 rojo: `` `cancel_at` seteado con `cancel_at_period_end: false` programa la baja igual`` |
| M9 | `items.data[0].current_period_end` sin optional chaining | **EJECUTADA 2026-09-11 (revisor): CONFIRMADA, exacta.** 1 rojo: `` `items.data` vacio NO tira: `pending_plan` puesto y la fecha en null`` |
| M10 | `deleted` a `free` ignorando `downgrade_requested_at` | **EJECUTADA 2026-09-11 (orquestador): CONFIRMADA y de mas alcance que la hipotesis.** 4 rojos en `billing-derive.test.ts`, incluido el caso literal `SIN downgrade_requested_at (baja hecha desde el dashboard) → none` — el bloqueante R2-1 — mas `el mismo incomplete_expired sobre un plan PAGO → none`, `status canceled` y `status incomplete_expired`. Revertida con `shasum` verificado (`e4af225f…` antes y despues) |
| M11 | `settle_to_free` sin el chequeo de locales | **EJECUTADA 2026-09-11 (revisor): CONFIRMADA, pero la hipotesis ATRIBUIA MAL.** 4 rojos y **ninguno es «3 activos desde `none`»** — ese caso es de INTEGRACION y no existe en fase A. Los reales: `PRECEDENCIA declarada: con 2 activos y plan free gana downgrade_blocked`, `` `archiveCount` sale del tope de free…`` (los dos en `-rows`), mas `cada punto del dominio cae en la guarda declarada` y `ninguna salida queda sin ejercer` (la matriz) |
| M12 | `change_interval` acepta `to: "month"` | **EJECUTADA 2026-09-11 (revisor): CONFIRMADA.** 3 rojos: `anual → mensual esta fuera de alcance por diseño` + los 2 de la matriz |
| M13 | `hasLiveSubscription` con allow-list **positiva** de vivos | **EJECUTADA 2026-09-11 (orquestador): CONFIRMADA.** 2 rojos: `un status DESCONOCIDO con id bloquea el checkout: lo no muerto cuenta como vivo` (`billing-plan-change-rows.test.ts`) y `cada punto del dominio cae en la guarda declarada` (la matriz). Revertida con `shasum` verificado (`0cdb0eb8…` antes y despues) |
| M14 | `settle_to_free` deja el `stripe_subscription_id` | «desde `none`, despues de bajar a free, `checkout` procede» |
| M15 | invertir el guard de pertenencia de D5.h | **EJECUTADA 2026-09-11: CONFIRMADA, mucho mas amplia — y ANTES cazo un agujero real.** Cuando el implementador la corrio por primera vez, **la suite entera quedaba VERDE**: no habia ningun oraculo del guard de pertenencia. De ahi nacio `billing-applicability.test.ts` (archivo fuera de la tabla §Archivos). Re-ejecutada por el revisor con ese archivo puesto: **8 rojos**, incluido el literal `un evento de sub_1 sobre una fila con sub_2 VIVA se ignora` |
| M16 | `reconcileFromStripe` escribe con la lista vacia | «lista vacia → no escribe nada» |
| M17 | `interval` sin `payment_behavior: error_if_incomplete` | «tarjeta rechazada → 402 y nada aplicado» |

**M3 y M7 comparten observable** (las dos hacen que el claim se otorgue siempre): son dos
mutaciones honestas de la **misma** propiedad, no dos propiedades. Se anota para que nadie lea la
tabla como «17 propiedades distintas pinneadas».

**Comandos exactos** (**[R2-I8]**: la version anterior usaba `DATABASE_URL`, con lo cual
`integrationEnabled` era falso y **la integracion se skipeaba en silencio** — el falso verde que
la spec 0062 existe para matar, reintroducido en la propia seccion de comandos. Verificado:
`counter-integration-support.ts:4-9` exige **otras dos** variables):

```sh
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use
pnpm run typecheck && pnpm run lint && pnpm run format:check && pnpm test && pnpm run build

NEON_INTEGRATION_DATABASE_URL='<rama efimera>' NEON_INTEGRATION_ISOLATED=true \
STRIPE_ENVIRONMENT=test STRIPE_SECRET_KEY_TEST='sk_test_…' \
STRIPE_WEBHOOK_SECRET_TEST='whsec_…' \
STRIPE_PRICE_PLUS_MONTHLY_TEST='price_…' STRIPE_PRICE_PLUS_YEARLY_TEST='price_…' \
MERCHANT_PUBLIC_ORIGIN='http://localhost:3000' \
  pnpm --filter @mi-pasaporte/merchant exec vitest run src/server/billing.neon.integration.test.ts
```

(Sin las 5 env de Stripe el webhook contesta **400 «Webhook no configurado»** —
`webhook/route.ts:15-23`, y `stripe-config.ts:29-31` valida el prefijo `sk_test_` — y los tests
pasarian aseverando el 400 equivocado. Alternativa: `vi.stubEnv`, patron de
`stripe-config.test.ts:10-16`.)

**Verificación manual (QA del owner, sobre prod con EL COMMIT desplegado).**

**[R1-B7] Reescrita: la version anterior era imposible de ejecutar** — decia «con A1 (`plus`,
varios locales) intentar cancelar», y el SQL muestra que A1 tiene **1 local activo** y **ninguna
suscripcion**. Y ahora **ya no hace falta** que el owner arregle A1 a mano para que la QA corra:
con la guarda 4 de `intent: "downgrade"` (D4), un plan pago sin suscripcion tiene salida.

- [ ] **Tope efectivo y el modal (A1):** desarchivar un 2º local (lo permite `plus`), entrar a
      Suscripcion y apretar el boton de bajar a Free → **se aprieta** (no esta gris) y el modal
      dice cuantos archivar, con el link; «Confirmar» no esta disponible.
- [ ] **A1, salida sin Stripe:** archivar hasta 1 activo y confirmar → queda en `free` sin que se
      haya llamado a Stripe.
- [ ] **Downgrade real (Negocio B, el unico con suscripcion):** cancelar → confirma y muestra la
      fecha; intentar desarchivar → lo rechaza, con el mensaje de baja programada.
- [ ] **Reanudar (Negocio B):** vuelve a «Plus activo» y el desarchivado vuelve a funcionar.
- [ ] **Intervalo (Negocio B, en `month`):** «Pasar a anual» cobra la diferencia en el acto;
      despues la seccion ya no ofrece cambio de intervalo.
- [ ] **Upgrade:** con un negocio `free` de prueba, mejorar a Plus pagando en modo test, volver y
      ver `plus`.
- [ ] **Primer pago rechazado:** con otro negocio `free` de prueba y la tarjeta
      `4000000000000341`, comprobar que **sigue en `free`** y puede volver a intentar.

## Handoff requerido

Protocolo de `docs/AGENT-WORKFLOW.md`: implementador → revisor independiente. Sin `PASS`
verificable no se marca `implementada`.

**Orden de despliegue, y es al revés de lo que decia la version anterior (**[R2-6]**).** Esa
version decia «la migracion la aplica el orquestador **despues** del PASS», que combinado con el
deploy automatico de Vercel al pushear `main` **rompe prod en la ventana**: `planLocationLimit`
pasa a seleccionar `pending_plan`, y esa funcion esta en el camino de crear, archivar y
desarchivar locales **y** en el render de la pagina de locales, asi que con el codigo nuevo
contra el esquema viejo cada uno de esos SELECT muere con `42703 column "pending_plan" does not
exist`. Los 11 negocios perderian el modulo Locales. El `next build` **no** lo caza: esas paginas
son `dynamic = "force-dynamic"` y no pegan a la base en build.

El orden correcto (y el esquema nuevo **es** compatible con el codigo viejo: las 5 columnas son
nullable y ningun lector hace `select()` sin lista de columnas):

1. PASS del revisor independiente.
2. **Aplicar `0030` a prod** (`DATABASE_URL_UNPOOLED=… pnpm --filter @mi-pasaporte/merchant
   db:migrate`) y **verificar por SQL** el esquema, y que `core`/`consumer`/`merchant_auth` estan
   intactos.
3. Setear **`MERCHANT_PUBLIC_ORIGIN`** en Vercel (Production y Preview).
4. `git push` y verificar el commit status **del sha exacto**
   (`GH_TOKEN= gh api repos/maxhost/check-point/commits/<sha>/status --jq '.state'` = `success`).
5. Verificar y anotar la `api_version` del endpoint de Stripe.
6. QA del owner.

## Abierto

**Nada bloqueante.** Las seis decisiones del owner estan en el ADR 0058 §8-12 y el ADR 0059.

### Decisiones del orquestador, NO del owner

Etiquetadas para que nadie las lea como suyas (`CLAUDE.md`: lo que el owner no dijo
explicitamente no se escribe como decision suya).

1. **`POST /api/billing/resume` existe.** El owner no pidio «reanudar». Sin eso, quien cancela y
   se arrepiente **queda atrapado**: `subscription_live` le impide abrir un Checkout nuevo y no
   tiene como deshacer hasta que termine el periodo. Fue informado en dos rondas y no lo objeto;
   igual queda aca y no como decision suya.
2. **`price.id` desconocido: no se avisa a nadie.** Se pregunto dos veces y no se respondio, asi
   que rige el default — el plan no se toca y el motivo queda en `ignored_reason` (hoy el caso es
   silencioso, asi que es mejora estricta). No hay infra de alertas en el repo y montarla para
   este caso seria andamiaje sin su tarea.
3. **`MERCHANT_PUBLIC_ORIGIN` y el chequeo de sesion abierta en `checkout`.** Cambian el
   comportamiento de una ruta existente, que estaba fuera de lo pedido; se incluyen porque sin
   ellos el boton «Mejorar a Plus» puede tirar 400 `idempotency_error` desde un dominio distinto
   o mandar a un **falso exito** con una sesion ya completada. La clave fija se conserva.
4. **El `status` crudo de Stripe se guarda en la columna** (antes se colapsaba
   `active|trialing → active`); la traduccion vive en la presentacion.
5. **El `stripe_customer_id` se persiste en el checkout** (antes solo lo escribia el webhook).
   Es lo que hace que D8 no sea un no-op.
6. **No hay auditoria de los cambios de plan por ruta** (D11).

### Requisito de configuracion que hay que verificar, o el ADR 0059 no se cumple

No es una decision, es un chequeo: el default de Stripe al agotar los reintentos de cobro es
**cancelar la suscripcion**. Si la cuenta queda asi, llega `deleted` **sin**
`downgrade_requested_at` sobre un plan pago → el negocio cae en **`plan='none'`** por un impago,
cuando la decision 1 del ADR 0059 dice que el impago **no** cambia el plan. La cuenta tiene que
dejar la suscripcion en **`unpaid`** (Billing → Manage failed payments), con los 3 reintentos en
la misma semana. Va como item del DoD de la **tarea 54** y como chequeo del owner en Stripe.

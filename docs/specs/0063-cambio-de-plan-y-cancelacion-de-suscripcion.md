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
- **El claim del webhook distingue TRES estados** —`claimed` / `already_processed` /
  `in_flight`— y la entrega que se retira porque otra la tiene tomada **contesta no-2xx**, para
  que Stripe reintente (D12, ADR 0061). Cierra el solape de dos entregas simultaneas.
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

Campos del payload que se leen, enumerados: **CINCO** — `type`, `id`, `created`, el
`data.object.id` que esta misma tabla prescribe para el `retrieve`, y **`api_version`**. (El DoD
anterior decia «ninguno mas que `type` e `id`», y era **inalcanzable con el propio diseño de la
spec**, porque el guard de orden necesita `created`.)

> **[fase B, correccion del revisor] La lista decia «`type`, `id`, `created` — y nada mas» y era
> FALSA POR OMISION en dos campos que el diseño exige**: el `data.object.id` (que la tabla de arriba
> manda leer) y `api_version`, que el claim escribe en `payload_version`. Un `grep` del codigo da los
> cinco. El uso de `api_version` no solo es correcto sino **deseable** —es el unico dato que prueba en
> que version serializo Stripe ESE payload, o sea lo que hace diagnosticable el desfase que motiva
> todo D5— pero enumerarlo de menos convierte una lista normativa en una afirmacion falsa: quien
> herede el arbol la usa para auditar por `grep` y encuentra un campo «no autorizado» que en realidad
> lo esta. La distincion que importa se mantiene: del payload no sale NINGUN dato de ESTADO de la
> suscripcion; `api_version` describe al sobre, no al contenido.

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

**[m1 — CIERRE DEL HALLAZGO DE LA FASE A. Es una DECISION DEL ORQUESTADOR (n.º 7), no del owner;
el revisor independiente coincidio en el diagnostico y en la ubicacion del fix.] La regla 1, escrita
asi, no alcanza: la ADOPCION es una puerta abierta.** Sobre una fila **adoptable**
(`stripe_subscription_id IS NULL` o status en `DEAD_STRIPE_STATUS` — **el caso de A1 en prod**, que
esta en `plus` sin suscripcion), el guard no frena nada, porque solo dispara si `!adoptable`.
Compuesto con la precedencia «lo terminal gana sobre el price desconocido» que pinnea
`planFromSubscription`, **un `customer.subscription.deleted` de una suscripcion AJENA con un price
AJENO escribe A1 → `plan='none'`**: un negocio vivo apagado por un evento que nunca fue suyo. El
test de la fase A pinnea solo la mitad benigna (con `downgrade_requested_at` seteado aterriza en
`free`); la mitad peligrosa es el **mismo camino de codigo** y no tenia fila.

**La regla de adopcion, que se agrega:** cuando `subscription.id` **≠** `row.stripeSubscriptionId`
(incluido el caso `NULL`), la fila se adopta **solo si la suscripcion RECUPERADA es nuestra y no
esta muerta**:

```
sameSubscription = row.stripeSubscriptionId === subscription.id
si sameSubscription            →  no es una adopcion: sigue la regla 2 (orden)
si no y !adoptable             →  ignorado, 'foreign_subscription'        (regla 1, ya existia)
si no y (ningun item.price.id ∈ {monthly, yearly}  o  status ∈ DEAD_STRIPE_STATUS)
                               →  ignorado, 'not_adoptable'               (NUEVO)
```

**La asimetria ES la regla, y es el enunciado que hay que conservar: un evento puede CREAR o
CONFIRMAR una adopcion, NUNCA TERMINARLA.** El `deleted` de fin de periodo de la **propia**
suscripcion de la fila sigue aplicando, porque ahi `sameSubscription` es verdadero y no hay
adopcion ninguna.

**El atajo obvio esta MAL y el revisor lo dejo anotado antes de que se escribiera: la regla NO puede
ser «adoptable solo por `customer.subscription.created`».** Un `updated` legitimo puede ser el
primer evento que veamos si el `created` se perdio, y el diseño entero de D5 dice que **el tipo de
evento es un disparador, no un hecho**. El discriminante sale del **estado de la suscripcion
recuperada** —price nuestro + status no muerto—, que es dato que da Stripe por `retrieve` y que el
actor del que hay que defenderse **no controla**. Es la regla de `CLAUDE.md` sobre discriminantes
(«preguntá quien mas puede escribir el campo»), aplicada: `price.id` lo fija nuestra cuenta, a
diferencia de `cancel_at_period_end`, que lo escribe tambien el boton del dashboard.

**Donde va, y por que NO va en la derivacion:** en `assessEventApplicability`, que ya es la funcion
que puede decir «no escribas nada». `SubscriptionWrite` tiene `status` **obligatorio** y no puede
expresar eso; meter el guard en `planFromSubscription` repetiria el error que motivo separarlas.
Cuesta dos cambios de firma de fase A, declarados: `assessEventApplicability` recibe `priceIds` y su
`subscription` pasa de `Pick<…, "id">` a `Pick<…, "id" | "status" | "items">`, y `EventApplicability`
suma `'not_adoptable'` al vocabulario de `IgnoredReason`.

**[m1-b, MISMA decision del orquestador, por el mismo motivo] El binding de
`checkout.session.completed` tampoco puede escribir sobre una fila no adoptable.** Ese camino no
pasa por la derivacion (solo bindea ids) pero **si** escribe `stripe_subscription_id`, asi que una
sesion vieja que se completa tarde podria repuntar la fila a una suscripcion distinta de la que esta
viva y facturando. Regla: el binding escribe **solo si la fila es adoptable** (`NULL` o status
muerto) o si el id **coincide** con el que ya tiene; en otro caso `processed_at` +
`ignored_reason='foreign_subscription'` y no se escribe nada. El `businessId` de ese camino sale de
`client_reference_id`, que **solo lo escribe nuestro checkout** — ese si es un discriminante
legitimo.

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

### D12. El claim distingue TRES estados, y la entrega que se retira NO contesta 2xx

**[FASE C. Implementa el ADR 0061, que sale de este hallazgo.]** Cierra el unico item del DoD que
habia quedado abierto («dos entregas simultaneas: una sola gana el claim»), que hasta aca era
**falso para el solape real** — ver §Plan de mutaciones → «HALLAZGO DE LA FASE B».

#### D12.a. El hallazgo: el lease de la fase B, tal como estaba escrito, era una REGRESION

El §HALLAZGO DE LA FASE B propuso el lease sobre `received_at` y declaro su trade-off como «un
reintento dentro de la ventana recibiria `{duplicate:true}` y el evento esperaria al reintento
siguiente». **`{duplicate:true}` sale con HTTP 200, y para Stripe cualquier 2xx es entrega
exitosa: no hay reintento siguiente.**

```
t=0s   entrega #1 gana el claim  →  el proceso MUERE (lambda cortada, crash, o el retrieve tira)
       →  processed_at queda NULL, received_at = t0
t=20s  reintento de Stripe  →  el lease lo rechaza  →  200 {duplicate:true}
       →  Stripe marca el evento ENTREGADO  →  no reintenta nunca mas
       →  EL EVENTO NO SE PROCESA JAMAS
```

Es el bug del **§Problema-4** —el que esta spec vino a matar— reintroducido con una ventana mas
chica. Y es **peor que no hacer nada**: hoy el solape deja el estado final CORRECTO (las dos
entregas escriben, el `UPDATE` es idempotente); el lease con 200 lo deja **sin escribir nunca**.
Un agujero cosmetico cambiado por una perdida de datos.

**La regla que ordena todo lo de abajo, y es la unica que hay que recordar:**

> **Un 2xx es una promesa: «este evento ya no es tuyo, no lo mandes mas».** Solo se puede hacer esa
> promesa cuando el evento esta REALMENTE terminado. **Retirarse porque otro lo tiene tomado no es
> terminarlo.**

#### D12.b. Los tres resultados del claim (normativo)

`claimEvent` deja de devolver `boolean` y pasa a devolver `"claimed" | "already_processed" |
"in_flight"`. **No se colapsan dos en uno**: cada uno tiene una respuesta HTTP distinta y las tres
son observables.

| resultado | condicion sobre la fila | respuesta HTTP | por que |
|---|---|---|---|
| `claimed` | no habia fila, **o** hay fila con `processed_at IS NULL` y lease **vencido** | sigue el procesamiento normal de D5.b | |
| `already_processed` | `processed_at IS NOT NULL` | **200** `{received:true, duplicate:true}` | terminado de verdad; Stripe **debe** dejar de reintentar. Es el caso que pinnean **M3/M7**, y su status **no cambia** |
| `in_flight` | `processed_at IS NULL` **y** `received_at` dentro de la ventana | **409** `"Evento en proceso."` | otro lo tiene tomado, o lo tomo y murio. Stripe **tiene** que reintentar |

**El 409 es decision del ORQUESTADOR, no del owner** (§Decisiones del orquestador, n.º 8).
Cualquier no-2xx sirve para que Stripe reintente; se elige `409 Conflict` porque es
semanticamente exacto («hay un conflicto con el estado actual del recurso») y porque **no
contamina el panel de errores 5xx** con un caso que no es una falla nuestra. El cuerpo es texto
plano, como el resto de los caminos de error de la ruta (`"Firma invalida."`, `"Webhook no
configurado."`), no JSON: el JSON de esta ruta significa «lo recibimos».

#### D12.c. El SQL del claim, y que parte es el guard

El predicado del lease entra en el **mismo `setWhere`** que ya existe. Sin columna nueva, sin
migracion, sin lock explicito, sin tocar [R1-M1]:

```sql
ON CONFLICT (event_id) DO UPDATE SET received_at = now()
WHERE core.stripe_webhook_event.processed_at IS NULL
  AND core.stripe_webhook_event.received_at < now() - interval '1 minute'
```

Medido sobre Neon en la fase B, **con control** (el claim sin lease sobre los mismos 4 casos), por
el revisor, el implementador y el orquestador por separado. Y el `EXPLAIN` deja los **dos**
predicados en el **mismo nodo post-lock**, que es la distincion del **ADR 0054** — es un guard que
se re-evalua sobre la fila ya lockeada, no un pre-chequeo tipo `InitPlan`:

```
Conflict Filter: ((stripe_webhook_event.processed_at IS NULL)
              AND (stripe_webhook_event.received_at < (now() - '00:01:00'::interval)))
```

**El upsert devuelve 0 filas en los DOS casos de rechazo y no dice cual es cual.** Distinguirlos
cuesta un `select processed_at ... where event_id = $1`, que corre **solo en el camino de
rechazo** (el raro).

**Ese `SELECT` NO ES UN GUARD y hay que escribirlo diciendolo**, porque el proximo lector va a
suponer que si lo es y va a intentar «arreglarle» la atomicidad: es un **clasificador de la
respuesta**. La carrera entre el upsert y el `SELECT` existe y es **benigna en los dos ordenes**:

- si la entrega #1 termina justo en el medio, leemos `processed_at` puesto → 200 `{duplicate:true}`
  → **correcto** (el evento esta terminado);
- si leemos `NULL` → 409 → Stripe reintenta → **correcto** (no prometimos nada que no fuera
  cierto).

**Ningun orden pierde el evento, y ninguno miente.** Esa es la propiedad, y es la razon por la que
no hace falta un statement unico ni un CTE — que ademas seria el error del ADR 0054 (un `SELECT`
en un CTE previo se evalua ANTES del lock).

#### D12.d. La ventana del lease tiene una cota inferior derivable, y por eso se fija `maxDuration`

El lease es una **apuesta** a que el que tomo el evento sigue vivo — no una deduccion: «arranco
hace 2 s y esta esperando el `retrieve`» y «arranco hace 2 s y murio» dejan la fila **identica**
(`processed_at IS NULL`, `received_at` hace 2 s). La respuesta no-2xx es lo que hace que **perder
la apuesta sea gratis**.

Pero la ventana no es un numero magico: **tiene que ser estrictamente mayor que la duracion maxima
de la funcion**, porque pasado ese tope el proceso esta muerto con certeza y el evento tiene que
poder re-tomarse. Hoy `app/api/stripe/webhook/route.ts` **no declara `maxDuration`**, asi que esa
premisa vive en un default de Vercel que no controlamos ni versionamos. La fase C **lo fija
explicitamente**:

```ts
export const maxDuration = 10; // segundos
```

**Los dos valores son decision del orquestador (n.º 8), con su motivo:**

- **`maxDuration = 10`**: el camino real es firma → claim (1 round-trip) → `retrieve` (~1 llamada
  a la API de Stripe) → una transaccion sobre Neon; normalmente bien por debajo de 2 s. **10 es
  conservador ademas por otra razon:** `CLAUDE.md` documenta que un valor que el plan no admite
  hace que **Vercel rechace el deploy entero** (paso con el 3er cron), y 10 s esta por debajo del
  tope de cualquier plan. Se declara en la **ruta**, no en `vercel.json`, por lo mismo.
- **ventana = `1 minute`**: es el valor **medido** en la fase B, y da 6× de margen sobre
  `maxDuration`. Agrandarla es seguro (un reintento in-window solo se demora); achicarla por
  debajo de `maxDuration` **rompe la premisa** y deja eventos clavados hasta que Stripe se rinda.
  Si algun dia sube `maxDuration`, **sube la ventana primero**.

#### D12.e. Lo que NO cambia, y lo que queda declarado

**No cambia:** [R1-M1] (el claim sigue siendo su propia transaccion corta que commitea antes del
`retrieve`); el orden de operaciones de D5.b; el orden de locks; la respuesta de
`already_processed`; ningun `ignored_reason`; ninguna columna; ninguna migracion.

**Efecto colateral bueno:** el `retrieve` duplicado del solape **desaparece** — la segunda entrega
se retira antes de llamar a Stripe.

**Lo que queda abierto y se declara, en vez de esconderse:**

1. **Un reintento de Stripe que llegue dentro de la ventana despues de un fallo real (500 del
   `retrieve`) se DEMORA hasta el reintento siguiente.** No se pierde. Es el unico costo que queda
   y es el costo de verdad.
2. **Un `in_flight` es, para Stripe, una entrega fallida.** Si la ventana quedara mal configurada
   (enorme), **todos** los reintentos fallarian y Stripe terminaria desactivando el endpoint — el
   espejo del riesgo que D5.a ya documenta para `resource_missing`. Por eso la ventana chica **y
   su test** no son cosmeticos.
3. **«Stripe considera entregado cualquier 2xx y deja de reintentar» es una PREMISA declarada, no
   verificada por nosotros.** Es la semantica documentada de sus webhooks y es de lo que cuelga
   toda esta seccion, pero **ningun oraculo de nuestro arbol observa la decision de reintentar de
   Stripe**, asi que no se puede pinnear con un test propio. Lo que si se pinnea —y es lo que el
   plan de pruebas exige— es **el status que devolvemos nosotros** en cada uno de los tres casos,
   que es la parte bajo nuestro control y la que una mutacion puede romper. Se anota asi, y no como
   «verificado», precisamente por el ADR 0054.
4. **`event.created` NO sirve para esto y no se intente:** es propiedad del EVENTO, identico en las
   dos entregas del mismo evento, asi que el guard de orden de D5 (`event.created <
   row.last_event_at`) no las distingue — son iguales, no menores. El `t=` del header
   `Stripe-Signature` **si** es por entrega (verificado en `stripe@22.5.0`,
   `esm/Webhooks.js:208`), pero no aporta nada sobre `received_at`: seria la misma comparacion con
   el reloj de Stripe en vez del nuestro, y **un timestamp dice CUANDO empezo la primera, no si
   sigue viva**, que es el dato que falta. Queda escrito porque es la primera idea que se le ocurre
   a cualquiera que lea esto (se le ocurrio al owner, y la pregunta es la que produjo el ADR 0061).

#### D12.f. Como se prueba sin esperar un minuto, y que NO se puede hacer para lograrlo

El test del reintento **fuera** de la ventana no puede dormir 60 s. **Se envejece la fila por
SQL** —`update core.stripe_webhook_event set received_at = now() - interval '2 minutes' where
event_id = $1`— y despues se entrega de nuevo. Es el estado real que tendria un evento viejo, no
un doble.

**Lo que esta PROHIBIDO para conseguirlo: volver la ventana configurable por env para poder
bajarla en los tests.** Suena razonable y es el camino corto, pero convierte el guard en algo que
depende de una variable de entorno que prod puede tener distinta, y deja el test pinneando una
ventana que en prod no existe — el test pasaria a medir otra cosa que la que se despliega. La
ventana es una constante del modulo; lo que el test mueve es **el reloj de la fila**, que es lo
que de verdad varia en produccion.

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
| `apps/merchant/src/server/billing/applicability.ts` | crear — **[fase B] NO estaba en esta tabla. El corte lo decide el orquestador ANTES de despachar, no el implementador a mitad de la tarea.** `assessEventApplicability` + su contrato normativo se mudan aca desde `derive.ts`, porque el guard de adopcion de m1 agrega ~35 lineas a un archivo que ya esta en **281** y el limite es 300 (`file-size`: dividir, no extender). El barrel reexporta, asi que ningun consumidor cambia de import. `billing-applicability.test.ts` ya existe y apunta al barrel |
| `apps/merchant/src/server/billing/gateway.ts` | crear — **NO estaba en esta tabla.** La costura `StripeGateway` de §Archivos compartidos necesitaba un archivo; el orquestador la puso aca |
| `apps/merchant/src/server/billing/view.ts` | crear — `toSubscriptionView` + allow-list de presentacion (la usan la seccion **y** la home) |
| `apps/merchant/src/server/billing/store.ts` | crear — `readSubscription`, `scheduleDowngrade`, `clearPendingPlan`, `settleToFree`, `reconcileFromStripe` |
| `apps/merchant/src/server/billing/webhook.ts` | crear — allow-list de tipos, claim, locks, escritura. **[fase C] editar:** consume el tri-estado de `claim.ts` y despacha las TRES respuestas de D12.b (200 `duplicate` / 409 `in_flight` / seguir). El claim en si **se muda** a `claim.ts` |
| `apps/merchant/src/server/billing/claim.ts` | **crear — [fase C] NO estaba en esta tabla. El corte lo decide el orquestador ANTES de despachar, no el implementador a mitad de la tarea.** `claimEvent` con su tri-estado, el SQL del lease y el contrato normativo de D12.b-c (incluido **por que el `SELECT` clasificador NO es un guard**, que es lo que el proximo lector va a querer 'arreglar'). Se parte porque `webhook.ts` esta en **201** lineas, el bloque normativo del claim ya ocupa ~60 y el limite es 300 (`file-size`: dividir, no extender) |
| `apps/merchant/src/server/billing/webhook-apply.ts` | crear — **[fase B] NO estaba en esta tabla.** Lo que pasa DENTRO de la segunda transaccion: `applySubscriptionEvent` (camino `customer.subscription.*`), `bindCheckoutSession` (camino m1-b), la resolucion del `businessId` de D5.c y `markProcessed`. Se partio porque `webhook.ts` con todo adentro daba **358 lineas** y el limite es 300 (`file-size`: dividir, no extender). `webhook.ts` queda con la orquestacion HTTP (firma, claim, allow-list, 500) y el contrato normativo del orden de operaciones |
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
| `apps/merchant/src/app/api/stripe/webhook/route.ts` | editar — delega + `export const runtime = "nodejs"`. **[fase C]** suma `export const maxDuration = 10` (D12.d): la cota inferior de la ventana del lease deja de vivir en un default de Vercel no versionado. **En la ruta, NO en `vercel.json`** — `CLAUDE.md`: un valor que el plan no admite hace que Vercel rechace el deploy entero |
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
| `apps/merchant/src/server/billing-adoption.test.ts` | crear — **[fase B] NO estaba en esta tabla.** Los casos del guard de ADOPCION (m1) y de `canBindSubscriptionId` (m1-b), incluida la fila **anti-degeneracion** (mismo id + status muerto + `deleted` → APLICA: sin ella, «no adoptar nunca» pasaria el resto). Sibling de `billing-applicability.test.ts` porque los dos bloques juntos daban **349 lineas** |
| `apps/merchant/src/server/billing-view.test.ts` | crear — allow-list exacta + render del HTML |
| `apps/merchant/src/server/billing-routes.test.ts` | crear — capa HTTP de las 5 rutas |
| `apps/merchant/src/server/locations.test.ts` | editar — extender con `effectiveLocationLimit` |
| `apps/merchant/src/server/locations-plan-cap.test.ts` | crear — **[fase A] NO estaba en esta tabla, y CIERRA EL BLOQUEANTE B1 de la 1a revision.** El oraculo de `limitReached` + `planLocationLimit`: sin el, anular la rama `pendingDowngrade` dejaba la suite en **620/620 VERDE** y el owner con una baja programada volvia a leer «Mejora tu plan». Va en un sibling y no dentro de `locations.test.ts` porque ese archivo esta en 233 lineas y el bloque ocupa ~90 (`file-size`, limite 300: dividir, no extender); `locations.test.ts` quedo con el puntero |
| `apps/merchant/src/server/billing.neon.integration.test.ts` | crear |
| `apps/merchant/src/server/billing-webhook.neon.integration.test.ts` | crear — claim, allow-list y diagnosticabilidad (D5.a-b/g): tipo ignorado sin `retrieve`, firma invalida sin fila, `retrieve` fallido + reintento, reentrega de un evento ya procesado (**el observable de M3/M7**), dos entregas simultaneas, `unknown_business` |
| `apps/merchant/src/server/billing-webhook-claim.neon.integration.test.ts` | **crear — [fase C] NO estaba en esta tabla. Corte decidido por adelantado.** Los tres casos del claim de D12.b contra Neon real: solape (**M20/M23**), primera entrega muerta + reintento dentro y fuera de la ventana (**M21**), reentrega de un ya procesado (**M22**), y la asercion `ventana > maxDuration`. Archivo propio porque `billing-webhook.neon.integration.test.ts` esta en **260** lineas y el bloque no entra bajo el limite de 300. Reusa el preambulo de `billing-webhook-support.ts` |
| `apps/merchant/src/server/billing-webhook-writes.neon.integration.test.ts` | crear — **[fase B] NO estaba en esta tabla.** Lo que el webhook ESCRIBE en `core.subscription`, por SQL: el bloqueante R2-1 (las dos filas de `deleted`) y el cableado del guard de adopcion (**M18**). Sibling del anterior porque los dos bloques juntos pasaban de 300 lineas |
| `apps/merchant/src/server/billing-webhook-binding.neon.integration.test.ts` | crear — **[fase B] NO estaba en esta tabla.** El cableado del binding de `checkout.session.completed` (**m1-b / M19**): una sesion tardia no repunta una suscripcion viva; sobre una fila adoptable bindea los ids y NO el plan. Archivo propio por el limite de 300 y porque es OTRO guard (`canBindSubscriptionId`, no `assessEventApplicability`) |
| `apps/merchant/src/server/billing-webhook-support.ts` | crear — **[fase B] NO estaba en esta tabla.** El preambulo compartido de los tres archivos de integracion del webhook (secreto, registro de ids de evento para el `afterAll`, `deliver` por la ruta real, seed con estado completo). El `vi.mock` de `stripe-config` NO puede vivir aca: va en cada `.test.ts` |
| `apps/merchant/src/server/billing-store.test.ts` | crear — **[fase B] NO estaba en esta tabla.** Unit de `store.ts` con un doble del `tx` (patron de `locations-plan-cap.test.ts`): el CONJUNTO EXACTO de claves de cada `SET` — en D10 la propiedad load-bearing es una AUSENCIA (`stripe_customer_id` se conserva) y un test de valores no ve una clave que sobra — mas la allow-list de columnas del `select` |
| `apps/merchant/src/server/billing-store.neon.integration.test.ts` | crear — **[fase B] NO estaba en esta tabla.** Lo que el doble del `tx` no puede ver: el `coalesce` de `downgrade_requested_at` contra Postgres, el `where` por `businessId` (con un segundo negocio sembrado), `reconcileFromStripe` completo (**M16**) y la carrera `cancel` vs. webhook (**M4**) |
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
- [ ] **[m1, fase B] Una fila ADOPTABLE (`stripe_subscription_id IS NULL` o status muerto — el caso
      de A1) NO acepta un `customer.subscription.deleted` de una suscripcion AJENA con price AJENO:**
      queda `ignored_reason='not_adoptable'`, **el plan NO se toca** y se verifica por SQL que la fila
      sigue en `plus`. El mismo evento con price **nuestro** y status **vivo** (`created` o `updated`)
      **si** adopta. Mutacion M18.
- [ ] **[m1-b, fase B] Un `checkout.session.completed` tardio NO repunta el
      `stripe_subscription_id` de una fila cuya suscripcion esta VIVA** — `ignored_reason` y ninguna
      escritura; sobre una fila adoptable **si** bindea.
- [ ] Un evento cuyo `retrieve` falla deja **fila con `processed_at IS NULL`** y el reintento lo
      procesa.
- [ ] **[fase C, D12] Dos entregas SOLAPADAS del mismo evento: una sola gana el claim** — la
      otra recibe **409** (no 200), y por SQL queda **una sola fila**, con `processed_at` no nulo
      y **un solo `retrieve`** contra Stripe. Con el `EXPLAIN` transcripto **corrido sobre Neon**.
      Mutaciones **M20** y **M23**. *(El `EXPLAIN` ya estaba cumplido desde la fase B; lo que
      faltaba —y falsificaba el item— era «una sola gana».)*
- [ ] **[fase C, D12] Un evento cuya primera entrega MURIO no se pierde:** con `processed_at IS
      NULL`, el reintento **dentro** de la ventana del lease recibe **409** —nunca un 2xx— y el
      reintento **fuera** de la ventana **gana el claim y lo procesa**. **Es el item mas
      importante de la fase:** un 200 ahi le promete a Stripe que el evento esta terminado y
      reintroduce el bug del §Problema-4. Mutacion **M21**.
- [ ] **[fase C, D12] Una reentrega de un evento YA PROCESADO sigue contestando 200
      `{duplicate:true}`** — el lease **no** cambia ese status. Si contestara 409, Stripe
      reintentaria para siempre hasta desactivar el endpoint. Mutacion **M22**.
- [ ] **[fase C, D12] `app/api/stripe/webhook/route.ts` declara `maxDuration`**, y la ventana del
      lease es **estrictamente mayor** que ese valor. Aseverado en un test, no solo escrito: es la
      premisa de la que depende que un evento tomado por un proceso muerto se pueda re-tomar.
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
      y el codigo no lee del payload ningun campo fuera de **los cinco enumerados en D5.a**
      (`type`, `id`, `created`, `data.object.id` y `api_version`) — ninguno de ellos es estado de
      la suscripcion. **[fase B] El texto anterior decia «fuera de `type`, `id` y `created`» y era
      falso por omision**; ver la correccion en D5.a.
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
> O sea que la dependencia real es «**D8 o el boton de salida de D10**», las dos de fase D. **Si la fase D
> recorta o debilita LAS DOS, estas filas vuelven a estar abiertas** y `already_on_plan` pasa a ser un
> callejon sin salida («Ya estas en el plan Plus» sobre una suscripcion que no existe). Item explicito para el
> revisor de la fase D: vigilar **las dos salidas**, no solo D8.

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
- [ ] **[m1, fase B] Guard de ADOPCION** (`billing-applicability.test.ts`): fila adoptable + evento
      `deleted` con price **ajeno** → `not_adoptable`; fila adoptable + `deleted` con price
      **nuestro** pero status muerto → `not_adoptable`; fila adoptable + `created`/`updated` con
      price nuestro y status vivo → **adoptado**; **fila con el MISMO id y status muerto + `deleted`
      → aplica** (el fin de periodo normal no se rompe: no es una adopcion). La ultima fila es
      anti-degeneracion — sin ella, «no adoptar nunca» pasaria el resto.

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
| M1 | `effectiveLocationLimit` ignora `pendingPlan` | **EJECUTADA 2026-09-11 (orquestador). La hipotesis era MITAD FALSA y se corrige aca.** Rojo: 3 casos de `locations.test.ts` (`plan plus + pendiente free → 1`, `plan plus + pendiente enterprise → 1`, `un pending_plan vacio NO es una baja programada [R1-N8]`). **La «carrera de desarchivado» quedo VERDE**, y no porque el guard falle: esa carrera **todavia no existe** — es el `locations-races.neon.integration.test.ts | editar` de la FASE D. Escrita como estaba, la fila prometia un oraculo de concurrencia que en fase A no se puede correr. Re-ejecutar M1 al cerrar la fase D |
| M2 | `planFromSubscription` vuelve a `plus` fijo | **EJECUTADA 2026-09-11 (revisor): CONFIRMADA, mas amplia que la hipotesis.** 17 rojos en `billing-derive.test.ts` (la hipotesis decia 9+2): los 7 status no-`plus`, las dos filas de `deleted`, el par [R2-7], `pause_collection`, `unknown_price`, el intervalo del price que matcheo y las 3 de la jerarquia de pendiente |
| M3 | sacar el `WHERE processed_at IS NULL` del claim | **EJECUTADA 2026-09-11 (implementador fase B): CONFIRMADA, exacta.** 1 rojo en `billing-webhook.neon.integration.test.ts`: `reentregar un evento YA PROCESADO contesta {duplicate:true} y no lo vuelve a aplicar` — `AssertionError: expected { received: true } to deeply equal { received: true, duplicate: true }`. **El test de dos entregas SIMULTANEAS queda VERDE, y eso es correcto**: ver el hallazgo del claim abajo. Revertida con `shasum` (`bc2c88de…` antes y despues) |
| M4 | **quitar `lockBusiness` del webhook** | **EJECUTADA 2026-09-11 (implementador fase B): CONFIRMADA, exacta.** 1 rojo en `billing-store.neon.integration.test.ts`: `un cancel concurrente con el webhook NO pierde ninguna de las dos escrituras` — `AssertionError: expected 'none' to be 'free'`, que es literalmente la escritura perdida (el webhook decidio con un `downgrade_requested_at` leido antes del commit del `cancel`). Los 16 tests restantes de los 3 archivos de integracion quedan verdes, incluido todo lo de tope de locales: confirma que el motivo NO es el sobre-tope. Revertida con `shasum` (`df9ecd68…`) |
| M5 | invertir el orden de `cancel` (Stripe antes de escribir) | el fake dispara un desarchivado durante el `update` y asevera que ya ve `pending_plan` |
| M6 | `checkout` vuelve al chequeo «existe fila en `memberships`» | los casos de staff |
| M7 | `WHERE excluded.processed_at IS NULL` en vez de la tabla | **EJECUTADA 2026-09-11 (implementador fase B): CONFIRMADA, exacta y con EL MISMO rojo que M3** (`reentregar un evento YA PROCESADO…`, misma asercion literal). Confirma lo que la tabla ya decia: M3 y M7 son dos mutaciones honestas de UNA propiedad, no de dos. Revertida con `shasum` (`bc2c88de…`) |
| M8 | mirar solo `cancel_at_period_end`, sin `cancel_at` | **EJECUTADA 2026-09-11 (revisor): CONFIRMADA, exacta.** 1 rojo: `` `cancel_at` seteado con `cancel_at_period_end: false` programa la baja igual`` |
| M9 | `items.data[0].current_period_end` sin optional chaining | **EJECUTADA 2026-09-11 (revisor): CONFIRMADA, exacta.** 1 rojo: `` `items.data` vacio NO tira: `pending_plan` puesto y la fecha en null`` |
| M10 | `deleted` a `free` ignorando `downgrade_requested_at` | **EJECUTADA 2026-09-11 (orquestador): CONFIRMADA y de mas alcance que la hipotesis.** 4 rojos en `billing-derive.test.ts`, incluido el caso literal `SIN downgrade_requested_at (baja hecha desde el dashboard) → none` — el bloqueante R2-1 — mas `el mismo incomplete_expired sobre un plan PAGO → none`, `status canceled` y `status incomplete_expired`. Revertida con `shasum` verificado (`e4af225f…` antes y despues) |
| M11 | `settle_to_free` sin el chequeo de locales | **EJECUTADA 2026-09-11 (revisor): CONFIRMADA, pero la hipotesis ATRIBUIA MAL.** 4 rojos y **ninguno es «3 activos desde `none`»** — ese caso es de INTEGRACION y no existe en fase A. Los reales: `PRECEDENCIA declarada: con 2 activos y plan free gana downgrade_blocked`, `` `archiveCount` sale del tope de free…`` (los dos en `-rows`), mas `cada punto del dominio cae en la guarda declarada` y `ninguna salida queda sin ejercer` (la matriz) |
| M12 | `change_interval` acepta `to: "month"` | **EJECUTADA 2026-09-11 (revisor): CONFIRMADA.** 3 rojos: `anual → mensual esta fuera de alcance por diseño` + los 2 de la matriz |
| M13 | `hasLiveSubscription` con allow-list **positiva** de vivos | **EJECUTADA 2026-09-11 (orquestador): CONFIRMADA.** 2 rojos: `un status DESCONOCIDO con id bloquea el checkout: lo no muerto cuenta como vivo` (`billing-plan-change-rows.test.ts`) y `cada punto del dominio cae en la guarda declarada` (la matriz). Revertida con `shasum` verificado (`0cdb0eb8…` antes y despues) |
| M14 | `settle_to_free` deja el `stripe_subscription_id` | «desde `none`, despues de bajar a free, `checkout` procede» |
| M15 | invertir el guard de pertenencia de D5.h | **EJECUTADA 2026-09-11: CONFIRMADA, mucho mas amplia — y ANTES cazo un agujero real.** Cuando el implementador la corrio por primera vez, **la suite entera quedaba VERDE**: no habia ningun oraculo del guard de pertenencia. De ahi nacio `billing-applicability.test.ts` (archivo fuera de la tabla §Archivos). Re-ejecutada por el revisor con ese archivo puesto: **8 rojos**, incluido el literal `un evento de sub_1 sobre una fila con sub_2 VIVA se ignora` |
| M16 | `reconcileFromStripe` escribe con la lista vacia | **EJECUTADA 2026-09-11 (implementador fase B): CONFIRMADA, pero AL SEGUNDO INTENTO, y el primero es el hallazgo.** (a) La primera version de la mutacion fabricaba una suscripcion sintetica con id propio: el **guard de adopcion de m1 la frenaba** (`not_adoptable`) y la asercion de estado quedaba VERDE — o sea que ese oraculo lo sostenia OTRO guard. (b) La version fiel —con la lista vacia, degradar la suscripcion DE LA FILA— si muerde: 1 rojo, `reconcileFromStripe con la lista VACIA no escribe NADA`, `expected {…} to deeply equal {…}` con `- "plan": "plus"` / `+ "plan": "none"` y `- "status": "active"` / `+ "status": "canceled"`. (c) Ademas hubo que **reordenar el test**: con el `outcome` aseverado antes que la fila, el rojo caia en el valor de retorno y M16 quedaba atribuida a otra cosa. Revertida con `shasum` (`a9bfa417…`) |
| M17 | `interval` sin `payment_behavior: error_if_incomplete` | «tarjeta rechazada → 402 y nada aplicado» |
| M18 | **[m1, fase B]** sacar el guard de adopcion (una fila adoptable acepta cualquier suscripcion) | **EJECUTADA 2026-09-11 (implementador fase B): CONFIRMADA, mas amplia que la hipotesis — 6 rojos.** 5 units en `billing-adoption.test.ts` (`A1: fila adoptable (plus SIN suscripcion) + suscripcion ajena con price ajeno → not_adoptable`, `fila adoptable + price AJENO pero status VIVO`, las dos de `price NUESTRO pero status muerto (canceled / incomplete_expired)` y `PRECEDENCIA declarada: adopcion ANTES que orden`, esta ultima con `- "ignoredReason": "not_adoptable"` / `+ "stale_event"`) **mas 1 de CABLEADO** en `billing-webhook-writes.neon.integration.test.ts`: `[m1] una fila ADOPTABLE no acepta un deleted AJENO con price ajeno` — `expected { received: true } to deeply equal { received: true, ignored: "not_adoptable" }`. Las dos filas ANTI-DEGENERACION quedan VERDES, que es la otra mitad de la propiedad. Revertida con `shasum` (`8303892a…`) |
| M19 | **[m1-b, fase B]** el binding de `checkout.session.completed` escribe sin mirar si la fila es adoptable | **EJECUTADA 2026-09-11 (implementador fase B): CONFIRMADA — 3 rojos.** 2 units en `billing-adoption.test.ts` (`una fila con una suscripcion VIVA no acepta el binding de otra` y `un status DESCONOCIDO no vuelve bindeable la fila`, los dos `expected true to be false`) **mas 1 de CABLEADO** en `billing-webhook-binding.neon.integration.test.ts`: `[m1-b] un checkout.session.completed tardio NO repunta una suscripcion VIVA` — `expected [Array(2)] to deeply equal ['sub_viva','cus_viva']`, recibido `['sub_de_la_sesion_vieja','cus_otro']`: la repunta, demostrada. **Tambien hubo que reordenar** ese test (la fila antes del cuerpo de la respuesta) para que el rojo no quedara atribuido a la RESPUESTA. Revertida con `shasum` (`8303892a…`) |
| M20 | **[fase C, D12]** sacar el predicado del lease del `setWhere` (volver al claim de la fase B) | «dos entregas SOLAPADAS: una sola gana el claim, la otra 409» |
| M21 | **[fase C, D12]** contestar **200 `{duplicate:true}`** en el caso `in_flight` en vez de 409 | «el reintento dentro de la ventana recibe 409, nunca un 2xx». **ES LA MUTACION MAS IMPORTANTE DE LA FASE:** es exactamente el bug que D12 existe para prevenir, y con la suite verde seria invisible. Si queda VERDE, el lease es peor que no haber hecho nada |
| M22 | **[fase C, D12]** colapsar el tri-estado: tratar `already_processed` como `in_flight` (409 a un evento ya procesado) | «una reentrega de un evento YA PROCESADO contesta 200 `{duplicate:true}`». Pinnea que no rompimos el caso bueno: un 409 ahi deja a Stripe reintentando para siempre |
| M23 | **[fase C, D12]** invertir la comparacion del lease (`received_at > now() - interval`) | el solape y/o la re-toma pasada la ventana. **Predicha como posiblemente INDISTINGUIBLE de M20** — si lo es, se transcribe que lo es (spec 0055: las mutaciones (a) y (b) resultaron indistinguibles contra lo que el plan afirmaba) |

**M3 y M7 comparten observable** (las dos hacen que el claim se otorgue siempre): son dos
mutaciones honestas de la **misma** propiedad, no dos propiedades. Se anota para que nadie lea la
tabla como «17 propiedades distintas pinneadas».

> **HALLAZGO DE LA FASE B, medido — QUE GARANTIZA EL CLAIM Y QUE NO.** El DoD pide «dos entregas
> simultaneas: una sola gana el claim, la segunda responde `{duplicate:true}`». **Eso vale para el
> reintento de Stripe (entrega SECUENCIAL, el caso real y el bug del §Problema-4), pero NO para dos
> entregas que se solapan** — y es consecuencia directa de [R1-M1], no un descuido: el claim es su
> **propia transaccion corta** y commitea antes del `retrieve`, asi que la segunda entrega encuentra
> `processed_at IS NULL` (la primera todavia esta en la red) y **tambien gana**. Lo que si vale
> siempre, y es lo que el test asevera: **una sola fila de evento, procesada, y el estado final
> correcto** (el efecto es un `UPDATE` idempotente). El test `reentregar un evento YA PROCESADO…` es
> el que pinnea el claim y el que muerde con M3/M7; el de dos entregas simultaneas queda verde con y
> sin el guard **y lo dice en su propio comentario**, para que nadie lo lea como el oraculo del claim.
>
> **EL COSTO DE CERRARLO ES MUCHO MAS BAJO DE LO QUE DIJO LA PRIMERA VERSION DE ESTE PARRAFO, y la
> correccion es el hallazgo.** El implementador de la fase B declaro que costaria «un lock explicito
> o una columna `processing_at`», y eso viajo a `docs/TASKS.md`. **Es falso: no hace falta ninguna de
> las dos.** El lease entra en la columna **`received_at` QUE YA EXISTE**, como un predicado mas en
> el **mismo** `setWhere` — sin columna nueva, sin migracion, sin lock explicito y sin violar
> [R1-M1]. Es el error que `CLAUDE.md` describe: un limite sobredimensionado **se ve virtuoso** y
> hace el mismo daño que un `[x]` inflado, y aca ademas **cambiaba la decision del owner**, que
> quedaba apoyada en un precio que no es el real. Lo falsifico el revisor independiente de la fase B
> y lo re-verificaron el orquestador y el implementador, cada uno con su propia corrida sobre Neon y
> **con un control** (el claim actual, sin lease, sobre los mismos 4 casos):
>
> ```sql
> ON CONFLICT (event_id) DO UPDATE SET received_at = now()
> WHERE core.stripe_webhook_event.processed_at IS NULL
>   AND core.stripe_webhook_event.received_at < now() - interval '1 minute'
> ```
>
> | caso | claim actual | con lease |
> |---|---|---|
> | 1a entrega | gana | gana |
> | 2a entrega **solapada** | **gana** ← el agujero | **pierde** |
> | reintento de Stripe (lease vencido) | gana | gana |
> | reentrega de uno YA PROCESADO | pierde | pierde |
>
> Y el `EXPLAIN` sobre Neon muestra que **el lease no rompe la premisa del ADR 0054**: los dos
> predicados viven en el MISMO nodo post-lock, no en un `InitPlan` —
> `Conflict Filter: ((stripe_webhook_event.processed_at IS NULL) AND (stripe_webhook_event.received_at < (now() - '00:01:00'::interval)))`.
>
> **El trade-off que si tiene, y por eso sigue siendo una decision y no una mejora gratis:** un
> reintento de Stripe que llegue **dentro** de la ventana del lease recibiria `{duplicate:true}` y el
> evento esperaria al reintento siguiente. Es tolerable porque los reintentos de Stripe estan a
> minutos/horas, pero hay que elegir la ventana (1 min es el valor probado) y es una decision, no un
> detalle. El mismo predicado es lo que hace que un proceso que muere a mitad no deje el evento
> clavado: pasada la ventana, el reintento lo vuelve a tomar — igual que hoy.
>
> **RESUELTO el 2026-09-11 por decision del owner: se cierra, y entra como FASE C (D12, ADR
> 0061).** Lo que era la fase C (rutas + UI + D8 + D10) pasa a ser la **fase D**.
>
> **PERO EL PRECIO QUE ESTE PARRAFO DECLARABA TAMBIEN ERA FALSO, y esa es la segunda leccion.** La
> frase «es una spec de correccion de una linea de SQL mas su test de solape» omitia la mitad que
> importa: el rechazo por lease iba a contestar `{duplicate:true}` **con HTTP 200**, y para Stripe
> cualquier 2xx es entrega exitosa. El «el evento esperaria al reintento siguiente» de tres
> parrafos mas arriba **no existe**: no hay reintento siguiente. Un evento cuya primera entrega
> muriera **no se habria procesado nunca** — el bug del §Problema-4, reintroducido por la puerta de
> atras, y una REGRESION neta respecto de no hacer nada (hoy el solape deja el estado final
> correcto porque el `UPDATE` es idempotente).
>
> **Este bloque nacio corrigiendo un limite sobredimensionado y, al corregirlo, fijo un precio
> nuevo que tampoco se verifico.** Es el corolario de `CLAUDE.md` que costo una segunda vuelta en
> la spec 0057, ahora del lado del COSTO: sub-corregir se siente como rigor y deja el mismo agujero
> mas chico. Lo cazo el orquestador al explicarle el trade-off al owner — o sea, tarde: ya estaba
> escrito aca, en `docs/TASKS.md` y en `docs/INDEX.md`, y sostenia una recomendacion.
>
> El diseño real, con los tres estados del claim y la respuesta no-2xx, esta en **D12**; el porque,
> en el **ADR 0061**.

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
7. **[2026-09-11, al cerrar la fase A] El guard de ADOPCION de D5.h (m1) y el del binding de
   `checkout.session.completed` (m1-b).** No son pedidos del owner ni estaban en la spec cerrada:
   salieron de implementar la fase A —el implementador desarrollo la consecuencia al pinnear la
   precedencia «lo terminal gana»— y el revisor independiente coincidio en el diagnostico y en la
   ubicacion. Se escriben porque sin ellos **un evento ajeno apaga un negocio vivo** (`plan='none'`
   sobre A1), que es la clase de estado que toda la spec existe para prohibir. Cuestan dos cambios
   de firma en archivos de la fase A (`assessEventApplicability` recibe `priceIds`; `IgnoredReason`
   suma `not_adoptable`), declarados en D5.h. **Si el owner prefiere dejarlo abierto, se revierte el
   guard y la fila de A1 queda expuesta: la decision es suya, pero no se puede implementar «sin
   decidir», porque el camino ya esta escrito.**
8. **[2026-09-11, fase C] Los VALORES de D12: el status `409`, `maxDuration = 10` y la ventana de
   `1 minute`.** Lo que decidio el owner es **cerrar el solape**; la forma es del orquestador.
   - **409** — cualquier no-2xx sirve para que Stripe reintente; se elige `409 Conflict` porque es
     semanticamente exacto y porque no contamina el panel de 5xx con un caso que no es una falla.
   - **`maxDuration = 10`** — conservador a proposito: `CLAUDE.md` documenta que un valor que el
     plan no admite hace que **Vercel rechace el deploy entero**.
   - **ventana `1 minute`** — es el valor medido en la fase B, 6x `maxDuration`. Lo normativo no es
     el numero sino la **relacion**: ventana > `maxDuration`.

   **Si el owner prefiere otros valores, se cambian sin tocar el diseño.** Lo que NO es opcional es
   el tri-estado con la respuesta no-2xx: sin eso el lease es una regresion (D12.a).

### Decisiones del IMPLEMENTADOR de la fase B, NO del owner ni del orquestador

Vivian solo en comentarios del codigo; las baja aca el pedido del revisor, porque un lector de la
spec no las veia. Ninguna cambia una decision de producto: las cuatro son bordes que el diseño no
fijaba y que HAY que resolver para que el webhook funcione.

1. **El binding de `checkout.session.completed` NO mueve `last_event_at` y NO aplica el guard de
   orden.** No deriva ningun plan —solo bindea ids— y adelantar la marca seria PELIGROSO:
   `checkout.session.completed` y `customer.subscription.created` llegan casi juntos y **sin orden
   garantizado entre sus `created`**, asi que moverla dejaria al evento de suscripcion clasificado
   `stale_event` y **el plan no se otorgaria nunca**. Es [R2-M3] aplicado a este camino.
2. **`reconcileFromStripe` aplica el guard de pertenencia/adopcion pero NEUTRALIZA el de orden por
   construccion**: se le pasa `created = ahora`, asi que nunca puede ser «stale» — no hay ningun
   evento cuyo orden respetar, lo que se lee es el estado ACTUAL de Stripe. Y por lo mismo **no
   mueve `last_event_at`**: si lo adelantara a `now`, un evento legitimo que llegara despues con un
   `created` anterior quedaria `stale_event` y se perderia. D8 decia «el mismo guard» sin distinguir
   las dos reglas; esta es la lectura que se implemento.
3. **Vocabulario nuevo de `ignored_reason`: `session_without_subscription`** — un
   `checkout.session.completed` que no creo ninguna suscripcion (no era `mode: "subscription"`). Sin
   el, ese caso quedaba marcado procesado con un motivo PRESTADO (`unknown_business`) que manda a
   diagnosticar otra cosa. `derive.ts` ya preveia que el implementador pudiera sumar uno y lo
   declarara. **Por el mismo motivo, `reconcileFromStripe` distingue `no_subscription_row` de
   `no_customer`** (la primera version los confundia; lo cazo el revisor).
4. **`scheduleDowngrade` cubre los pasos 2 Y 4 de D6 en una sola funcion**, con
   `pendingPlanAt` opcional, en vez de una sexta funcion en `store.ts`; y escribe
   `downgrade_requested_at` con `coalesce(columna, $now)` para **conservar** la marca, que es de lo
   que cuelga la `idempotencyKey` del reintento de D6. **Lo consume la fase D**: `cancel` llama dos
   veces, sin `pendingPlanAt` en el paso 2 y con la fecha de Stripe en el paso 4.

### Requisito de configuracion que hay que verificar, o el ADR 0059 no se cumple

No es una decision, es un chequeo: el default de Stripe al agotar los reintentos de cobro es
**cancelar la suscripcion**. Si la cuenta queda asi, llega `deleted` **sin**
`downgrade_requested_at` sobre un plan pago → el negocio cae en **`plan='none'`** por un impago,
cuando la decision 1 del ADR 0059 dice que el impago **no** cambia el plan. La cuenta tiene que
dejar la suscripcion en **`unpaid`** (Billing → Manage failed payments), con los 3 reintentos en
la misma semana. Va como item del DoD de la **tarea 54** y como chequeo del owner en Stripe.

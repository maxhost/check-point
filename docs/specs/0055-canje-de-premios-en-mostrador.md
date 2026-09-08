---
spec: 0055
fecha: 2026-09-07
estado: cerrada
resumen: El canje que cierra el loop del producto — el mostrador escanea el QR del cliente, el cliente elige premio, el operador confirma y se debita (puntos) o se consume la tarjeta (sellos, con arrastre); sin saldo suficiente el canje se bloquea, salvo que el programa lo permita, y entonces el saldo cae a 0 y nunca a negativo, con un log de contabilidad propio (`core.reward_redemption`) que snapshotea el premio, el consumidor, el operador y el local; más el catálogo de premios en el wallet del consumidor.
disjunta: no
archivos: `src/server/counter/*`, `src/server/db.ts` (consumo de `withDbTransaction`), `src/server/schema/reward-redemption.ts`, `src/server/schema/loyalty.ts`, `src/server/consumer/programs.ts`, `app/api/counter/redeem/*`, `app/backoffice/counter/*`, `app/backoffice/loyalty/steps/step-rewards.tsx`, `app/(consumer)/wallet/*`, migración aditiva
---

# 0055 — Canje de premios en mostrador

> **Cerrada el 2026-09-07** con el owner. Las nueve decisiones de «Decisiones cerradas»
> salieron de él; lo que no dijo está marcado como propuesta y no bloquea. Implementa los
> **ADR 0053** y **0054**.
>
> **Corregida el 2026-09-07 tras una revisión independiente del plan que dio NO PASA.** Los
> cinco hallazgos bloqueantes eran de mecanismo, no de producto: ninguna decisión del owner
> cambió. El más grave —doble débito por la idempotencia rota del patrón de `persistGrant`—
> se verificó ejecutándolo y resultó ser además un **bug vivo en la acreditación**: sale por
> el **ADR 0054** y la **spec 0056**.
>
> **Depende de la spec 0056** (fix del grant), que va primero por decisión del owner.

## Problema

**El canje no existe: el loop del producto no cierra.** El owner puede configurar premios
(spec 0036, tabla `core.loyalty_reward` poblada y persistida) y el mostrador puede acreditar
puntos/sellos (spec 0030), pero **nadie puede entregar un premio**: `app/api/counter/` tiene
sólo `resolve` y `grant`, `server/counter/` no tiene ningún `redeem`, y la consola ofrece
exactamente dos acciones, las dos de venta. El consumidor acumula saldo que no puede gastar.

**No es un bug ni una implementación incompleta: es un agujero *entre* dos specs cerradas.**
La 0036 §8 dice textual *«La ejecución del canje es de la 0030»*; la 0030 dice en su `resumen`
*«Solo acreditación; el canje es otra feature»*. Las dos están cerradas y las dos son
internamente coherentes — el hueco está en el medio, que es donde ningún revisor de spec mira.
(Hallazgo del QA del owner 2026-09-05, bloque B2, tarea 44.)

Además, **hoy el consumidor no ve los premios en ningún lado**: `(consumer)/wallet` renderiza
programas, saldo y QR, y no tiene una sola referencia a `reward`. Sabe cuántos puntos tiene;
no sabe qué puede pedir con ellos.

## Decisiones cerradas (owner, 2026-09-07)

1. **Contabilidad propia.** El canje deja un registro auditable que responde: qué premio se
   entregó, cuántos puntos/sellos lo pagaron, **quién lo reclama** (la membresía/tarjeta del
   consumidor), **quién lo confirmó** (el operador) y **dónde** (negocio + local). El objetivo
   declarado es auditar a futuro **por marca y por local** — hoy hay un solo local, pero la
   estructura ya soporta N.
2. **Mecánica.** Al confirmar: **Puntos** → se resta el costo del premio. **Sellos** → se
   reinicia la tarjeta.
3. **Sellos, reinicio exacto (con arrastre).** Si la tarjeta es de 10 y el cliente tiene 12,
   el canje consume **10** y **quedan 2**. Razón del owner: en el mundo físico, quien llega al
   tope y no canjea recibe una tarjeta nueva y sigue sumando; el arrastre es esa tarjeta nueva.
4. **Un canje = un premio por operación.** Para entregar dos premios se hacen dos canjes. No
   hay carrito de premios.
5. **Saldo insuficiente: lo decide el owner por programa**, como *configuración avanzada* del
   programa (una opción, no una regla del sistema): o se bloquea el canje, o se permite
   entregarlo igual. **Sin migración de datos** de los programas existentes (están en test).
6. **El canje avisa al consumidor** (push al pase de Wallet, como ya hace la acreditación).
7. **Catálogo de premios en el wallet del consumidor, dentro de este arco.** El botón `i` de
   cada programa hoy abre los términos directo; pasa a abrir **dos accesos**: «Términos y
   condiciones» (lo actual) y «Catálogo de premios» (nuevo).
8. **El flujo es: el mostrador escanea el QR del cliente, el cliente elige el premio, el
   operador confirma.** Ratificado explícitamente. Queda descartado el *inbox* de solicitudes
   (el cliente escanea un QR de catálogo y pide; el staff aprueba) — ver `## Alcance`.
9. **Canje sin saldo suficiente: el saldo vuelve a 0. Nunca queda negativo.** Es la única
   forma que tiene el canje con saldo insuficiente. Palabras del owner: *«tenés 9 de 10 sellos
   y canjeás, volvés a 0; querés canjear un premio de 100 puntos y tenés 80, volvés a 0»*. Se
   debita lo que haya y el log registra **lo que costaba** (`reward_points_cost`) y **lo que se
   pagó** (`units_debited`), así la contabilidad muestra exactamente cuánto se regaló.

## Alcance

**Entra:**

- **`core.reward_redemption`**: log append-only del canje, con **snapshot** del premio.
- **Débito atómico e idempotente** por `client_request_id`, con el guard de saldo **dentro
  del `UPDATE`** (no un pre-read): dos canjes concurrentes con saldo para uno solo dejan
  exactamente uno.
- **`POST /api/counter/redeem`** + dominio `server/counter/redeem.ts` (+ `redemptions.ts`
  para el statement, así `orders.ts` no cruza `file-size`).
- **Tercer modo en la consola de mostrador**: junto a venta detallada / venta rápida, un
  modo **Canjear** que lista los premios del programa con su costo y su estado
  (*canjeable* / *faltan N*), selección única y confirmación.
- **`resolve` devuelve los premios** (DTO nuevo `rewards`), para que la consola pinte la
  lista con el mismo escaneo que ya hace.
- **Configuración avanzada del programa**: `redeem_allow_insufficient` en
  `core.loyalty_program` + su control en el paso de premios del wizard (paso 4).
- **Push transaccional** del canje, encolado en la **misma transacción** (outbox, ADR 0037).
- **Catálogo de premios en el wallet del consumidor**: el botón `i` abre un selector de dos
  accesos; el catálogo lista los premios con costo y cuánto falta para cada uno.
- **El canje aparece en el historial del día** de la consola, junto a las acreditaciones.

**No entra (explícito):**

- **La opción 2 del flujo** (el cliente escanea un QR de catálogo, pide el premio y el staff
  aprueba desde un *inbox*). Descartada para esta spec: no quita fricción, la mueve — el
  staff igual confirma y entrega, así que agrega un paso **antes**, no en lugar de. Y la
  solicitud **no prueba quién está parado en el mostrador**, mientras que el escaneo del QR
  **es** la identificación que el owner pidió auditar. Si algún día se quiere (ej. cola en
  hora pico), es **aditiva** sobre esta misma tabla: una `redemption_request` que termina
  llamando al mismo confirmar. Esta spec no cierra esa puerta.
- **Editar o anular un canje.** El log es append-only, como la orden de 0030. Un canje mal
  hecho se corrige con una acreditación manual, no mutando la historia.
- **Stock / inventario del premio.** No existe en el producto y no se introduce acá.
- **Tablero de analítica por local.** Esta spec **deja el dato** (`location_id` en cada
  canje, ADR 0042); el tablero es otra feature.
- **Vencimiento de puntos, canje parcial, o canjear más de un premio por operación.**
- **Cambiar la mecánica de acumulación** (0036) o el flujo de acreditación (0030).

## Diseño

### Especificación técnica

**Arquitectura.** El canje reusa punta a punta lo que 0030 ya construyó: el escaneo
(`counter/resolve.ts`), la resolución del operador y su negocio (`api/counter/_auth.ts` →
`requireOperator`) y el error tipado `CounterError`. Lo nuevo es un débito en vez de un
incremento, una tabla propia para el registro, y **un mecanismo de idempotencia distinto**
(ADR 0054: el de `persistGrant` está roto — no se copia).

**Hueco de autorización que hay que cerrar acá, no heredar.** `operatorBusiness`
(`counter/core.ts:39-50`) filtra **sólo** por `userId`: no mira `role` **ni `status`**, pese a
que `business_membership` define `status in ('active','disabled')` y el ADR 0044 dice que un
miembro `disabled` pierde el acceso. Hoy eso ya afecta a `grant`; el canje **entrega mercadería
y destruye saldo**, así que un empleado desvinculado no puede poder canjear. `operatorBusiness`
suma `status = 'active'` — arregla los tres endpoints de una, y **necesita su propio test** (el
canje es quien lo trae, así que la cobertura es de esta spec).

#### Modelo de datos (migración aditiva, próximo número correlativo)

**`core.reward_redemption`** (`server/schema/reward-redemption.ts`), nueva:

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid pk | |
| `business_id` | uuid not null → `core.business` (cascade) | la dimensión "por marca" |
| `location_id` | uuid → `core.location` (set null), nullable | la dimensión "por local" (ADR 0042) |
| `program_id` | uuid not null → `core.loyalty_program` | |
| `membership_id` | uuid not null → `consumer.program_membership` | **la tarjeta que reclama** |
| `consumer_id` | uuid not null → `consumer.consumer_account` | quién reclama |
| `reward_id` | uuid → `core.loyalty_reward` **ON DELETE SET NULL**, nullable | ver nota ⚠️ |
| `reward_type` | text not null | snapshot (`catalog_product`/`custom`/`discount`) |
| `reward_label` | text not null | snapshot del nombre entregado |
| `reward_discount_percent` | integer nullable | snapshot |
| `reward_points_cost` | integer nullable | snapshot de **lo que costaba** al canjear |
| `accrual_kind` | text not null, check `in ('points','stamps')` | |
| `units_debited` | integer not null, check `>= 0` | lo que **efectivamente** se restó |
| `balance_before` | integer not null, check `>= 0` | |
| `balance_after` | integer not null, check `>= 0` | |
| `insufficient_override` | boolean not null default false | el canje se entregó sin saldo (§5) |
| `created_by_user_id` | text not null → `merchant_auth.users` | **quién confirmó** |
| `client_request_id` | uuid not null | idempotencia |
| `created_at` | timestamptz not null default now() | |

- `unique (business_id, client_request_id)` — idempotencia, igual que `core.order`.
- Índices: `(membership_id)`, `(business_id, created_at)`, `(program_id)` y **`(reward_id)`**
  — sin este último, el `ON DELETE SET NULL` hace un seq scan del log entero **por cada premio
  borrado**, y `saveProgram` borra todos los premios del programa en **cada** guardado.
- Check `reward_points_cost IS NOT NULL OR accrual_kind = 'stamps'`: un canje de Puntos sin
  costo registrado no es contabilidad, es una fila rota (ver el caso `NULL` más abajo).

> ⚠️ **Por qué el premio se snapshotea y su FK es nullable.** `saveProgram`
> (`loyalty-program/persistence.ts`, spec 0036) **borra todos los `loyalty_reward` del
> programa y los re-inserta** en cada guardado: **el `reward_id` no es estable**. Si el log
> guardara sólo la FK, editar el programa borraría la historia de qué se entregó. El
> snapshot (`reward_type`/`label`/`discount_percent`/`points_cost`) es la fuente de verdad
> del log; la FK queda como referencia best-effort. Mismo criterio que `order_item.product_id`
> en 0030.

**Por qué tabla propia y no `mode = 'redeem'` en `core.order`.** La orden tiene
`mode in ('detailed','quick')`, `total >= 0`, `currency_code` y `units_granted >= 0`: su
semántica es *una venta que acredita*. Un canje no tiene venta, ni total, ni moneda, y su
unidad es un débito. Meterlo en `order` obliga a relajar esos checks y a que **toda** consulta
de analítica de ventas recuerde filtrar `mode <> 'redeem'` — un olvido infla las ventas del
negocio con canjes. Con dos tablas, los checks se quedan estrictos en las dos.

**`core.loyalty_program`** — columna nueva `redeem_allow_insufficient boolean NOT NULL
DEFAULT false`. `false` = el canje se bloquea sin saldo (comportamiento por defecto);
`true` = el operador puede entregarlo igual. Aditiva, sin migrar datos (§5).

#### Débito atómico e idempotente (`counter/redemptions.ts`) — transacción interactiva

**No se usa el statement único con CTEs de `persistGrant`: su idempotencia está rota** (ADR
0054, verificado ejecutándolo — el `NOT EXISTS` se planea como `InitPlan` + `One-Time Filter`,
se evalúa una vez **antes** del lock, y produce doble incremento). El canje nace con el patrón
que el ADR 0054 §2 fija para todo flujo que mute saldo: **transacción interactiva**
(`withDbTransaction`, `db.ts:36`, documentada literalmente *«for flows that must hold a
row/advisory lock across steps»*).

```
withDbTransaction(async (tx) => {
  // 1. Tomar el lock de la membresía. Serializa TODOS los canjes de esta tarjeta.
  const m = await tx.select(...).from(programMemberships)
                    .where(eq(id, membershipId)).for('update')          // SELECT … FOR UPDATE
  if (!m) throw new CounterError(403, 'foreign_membership', …)

  // 2. Con el lock tomado, la idempotencia es un simple read: cualquier canje concurrente
  //    con este client_request_id ya commiteó (nos esperó) o todavía no empezó (nos espera).
  const previo = await tx.select(...).from(rewardRedemptions)
                         .where(and(eq(businessId, …), eq(clientRequestId, …)))
  if (previo) {
    if (previo.rewardId !== rewardId) throw new CounterError(409, 'request_id_reused', …)
    return previo                                    // reintento idempotente: no debita
  }

  // 3. Decidir con la FUNCIÓN PURA, sobre el saldo bloqueado y fresco.
  const plan = planRedemption({ kind, target, balance: saldoBloqueado, reward, allowInsufficient })
  if ('error' in plan) throw new CounterError(422, plan.error, …)

  // 4. Escribir lo que decidió la función pura. Sin GREATEST, sin aritmética en SQL.
  await tx.update(programMemberships).set({ [col]: plan.balanceAfter }).where(eq(id, …))
  const fila = await tx.insert(rewardRedemptions).values({ …, unitsDebited: plan.unitsToDebit,
                        balanceBefore: saldoBloqueado, balanceAfter: plan.balanceAfter,
                        insufficientOverride: plan.override, … }).returning()
  const push = await tx.insert(walletPushQueue).values({ … }).returning()
  return { fila, push }
})
```

Invariantes que esto compra, y **por qué cada uno es mejor que en la variante de un statement**:

- **La idempotencia la sostiene el lock, no una propiedad del planner.** El paso (2) es un
  read normal, pero se ejecuta con la fila de la membresía bloqueada: dos canjes con el mismo
  `client_request_id` no pueden estar en el paso (2) a la vez. No depende de que Postgres
  re-evalúe un qual bajo EvalPlanQual — que es justamente lo que **no** hace (ADR 0054).
- **`planRedemption` es el decisor real, no una aritmética paralela.** El valor que la función
  pura calcula **es** el que se escribe. En la variante de un solo statement el `GREATEST`
  decidía en SQL y la función pura era una segunda implementación del mismo cálculo: los unit
  podían estar todos verdes mientras el SQL debitaba otra cosa. Esto cierra el hueco de
  "cableado sin oráculo" que esta spec declaraba abierto.
- **El saldo nunca queda negativo** porque `planRedemption` nunca devuelve un `balanceAfter`
  negativo (clamp a 0, §9) y es lo único que escribe. Los checks de DB
  (`points_balance >= 0`, `stamps_count >= 0`) **quedan como red**: si alguna vez el código
  intentara escribir un negativo, la transacción aborta. Red, no mecanismo.
- **`insufficient_override` y `balance_before` salen del saldo BLOQUEADO**, no de un pre-read.
  Con un pre-read, una acreditación concurrente hacía que el cliente pagara el precio completo
  y el log dijera que se le regaló — inflando justo el dato que el owner pidió para auditar.
- **El push se encola dentro de la misma transacción**: un rollback no deja push, y el
  reintento idempotente sale por (2) sin encolar nada.
- **`unique (business_id, client_request_id)` se conserva como backstop** (ADR 0054 §3), no
  como mecanismo: si dos transacciones llegaran a insertar igual, el `23505` aborta y el
  llamador re-lee.

**Costos aceptados.** El canje usa el pool WS de `withDbTransaction` en vez de `neon-http`, así
que conviven dos drivers en `server/counter/*` hasta que el grant migre (deuda anotada en el
ADR 0054; con el fix de la **spec 0056** el grant es correcto). Y son varios round-trips dentro
de una transacción: aceptable para una acción de mostrador, y el lock se toma sobre **una fila**
de una membresía concreta, así que no serializa el negocio entero.

**Parámetros `NULL`: se validan ANTES de la transacción.** `GREATEST(x - NULL, 0)` devuelve
**`0`** en Postgres (ignora los NULL) y `dispensa OR NULL` es `true`: en la variante de un
statement, un premio con `points_cost` nulo **borraba el saldo entero** sin que ningún check lo
frenara (verificado). `loyalty_reward.points_cost` **es nullable** y su check sólo dice
`IS NULL OR > 0`, así que la forma es representable. `planRedemption` **rechaza** un premio sin
`points_cost` en un programa de Puntos (`422 invalid_reward`), y la tabla gana el check
`reward_points_cost IS NOT NULL OR accrual_kind = 'stamps'` para que la contabilidad tampoco
acepte la fila.


#### Decisión de canje como función pura (`counter/redeem-plan.ts`)

`planRedemption({ kind, target, balance, reward, allowInsufficient })` →
`{ unitsToDebit, balanceAfter, override } | { error }`. Es donde vive la aritmética:

- **Puntos**: `cost = reward.points_cost`; `balance >= cost` → debita `cost`.
- **Sellos**: `target` (leído de `configuration.target` del programa — **no es columna**,
  vive en el jsonb, ver `consumer/programs.ts`); `stamps_count >= target` → debita `target`,
  **el resto queda como arrastre** (§3: 12 con tarjeta de 10 → debita 10, quedan 2).
- **`target` inválido → `422 invalid_program`, nunca un canje.** `programs.ts:81` hace
  `Number(configuration.target)`, y `Number(null)` / `Number("")` / `Number(false)` dan **`0`**,
  que es finito y pasa cualquier filtro de "es número". Con `target = 0` el guard
  `stamps_count >= 0` es siempre verdadero → **canje gratis ilimitado con `units_debited = 0`**.
  `validateProgramInput` garantiza un entero en [2,50] **sólo** por el camino de `saveProgram`,
  y el corpus de tests ya inserta `configuration: {}` con `kind: 'stamps'`: la forma es
  representable. `planRedemption` exige **entero `>= 1`** y trata `null`/`0`/`NaN` como error.
- **Saldo insuficiente** con `allowInsufficient = false` → `error: 'insufficient_balance'`.
- **Saldo insuficiente** con `allowInsufficient = true` (§9) → `unitsToDebit = balance`,
  `balanceAfter = 0`, `override = true`. Cubre los dos ejemplos del owner: 9 sellos de 10 → 0;
  80 puntos contra un premio de 100 → 0. **Caso borde explícito en la tabla:** saldo 0 con la
  dispensa activa → `unitsToDebit = 0`, `override = true` — el premio se entrega de cortesía y
  el log lo dice.
- **La función es el decisor, no un oráculo paralelo.** Con la transacción interactiva, el
  `balanceAfter` que devuelve **es** el que se escribe (no hay aritmética en SQL que pueda
  discrepar). Ése era el hueco que esta spec declaraba abierto y que el diseño anterior —clamp
  en el `SET`— dejaba sin cerrar. Lo que **sigue** sin oráculo unitario es que el llamador la
  invoque con el saldo **bloqueado** y el premio correcto: eso lo cubre la integración Neon,
  no el unit, y se declara acá en vez de taparse con un regex.

Se extrae a función pura **con tabla de casos como oráculo** por la lección de la tarea 38:
un barrido estático no pinnea una propiedad de comportamiento. Y se declara explícitamente
**lo que extraer NO cubre**: el *cableado* (que el endpoint llame a esta función con el saldo
y el premio correctos) queda sin oráculo unitario y se cubre en la integración Neon.

#### Rutas

- **`POST /api/counter/redeem`** (runtime nodejs, `requireOperator`) —
  body `{ clientRequestId, membershipId, rewardId, locationId? }`.
  → `200 { redemption: { rewardLabel, rewardType, discountPercent, unitsDebited,
  balanceAfter, kind, override } }`.
  Errores: `401` sin sesión; `403` `foreign_membership` (membresía de otro negocio) o sin
  negocio; `404` `no_program`; `409` `request_id_reused` (mismo `clientRequestId` con **otro**
  `rewardId`: sin esto la consola le diría al operador que entregue un premio distinto del que
  eligió); `422` `unknown_reward` (el premio no es del programa o fue reescrito),
  `insufficient_balance`, `invalid_reward` (premio sin `points_cost` en Puntos),
  `invalid_program` (Sellos con `target` no entero o `< 1`), `invalid_input`, `unknown_location`.

  **La clasificación de errores es explícita, no por descarte.** Cada `CounterError` sale de
  una condición nombrada dentro de la transacción; una excepción inesperada (deadlock,
  `statement_timeout`, membresía inexistente) **nunca** se traduce a `insufficient_balance` —
  cae al `503` de `counterError`, que es el fallback existente.
- **`POST /api/counter/resolve`** (existente) — su DTO suma
  `rewards: [{ id, type, label, discountPercent, pointsCost, imagePath }]`, ordenados por
  `position`, y `program.redeemAllowInsufficient`. Sigue sin serializar `qr_token`
  (allow-list; regla de CLAUDE.md, test por entidad).

**Programa canjeable** = el mismo `accreditableProgram` de `resolve.ts`: estados `active` y
`closing`. Un programa en `closing` **debe** poder canjear — es exactamente la ventana en la
que el consumidor quema su saldo.

#### UI — consola de mostrador

`ResolvedStage` gana un tercer modo junto a *detallada* / *rápida*: **Canjear**.

- **Puntos**: lista de premios; cada uno con su costo y su estado — *Canjear* si
  `balance >= cost`, o «Faltan N puntos» si no (deshabilitado, salvo que el programa permita
  entregarlo igual). Selección única.
- **Sellos**: el premio único de la tarjeta, con el progreso `stamps_count` / `target` y el
  botón habilitado sólo al llegar al tope.
- Confirmar se **deshabilita al primer tap** (capa de UI de la idempotencia, igual que el
  grant; no reemplaza la de DB).
- Pantalla **hecho**: qué **entregar** (`reward_label` en grande, el % si es descuento) + el
  saldo nuevo + «Escanear siguiente» (reinicio manual, enmienda QA de 0030).

#### UI — wallet del consumidor

`program-card.tsx`: el botón `i` deja de abrir los términos directo y abre una hoja con dos
accesos — **«Términos y condiciones»** (el `TermsModal` actual, intacto) y **«Catálogo de
premios»**. El catálogo lista los premios del programa con su costo y **cuánto falta**
(`faltan N puntos` / `te faltan N sellos`), usando el saldo que el summary ya trae.

`ConsumerProgramSummary` (`server/consumer/programs.ts`) suma `rewards[]` con el `imagePath`
**público** del producto para los premios de catálogo (vía el DTO de catálogo) — **ningún
`*ObjectKey`**, regla de CLAUDE.md.

**Consecuencia técnica a registrar:** `lastActivityAt` hoy se calcula con
`max(orders.created_at)`. Un canje **es** actividad; si no se suma, canjear no reordena la
lista de programas del wallet. Se incorpora `max(reward_redemption.created_at)` al cálculo.

#### Push (ADR 0037)

`buildRedemptionBody(label, kind, balanceAfter)` junto a `buildTransactionalBody` en
`wallet/push.ts`; clase `transactional` (prioridad sobre campaña), encolado en el mismo
statement y despachado inline best-effort con el mismo `dispatchGranted(pushQueueId)`.

#### Historial del día

`listTodaysAccreditations` pasa a listar **acreditaciones y canjes** unificados por fecha
(mismo criterio de día local del negocio, DST-safe, ya implementado), con el signo/etiqueta
que distingue uno de otro.

### Arquitectura de referencia

- **ADR 0037** — outbox transaccional de push, prioridad y cooldown.
- **ADR 0042** — `location_id` como dimensión universal de todo evento de valor; el ADR ya
  dejó escrito que **el canje futuro nace con `location_id`**. Esta spec lo cumple.
- **ADR 0044** — roles `owner`/`staff`; los dos operan el mostrador.
- **spec 0030** — orden como ledger owner-facing, atomicidad, idempotencia en dos capas.
- **spec 0036** — premios y mecánica (define; esta spec **ejecuta** el canje, cerrando el
  hueco entre 0030 y 0036).

## Archivos

| Archivo | Acción |
|---|---|
| `src/server/schema/reward-redemption.ts` | crear |
| `src/server/schema/loyalty.ts` | editar — `redeem_allow_insufficient` |
| `src/server/schema.ts` (barrel) | editar — registrar la tabla |
| `apps/merchant/drizzle/0028_*.sql` (+ `meta/`) | crear — migración aditiva (la última aplicada es `0027_good_drax`) |
| `src/server/counter/redeem.ts` | crear — validación + orquestación |
| `src/server/counter/redeem-plan.ts` | crear — decisión pura (oráculo de tabla) |
| `src/server/counter/redemptions.ts` | crear — transacción interactiva (`withDbTransaction`) + re-lectura |
| `src/server/counter/counter.ts` (barrel) | editar |
| `src/server/counter/core.ts` | editar — `operatorBusiness` filtra `status = 'active'` |
| `src/server/counter/resolve.ts` | editar — premios + flag en el DTO |
| `src/server/counter/history.ts` | editar — canjes en el historial del día |
| `src/server/wallet/push.ts` | editar — `buildRedemptionBody` |
| `src/server/consumer/programs.ts` | editar — `rewards[]` + `lastActivityAt` |
| `src/server/loyalty-program/*` (core/validation/client-view) | editar — config avanzada |
| `src/server/loyalty-program.ts` | editar — `saveProgram:97` escribe el flag en **dos** sitios: UPDATE (`:148`) e INSERT (`:159-181`) |
| `app/api/counter/redeem/route.ts` | crear |
| `app/backoffice/counter/{counter-console,stages}.tsx` + `types.ts` | editar — modo Canjear (el tipo `Mode` está **duplicado y sin exportar** en `counter-console.tsx:18` y `stages.tsx:18`: hoistearlo a `types.ts`) |
| `app/backoffice/counter/redeem-panel.tsx` | crear (si `stages.tsx` cruza `file-size`) |
| `app/backoffice/loyalty/steps/step-rewards.tsx` | editar — configuración avanzada |
| `app/backoffice/loyalty/{use-loyalty-program,use-rewards}.ts` | editar — el flag viaja en el payload y se hidrata al editar |
| `app/(consumer)/wallet/program-card.tsx` | editar — el `i` abre dos accesos |
| `app/(consumer)/wallet/rewards-modal.tsx` | crear — catálogo de premios |
| `app/(consumer)/wallet/program-info-sheet.tsx` | crear — la hoja de dos accesos (`TermsModal` tiene título y copy hardcodeados en `terms-modal.tsx:42`: **no** es genérico, no se reusa como contenedor) |
| `app/globals.css` / estilos del panel | editar |
| tests unit (`redeem-plan`, `types`) + integración Neon (`redeem`) | crear |
| `docs/adr/0053-*.md`, `docs/INDEX.md`, `docs/TASKS.md` | crear/editar |

#### Riesgo de `file-size` (hook, 300 líneas)

Medido hoy: `counter/grant.ts` **298** (cualquier toque lo cruza — el canje **no** debe
escribirse ahí), `use-loyalty-program.ts` 273, `loyalty-program.ts` 268, `wallet/push.ts` 262,
`counter-console.tsx` 256, `schema/loyalty.ts` 250, `stages.tsx` 243. El modo Canjear entra por
componentes nuevos (`redeem-panel.tsx`), no engordando los existentes.

### Disjunta?

**No**, pero hoy **no colisiona con nada**: no hay otra spec abierta. Toca tres dominios
(counter, loyalty wizard, wallet del consumidor) y el barrel de schema, así que **se
implementa sola**, sin paralelizar. Contra las specs implementadas (0030/0036/0043/0054) no
hay conflicto: las extiende aditivamente.

### Archivos compartidos

| Qué | Quién | Cuándo |
|---|---|---|
| Contrato del DTO de premio (compartido por `resolve`, el wizard y el wallet) | orquestador | antes de despachar |
| Forma exacta de `planRedemption` + su tabla de casos | orquestador | antes de despachar |

## Definition of Done

- [ ] Escanear el QR, elegir un premio y confirmar **entrega el premio y debita**: Puntos
      resta `points_cost`; Sellos consume `target` y **deja el arrastre** (12 con tarjeta de
      10 → quedan 2).
- [ ] El canje queda registrado en `core.reward_redemption` con **premio (snapshot),
      membresía, consumidor, operador, negocio y local**, y con `balance_before`/`after`.
- [ ] **Editar el programa después de un canje no altera el log**: `reward_id` queda `NULL`
      y `reward_label`/`reward_points_cost` siguen intactos.
- [ ] Reintento con el mismo `client_request_id` → **un solo canje**, saldo debitado una vez,
      **verificado leyendo el saldo por SQL** (la respuesta de la API no sirve como oráculo:
      en el bug del ADR 0054 reportaba un saldo que no existía).
- [ ] Dos canjes **concurrentes** con el mismo `client_request_id` → **un débito, no dos**
      (el caso exacto que el patrón de `persistGrant` fallaba).
- [ ] Mismo `client_request_id` con **otro** `rewardId` → `409`, sin débito.
- [ ] 8 canjes concurrentes con saldo para uno, **con `redeem_allow_insufficient = false`** →
      exactamente uno ocurre; el resto `422`.
- [ ] Con `redeem_allow_insufficient = true` **no hay tope**: N canjes concurrentes → N filas
      con `units_debited = 0` a partir del primero. **Es coherente con §9 y queda declarado**:
      la dispensa es una decisión del owner que renuncia al tope, y `api/counter/*` no tiene
      rate limit. Si el owner quiere un tope, es otra spec.
- [ ] Un premio con `points_cost` nulo en un programa de Puntos → `422`, **el saldo no se
      toca** (sin el fix, `GREATEST(x - NULL, 0)` lo dejaba en 0).
- [ ] Un programa de Sellos con `target` nulo/0 → `422`, nunca un canje gratis.
- [ ] Un operador con `business_membership.status = 'disabled'` → **no puede canjear**.
- [ ] Saldo insuficiente con la config en `false` → `422` y **cero efectos** (sin fila, sin
      débito, sin push).
- [ ] Saldo insuficiente con la config en `true` → el canje ocurre, **el saldo queda en 0**
      (9 sellos de 10 → 0; 80 puntos contra un premio de 100 → 0), `units_debited` = lo que
      había, `reward_points_cost` = lo que costaba, `insufficient_override = true`.
- [ ] **`insufficient_override` no miente bajo concurrencia**: si una acreditación entra entre
      la resolución y la confirmación y el saldo alcanza, el canje debita el precio completo y
      la fila queda con `insufficient_override = false`.
- [ ] **El saldo nunca queda negativo** en ninguna combinación de las de arriba (verificado
      por SQL, no por la respuesta de la API).
- [ ] El consumidor recibe el push del canje; un reintento idempotente **no** re-notifica.
- [ ] Operador de otro negocio → `403`; premio de otro programa → `422`.
- [ ] Ningún DTO serializa `qr_token`/`token_hash`/`web_view_token`/`*ObjectKey`.
- [ ] En el wallet, el `i` ofrece **Términos** y **Catálogo de premios**, y el catálogo
      muestra costo y cuánto falta.
- [ ] El canje aparece en el historial del día de la consola.
- [ ] Migración aditiva aplicada y verificada por SQL en prod; `core`/`consumer`/
      `merchant_auth` intactos.
- [ ] Ningún archivo cruza `file-size` (300).
- [ ] Gates verdes (typecheck, lint, test, build) + **PASS de revisor independiente**.

## Plan de pruebas y verificación

- [ ] **Unit `redeem-plan`** (tabla de casos como oráculo): puntos con saldo justo / de sobra
      / insuficiente; sellos exacto / con arrastre / por debajo del tope; `target` ausente o
      inválido en `configuration`; premio sin `points_cost` en un programa de Puntos;
      **con la dispensa activa**: 80 vs. costo 100 → debita 80 y queda 0; 9 sellos vs. tarjeta
      de 10 → debita 9 y queda 0; saldo 0 → debita 0, `override = true`.
- [ ] **Unit `types`**: el estado por premio (*canjeable* / *faltan N*) que pinta la consola.
- [ ] **Integración Neon (rama efímera)**: canje feliz (puntos y sellos, con arrastre);
      idempotencia (doble POST → un canje); **concurrencia 8-way** con saldo para uno;
      insuficiente → `422` + **cero efectos verificados por SQL**; aislamiento `403`;
      **snapshot sobrevive al `saveProgram`** que reescribe los premios; push encolado
      exactamente una vez; **dispensa**: el saldo cae a 0 y `units_debited` = el saldo previo;
      **canje ‖ acreditación**: el canje debita sobre el saldo **bloqueado y fresco**, y
      `balance_before`/`insufficient_override` describen lo que realmente pasó.
- [ ] **Integración Neon — la carrera que el patrón viejo fallaba**: dos canjes **concurrentes**
      (`Promise.all`, sin serializar) con el **mismo** `clientRequestId` → **un solo débito**,
      aseverado leyendo `points_balance`/`stamps_count` **por SQL**, más 1 fila de log y 1 push.
      Es el test que la spec 0056 exige para el grant, replicado del lado del débito.
- [ ] **Regresión**: acreditación (0030), historial del día (0043) y wallet (0031/0054)
      siguen verdes; la lista de programas ordena por actividad incluyendo canjes.
- [x] **Mutaciones** (evidencia de que cada test muerde). **CORREGIDO EL 2026-09-08 CONTRA LA
      EJECUCIÓN REAL: la predicción de (a) y (b) que esta spec traía escrita era FALSA.** Se deja
      el texto viejo tachado abajo a propósito, porque el error es instructivo.
      - **(a) sacar el `FOR UPDATE` del paso (1) → rojo el de 8 CONCURRENTES con saldo para uno**
        (pasa de *1 éxito / 7 `422`* a **8 éxitos**), y rojo el de `insufficient_override`.
        **La carrera de mismo `clientRequestId` queda VERDE.** Verificado por el revisor y
        re-verificado por el orquestador ejecutándolo.
      - **(b) mover `planRedemption` a un pre-read fuera de la transacción → EL MISMO conjunto
        rojo que (a)**, idéntico. (a) y (b) **no son distinguibles por esta suite.**
      - (c) devolver el `reward_id` a `NOT NULL`/sin snapshot → **rojo** el de supervivencia al
        `saveProgram` (`23503`, una sola roja).
      - (d) aceptar `points_cost` nulo en `planRedemption` → **rojo** los casos 6 y 7 del unit
        **y** el de integración. Bonus: el que falla en integración es el *check de tabla*
        `reward_points_cost IS NOT NULL OR accrual_kind = 'stamps'` — la segunda red también muerde.
      - (e) sacar el filtro `status = 'active'` de `operatorBusiness` → **rojo** el del operador
        deshabilitado.

      > ~~(a) sacar el `FOR UPDATE` → **rojo** la carrera de mismo `clientRequestId` (sin el lock,
      > el read del paso (2) deja de ser seguro); (b) → **rojo** el test de `insufficient_override`
      > y **verde el resto**: por eso hace falta ese test específico.~~

      **Por qué estaba mal, y por qué importa más que el error en sí.** Con el mismo
      `client_request_id`, las dos transacciones chocan igual contra
      `unique (business_id, client_request_id)`: el `23505` aborta y **revierte** el `UPDATE` del
      saldo (no hay `ON CONFLICT DO NOTHING` — ésa es justamente la diferencia con el bug del ADR
      0054). O sea **para ese caso el índice único solo ya alcanza, y el lock no es lo que lo
      salva**. El `FOR UPDATE` sí es load-bearing, pero su oráculo es **el test de 8 concurrentes**,
      no la carrera homónima. Escribir lo contrario habría dejado en la spec la misma clase de
      defecto que causó el ADR 0054: **un documento afirmando un invariante que el test no pinnea**,
      y el próximo lector creyéndole. La lección se generaliza: *el nombre de un test no es
      evidencia de qué propiedad pinnea* — sólo la mutación lo dice.

      **Anti-falso-verde (verificado, se sostiene):** las aserciones de las dos rojas son sobre la
      **fila del log** (`insufficientOverride`, `unitsDebited`, `balanceBefore`), no sobre el saldo.
- [ ] **Comandos exactos** (Node 24, scripts de ROOT): `pnpm run typecheck && pnpm run lint &&
      pnpm run test && pnpm run build` + integración Neon del dominio `counter`.
- [ ] **Manual (owner, teléfono real sobre Vercel)**: crear un programa con premios, acreditar
      hasta pasar el tope, canjear, ver el saldo/arrastre por MCP, recibir el push, y abrir el
      catálogo de premios desde el `i` del wallet.

## Handoff requerido

Implementador + **revisor independiente** con `PASS` verificable (`docs/AGENT-WORKFLOW.md`)
antes de `implementada`. Rama Neon efímera para la integración; migración a prod **después**
del PASS. **Antes de pedirle QA al owner, verificar que prod tenga EL COMMIT** a probar
(`gh api repos/maxhost/check-point/commits/<sha>/status`).

## Abierto

**Nada bloquea el cierre.** Los dos items que estaban abiertos los resolvió el owner el
2026-09-07 y viven en «Decisiones cerradas» §8 (flujo ratificado) y §9 (el saldo vuelve a 0,
nunca negativo).

**Marcado como propuesta del asistente, no pedido por el owner (no bloqueante):** que el canje
aparezca en el **historial del día** de la consola. Se deriva del pedido de auditoría y entra
en el alcance; si el owner lo saca al verlo, es un ajuste de UI sin impacto en el modelo de
datos ni en el contrato.

**A decidir durante la implementación** (sin impacto en contrato ni en modelo de datos): el
copy exacto del push de canje y la presentación del catálogo de premios en el wallet.

**Declarado fuera de alcance por la revisión (no son huecos, son límites):**

- **Qué significa "entregar" un premio de tipo `discount`.** Se debita el costo y la pantalla
  muestra el porcentaje; **no** hay integración con el total de una venta (no se puede aplicar
  el descuento a una orden desde acá). Si el owner lo quiere, es otra spec.
- **Tope de canjes con la dispensa activa.** Ver DoD: con `redeem_allow_insufficient = true`
  no hay límite y `api/counter/*` no tiene rate limit. Es consecuencia directa de §9.
- **`business_id` con `ON DELETE CASCADE`** borra el log junto con el negocio (consistente con
  `core.order`, pero en tensión con "append-only para auditar a futuro"). Se mantiene la
  consistencia con `order`; si la auditoría tiene que sobrevivir al borrado del negocio, es una
  decisión transversal a las dos tablas, no de esta spec.
- **`redeem_allow_insufficient` va en columna y no en el jsonb `configuration`** (donde vive
  `target`): es un flag que el server lee en cada canje y que quiere un default explícito a
  nivel DB; `configuration` ya demostró que degrada silenciosamente (`Number(null) === 0`).

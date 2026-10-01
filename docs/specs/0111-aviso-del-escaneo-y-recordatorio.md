---
spec: 0111
fecha: 2026-09-29
estado: implementada
resumen: El aviso del mostrador invita a abrir la cuenta y suena como mucho 2 veces cada 24 h (el 3.º se acredita en silencio); nunca salen mas de 3 avisos con sonido por cliente cada 24 h (el tope de Google), y el dia sin compra sale 1 recordatorio a su hora habitual (12:30 por defecto) si tiene un cupon nuevo o por vencer, o si lleva 2 dias sin actividad. Migracion 0056.
disjunta: no
archivos: apps/merchant/src/server/wallet/{push.ts,push-text.ts,push-plan.ts,push-worker.ts,push-transports.ts,push-budget.ts,push-budget-store.ts,reminder.ts,reminder-store.ts}, apps/merchant/src/server/schema/{consumer.ts,wallet-push.ts}, apps/merchant/drizzle/0056_*.sql, apps/merchant/src/app/(consumer)/c/[webViewToken]/route.ts, apps/merchant/src/app/(consumer)/wallet/page.tsx
---

# 0111 — El aviso del escaneo y el recordatorio

> Implementa las decisiones 3 y 7 del **ADR 0103** (`adr/0103-los-beneficios-viven-en-la-cuenta-y-la-wallet-solo-avisa.md`).
> Plantilla grande: hay migracion.

## Problema

El pase es UNO para toda la red y Google Wallet acepta **3 avisos con notificacion por pase cada 24 h**; el
cuarto responde `QuotaExceededException` (doc oficial, leida el 2026-09-29). Hoy:

- **Cada evento del mostrador suena**, sin tope: acreditar (`counter/orders.ts:147-155`), canjear premio
  (`counter/redemptions.ts:217`) y canjear cupon (`counter/coupon-store.ts:248`) encolan una fila
  `transactional` que siempre se envia (`wallet/push-plan.ts`, `planConsumerDrain`: «`transactional` always
  sends») por `addMessage` con `TEXT_AND_NOTIFY` (`wallet/google-object.ts:142-165`) y, en Apple, cambiando el
  campo con `changeMessage` (`wallet/apple.ts:86-94`). Un cliente con 4 compras en un dia pierde el 4.º aviso
  en Android, y cualquier aviso de campaña ese dia.
- **El texto no invita a nada**: «Se acreditó 1 sello en tu cuenta 🎉» (`wallet/push-text.ts:13-28`).
- **Nada le recuerda al cliente que abra su cuenta** el dia que no compra, y no se sabe cuando la abrio por
  ultima vez (no hay columna: `schema/consumer.ts:40-50`).
- `QuotaExceeded` no tiene manejo propio (grep vacio, `docs/TASKS.md`).

## Decisiones del owner que esta spec implementa (2026-09-29, textuales resumidas)

- ADR 0103 §3: el aviso del escaneo acredita **e invita a abrir checkpass.club**; **hasta 2 por dia si compra**;
  si no compra, **1 por dia** para recordar abrir la cuenta. La Wallet nunca lleva un cupon de otro comercio.
- ADR 0103 §7: el recordatorio sale **«si hay algo nuevo o al menos pasaron 2 dias sin actividad en
  checkpass.club, es decir no fue a ningun sitio ni escanearon nada»**.
- AskUserQuestion: cuentan para el tope **«las tres»** (acreditar, canjear premio, canjear cupon); el dia del
  tope son **«las ultimas 24 horas»**; «algo nuevo» = **cupon nuevo** y **cupon por vencer** (48 h).
- Hora del recordatorio (textual): «podemos establecerlo a las 12:30 […] pero luego deberia ser adaptativo a
  cada perfil de cliente, si un cliente suele comprar cerca de x hora la notificacion deberia aparecer cerca de
  ese horario o en franjas que no compra si son para llevar gente a un lugar en hora valle».

## Alcance

**Entra:**
- Texto nuevo de los tres avisos del mostrador (con la invitacion).
- Tope de avisos del mostrador: 2 cada 24 h moviles; el 3.º y siguientes no suenan.
- Tope global: nunca mas de 3 avisos con sonido por cliente cada 24 h moviles, sumando todas las clases.
- `consumer_account.last_opened_at` y su escritura.
- El recordatorio: clase nueva `reminder`, planificacion, condiciones, hora habitual.

**No entra:**
- La variante «en franjas que no compra» para hora valle: no existen beneficios de hora valle todavia. Va con
  la spec de horas valle (queda en `## Abierto` como insumo, no como pendiente de esta).
- «Mis beneficios», el cupon cruzado, el arbitro del orden (otras specs del ADR 0103).
- Cambiar como se decide una campaña (ADR 0095/0102): esta spec solo le pone el tope global en la entrega.
- UI nueva. El recordatorio abre lo que ya existe (el pase en Wallet con su enlace, o `/wallet` por Web Push).

## Diseño

### D1. Texto del aviso del mostrador

Constante `ACCOUNT_INVITE = "Revisa tus beneficios en checkpass.club"` en `wallet/push-text.ts`. Los tres
builders (`buildTransactionalBody`, `buildRedemptionBody`, `buildCouponBody`) terminan en
`<texto actual> · ${ACCOUNT_INVITE}`. Ejemplo: «Se acreditó 1 sello en tu cuenta 🎉 · Revisa tus beneficios
en checkpass.club» (76 caracteres). Textos provisorios aceptados por el owner (2026-09-29: «pones cualquiera
que pueda funcionar de momento»; se editaran desde un panel de administracion que hoy no existe — esta spec NO
lo construye).

**Largo (medido 2026-09-29):** ni Google ni Apple publican un maximo. Google, `Message` (reference/rest/v1/Message,
leida): `header`/`body` sin limite documentado. Apple, `PassFieldContent.changeMessage` (JSON de la doc
oficial, leido): «Localizable format string», sin limite. Lo que acota es lo que se VE: la notificacion colapsada
de Android muestra una linea y la pantalla de bloqueo de iOS unas pocas (sin fuente oficial). Regla de esta spec:
**lo importante va primero** (lo acreditado/canjeado), y el cuerpo completo **≤ 120 caracteres**
(`MAX_NOTICE_BODY = 120`, contados como `[...str].length`): si `<texto actual> · ${ACCOUNT_INVITE}` se pasa
(una etiqueta de premio larga), se manda `<texto actual>` sin la invitacion — nunca se corta lo acreditado.

### D2. El presupuesto de avisos (funcion pura, `wallet/push-budget.ts`)

Avisos «con sonido» = filas de `consumer.wallet_push_queue` con `status = 'sent'` y
`class IN ('transactional','campaign','reminder')`. `pass_refresh` nunca cuenta ni se frena. Web Push cuenta
igual que Wallet (el owner hablo de notificaciones, no de un canal).

```ts
type Budget = { counterSent24h: number; notifyingSent24h: number; oldestNotifyingSentAt: Date | null };
type BudgetDecision = { kind: "send" } | { kind: "suppress" } | { kind: "defer"; notBefore: Date };
export function decideBudget(klass: NoticeClass | "reminder", b: Budget, now: Date): BudgetDecision
```

| Clase | Regla |
|---|---|
| `transactional` | `counterSent24h ≥ 2` **o** `notifyingSent24h ≥ 3` → `suppress`; si no → `send` |
| `campaign` | `notifyingSent24h ≥ 3` → `defer` a `oldestNotifyingSentAt + 24 h`; si no → `send` |
| `reminder` | `notifyingSent24h ≥ 3` → `suppress`; si no → `send` |
| `pass_refresh` | siempre `send` |

Constantes `COUNTER_NOTICES_PER_24H = 2`, `NOTIFYING_PER_24H = 3`, `BUDGET_WINDOW_MS = 24 h`.

### D3. Cableado del presupuesto (`wallet/push-budget-store.ts` + `wallet/push.ts`)

- `loadBudget(consumerId, now)`: UNA consulta sobre `wallet_push_queue` (conteos con `filter` y `min(sent_at)`
  en la ventana `sent_at > now - 24h`).
- En `deliverClaimed` (`wallet/push.ts:127`), despues del gate de campaña y **antes** de escribir
  `latest_message` (`push.ts:145`): si la clase no es `pass_refresh`, `decideBudget(...)`:
  - `suppress` → la fila cierra con `status = 'suppressed'`, `last_error = 'budget_24h'`; **no** escribe
    `latest_message`/`message_updated_at`/`last_push_at` (si se escribiera, Apple mostraria el texto con sonido
    en la proxima descarga del pase: el `changeMessage` dispara por cambio de valor) y **no** llama a
    `deliverTransports`. El saldo ya quedo acreditado en la transaccion del mostrador; se ve en la cuenta (el
    pase no muestra saldo: `apple.ts:81-104`).
  - `defer` → `status = 'pending'`, `not_before = notBefore`; no escribe nada mas.
  - `send` → sigue como hoy.
- `push.ts` tiene 280 lineas y el limite es 300: la logica va en `push-budget-store.ts`
  (`applyBudget(id, claim, now): Promise<boolean>`), y `push.ts` solo la llama.

### D4. Migracion `0056_aviso_del_escaneo.sql`

- `alter table consumer.consumer_account add column last_opened_at timestamptz` (nullable, sin backfill).
- `wallet_push_queue_class_check` → agrega `'reminder'`; `wallet_push_queue_status_check` → agrega
  `'suppressed'`. Los `check` se reemplazan con `drop constraint` + `add constraint` en la misma migracion.
- Indice `wallet_push_queue_consumer_sent_idx on (consumer_id, sent_at) where status = 'sent'` para
  `loadBudget` y el planificador.
- `schema/consumer.ts` y `schema/wallet-push.ts` se actualizan igual; `NoticeClass` suma `"reminder"` y
  `CLASS_RANK` lo pone despues de `campaign` (`push-plan.ts`); `planTransports` rutea `reminder` igual que
  `transactional` (Wallet si es alcanzable, si no Web Push) (`push-transports.ts:182`); `parseQueueClass`
  (`push-worker.ts:25`) lo acepta.

### D5. `last_opened_at`

Se escribe `now()` cuando el cliente abre su cuenta: en `GET /c/[webViewToken]` despues de resolver el token
(`app/(consumer)/c/[webViewToken]/route.ts`) y al renderizar `/wallet` con sesion valida
(`app/(consumer)/wallet/page.tsx`). Una sola sentencia con guarda para no escribir en cada refresco:
`update … set last_opened_at = now() where id = $1 and (last_opened_at is null or last_opened_at < now() - interval '15 minutes')`.
Un fallo al escribirla no rompe la pagina (se loguea).

### D6. El recordatorio (puro: `wallet/reminder.ts`)

**Hora objetivo** — `reminderTargetMinute(scanLocalMinutes: number[]): number`:
- Entrada: minuto del dia (0–1439), en la zona del comercio de cada escaneo, de los escaneos del cliente en
  `core.order` de los ultimos 90 dias (maximo 30, los mas recientes).
- Con **≥ 3** escaneos: la mediana menos 30 minutos, recortada a `[9:00, 21:00]`.
- Con menos: **12:30** (`DEFAULT_REMINDER_MINUTE = 750`).

**Elegibilidad** — `decideReminder(input, now): { kind: "send"; reason: "coupon_new" | "coupon_expiring" | "inactive_48h" } | { kind: "skip"; why: string }`:

| # | Condicion (todas) | Si falla |
|---|---|---|
| 1 | hora local de ahora ≥ hora objetivo | `skip: not_yet` |
| 2 | ningun `reminder` creado en las ultimas 20 h (cualquier estado) | `skip: already` |
| 3 | ningun escaneo del cliente en las ultimas 24 h (dia sin compra) | `skip: scanned` |
| 4 | tiene cupon nuevo **o** cupon por vencer **o** inactividad ≥ 48 h | `skip: nothing` |

- **Cupon nuevo:** fila de `core.campaign_coupon` del cliente, sin `core.coupon_redemption`, con
  `valid_until > now` y `created_at > coalesce(last_opened_at, '-infinity')`.
- **Cupon por vencer:** sin canje, `now < valid_until ≤ now + 48 h`.
- **Inactividad:** `now - max(last_opened_at, ultimo escaneo, consumer_account.created_at) ≥ 48 h`.
- Prioridad del `reason` (elige el texto): `coupon_expiring` > `coupon_new` > `inactive_48h`.
- Zona: la del comercio del ultimo escaneo del cliente; sin escaneos, `America/Guayaquil`.

**Texto** (provisorio, aceptado por el owner; todos ≤ 80 caracteres): titulo `CheckPass`; cuerpo por `reason`:
- `coupon_expiring`: «Tienes un cupón que vence pronto · Revisa tus beneficios en checkpass.club»
- `coupon_new`: «Tienes un cupón nuevo · Revisa tus beneficios en checkpass.club»
- `inactive_48h`: «Hay beneficios esperándote · Revisa tus beneficios en checkpass.club»

### D7. Planificacion (`wallet/reminder-store.ts`)

`planReminders(now, consumerIds?)`: corre al principio de `runPushWorker` (`push-worker.ts:109`), que ya
dispara cada 5 min (`.github/workflows/wallet-push-cron.yml`). Carga en lote los candidatos (clientes con al
menos un pase o una suscripcion de Web Push), arma la entrada de `decideReminder` y, por cada `send`, inserta
UNA fila `class = 'reminder'`, `status = 'pending'`, `not_before = now` con
`insert … select … where not exists (reminder del cliente con created_at > now - 20h)` en la misma sentencia.
La fila la drena el mismo worker en esa corrida; el presupuesto (D2) se aplica al entregar.
Devuelve `{ planned: number }` y se suma a `WorkerSummary`.

### Arquitectura de referencia

ADR 0103 (este modelo), ADR 0037 (cola y cooldown), ADR 0040 (transportes por clase), ADR 0033 (pase unico,
«Ultima novedad»), spec 0065 (`pass_refresh` silencioso), ADR 0095 (push de campaña y ventana horaria).

## Archivos

| Archivo | Accion |
|---|---|
| `apps/merchant/drizzle/0056_aviso_del_escaneo.sql` (+ `meta/`) | crear |
| `apps/merchant/src/server/schema/consumer.ts` | editar (`lastOpenedAt`) |
| `apps/merchant/src/server/schema/wallet-push.ts` | editar (checks + indice) |
| `apps/merchant/src/server/wallet/push-text.ts` | editar (D1) |
| `apps/merchant/src/server/wallet/push-budget.ts` | crear (D2) |
| `apps/merchant/src/server/wallet/push-budget-store.ts` | crear (D3) |
| `apps/merchant/src/server/wallet/push.ts` | editar (llamar `applyBudget`) |
| `apps/merchant/src/server/wallet/push-plan.ts` | editar (`reminder` en `NoticeClass`/`CLASS_RANK`) |
| `apps/merchant/src/server/wallet/push-transports.ts` | editar (`planTransports` + `deliverTransports`) |
| `apps/merchant/src/server/wallet/push-worker.ts` | editar (`parseQueueClass`, llamar `planReminders`) |
| `apps/merchant/src/server/wallet/reminder.ts` | crear (D6) |
| `apps/merchant/src/server/wallet/reminder-store.ts` | crear (D7) |
| `apps/merchant/src/app/(consumer)/c/[webViewToken]/route.ts` | editar (D5) |
| `apps/merchant/src/app/(consumer)/wallet/page.tsx` | editar (D5) |
| tests nuevos en `apps/merchant/src/server/`: `wallet-push-budget.test.ts`, `wallet-reminder.test.ts`, `wallet-push-budget.neon.integration.test.ts`, `wallet-reminder.neon.integration.test.ts` | crear |
| tests existentes que asertan el texto viejo «Se acreditó…» (grep 2026-09-29: `wallet-push.neon.integration.test.ts`, `wallet-pass-refresh-deliver.test.ts`, `wallet-pass-locations.test.ts`, `wallet-push.test.ts`, `wallet-pass-locations-wiring.test.ts`) | editar SOLO el texto esperado al de D1 — es cambio de comportamiento pedido, no ajuste para que pase el gate |

### Disjunta?

**No con la spec 0110** (en espera): toca el push de campaña; esta toca la entrega de todas las clases. Se
serializan; hoy la 0110 no corre.

## Definition of Done

- [ ] Los tres avisos del mostrador terminan en «· Revisa tus beneficios en checkpass.club», salvo que el cuerpo
      pase de 120 caracteres: entonces van sin la invitacion (test con una etiqueta de premio larga).
- [ ] Con 2 avisos del mostrador enviados en las ultimas 24 h, el 3.º queda `suppressed`, no llama a ningun
      transporte y no cambia `latest_message` ni `last_push_at`; el saldo del cliente SI queda acreditado.
- [ ] Con 3 avisos con sonido en 24 h (cualquier mezcla), una `campaign` se reprograma a `oldest + 24 h` y un
      `reminder` queda `suppressed`.
- [ ] `pass_refresh` no cuenta ni se frena.
- [ ] Abrir `/c/[token]` o `/wallet` con sesion escribe `last_opened_at` (con la guarda de 15 min).
- [ ] El planificador encola 1 `reminder` para un cliente elegible y 0 para cada condicion de la tabla D6 que
      falle; correrlo dos veces seguidas no encola un segundo.
- [ ] Hora objetivo: 12:30 con < 3 escaneos; mediana − 30 min recortada a 9–21 con ≥ 3.
- [ ] Migracion 0056 aplicada en una rama efimera de Neon y en PROD (skill `gotchas-del-repo`, seccion Neon).
- [ ] Gates: `pnpm run typecheck`, `lint`, `test`, `format:check`, `build` (Node 24, scripts de root) y las
      suites `.neon.integration` nuevas con `tools/neon-test.sh`. `test:e2e` NO aplica: no hay UI nueva ni CSS.

## Plan de pruebas y verificacion

- **Unidad `wallet-push-budget.test.ts`:** tabla de D2 completa, bordes `1/2/3` y ventana exacta de 24 h.
- **Unidad `wallet-reminder.test.ts`:** `reminderTargetMinute` (0, 2, 3 escaneos; recorte a 9:00 y 21:00; mediana par)
  y `decideReminder` (una fila por condicion que falla, las tres razones y su prioridad).
- **Integracion `wallet-push-budget.neon.integration.test.ts`** (siembra filas reales): 3 acreditaciones
  seguidas por la ruta real del mostrador → 2 `sent` + 1 `suppressed`, `latest_message` = el 2.º texto,
  `points_balance`/`stamps_count` con las 3; `campaign` con 3 enviados → `pending` con `not_before` correcto.
- **Integracion `wallet-reminder.neon.integration.test.ts`:** cliente con cupon nuevo → 1 `reminder`; misma
  corrida dos veces → sigue 1; con escaneo hace 2 h → 0; con `last_opened_at` hace 1 h y sin cupon → 0.
- **Comandos:** `pnpm --filter @mi-pasaporte/merchant exec vitest run src/server/wallet-push-budget.test.ts src/server/wallet-reminder.test.ts`;
  `tools/neon-test.sh apps/merchant/src/server/wallet-push-budget.neon.integration.test.ts` (idem reminder).
- **Manual (owner, en un telefono Android con el pase):** 3 acreditaciones en 10 minutos → suenan 2, la 3.ª
  no; la cuenta muestra el saldo de las 3.

### Mutaciones (presupuesto: 6; clase de error: los plausibles — un tope corrido en uno, la clase equivocada, el cableado borrado)

| # | Mecanismo (archivo) | Mutacion | Oraculo que tiene que dar rojo |
|---|---|---|---|
| M1 | `decideBudget` (`push-budget.ts`, a crear) | `counterSent24h >= 2` → `> 2` | unidad: 3.º del mostrador → `suppress` |
| M2 | `decideBudget` | `pass_refresh` pasa por la regla de `transactional` | unidad: `pass_refresh` con 3 enviados → `send` |
| M3 | cableado en `deliverClaimed` (`push.ts:127`) | borrar la llamada a `applyBudget` | integracion: 3.º `suppressed` (no la unidad: regla §2.0-quater) |
| M4 | `applyBudget` en `suppress` | escribir `latest_message` igual | integracion: `latest_message` = texto del 2.º |
| M5 | `decideReminder` condicion 3 (`reminder.ts`, a crear) | quitar el chequeo de escaneo en 24 h | unidad + integracion «escaneo hace 2 h → 0» |
| M6 | `planReminders` (`reminder-store.ts`, a crear) | quitar el `not exists` de 20 h | integracion «dos corridas → 1» |

Las filas M3–M6 nombran piezas a crear por esta spec; las ya existentes (`deliverClaimed` en `push.ts:127`,
`planTransports` en `push-transports.ts:182`, los builders en `push-text.ts:13,35,63`) se verificaron en el
arbol el 2026-09-29. **Queda afuera, declarado:** la carrera de dos escaneos simultaneos (los dos leen
`counterSent24h = 1` y suenan los dos → 3 del mostrador; Google rechaza el 4.º y queda en `last_error`), y dos
corridas del cron solapadas encolando dos `reminder` (el `not exists` es de una sentencia, sin lock).

## Handoff requerido

Formato de `docs/AGENT-WORKFLOW.md`. UN implementador + UN revisor independiente con PASS antes de `implementada`.

## Abierto

- **Donde lleva el toque:** Google, leido en la doc oficial (trigger-push-notifications): «Once the user taps the
  notification it opens Google Wallet to the front of the pass» → hasta la cuenta son 2 toques (aviso → enlace del
  pase). Apple: sin verificar (telefono). No bloquea esta spec.
- **Insumo para la spec de horas valle (no pendiente de esta):** «en franjas que no compra si son para llevar
  gente a un lugar en hora valle» (owner).

## Resultado (2026-09-29)

Implementada en `00e6586` + fix `07c83fb`; **PASS del revisor independiente** (M3 y M6 re-ejecutadas en rojo, 5
mutaciones propias). **Falta:** migracion `0056` en PROD (con OK del owner), deploy y QA en Android.
- **Fila M6 de esta spec era FALSA** tal como se escribio: «dos corridas → 1» queda verde sin el `not exists`
  (la condicion 2 de `decideReminder` ya lo impide). Oraculo real: el caso «stale read» (dos pasadas del cron
  solapadas, escenario real segun el revisor: `curl --max-time 60` no corta la ejecucion en Vercel).
- **Hallazgo del revisor, arreglado:** `planReminders` corria sin aislamiento antes del drenado
  (`push-worker.ts:104`); ahora un fallo se loguea y el drenado sigue. Oraculo:
  `wallet-push-worker-planner-isolation.test.ts` (rojo sin el fix, verde con el).
- **Huecos de oraculo declarados (codigo correcto hoy, sin test que lo fije):** R1 contar `campaign` como aviso del
  mostrador; R2 minuto habitual en UTC en vez de la zona del comercio; R3 ignorar la zona del ultimo escaneo.
- **Techo horario (owner, 2026-09-29: «no sale despues de las 21, esta bien»):** desde las 21:00 locales el
  recordatorio no sale (`too_late`) y espera al dia siguiente; la hora objetivo se recorta a **[9:00, 20:30]** para
  dejar 30 min antes del corte (commit posterior a `097aac2`; oraculo en `wallet-reminder.test.ts`, mutado: rojo).
  Declarado: el cooldown de 3 min del drenado puede correr un recordatorio de las 20:59 hasta las 21:02.


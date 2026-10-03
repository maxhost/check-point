---
spec: 0139
fecha: 2026-10-02
estado: cerrada
resumen: Spec 2 del ADR 0115 (+ ADR 0116). Campañas y avisos de mostrador salen SOLO por push de la PWA, nunca por Wallet; sin suscripcion se cierran `suppressed`/`no_channel` sin gastar presupuesto (la campaña igual emite su cupon); el recordatorio sigue Wallet → PWA y es el unico que escribe la «Ultima novedad» del pase. Nuevo `GET /api/public/consumer/notices` con los avisos de mostrador para Actividad (pantalla de GPT).
disjunta: si
archivos: apps/merchant/src/server/wallet/{push-transports,push}.ts, packages/domain/src/server/consumer/notices.ts (crear), apps/consumer/src/app/api/public/consumer/notices/route.ts (crear), tests de ruteo/worker/presupuesto (reescritura declarada), un test Neon nuevo de avisos
---

# 0139 — Campañas y mostrador por la PWA; avisos de mostrador en Actividad

## Problema

- `planTransports` (`apps/merchant/src/server/wallet/push-transports.ts:184-222`) manda `transactional`, `campaign` y
  `reminder` por **Wallet** (Apple + Google `addMessage`) si hay pase alcanzable y por Web Push **solo** si no lo hay.
  El ADR 0115 §2 pide lo inverso para `campaign` y `transactional`: **push de la PWA, nunca Wallet**; sin
  notificaciones, solo dentro de la app. `reminder` queda igual (Wallet; si no hay pase, PWA).
- `deliverClaimed` (`push.ts:148-152`) escribe `consumer_account.latest_message` para toda clase no silenciosa. Es
  lo que el pase muestra y lo que hace sonar a Apple en la proxima descarga (`push-budget-store.ts:54-56`). Si un
  aviso de mostrador lo sigue escribiendo, el proximo recordatorio por Wallet lo hace sonar (ADR 0116 §3).
- Un aviso sin canal hoy se cierra `sent` (`push.ts:165-169`) y **cuenta** en el presupuesto de 24 h
  (`loadBudget`, `push-budget-store.ts:24-34`, cuenta `status = 'sent'`), aunque no haya sonado (ADR 0116 §2).
- Actividad (`apps/consumer/src/app/(consumer)/wallet/activity-view.tsx`) no muestra avisos de mostrador; no hay
  ninguna lectura de la cola para el cliente (ADR 0116 §1).

## Alcance

**Entra:** el ruteo nuevo de `campaign`/`transactional`; el cierre `no_channel`; `latest_message` solo para
`reminder`; la funcion `listConsumerNotices` y la ruta `GET /api/public/consumer/notices` (contrato abajo); la
reescritura **declarada** de los tests que fijan el ruteo viejo.

**No entra:** la pantalla de Actividad (GPT, zona pantallas: consume el contrato); limites (spec 3 del 0115); el aviso
de la Venta cruzada (spec 4); detectar PWA instalada sin notificaciones (0115 §7); migraciones (los estados
`suppressed` y la clase existen: `wallet_push_queue_status_check`, `packages/db/src/schema/wallet-push.ts:103-104`);
cambiar `pass_refresh`; avisos de campaña en Actividad (ya llegan por su cupon, ADR 0116).

## Diseño

### 1. El ruteo (puro, en `push-transports.ts`)

```ts
export function planTransports(
  noticeClass: string,
  reach: { reachableWallet: boolean; webPushSubscribed: boolean },
): TransportPlan;
```

| Clase | Plan |
|---|---|
| `transactional`, `campaign` | `webPush: reach.webPushSubscribed`; **apple, googleAddMessage y googlePatch siempre `false`** |
| `reminder` | igual que hoy: wallet si `reachableWallet`, si no `webPush` (no mira `webPushSubscribed`) |
| `pass_refresh` | igual que hoy |
| otra | `throw` como hoy |

Un plan con los cuatro en `false` es **sin canal**. `consumerHasReachableWallet` se consulta solo para `reminder`;
`webPushSubscribed` sale de `hasWebPushSubscription` (`packages/domain/src/server/push/subscriptions.ts:111`) y se
consulta solo para `transactional`/`campaign`. Una suscripcion muerta (410) se poda en el envio como hoy y la fila
cierra `sent`: el «sin canal» se decide con lo que hay en la base al reclamar. Sin VAPID (`webPushChannel` nulo) el
comportamiento no cambia (cierra `sent`, `deliverWebPush` no hace nada).

### 2. El orden en `deliverClaimed` (`push.ts`)

1. Gate de campaña (`gateCampaignPush`), como hoy.
2. **Canal:** se calcula el plan. **Sin canal** → la fila se cierra
   `status = 'suppressed', last_error = 'no_channel'` y **no** se escribe `latest_message`, `last_push_at` ni la
   preempcion. Si es `campaign` con `clickId`, se llama igual a `recordSent(clickId, now)` (el cupon se emite, ADR 0115
   D1). Fin.
3. Presupuesto (`applyBudget`), como hoy.
4. `latest_message`/`message_updated_at` se escriben **solo si la clase es `reminder`**.
5. Entrega, cierre `sent`, `recordSent`, `last_push_at` y preempcion: como hoy.

`deliverTransports` recibe el plan ya calculado (o el `reach`) para no consultar dos veces. Si `push.ts` pasa las
**300 lineas** (hoy 279, hook `file-size`), el cierre `no_channel` va a un modulo propio: dividir, no extender.

### 3. Contrato HTTP: `GET /api/public/consumer/notices` (ADR 0070, para la pantalla de GPT)

- **Sesion:** cookie `consumer_session` via `resolveSession`, igual que `api/public/consumer/coupons/route.ts`. El
  cliente sale de la sesion, **nunca** de la request. Sin sesion → **401** `{ "error": "No autorizado.", "code":
  "unauthenticated" }`.
- **200:** `{ "notices": NoticeDTO[] }`, del mas nuevo al mas viejo (`created_at desc, id desc`), **maximo 30**.

```ts
type NoticeDTO = {
  id: string;        // uuid de la fila de la cola
  title: string;     // el nombre del comercio (o «CheckPass Club»), tal como se encolo
  body: string;      // «+1 sello», «Canjeaste …», «¡Tu bienvenida ya está lista!»…
  createdAt: string; // ISO 8601
};
```

- **Que filas:** `consumer.wallet_push_queue` del cliente con `class = 'transactional'`, **cualquier `status`** (el
  aviso existe aunque no haya sonado: ADR 0116 §1). Nunca `campaign`, `reminder` ni `pass_refresh`.
- **Nunca** salen `status`, `last_error`, `attempts`, `not_before`, `consumer_id`, `class` ni `sent_at`: el DTO es una
  allow-list.
- La funcion de dominio es `listConsumerNotices(consumerId: string): Promise<NoticeDTO[]>` en
  `packages/domain/src/server/consumer/notices.ts`; la pagina `wallet/page.tsx` puede llamarla directo, como hace con
  `listConsumerCoupons`.
- Para la pantalla: el texto ya viene redactado; Actividad lo mezcla con cupones y programas ordenando por fecha.

### Arquitectura de referencia

ADR 0115 §2, ADR 0116, ADR 0040/0095 (superados en el ruteo de `campaign`/`transactional`), spec 0111 (presupuesto),
ADR 0070 (contrato), ADR 0114 (zonas).

## Archivos

| Archivo | Accion |
|---|---|
| `apps/merchant/src/server/wallet/push-transports.ts` | editar (§1) |
| `apps/merchant/src/server/wallet/push.ts` | editar (§2); dividir si pasa 300 lineas |
| `packages/domain/src/server/consumer/notices.ts` | crear (§3) |
| `apps/consumer/src/app/api/public/consumer/notices/route.ts` | crear (§3) |
| `apps/merchant/src/server/push.test.ts` | reescribir los 4 casos de `transport routing by class` (`:165-210`) al ruteo nuevo |
| `apps/merchant/src/server/wallet-push-routing.neon.integration.test.ts` | reescribir al ruteo nuevo |
| `apps/merchant/src/server/wallet-push-worker.neon.integration.test.ts`, `wallet-push-budget.neon.integration.test.ts` y los que el gate muestre | **reescritura declarada** (ver abajo) |
| test Neon nuevo de avisos (p. ej. `apps/consumer/src/server/consumer-notices.neon.integration.test.ts`) | crear |

**Reescritura de tests, regla:** un test que usa `transactional` **como vehiculo** de una mecanica de Wallet (claim
unico, poda por 410 de APNs, error de APNs registrado, reclamo de fila colgada: `wallet-push-worker…:49-269`) pasa a
`class: 'reminder'` **sin cambiar lo que asevera**. Un test que fija el ruteo viejo (wallet para mostrador, o
`latest_message` despues de un mostrador, p. ej. `wallet-push-budget…:153`, `wallet-push-worker…:90`) se reescribe
al comportamiento nuevo. **Cada reescritura va al handoff con archivo, caso, antes y despues.** Ningun otro test se
toca, y ninguno se saltea.

### Disjunta?

**Si.** La 0138 esta implementada; GPT no toca `apps/*/src/server/**` ni `app/api/**` (ADR 0114). La pantalla de
Actividad es de GPT y consume §3 despues.

## Definition of Done

- [ ] `planTransports` cumple la tabla de §1 (unit).
- [ ] Mostrador con suscripcion y con pase Apple alcanzable → **solo** Web Push; ninguna llamada a APNs ni a
      `addMessage`; fila `sent` (Neon).
- [ ] Mostrador **sin** suscripcion y con pase alcanzable → ninguna llamada; fila `suppressed`/`no_channel`;
      `latest_message` y `last_push_at` sin tocar (Neon).
- [ ] Un mostrador sin canal **no cuenta** en el presupuesto (Neon, ver M3).
- [ ] Un mostrador entregado **no** escribe `latest_message`; un `reminder` entregado **si** (Neon).
- [ ] `reminder` con pase alcanzable → Wallet; sin pase → Web Push (Neon, sin cambio).
- [ ] `GET /api/public/consumer/notices`: 401 sin sesion; 200 con solo los `transactional` del cliente de la sesion,
      orden y tope de §3; el conjunto de claves de cada item es **exactamente** `{id,title,body,createdAt}`; los
      avisos de otro cliente no aparecen (Neon).
- [ ] Reescrituras de tests listadas en el handoff.
- [ ] `pnpm verify` en verde con Node 24 (ADR 0113), con su tabla final transcripta; Neon de las suites relacionadas.

## Plan de pruebas y verificación

Presupuesto del revisor: las **7 mutaciones** de abajo, mas las reescrituras de tests revisadas una por una. Clase
de error a cazar: **la plausible** — que el mostrador vuelva a salir por Wallet, que el «sin canal» gaste presupuesto
o escriba la «Ultima novedad», que la lista filtre otro cliente o una columna interna. **Queda afuera, declarado:** el
cupon de una campaña sin canal (`campaign` no se encola hoy: `welcome`/`cross` no tienen canal por el check
`core_campaign` de `packages/db/src/schema/campaign.ts:125` + `offer-checks.ts:18`; y lo apagado no se prueba,
ADR 0115); la entrega real a un telefono (QA del owner).

| # | Mutacion (mecanismo, archivo) | Oraculo que tiene que ponerse ROJO | Guard hermano a puentear |
|---|---|---|---|
| M1 | `planTransports`: `transactional` vuelve a wallet si `reachableWallet` (`push-transports.ts`) | unit de §1 + Neon «mostrador con pase y suscripcion → solo Web Push» | — |
| M2 | se borra el cierre `no_channel` (la fila sigue y cierra `sent`) (`push.ts`) | Neon: la fila del mostrador sin suscripcion queda `suppressed`/`no_channel` (asercion **directa** sobre `status` y `last_error`) | el presupuesto tambien cierra `suppressed`: el oraculo asevera `last_error = 'no_channel'`, no solo el estado |
| M3 | el cierre `no_channel` escribe `status = 'sent'` | Neon: con **2 filas `reminder` `sent` sembradas** en las ultimas 24 h, un mostrador sin canal y despues un `reminder` con pase Apple, entregado con `deliverRow` (sin el planificador de cooldown) → el `reminder` **sale** (bajo la mutacion: 3 notificantes → `suppressed`/`budget_24h`) | el tope de mostrador (2) suprime el 3.º mostrador igual: por eso se siembran `reminder`, no mostradores |
| M4 | `latest_message` se escribe para toda clase no silenciosa (como hoy) (`push.ts`) | Neon: mostrador entregado → `latest_message` sin cambiar | — |
| M5 | `reminder` deja de ir por Wallet (`push-transports.ts`) | unit de §1 + Neon del recordatorio con pase | — |
| M6 | `listConsumerNotices` sin el filtro por cliente (`notices.ts`) | Neon: el aviso del cliente B no aparece en la lista de A | el filtro por `class` no lo tapa: B tiene un `transactional` |
| M7 | el DTO devuelve la fila entera (`notices.ts`) | test del conjunto **exacto** de claves | — |

Cada fila se **ejecuta y transcribe** (protocolo de mutaciones: `shasum` limpio, bitacora antes de medir, etiqueta,
`diff` al revertir). Ninguna se predice.

**Comandos:** `pnpm verify` (Node 24); Neon por archivo con `tools/neon-test.sh <archivo>` (nunca contra
`DATABASE_URL`).

**Verificacion manual (QA del owner, despues del deploy):** con la PWA instalada y notificaciones activas, sumar un
sello en el mostrador → llega el push de la PWA y **no** suena la Wallet; con las notificaciones desactivadas → no
llega nada y el aviso aparece en Actividad cuando GPT conecte la pantalla.

## Handoff requerido

Formato de `docs/AGENT-WORKFLOW.md`. PASS del revisor independiente antes de marcarla `implementada`.

## Abierto

Nada bloqueante.

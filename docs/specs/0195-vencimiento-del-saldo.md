---
spec: 0195
fecha: 2026-10-10
estado: implementada
resumen: Implementa el ADR 0136 (L2, API + servidor + DB; pantallas de GPT con el contrato de §D6). Migracion 0071 (regla en `core.loyalty_program`, `core.balance_expiration`, `consumer.balance_expiry_notice`, accion `expiry_changed`), `PUT /api/loyalty-program/expiry` (3/6/9/12 meses o apagado), funcion pura de fecha y aviso, barrido dentro del cron `loyalty-expiry` que emite los avisos (20/10/5 dias y «hoy vencen») y vence el saldo solo despues del aviso del dia, y los campos `balanceExpiryMonths` / `balanceExpiresOn` para el comercio, la inscripcion y la PWA.
disjunta: si
archivos: packages/db/drizzle/0071_* (+ meta), packages/db/src/schema/{loyalty,balance-expiry}.ts, packages/db/src/schema.ts, packages/domain/src/server/loyalty-program/{balance-expiry,balance-expiry-store,client-view}.ts, packages/domain/src/server/loyalty-program.ts, packages/domain/src/server/wallet/push-text.ts, packages/domain/src/server/consumer/{programs,enroll-landing}.ts, apps/merchant/src/app/api/loyalty-program/expiry/route.ts, apps/merchant/src/app/api/internal/loyalty-expiry/route.ts, tests, docs/INDEX.md
---

# 0195 — Vencimiento del saldo

> Plantilla chica por nivel **L2** (ADR 0129) aunque trae una migracion: la decision de diseño esta en el ADR 0136 y
> las del owner se tomaron antes (2026-10-10). Depende de la migracion 0070 (spec 0190): esta es la 0071.

## Problema

- Ningun saldo vence: `consumer.program_membership.points_balance` / `stamps_count`
  (`packages/db/src/schema/consumer.ts:169`) solo los mueven `persistGrant` (`apps/merchant/src/server/counter/orders.ts:145`,
  tambien desde el POS por `pos/close.ts:111`) y el canje (`counter/redemptions.ts`).
- El cron `/api/internal/loyalty-expiry` (`apps/merchant/vercel.json`, `5 5 * * *`) solo cierra programas
  (`expireClosingPrograms`).

## Alcance

**Entra:** la regla por programa, su ruta de escritura, el barrido (avisos + vencimiento + auditoria) y los campos de
lectura para las tres pantallas.

**No entra:** las pantallas (GPT, §D6); cashback; vencimiento por lote; reescribir los terminos versionados; el pase de
Wallet (no muestra saldos); un reporte de vencimientos para el comercio; avisos por otro canal que la cola existente.

## Diseño

### D1 — Migracion 0071 (aditiva)

- `core.loyalty_program`: `balance_expiry_months integer null` con check `in (3, 6, 9, 12)` (null = apagado) y
  `balance_expiry_since timestamptz null`; check: los dos null o los dos no null.
- `core.loyalty_program_event_action_check` suma `'expiry_changed'`.
- `core.balance_expiration`: `id uuid pk`, `business_id` (fk cascade), `program_id` (fk), `membership_id` (fk
  `consumer.program_membership` cascade), `consumer_id`, `accrual_kind text` (`points|stamps`), `units_expired integer
  > 0`, `expires_on date`, `last_activity_at timestamptz`, `created_at`; **unico** `(membership_id, expires_on)`;
  indice `(business_id, created_at desc)`.
- `consumer.balance_expiry_notice`: `membership_id` (fk cascade), `expires_on date`, `days_before integer` check
  `in (20, 10, 5, 0)`, `queue_id uuid` (fk `wallet_push_queue`, set null), `created_at`; **pk** `(membership_id,
  expires_on, days_before)`.
- Sin grants nuevos: el rol del cliente ya tiene `SELECT` de tabla entera sobre `core.loyalty_program` y
  `core.business_customer` (migracion 0060), que es lo unico que lee la PWA.

### D2 — Funcion pura `balance-expiry.ts`

- `expiresOn({ lastVisitAt, enrolledAt, since, months, timezone }) → "YYYY-MM-DD"`: fecha local de
  `max(lastVisitAt ?? enrolledAt, since)` + `months` meses calendario (31 ene + 1 mes = 28/29 feb: fin de mes).
- `noticeDue({ today, expiresOn, sent: number[] }) → 20 | 10 | 5 | 0 | null`: `daysLeft = expiresOn − today`; el
  menor umbral `t ∈ {20, 10, 5, 0}` con `daysLeft ≤ t` (si `daysLeft < 0`, es `0`), solo si `t` no esta en `sent`;
  con `daysLeft > 20`, `null`.
- `shouldExpire({ today, expiresOn, zeroNoticeOn })`: `today > expiresOn` **y** el aviso `0` emitido un dia local
  ANTERIOR a `today` (asi un aviso atrasado siempre deja ese dia entero, aunque el barrido corra dos veces).
- `nextSince({ current, nextMonths, prevMonths, since, now })`: activar o acortar → `now`; alargar → `since`;
  apagar → `null`.

### D3 — `PUT /api/loyalty-program/expiry`

Cuerpo `{ months: 3 | 6 | 9 | 12 | null }`. Guard: `requireApiPermissionSinGateDeEmail(request, "loyalty")`, el mismo
del `PUT` del programa. En una transaccion: `select … for update` del programa activo del negocio, `nextSince`,
`update`, evento `expiry_changed` con `{ from, to }`. Mismo valor que el actual → 200 sin evento.

| Caso | Respuesta |
|---|---|
| ok | 200 `{ balanceExpiryMonths, balanceExpirySince }` |
| cuerpo no JSON | 400 `invalid_body` |
| `months` fuera de la lista | 400 `invalid_expiry` |
| sin programa activo | 409 `no_active_program` |
| otro cambio de la regla en el medio (guard optimista) | 409 `state_changed` |
| guard | sus codigos de siempre (401 / 403) |
| base | 503 `program_unavailable` |

### D4 — Barrido (`balance-expiry-store.ts`, llamado por el cron despues de `expireClosingPrograms`)

`runBalanceExpiry(now)`, en dos pasos y por membresia candidata (programa `active` con regla, negocio con acceso por
`accessSql` del ADR 0134, saldo > 0):

1. **Avisos.** Calcula `expiresOn` y `noticeDue` con `today` = fecha local del negocio. Si hay umbral: en UNA
   sentencia, `insert … balance_expiry_notice … on conflict do nothing returning` y, de lo insertado, la fila de
   `wallet_push_queue` (`transactional`, titulo = nombre del negocio, `not_before` = 10:00 locales de hoy o `now()`
   si ya paso); el `queue_id` se elige antes y el `created_at` del aviso es el `now` del barrido. Reintento = cero
   filas nuevas. `SweepScope` (`businessIds`) acota el barrido en las suites; produccion corre sin acotar.
2. **Vencimiento.** Para las que `shouldExpire`: transaccion por membresia; `select … for update` de la membresia;
   re-lee `last_visit_at`, saldo y avisos DESPUES del lock; si la funcion pura sigue diciendo que vence, `update` del
   saldo a 0 + `insert` en `balance_expiration` (`on conflict do nothing`). Sin `pass_refresh`: el pase no muestra
   saldos (medido: `wallet/apple.ts` y `google-object.ts` no leen el saldo).
   Si una compra entro en el medio, la fecha se movio y no vence.

Textos (`push-text.ts`, ≤ el tope de `MAX_NOTICE_BODY`): `Tus 120 puntos vencen en 20 días si no compras antes` /
`Hoy vencen tus 120 puntos. Pasa hoy y no los pierdas` (singular y sellos igual que `buildTransactionalBody`).
Devuelve `{ notices, expired }` para el log del cron.

### D5 — Lecturas

- Comercio: `toClientProgram` suma `balanceExpiryMonths: 3|6|9|12|null`.
- Inscripcion (`enroll-landing.ts`): suma `balanceExpiryMonths` del programa.
- PWA (`listConsumerPrograms`): suma `balanceExpiresOn: "YYYY-MM-DD" | null` (null si la regla esta apagada o el saldo
  es 0), con la misma `expiresOn` del barrido y `last_visit_at` leido de `core.business_customer` (no del
  `max(orders)` de la consulta).

### D6 — Contrato para GPT (pantallas)

**Alcance actualizado por el owner (2026-10-11):** solo el paso de configuracion
«Unidades» / «Sello y objetivo» del wizard al crear o editar un programa.
No se muestra el vencimiento en la vista del programa, inscripcion ni app del
cliente (`my.checkpass.club`): U5 y U6 quedan retiradas. En creacion, la opcion es
un borrador apagado por defecto y el `PUT /expiry` se ejecuta despues de activar
el programa; al editar, se guarda por separado al cambiarla. Activar o acortar
requiere confirmacion («Empieza a contar hoy para todos tus clientes»); alargar o
apagar se guarda directo. Si falla el guardado de la regla tras crear, se muestra
el error y se permite reintentar solo la regla, sin crear otra vez el programa.
El contrato HTTP de D3 y los campos de lectura de D5 permanecen iguales.

Contrato original (las superficies de cliente quedan fuera por la decision anterior):

- **Programa (panel):** interruptor «Los puntos/sellos vencen» + selector 3/6/9/12 meses contra el `PUT` de §D3; al
  activarlo, aclarar «empieza a contar hoy para todos tus clientes».
- **Inscripcion:** con `balanceExpiryMonths`, una linea junto a los terminos: «Tus puntos vencen si pasan 6 meses sin
  compras ni canjes».
- **PWA:** con `balanceExpiresOn`, «Vencen el 12 abr 2027» bajo el saldo. Los avisos ya aparecen en Actividad.

## Archivos

| Archivo | Accion |
|---|---|
| `packages/db/drizzle/0071_vencimiento_del_saldo.sql` (+ `meta`) | crear |
| `packages/db/src/schema/loyalty.ts`, `packages/db/src/schema/balance-expiry.ts`, `packages/db/src/schema.ts` | editar / crear |
| `packages/domain/src/server/loyalty-program/balance-expiry.ts` (+ test) | crear |
| `packages/domain/src/server/loyalty-program/balance-expiry-store.ts` | crear |
| `packages/domain/src/server/loyalty-program.ts`, `loyalty-program/client-view.ts` | editar |
| `packages/domain/src/server/wallet/push-text.ts` | editar |
| `packages/domain/src/server/consumer/{programs,enroll-landing}.ts` | editar |
| `apps/merchant/src/app/api/loyalty-program/expiry/route.ts` (+ test) | crear |
| `apps/merchant/src/app/api/internal/loyalty-expiry/route.ts` | editar |
| `apps/merchant/src/server/balance-expiry.neon.integration.test.ts` | crear |

**Disjunta?** Si: no toca pantallas ni archivos de GPT.

## Definition of Done

- [x] Unit `balance-expiry.test.ts`: fin de mes (31 ene + 1 → 28 feb; bisiesto 29 feb), `since` posterior a la
      ultima visita gana, `noticeDue` en 21/20/11/10/6/5/1/0/−3 dias, umbral ya enviado → `null`, `shouldExpire` falso
      sin el aviso 0, `nextSince` en activar/acortar/alargar/apagar.
- [x] Unit de la ruta: 400 `invalid_expiry` con 1, 7, `"6"`; 400 `invalid_body`; 200 con `null`.
- [x] Neon `balance-expiry.neon.integration.test.ts`: (a) vencida con aviso 0 → saldo 0, fila en
      `balance_expiration`, `pass_refresh` encolado; (b) vencida sin aviso 0 → aviso «hoy vencen», saldo intacto,
      y al otro dia vence; (c) dos corridas el mismo dia → un solo aviso; (d) negocio bloqueado → nada;
      (e) compra con `persistGrant` despues de calcular y antes de vencer → no vence; (f) `PUT` + evento
      `expiry_changed`, y activar con un cliente sin venir hace 1 año no vence nada ese dia.
- [x] `listConsumerPrograms` devuelve `balanceExpiresOn` (null con la regla apagada) — en la suite Neon.
- [x] `pnpm verify` en verde con Node 24, una sola vez al final, con su tabla.
- [x] `rg -n MUTATION apps packages tools` → vacio.

## Mutaciones — presupuesto: 3. Clase: los plausibles

| # | Mutacion | Oraculo que tiene que ponerse ROJO |
|---|---|---|
| 1 | `shouldExpire` sin exigir el aviso 0 | Neon (b): el saldo queda en 0 sin aviso |
| 2 | el vencimiento no re-lee `last_visit_at` despues del lock (usa el valor del paso 1) | Neon (e) |
| 3 | `expiresOn` ignora `since` (cuenta solo desde la ultima actividad) | Neon (f): el cliente de hace 1 año recibe aviso el dia que se activa |

**Protocolo y corte:** los de la plantilla chica.

## Declarado AFUERA

- Precision horaria del cron (Hobby): un dia de atraso es posible y la regla del aviso 0 lo absorbe.
- Carrera entre apagar la regla y un aviso ya encolado: sale igual (ADR 0136, consecuencias).
- Rendimiento del barrido con muchos miles de membresias: hoy hay 3 comercios.

## Handoff

L2: lo implementa Claude, sin subagentes. Sin revisor independiente salvo que algo se vea raro.

## Abierto

Nada bloquea.

## Cierre (2026-10-10)

Implementada en la rama `spec-0195` (base: `spec-0190`, por la migracion 0070). Desviaciones de la spec cerrada,
todas escritas arriba: `shouldExpire` pide el aviso `0` de un dia ANTERIOR; sin `pass_refresh`; 409 `state_changed`;
M3 cambio de mecanismo (`nextSince` al activar no tiene un `since` previo que conservar: mutarlo violaba el CHECK
de la pareja y daba un rojo por el motivo equivocado).

| Prueba | Resultado |
|---|---|
| Unit `balance-expiry.test.ts` (regla pura, textos, validacion de la ruta) | 23/23 |
| Neon `balance-expiry.neon.integration.test.ts` (a)–(f) | 5/5 |

| # | Mutacion | Resultado ejecutado |
|---|---|---|
| M1 | `shouldExpire` = `today > expiresOn` | ROJO (b): «expected { expired: 1, notices: +0 } to deeply equal { expired: +0, notices: 1 }» |
| M2 | `expireMembership` usa `candidate.lastVisitAt` | ROJO (e): «expected 120 to be +0» |
| M3 | `expiresOn` sin `since` | ROJO (f): «expected { expired: +0, notices: 1 } to deeply equal { expired: +0, notices: +0 }» (y (a)) |

Las tres revertidas con `diff` contra la copia limpia; `shasum` limpias: `balance-expiry.ts` `0585e951…`,
`balance-expiry-store.ts` `bc2910a3…` (despues, solo prettier: `5fa75411…`).

`pnpm verify` (Node 24, una vez): typecheck, lint, ui-guard, test, build, e2e y Neon completa (416 archivos, 3345
tests) ok; `format:check` ROJO por 7 archivos de esta spec, formateados despues con prettier (solo espacios) y
re-chequeados: `format:check`, typecheck, lint y los unit tocados en verde.

**Pendiente:** pantallas de GPT (§D6, parqueadas en `docs/PARQUEADO.md`); migracion 0071 a PROD con el pase a live.


UI del wizard implementada por GPT: commit `0f449164e14030688124526e90decbebf1b02498` en `dev` (sin push ni merge). U4 hecha; U5–U6 retiradas por el owner, sin UI en la inscripción ni app del cliente. Typecheck, ESLint y formato merchant/consumer en 0; guardia UI en 0; e2e 30/30. [Capturas de configuración a 390 y evidencia](../qa/0195/README.md). API y migración ya en PROD según cierre del owner.

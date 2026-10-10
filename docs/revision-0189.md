# Revisión independiente — Spec 0189 (rama `spec-0189`, `0524ab0..48a471f`)

Presupuesto: corrección contra la spec + 3 mutaciones propias (R1–R3) sobre líneas cambiadas, clase de error **plausible**.
Estado: **FAIL** (1 bloqueante, 1 no bloqueante con riesgo real)

## Comandos ejecutados y resultado

- `pnpm verify` (Node v24.20.0, worktree limpio, sobre `48a471f`) → `verify: ok`. typecheck ok, lint ok, ui-guard ok,
  format:check ok, test ok (249 archivos passed / 199 skipped), build ok, test:e2e ok (298 passed),
  neon (full) ok (407 archivos passed / 41 skipped, 423.6 s).
- Barridos de la DoD: `rg -n '"free"|settle-free|settleToFree|settle_to_free' apps packages tests --type ts` → exit 1 (vacío);
  `rg -n "requiresLiveSubscription|pendingRule" packages/domain/src` → exit 1 (vacío).
- Inventario de guards: cada `route.ts` de `apps/merchant/src/app/api` resuelve por `requireApiOwner*`,
  `requireApiPermission*`, `resolveOperator` (mostrador/POS), `requireBillingOwner` (allowBlocked), `CRON_SECRET` o es
  pública (places, prefill, signup, login, health, webhook). Las 18 `page.tsx` de `/backoffice` llaman a
  `requireBackofficeSession`/`requireOwner`.
- Sondas de scratch (archivos temporales, ya borrados del worktree; copia en el scratchpad del revisor):
  - `revisor-0189-layout-loop.test.ts` (unit, `auth-guards` REAL, DB/sesión dobladas): 2/2 en verde. Lo que aseveró:
    `BackofficeLayout()` con un owner `active` y acceso `blocked` → `REDIRECT:/backoffice/subscription`.
  - `revisor-0189-incomplete.neon.integration.test.ts` (`tools/neon-test.sh`): ROJO,
    `expected 'paused/plan_downgraded' to be 'active/null'` (ver H2).
- `rg '\b(MUTATION|MUTACION)\b' apps/*/src packages/*/src` → exit 1 (vacío). `git status --short` → solo `?? .pnpm-store`.

## Hallazgos (ordenados por riesgo real de producción)

### H1 — BLOQUEANTE. El owner bloqueado no puede llegar a `/backoffice/subscription`: bucle de redirecciones

- `apps/merchant/src/app/backoffice/layout.tsx:8`: `await requireBackofficeSession()` **sin** `{ allowBlocked: true }`.
  El layout envuelve TODAS las páginas de `/backoffice`, incluida `/backoffice/subscription`.
- `apps/merchant/src/server/auth-guards.ts:208-216`: con `active` y acceso `blocked`, el owner va a
  `redirect("/backoffice/subscription")`.
- La página (`subscription/page.tsx:61`, `requireOwner({ allowBlocked: true })`) no alcanza: el layout redirige
  antes, a la misma URL → `/backoffice/subscription` → layout → `/backoffice/subscription`… (ERR_TOO_MANY_REDIRECTS).
  La raíz `/` manda toda sesión viva a `/backoffice`, así que entra al mismo bucle.
- Evidencia ejecutada: la sonda unit de arriba (`auth-guards` real) → el layout lanza `REDIRECT:/backoffice/subscription`.
  El cableado (que el layout de `app/backoffice/layout.tsx` envuelve `app/backoffice/subscription/page.tsx`) es la
  convención de archivos del App Router; no lo levanté en un `next dev` con sesión real (declarado abajo).
- Incumple §D4: «El owner bloqueado entra, ve su suscripción y paga». Ningún test lo caza: T7 es solo de API.
- Arreglo sugerido (no aplicado): `layout.tsx` → `requireBackofficeSession({ allowBlocked: true })`. Es seguro HOY
  porque las 18 páginas vuelven a correr su propio guard (comprobado con `grep`); una página nueva sin guard quedaría
  abierta a un owner bloqueado. Agregar un unit del layout/página que lo fije.
- En PROD tarda en aparecer (la prueba de los 3 comercios vence 90 días después de la migración), pero el QA manual de la
  spec (`/extender-prueba` al pasado) cae directo en esto.

### H2 — NO BLOQUEANTE (riesgo real, acotado). Si el primer evento aplicado llega antes de que el plan quede escrito, la Bienvenida y la Venta cruzada quedan en `plan_downgraded` para siempre después de pagar

- `apps/merchant/src/server/billing/store.ts:155` → `syncCampaignsWithAccess` → `plan-brake.ts`
  `resumeCampaignsAfterBilling`: con `stripe_subscription_id` puesto y `status='incomplete'` (o `unknown_price`), el
  acceso es `subscribed`, pero el plan efectivo es el `fallback` (`plan` sigue en `trial`/`none`). Toda campaña
  `billing_blocked` cae en `kept` y se reescribe como `paused/plan_downgraded`. Cuando llega el `active` + `base`,
  la reanudación solo mira `billing_blocked`: no encuentra nada. Tampoco el barrido diario.
- Evidencia ejecutada (`tools/neon-test.sh src/server/revisor-0189-incomplete.neon.integration.test.ts`): prueba vencida
  y Bienvenida `billing_blocked` → `applySubscriptionState(status:'incomplete')` → `applySubscriptionState(status:'active', plan:'base')`
  → barrido → `AssertionError: expected 'paused/plan_downgraded' to be 'active/null'`.
- Para que pase en producción hace falta que `subscriptions.retrieve` (del webhook) devuelva `incomplete`: con Checkout
  sin `trial_end` (que es justo el caso del comercio bloqueado que paga) la suscripción nace `incomplete` hasta que se
  confirma el pago (3DS incluido). No lo verifiqué contra Stripe real (declarado).
- Arreglo sugerido: en `resumeCampaignsAfterBilling`, no reclasificar (dejar `billing_blocked`) cuando el plan efectivo
  no es un plan conocido; o que §D2 trate `subscribed` sobre `plan ∉ {base, plus}` como `trial` mientras la prueba siga vigente.
  Es lo mismo que el hallazgo #3 del implementador, pero con una consecuencia que dura (ver abajo).

### Hallazgos del implementador que se pidió evaluar

- **#3 (suscripción `incomplete` o recién enlazada con plan `trial`)**: **sí hay riesgo real**, y es mayor que lo
  declarado. El tramo «1 local, sin campañas» es transitorio, pero el mismo tramo, al pasar por el webhook, convierte las
  campañas `billing_blocked` en `plan_downgraded` de forma permanente (H2, reproducido). Ojo: `bindCheckoutSession` solo
  enlaza y no sincroniza (`webhook-apply.ts:193-246`), así que el daño entra por `applySubscriptionEvent` con
  `incomplete`, no por el enlace.
- **#4 (staff bloqueado → `/?e=payment_required`)**: **no hay riesgo**. `app/page.tsx:9-29`: cualquier `?e=` no vacío
  muestra `EntryCover` sin redirigir, así que no hay bucle. Las APIs del staff responden 402 (R2 lo midió en el login).
  Lo que falta es el texto del motivo, que es de GPT.
- **#6 (clave de idempotencia del checkout fija)**: **hay riesgo, pero bajo**. Pasa si el `trial_end` cambia en 24 h
  (se cruza el umbral de 48 h o se usa `/extender-prueba`): Stripe rechaza la clave → `billingErrorResponse` → 503
  hasta que la clave vence. El mismo defecto ya existía ANTES de la spec con `from` (`success_url` distinto con la
  misma clave: `git show 0524ab0:…/checkout/route.ts:86-89`). Arreglo: sumar `trialEnd ?? "now"` a la clave.
- **#8 (sin freno al bajar a base por fuera de la ruta)**: **hoy no hay riesgo**. `enabled-campaigns.ts:17-23`:
  solo `welcome` y `cross` están encendidas (las dos van en el plan base) y `COMPOSER_ENABLED=false`; no se puede
  activar nada que quede fuera del base. Pasa a ser riesgo el día que se encienda otra plantilla.

### Otros (no bloqueantes, menores)

- `welcome-store.ts` / `cross-store.ts`: el `accessSql` está repetido. `campaignAllowedFor(row, tpl, now)` con un
  comercio bloqueado ya da plan efectivo `none` → `false`, así que mutar ese `accessSql` dejaría los tests en verde
  sin que el comportamiento cambie. No hay fuga; lo dejo dicho para que nadie lea ese `accessSql` como el único
  guard. No lo medí: estaba fuera del presupuesto.
- `api/staff/[userId]/pin/route.ts`: un integrante con una sesión anterior al bloqueo puede cambiar su PIN (no mira ni
  `status` ni acceso; eso ya era así antes de la spec). No le da entrada a nada: el login del staff y todas sus APIs
  devuelven 402.

## DoD, uno por uno

- [x] barrido `"free"`/`settle-free` vacío: lo corrí (exit 1).
- [x] barrido `requiresLiveSubscription|pendingRule` vacío: lo corrí (exit 1).
- [x] migración 0069 aplicada a `ci-integration`: `tools/neon-test.sh` la migró en cada corrida («migrations applied
      successfully»), y `billing-migration.neon` está en verde dentro del neon full. Releí el SQL a mano: el
      `UPDATE … WHERE plan='free'` está bien, y el default, el check y el grant también. El migrador de drizzle corre todo en UNA
      transacción (`pg-core/dialect.js:60`) y la registra por `created_at` (0069 `when` > 0068). Un segundo intento a
      mano fallaría en `ADD COLUMN` y haría rollback, así que el `UPDATE` no puede volver a correr y pisar la fecha.
- [x] suites del plan en verde: neon full 407/41 skipped y unit 249/199 skipped, en mi corrida.
- [x] mutaciones del implementador: el orquestador reprodujo M1; yo agregué R1–R3 (abajo).
- [x] `pnpm verify` verde con Node 24 (mi corrida).
- [x] `rg MUTATION` vacío.
- [ ] Revisor: **PASS no**, por H1.

## Bitácora de mutaciones (revisor)

| id | archivo:línea | cambio | shasum limpio | test que la caza | aserción leída | revertida |
|---|---|---|---|---|---|---|
| R1 | `packages/domain/src/server/consumer/enroll-landing.ts:116` | quitar `businessHasAccessSql(businesses.id, now)` (camino hermano de M3) | `12c98e78afc2a6573e9c529ceacf0fe6267c8fcd` | `billing-consumer-access.neon` «SIN acceso: alta 404, landing `null`…» (1 failed / 1 passed) | `AssertionError: expected { …(10) } to be null` (la landing, que se tendría que ocultar, devolvió su objeto) | `diff` vacío, mismo shasum |
| R2 | `apps/merchant/src/app/api/merchant/auth/staff/route.ts:129` | `(await businessBillingFailure(row.businessId))` → `null` (login del personal sin el eje de acceso) | `c6d6e3d658bea105a3b64044fc18f59304bacc85` | `billing-guards.neon` «prueba VENCIDA sin suscripción: 402…» (1 failed / 3 passed) | `AssertionError: staffLogin: expected 200 to be 402` | `diff` vacío, mismo shasum. Un primer intento (`?? null ??`) no mutaba nada; lo revertí SIN medir |
| R3 | `apps/merchant/src/server/billing/plan-change.ts` (`decideChangePlan`) | `already_on_plan` antes que `cancel_scheduled` (orden de §D6 invertido) | `424dbf362b61fb82027288336615f16197ae99a9` | `billing-plan-change.test.ts` «cada punto del dominio cae en la guarda declarada» | `actual {code:"already_on_plan"}` vs `expected {code:"cancel_scheduled"}` con `currentPlan:"base"`, `to:"base"`, cancelación programada. **`billing-plan-change-rows.test.ts` quedó 20/20 VERDE**: ningún caso con nombre fija esta precedencia, solo la matriz | `diff` vacío, mismo shasum |

## Declarado y NO perseguido

- El bucle de H1 con sesión real en `next dev` no lo levanté: armar una sesión de owner real contra la rama de CI cuesta
  más que el presupuesto. La sonda unit usa `auth-guards` real; lo que queda sin medir es la convención de layouts de
  Next. H1 se confirma de verdad en el QA del owner.
- Que Stripe Checkout devuelva `incomplete` al hacer `retrieve` (la condición de H2 en producción) no se verificó contra
  Stripe real; la consecuencia sí la reproduje en una base.
- Fuera de alcance por encargo: la UI de cobro de GPT (400 de la consola actual: esperado), los textos «Free», el límite
  de crons de Vercel, PARQUEADO #54.
- Hallazgos del implementador 1, 2, 5, 7 y 9–15: declarados, no perseguidos.
- No hubo «dos vueltas seguidas abriendo la preimagen siguiente»: no aplicó el corte.

---

## Ronda 2 — delta `48a471f..1ba7ef7` (e19c526 H1, d111746 H2, b1fe965 #6)

Presupuesto: correccion del delta contra H1/H2/#6 + 1 mutacion propia (R4) sobre lineas nuevas, clase plausible.
Estado: **PASS** (sin bloqueantes; un hueco de oraculo no bloqueante, N1)

### Comandos ejecutados y resultado

- `pnpm verify` (Node 24, sobre `1ba7ef7`, worktree limpio salvo este doc) → `verify: ok`; test 250 passed / 200
  skipped (450 archivos); test:e2e ok; neon (full) 409 passed / 41 skipped (418.0 s).
- `tools/neon-test.sh src/server/billing-sweep.neon.integration.test.ts src/server/billing-incomplete.neon.integration.test.ts`
  (con R4 puesta) → 4/4 verdes (ver R4).
- Sonda scratch `revisor-0189-trial-ext.neon.integration.test.ts` (borrada; copia en el scratchpad): comercio con
  `plan='trial'` y prueba vencida → barrido pausa la Bienvenida; se extiende `trial_ends_at` +7 d → barrido.
  Codigo limpio: **1/1 verde** (`{paused:0, resumed:1}`, `active/null`). Con R4: rojo (abajo).
- `find app/backoffice -name route.ts -o -name page.ts -o -name page.jsx -o -name layout.tsx` → solo `./layout.tsx`;
  `rg -l '"use server"' app/backoffice` → vacio; por cada `page.tsx` (18) el `require(Owner|BackofficeSession)(`
  aparece 1 vez y 0 veces en una linea de comentario.
- `rg '\b(MUTATION|MUTACION)\b' apps/*/src packages/*/src` → 1 linea: el NOMBRE de un test en
  `layout-guard.test.ts` («ORACULO DE LA MUTACION H1…»), no una mutacion viva. `git status --short` → `?? .pnpm-store`,
  `?? docs/revision-0189.md`.

### Por hallazgo

- **H1 — cerrado.** `layout.tsx` pasa `{ allowBlocked: true }`; cada pagina conserva su guard (18/18, ninguna con la
  llamada solo en comentario, ningun `route.ts`/server action bajo `/backoffice`). El barrido estatico es un proxy
  declarado como tal: su preimagen plausible restante es una pagina que nombre `requireOwner(` en un comentario/string
  sin llamarlo, o que delegue el guard a otro modulo (esta da rojo falso, no fuga). Hoy no existe ninguna (medido arriba).
- **H2 — cerrado, sin atasco legitimo.** `resumeCampaignsAfterBilling` retorna 0 solo si `effectivePlan(...) === null`,
  que (`entitlements/index.ts`) solo ocurre con acceso `subscribed` y `plan ∉ {base, plus}`. Casos de la clase (1):
  prueba extendida sin suscripcion → `effectivePlan = "trial"` → reanuda (sonda: verde); `plan='none'` con suscripcion
  viva nueva → retiene hasta que el `active` escribe `base|plus` → reanuda (`billing-incomplete.neon`); fila nula o sin
  acceso → no llega a esta funcion (pausa). Lo retenido NO queda fuera del barrido: su candidato es
  `pause_reason='billing_blocked' and accessSql`, que lo re-evalua cada dia hasta que el plan sea pago.
- **#6 — cerrado, sin doble cobro por reintentos.** La clave suma `trialEndSeconds ?? "now"`, derivado de la
  `trial_ends_at` GUARDADA (fecha fija, `Math.floor` a segundos) y del umbral de 48 h: dos reintentos del mismo intento
  dan la misma clave (`billing-checkout-guards.neon` asevera la misma clave dos veces). Solo cambia si cambia el
  `trial_end` que se manda, que es exactamente cuando Stripe rechazaria la vieja.

### Mutacion de la ronda 2

| id | archivo:linea | cambio | shasum limpio | test que la caza | asercion leida | revertida |
|---|---|---|---|---|---|---|
| R4 | `apps/merchant/src/server/marketing/plan-brake.ts` (1a linea de `resumeCampaignsAfterBilling`) | `effectivePlan(...) === null` → `row.plan` no es `base`/`plus` (la forma plausible de escribir «plan no pago → no decidir») | `a46a12f8cee62de8fa328f566d0f6076e1b75c09` | **NINGUNO de la rama**: `billing-sweep.neon` 3/3 y `billing-incomplete.neon` 1/1 VERDES (sus mundos nacen con `campaignWorld("plus")`, asi que «prueba EXTENDIDA a mano» corre con `plan='plus'`). Solo la sonda del revisor con `plan='trial'` | `expected { paused: +0, resumed: +0 } to deeply equal { paused: +0, resumed: 1 }` | `diff` vacio, mismo shasum |

### Hallazgos de la ronda 2

- **N1 — NO BLOQUEANTE (hueco de oraculo, no bug).** R4 sobrevive a la suite: con esa mutacion TODO comercio real en
  prueba (`plan='trial'`) al que se le extiende la prueba con `/extender-prueba` quedaria con las campañas en
  `billing_blocked` para siempre, y nada lo pondria rojo. El codigo actual es correcto (sonda verde). Arreglo: en el
  caso «prueba EXTENDIDA a mano» de `billing-sweep.neon`, poner `plan: 'trial'` (como hace la sonda).
- **N2 — menor.** El barrido literal de la DoD de este encargo (`rg '\b(MUTATION|MUTACION)\b' apps/*/src packages/*/src`)
  ya no da vacio por el nombre de un test; renombrarlo («ORACULO DE H1») o aceptar la excepcion.

### Declarado y NO perseguido (ronda 2)

- El bucle real en `next dev` con sesion (igual que ronda 1: el oraculo es el layout con `auth-guards` real).
- Doble sesion abierta si el umbral de 48 h se cruza entre dos clics y el owner completa ambas: la segunda la frena
  `subscription_live` solo despues del webhook; es el mismo riesgo que ya existia con claves por plan/intervalo, no lo
  abre este delta.

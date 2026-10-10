# Handoff — Spec 0189 (implementacion)

Estado: implementado (pendiente: revisor independiente con PASS; la spec NO se marca `implementada` aca).
Rama `spec-0189` (worktree `check-point-wt/spec-0189`, base `0524ab0`). Sin push, sin merge.

## Commits

| sha | que |
|---|---|
| `1d7a513` | feat(billing): planes pagos con prueba de 90 dias — codigo de produccion, migracion 0069, unit y suites Neon de billing |
| `d47e3b9` | test(billing): seeds con la fila de prueba del alta + ajustes de suites Neon |
| `3fbf1fd` | skill `/extender-prueba`, relectura de la migracion 0069 por SQL, barridos de la DoD |
| `46486d4` | T9 crea las campañas con `plus` y mide la reanudacion con `base` (M4 medida por la propiedad) |
| (este) | este handoff |

## Archivos tocados (produccion)

- DB: `packages/db/drizzle/0069_planes_pagos_con_prueba.sql` (+ `meta/0069_snapshot.json`, `_journal.json`),
  `packages/db/src/schema/{billing,campaign}.ts`, `packages/db/src/seed-local.ts`.
- Dominio: `packages/domain/src/server/billing-access.ts` (nuevo: `billingAccess`, `accessSql`,
  `businessHasAccessSql`, `billingAccessFailure`, `trialDaysLeft`), `entitlements/{catalog,index,live-subscription}.ts`,
  `marketing/{plan-gate,cross-store,welcome-store}.ts`, `consumer/{enrollment,enroll-landing}.ts`.
- Merchant: `server/billing/{applicability,derive,derive-rules,facts,gateway,index,plan-change,reconcile,store,view,webhook,webhook-apply}.ts`,
  `server/billing/prices.ts` (nuevo), `server/billing-gate.ts` (nuevo), `server/{api-owner,api-permission,operator-guard,auth-guards,session-view,stripe-config,onboarding-signup}.ts`,
  `server/locations/{core,shared,index}.ts`, `server/catalog-import/quota.ts`, `server/marketing/{plan-brake,campaign-actions}.ts`,
  `server/marketing/billing-sweep.ts` (nuevo), `app/api/billing/{_auth,checkout,interval,cancel,state}`,
  `app/api/billing/{plan,resume}/route.ts` (nuevas), `app/api/billing/_stripe-item.ts` (nuevo),
  `app/api/internal/billing-sweep/route.ts` (nueva), `app/api/merchant/{auth/staff,session}/route.ts`, `vercel.json`.
- Borrados: `app/api/billing/settle-free/route.ts`, `app/api/billing/_downgrade.ts`.
- Skill: `.claude/skills/extender-prueba/SKILL.md` (TEMPORAL).

## Cambios en zona GPT (mecanicos, declarados)

| archivo | cambio |
|---|---|
| `apps/merchant/src/app/backoffice/page.tsx:104` | `?? "free"` → `?? "none"` (la linea que pedia la spec) |
| `apps/merchant/src/app/backoffice/subscription/page.tsx` | `requireOwner({ allowBlocked: true })` (la linea de la spec) **y ademas**, para que compile: `activeCampaignCount` → `activeCampaignsOutsideBase`, `decidePlanChange` con la forma nueva (`trialEndsAt`, `now`, `intent: {kind: "cancel"}`), `canCancel = schedule_cancel`, `priceIds: configuration.priceIds` en la reconciliacion, y el aviso `?done=cancel` («Diste de baja tu plan: ya estás en Free.» era FALSO) → «Cancelaste tu suscripción: sigue activa hasta el final del periodo.» |
| `apps/merchant/src/app/backoffice/locations/page.tsx` | NO estaba en la spec: el `select` lee `status`/`stripeSubscriptionId`/`trialEndsAt` en vez de `pendingPlan`, y `effectiveLocationLimit(row, new Date())` (el tope ahora sale del plan EFECTIVO; `pendingPlan` ya no lo baja) |
| `apps/merchant/src/app/backoffice/locations/page-guard.test.ts` | el doble de la fila: `plan: "free"` → `"trial"` |
| `tests/e2e/support/ui-kit-entry.tsx` | demo del kit: `value: "free"` → `"trial"` (label «Gratis» igual; lo exige el barrido de la DoD) |
| tests de la consola (`billing-click-probe`, `billing-cancel-dialog`, `billing-pages*`) | las etiquetas que salen de `subscriptionOffers`: «Mejorar a Plus» → «Elegir un plan», «Bajar a Free» → «Cancelar suscripción» |

## Comandos ejecutados y resultado

- `pnpm verify` (Node 24, una vez al final, sobre `46486d4`) — **ok**:

```
gate         | corrio/salteado (motivo) | ok/ROJO | segundos
typecheck    | corrio                   | ok      | 12.3
lint         | corrio                   | ok      | 12.9
ui-guard     | corrio                   | ok      | 1.6
format:check | corrio                   | ok      | 26.5
test         | corrio                   | ok      | 58.1
build        | corrio                   | ok      | 26.8
test:e2e     | corrio                   | ok      | 74.6
neon (full)  | corrio                   | ok      | 421.6

verify: ok
```

  - `test`: 249 archivos passed / 199 skipped (448); 2457 tests passed / 1066 skipped.
  - `test:e2e`: 298 passed / 21 skipped (puertos propios 3100-3102; los `next dev` del arbol principal en 3200/3201 no
    interfirieron).
  - `neon (full)` (rama `ci-integration`, migrada por `tools/neon-test.sh`): **407 archivos passed / 41 skipped (448);
    3278 tests passed / 282 skipped**. Los skipped son suites de campañas APAGADAS (`enabled-campaigns.ts`, ADR 0115) y
    `local-roles` — no son de esta spec.
- Suites nuevas, corridas sueltas con `tools/neon-test.sh` (verdes): `billing-access.neon` (T2, 9/9),
  `billing-guards.neon` (T7, 4/4), `billing-consumer-access.neon` (T8, 2/2), `billing-sweep.neon` (T9, 3/3),
  `billing.neon` + `billing-plan-routes.neon` (T10), `billing-migration.neon` (4/4), `billing-state.neon` (9/9).
- T8 con el ROL DEL CLIENTE: `tools/neon-test.sh --app consumer` (sin archivos corre la tanda entera de las dos apps):
  406 passed / 41 skipped, incluidos los 8 `consumer-role*.neon` y `consumer-identity.neon` CON el rol
  `checkpass_consumer` (la landing y la Bienvenida leen `core.subscription` por `accessSql` con ese rol).
- Migracion 0069 releida por SQL en `ci-integration` (`billing-migration.neon.integration.test.ts`, 4/4):
  `trial_ends_at timestamptz NULL`; default de `plan` = `'trial'::text`; `core_campaign_pause_reason_check` contiene
  `'billing_blocked'`; `has_column_privilege('checkpass_consumer','core.subscription', c, 'SELECT')` = true para
  `business_id`, `status`, `stripe_subscription_id`, `trial_ends_at`.
- Barridos de la DoD (exit 1 = vacio):
  - `rg -n '"free"|settle-free|settleToFree|settle_to_free' apps packages tests --type ts` → vacio.
  - `rg -n "requiresLiveSubscription|pendingRule" packages/domain/src` → vacio.
  - `rg -n MUTATION apps packages tools` → vacio.

## DoD

- [x] barrido `"free"`/`settle-free` vacio (arriba).
- [x] barrido `requiresLiveSubscription|pendingRule` vacio.
- [x] migracion 0069 aplicada a `ci-integration` por `tools/neon-test.sh` y releida por SQL (arriba).
- [x] suites del plan de pruebas (T1–T11) en verde — mapa abajo.
- [x] tabla de mutaciones M1–M6 ejecutada, rojo leido por la asercion, revertida con `diff` (abajo).
- [x] `pnpm verify` verde con Node 24, una vez al final (arriba).
- [x] `rg -n MUTATION apps packages tools` vacio.
- [ ] revisor independiente: `PASS` — pendiente (no es de este agente).

### Donde vive cada T

| T | archivo |
|---|---|
| T1 | `apps/merchant/src/server/billing-access.test.ts` (tabla compartida `billing-access-cases.ts`) |
| T2 | `apps/merchant/src/server/billing-access.neon.integration.test.ts` (misma tabla) |
| T3 | `apps/merchant/src/server/entitlements-catalog.test.ts` |
| T4 | `apps/merchant/src/server/marketing/plan-gate.test.ts` |
| T5 | `billing-plan-change.test.ts` (matriz de 155.520 puntos) + `billing-plan-change-rows.test.ts` (casos nombrados, `checkoutTrialEnd`) |
| T6 | `billing-derive.test.ts` |
| T7 | `billing-guards.neon.integration.test.ts` (+ `billing-state.neon` y `session.neon`: 200 bloqueado) + `api-permission.test.ts` (paso 6) |
| T8 | `billing-consumer-access.neon.integration.test.ts` (+ suite `consumer-role*` con el rol) |
| T9 | `billing-sweep.neon.integration.test.ts` |
| T10 | `billing.neon.integration.test.ts` (checkout) + `billing-plan-routes.neon.integration.test.ts` (plan/cancel/resume) + `billing-campaign-block.neon` (bajar a base con campañas) |
| T11 | `onboarding-signup.neon.integration.test.ts` (`plan='trial'`, `trial_ends_at` a 90 dias ±1 min) |

## Bitacora de mutaciones

| id | archivo | shasum limpio | invariante | resultado EJECUTADO |
|---|---|---|---|---|
| M1 | packages/domain/src/server/billing-access.ts | 442fae53431b41e7f19c99cf2467fddcea4a2b21 | una prueba que vence EXACTAMENTE en now ya vencio (`>` y no `>=`) | ROJO. Alcance: 7 unit (billing-access, entitlements-catalog, plan-gate, locations, locations-plan-cap, billing-plan-change, -rows) + T2 neon. `billing-access.test.ts > 'prueba que vence EXACTAMENTE en now' → 'blocked'`: `expected 'trial' to be 'blocked'`; tambien rojos `locations-plan-cap` («una prueba vigente da 3 y una vencida 1»: limit 3 vs 1) y `plan-gate` («el reloj importa»). T2 neon: `× prueba que vence EXACTAMENTE en now: el SQL coincide con billingAccess` (`expected false to be true`). 3 failed / 92 passed unit; 1 failed / 8 passed T2. Revertida: `diff` vacio, shasum 442fae53… |
| M2 | apps/merchant/src/server/api-owner.ts | 00abcb5b7a79251122192980de8a9434ef8edfae | `requireApiOwner` corta con 402 a un negocio sin acceso (paso 5) | ROJO. Alcance: `billing-guards.neon` (T7) + `billing-state.neon`. `× prueba VENCIDA sin suscripción: 402 …` → `AssertionError: ticket: expected 200 to be 402` (`billing-guards.neon.integration.test.ts:123`): la ruta `GET /api/merchant/business/ticket`, que pasa SOLO por `requireApiOwner`. `billing-state.neon` 9/9 verde (usa `allowBlocked`, no depende del paso). 1 failed / 12 passed. Revertida: `diff` vacio, shasum 00abcb5b… |
| M3 | packages/domain/src/server/consumer/enrollment.ts | 835d8c110113784275cc61b35c549b3638a9c957 | el alta de un comercio SIN acceso es 404 (filtro de `loadEnrollableProgram`) | ROJO. Alcance: `billing-consumer-access.neon` (T8) + `consumer-enrollment.neon`. `× SIN acceso: alta 404, landing null, …` → `AssertionError: promise resolved "{ …(8) }" instead of rejecting` (linea 99, el `enrollAccount` que tenia que dar 404): el alta ENTRO con el comercio bloqueado. `consumer-enrollment.neon` 8/8 verde (no siembra bloqueados). 1 failed / 9 passed. Revertida: `diff` vacio, shasum 835d8c11… |
| M4 | packages/domain/src/server/entitlements/catalog.ts | ca8baeca94a3a981c5f6623cb76eaef5460c47b7 | la Venta cruzada esta incluida en el plan base (`campaigns.cross.byPlan.base`) | ROJO. Alcance 1.a corrida: 4 unit (plan-gate, entitlements-catalog, billing-plan-change, -rows) + `billing-sweep.neon` + `marketing-welcome-plans.neon`. T4: `plan-gate.test.ts > plantilla cross` → `cross × base: expected false to be true`; T3: `campaigns.cross × base: expected false to be true` y `BASE_TEMPLATE_KEYS` `['welcome']` vs `['cross','welcome']`; welcome-plans neon 3 rojos (activar/reanudar la cruzada en base → 402 `plan_not_allowed`; conteo fuera del base 2 vs 1). **T9 dio rojo POR EL MOTIVO EQUIVOCADO**: caia en el SETUP (`enableTemplate(cross)` en un mundo `base` → 402, linea 71), no en «la cruzada vuelve con base». Revertida (`diff` vacio), se arreglo el test (las campañas se crean con `plus` y el plan pasa a `base` al recuperar el acceso), verde limpio 3/3, y se RE-MIDIO: `× pausa sin acceso, reanuda con base …` → `expected { paused: 0, resumed: 1 } to deeply equal { paused: 0, resumed: 2 }` (linea 116: la cruzada no volvio). Revertida otra vez: `diff` vacio, shasum ca8baeca… |
| M5 | apps/merchant/src/server/billing/plan-change.ts | 424dbf362b61fb82027288336615f16197ae99a9 | con menos de 48 h de prueba el Checkout cobra en el acto (`trialEnd = null`) | ROJO. Alcance: 3 unit (billing-plan-change, -rows, billing-routes) + `billing.neon` (T10). T5: `checkoutTrialEnd … > a 48 h − 1 ms del fin de la prueba se cobra en el acto (null)` → `expected 2026-10-12T11:59:59.999Z to be null`; la matriz de 155.520 puntos tambien (`cada punto del dominio cae en la guarda declarada`). T10: `× checkout con la prueba vencida (o a < 48 h) …` → `expected { metadata, … } to not have property "trial_end"`. Revertida: `diff` vacio, shasum 424dbf36… |
| M6 | apps/merchant/src/server/marketing/plan-brake.ts | 8433e38d55cb760a79b6c566388f9ab6b66c4f46 | reanudar toca SOLO lo pausado por `billing_blocked` (nunca una pausa `owner`) | ROJO. Mutacion: el filtro `pause_reason = 'billing_blocked'` reemplazado por `status = 'paused'` (la forma plausible: «reanudar las pausadas»). Alcance: `billing-sweep.neon` (T9) + `billing-webhook-campaign-brake.neon`. T9: `× pausa sin acceso, reanuda con base …` → `expected { …owner: "paused/plan_downgraded" } to deeply equal { …owner: "paused/owner" }` (linea 117): la pausa del OWNER se reescribio. webhook-campaign-brake 5/5 verde (no siembra pausas del owner). 1 failed / 7 passed. Revertida: `diff` vacio, shasum 8433e38d… |

Todas con la etiqueta `MUTATION` puesta, medidas DE A UNA, revertidas copiando la copia limpia y confirmadas con `diff`
vacio + el mismo `shasum`. **M4 midio primero T9 por el motivo equivocado** (el setup, no la propiedad): se revirtio, se
arreglo el test y se re-midio (fila M4).

## Tests borrados o reescritos (con motivo)

Borrados junto con su feature (la baja inmediata del ADR 0063 y `settle-free`, revertidos por el ADR 0134 §8 / spec §Archivos):
- `billing-downgrade-now.neon.integration.test.ts` entero (3 tests: «upgrade → 3 locales → baja: queda free», «deleted antes del paso 4 → free», «deleted despues del paso 4 se ignora»).
- `billing-cancel-guards.neon`: «un REINTENTO de cancel que falla determinista NO borra la baja», «settle-free sobre una suscripcion VIVA la CANCELA», «el revert clasifica un 4xx por rawType/statusCode» (el revert ya no existe: `cancel` no escribe antes de Stripe). Quedaron el del log y el del lock (ahora sobre `cancel` y `plan`).
- `billing-store.test.ts`: los 2 de `settleToFree`; los de `scheduleDowngrade` reescritos sobre `scheduleCancel`.
- `billing-store.neon`: el de `settleToFree` → reemplazado por «`scheduleCancel`/`clearPendingPlan` escriben SOLO su negocio» (la propiedad del `where` que ese test cubria).
- `billing.neon` (reescrito como T10): «settle-free 409/SET D10», «cancel con 2 locales: downgrade_blocked», «cancel escribe la intencion ANTES de Stripe (M5 vieja)», «error de RED deja el estado / determinista lo revierte».
- `billing-dead-state.neon`: «SALIDA 2 (D10)» (alias `settle-free` === `downgradeToFree`) → reemplazado por «el estado muerto no es callejon: el checkout procede».
- `billing-campaign-block.neon`: «la PAGINA cruza el code de campañas a la consola» (cancelar ya no bloquea por campañas; la pantalla de cambio de plan es de GPT).
- `locations-plan-cap.test.ts` / `locations.test.ts`: los de `pendingDowngrade` y del `min` con el pendiente (el concepto murio: `pending_plan` ya no baja el tope).
- `entitlements-catalog.test.ts`, `entitlements-window.test.ts`, `plan-gate.test.ts`, `billing-plan-change*.test.ts`, `billing-offers.test.ts`, `marketing-welcome-plans.neon`, `billing-webhook-campaign-brake.neon`: reescritos al comportamiento nuevo (planes trial/base/plus/none, plan efectivo, Bienvenida tambien se pausa sin acceso).
- `entitlements-catalog.test.ts` «free es desconocido» y `billing-view.test.ts` caso `["free"]`: sacados para que el barrido de la DoD quede vacio (`enterprise`/`null` cubren el fallback).
- `billing-derive.test.ts`: los dos terminales sobre plan pago fusionados en un `it.each` (tamaño).
- `billing-integration-support.ts`: `seedLiveSubscription` borrado (su unico consumidor era el archivo de la baja inmediata).

## Declarado AFUERA

- La UI (GPT): no hay e2e de cobro hasta sus pantallas. Stripe real: todo con Stripe doblado.
- El lag ≤ ~24 h entre el vencimiento y la pausa por el barrido (ADR 0134).
- La GRANT por columna de la 0069 es redundante (ver hallazgo 5): el oraculo `has_column_privilege` da true tambien por el `GRANT SELECT` de TABLA de la 0060; no hay forma de distinguirlos sin revocar el de tabla, que no es de esta spec.
- `marketing-campaign-actions.neon` esta SKIPPEADO entero (`COMPOSER_ENABLED=false`): sus dos ediciones (`world("base")`, `plan: "none"`) no corren.
- `catalog-import-states.test.ts` ya estaba en 332 lineas (sobre el limite) antes de esta spec; se toco UNA linea sin crecer.

## Hallazgos a decidir

1. **El cron de Vercel invoca con GET**, y la spec dice `POST /api/internal/billing-sweep`: la ruta exporta `POST` (contrato) y `GET` (lo que llama el cron; asi estan los otros dos crons, `loyalty-expiry` y `assets-cleanup`). Ademas, **tres comentarios del arbol afirman que Hobby admite como maximo DOS crons** y que un tercero hace que Vercel rechace el deploy (`api/internal/{assets-cleanup,marketing-tick,catalog-imports/reconcile}/route.ts`), mientras la skill de gotchas dice que la doc de 2026-07 admite 100 diarios. Con `vercel.json` en 3 crons: **verificar contra la doc/plan de Vercel ANTES del push**; si el limite de 2 sigue vigente, el deploy se rechaza entero (alternativa ya usada: workflow de GitHub con `CRON_SECRET`, como `wallet-push`).
2. **La consola de suscripcion de hoy (GPT) manda `checkout` sin `plan`** (`{interval, from}`) → 400 `invalid_input` hasta que GPT haga la pantalla del contrato §D10. Sus textos todavia dicen «Tu plan baja a Free…» (`subscription-console.tsx:190-198`), y `campaign-labels.ts` (`PAUSE_REASON_LABELS`) no tiene `billing_blocked`. No se tocaron (zona GPT).
3. **Ventana con id de Stripe y plan `trial`**: cuando el owner contrata en la prueba, `checkout.session.completed` bindea el id ANTES de que el webhook escriba `base`/`plus`; y si la suscripcion queda `incomplete` (3DS), el plan no se escribe. En esos tramos `billingAccess` = `subscribed` y el plan efectivo es el `fallback` (1 local, sin campañas), tal como manda §D2 («subscribed → ctx.plan; si no es base|plus, fallback»). Si `incomplete_expired`, vuelve a `trial`. Decidir si `subscribed` sobre una fila `trial` deberia seguir dando `trial`.
4. **Staff de un negocio bloqueado** en el backoffice: se lo rebota a `/?e=payment_required` (mandarlo a `/backoffice/subscription` cerraba un ciclo con el rebote de `requireOwner` al mostrador). Un owner SUSPENDIDO y bloqueado conserva su pantalla de suspension (el rebote de cobro solo corre con `status='active'`). La copia de `?e=payment_required` en la portada es de GPT.
5. La `GRANT SELECT (...)` por columna de la 0069 es redundante con el `GRANT SELECT ON core.subscription` de tabla de la 0060 (que ya cubre columnas nuevas). Se dejo porque la spec la pide; no cambia nada.
6. **Clave de idempotencia del checkout fija** (`checkout:${businessId}:${plan}:${interval}`, como dice la spec): si dentro de 24 h el `trial_end` cambia (la prueba cruza el umbral de 48 h, o se extiende con `/extender-prueba`), Stripe rechaza la clave reusada con otros params → 503 `unavailable`. Raro, pero posible.
7. `resume` manda solo `cancel_at_period_end: false` (la letra de §D7). Una cancelacion hecha desde el dashboard con `cancel_at` explicito no se deshace asi; el webhook seguiria escribiendo `pending_plan='none'`.
8. **Ya no hay freno defensivo al bajar a `base` por fuera de nuestra ruta** (p. ej. desde el dashboard de Stripe con campañas fuera del base activas): §D4 reemplazo la pausa `plan_downgraded` del webhook por el sync de acceso, y con acceso no se pausa nada. Hoy las unicas plantillas encendidas son Bienvenida y Venta cruzada (ADR 0115, las dos en el base) y no se pueden crear ni activar otras; una campaña de otra plantilla que ya estuviera activa desde antes no se mediria.
9. `/extender-prueba +N dias` cuenta desde el fin actual si la prueba sigue vigente y desde ahora si ya vencio (`greatest(trial_ends_at, now())`); una fecha absoluta en PROD que este en el pasado pide confirmacion explicita (bloquea al comercio). Es una regla de la skill, no del owner.
10. Las campañas pausadas por `billing_blocked` cancelan sus turnos con `cancel_reason='campaign_paused'` (el `case` de `turn-lifecycle.ts` no tiene un motivo propio de cobro). Solo describe.
11. `billing-access.ts` importa `drizzle-orm` (`sql`) y la hoja `live-subscription.ts`: «sin imports» de la spec es imposible para `accessSql`; no importa nada de dominio.
12. `runBillingSweep(now, businessIds?)`: el segundo parametro es SOLO para las suites (acota el barrido al negocio del test para no pausar campañas de otro archivo en paralelo, el mismo recorte que `cancelTurns(db, businessIds)`); la ruta nunca lo pasa.
13. T9 usa una campaña PROPIA (`template_key` NULL) donde la spec nombra «En riesgo»: `at_risk` esta apagada (ADR 0115) y no se puede encender; las dos caen en `campaigns.enabled`.
14. `PLAN_NOT_ALLOWED_MESSAGE` sigue «Las campañas son del plan Plus.» (cierto: lo que el base no incluye esta en Plus). No se renombro.
15. `subscriptionOffers` decide «plan pago vivo» por el `status` (el DTO no lleva el id de Stripe, a proposito).

## Bloqueos

Ninguno.

## Ronda 2 — correcciones de la revision (`docs/revision-0189.md`: FAIL por H1)

Commits: `e19c526` (H1), `d111746` (H2), `b1fe965` (#6). Nada mas tocado.

### H1 (bloqueante) — el owner sin acceso entraba en bucle en `/backoffice/subscription`

`apps/merchant/src/app/backoffice/layout.tsx` (envuelve TODAS las paginas de `/backoffice`, tambien la de suscripcion):

```diff
-  const session = await requireBackofficeSession();
+  const session = await requireBackofficeSession({ allowBlocked: true });
```

Seguro porque el corte vive en cada pagina. Verificado: las 18 `page.tsx` bajo `app/backoffice` llaman a
`requireOwner(` o `requireBackofficeSession(`, y solo `subscription/page.tsx` con `allowBlocked`.

Test nuevo `apps/merchant/src/app/backoffice/layout-guard.test.ts` (unit, `auth-guards` REAL, acceso doblado a `blocked`):
- CONTROL: el guard sin `allowBlocked` lanza `redirect("/backoffice/subscription")`.
- (a) el layout NO redirige al owner bloqueado (`resolves`, `redirect` no llamado).
- (b) barrido estatico (PROXY, etiquetado): piso de >= 18 `page.tsx` escaneados, todos llaman a su guard, y el
  conjunto con `allowBlocked` es exactamente `["subscription/page.tsx"]`.

### H2 — un evento `incomplete` antes del `active` dejaba las campañas en `plan_downgraded` para siempre

`apps/merchant/src/server/marketing/plan-brake.ts`, al principio de `resumeCampaignsAfterBilling`:

```diff
+  if (effectivePlan(row === null ? null : { ...row, now }) === null) return 0;
```

Con el plan efectivo de FALLBACK (suscripcion viva sobre una fila cuyo plan todavia no es pago) no se decide nada: las
campañas quedan `billing_blocked` y vuelven cuando llega el `active` + plan pago.

Test nuevo `apps/merchant/src/server/billing-incomplete.neon.integration.test.ts` (la sonda del revisor, convertida):
prueba vencida → barrido pausa la Bienvenida → `applySubscriptionState(incomplete)` → sigue `paused/billing_blocked` →
`applySubscriptionState(active, base)` → `active/null` → barrido `{0, 0}`.

### #6 — el `trial_end` entra en la clave de idempotencia del checkout

`apps/merchant/src/app/api/billing/checkout/route.ts`:

```diff
-      { idempotencyKey: `checkout:${businessId}:${plan}:${interval}` },
+      {
+        idempotencyKey: `checkout:${businessId}:${plan}:${interval}:${trialEndSeconds ?? "now"}`,
+      },
```

Tests: `billing.neon` (en prueba la clave lleva los segundos del fin de la prueba; vencida, `:now`) y
`billing-checkout-guards.neon` (la clave fija con plan, intervalo y `trial_end`). Nota: `from` sigue fuera de la clave
(el mismo defecto ya existia antes de la spec, segun la revision); no se toco.

### Bitacora (ronda 2)

| id | archivo | shasum limpio | invariante | resultado EJECUTADO |
|---|---|---|---|---|
| MH1 | apps/merchant/src/app/backoffice/layout.tsx | 5fe78186d93d053a5c2e68c765d376b8331b8061 | el layout de /backoffice NO aplica el rebote de cobro (allowBlocked) | ROJO. Mutacion: `requireBackofficeSession({ allowBlocked: true })` → `requireBackofficeSession()`. Alcance: los 35 archivos de `src/app/backoffice` (unit). `layout-guard.test.ts > ORACULO DE LA MUTACION H1: el layout NO redirige` → `AssertionError: promise rejected "Error: REDIRECT:/backoffice/subscription" instead of resolving`. 1 failed / 276 passed. Revertida: `diff` vacio, shasum 5fe78186… |
| MH2 | apps/merchant/src/server/marketing/plan-brake.ts | a46a12f8cee62de8fa328f566d0f6076e1b75c09 | con plan efectivo de FALLBACK la reanudacion no toca las campañas `billing_blocked` | ROJO. Mutacion: se borro `if (effectivePlan(…) === null) return 0;`. Alcance: `billing-incomplete.neon` + `billing-sweep.neon`. `× incomplete → la Bienvenida queda billing_blocked; active + base → vuelve` → `expected 'paused/plan_downgraded' to be 'paused/billing_blocked'` (linea 78, la asercion intermedia tras el evento `incomplete`: corta antes que la final `active/null`, que es la que midio el revisor sobre el codigo sin arreglo). `billing-sweep.neon` 3/3 verde. 1 failed / 3 passed. Revertida: `diff` vacio, shasum a46a12f8… |

### Suites corridas (ronda 2)

- `vitest run src/app/backoffice` (35 archivos): verde (y rojo 1/277 bajo MH1).
- `tools/neon-test.sh billing-incomplete billing-sweep billing-webhook-campaign-brake`: 9/9.
- `tools/neon-test.sh billing billing-checkout-guards billing-dead-state`: 10/10.

### `pnpm verify` (Node 24, una vez al final, sobre `b1fe965`) — ok

```
gate         | corrio/salteado (motivo) | ok/ROJO | segundos
typecheck    | corrio                   | ok      | 2.6
lint         | corrio                   | ok      | 6.2
ui-guard     | corrio                   | ok      | 0.8
format:check | corrio                   | ok      | 7.3
test         | corrio                   | ok      | 40.7
build        | corrio                   | ok      | 9.6
test:e2e     | corrio                   | ok      | 71.5
neon (full)  | corrio                   | ok      | 415.7

verify: ok
```

- `test`: 250 archivos pasados / 200 skipped; 2462 tests pasados / 1067 skipped.
- `test:e2e`: 298 pasados / 21 skipped.
- `neon (full)`: 409 archivos pasados / 41 skipped; 3284 tests pasados / 282 skipped.
- `rg -n MUTATION apps packages tools` → vacio.

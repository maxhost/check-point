---
spec: 0189
fecha: 2026-10-10
estado: cerrada
resumen: Implementa el ADR 0134 (L3). Muere el plan `free`; el alta nace en `trial` con `trial_ends_at` a 90 dias; planes pagos `base` ($20/$200) y `plus` ($49/$490) con 4 precios de Stripe; un eje de ACCESO (suscripcion viva o prueba vigente) que bloquea con 402 `payment_required` el panel, el mostrador, el POS y el login del personal, y que corta inscripcion, Bienvenida y Venta cruzada; checkout con `trial_end`, cambio base↔plus, cancelar al fin del periodo y reanudar; barrido diario que pausa/reanuda campañas (`billing_blocked`); migracion 0069 (columna, default, datos de los 3 comercios, motivo de pausa, grant al rol del cliente). Solo API + servidor + DB; las pantallas son de GPT con el contrato de §D10.
disjunta: no
archivos: packages/db/drizzle/0069_* (+ meta), packages/db/src/schema/{billing,campaign}.ts, packages/db/src/seed-local.ts, packages/domain/src/server/entitlements/*, packages/domain/src/server/billing-access.ts (nuevo), packages/domain/src/server/business-status.ts, packages/domain/src/server/marketing/{plan-gate,cross-store,welcome-store}.ts, packages/domain/src/server/consumer/{enrollment,enroll-landing}.ts, apps/merchant/src/server/billing/*, apps/merchant/src/server/{api-owner,api-permission,operator-guard,auth-guards,session-view,stripe-config,onboarding-signup}.ts, apps/merchant/src/server/locations/core.ts, apps/merchant/src/server/marketing/{plan-brake,campaign-store,campaign-actions,template-store}.ts, apps/merchant/src/app/api/billing/** (settle-free se borra; plan y resume nuevas), apps/merchant/src/app/api/internal/billing-sweep/route.ts (nueva), apps/merchant/src/app/api/merchant/auth/staff/route.ts, apps/merchant/vercel.json, apps/merchant/src/app/backoffice/{page.tsx,subscription/page.tsx} (una linea cada una), .claude/skills/extender-prueba/SKILL.md (nueva), tests de billing/entitlements/locations/marketing/onboarding que fijan `free`
---

# 0189 — Planes pagos con prueba de 90 dias

> **L3** (owner 2026-10-10: «L3»). Un implementador y un revisor (`docs/AGENT-WORKFLOW.md`). Decisiones de producto:
> ADR 0134 — esta spec no decide producto; lo marcado *(tecnica)* es decision de diseño de Claude.

## Problema

- `free` es el piso de todo el cobro y el owner lo elimina (ADR 0134 §1): el alta lo escribe
  (`apps/merchant/src/server/onboarding-signup.ts:143`), el catalogo lo define (`entitlements/catalog.ts:31`), cancelar
  aterriza ahi (`app/api/billing/_downgrade.ts`, `server/billing/store.ts:133`), la bajada compara contra
  `locationLimitForPlan("free")` (`server/billing/plan-change.ts:186`) y `settle-free` existe solo para volver a el.
- Hay un solo plan pago con dos precios (`server/stripe-config.ts`: `STRIPE_PRICE_PLUS_{MONTHLY,YEARLY}_*`); el owner
  pide dos planes pagos ($20 y $49) con anual (ADR 0134 §4, §5, §10).
- No existe la nocion de prueba ni de «sin acceso»: el unico freno de negocio es `core.business.status`
  (`packages/domain/src/server/business-status.ts:60`), que es la suspension manual del owner, no el pago.
- La Venta cruzada se decide con `campaigns.enabled` (`marketing/cross-store.ts:6`, `campaignsAllowedFor`), que hoy es
  solo de `plus`; el ADR 0134 §4 la pone en el plan base.
- Cancelar corta en el acto (`app/api/billing/cancel/route.ts`, ADR 0063); el ADR 0134 §8 lo pasa al fin del periodo.

Medido en PROD el 2026-10-10 (`select plan,status,count(*) … from core.subscription`): 3 filas, `free`/`active`, 0 con
`stripe_subscription_id`.

## Alcance

**Entra:** migracion 0069; catalogo de planes y eje de acceso; guardias 402; corte de inscripcion/Bienvenida/Venta
cruzada para comercios sin acceso; Stripe con 4 precios; checkout con `trial_end`; cambio de plan; cancelar al fin del
periodo y reanudar; barrido diario; estado de cobro en la sesion y en `/api/billing/state`; skill provisoria
`/extender-prueba`; borrar `settle-free` y toda referencia a `free`.

**No entra:**
- Pantallas (paywall, elegir plan, aviso de dias de prueba): GPT, con el contrato de §D10, despues de esta spec.
- Panel de plataforma (`admin.checkpass.club`): spec propia (ADR 0134 §3).
- Nombres comerciales de los planes: llegan de GPT; aca van etiquetas provisorias en un solo lugar (§D9).
- Bloqueo por impago `past_due`/`unpaid` (PARQUEADO #54): sigue con acceso.
- Extender la prueba de un comercio que YA tiene suscripcion en Stripe en `trialing` (exige mover el `trial_end` en
  Stripe): la skill se niega y lo dice.
- Crear los precios en Stripe y cargar las variables en Vercel: lo hace el owner (§Abierto, no bloquea el codigo).

## Diseño

### D1 — Migracion 0069 (`drizzle-kit generate` + SQL a mano donde haga falta; la spec no dicta el texto)

1. `core.subscription.trial_ends_at timestamptz NULL`.
2. Default de `core.subscription.plan`: `'free'` → `'trial'`.
3. Datos: `UPDATE core.subscription SET plan='trial', trial_ends_at = now() + interval '90 days', updated_at = now()
   WHERE plan = 'free'` (ADR 0134 §12). En PROD son 3 filas.
4. `core_campaign_pause_reason_check` admite ademas `'billing_blocked'`.
5. `GRANT SELECT (business_id, status, stripe_subscription_id, trial_ends_at) ON core.subscription TO
   checkpass_consumer` — la inscripcion corre en el cliente con ese rol (migracion 0060) y tiene que leer el acceso.

Aditiva salvo el `UPDATE`; el codigo viejo de PROD lee `plan='trial'` como plan desconocido → `fallback` (1 local, sin
campañas): inofensivo, pero la migracion se aplica **inmediatamente antes** del push que trae este codigo.

### D2 — Planes y acceso (dominio, sin imports pesados)

**Nuevo `packages/domain/src/server/billing-access.ts`** (sin imports, como `business-status.ts`):

```ts
export const TRIAL_DAYS = 90;
export type BillingAccess = "subscribed" | "trial" | "blocked";
export type AccessRow = { status: string; stripeSubscriptionId: string | null; trialEndsAt: Date | null };
export function billingAccess(row: AccessRow | null, now: Date): BillingAccess
```

Orden normativo, primer match gana: `row === null` → `blocked` (fail-closed: todo negocio tiene fila,
`core_subscription_business_unique`); `hasLiveSubscription(row)` (id no nulo y status fuera de
`{canceled, incomplete_expired}`, la regla de hoy en `entitlements/live-subscription.ts`, se mueve o se reusa sin
copiarla) → `subscribed`; `trialEndsAt !== null && trialEndsAt.getTime() > now.getTime()` → `trial`; si no → `blocked`.
`past_due`/`unpaid`/`incomplete` con id → `subscribed` (ADR 0134 consecuencias, PARQUEADO #54).

Exporta tambien **`accessSql(alias: string, now: Date)`**: el mismo predicado como fragmento `sql` de drizzle sobre una
fila `core.subscription` con alias explicito (regla de la skill de gotchas: subconsultas correlacionadas en SQL crudo con
alias). Es la UNICA definicion SQL; las dos versiones comparten tabla de casos (§Plan de pruebas, T2).

**Catalogo (`entitlements/catalog.ts`):** `KNOWN_PLANS = ["trial", "base", "plus", "none"]`;
`PAID_PLANS = {base, plus}`.

| clave | trial | base | plus | none | fallback |
|---|---|---|---|---|---|
| `locations.max` | 3 | 1 | 3 | 1 | 1 |
| `campaigns.enabled` (resto de plantillas y campañas propias) | true | false | true | false | false |
| `campaigns.welcome` | true | true | true | false | false |
| `campaigns.cross` (nueva) | true | true | true | false | false |
| `catalog.imports.analyses` / `.attempts` (dia) | 100 | 100 | 100 | 100 | 100 |

*(tecnica)* **El plan EFECTIVO reemplaza a `requiresLiveSubscription` y a `pendingRule`.** `EntitlementContext` pasa a
`{ plan, status, stripeSubscriptionId, trialEndsAt, now }` y el valor sale de `byPlan[effectivePlan(ctx)]` con:
`subscribed` → `ctx.plan` (si no es `base|plus`, `fallback`); `trial` → `"trial"`; `blocked` → `"none"`. `pendingPlan`
deja de influir: desde esta spec solo vale `'none'` (cancelacion programada) y el ADR 0134 §8 dice que se usa lo pagado
hasta el final; la bajada plus→base es inmediata (§D6), asi que el `min` ya no protege nada. Para preguntar por un plan
DESTINO literal (bloqueos de bajada) queda `limitForPlan(plan, key)` / `flagForPlan(plan, key)` sin contexto.
`TRIAL_DAYS` y los precios de exhibicion (`PLAN_PRICES_USD = { base: {month: 20, year: 200}, plus: {month: 49, year:
490} }`) viven en el catalogo; el cobro real es de Stripe.

**Plantillas permitidas en el base** *(tecnica)*: `BASE_TEMPLATE_KEYS = ["welcome", "cross"]` derivado del catalogo
(una plantilla esta en el base si su flag es `true` en `base`), no escrito a mano en otro lugar.

### D3 — `campaignAllowedFor` por plantilla

`plan-gate.ts`: `welcome` → `campaigns.welcome`; `cross` → `campaigns.cross`; cualquier otra (incluida `valley` y
`null` = campaña propia) → `campaigns.enabled`. `readPlanRow` lee tambien `trial_ends_at`. `cross-store.ts:130-151`
deja de llamar a `campaignsAllowedFor` y decide por la plantilla de cada candidata (`cross` o `valley`) con la fila
completa.

### D4 — Corte por falta de acceso

**Guardias (402 `payment_required`, mensaje «Tu prueba termino. Elige un plan para seguir.»** — o
«Tu suscripcion termino…» si `plan='none'` y `trial_ends_at` vencio con una suscripcion previa *(tecnica: decide por
`stripe_customer_id !== null`)*): una funcion pura `billingAccessFailure(access, row)` en `billing-access.ts`,
llamada DESPUES del eje `status` (un negocio suspendido sigue diciendo `business_suspended`):

| Superficie | Archivo | Comportamiento |
|---|---|---|
| API del owner | `server/api-owner.ts` `requireApiOwner` y `requireApiOwnerSinGateDeEmail` | 402, salvo opcion `{ allowBlocked: true }` |
| API con permiso de staff | `server/api-permission.ts` (las dos variantes) | 402 |
| Mostrador y POS | `server/operator-guard.ts` | 402 |
| Login del personal | `app/api/merchant/auth/staff/route.ts:123` | 402 |
| Backoffice (SSR) | `server/auth-guards.ts` `requireBackofficeSession` | `redirect("/backoffice/subscription")`, salvo `{ allowBlocked: true }` |

Usan `allowBlocked`: `requireBillingOwner` (`app/api/billing/_auth.ts`, todas las rutas de cobro) y la pagina `backoffice/subscription/page.tsx` (una linea; zona GPT, cambio mecanico declarado).
`GET /api/merchant/session` no pasa por `requireApiOwner` (lee la sesion directo, `route.ts:36`), asi que no necesita
la opcion: solo suma el dato de §D10. El owner bloqueado entra, ve su suscripcion y paga; nada mas.

**Consultas** (`accessSql`, el comercio sin acceso se comporta como uno `suspended` en estos puntos):
- Inscripcion: `consumer/enrollment.ts` `loadEnrollableProgram` → 404 `program_unavailable`; `consumer/enroll-landing.ts`
  → `null` (la pagina ya dice «Este programa no esta disponible»).
- Bienvenida: `marketing/welcome-store.ts:63-67`.
- Venta cruzada y Horas valle (candidatas): `marketing/cross-store.ts:133-139`. Desde un comercio sin acceso no sale
  ninguna porque su mostrador esta cortado.

**Barrido diario `POST /api/internal/billing-sweep`** (`CRON_SECRET` como los demas internos; cron en
`apps/merchant/vercel.json`, `"35 5 * * *"`, diario como exige Hobby), idempotente, en una transaccion por negocio:
- Sin acceso y con campañas `active` → todas (Bienvenida incluida) a `paused`, `pause_reason='billing_blocked'`.
- Con acceso y con campañas `paused` por `billing_blocked` → las que `campaignAllowedFor` permite con el plan efectivo
  y no terminaron (`ends_at` nulo o futuro) vuelven a `active` con `pause_reason` nulo; las demas quedan `paused` con
  `pause_reason='plan_downgraded'`. **Nunca toca una pausa `owner` ni `no_active_locations`.**
- Responde `{ paused, resumed }` (conteos `::int`).

Las mismas dos operaciones corren **en el acto** cuando el webhook escribe el plan (`billing/store.ts:205`, que hoy
pausa con `plan_downgraded` sin la Bienvenida): si la fila queda sin acceso → pausar con `billing_blocked`; si queda con
acceso → reanudar. Asi pagar devuelve las campañas sin esperar al barrido; vencer la prueba depende del barrido
(lag ≤ ~24 h declarado en el ADR).

### D5 — Stripe: 4 precios y la derivacion del plan

`stripe-config.ts` lee `STRIPE_PRICE_{BASE,PLUS}_{MONTHLY,YEARLY}_{TEST,LIVE}` y expone
`priceIds: { base: {month, year}, plus: {month, year} }`; falta cualquiera → la configuracion falla como hoy (503
`stripe_not_configured`). `derive.ts` `planFromSubscription`:
- Precio reconocido → `plan` y `interval` del precio que matcheo; status `active|trialing` y sin `pause_collection` →
  se escribe; el resto, como hoy (sin tocar el plan).
- Terminal (`canceled`, `incomplete_expired` o `…deleted`): si `row.plan` es pago → `plan='none'`; si no (una tarjeta
  rechazada en la prueba, [R2-7] del ADR 0060) → el plan **no se toca** (sigue `trial`). En los dos, `pendingPlan`
  limpio.
- `pendingPlanFor`: programada → `pendingPlan='none'` con la fecha de hoy.
`applicability.ts`, `reconcile.ts` y `webhook-apply.ts` pasan el mapa nuevo. `downgrade_requested_at` se sigue
escribiendo al cancelar (auditoria) y `derive` ya no lo lee.

### D6 — Decisiones de cambio de plan (`plan-change.ts`, pura, primer match gana)

`PlanChangeInput` suma `trialEndsAt`, `now` y `activeCampaignsOutsideBase` (activas cuyo `template_key` no esta en
`BASE_TEMPLATE_KEYS`, incluidas las propias). Todos los bloqueos responden 409.

- **`subscribe {plan, interval}`** (checkout): (1) suscripcion viva → `subscription_live`; (2) `activeLocations >
  limitForPlan(plan)` → `downgrade_blocked` + `archiveCount`; (3) `plan === "base"` y `activeCampaignsOutsideBase > 0`
  → `downgrade_blocked_campaigns` + `deactivateCount`; (4) → `checkout {plan, interval, trialEnd}` con
  `trialEnd = checkoutTrialEnd(trialEndsAt, now)`: la fecha si faltan **≥ 48 h** (`trial_end` de Checkout,
  `Sessions.d.ts:3007`), si no `null` (cobro en el acto).
- **`change_plan {to}`**: (1) sin suscripcion viva → `plan_needs_subscription`; (2) `pendingPlan` puesto →
  `cancel_scheduled` («Reanuda tu suscripcion para cambiar de plan.»); (3) `row.plan === to` → `already_on_plan`; (4)
  `to === "base"` con locales o campañas de mas → `downgrade_blocked` / `downgrade_blocked_campaigns` (mismo orden que
  subscribe); (5) → `change_plan {to, proration: to === "plus" ? "always_invoice" : "none"}`.
- **`change_interval {to}`**: igual que hoy (`month` → `interval_downgrade_unsupported`), con el precio anual del plan
  vigente.
- **`cancel`**: sin suscripcion viva → `no_subscription`; ya programada → `cancel_scheduled`; → `schedule_cancel`.
- **`resume`**: sin suscripcion viva o sin cancelacion programada → `nothing_to_resume`; → `resume`.

`subscription_live`, `already_on_plan`, `downgrade_blocked`, `downgrade_blocked_campaigns`, `interval_*` conservan su
nombre (la UI de GPT ya los conoce). Mueren `settle_to_free` y `schedule_downgrade`.

### D7 — Rutas (`app/api/billing/`, todas con `requireBillingOwner` = owner + email verificado + `allowBlocked`)

| Ruta | Cuerpo | Stripe | Respuesta |
|---|---|---|---|
| `POST checkout` | `{plan: "base"\|"plus", interval: "month"\|"year", from?}` | `checkout.sessions.create` con el precio del mapa; `subscription_data.trial_end` si `trialEnd`; idempotencia `checkout:${businessId}:${plan}:${interval}` | `{url}` |
| `POST plan` (nueva) | `{to: "base"\|"plus"}` | `retrieve` + `update` del unico item nuestro al precio `to` del MISMO intervalo, con la `proration` de §D6, `payment_behavior: "error_if_incomplete"`; idempotencia `billing:plan:${subId}:${to}:${item.current_period_end}` | estado |
| `POST interval` | `{to}` | igual que hoy, precio del plan vigente | estado |
| `POST cancel` | — | `update({cancel_at_period_end: true})`; escribe `pending_plan='none'`, `pending_plan_at` (`pendingPlanFor` sobre la respuesta) y `downgrade_requested_at` | estado |
| `POST resume` (nueva) | — | `update({cancel_at_period_end: false})`; limpia las tres columnas | estado |
| `GET state` | — | — | estado (§D10) |
| ~~`POST settle-free`~~ | se borra con sus referencias | | |

Errores de ruta: 400 `invalid_input`; 402 `payment_failed` (tarjeta rechazada en `plan`/`interval`, como hoy); 409 los
de §D6 y `interval_ambiguous`; 503 `stripe_not_configured` / `stripe_unavailable` / `origin_not_configured`. Las llamadas
a Stripe ocurren **fuera** del lock del negocio (regla de `_downgrade.ts`). Cualquier escritura local despues de Stripe
es idempotente frente al webhook que llega en paralelo.

### D8 — Alta

`onboarding-signup.ts:141-145`: `plan: "trial"`, `trialEndsAt: now + TRIAL_DAYS`. `seed-local.ts` igual (los negocios de
prueba locales nacen en `trial`).

### D9 — Etiquetas

`billing/view.ts` `planLabel`: `trial` → «Prueba gratis», `base` → «Base», `plus` → «Plus», `none` → «Sin plan».
**Son provisorias**: cuando GPT proponga los nombres, se cambian estas tres lineas y los mensajes de §D6 que nombren un
plan (que salen de `planLabel`, no literales). `subscriptionOffers` se reescribe sobre el estado de §D10 o se borra si la
pantalla de GPT ya no lo usa (lo decide el implementador mirando sus consumidores; nada sin uso queda).

### D10 — Contrato para GPT

`GET /api/billing/state` y el cuerpo de exito de `plan`/`interval`/`cancel`/`resume`:

```json
{
  "subscription": { "plan": "trial|base|plus|none", "status": "…", "interval": "month|year|null",
                    "pendingPlan": "none|null", "pendingPlanAt": "ISO|null", "trialEndsAt": "ISO|null" },
  "access": "trial|subscribed|blocked",
  "trialDaysLeft": 12,
  "activeLocations": 2,
  "activeCampaignsOutsideBase": 1,
  "prices": { "base": { "month": 20, "year": 200 }, "plus": { "month": 49, "year": 490 } },
  "currency": "USD"
}
```

`trialDaysLeft`: dias enteros redondeados hacia arriba hasta `trialEndsAt` si `access === "trial"`, si no `null`.
`GET /api/merchant/session` suma `billing: { access, trialEndsAt, trialDaysLeft }` (sin datos de Stripe). Error de
bloqueo en cualquier otra ruta: `402 { error, code: "payment_required" }`.

### D11 — Extension provisoria: skill `/extender-prueba`

`.claude/skills/extender-prueba/SKILL.md`, marcada TEMPORAL (hasta el panel de plataforma). Uso
`/extender-prueba <slug|nombre> <+N dias | AAAA-MM-DD>`. Por MCP de Neon (`red-violet-38772073`): lee la fila; **se
niega** si hay `stripe_subscription_id` vivo (D11 «No entra»); si no, `UPDATE core.subscription SET trial_ends_at = …`
de ESE negocio (un solo `business_id`, verificado por SELECT antes y despues) y le dice al owner que las campañas
pausadas vuelven en el proximo barrido (o llama al endpoint del barrido si tiene el secreto en el entorno). Nunca imprime
secretos.

### Arquitectura de referencia

ADR 0134 (esta), 0058/0060/0063 (cobro; esta los reemplaza donde dice), 0072/0073 (entitlements y eje `status`), 0112
(Bienvenida por plantilla), 0117/0118 (Venta cruzada), 0128 (rama `dev`), 0114 (zonas: UI de GPT).

## Archivos

| Archivo | Accion |
|---|---|
| `packages/db/drizzle/0069_*.sql` + `meta/` | crear (generate + SQL de datos/grant/check) |
| `packages/db/src/schema/billing.ts`, `campaign.ts` | editar (columna, default, check) |
| `packages/db/src/seed-local.ts` | editar |
| `packages/domain/src/server/billing-access.ts` | crear |
| `packages/domain/src/server/entitlements/{catalog,index,live-subscription}.ts` | editar |
| `packages/domain/src/server/marketing/{plan-gate,cross-store,welcome-store}.ts` | editar |
| `packages/domain/src/server/consumer/{enrollment,enroll-landing}.ts` | editar |
| `apps/merchant/src/server/billing/{derive,derive-rules,plan-change,store,view,applicability,reconcile,webhook-apply,index}.ts` | editar |
| `apps/merchant/src/server/{api-owner,api-permission,operator-guard,auth-guards,session-view,stripe-config,onboarding-signup}.ts` | editar |
| `apps/merchant/src/server/locations/core.ts` | editar (topes con contexto completo) |
| `apps/merchant/src/server/marketing/{plan-brake,campaign-store,campaign-actions,template-store}.ts` | editar |
| `apps/merchant/src/app/api/billing/{_auth,_downgrade,checkout,interval,cancel,state}/…` | editar |
| `apps/merchant/src/app/api/billing/{plan,resume}/route.ts` | crear |
| `apps/merchant/src/app/api/billing/settle-free/route.ts` | borrar |
| `apps/merchant/src/app/api/internal/billing-sweep/route.ts` | crear |
| `apps/merchant/src/app/api/merchant/auth/staff/route.ts`, `api/merchant/session` | editar |
| `apps/merchant/vercel.json` | editar (cron) |
| `apps/merchant/src/app/backoffice/page.tsx:104`, `backoffice/subscription/page.tsx` | editar (una linea; zona GPT, mecanico) |
| `.claude/skills/extender-prueba/SKILL.md` | crear |
| tests que fijan `free` (≈45 archivos, `rg -l '"free"' apps packages tests`) | actualizar al comportamiento nuevo; los que prueban `settle-free` o la baja inmediata se borran con su ruta |

### Disjunta?

**No.** Colisiona con la UI de suscripcion de GPT (`backoffice/subscription/*`) y con cualquier spec que toque
entitlements o marketing. Se serializa: GPT hace las pantallas de cobro DESPUES, con §D10. La landing de GPT
(`apps/public`) no colisiona.

### Archivos compartidos

| Que | Quien | Cuando |
|---|---|---|
| ADR 0134 y esta spec | orquestador | antes de despachar |
| 4 precios en Stripe test + variables en `.env.local` del merchant | owner | antes del QA (los tests doblan Stripe) |

## Definition of Done

- [ ] `rg -n '"free"|settle-free|settleToFree|settle_to_free' apps packages tests --type ts` → vacio.
- [ ] `rg -n "requiresLiveSubscription|pendingRule" packages/domain/src` → vacio.
- [ ] Migracion 0069 aplicada a la rama `ci-integration` por `tools/neon-test.sh` y releida por SQL: columna, default
      `'trial'`, check con `billing_blocked`, grant de las 4 columnas a `checkpass_consumer`.
- [ ] Las suites del §Plan de pruebas en verde, con su salida transcripta.
- [ ] Tabla de mutaciones ejecutada (rojo leido por la asercion correcta) y revertida con `diff`.
- [ ] `pnpm verify` en verde con Node 24, una vez al final, con su tabla transcripta.
- [ ] `rg -n MUTATION apps packages tools` → vacio.
- [ ] Revisor independiente: `PASS` con evidencia ejecutada.

## Plan de pruebas y verificacion

- **T1 (unit) `billingAccess`**: tabla con `null`; sin id y sin prueba; prueba que vence EXACTAMENTE en `now`
  (→ `blocked`); prueba +1 ms; id vivo con prueba vencida (→ `subscribed`); `past_due` con id; `canceled` con id y prueba
  vigente (→ `trial`); `incomplete_expired` con id y prueba vencida (→ `blocked`).
- **T2 (Neon) `accessSql` = `billingAccess`**: siembra una fila por caso de T1 y asevera que el fragmento devuelve lo
  mismo para cada una (las dos definiciones con un solo oraculo).
- **T3 (unit) catalogo**: cada plan × cada clave de la tabla de §D2, y plan desconocido → `fallback`; `effectivePlan`
  para `subscribed`/`trial`/`blocked`; `pendingPlan='none'` NO baja ningun valor.
- **T4 (unit) `campaignAllowedFor`**: `welcome`/`cross`/`valley`/`null`/otra × `trial`/`base`/`plus`/`none` vencido.
- **T5 (unit) `decidePlanChange`**: matriz de §D6 completa, incluidas las precedencias (locales antes que campañas) y
  `checkoutTrialEnd` en 48 h − 1 ms (→ `null`), 48 h exactas y prueba vencida.
- **T6 (unit) `planFromSubscription`**: los 4 precios → plan+intervalo; precio ajeno → `unknown_price`; terminal con
  `plus`/`base` → `none`; terminal con `trial` → sin `plan`; programada → `pendingPlan='none'`.
- **T7 (Neon) guardias**: con un negocio sin acceso: una ruta que pasa SOLO por `requireApiOwner` (p. ej. `api/merchant/business/ticket`) → 402; una de `requireApiPermission`
  (p. ej. `GET /api/locations`, via `requireLocationsOwner`) → 402
  `payment_required`; `GET /api/billing/state` → 200; `GET /api/merchant/session` → 200 con `billing.access='blocked'`;
  una ruta del mostrador → 402; login de staff → 402; negocio `suspended` sin acceso → sigue `business_suspended`. El
  mismo negocio con prueba vigente → 200 en todas.
- **T8 (Neon) consultas**: negocio sin acceso → `loadEnrollableProgram` 404 y landing `null`; su Bienvenida no se
  emite; su campaña `cross` no es candidata. Con acceso → las tres andan. **Correr tambien con el rol del cliente**
  (`tools/neon-test.sh --app consumer` sobre la suite de inscripcion) para probar el grant.
- **T9 (Neon) barrido**: sin acceso con campañas `active` (Bienvenida incluida) → todas `billing_blocked`; una pausada
  por `owner` queda igual; recupera acceso como `base` → `welcome` y `cross` vuelven, `at_risk` queda `plan_downgraded`;
  segunda corrida → `{paused: 0, resumed: 0}`.
- **T10 (Neon) rutas de cobro** con Stripe doblado (el patron de `billing-integration-support.ts`): checkout lleva el
  precio y el `trial_end` correctos; `plan` sube con `always_invoice` y baja con `none`; `cancel` programa y escribe
  `pending_plan='none'`; `resume` limpia; bloqueos 409 con sus contadores.
- **T11 (Neon) alta**: `signup` escribe `plan='trial'` y `trial_ends_at` a 90 dias (±1 min).
- **Comandos:** `pnpm --filter @mi-pasaporte/merchant exec vitest run <archivos>`; `tools/neon-test.sh <archivos>`;
  `pnpm verify` al final.
- **Manual (owner, despues de la UI de GPT):** alta nueva → ve «Prueba gratis · 90 dias»; con `/extender-prueba` en
  local llevar la fecha al pasado → panel solo muestra suscripcion, mostrador y POS rechazan, el QR dice «no
  disponible»; pagar con tarjeta de prueba de Stripe → vuelve todo.

## Mutaciones — presupuesto del implementador: 6. Clase: los plausibles

| # | Mutacion (codigo nuevo de esta spec) | Oraculo que tiene que ponerse ROJO |
|---|---|---|
| M1 | `billing-access.ts`: `>` por `>=` en la prueba | T1 «vence exactamente en `now`» |
| M2 | `api-owner.ts`: borrar la llamada a `billingAccessFailure` en `requireApiOwner` | T7 ruta del owner → 402 (guard hermano: `requireApiPermission` no cubre esa ruta; elegir una ruta que solo pase por `requireApiOwner`) |
| M3 | `enrollment.ts`: borrar `accessSql` de `loadEnrollableProgram` | T8 inscripcion 404 (guard hermano: `enroll-landing` es otro camino; el caso llama a `loadEnrollableProgram` directo) |
| M4 | `catalog.ts`: `campaigns.cross` del `base` a `false` | T4 y T9 (`cross` vuelve con `base`) |
| M5 | `plan-change.ts`: umbral de `checkoutTrialEnd` de 48 h a 0 | T5 «48 h − 1 ms → `null`» |
| M6 | barrido: reanudar sin filtrar `pause_reason='billing_blocked'` | T9 «la pausada por `owner` queda igual» |

**Revisor:** correctitud contra esta spec + 3 mutaciones propias sobre lineas cambiadas (spec 0151). Protocolo de la
skill `protocolo-de-verificacion` (shasum, bitacora antes de medir, `MUTATION`, revertir con `diff`). **Condicion de
corte:** dos vueltas seguidas de «el fix abrio la siguiente» → se corta y va al owner.

## Declarado AFUERA (sin oraculo, a proposito)

- La UI: no hay e2e de cobro hasta que GPT haga las pantallas.
- Stripe real: todo se prueba con Stripe doblado; el QA con tarjeta de prueba es del owner.
- El lag de hasta ~24 h entre el vencimiento y la pausa de campañas ya activas (ADR 0134).
- `loyalty-program.ts:81` (writer del programa) no mira el acceso: su unica puerta (`PUT /api/loyalty-program`) ya pasa
  por `requireApiPermission`.

## Handoff requerido

Formato de `docs/AGENT-WORKFLOW.md`. El implementador declara el cambio en los dos `.tsx` de zona GPT. El revisor da
`PASS` antes de `implementada`. Migracion a PROD: orquestador, despues del PASS, inmediatamente antes del push, con OK
del owner.

## Abierto

Nada bloquea el codigo. Pendiente del owner antes del QA: crear en Stripe (test, y live al salir) los precios base
$20/mes y $200/año y plus $49/mes y $490/año, y cargar las 8 variables `STRIPE_PRICE_*` (las `PLUS_*` actuales apuntan
al Plus de hoy y se reemplazan).

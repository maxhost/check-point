---
spec: 0104
fecha: 2026-09-27
estado: cerrada
resumen: Spec B2 — plantillas #7 «Te falta poco» (`near_reward`) y #8 «Premio sin canjear» (`unclaimed_reward`), solo push y sin cupon, grupo `balance` (#8 > #7), sobre el canal de la 0103 (implementa el ADR 0096). Audiencia = dormidos + saldo contra el premio mas barato del programa operativo; #7 una vez por ciclo de canje con marcador `{faltan}` renderizado por cliente; #8 una vez o cada 30 d (max 2) por ausencia; el canje cancela el push como `visited`. Arregla el `activate` de campañas solo-push (exigia puertas). Migracion `0047`.
disjunta: si
archivos: apps/merchant/drizzle/0047_*, apps/merchant/src/server/schema/campaign.ts, apps/merchant/src/server/marketing/{templates,template-input,template-store,campaign-store,campaign-actions,push-store,push-delivery,tick,utility-text}.ts + nuevos balance-*.ts, docs/specs/0101-contratos-de-api.md
---

# 0104 — Plantillas de saldo por push (B2)

> Implementa el **ADR 0096** sobre el canal de la **0103** (ADR 0095). Decisiones del owner en
> `docs/TASKS.md` (bloques «Paso 2, plantillas #7 y #8» y «B2 — decisiones del owner»). Lo marcado
> *(ORQUESTADOR)* no lo decidio el owner y se le informa al pedir el OK.

## Problema

El cliente al que le faltan dos sellos, o que ya tiene el premio y no vuelve, no se entera: la bolsa de
utilidad lo dice en el pase solo si pasa por la puerta. El catalogo tiene #7/#8 como las primeras
lanzables sin catalogo de premios, y la 0103 ya dejo el canal push. Ademas, **medido**: una campaña
solo-push pausada NO se puede reactivar — `activate` exige puertas sin mirar el canal
(`marketing/campaign-actions.ts:71-75`), y #7/#8 son siempre solo-push.

## Alcance

**Entra:**
- Catalogo: `near_reward` y `unclaimed_reward`, grupo `balance`; campos nuevos del catalogo.
- `enable`: canales por defecto = los de la plantilla; umbrales de #7, repeticion de #8, marcador
  `{faltan}`, rechazo de cupon y de canal no ofrecido; `409 no_loyalty_reward`.
- Tick: rama de saldo en el paso «1b push».
- Gate: un canje posterior a la decision cancela como `visited` (todas las plantillas).
- `activate` de una campaña solo-push sin puertas.
- Contrato en `docs/specs/0101-contratos-de-api.md`.

**No entra:**
- Proximidad para #7/#8 (la bolsa de utilidad ya lo cubre) y cupon (owner: «SIN premio»).
- Push de acreditacion con progreso (owner: condicionado a medir el largo en iOS/Android; spec aparte).
- Metrica de canje por push (la conversion sigue siendo compra en 7 d, ADR 0095 §9).
- Tope global o anti-hartazgo (owner: sin tope «hasta que entendamos como aplicarlo»).
- Foto de audiencia del push (igual que la 0103). UI (ADR 0070).
- Migrar prod (orquestador, con OK del owner, despues del PASS).

## Diseño

### Especificación técnica

#### 1. Migracion `0047_plantillas_de_saldo.sql` (via `drizzle-kit generate`)

`core.campaign`:
- `near_reward_stamps integer` nullable, check `is null or between 1 and 3`.
- `near_reward_percent integer` nullable, check `is null or in (10, 20)`.
- `reward_repeat text` nullable, check `is null or in ('once', 'every_30_days')`.
- Forma: `(coalesce(template_key,'') = 'near_reward') = (near_reward_stamps is not null and
  near_reward_percent is not null)` y `(coalesce(template_key,'') = 'unclaimed_reward') =
  (reward_repeat is not null)`, mas `near_reward_stamps is null = near_reward_percent is null`.
  ⚠️ el `coalesce` es obligatorio: un `check` con `null` PASA, y el compositor escribe
  `template_key = null`.
- `core_campaign_dormant_days_check` → `between 3 and 365`.
- `core_campaign_template_key_check` → `in ('missed_you','win_back','near_reward','unclaimed_reward')`.

Prod: las filas existentes son #3/#5/compositor → columnas nuevas `null`, cumplen la forma.

#### 2. Catalogo (`marketing/templates.ts`)

- `TemplateKey` suma `near_reward | unclaimed_reward`; `TemplateGroup` suma `balance`.
- `TemplateDefinition` gana `couponAllowed: boolean` (#3/#5 `true`), `nearReward: { stamps: { options:
  [1,2,3], default: 2 }, pointsPercent: { options: [10,20], default: 20 } } | null` y `repeat: {
  options: ["once","every_30_days"], default: "once" } | null`, y `message.gapMarker: boolean` (solo #7).
- `near_reward`: «Te falta poco», `channels: ["push"]`, `balance` rango 1, `dormantDays {3,7,14} def
  7`, mensaje `"¡Estás a {faltan} de tu premio!"` (vale en singular: «a 1 sello»), `couponRecommended: false`, `couponAllowed:
  false`, `repeat: null`.
- `unclaimed_reward`: «Premio sin canjear», `channels: ["push"]`, `balance` rango 2, `dormantDays
  {7,14,30} def 14`, mensaje `"Tenés un premio esperándote. ¡Vení a canjearlo!"`, `couponAllowed:
  false`, `nearReward: null`, `repeat` como arriba.
- Textos de `description`/`message.default`: *(ORQUESTADOR)*, cambian sin spec.

#### 3. `enable` (`template-input.ts`, `template-store.ts`)

- `channels` ausente o `null` → `template.channels` (para #3/#5 sigue siendo «ambos»: el contrato de la
  0101/0103 no cambia). Un canal que la plantilla no ofrece → `400 validation`, `fields.channels`.
- Cupon con `couponAllowed: false` (cualquiera de los tres campos presente) → `400 validation`,
  `fields.couponLabel = "Esta campaña no lleva cupón."`.
- `nearRewardStamps` / `nearRewardPercent` (solo #7): ausentes → default; fuera de las opciones →
  `400`, `fields.nearRewardStamps` / `fields.nearRewardPercent`. `rewardRepeat` (solo #8): idem con
  `fields.rewardRepeat`. En una plantilla que no los declara, se IGNORAN (regla del docblock de
  `template-input.ts`) y se guardan `null`.
- `{faltan}` en el mensaje de una plantilla sin `gapMarker` → `400`, `fields.message = "El marcador
  {faltan} solo vale en «Te falta poco»."`. En #7 es **OBLIGATORIO** (owner): un mensaje sin
  `{faltan}` → `400`, `fields.message = "El mensaje tiene que incluir {faltan}."`. El largo (60) se mide
  sobre el texto CRUDO.
- Plantilla del grupo `balance` y el negocio sin programa operativo (`status in ('active','closing')`)
  con costo usable (§4) → **`409 no_loyalty_reward`**, «No se puede activar: necesitás un programa
  de fidelización con un premio.» (owner: la UI lo muestra en un toast con el motivo; el contrato lo
  dice). Se evalua despues del 402 y antes de `template_already_live`.
- `TemplateInput` y el `insert` ganan los tres campos. El DTO `Campaign` (`campaign-store.ts`) gana
  `nearRewardStamps`, `nearRewardPercent`, `rewardRepeat` (`campaign-store.ts` esta en 287 lineas:
  si pasa de 300, se divide).

#### 4. Costo del premio (`marketing/utility-text.ts` + `marketing/balance-store.ts` nuevo)

- `utility-text.ts` exporta `rewardCost(program, rewards): number | null` = la lectura que hoy hacen
  `stampsTarget`/`cheapestPointsCost` (sin cambiar `utilityText`, que pasa a usarla).
- `loadRewardCost(db, businessId): Promise<{ kind: "stamps" | "points"; cost: number } | null>` —
  programa operativo del negocio y sus `loyalty_reward`; `null` si no hay programa, `kind` fuera de
  esos dos, o `rewardCost` `null`. Lo usan el tick y el `409` de `enable`.

#### 5. Decision pura (`marketing/balance-audience.ts` nuevo)

```ts
type BalanceCandidate = PushCandidate & {
  balance: number;                 // stamps_count o points_balance segun el kind
  lastRedemptionAt: Date | null;   // max(reward_redemption.created_at) de la membresia
  ownDecisions: Date[];            // decided_at NO cancelados (holdout incluido) de ESTA plantilla, negocio y consumidor
};
decideBalancePush(candidate, { now, dormantDays, template, reward, nearRewardStamps, nearRewardPercent, rewardRepeat })
```

Orden: `opt_out` → `not_reachable` → `not_dormant` (igual que `decidePushEligibility`) →
`no_reward` (`reward` null) → por plantilla:
- `near_reward`: `has_reward` (`balance >= cost`) → `not_near` (Sellos: `gap > nearRewardStamps`;
  Puntos: `gap * 100 > cost * nearRewardPercent`) → `already_reached` (`lastGroupDecisionAt >=
  dormantSince`, claves `>= rango`: #7 y #8) → `already_this_cycle` (alguna de `ownDecisions >=
  max(enrolledAt, lastRedemptionAt)`) → `eligible` con `gap`.
- `unclaimed_reward`: `no_reward_yet` (`balance < cost`) → `already_reached`: con las decisiones de
  `ownDecisions >= dormantSince`: `once` → ≥ 1; `every_30_days` → ≥ 2, o la ultima `> now − 30 d`.
  (Nada esta por encima de #8: la regla de grupos de si misma la reemplaza la repeticion.)

`renderGap(message, gap, kind)`: reemplaza TODAS las `{faltan}` (en #7 siempre hay al menos una) por `1 sello`/`N sellos`/`1 punto`/`N
puntos`.

#### 6. Tick (`tick.ts`, `push-store.ts`, `marketing/balance-push.ts` nuevo)

- `loadPushCampaigns` trae tambien los tres campos nuevos (sigue ordenando por `rank` desc; el orden
  entre grupos es irrelevante).
- `runPushCampaign` delega en `runBalancePushCampaign` (en `balance-push.ts`; `tick.ts` esta en 244)
  cuando `template.group === "balance"`: `loadRewardCost`; si `null`, cero decisiones; si no, carga
  candidatos con `loadBalanceCandidates` (SQL crudo con alias propios, como `loadPushCandidates`: suma
  `balance`, `last_redemption_at`, `own_decisions` = `array_agg` de `decided_at`) y por cada
  `eligible` llama `recordPushDecision` con el cuerpo `renderGap(message, gap, kind)` para #7 y
  `message` para #8 (`recordPushDecision` gana un `body` opcional; sin el, `pushBody` como hoy).
- Holdout y resultados: sin cambios (mismo sorteo, mismo bloque `push`).

#### 7. Gate (`marketing/push-delivery.ts`)

`loadGateFacts` (`:94-97`): `visited` = orden del negocio y consumidor **o** `core.reward_redemption`
con `membership_id = cp.membership_id` y `created_at > cp.decided_at` *(ORQUESTADOR: un canje es una
visita; vale para #3/#5 tambien)*.

#### 8. `activate` (`marketing/campaign-actions.ts:71`)

La guarda `no_usable_location` aplica solo si la campaña tiene `channel_proximity` (la misma regla que
la 0103 puso en `enable`).

### Arquitectura de referencia

ADR 0091/0092 (plantillas), 0095 (canal push, grupos, gate), **0096** (esta).

## Archivos

| Archivo | Accion |
|---|---|
| `apps/merchant/drizzle/0047_plantillas_de_saldo.sql` + `meta/` | crear (generate) |
| `src/server/schema/campaign.ts` | editar |
| `src/server/marketing/templates.ts`, `template-input.ts`, `template-store.ts`, `campaign-store.ts` | editar |
| `src/server/marketing/utility-text.ts`, `push-store.ts`, `tick.ts`, `push-delivery.ts`, `campaign-actions.ts` | editar |
| `src/server/marketing/balance-store.ts`, `balance-audience.ts`, `balance-push.ts` | crear |
| tests: unit al lado de cada modulo puro; `marketing-balance-push.neon.integration.test.ts` | crear |
| `docs/specs/0101-contratos-de-api.md` | editar |

(Rutas relativas a `apps/merchant/` salvo `docs/`. Todo archivo ≤ 300 lineas.)

### Disjunta?

Si. La 0100 (otra sesion) toca `app/backoffice/loyalty/**`: sin archivos comunes.

### Archivos compartidos

Ninguno.

## Definition of Done

- [ ] Migracion `0047` generada y aplicada en la rama de CI por `tools/neon-test.sh`.
- [ ] `GET /api/marketing/templates` lista las 4 plantillas con los campos nuevos.
- [ ] `enable` de #7/#8 con `{}` crea solo-push con los defaults; `["proximity"]`, cupon, opciones
  fuera de rango y `{faltan}` en #3/#5/#8 → 400 con su campo; sin programa con premio → 409
  `no_loyalty_reward`; #3/#5 sin `channels` siguen creando «ambos».
- [ ] Tick: #7 decide solo a dormidos cerca del premio (Sellos y Puntos), una vez por ciclo, y vuelve
  a decidir tras un canje; #8 solo a dormidos con premio, `once` y `every_30_days` (max 2, ≥ 30 d);
  cuerpo con el faltante de CADA cliente.
- [ ] Gate: canje posterior a la decision → `cancelled`/`visited`.
- [ ] Campaña solo-push pausada se reactiva sin puertas.
- [ ] Contrato actualizado: plantillas nuevas, campos de `enable`, DTO, `409 no_loyalty_reward`,
  `visited` por canje.
- [ ] Seis gates verdes + los `.neon.integration` de marketing, push y cupon por `tools/neon-test.sh`.

## Plan de pruebas y verificación

- [ ] **Unit** `balance-audience.test.ts`: cada exclusion en su orden; bordes: Sellos gap = N (elegible)
  y N+1; Puntos cost 100, P 20, gap 20 (elegible) y 21; `balance = cost` → #7 `has_reward`, #8
  elegible; ciclo con decision 1 ms antes / en el instante del canje; `every_30_days` con 1 decision
  hace 30 d exactos (elegible), 29 d (no), 2 decisiones (no).
- [ ] **Unit** `renderGap`: singular/plural, dos marcadores.
- [ ] **Unit** `template-input`: los 400 de §3 (incluido #7 sin `{faltan}`) y los defaults.
- [ ] **Integracion** `marketing-balance-push.neon…` (tick, `random` inyectado): negocio Sellos y
  negocio Puntos; dormidos cerca/lejos/con premio; asserts por SQL sobre `campaign_push` y el `body`
  de `wallet_push_queue`; ciclo (#7 → orden → no; → canje → si); #8 repeticion con reloj movido; doble
  tick sin filas nuevas.
- [ ] **Integracion** gate (`marketing-push-delivery.neon…`): canje entre decision y entrega → `visited`.
- [ ] **Integracion** `enable`/`activate` (`marketing-templates.neon…`/`marketing-push-enable.neon…`):
  409 sin programa; pause + activate de solo-push sin puertas → `active`.
- [ ] Comandos: `pnpm run typecheck && pnpm run lint && pnpm run test && pnpm run format:check`;
  `pnpm run build`; `pnpm test:e2e`; `tools/neon-test.sh` con el archivo nuevo + `marketing-push*`,
  `marketing-templates*`, `marketing-tick`, `marketing-results`, `marketing-campaign-actions`,
  `wallet-push-worker`, `counter-coupon`.
- [ ] Verificacion manual (QA del owner, al final del arco): encender #7 en un negocio de prueba con un
  cliente dormido a 1 sello y suscripto a Web Push; tick + worker; ver llegar «¡Estás a 1 sello de tu
  premio!», tocarlo y ver `clicked` en resultados.

### Mutaciones (presupuesto: 9; clase: errores PLAUSIBLES de reglas de saldo y de cableado)

Mecanismos NUEVOS salvo M5 (`push-delivery.ts:94-97`) y M8 (`campaign-actions.ts:71-75`), ambos
verificados en el arbol el 2026-09-27. Rojo por la propiedad (leer la asercion). Protocolo: skill
`protocolo-de-verificacion`.

| # | Mecanismo | Mutacion | Oraculo que tiene que dar rojo |
|---|---|---|---|
| M1 | delegacion a `runBalancePushCampaign` en el tick (CABLEADO) | borrarla (#7 cae en la regla de dormidos) | integracion: dormido LEJOS del premio no recibe #7 |
| M2 | umbral de Puntos | `>=` en vez de `>` en `gap * 100 > cost * P` | unit: gap 20 de 100 con P 20 → elegible |
| M3 | ancla del ciclo de #7 | `lastOrderAt` en vez de `lastRedemptionAt` | integracion: #7 → orden (sigue cerca) → no; canje → si |
| M4 | repeticion `every_30_days` | quitar la condicion de 30 d | unit/integracion: 2da decision a los 29 d → no |
| M5 | canje en `visited` del gate | quitar el `exists` de `reward_redemption` | integracion: canje entre decision y entrega → `visited` |
| M6 | `renderGap` por cliente | renderizar con el gap del PRIMER candidato | integracion: dos clientes con gap distinto → dos cuerpos distintos |
| M7 | umbral segun el `kind` al tick | usar siempre `nearRewardStamps` | integracion: negocio Puntos, gap 15 de 100 con P 10 → no |
| M8 | `no_usable_location` en `activate` | condicion incondicional (forma actual) | integracion: pause + activate solo-push sin puertas → `active` |
| M9 | rechazo de cupon con `couponAllowed: false` | aceptarlo | unit `template-input`: #7 con cupon → 400 `couponLabel` |

**Declarado fuera:** `409 no_loyalty_reward`, el 400 de `{faltan}` fuera de #7 y el de #7 sin marcador tienen
oraculo sin mutacion (presupuesto); el programa `closing` como operativo no se prueba aparte.

## Handoff requerido

Un implementador y un revisor independiente (`docs/AGENT-WORKFLOW.md`, ADR 0071). Orden de prod: el
codigo nuevo lee las columnas nuevas → **migrar prod ANTES del deploy**, con OK del owner. El codigo
viejo con la migracion aplicada no se rompe (columnas nullable; los checks nuevos aceptan las filas
que escribe).

## Abierto

Nada. **Respuestas del owner (2026-09-27) a los 4 puntos:** (1) si al 409, «tenemos que mostrar un toast
con error y porque no se puede activar» → el mensaje del 409 dice el motivo y el contrato indica toast;
(2) el canje cuenta como visita, «si cuenta»; (3) `{faltan}` NO es opcional: **obligatorio en todo
mensaje de #7** (aclarado por AskUserQuestion; fuera de #7 sigue dando 400); (4) «ok de momento si» a
los dos grupos sin tope. **OK del owner para migrar prod** («aplica la migracion»): la `0047` se aplica
a `red-violet-38772073`/`main` despues del PASS del revisor y ANTES del deploy.

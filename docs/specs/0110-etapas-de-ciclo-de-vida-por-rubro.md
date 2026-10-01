---
spec: 0110
fecha: 2026-09-29
estado: borrador
resumen: Implementa el ADR 0102 — cada cliente en UNA etapa (bienvenida/activo/te extrañamos/en riesgo/perdido/irrecuperable) por dias desde su ultima visita con una escalera POR RUBRO cargada a mano (16 filas). #3/#4/#5 le hablan solo a su etapa y repiten por calendario (regla del tramo, lo salteado no se reprograma); el cupon de bienvenida vigente excluye; #7/#8 sueltos solo en activo, con opciones de dias < T1, y sumados al push de la etapa. Se borra el ritmo (0097) y la regla de grupos de reactivacion (0095 §5). Sin migracion; contrato `0110-contratos-de-api.md`.
disjunta: si
archivos: apps/merchant/src/server/marketing/{stages,stage-ladders,reactivation-push,templates,audience,audience-store,push-audience,push-store,balance-audience,balance-store,balance-push,template-input,template-store,tick}.ts (+ tests), borrar at-risk.ts, app/backoffice/marketing/{template-fields.tsx,marketing-types.ts}, docs/specs/0101-contratos-de-api.md
---

# 0110 — Etapas de ciclo de vida por rubro

> Implementa el **ADR 0102**. Las decisiones del owner estan citadas ahi (y en `docs/TASKS.md`,
> seccion «MARKETING — ETAPAS»). Lo marcado *(ORQUESTADOR)* lo eligio el orquestador y se valida con
> el OK de esta spec. Contrato HTTP para la UI: [`0110-contratos-de-api.md`](0110-contratos-de-api.md).

## Problema

Las plantillas de reactivacion miran pisos abiertos (`audience.ts:124-127`, `push-audience.ts:60-63`):
un cliente de 100 dias califica a #3, #4 y #5 a la vez, cada una manda UN push por ausencia (regla de
grupos, `push-audience.ts:66`) y los dias son los mismos para una cafeteria que para una peluqueria. #4
pide ademas un ritmo (`at-risk.ts`) que el owner dejo sin efecto. #7/#8 salen sin mirar en que momento
del ciclo esta el cliente, y el cliente que tiene el regalo de bienvenida sin usar recibe «te
extrañamos» igual.

## Alcance

**Entra:**
- Escalera por rubro (tabla §1) y la funcion pura de etapa y calendario (§2).
- Cableado de la etapa en proximidad (§4), push de reactivacion con calendario y suma de #7/#8 (§5), y
  en #7/#8 sueltos (§6).
- Opciones de dias por rubro en `GET templates` y en `enable` (§3), bloque `ladder` y fuera `atRisk`.
- Borrar el ritmo: `at-risk.ts` y sus tests, `visit_days`/`first_order_at` de los loaders, y el bloque
  `atRisk` de la UI (`template-fields.tsx:115-121`, `marketing-types.ts:82`) — ADR 0070 §17.
- Contrato: el anexo `0110-contratos-de-api.md` (ya escrito) y tres notas de remision en `0101-…` §4.1,
  §4.2 y §4.4.

**No entra:**
- Calibrar con los datos del negocio («C», owner (5)). Editar la tabla desde la UI.
- Cadencia de proximidad (owner: «Solo respeta la etapa»). Suma de #7/#8 en proximidad *(ORQUESTADOR)*.
- El compositor custom (`campaign.template_key` nulo): sigue con su piso de dias y sin etapas.
- Tope global de frecuencia (ADR 0095). Pausa estacional (owner (13)).
- `audience-preview` (es del compositor). Migracion: no hace falta (§7). Cualquier otra pantalla.

## Diseño

### Especificación técnica

Rutas relativas a `apps/merchant/src/server/marketing/` salvo que se diga otra cosa. `DAY_MS` = 86.400.000.

#### 1. La tabla (`stage-ladders.ts`, nuevo, PURO)

```ts
type StageLadder = {
  missedYou: readonly [number, number];   // T1, T2 — las opciones de #3
  atRisk: readonly number[];              // dias de mensaje de #4; atRisk[0] = R
  lostFrom: number;                       // P
  lost: readonly number[];                // dias de mensaje de #5; el ultimo = I
};
export const STAGE_LADDERS: Readonly<Record<string, StageLadder>>;  // clave = gcid
export function ladderFor(categoryGcid: string): StageLadder;       // sin fila → "gcid:store"
```

Copia EXACTA de `research_notes/ciclo-de-vida-por-rubro/CONSOLIDADO.md` (owner (12): a mano; nada se
deriva por formula). Dias desde la ultima visita:

| gcid | T1/T2 | atRisk | P | lost (I = ultimo) |
|---|---|---|---|---|
| `gcid:cafe` | 7/14 | 30, 51, 72 | 90 | 91, 105, 151, 181 |
| `gcid:bakery` | 8/15 | 30, 51 | 60 | 61, 70, 101, 121 |
| `gcid:grocery_store` | 7/14 | 30, 51 | 60 | 61, 70, 101, 121 |
| `gcid:restaurant` | 14/30 | 45, 77 | 90 | 91, 105, 151, 181 |
| `gcid:pizza_restaurant` | 14/21 | 30, 51, 72 | 90 | 91, 105, 151, 181 |
| `gcid:bar` | 14/21 | 45, 77 | 90 | 91, 105, 151, 181 |
| `gcid:ice_cream_shop` | 10/21 | 45, 77, 109 | 120 | 121, 140, 201, 241 |
| `gcid:beauty_salon` | 45/60 | 90, 153 | 180 | 181, 209, 301, 361 |
| `gcid:barber_shop` | 35/49 | 84 | 120 | 121, 140, 201, 241 |
| `gcid:nail_salon` | 21/28 | 45, 77 | 90 | 91, 105, 151, 181 |
| `gcid:gym` | 8/14 | 21, 36 | 45 | 46, 60, 120, 181 |
| `gcid:pharmacy` | 21/35 | 45, 77 | 90 | 91, 105, 151, 181 |
| `gcid:clothing_store` | 45/60 | 120, 204 | 240 | 241, 278, 401, 481 |
| `gcid:pet_store` | 21/35 | 45, 77 | 90 | 91, 105, 151, 181 |
| `gcid:car_wash` | 21/30 | 45, 77 | 90 | 91, 105, 151, 181 |
| `gcid:store` (relleno y default) | 14/30 | 45, 77 | 90 | 91, 105, 151, 181 |

Las 15 claves de `lib/business-categories.ts` + `gcid:store`; un test lo fija (M13).

#### 2. Etapa y calendario (`stages.ts`, nuevo, PURO)

```ts
type Stage = "welcome" | "active" | "missed_you" | "at_risk" | "lost" | "gone";
type StageContext = { ladder: StageLadder; activeUntilDays: number };   // A
type StageFacts = { enrolledAt: Date; lastOrderAt: Date | null; welcomePending: boolean };

stageOf(facts, now, ctx): Stage
messageDays(key: "missed_you" | "at_risk" | "win_back", ctx): number[]
currentSlotStart(key, facts, now, ctx): Date | null
stageOfTemplate(key): Stage | null     // missed_you→missed_you, at_risk→at_risk, win_back→lost; resto null
```

- `since = dormantSince(facts)` (`audience.ts:106`, se reusa), `e = now − since` en ms.
- `stageOf`, en este orden: `welcomePending` → `welcome`; `e < A·DAY` → `active`; `e < R·DAY` →
  `missed_you`; `e < P·DAY` → `at_risk`; `e < (I+1)·DAY` → `lost`; si no `gone`. `R = atRisk[0]`, `I =
  lost.at(-1)`.
- `messageDays`: `missed_you` = `A, 2A, 3A, …` mientras `< R` (vacio si `A ≥ R`); `at_risk` =
  `ladder.atRisk`; `win_back` = `ladder.lost`.
- `currentSlotStart`: `null` si `stageOf ≠ stageOfTemplate(key)`; si no, el mayor dia `k` de
  `messageDays` con `since + k·DAY ≤ now`, devuelto como `since + k·DAY` (`null` si no hay: p. ej. dia 90
  de cafe, perdido sin mensaje hasta el 91).
- `A` (`activeUntilDays`) lo calcula el store (§4): `dormant_days` de la corrida de `missed_you` en
  `active`/`paused` del negocio; sin ella, `ladder.missedYou[0]`.

#### 3. Catalogo y opciones por rubro (`templates.ts`, `template-input.ts`, `template-store.ts`)

- `TemplateDefinition` pierde `atRisk` (y el import de `at-risk`). `dormantDays` pasa a `{ options:
  readonly number[]; default: number | null } | null`. Los estaticos quedan como BASE: #7 `[3,7,14]`
  def 7, #8 `[7,14,30]` def 14; #3/#4/#5 llevan `options: []` (se resuelven por rubro). Descripcion de
  #4 sin ritmo: «Le habla a los clientes que dejaron de venir hace un tiempo y estan por perderse.»
  *(ORQUESTADOR, texto)*.
- `resolveTemplate(template, ladder): TemplateDefinition` (en `stages.ts` o `templates.ts`), PURO:
  #3 → `{options: [T1, T2], default: T2}` *(ORQUESTADOR)*; #4 → `{options: [R], default: R}`; #5 →
  `{options: [P], default: P}`; #7/#8 → las opciones base `< T1`; `default` = el base si quedo, si no la
  mayor que quedo, si no queda ninguna `null`; `welcome` sin cambios.
- `listTemplates` y `enableTemplate` leen `core.business.category_gcid` del negocio de la sesion y
  trabajan con `resolveTemplate(…, ladderFor(gcid))`. `parseTemplateInput` no cambia de firma: recibe la
  definicion resuelta. Con `options: []`, un `dormantDays` presente → `400 validation`,
  `fields.dormantDays` = «Esta campaña no se programa por días en tu rubro.»; ausente → se guarda
  `WELCOME_STORED_DORMANT_DAYS` (30, «guardado, nunca leido»).
- `GET /api/marketing/templates` responde `{ templates, ladder }`, `ladder` segun el anexo §1.

#### 4. Loaders y proximidad (`audience-store.ts`, `audience.ts`, `tick.ts`)

- Hecho nuevo en los TRES loaders (`loadAudienceCandidates`, `loadPushCandidates`,
  `loadBalanceCandidates`), SQL crudo con alias propios (docblock de `audience-store.ts:120-132`):
  ```sql
  exists (select 1 from core.campaign_coupon wc
           where wc.welcome_membership_id = m.id and wc.valid_until > ${now}
             and not exists (select 1 from core.coupon_redemption wr where wr.coupon_id = wc.id))
    as welcome_pending
  ```
  (el loader recibe `now`). Se BORRAN `visit_days` y `first_order_at` de `loadAudienceCandidates` y
  `loadPushCandidates`, y de `AudienceCandidate`/`PushCandidate`.
- `loadStageContext(db, businessId): { ladder, activeUntilDays }` — `category_gcid` del negocio + el
  `dormant_days` de su `missed_you` en `active`/`paused` (§2). Una lectura por campaña evaluada.
- `AudienceContext` pierde `atRisk` y gana `stage: StageContext | null` y `templateKey`. En
  `decideTurnEligibility`, el paso 3 (`not_dormant`) pasa a ser: con `stageOfTemplate(templateKey)` no
  nulo, `stageOf(...) ≠` esa etapa → `not_dormant`; sin plantilla de reactivacion (compositor), el piso
  de dias de siempre. El resto del orden no cambia. `loadActiveCampaigns` no cambia.
- `tick.ts`: `runCampaign` carga el `StageContext` y lo pasa; el `atRisk` desaparece.

#### 5. Push de reactivacion (`reactivation-push.ts` nuevo, `push-audience.ts`, `push-store.ts`)

- La rama de reactivacion de `runPushCampaign` (`tick.ts`) se MUDA a `runReactivationPushCampaign` en
  `reactivation-push.ts` (espejo de `balance-push.ts`); `tick.ts` delega por grupo.
- `PushCandidate` cambia `lastGroupDecisionAt` por `lastOwnDecisionAt` = `max(cp.decided_at)` de las
  decisiones NO canceladas de ESTA campaña-plantilla (`c.template_key = <key>`) del cliente en el negocio,
  y gana `welcomePending`, `balance: number | null` (saldo de la membresia si `m.program_id` es el del
  programa operativo, `null` si no).
- `decidePushEligibility(candidate, { now, templateKey, stage: StageContext })`, en orden: `opt_out` →
  `not_reachable` → `not_dormant` (sin tramo: `currentSlotStart` nulo) → `already_reached`
  (`lastOwnDecisionAt ≥ slotStart`) → elegible. Desaparecen el piso y la regla de grupos.
- **Suma de #7/#8** (`reactivation-push.ts`): antes del bucle se cargan la corrida `active` y en fecha
  de `near_reward` y la de `unclaimed_reward` del negocio (si las hay, via `loadPushCampaigns` o una
  lectura propia) y `loadRewardCost`. Por cliente elegible, con `gap = cost − balance` y `balance` no
  nulo: si hay #7 y `0 < gap` y `isNear` con los umbrales de esa corrida → sufijo = `renderGap(#7.message,
  gap, kind)`; si no, si hay #8 y `gap ≤ 0` → sufijo = `#8.message`. Cuerpo = `pushBody(message,
  couponLabel)` + (`" · " + sufijo` si hay sufijo). `isNear` se exporta de `balance-audience.ts` sin
  cambiar su logica. Sin dias, ciclo ni repeticion de #7/#8 (owner: «En cada envío»).
- `recordPushDecision` no cambia (ya acepta `body`).

#### 6. #7/#8 sueltos (`balance-audience.ts`, `balance-store.ts`, `balance-push.ts`)

- `BalanceCandidate` gana `welcomePending`. `BalanceContext` gana `stage: StageContext` y
  `dormantOptions: readonly number[]` (las de `resolveTemplate` para el rubro).
- Hoy `decideBalancePush` obtiene `opt_out` → `not_reachable` → piso de dias LLAMANDO a
  `decidePushEligibility` (`balance-audience.ts:86-94`). Como esa funcion pierde el piso (§5), los pasos
  1–3 de #7/#8 se escriben aca (o en un helper comun sin tramo): `opt_out` → `not_reachable` →
  `not_dormant` si `since > now − dormantDays·DAY` (el piso de siempre) **o** `dormantDays ∉
  dormantOptions` **o** `stageOf(...) ≠ "active"`. Despues, sin cambios: `no_reward`, `has_reward`,
  `not_near`, grupo `balance`, ciclo, repeticion.
- `balance-push.ts` pasa el contexto; `loadBalanceCandidates` trae `welcome_pending`.

#### 7. Datos

Sin migracion: `dormant_days` guarda la eleccion de #3 (T1/T2 ≤ 60) y para #4/#5 el `R`/`P` del rubro al
encender (≤ 240, informativo: el tick lee la tabla), todo dentro de `core_campaign_dormant_days_check`
(3..365). Prod no tiene campañas (SQL 2026-09-29: 0 filas en `core.campaign`).

### Arquitectura de referencia

ADR 0091/0092 (plantillas), 0095 (canal push; §5 reemplazado para reactivacion), 0096 (#7/#8), 0097
(reemplazado), 0099 (bienvenida), **0102** (esta).

## Archivos

| Archivo (bajo `apps/merchant/src/`) | Accion |
|---|---|
| `server/marketing/stage-ladders.ts`, `stages.ts`, `reactivation-push.ts` + `stage-ladders.test.ts`, `stages.test.ts` | crear |
| `server/marketing/at-risk.ts`, `at-risk.test.ts` | borrar |
| `server/marketing/templates.ts`, `template-input.ts`, `template-store.ts`, `audience.ts`, `audience-store.ts`, `push-audience.ts`, `push-store.ts`, `balance-audience.ts`, `balance-store.ts`, `balance-push.ts`, `tick.ts` | editar |
| `server/marketing/{templates,audience,push-audience,balance-audience,template-input}.test.ts` | editar |
| `server/marketing-stages.neon.integration.test.ts` | crear |
| `server/marketing-at-risk.neon.integration.test.ts`, `marketing-at-risk-filters.neon.integration.test.ts` | borrar (su comportamiento lo borra el ADR 0102 §7) |
| `server/marketing-{overlap,push,push-enable,push-results,push-redemption-gate,templates,templates-race,reward,welcome-enable,balance-push,balance-push-filters,tick}.neon.integration.test.ts` | adaptar SOLO lo que el ADR 0102 cambia (ver DoD) |
| `app/backoffice/marketing/template-fields.tsx` (`:115-121`), `marketing-types.ts` (`:60`, `:82`) | editar (borrar el ritmo; `default: number \| null`) |
| `docs/specs/0101-contratos-de-api.md` §4.1, §4.2, §4.4 | nota de remision al anexo 0110 |

Todo archivo ≤ 300 lineas (hook `file-size`): `template-store.ts` esta en 290 y `tick.ts` en 269 —
si no entra, se divide, no se extiende.

### Disjunta?

Si respecto de specs abiertas (no hay otra en ejecucion en `motor`). **Riesgo declarado:** GPT hace UI
sobre `main`; los dos archivos de `app/backoffice/marketing/` pueden chocar en el merge — son 2 borrados
chicos, se resuelven a mano.

### Archivos compartidos

Ninguno: el contrato ya esta escrito.

## Definition of Done

- [ ] `GET /api/marketing/templates` de un negocio `gcid:cafe`: #3 `{options:[7,14], default:14}`, #4
  `[30]`, #5 `[90]`, #7 `{options:[3], default:3}`, #8 `{options:[], default:null}`, sin `atRisk`, y
  `ladder` como el anexo; de un negocio `gcid:store`, la fila de relleno.
- [ ] `enable` de #3 en cafe con `dormantDays: 30` → 400; de #8 en cafe con `dormantDays: 7` → 400 y
  sin el → 201.
- [ ] Tick, cafe: #3 (A=7) decide en los dias 7/14/21/28 y no en el 30; #4 en 30/51/72; #5 en
  91/105/151/181 y nada despues; encendida tarde manda solo el tramo vigente.
- [ ] Bienvenida vigente sin canje excluye #3/#4/#5/#7/#8 en push y proximidad; vencida o canjeada, no.
- [ ] #7/#8 sueltos solo en activo; sumados al push de la etapa con el texto exacto del anexo.
- [ ] Proximidad: la plantilla solo toma turno en su etapa.
- [ ] `at-risk.ts`, sus tests y el bloque del ritmo en la UI borrados; `grep -rn "atRisk\|isAtRisk\|
  visit_days" apps/merchant/src` sin resultados.
- [ ] Cada test existente editado o borrado lleva, en el mensaje de commit, la decision del ADR 0102 que
  lo cambia; un test rojo por OTRA razon es un bug y se arregla el codigo.
- [ ] Seis gates verdes + los `.neon.integration` de marketing por `tools/neon-test.sh`.

## Plan de pruebas y verificación

- [ ] **Unit** `stage-ladders.test.ts`: la tabla entera escrita LITERAL desde este documento (no desde el
  codigo) igual a `STAGE_LADDERS`; las 15 claves de `BUSINESS_CATEGORIES` + `gcid:store` presentes;
  `ladderFor("gcid:zzz")` = la de `gcid:store`.
- [ ] **Unit** `stages.test.ts`: bordes de cada etapa en ms (`R·DAY − 1` / `R·DAY`), `messageDays` de #3
  con A=7 → `[7,14,21,28]` y A=14 → `[14,28]` en cafe; `currentSlotStart` con catch-up; `resolveTemplate`
  para cafe, bakery (#8 → `[7]`, def 7) y beauty_salon (#7 → `[3,7,14]`).
- [ ] **Unit** `audience.test.ts`, `push-audience.test.ts`, `balance-audience.test.ts`: los casos de
  las mutaciones que son puros (M1, M9) y el compositor intacto (piso de dias).
- [ ] **Integracion** `marketing-stages.neon.integration.test.ts` (tick con `random` → 1, negocio
  `gcid:cafe`, puerta con coordenadas, pase y push alcanzable): casos M2–M8 y M10–M12 con asserts por SQL
  sobre `campaign_push`, `wallet_push_queue.body` y `campaign_turn`; doble tick sin filas nuevas.
- [ ] Comandos: `pnpm run typecheck && pnpm run lint && pnpm run test && pnpm run format:check`;
  `pnpm run build`; `pnpm test:e2e` (toca `app/backoffice/marketing/`); `tools/neon-test.sh` con el
  archivo nuevo y todos los `marketing-*` de la tabla de Archivos.
- [ ] Verificacion manual (QA del owner, con la UI): negocio cafe, encender #3 a 7, cliente con ultima
  compra hace 8 dias y pase; correr el tick; ver el push. Encender #7 y ver el sufijo.

### Mutaciones (presupuesto: 13; clase: errores PLAUSIBLES de bordes, del tramo y de cableado)

Los mecanismos son NUEVOS salvo M12 (`audience.ts:124-127`, piso que hoy decide la proximidad) y M4/M5
(borde de `lost`, nuevo en `stages.ts`). Cada ejemplo se calculo a mano contra la mutacion con la tabla
de cafe: la regla correcta y la mutada dan distinto. Rojo por la propiedad; protocolo de la skill
`protocolo-de-verificacion` (shasum, bitacora, `MUTATION`, revertir con `diff`).

| # | Mecanismo | Mutacion | Oraculo que tiene que dar rojo |
|---|---|---|---|
| M1 | borde extrañamos→riesgo | `e < R·DAY` → `e ≤ R·DAY` | unit: A=7, `e = 30·DAY` exacto → `at_risk` (mutada: `missed_you`) |
| M2 | tramo, no conteo | mensaje vigente = `messageDays[nº de decisiones]` | integracion: #4 encendida con cliente en `e = 60 d`; tick; tick a `+6 h` → 1 decision (mutada: 2, la del 30 y la del 51) |
| M3 | tramo anclado al dia del mensaje | `lastOwnDecisionAt ≥ slotStart` → `≥ since` | integracion: #3 A=7; ticks a `7 d + 1 h` y `14 d + 1 h` → 2 decisiones (mutada: 1) |
| M4 | ultimo mensaje de perdido | `e < (I+1)·DAY` → `e < I·DAY` | integracion: #5 con decisiones a 91/105/151; tick a `181 d + 1 h` → decide (mutada: `gone`) |
| M5 | irrecuperable | sin tope superior en `lost` | integracion: mismas decisiones; tick a `200 d` → nada (mutada: decide el 181) |
| M6 | bienvenida: vigencia | sin `wc.valid_until > now` | integracion: alta hace 10 d sin compras, cupon de bienvenida vencido hace 2 d sin canje, #3 A=7 → decide (mutada: excluido) |
| M7 | bienvenida: canje | sin el `not exists coupon_redemption` | integracion: cupon vigente CANJEADO en una compra de hace 8 d, #3 A=7 → decide (mutada: excluido) |
| M8 | fin de activo = eleccion de #3 | `activeUntilDays = T1` siempre | integracion: #3 a 14, #7 a 3 (sellos, umbral 2), costo 10, saldo 9, ultima compra hace 10 d → #7 decide suelto y #3 no (mutada: etapa `missed_you` → #7 no decide y #3 decide el tramo 7) |
| M9 | opciones de #7/#8 `< T1` | `<` → `≤` | unit: `resolveTemplate(near_reward, cafe).dormantDays.options` = `[3]` (mutada: `[3,7]`) |
| M10 | suma de #7 | sin sufijo | integracion: #3 A=7 + #7 viva (sellos 2), costo 10, saldo 8, `e = 7 d + 1 h` → `body` = «Hace rato no te vemos. ¡Te esperamos! · ¡Estás a 2 sellos de tu premio!» |
| M11 | suma solo con #7 viva | sufijo aunque #7 este `ended` | integracion: mismo cliente, #7 finalizada → `body` = «Hace rato no te vemos. ¡Te esperamos!» exacto |
| M12 | proximidad por etapa | plantilla con el piso de dias viejo | integracion: #3 A=7 y #5 con proximidad, #4 apagada, cliente con pase a `e = 40 d` → sin turno (mutada: turno de #3) |
| M13 | la tabla | `gcid:gym` lost `120` → `121` | unit: la tabla literal de `stage-ladders.test.ts` |

**Declarado fuera:** la frontera horaria (la etapa se mide en ms desde la ultima compra, no en dias
locales); la suma de #8 (mismo mecanismo que M10, un caso sin mutacion); `enable` por rubro con oraculo
y sin mutacion; frecuencia total (11 push por ausencia en cafe, sin tope — ADR 0102).

## Handoff requerido

Un implementador y un revisor independiente (`docs/AGENT-WORKFLOW.md`, ADR 0071). Sin migracion: el
deploy basta. El revisor re-mide M2, M4, M8 y M10 como minimo y verifica que ningun test existente se
edito por otra razon que una decision del ADR 0102.

## Abierto

Nada que bloquee. Esperando el OK del owner para pasar a `cerrada`, incluidas las elecciones
*(ORQUESTADOR)*: default de #3 = T2; borde de perdido `I + 1 dia`; suma de #7/#8 solo en push; etapa
ajena contada como `not_dormant`; texto nuevo de #4.

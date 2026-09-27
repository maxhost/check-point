---
spec: 0105
fecha: 2026-09-27
estado: implementada
resumen: Spec C — plantilla #4 «Cliente en riesgo» (`at_risk`), implementa el ADR 0097. Reactivacion como #3/#5 (proximidad, push o ambos; cupon opcional); audiencia = dormido ≥ N dias (14/30/45, def. 14) Y habitual que rompio su ritmo (≥3 dias con compra, ausencia > 2× su intervalo promedio; 3 y 2× fijos). Escalera #3 → #4 → #5 (rangos 1/2/3) y proximidad ordenada por rango. Migracion `0048` (solo el check de `template_key`).
disjunta: si
archivos: apps/merchant/drizzle/0048_*, apps/merchant/src/server/schema/campaign.ts, apps/merchant/src/server/marketing/{templates,audience,audience-store,push-audience,push-store,tick}.ts + nuevo at-risk.ts, docs/specs/0101-contratos-de-api.md
---

# 0105 — Plantilla «Cliente en riesgo» (C)

> Implementa el **ADR 0097**. Decisiones del owner en el ADR (textuales) y en `docs/TASKS.md`. Lo
> marcado *(ORQUESTADOR)* lo eligio el orquestador por delegacion explicita del owner («elije una
> cosa», «armalo de alguna manera para que podamos probar»).

## Problema

El catalogo tiene #3 «Te extrañamos» (dormidos 14/30 d) y #5 «Recuperar perdidos» (60/90/180 d), que
miran solo dias sin venir. El cliente que venia cada semana y lleva tres sin aparecer es el mas
valioso de recuperar y hoy recibe lo mismo que uno que vino una vez hace un mes. No existe
`at_risk` en el catalogo ni en el check `core_campaign_template_key_check` (`schema/campaign.ts:149`).

## Alcance

**Entra:**
- Catalogo: `at_risk` + campo `atRisk` (informativo); rangos de `reactivation` 1/2/3.
- Regla pura de «en riesgo» y su cableado en los DOS caminos del tick (proximidad y push).
- Orden de las campañas con proximidad por rango de plantilla.
- Migracion `0048` y el contrato en `docs/specs/0101-contratos-de-api.md`.

**No entra:**
- Hacer editables las 3 visitas o el 2× (owner: se decide viendo la UI). UI (ADR 0070).
- `audience-preview` con ritmo (es del compositor). Foto de audiencia nueva: el «no esta en riesgo»
  cuenta como `not_dormant`, que la foto no desglosa.
- Canjes como visita para el ritmo (ADR 0097 §5). Migrar prod (orquestador, con OK, tras el PASS).

## Diseño

### Especificación técnica

#### 1. Migracion `0048_plantilla_en_riesgo.sql` (via `drizzle-kit generate`)

`core_campaign_template_key_check` → `in ('missed_you','win_back','near_reward','unclaimed_reward',
'at_risk')`. Nada mas: #4 no tiene columnas propias. Las filas de prod cumplen el check nuevo.

#### 2. Catalogo (`marketing/templates.ts`)

- `TemplateKey` suma `at_risk`. `TemplateDefinition` gana `atRisk: { minVisits: number; rhythmFactor:
  number } | null` (solo #4: `{ minVisits: 3, rhythmFactor: 2 }`; el resto `null`). Sale tal cual en
  `GET /api/marketing/templates` (el `TemplateView` esparce la definicion, `template-store.ts:273`).
- `at_risk`: «Cliente en riesgo», `channels: ["proximity","push"]`, `reactivation` **rango 2**,
  `dormantDays {14,30,45} def 14`, mensaje `"Hace unos días que no te vemos. ¡Te esperamos!"`,
  `gapMarker: false`, `couponRecommended: false`, `couponAllowed: true`, `nearReward: null`, `repeat:
  null`. Va en el catalogo entre `missed_you` y `win_back`.
- `win_back` pasa a **rango 3**. Textos: *(ORQUESTADOR)*, cambian sin spec.
- `enable`/`disable` no cambian: la validacion ya es generica sobre la definicion (`template-input.ts:57-68`).

#### 3. Regla pura (`marketing/at-risk.ts` nuevo)

```ts
type VisitHabit = { visitDays: number; firstOrderAt: Date | null; lastOrderAt: Date | null };
isAtRisk(habit, now, rule: { minVisits; rhythmFactor }): boolean
```
`false` si `visitDays < minVisits` o faltan fechas; si no, `ritmo = (lastOrderAt − firstOrderAt) /
(visitDays − 1)` en ms y `true` sii `now − lastOrderAt > rhythmFactor × ritmo` (estricto).

#### 4. Cableado (`audience.ts`, `push-audience.ts`, stores, `tick.ts`)

- `AudienceCandidate` y `PushCandidate` ganan `visitDays` y `firstOrderAt`. `loadAudienceCandidates` y
  `loadPushCandidates` los traen en su SQL crudo con alias propios: `visit_days` = `count(distinct
  (o.created_at at time zone b.timezone)::date)` de las ordenes del negocio y el consumidor, con `b` =
  `core.business` del negocio; `first_order_at` = `min(o.created_at)`.
- El contexto de `decideTurnEligibility` y de `decidePushEligibility` gana `atRisk: {minVisits;
  rhythmFactor} | null`. Con valor, DESPUES del chequeo de dormido (`audience.ts:117`,
  `push-audience.ts:58`) y antes de lo siguiente: `!isAtRisk(...)` → `not_dormant` (no es el publico).
  El piso de dias NO se saltea.
- `tick.ts`: `runCampaign` y `runPushCampaign` pasan `template?.atRisk ?? null`. `loadActiveCampaigns`
  devuelve `templateKey`.

#### 5. Orden de proximidad (`audience-store.ts:76-80`)

`loadActiveCampaigns` mantiene su `order by` y despues ordena en TS, estable, por rango de la plantilla
desc (compositor = 0), igual que `loadPushCampaigns` (`push-store.ts:111`). Actualizar su docblock.

### Arquitectura de referencia

ADR 0091/0092 (plantillas), 0095 (canal push y grupos), **0097** (esta).

## Archivos

| Archivo | Accion |
|---|---|
| `apps/merchant/drizzle/0048_plantilla_en_riesgo.sql` + `meta/` | crear (generate) |
| `src/server/schema/campaign.ts` | editar |
| `src/server/marketing/templates.ts`, `audience.ts`, `push-audience.ts`, `audience-store.ts`, `push-store.ts`, `tick.ts` | editar |
| `src/server/marketing/at-risk.ts` + `at-risk.test.ts` | crear |
| `templates.test.ts`, `audience.test.ts`, `push-audience.test.ts` | editar (casos nuevos) |
| `src/server/marketing-at-risk.neon.integration.test.ts` | crear |
| `docs/specs/0101-contratos-de-api.md` (§4.1, §4.2 opciones, §4.4 solapamiento) | editar |

(Rutas relativas a `apps/merchant/` salvo `docs/`. Todo archivo ≤ 300 lineas; `tick.ts` esta en 248.)

### Disjunta?

Si. La 0100 (otra sesion) toca `app/backoffice/loyalty/**`.

### Archivos compartidos

Ninguno.

## Definition of Done

- [ ] Migracion `0048` generada y aplicada en la rama de CI por `tools/neon-test.sh`.
- [ ] `GET /api/marketing/templates` lista 5 plantillas; `at_risk` con `atRisk`, rango 2; `win_back` rango 3.
- [ ] `enable` de `at_risk` con `{}` crea «ambos», 14 d; con `dormantDays: 7` → 400.
- [ ] Tick: #4 decide (turno y push) solo a habituales que rompieron su ritmo y pasaron el piso.
- [ ] Escalera: tras un push de #4, #3 no decide y #5 si (misma ausencia).
- [ ] Proximidad: con #3 y #4 activas, el habitual en riesgo recibe el turno de #4.
- [ ] Contrato actualizado. Seis gates verdes + los `.neon.integration` de marketing por `tools/neon-test.sh`.

## Plan de pruebas y verificación

- [ ] **Unit** `at-risk.test.ts`: 2 visitas → no; ritmo exacto (dias 0/10/20, ahora 40 → no; 40 + 1 ms → si); fechas nulas → no.
- [ ] **Unit** `audience.test.ts` / `push-audience.test.ts`: con `atRisk`, un cliente diario (10 visitas
  en dias 0–9) a los 12 d → `not_dormant` (piso 14); sin `atRisk`, la regla vieja intacta.
- [ ] **Integracion** `marketing-at-risk.neon…` (tick, `random` inyectado a 1, negocio con `timezone`
  propio, puerta con coordenadas y pase): casos de las mutaciones M3–M7 con asserts por SQL sobre
  `campaign_turn`/`campaign_push`; doble tick sin filas nuevas.
- [ ] Comandos: `pnpm run typecheck && pnpm run lint && pnpm run test && pnpm run format:check`;
  `pnpm run build`; `pnpm test:e2e` (no toca UI: se corre igual y se compara contra el rojo previo
  `loyalty-tour-help.spec.ts`); `tools/neon-test.sh` con el archivo nuevo + `marketing-templates*`,
  `marketing-tick`, `marketing-push*`, `marketing-balance-push*`, `marketing-results`.
- [ ] Verificacion manual (QA del owner, al final del arco): activar #4 en un negocio de prueba con un
  cliente de 3 visitas semanales y 15 dias de ausencia; tick; ver el push o el turno.

### Mutaciones (presupuesto: 8; clase: errores PLAUSIBLES de la regla del ritmo y de cableado)

Todo mecanismo NUEVO salvo M6 (`templates.ts:98`, rango de `win_back`) y M7 (`audience-store.ts:76-80`),
verificados en el arbol el 2026-09-27. Los ejemplos se calcularon a mano contra la mutacion (cada uno
DISTINGUE: la regla correcta y la mutada dan distinto). Rojo por la propiedad. Protocolo: skill
`protocolo-de-verificacion`.

| # | Mecanismo | Mutacion | Oraculo que tiene que dar rojo |
|---|---|---|---|
| M1 | minimo de visitas | `< minVisits` → `< minVisits - 1` | unit: visitas dias 0/10, ahora 40 (ritmo 10, ausencia 30 > 20) → no |
| M2 | factor estricto | `>` → `>=` | unit: dias 0/10/20, ahora 40 (ausencia 20 = 2×10) → no |
| M3 | visitas = dias DISTINTOS | `count(*)` en vez de `count(distinct …::date)` | integracion: ordenes dia 0 09:00 y 11:00 (locales) y dia 20 09:00, ahora dia 41 09:00 → sin decision (2 visitas; mutada: 3, ritmo 10, ausencia 21 > 20) |
| M4 | cableado proximidad | `runCampaign` pasa `atRisk: null` | integracion: dias 0/30/60, ahora 80 (ritmo 30, ausencia 20 ≤ 60) → #4 sin turno |
| M5 | cableado push | `runPushCampaign` pasa `atRisk: null` | integracion: mismo cliente → #4 sin `campaign_push` |
| M6 | escalera | `win_back` vuelve a rango 2 | integracion: push de #4 decidido; reloj a ausencia ≥ 60 con #5 (60 d) activa → #5 decide |
| M7 | orden de proximidad por rango | quitar el orden por rango | integracion: #3 (30 d) y #4 (14 d) activas; dias 0/5/10, ahora 45 → el turno es de #4 |
| M8 | piso de dias | #4 saltea el chequeo de dormido | unit: cliente diario (dias 0–9) a los 12 d → `not_dormant` |

**Declarado fuera:** la frontera del dia en la `timezone` del negocio (M3 la ejercita en un solo
huso); `enable` de `at_risk` solo con oraculo, sin mutacion.

## Handoff requerido

Un implementador y un revisor independiente (`docs/AGENT-WORKFLOW.md`, ADR 0071). Orden de prod: el
codigo nuevo escribe `at_risk` → **migrar prod ANTES del deploy**, con OK del owner. El codigo viejo con
la `0048` aplicada no se rompe (el check solo se ensancha).

## Abierto

Nada. **OK del owner (2026-09-27, textual):** «ok por ahora. vamos por alli quiero acabar, para
implementar conexion entre el api y ui para entenderlo mejor y alli ajustare. incluso puede que lo que
hoy vemos que se pisa por ejemplo "cliente en perdida" con "te extrañamos" con "evento" u otros, no sea
necesario tener tantas campañas» → las elecciones *(ORQUESTADOR)* del ADR 0097 quedan como estan, a
revisar con la UI. **El OK para migrar prod la `0048` NO fue dado todavia:** se pide tras el PASS.

## Cierre (2026-09-27)

Implementada en `6013db2` + `f086615` (oraculos R1–R3). Implementador: 5 gates verdes (1929 tests),
`test:e2e` 105/5/1 con el rojo previo `loyalty-tour-help.spec.ts:40` (reproducido en `d8866ad`), Neon
14 archivos 61/61, M1–M8 en ROJO + 2 extra (dia local vs UTC; piso en push). Desvio: el caso de M3 usa
18:30/20:30 locales, que cruzan la medianoche UTC. Revisor independiente: **PASS** (gates re-corridos,
Neon 13 archivos 57/57, check de la `0048` leido en la rama de CI). R4 (dia en la timezone, push) en
ROJO; R1 (compositor detras de las plantillas), R2 (`first_order_at` por negocio) y R3 (ritmo despues
de `opt_out`) sobrevivian por falta de caso → el orquestador agrego
`marketing-at-risk-filters.neon.integration.test.ts` y un caso en `audience.test`/`push-audience.test`
y los re-midio: R1, R2 (en los dos loaders) y R3 (en los dos caminos) en ROJO por la propiedad.
Gates re-corridos tras `f086615`: 1931 tests, Neon 3 archivos 15/15.
**Declarado:** `BalanceCandidate` omite el habito de visitas (#7/#8 no lo usan); el build del revisor
salio de la cache de turbo. **Prod:** `0048` sin aplicar y sin push — espera el OK del owner.


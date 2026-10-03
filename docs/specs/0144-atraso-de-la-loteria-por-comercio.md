---
spec: 0144
fecha: 2026-10-03
estado: implementada
resumen: El atraso de la loteria H4 (F y R, spec 0143 §3) se cuenta por COMERCIO y no por campaña, para que recrear la cruzada a mitad de mes no resetee la cuenta (owner, 2026-10-03). Un `where` en `loadLotteryHistory`, sin migracion.
disjunta: si
archivos: packages/domain/src/server/marketing/{cross-sale-store,cross-sale}.ts, apps/merchant/src/server/cross-sale-lottery-facts.neon.integration.test.ts, docs/adr/0117-*.md
---

# 0144 — El atraso de la loteria se cuenta por comercio

## Problema

- `loadLotteryHistory` (`packages/domain/src/server/marketing/cross-sale-store.ts:86`) cuenta `F` (suma de `1/k`) y `R`
  (veces elegida con `outcome = 'issued'`) **por campaña** (`where k.campaign_id = ${campaignId}`). La llama
  `cross-sale.ts:181` con `campaign.id`.
- Si B pausa o termina su cruzada y crea otra a mitad de mes (`core_campaign_template_live_unique` permite una sola viva
  por comercio, no una por mes), la nueva arranca con `F = R = 0`: un comercio adelantado recupera chance que no le toca,
  y uno atrasado pierde su empuje.

## Decisiones del owner

2026-10-03, explicado con el ejemplo de la campaña que gano 30 de 40 y se recrea: **«si acepto, ajusta caso 2»** →
contar por comercio. Y en la misma respuesta, el caso 1: un `coupon_conflict` **no** cuenta como ganada (`R` sigue
contando solo `issued`, como hoy). Las dos van al ADR 0117, «Cerrado despues».

## Alcance

**Entra:** `loadLotteryHistory` recibe el `businessId` de B y cuenta las filas de `cross_candidate` de **cualquier**
campaña de B; el llamador le pasa `campaign.businessId`; un caso Neon que recrea la campaña; las dos lineas del ADR 0117.

**No entra:** migracion o indice nuevo; el bono H4 (`gotNewCustomerSince` ya es por comercio); el tope mensual
(`monthCount`, por campaña, regla de la 0136 que no cambia); el segmento.

## Diseño

```sql
-- F y R del comercio B desde monthStart
... from core.cross_candidate k
join core.cross_decision d on d.id = k.decision_id
where k.campaign_id in (select c.id from core.campaign c where c.business_id = ${businessId})
  and d.decided_at >= ${monthStart}
```

`R` sigue siendo `count(*) filter (where d.chosen_campaign_id = k.campaign_id and d.outcome = 'issued')`: la fila `k` es
la candidatura de B en esa decision, asi que «elegida» = B elegida. Se filtra por `campaign_id` (no por
`k.business_id`) para usar el indice `core_cross_candidate_campaign_idx` que ya existe. La firma pasa a
`loadLotteryHistory(tx, businessId, monthStart)`.

## Archivos

| Archivo | Accion |
|---|---|
| `packages/domain/src/server/marketing/cross-sale-store.ts` | editar (`loadLotteryHistory` + docblock) |
| `packages/domain/src/server/marketing/cross-sale.ts` | editar (pasa `campaign.businessId`) |
| `apps/merchant/src/server/cross-sale-lottery-facts.neon.integration.test.ts` | editar (caso nuevo) |
| `docs/adr/0117-*.md` | editar («Cerrado despues») |

**Disjunta: si.** Todo es zona de Claude; nada abierto en el INDEX toca estos archivos.

## Definition of Done

- [ ] Caso Neon nuevo: decision 1 con B y C (sorteo `0`); la campaña elegida se pasa a `ended` y su comercio crea otra
      cruzada; decision 2 → la candidatura de la campaña NUEVA tiene `factor_behind = 1` (`F = 1/2 + 1/2`, `R = 1`) y la
      del otro comercio `2`. Por campaña daria `1.5` para la nueva (`F = 1/2`, `R = 0`).
- [ ] Los casos de `cross-sale-lottery-facts`, `cross-sale`, `cross-sale-races` y `cross-sale-push` verdes con
      `tools/neon-test.sh`.
- [ ] `pnpm verify` en verde con Node 24, con su tabla final.
- [ ] `rg -n MUTATION apps packages tools` → vacio.

## Mutaciones — presupuesto: 1. Clase: los plausibles

| # | Mutacion | Oraculo que tiene que ponerse ROJO |
|---|---|---|
| 1 | volver al filtro por campaña (`k.campaign_id = <id de la campaña>`) | caso nuevo: `expected 1.5 to be close to 1` |

Guard hermano: ninguno; el primer caso del archivo (sin recrear) da igual por campaña y por comercio, por eso hace falta
el caso nuevo.

**Protocolo:** el de `protocolo-de-verificacion`. **Corte:** dos vueltas de «el fix abrio la siguiente» → al owner.

## Declarado AFUERA (sin oraculo, a proposito)

- Rendimiento de la subconsulta con muchas campañas por comercio (hoy, una viva y pocas terminadas por comercio).

## Handoff

Implementa el orquestador (un `where` y su caso); un revisor independiente re-ejecuta la mutacion antes de
`implementada`.

## Abierto

Nada.

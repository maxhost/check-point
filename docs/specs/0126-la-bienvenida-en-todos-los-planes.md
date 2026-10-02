---
spec: 0126
fecha: 2026-10-02
estado: implementada
resumen: La Bienvenida sale del freno de plan (ADR 0112): entrada `campaigns.welcome` en el catalogo, el freno decide por plantilla en activar/reanudar/entregar, y la facturacion no la pausa ni la cuenta al bajar de plan.
disjunta: si
archivos: packages/domain/src/server/entitlements/catalog.ts, packages/domain/src/server/marketing/plan-gate.ts, packages/domain/src/server/marketing/welcome-store.ts, apps/merchant/src/server/marketing/template-store.ts, apps/merchant/src/server/marketing/campaign-actions.ts, apps/merchant/src/server/marketing/plan-brake.ts, tests
---

# 0126 — La Bienvenida en todos los planes

> Implementa el **ADR 0112**. Decisiones del owner del 2026-10-02: free + plus + sin plan; mismo tope; la baja no la
> pausa. Sin migraciones.

## Problema

- `catalog.ts:90` — `campaigns.enabled` es `true` solo para `plus` con suscripción viva, y **todas** las campañas lo
  usan, la Bienvenida incluida.
- Los cuatro puntos donde frena hoy a la Bienvenida (leídos el 2026-10-02):
  1. activar plantilla — `apps/merchant/src/server/marketing/template-store.ts:164` (`planAllowsCampaigns`);
  2. reanudar — `apps/merchant/src/server/marketing/campaign-actions.ts:72` (`planAllowsCampaigns`);
  3. entregar el regalo — `packages/domain/src/server/marketing/welcome-store.ts:80` (`campaignsAllowedFor`);
  4. facturación — `apps/merchant/src/server/marketing/plan-brake.ts`: `pauseCampaignsForDowngrade` pausa toda
     campaña `active` y `activeCampaignCount` (que alimenta `downgrade_blocked_campaigns`) las cuenta todas.
- `campaignsAllowedFor(null)` es `false` (`plan-gate.ts:63`): un negocio **sin fila de suscripción** tampoco pasa.

## Alcance

**Entra:** los cuatro puntos de arriba deciden la Bienvenida con `campaigns.welcome`.

**No entra:**
- `campaign-store.ts:196` (crear campaña PROPIA): sigue con `campaigns.enabled`.
- `cross-store.ts:144` (plantillas `cross` y `valley`): siguen con `campaigns.enabled`.
- El texto del 402 y cualquier pantalla (ADR 0070: la UI es del owner).
- El tope mensual: no cambia (decisión 2 del ADR).

## Diseño

### Especificación técnica

1. **Catálogo** (`catalog.ts`), entrada nueva junto a `campaigns.enabled`, con docblock que cite el ADR 0112:
   ```ts
   "campaigns.welcome": {
     kind: "flag",
     byPlan: { free: true, plus: true, none: true },
     fallback: true,
     requiresLiveSubscription: false,
     pendingRule: "min",
   },
   ```
   (`pendingRule: "min"` es inocuo: los tres planes dan `true`.)
2. **Freno por plantilla** (`plan-gate.ts`):
   - `campaignAllowedFor(row: CampaignPlanRow | null, templateKey: string | null): boolean` —
     `templateKey === "welcome"` → `can(row ?? {}, "campaigns.welcome")` (un `row` nulo es «sin plan», que la
     entrada admite por `fallback`); cualquier otro valor → `campaignsAllowedFor(row)` (sin cambios).
   - `planAllowsCampaign(tx, businessId, templateKey)`: la misma lectura que `planAllowsCampaigns`, decidida con
     `campaignAllowedFor`. `planAllowsCampaigns` y `campaignsAllowedFor` quedan para los llamadores que no son
     plantilla.
   - La constante `"welcome"` se toma del catálogo de plantillas si ya existe exportada; si no, literal con
     comentario. No se inventa otra lista.
3. **Activar plantilla** (`template-store.ts:164`): `planAllowsCampaign(tx, businessId, template.key)`.
4. **Reanudar** (`campaign-actions.ts:72`): `planAllowsCampaign(tx, businessId, current.templateKey)`.
5. **Entregar** (`welcome-store.ts:80`): `campaignAllowedFor(plan, "welcome")`.
6. **Facturación** (`plan-brake.ts`): `pauseCampaignsForDowngrade` y `activeCampaignCount` excluyen
   `template_key = 'welcome'` (`template_key IS DISTINCT FROM 'welcome'`: una campaña propia tiene `NULL` y SÍ se
   cuenta). Docblock: por qué (ADR 0112 §3).

Errores: sin cambios. Un free que activa cualquier otra plantilla sigue recibiendo **402 `plan_not_allowed`**.
Autorización y aislamiento: sin cambios (`requireApiOwner`, `business_id` en cada consulta).

### Arquitectura de referencia

El catálogo de entitlements (spec 0072) ya existe para esto: una regla de plan = una entrada.

## Archivos

| Archivo | Accion |
|---|---|
| `packages/domain/src/server/entitlements/catalog.ts` | editar (entrada nueva) |
| `packages/domain/src/server/marketing/plan-gate.ts` | editar (freno por plantilla) |
| `packages/domain/src/server/marketing/welcome-store.ts` | editar (1 llamada) |
| `apps/merchant/src/server/marketing/template-store.ts` | editar (1 llamada) |
| `apps/merchant/src/server/marketing/campaign-actions.ts` | editar (1 llamada) |
| `apps/merchant/src/server/marketing/plan-brake.ts` | editar (2 filtros) |
| `apps/merchant/src/server/entitlements-catalog.test.ts` | editar (casos de `campaigns.welcome`) |
| tests de integración de marketing/billing que aseveren el freno | editar/crear según el plan de pruebas |

### Disjunta?

Sí. Ninguna otra spec en curso toca estos archivos.

### Archivos compartidos

Ninguno.

## Definition of Done

- [x] Un negocio **free** activa la plantilla `welcome` (200) y el mismo negocio recibe **402 `plan_not_allowed`** al
      activar otra plantilla (p. ej. `win_back`).
- [x] Un negocio **sin fila de suscripción** activa `welcome` (200).
- [x] Con la Bienvenida activa en un negocio free, la entrega del regalo (`welcome-store`) la devuelve (ya no `null`).
- [x] Reanudar una Bienvenida pausada en free → 200; reanudar otra plantilla pausada en free → 402.
- [x] Bajar de plan con una Bienvenida y otra campaña activas: se pausa SOLO la otra; la baja bloqueada por campañas
      cuenta SOLO la otra (y una Bienvenida sola NO bloquea la baja).
- [x] Gates de root con Node 24, una vez al final: `typecheck`, `lint`, `test`, `format:check`, `build`.
- [x] `tools/neon-test.sh` sobre las suites de integración tocadas/creadas, de a una. Nunca contra `DATABASE_URL`.
- [x] `rg -n MUTATION apps tools packages` → vacío.

## Plan de pruebas y verificación

**Presupuesto: 4 mutaciones. Clase: los plausibles** (un llamador que se queda con el freno viejo, la facturación que
vuelve a contar la Bienvenida). Lo que quede afuera se declara.

| # | Mutación | Oráculo que tiene que ponerse ROJO |
|---|---|---|
| M1 | `campaigns.welcome.byPlan.free` → `false` | unit `entitlements-catalog.test.ts` (caso free) **y** la integración «free activa welcome» |
| M2 | `template-store.ts`: volver a `planAllowsCampaigns(tx, businessId)` (cableado) | integración «free activa welcome» → 402 |
| M3 | `welcome-store.ts`: volver a `campaignsAllowedFor(plan)` (cableado de la entrega) | integración de la entrega en free → `null` |
| M4 | `plan-brake.ts`: sacar el filtro de `welcome` en `pauseCampaignsForDowngrade` | integración de la baja: la Bienvenida queda `paused` |

Guard hermano a revisar por fila (skill §2.0): en M2, que ningún otro guard del camino de `enable` frene a un free
(p. ej. una validación de cupón que exija producto de catálogo); si existe, el escenario lo cumple.

- [ ] Unit: `entitlements-catalog.test.ts` — `can(live("free"|"plus"|"none"), "campaigns.welcome")` → `true`;
      `can({}, "campaigns.welcome")` → `true`; `campaigns.enabled` sin cambios.
- [ ] Unit/doble de `plan-gate`: `campaignAllowedFor(row, "welcome")` vs `campaignAllowedFor(row, "win_back")` con
      `row` free y con `null`.
- [ ] Integración (Neon, `tools/neon-test.sh`): negocio free → activar `welcome` 200, `win_back` 402; sin suscripción
      → `welcome` 200; entrega del regalo en free; pausa/reanuda; baja de plan con `welcome` + otra activa.
- [ ] Regresión: las suites existentes que pinnean el 402 para free siguen verdes **para las plantillas que no son
      `welcome`**; si alguna pinneaba el 402 de `welcome`, se actualiza a la regla nueva citando el ADR 0112 (es el
      cambio de comportamiento pedido, no un test borrado).
- [ ] Verificación manual (owner): en `business.checkpass.club`, «Prueba de Barrio» (free) activa la Bienvenida; QA
      en Android del regalo (fila de PARQUEADO).

**Protocolo de mutaciones:** `shasum` limpio → fila de bitácora antes de medir → etiqueta `MUTATION` → medir y
transcribir → revertir con `diff` contra copia limpia. Leer la aserción del rojo. **Condición de corte:** dos vueltas
de «el fix abrió la siguiente» → se corta y va al owner.

## Handoff requerido

UN implementador para toda la spec y UN revisor independiente al final (ADR 0071). Requiere deploy para el QA del
owner (push a `main` con su OK).

## Abierto

Nada.

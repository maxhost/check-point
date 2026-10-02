---
spec: 0138
fecha: 2026-10-02
estado: cerrada
resumen: Spec 1 del ADR 0115. Un solo modulo decide que campañas existen (`welcome` y `cross`), el compositor libre y la proximidad apagados; la API los oculta y rechaza, el tick no corre las apagadas ni el paso 4 (resuelve la #67), y «Mis beneficios» deja de ofrecer valle. Codigo conservado; los tests de lo apagado lo re-encienden con `vi.mock` del modulo.
disjunta: si
archivos: packages/domain/src/server/marketing/enabled-campaigns.ts (crear), apps/merchant/src/server/marketing/{template-store,campaign-store,campaign-actions,audience-store,push-store,tick}.ts, packages/domain/src/server/consumer/{cross-offers,valley-offers}.ts, tests de lo apagado (solo agregar el `vi.mock`), un test de integracion nuevo
---

# 0138 — Solo Bienvenida y Venta cruzada

## Problema

- El ADR 0115 (owner, 2026-10-02) deja **solo `welcome` y `cross`**. Hoy el merchant ve y activa las 8 plantillas
  (`listTemplates` recorre `TEMPLATES`, `template-store.ts:262-305`; `enableTemplate` acepta cualquier clave valida,
  `:143`) y el compositor libre (`createCampaign`, `campaign-store.ts:177`; `activate` en `campaign-actions.ts:58-68`).
- El tick corre todo: paso 1 (`loadActiveCampaigns`, `audience-store.ts:~70-95`, filtra `status='active'` +
  `channel_proximity`), 1b (`loadPushCampaigns`, `push-store.ts:64-95`), valle (`refreshValleyDetections`,
  `tick.ts:241`) y **el paso 4** (`placeConsumers`, `tick.ts:248-255`), que es el **~98 % del tick** (87,7 s de ~89 s
  con 99 consumidores en `ci-integration`, medido 2026-10-02, `PARQUEADO.md` #67).
- «Mis beneficios» ofrece valle: `listCrossOffers` mezcla `listValleyOffers` (`cross-offers.ts:135`) y el reclamo
  `claimValleyOffer` (`api/public/consumer/cross-offers/[campaignId]/claim/route.ts:86`).

## Alcance

**Entra:** un modulo unico que decide lo encendido; el filtro en catalogo, listado y por id; el rechazo al crear,
activar y encender; el tick sin lo apagado ni el paso 4; valle fuera de «Mis beneficios»; los tests de lo apagado
re-encendiendolo por `vi.mock`; la limpieza de los turnos vivos historicos de `ci-integration`.

**No entra:** canales (spec 2 del 0115), limites (spec 3), aviso de la cruzada (spec 4), UI (GPT; aca va el
contrato), borrar codigo de lo apagado (el owner pidio conservarlo), migraciones, pausar campañas (ver Diseño §5).

## Diseño

### 1. El modulo: `packages/domain/src/server/marketing/enabled-campaigns.ts`

```ts
/** ADR 0115: lo UNICO que se edita para encender o apagar una campaña. */
export const ENABLED_TEMPLATE_KEYS: readonly TemplateKey[] = ["welcome", "cross"];
/** El compositor libre (campaña sin plantilla, `template_key` nulo). */
export const COMPOSER_ENABLED = false;
/** El paso 4 del tick (proximidad del pase de Wallet, ADR 0065). */
export const PROXIMITY_PLACEMENT_ENABLED = false;

/** `null` = compositor. Una clave desconocida es `false`. */
export function campaignKindEnabled(templateKey: string | null): boolean;
```

Todo lo de abajo pregunta **solo** a este modulo, sin listas propias. El docblock dice que es la puerta de los
limites por comercio (ADR 0115 §5), sin implementarlos.

### 2. API del merchant (contrato para la UI, ADR 0070)

| Endpoint | Hoy | Despues |
|---|---|---|
| `GET /api/marketing/templates` | las 8 | solo las encendidas, en el orden del catalogo (`welcome`, `cross`) |
| `POST /api/marketing/templates/{key}/enable` y `/disable` con clave apagada | 201 / 200 | **404 `not_found`** «No existe esa plantilla.» (el mismo `unknownTemplate()`, `template-store.ts:55`) |
| `GET /api/marketing/campaigns` | todas | solo las de clave encendida (sin compositor) |
| `POST /api/marketing/campaigns` (compositor) | 201 | **409 `campaign_disabled`** «Esta campaña no está disponible por ahora.» |
| `GET`/`PATCH /api/marketing/campaigns/{id}`, `…/{id}/{activate,pause,end,archive,results}` de una campaña apagada | 200 | **404 `not_found`** (via `getCampaign`, `campaign-store.ts:164`: una campaña apagada no existe para el merchant) |

**Orden contra los guards hermanos:** el chequeo de encendido va **ANTES** del freno de plan (`planAllowsCampaign`,
402) y antes de validar el body (400). Si fuera despues, un negocio sin Plus recibe 402 sobre algo que no existe.

### 3. El tick

- Paso 1 y 1b: `loadActiveCampaigns` y `loadPushCampaigns` descartan las filas con `!campaignKindEnabled(templateKey)`
  (el filtro en TS despues del select alcanza: son pocas filas por corrida; no hace falta SQL).
- Valle: `refreshValleyDetections` se llama solo si `campaignKindEnabled("valley")`.
- Paso 4: `merit` + `placeConsumers` corren solo si `PROXIMITY_PLACEMENT_ENABLED`. Si no corre, el resumen da
  `consumers: 0, activated: 0, holdouts: 0, refreshes: 0` (misma forma de `TickSummary`, sin campos nuevos).
- Sin cambios: barrido y recordatorios de la Bienvenida, expirar, cancelar, lock.

### 4. «Mis beneficios»

`listCrossOffers` no suma `listValleyOffers` si valle esta apagado. `claimValleyOffer` con valle apagado devuelve
`null` antes de abrir la transaccion, el mismo valor que hoy para una campaña inexistente
(`valley-offers.ts:164`). La ruta ya lo traduce a **404** con el cuerpo `UNAVAILABLE`
(`cross-offers/[campaignId]/claim/route.ts:12,92`). No hay codigo de error nuevo.

### 5. Pausar las vivas: no hace falta mecanismo

El ADR pide pausar las campañas vivas apagadas. **Medido en PROD el 2026-10-02** (SQL de solo lectura): 1 campaña
(`welcome`, `active`), 0 turnos vivos, 8 negocios. **No hay ninguna que pausar.** En cualquier otra base, una
apagada que siga `active` queda oculta (§2) e ignorada por el tick (§3). Se declara; no hay migracion ni script.

### 6. Los tests de lo apagado

El codigo apagado se conserva **y sigue probado**: cada suite que ejercita algo apagado (plantillas de reactivacion,
saldo o valle, compositor, paso 4) agrega **arriba** un `vi.mock` del modulo que enciende **solo lo que esa suite
prueba** (ej. `marketing-valley` enciende `valley` pero NO el paso 4, asi deja de recorrer los clientes de otras
suites). Es el unico cambio permitido en esas suites: **ningun `expect` se toca**. El implementador mide primero
que el `vi.mock` alcance a los imports relativos de dentro de `packages/domain` (un tick re-encendido que encola
es la prueba). Si no alcanza, se corta y va al orquestador, sin buscar otro mecanismo.

### 7. Limpieza de `ci-integration`

Los 99 turnos vivos historicos (campañas compositor «Vuelvan» de negocios `int-*`, medidos 2026-10-02): los borra
**el orquestador** con el OK del owner en ese momento (es SQL destructivo, aunque sea en la rama de pruebas). No es
trabajo del implementador.

## Archivos

| Archivo | Accion |
|---|---|
| `packages/domain/src/server/marketing/enabled-campaigns.ts` (+ `.test.ts`) | crear |
| `apps/merchant/src/server/marketing/template-store.ts` | editar (esta en el limite del hook `file-size`: si pasa, dividir) |
| `apps/merchant/src/server/marketing/campaign-store.ts`, `campaign-actions.ts` | editar |
| `apps/merchant/src/server/marketing/audience-store.ts`, `push-store.ts`, `tick.ts` | editar |
| `packages/domain/src/server/consumer/cross-offers.ts`, `valley-offers.ts` | editar |
| `apps/merchant/src/server/marketing-disabled.neon.integration.test.ts` | crear (oraculos de §2–§4 con el modulo REAL, sin mock) |
| suites que ejercitan lo apagado (hasta 46 archivos referencian esas claves; las que se pongan rojas) | solo el `vi.mock` de §6 |

**Disjunta?** Si. Toca solo la zona de servidor y paquetes (Claude, ADR 0114). La UI de GPT consume el contrato de §2.

## Definition of Done

- [ ] `enabled-campaigns.test.ts`: `welcome`/`cross` true; las otras 6 claves, `null` y `"nope"` false.
- [ ] `marketing-disabled.neon…` (modulo real), cada caso leido por SQL o por status HTTP:
  - `GET templates` → claves exactamente `["welcome","cross"]`;
  - `enable` de `missed_you` en un negocio **Plus** → 404 `not_found`, 0 filas `campaign` nuevas;
  - `POST campaigns` (compositor) en un negocio **Plus** → 409 `campaign_disabled`, 0 filas nuevas;
  - una campaña compositor sembrada `active` → `GET campaigns` no la lista y `GET campaigns/{id}` da 404;
  - tick con una compositor `active` + un dormido, una `missed_you` `active` con push + un dormido, y un consumidor
    con turno vivo y fila de `pass_placement`: **0** `campaign_turn` nuevos, **0** `campaign_push`,
    `consumers: 0`, y `pass_placement` de ese consumidor byte-identico;
  - una deteccion de valle vieja no se recalcula; `listCrossOffers` no trae ofertas `valley`.
- [ ] Las suites re-encendidas por `vi.mock` pasan **sin tocar ningun `expect`**: `git diff` de cada una muestra
      solo el bloque del mock (transcribir la lista).
- [ ] `tools/neon-test.sh src/server/marketing-valley.neon.integration.test.ts` en local: 3/3 verdes, cada uno < 180 s
      (era el rojo de la #67); transcribir los tiempos.
- [ ] `pnpm verify` en verde con Node 24, **una sola vez al final** (ADR 0113), con Neon completo (cambian
      muchas suites) y su tabla final transcripta.
- [ ] `rg -n MUTATION apps packages tools` → vacio.

## Mutaciones — presupuesto: 9. Clase: los plausibles (un punto de entrada que se olvida de preguntar)

Oraculo de todas: `marketing-disabled.neon.integration.test.ts` salvo que diga otra cosa. Negocio **Plus** en los
casos de API, para que el freno de plan (402, el guard hermano) no corte antes.

| # | Mutacion | Oraculo que tiene que ponerse ROJO |
|---|---|---|
| 1 | `listTemplates` sin el filtro | `GET templates` = `["welcome","cross"]` |
| 2 | `enableTemplate` sin el chequeo | `enable missed_you` → 404 |
| 3 | `createCampaign` sin el chequeo | `POST campaigns` → 409 |
| 4 | `getCampaign` sin el chequeo | `GET campaigns/{id}` de la compositor → 404 |
| 5 | `listCampaigns` sin el filtro | `GET campaigns` no la lista |
| 6 | `loadActiveCampaigns` sin el filtro | 0 `campaign_turn` nuevos |
| 7 | `loadPushCampaigns` sin el filtro | 0 `campaign_push` |
| 8 | el tick corre el paso 4 con el flag apagado | `consumers: 0` + `pass_placement` intacto |
| 9 | `listCrossOffers` suma valle apagado | sin ofertas `valley` |

**Protocolo:** el de la skill `protocolo-de-verificacion` — `shasum` limpio antes de mutar, fila de bitacora
**antes** de medir, etiqueta `MUTATION`, medir y transcribir, revertir con `diff`. De a una. Leer la asercion del rojo.

**Condicion de corte:** si dos vueltas seguidas terminan en «el fix abrio la siguiente», se corta y va al owner.

## Declarado AFUERA (sin oraculo, a proposito)

- `PATCH`/`activate`/`pause`/`end`/`archive`/`results` por id: heredan el 404 de `getCampaign` (M4 lo pinnea). No se
  muta cada uno.
- El refresco de valle apagado (§3) tiene su caso en la DoD, pero no tiene mutacion propia (presupuesto).
- El reclamo de valle apagado (§4): sin mutacion propia.
- Las campañas apagadas que queden `active` fuera de PROD (§5).
- Los 3 rojos nuevos de `marketing-refresh` en la corrida completa del 2026-10-02 (`PARQUEADO.md` #67): si siguen
  rojos al final, se transcriben y se declaran; no se persiguen en esta spec.

## Handoff

**UN implementador para toda la spec, UN revisor independiente al final** (ADR 0071). El revisor produce un `PASS`
con evidencia ejecutada antes de marcar `implementada`. Despues: §7 (con OK del owner) y push.

## Abierto

Nada.

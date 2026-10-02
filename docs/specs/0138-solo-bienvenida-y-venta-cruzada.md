---
spec: 0138
fecha: 2026-10-02
estado: cerrada
resumen: Spec 1 del ADR 0115. Un solo modulo decide que campañas existen (`welcome` y `cross`), el compositor libre y la proximidad apagados; la API los oculta y rechaza, el tick no corre las apagadas ni el paso 4 (resuelve la #67), y «Mis beneficios» deja de ofrecer valle. Codigo conservado; sus tests se saltean mientras este apagado (`skipIf` atado al mismo modulo), por decision del owner.
disjunta: si
archivos: packages/domain/src/server/marketing/enabled-campaigns.ts (crear), apps/merchant/src/server/marketing/{template-store,campaign-store,campaign-actions,audience-store,push-store,tick}.ts, packages/domain/src/server/consumer/{cross-offers,valley-offers}.ts, tests de lo apagado (solo el `skipIf`), un test de integracion nuevo
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
salteados mientras este apagado (owner: «si esta apagado no se prueba»); la limpieza de los turnos vivos historicos de `ci-integration`.

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

### 6. Los tests de lo apagado: se saltean, atados al modulo

Owner (2026-10-02, textual): «si esta apagado no se prueba, porque probar implica añadir tiempo de test a algo que
no se usa». Los tests **se conservan** (como el codigo) y **se saltean** con la condicion del mismo modulo:

```ts
describe.skipIf(!campaignKindEnabled("missed_you"))(…)        // o it.skipIf, si el archivo mezcla
describe.skipIf(!PROXIMITY_PLACEMENT_ENABLED)(…)               // paso 4
describe.skipIf(!COMPOSER_ENABLED)(…)                          // compositor
```

El dia que se re-encienda algo, sus tests vuelven a correr solos. **Las suites `.neon` ya usan
`describe.skipIf(!integrationEnabled)`**: la condicion se combina (`!integrationEnabled || !campaignKindEnabled(…)`).

**Que se saltea y que no — la regla es el TEMA del caso, no lo que siembra:**
- se saltea un caso cuyo **tema** es algo apagado: activar/correr/medir una plantilla apagada, el compositor, el
  paso 4, la deteccion y las ofertas de valle;
- **NO** se saltea un caso que solo **usa** una campaña apagada como fixture para probar algo vivo. Ejemplo medido:
  las suites `counter-coupon*` siembran una campaña compositor (`counter-coupon-support.ts:45-66`) para probar el
  canje del cupon en el mostrador, que sigue vivo (la Bienvenida y la cruzada emiten cupones). Esas suites siembran
  por SQL y no pasan por los guards de §2–§3, asi que siguen verdes sin tocarlas;
- si un caso de un tema VIVO (Bienvenida, cruzada, mostrador, lock, expirar/cancelar) se pone rojo por el apagado,
  **no se saltea**: se para y va al orquestador, porque acusa una dependencia que esta spec no previo.

El implementador entrega la **lista de casos salteados**, cada uno con la condicion que lo saltea. Es el unico
cambio permitido en esas suites: ningun `expect` se toca y ningun test se borra.

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
| suites cuyo tema es lo apagado (hasta 46 archivos referencian esas claves; el tema decide, §6) | solo el `skipIf` de §6 |

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
- [ ] La lista de casos salteados (§6), cada uno con su condicion; `git diff` de esas suites muestra solo el
      `skipIf` (ningun `expect` tocado, ningun test borrado).
- [ ] Ningun test vivo corre el paso 4: sobre el log de la corrida Neon completa,
      `grep '^marketing_tick ' LOG | grep -vc '"consumers":0,'` → **0**. (Probado que discrimina: sobre el log del
      2026-10-02, antes de la spec, da 41 de 70 lineas.)
- [ ] Tiempos de la suite Neon completa antes (~10 min, 2026-10-02) y despues, transcriptos. Es informativo, no un
      umbral.
- [ ] `pnpm verify` en verde con Node 24, **una sola vez al final** (ADR 0113), con Neon completo (cambian
      muchas suites) y su tabla final transcripta. Los `skipped` nuevos se cuentan y coinciden con la lista de §6.
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
- Los tests salteados se pudren en silencio mientras esten apagados (cambios de esquema, helpers): re-encender
  algo implica correr sus tests y arreglarlos. Es el costo aceptado por el owner a cambio del tiempo de test.
- Los 3 rojos nuevos de `marketing-refresh` en la corrida completa del 2026-10-02 (`PARQUEADO.md` #67): si siguen
  rojos al final, se transcriben y se declaran; no se persiguen en esta spec.

## Handoff

**UN implementador para toda la spec, UN revisor independiente al final** (ADR 0071). El revisor produce un `PASS`
con evidencia ejecutada antes de marcar `implementada`. Despues: §7 (con OK del owner) y push.

## Abierto

Nada.

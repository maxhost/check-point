---
spec: 0101
fecha: 2026-09-26
estado: anexo
resumen: Contrato VIGENTE de las 15 rutas de `/api/marketing/*` — las 10 del compositor
  custom (spec 0065, guards de la 0086), las 3 de plantillas de la 0101 (`GET templates`,
  `POST templates/{key}/enable`, `POST templates/{key}/disable`) y las 2 de horario de push de
  la 0103 (`GET`/`PATCH settings`) — mas el click publico `POST /api/public/push/click` (0103).
  Guard y `code` por paso, cuerpo/query, forma de la respuesta y errores, medido contra el
  codigo con `archivo:linea`. Incluye el flujo de una plantilla para quien construye la UI.
  Consolida las piezas de marketing de `0072-` y `0086-contratos-de-api.md`.
---

# 0101 — Contrato de API: `/api/marketing/*`

> **Entregable, no documentacion opcional** (ADR 0070 §16): la UI la construye el owner por
> fuera y este archivo es su insumo. Medido contra el codigo al cierre de la implementacion
> de la spec 0101, y re-medido al cierre de la 0103 (canal push: §2 `channels`, §3.5 bloque
> `push`, §4 canales y grupos, §8 `settings`, §9 click publico) y al de la **0104** (plantillas
> de saldo #7/#8: §2 campos de saldo, §3.5 `visited` por canje, §3.6 `activate` solo push, §4
> catalogo, grupo `balance`, cuerpo de `enable` y `409 no_loyalty_reward`). Las rutas son
> relativas a `apps/merchant/src/`.

## Convenciones

Las de `0099-contratos-de-api.md`: base `https://www.checkpass.club`,
`content-type: application/json`, cookie de sesion de better-auth, **ningun id de negocio
viaja en el request** (sale de la sesion: todas las rutas pasan `auth.business.id` al
dominio), y todo fallo responde `{ "error": "<español>", "code": "<estable>" }` — **el
`code` es el contrato, el `error` es copia**.

Tres formas de error, y solo tres:

- **Guard** (401/403): `{ error, code, suspensionReason? }` — `apiOwnerFailureResponse`
  (`server/api-owner.ts:246`).
- **Dominio** (`CampaignError`): `{ error, code, fields? }` con el status del error —
  `campaignError` (`app/api/marketing/_auth.ts:65-76`). `fields` viaja **solo** en un `400
  validation`: es `{ <campo>: "<mensaje>" }` para pintar el error junto al input.
- **Cualquier otra excepcion**: `503 { error: "<fallback>" }` **sin `code`**
  (`_auth.ts:75`). Nunca trae un host, un stack ni un nombre de constraint.

Un cuerpo que no es JSON en una ruta que lo lee → `400 invalid_body` (`readJson`,
`_auth.ts:78-84`). Las fechas viajan como ISO-8601 (`Date` serializado).

---

## 1. Guards: dos escaleras

**Delegable — `requireMarketingOwner`** (`app/api/marketing/_auth.ts:25-38`), que es
`requireApiPermission(request, "marketing")` (`server/api-permission.ts:91-112`):

| Paso | Pregunta | `code` | Status |
|---|---|---|---|
| 1 | ¿hay sesion? | `unauthorized` | 401 |
| 2 | ¿membresia ACTIVA del negocio? | `not_member` | 403 |
| 3 | ¿owner, o staff con el permiso `marketing`? | `missing_permission` | 403 |
| 4 | ¿email verificado? — solo si `role === "owner"` | `email_not_verified` | 403 |
| 5 | ¿el negocio OPERA? | `business_suspended` \| `business_closed` | 403 |

**Owner-only — `requireCampaignOwner`** (`_auth.ts:48-61`), que es `requireApiOwner`
(`server/api-owner.ts:75-126`). Para lo IRREVERSIBLE (ADR 0079 §2):

| Paso | Pregunta | `code` | Status |
|---|---|---|---|
| 1 | ¿hay sesion? | `unauthorized` | 401 |
| 2 | ¿es owner ACTIVO del negocio? | `not_owner` | 403 |
| 3 | ¿email verificado? | `email_not_verified` | 403 |
| 4 | ¿el negocio OPERA? | `business_suspended` \| `business_closed` | 403 |

`suspensionReason` viaja solo en `business_suspended` y solo al owner
(`server/business-status.ts:24`, `:57-60`).

| # | Ruta | Guard | Por que |
|---|---|---|---|
| 1 | `GET /api/marketing/campaigns` | delegable | lectura |
| 2 | `POST /api/marketing/campaigns` | delegable | crear borrador |
| 3 | `GET /api/marketing/campaigns/{id}` | delegable | lectura |
| 4 | `PATCH /api/marketing/campaigns/{id}` | delegable | editar borrador/pausada |
| 5 | `GET /api/marketing/campaigns/{id}/results` | delegable | lectura |
| 6 | `POST /api/marketing/campaigns/{id}/activate` | delegable | reversible |
| 7 | `POST /api/marketing/campaigns/{id}/pause` | delegable | reversible |
| 8 | `POST /api/marketing/campaigns/{id}/end` | **owner-only** | irreversible |
| 9 | `POST /api/marketing/campaigns/{id}/archive` | **owner-only** | irreversible |
| 10 | `GET /api/marketing/audience-preview` | delegable | lectura |
| 11 | `GET /api/marketing/templates` | delegable | lectura |
| 12 | `POST /api/marketing/templates/{key}/enable` | delegable | crear+activar ya lo son |
| 13 | `POST /api/marketing/templates/{key}/disable` | **owner-only** | apagar = `end` |
| 14 | `GET /api/marketing/settings` | delegable | lectura (spec 0103) |
| 15 | `PATCH /api/marketing/settings` | delegable | horario de push, reversible (spec 0103) |

Las acciones 6-9 son una sola fabrica: el guard sale de la accion
(`ACCIONES_SOLO_DEL_OWNER`, `_auth.ts:100-103`; `campaignActionRoute`, `_auth.ts:105-123`).
La 13 usa `requireCampaignOwner` directo
(`app/api/marketing/templates/[key]/disable/route.ts:15`). El conjunto owner-only esta
aseverado en `server/marketing-routes.test.ts` (rama `ownerOnly` del caso «un STAFF con el
permiso `marketing` entra, salvo en lo irreversible»). La lista de las 15 es
`MARKETING_ROUTE_NAMES` (`server/marketing-route-names.ts`), contrastada contra el
filesystem por `server/marketing-routes-coverage.test.ts`.

---

## 2. El DTO `Campaign`

Lo devuelven las rutas 1-4, 6-9, 11 (`live`), 12 y 13. Tipo en
`server/marketing/campaign-store.ts:37-66`, columnas en `:68-90`, armado en `toCampaign`
(`:93-103`):

```jsonc
{
  "id": "uuid",
  "templateKey": null,              // "missed_you" | "win_back" | "near_reward" | "unclaimed_reward" | null (custom) — specs 0101/0104
  "channels": ["proximity"],        // spec 0103: ["proximity"] | ["push"] | ["proximity","push"], en ese orden
  "name": "Te extrañamos",
  "status": "active",               // draft | active | paused | ended | archived
  "pauseReason": null,              // null | owner | plan_downgraded | no_active_locations
  "dormantDays": 30,
  "message": "Hace rato no te vemos. ¡Te esperamos!",
  "couponLabel": null,              // el cupon es TODO O NADA: label, cost y max juntos
  "couponCost": null,               // string decimal "2.50" (numeric), nunca float
  "couponMaxRedemptions": null,
  "couponProductId": null,
  "nearRewardStamps": null,         // spec 0104: solo #7 (1 | 2 | 3); null en toda otra campaña
  "nearRewardPercent": null,        // spec 0104: solo #7 (10 | 20); null en toda otra campaña
  "rewardRepeat": null,             // spec 0104: solo #8 ("once" | "every_30_days"); null en toda otra
  "startsAt": "2026-09-26T12:00:00.000Z",
  "endsAt": null,
  "activatedAt": "2026-09-26T12:00:00.000Z",  // la PRIMERA activacion; reanudar no la pisa
  "endedAt": null,
  "createdAt": "2026-09-26T12:00:00.000Z",
  "locationIds": ["uuid"]
}
```

`templateKey` siempre viaja (con `null` en las custom): la columna esta en `columns`. Los tres
campos de saldo (spec 0104) siempre viajan: con valor **solo** en su plantilla (#7 lleva los
DOS umbrales, #8 la repeticion) y `null` en todo lo demas — lo fija el
`CHECK core_campaign_balance_shape_check` (migracion `0047`).
`channels` (spec 0103) siempre viaja y nunca es vacio (`CHECK core_campaign_channel_check`);
sale de las columnas `channel_proximity`/`channel_push` (`channelsOf`,
`server/marketing/campaign-values.ts`). **El compositor custom siempre crea `["proximity"]`** y
`POST`/`PATCH /api/marketing/campaigns` no aceptan canales (una clave `channels` se ignora):
el push es solo de plantillas (decision del owner, ADR 0095).

---

## 3. Compositor custom (rutas 1-10)

### 3.1 `GET /api/marketing/campaigns`

`app/api/marketing/campaigns/route.ts:11-21`. Sin query. `200 { "campaigns": Campaign[] }`,
todas las del negocio (custom y de plantilla), `createdAt` desc
(`campaign-store.ts:152-162`). Errores: guard; `503`.

### 3.2 `POST /api/marketing/campaigns`

`campaigns/route.ts:24-37` → `createCampaign` (`campaign-store.ts:177-224`). Crea un
**`draft`**. `201 { "campaign": Campaign }`. **Siempre** `templateKey: null`: una clave
`templateKey` en el cuerpo se ignora.

Cuerpo (`parseCampaignInput`, `server/marketing/campaign-input.ts:169-222`):

| Campo | Tipo | Regla |
|---|---|---|
| `name` | string | 1..80 tras `trim` (`:173`) |
| `message` | string | 1..60 tras `trim` (`:174`) |
| `dormantDays` | entero | 7..365; default `30` (`:175-182`) |
| `startsAt` | fecha ISO | **obligatorio** (`:183-188`) |
| `endsAt` | fecha ISO \| `null` | opcional; posterior a `startsAt` (`:189-194`). **Obligatorio si hay cupon** (spec 0102 / ADR 0094): sin el → `400 validation`, `fields.endsAt` = «Una campaña con cupón necesita fecha de fin.» (`requireEndForCoupon`) |
| `locationIds` | uuid[] | al menos uno; duplicados colapsan (`:157-167`) |
| `couponLabel`, `couponCost`, `couponMaxRedemptions` | string 1..40, numero ≥ 0, entero 1..1.000.000 | **los tres o ninguno** (`parseCoupon`, `:103-155`) |
| `couponProductId` | uuid \| `null` | opcional, informativo |

Orden de errores: `400 invalid_body` → `400 validation` (`fields`) → `402 plan_not_allowed`
(`campaign-store.ts:196-201`) → `400 validation` en `locationIds` si algun local no es del
negocio (`:132-135`) → `503`.

### 3.3 `GET /api/marketing/campaigns/{id}`

`campaigns/[id]/route.ts:11-25`. `200 { "campaign": Campaign }`. Una campaña de OTRO negocio
es **`404 not_found`**, nunca 403 (`getCampaign`, `campaign-store.ts:164-175`, `:173`).

### 3.4 `PATCH /api/marketing/campaigns/{id}`

`campaigns/[id]/route.ts:28-46` → `updateCampaign` (`campaign-store.ts:240-287`). Cuerpo:
cualquier subconjunto de las claves de 3.2; lo ausente se conserva, y si nombra **alguna**
clave del cupon lo reemplaza entero (`parseCampaignPatch`, `campaign-input.ts:225-259`).
Se re-valida con las reglas de 3.2 sobre el resultado: quitar el `endsAt` de una campaña que
conserva su cupon es `400 validation` en `endsAt` (spec 0102).
`200 { "campaign": Campaign }`.

Orden de errores: `400 invalid_body` → `404 not_found` → **`409 template_not_editable`** si
la campaña tiene `templateKey`, en CUALQUIER estado, pausada incluida (spec 0101;
`assertNotTemplate`, `campaign-store.ts:231-238`, llamado en `:246`) → `409 not_editable`
si no esta en `draft`/`paused` (`:247-252`, `campaign-transitions.ts:52`) → `400 validation`
→ `400 validation` en `locationIds` (local ajeno) → `503`.

### 3.5 `GET /api/marketing/campaigns/{id}/results`

`campaigns/[id]/results/route.ts:14-32`. Lee la campaña primero (`404 not_found` si es
ajena) y despues `loadCampaignResults` (`server/marketing/results-store.ts:195`).
`200 { "results": CampaignResults }`, tipo en `server/marketing/results.ts:139-153`:
`audience`, `turns`, `windowPurchases`, `effect`, `coupon`, `byLocation`, `passReach`, `push`,
cada bloque con su `quality` (`observada | estimada | estimado_configurado | no_disponible`,
`results.ts:28-32`). Sirve igual para una corrida de plantilla.

**Bloque `push` (spec 0103, `results.ts:95-121`, SQL en
`server/marketing/push-results-store.ts:14`):** `null` si la campaña no tiene el canal push
(toda campaña custom, y una plantilla encendida solo por proximidad). Si lo tiene:

```jsonc
"push": {
  "quality": "observada",
  "decided": 7,        // envios decididos por el tick (holdout incluido)
  "held": 2,           // holdout: grupo de control, nunca se envia
  "pending": 1,        // no holdout, ni enviado ni cancelado todavia (en cola)
  "sent": 3,
  "cancelled": { "campaign_inactive": 0, "membership_gone": 0, "opt_out": 0, "visited": 1 },  // visited = compra O canje (0104)
  "clicked": 1,        // SOLO Web Push: el pase de Wallet no informa aperturas
  "conversion": {
    "windowDays": 7,
    "sent": { "purchases": 1, "of": 2 },  // enviados con sent_at + 7 d <= ahora
    "held": { "purchases": 1, "of": 2 }   // holdout con decided_at + 7 d <= ahora
  },
  "effect": { "quality": "no_disponible", "holdoutN": 2, "needed": 30 }
}
```

`visited` (el chequeo del worker al entregar, `server/marketing/push-delivery.ts:94-101`) =
una compra del consumidor en el negocio **o un canje de premio de la membresia**
(`core.reward_redemption`) posterior a la decision — spec 0104 / ADR 0096 §5, para TODAS las
plantillas.

«Compro» = una compra en el negocio dentro de `(t0, t0 + 7 d]`, `t0` = `sent_at` (enviados) o
`decided_at` (holdout); solo cuentan los que ya cumplieron sus 7 dias. `effect` es el mismo
`estimateEffect` de la proximidad (`{ quality: "estimada", extraCustomers }` con 30 holdout o
mas; si no, `no_disponible`). Los canjes de cupones emitidos por push ya suman en el bloque
`coupon` (cuenta por `campaign_id`).

### 3.6 Acciones: `POST /api/marketing/campaigns/{id}/{activate|pause|end|archive}`

`campaignActionRoute` (`_auth.ts:105-123`) → `transitionCampaign`
(`server/marketing/campaign-actions.ts:45-127`). Sin cuerpo (lo que venga se ignora).
`200 { "campaign": Campaign, "notice"?: string }`; `notice` viaja en `pause` y `end`:
`"Los turnos activos se retiran en el próximo refresco."` (`campaign-actions.ts:17-18`).

Tabla de transiciones (`campaign-transitions.ts:27-35`): `activate` desde `draft`/`paused`;
`pause` desde `active`; `end` desde `active`/`paused`; `archive` desde `ended`/`paused`.

Errores: guard (8-9 con `not_owner`) → `404 not_found` → `409 invalid_transition`
(`campaign-actions.ts:53-58`) → solo `activate`: `402 plan_not_allowed` (`:65-70`),
`409 no_usable_location` (`:71-81`) **solo si la campaña tiene el canal `proximity`** (spec
0104: una corrida solo push —#7/#8 siempre— se reanuda sin locales), `409 campaign_expired`
(`:94-99`) → `503`. Aplican igual a una corrida de plantilla (pausar y reanudar una plantilla
SI se puede).

### 3.7 `GET /api/marketing/audience-preview?dormantDays=&locationIds=`

`app/api/marketing/audience-preview/route.ts:12-23` →
`parseAudiencePreviewQuery` (`server/marketing/audience-preview.ts:67-92`) y
`previewAudience` (`:126-158`). Query: `dormantDays` entero 7..365 (obligatorio),
`locationIds` uuids separados por coma (puede ir vacio). Errores: `400 validation` con
`fields.dormantDays` / `fields.locationIds`; `503`.

`200 { "preview": { quality: "observada", total, reachable, noLocation, optOut, cooldown,
eligible, usableLocationIds } }` (`audience-preview.ts:42-56`). `eligible` = cuantos
recibirian turno si el tick corriera ahora; `usableLocationIds` = de los locales pedidos,
los del negocio `active` y geocodificados, ordenados por id.

---

## 4. Plantillas (rutas 11-13) — spec 0101

Catalogo en codigo (`server/marketing/templates.ts:71-151`), en este orden:

| `key` | `title` | `channels` | `group` / `rank` | `dormantDays.options` | `default` | `message.default` | `couponRecommended` / `couponAllowed` |
|---|---|---|---|---|---|---|---|
| `missed_you` | Te extrañamos | `["proximity","push"]` | `reactivation` / 1 | `[14, 30]` | `30` | `Hace rato no te vemos. ¡Te esperamos!` | `false` / `true` |
| `win_back` | Recuperar perdidos | `["proximity","push"]` | `reactivation` / 2 | `[60, 90, 180]` | `90` | `¡Volvé! Te estamos esperando.` | `true` / `true` |
| `near_reward` | Te falta poco | `["push"]` | `balance` / 1 | `[3, 7, 14]` | `7` | `¡Estás a {faltan} de tu premio!` | `false` / `false` |
| `unclaimed_reward` | Premio sin canjear | `["push"]` | `balance` / 2 | `[7, 14, 30]` | `14` | `Tenés un premio esperándote. ¡Vení a canjearlo!` | `false` / `false` |

Todas llevan `message.maxLength: 60` y `message.gapMarker` (`true` solo en `near_reward`: su
mensaje admite —y EXIGE— el marcador `{faltan}`), `channels` (los canales que ofrece la
plantilla; spec 0103 — **reemplaza al `channel: "proximity"` de la 0101, que ya no viaja**),
`group` y `rank`. Campos de la 0104: `couponAllowed` (`false` → `enable` rechaza el cupon),
`nearReward` (solo #7: `{ "stamps": { "options": [1,2,3], "default": 2 }, "pointsPercent": {
"options": [10,20], "default": 20 } }`, `null` en las demas) y `repeat` (solo #8: `{ "options":
["once","every_30_days"], "default": "once" }`, `null` en las demas). Los textos
(`description`, `message.default`) cambian sin spec.

**Grupos (ADR 0095 §5, solo canal push):** una plantilla no le envia un push a un cliente que,
desde su ultima visita (ultima compra, o el alta si nunca compro), ya tiene un push no
cancelado —holdout incluido— de ella misma o de una de rango MAYOR del mismo grupo
(`templateKeysAtOrAbove`, `templates.ts:163-170`): escala #3 → #5 y #7 → #8, nunca al reves.
Los grupos no se mezclan: sin tope global (owner), un cliente puede recibir en la misma
ausencia un push de SALDO y uno de REACTIVACION del mismo negocio.

**Saldo (#7/#8, spec 0104 / ADR 0096):** la audiencia es la de dormidos MAS el saldo contra el
premio mas barato del programa OPERATIVO del negocio (el mismo costo que la bolsa de utilidad
del pase: Sellos = `configuration.target`, Puntos = el `points_cost` minimo); solo cuentan las
membresias de ese programa. **#7** = le falta poco (Sellos: faltan ≤ N; Puntos: faltante ≤ P %
del costo — la corrida guarda los dos umbrales y el tick aplica el del tipo de programa), una
vez por ciclo de canje (una visita no abre ciclo nuevo; un canje si); el `{faltan}` se
reemplaza por el faltante de CADA cliente al decidir («2 sellos», «1 sello», «15 puntos»,
«1 punto»). **#8** = ya tiene el premio; `once` = un push por ausencia, `every_30_days` = hasta
2 por ausencia separados por ≥ 30 dias. Ninguna de las dos lleva cupon.

Las claves estan fijadas tambien por el `CHECK core_campaign_template_key_check` (migraciones
`0044`, `0047`). Una sola corrida viva (`draft`/`active`/`paused`) por negocio y plantilla,
garantizada por el unico parcial `core_campaign_template_live_unique`
(`server/schema/campaign.ts`).

### 4.1 `GET /api/marketing/templates`

`app/api/marketing/templates/route.ts:9-19` → `listTemplates`
(`server/marketing/template-store.ts:244-287`). Sin query.
`200 { "templates": TemplateView[] }`, en el orden del catalogo:

```jsonc
{
  "templates": [
    {
      "key": "missed_you",
      "title": "Te extrañamos",
      "description": "Le recuerda tu local a los clientes que hace un tiempo no vienen, cuando pasan cerca.",
      "channels": ["proximity", "push"],   // spec 0103: los que la plantilla ofrece
      "group": "reactivation",
      "rank": 1,
      "dormantDays": { "options": [14, 30], "default": 30 },
      "message": { "default": "Hace rato no te vemos. ¡Te esperamos!", "maxLength": 60, "gapMarker": false },
      "couponRecommended": false,
      "couponAllowed": true,       // spec 0104
      "nearReward": null,          // spec 0104: objeto solo en near_reward (ver §4)
      "repeat": null,              // spec 0104: objeto solo en unclaimed_reward (ver §4)
      "live": null,          // o el DTO Campaign COMPLETO (§2) de la corrida viva — su `channels` son los ELEGIDOS
      "runs": [              // corridas anteriores: ended | archived
        { "id": "uuid", "status": "ended",
          "activatedAt": "2026-09-01T12:00:00.000Z", "endedAt": "2026-09-20T12:00:00.000Z" }
      ]
    }
  ]
}
```

`runs`: `activatedAt` desc (nulos al final), maximo 10 (`template-store.ts:23-24`, `:263`).
Tipo `TemplateView` en `template-store.ts:34-37`. Errores: guard; `503`.

### 4.2 `POST /api/marketing/templates/{key}/enable`

`app/api/marketing/templates/[key]/enable/route.ts:12-30` → `enableTemplate`
(`template-store.ts:127-225`). Crea la corrida **ya `active`** (`activatedAt = ahora`,
`name = title`, `kind = proximity` — el `kind` es la AUDIENCIA, no el canal). `201 { "campaign": Campaign }`.

Cuerpo JSON (**`{}` es valido**; un POST sin cuerpo es `400 invalid_body`). Todo opcional
(`parseTemplateInput`, `server/marketing/template-input.ts:149-201`; la mitad de saldo en
`server/marketing/balance-input.ts`):

| Campo | Regla | Default |
|---|---|---|
| `channels` | arreglo NO vacio de `"proximity"`/`"push"`, sin repetidos (`:106-133`). `[]`, `["sms"]`, `["push","push"]`, un string → `400 validation`, `fields.channels` = «Elegí al menos un canal válido.» — spec 0103. Un canal que la plantilla NO ofrece (`["proximity"]` en #7/#8) → `400 validation`, `fields.channels` — spec 0104 | los `channels` **de la plantilla** (ausente o `null`): `["proximity","push"]` en #3/#5, `["push"]` en #7/#8 |
| `dormantDays` | entero **dentro de `options`** de la plantilla (`:57-72`) | `default` |
| `message` | 1..60 tras `trim`, medido sobre el texto CRUDO (con el marcador) (`:74-90`). **#7: tiene que incluir `{faltan}`** (sin el → `400`, `fields.message` = «El mensaje tiene que incluir {faltan}.»); **en #3/#5/#8 `{faltan}` → `400`**, `fields.message` = «El marcador {faltan} solo vale en «Te falta poco».» (`balance-input.ts:18-33`) | `message.default` |
| `excludedLocationIds` | uuid[]; duplicados colapsan (`:92-102`) | `[]` |
| `couponLabel`, `couponCost`, `couponMaxRedemptions`, `couponProductId` | **las mismas reglas que el compositor** (`parseCoupon`, `campaign-input.ts:103`). **En #7/#8 (`couponAllowed: false`) cualquiera de los tres primeros → `400`**, `fields.couponLabel` = «Esta campaña no lleva cupón.» (`balance-input.ts:98-110`) | sin cupon |
| `nearRewardStamps` | solo #7: `1` \| `2` \| `3`; otro valor → `400`, `fields.nearRewardStamps` | `2` |
| `nearRewardPercent` | solo #7: `10` \| `20`; otro valor → `400`, `fields.nearRewardPercent` | `20` |
| `rewardRepeat` | solo #8: `"once"` \| `"every_30_days"`; otro valor → `400`, `fields.rewardRepeat` | `"once"` |
| `startsAt` | fecha ISO | ahora |
| `endsAt` | fecha ISO \| `null`; posterior a `startsAt`; **obligatorio si hay cupon** (spec 0102: sin el → `400 validation`, `fields.endsAt`) | `null` |

Cualquier otra clave (`templateKey`, `name`, `locationIds`, un id de negocio) se ignora — y
tambien un campo de saldo en una plantilla que no lo declara (`rewardRepeat` en #7,
`nearRewardStamps` en #3…): se ignora y se guarda `null`.
**Locales:** todos los del negocio `active` y con `latitude`/`longitude`, **menos** los
excluidos (`runDoors`, `template-store.ts:87-123`); quedan fijos para esa corrida. Son de la
PROXIMIDAD: una corrida **solo push** no necesita ninguno — sin locales usables se crea igual,
sin filas en `campaign_location` (`:211-216`), y el `409 no_usable_location` aplica solo si
`channels` incluye `"proximity"` (`:168`).

Orden de errores:

| # | Condicion | Status | `code` | Donde |
|---|---|---|---|---|
| 0 | guard | 401/403 | §1 delegable | `enable/route.ts:16` |
| 1 | cuerpo no JSON | 400 | `invalid_body` | `_auth.ts:78-84` |
| 2 | `key` fuera del catalogo | 404 | `not_found` | `template-store.ts:135` |
| 3 | cuerpo invalido (incluye `channels`, cupon en #7/#8, umbrales/repeticion, `{faltan}`) | 400 | `validation` (+`fields`) | `:137-143` |
| 4 | el plan no incluye campañas | 402 | `plan_not_allowed` | `:148-153` |
| 4b | **#7/#8 y el negocio no tiene programa operativo (`active`/`closing`) con un premio de costo usable** — spec 0104 | 409 | `no_loyalty_reward` — `error` = «No se puede activar: necesitás un programa de fidelización con un premio.» **La UI lo muestra en un toast con ese motivo** (owner) | `:156-164` (`loadRewardCost`, `balance-store.ts`) |
| 5 | un excluido no es local del negocio | 400 | `validation`, `fields.excludedLocationIds` | `:103-109` (en `runDoors`) |
| 6 | incluye `"proximity"` y no queda ningun local usable | 409 | `no_usable_location` | `:168-173` |
| 7 | `endsAt` ya paso | 409 | `campaign_expired` | `:174-179` |
| 8 | ya hay una corrida viva de esa plantilla | 409 | `template_already_live` | `:184-185` (select) y `:220` (`23505` del unico parcial, dos requests simultaneas) |
| — | otra falla | 503 | (sin `code`) | `_auth.ts:75` |

### 4.3 `POST /api/marketing/templates/{key}/disable`

`app/api/marketing/templates/[key]/disable/route.ts:11-23` → `disableTemplate`
(`template-store.ts:227-242`). **Owner-only.** Sin cuerpo. Apagar = **FINALIZAR** la
corrida viva (`transitionCampaign(…, "end")`): es irreversible; volver a encender crea otra.
`200 { "campaign": Campaign, "notice": "Los turnos activos se retiran en el próximo refresco." }`.

| # | Condicion | Status | `code` |
|---|---|---|---|
| 0 | guard (un integrante con permiso `marketing` → `not_owner`) | 401/403 | §1 owner-only |
| 1 | `key` fuera del catalogo | 404 | `not_found` (`template-store.ts:232`) |
| 2 | no hay corrida viva | 404 | `template_not_live` (`:234-239`) |
| 3 | la corrida esta en `draft` (no ocurre por construccion) | 409 | `invalid_transition` |
| — | otra falla | 503 | (sin `code`) |

### 4.4 Solapamiento

Con dos campañas activas del mismo negocio que califican al mismo consumidor, **gana la de
mayor `dormantDays`**: el tick las evalua en orden `dormant_days desc, created_at asc, id asc`
(`loadActiveCampaigns`, `server/marketing/audience-store.ts:76-80`) y la primera se queda con
el turno. Rige para todas, custom incluidas (ADR 0092 §6). Una campaña **solo push** no
entra a ese paso (`audience-store.ts:68`): no encola turnos ni escribe foto de audiencia.
El canal push tiene su propio orden y su propia regla (grupos, §4): el tick evalua las
campañas push por `rank` desc y la de rango mayor decide primero (spec 0103).

---

## 5. Flujo de una plantilla (para la UI)

1. **Tarjetas:** `GET /api/marketing/templates` → texto, opciones, defaults, `live` (si esta
   encendida) y `runs` (corridas anteriores).
2. **«Hoy son N personas»:** `GET /api/marketing/audience-preview?dormantDays=<d>&locationIds=<ids>`
   con los locales del negocio (`GET /api/locations`) menos los que el comercio destildo.
   Mirar `preview.eligible` (o `reachable` para el alcance total).
3. **Toggle ON:** `POST /api/marketing/templates/{key}/enable` con `{}` o los parametros
   elegidos → `201`, queda `active`. Si ya estaba encendida: `409 template_already_live`.
   El editor ofrece los `channels` de la plantilla (#3/#5: proximidad, push o ambos, `{}` =
   ambos; #7/#8: solo push, `{}` = push). Con solo `["push"]` no hace falta ningun local con
   mapa. #7/#8 sin programa con premio: `409 no_loyalty_reward` → **toast con el `error`**
   (dice el motivo). El editor de #7 tiene que conservar `{faltan}` en el mensaje.
4. **Toggle OFF:** `POST /api/marketing/templates/{key}/disable` → `200`, queda `ended`. Solo
   el owner (`403 not_owner` para un integrante: la UI deberia ocultar el toggle OFF). Volver
   a encender crea otra corrida; la vieja pasa a `runs`.
5. **Resultados de una corrida** (viva o de `runs`):
   `GET /api/marketing/campaigns/{id}/results` (§3.5), con el bloque `push` si tiene el canal.
6. **Horario de los push de campaña del negocio:** `GET`/`PATCH /api/marketing/settings` (§8).

Una corrida de plantilla **no se edita** (`PATCH` → `409 template_not_editable`): cambiar un
parametro es apagar y encender. Pausar/reanudar con las acciones de §3.6 si se puede.

---

## 6. Rutas vecinas, por remision (sin contrato aca)

- `POST /api/public/push/click` — **tiene contrato aca, §9** (no es de la UI: lo llama el
  service worker).
- `POST /api/counter/coupon-redeem` — el canje del cupon en caja (dominio del mostrador).
- `POST /api/public/consumer/marketing-opt-out` — la baja de promociones del consumidor.
- `/api/internal/marketing-tick` — el tick (cron), autenticado por secreto, no por sesion.

## 7. Procedencia

Consolida lo de marketing de `0072-contratos-de-api.md` (codes del gate y `plan_not_allowed`)
y `0086-contratos-de-api.md` (permiso `marketing`, `archive`/`end` owner-only), y agrega las
rutas 11-13 de la spec 0101 y 14-15 + el click publico de la spec 0103. Ante una
discrepancia, este anexo es el vigente por fecha.

---

## 8. Horario de push: `GET`/`PATCH /api/marketing/settings` — spec 0103

`app/api/marketing/settings/route.ts:14-24` (`GET`) y `:26-39` (`PATCH`) →
`loadMarketingSettings` / `updateMarketingSettings` (`server/marketing/push-settings.ts:44`,
`:64`). Guard **delegable** (§1). Siempre el negocio de la SESION: un id de negocio en el
cuerpo se ignora.

`200` (las dos):

```jsonc
{ "settings": { "pushWindow": { "startHour": 9, "endHour": 21 }, "timeZone": "America/Guayaquil" } }
```

Es el horario `[startHour, endHour)`, en horas enteras y en la `timeZone` del negocio, en el
que puede salir un push de CAMPAÑA (default 9–21). Un aviso decidido fuera de horario espera al
proximo `startHour`; uno que llega al worker fuera de horario se reprograma, no se envia.

`PATCH` cuerpo: `{ "pushWindow": { "startHour": <entero 0..23>, "endHour": <entero 1..24> } }`
con `startHour < endHour` (`parsePushWindowPatch`, `push-settings.ts:25`; el mismo rango lo
fija `CHECK core_business_push_window_check`).

| # | Condicion | Status | `code` |
|---|---|---|---|
| 0 | guard | 401/403 | §1 delegable |
| 1 | cuerpo no JSON (`PATCH`) | 400 | `invalid_body` |
| 2 | no entero, fuera de rango o `start >= end` | 400 | `validation`, `fields.pushWindow` |
| — | otra falla | 503 | (sin `code`) |

---

## 9. Click de un push: `POST /api/public/push/click` — spec 0103

`app/api/public/push/click/route.ts:14-30` → `recordPushClick`
(`server/marketing/push-delivery.ts:205`). **Sin sesion**: lo llama el service worker
(`public/sw.js:26-53`) al tocar una notificacion Web Push de campaña, con el `clickId` que
viaja en el payload (`WebPushPayload.clickId`, `server/push/webpush-channel.ts:18-25`). La UI
no lo llama.

Cuerpo: `{ "id": "<uuid del envio>" }`. Marca `clicked_at` la PRIMERA vez y solo si el envio
salio (`sent_at` no nulo).

| Condicion | Status | Cuerpo |
|---|---|---|
| `id` es un uuid (exista o no: no revela ids) | **204** | vacio |
| cuerpo no JSON, sin `id` o `id` no uuid | 400 | `{ "error", "code": "invalid_body" }` |

Solo Web Push registra clicks: el pase de Apple/Google Wallet no informa aperturas.

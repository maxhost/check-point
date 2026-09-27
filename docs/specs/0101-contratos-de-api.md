---
spec: 0101
fecha: 2026-09-26
estado: anexo
resumen: Contrato VIGENTE de las 13 rutas de `/api/marketing/*` — las 10 del compositor
  custom (spec 0065, guards de la 0086) y las 3 de plantillas de la 0101 (`GET templates`,
  `POST templates/{key}/enable`, `POST templates/{key}/disable`). Guard y `code` por paso,
  cuerpo/query, forma de la respuesta y errores, medido contra el codigo con `archivo:linea`.
  Incluye el flujo de una plantilla para quien construye la UI. Consolida las piezas de
  marketing de `0072-` y `0086-contratos-de-api.md`.
---

# 0101 — Contrato de API: `/api/marketing/*`

> **Entregable, no documentacion opcional** (ADR 0070 §16): la UI la construye el owner por
> fuera y este archivo es su insumo. Medido contra el codigo al cierre de la implementacion
> de la spec 0101. Las rutas son relativas a `apps/merchant/src/`.

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

Las acciones 6-9 son una sola fabrica: el guard sale de la accion
(`ACCIONES_SOLO_DEL_OWNER`, `_auth.ts:100-103`; `campaignActionRoute`, `_auth.ts:105-123`).
La 13 usa `requireCampaignOwner` directo
(`app/api/marketing/templates/[key]/disable/route.ts:15`). El conjunto owner-only esta
aseverado en `server/marketing-routes.test.ts` (rama `ownerOnly` del caso «un STAFF con el
permiso `marketing` entra, salvo en lo irreversible»). La lista de las 13 es
`MARKETING_ROUTE_NAMES` (`server/marketing-route-names.ts`), contrastada contra el
filesystem por `server/marketing-routes-coverage.test.ts`.

---

## 2. El DTO `Campaign`

Lo devuelven las rutas 1-4, 6-9, 11 (`live`), 12 y 13. Tipo en
`server/marketing/campaign-store.ts:36-59`, columnas en `:62-79`:

```jsonc
{
  "id": "uuid",
  "templateKey": null,              // "missed_you" | "win_back" | null (custom) — spec 0101
  "name": "Te extrañamos",
  "status": "active",               // draft | active | paused | ended | archived
  "pauseReason": null,              // null | owner | plan_downgraded | no_active_locations
  "dormantDays": 30,
  "message": "Hace rato no te vemos. ¡Te esperamos!",
  "couponLabel": null,              // el cupon es TODO O NADA: label, cost y max juntos
  "couponCost": null,               // string decimal "2.50" (numeric), nunca float
  "couponMaxRedemptions": null,
  "couponProductId": null,
  "startsAt": "2026-09-26T12:00:00.000Z",
  "endsAt": null,
  "activatedAt": "2026-09-26T12:00:00.000Z",  // la PRIMERA activacion; reanudar no la pisa
  "endedAt": null,
  "createdAt": "2026-09-26T12:00:00.000Z",
  "locationIds": ["uuid"]
}
```

`templateKey` siempre viaja (con `null` en las custom): la columna esta en `columns`.

---

## 3. Compositor custom (rutas 1-10)

### 3.1 `GET /api/marketing/campaigns`

`app/api/marketing/campaigns/route.ts:11-21`. Sin query. `200 { "campaigns": Campaign[] }`,
todas las del negocio (custom y de plantilla), `createdAt` desc
(`campaign-store.ts:134-147`). Errores: guard; `503`.

### 3.2 `POST /api/marketing/campaigns`

`campaigns/route.ts:24-37` → `createCampaign` (`campaign-store.ts:165-212`). Crea un
**`draft`**. `201 { "campaign": Campaign }`. **Siempre** `templateKey: null`: una clave
`templateKey` en el cuerpo se ignora.

Cuerpo (`parseCampaignInput`, `server/marketing/campaign-input.ts:169-222`):

| Campo | Tipo | Regla |
|---|---|---|
| `name` | string | 1..80 tras `trim` (`:173`) |
| `message` | string | 1..60 tras `trim` (`:174`) |
| `dormantDays` | entero | 7..365; default `30` (`:175-182`) |
| `startsAt` | fecha ISO | **obligatorio** (`:183-188`) |
| `endsAt` | fecha ISO \| `null` | opcional; posterior a `startsAt` (`:189-194`) |
| `locationIds` | uuid[] | al menos uno; duplicados colapsan (`:157-167`) |
| `couponLabel`, `couponCost`, `couponMaxRedemptions` | string 1..40, numero ≥ 0, entero 1..1.000.000 | **los tres o ninguno** (`parseCoupon`, `:103-155`) |
| `couponProductId` | uuid \| `null` | opcional, informativo |

Orden de errores: `400 invalid_body` → `400 validation` (`fields`) → `402 plan_not_allowed`
(`campaign-store.ts:184-189`) → `400 validation` en `locationIds` si algun local no es del
negocio (`:116-118`) → `503`.

### 3.3 `GET /api/marketing/campaigns/{id}`

`campaigns/[id]/route.ts:11-25`. `200 { "campaign": Campaign }`. Una campaña de OTRO negocio
es **`404 not_found`**, nunca 403 (`getCampaign`, `campaign-store.ts:149-163`, `:159`).

### 3.4 `PATCH /api/marketing/campaigns/{id}`

`campaigns/[id]/route.ts:28-46` → `updateCampaign` (`campaign-store.ts:228-275`). Cuerpo:
cualquier subconjunto de las claves de 3.2; lo ausente se conserva, y si nombra **alguna**
clave del cupon lo reemplaza entero (`parseCampaignPatch`, `campaign-input.ts:225-259`).
`200 { "campaign": Campaign }`.

Orden de errores: `400 invalid_body` → `404 not_found` → **`409 template_not_editable`** si
la campaña tiene `templateKey`, en CUALQUIER estado, pausada incluida (spec 0101;
`assertNotTemplate`, `campaign-store.ts:219-226`, llamado en `:235`) → `409 not_editable`
si no esta en `draft`/`paused` (`:236-241`, `campaign-transitions.ts:52`) → `400 validation`
→ `400 validation` en `locationIds` (local ajeno) → `503`.

### 3.5 `GET /api/marketing/campaigns/{id}/results`

`campaigns/[id]/results/route.ts:14-32`. Lee la campaña primero (`404 not_found` si es
ajena) y despues `loadCampaignResults` (`server/marketing/results-store.ts:194`).
`200 { "results": CampaignResults }`, tipo en `server/marketing/results.ts:102-115`:
`audience`, `turns`, `windowPurchases`, `effect`, `coupon`, `byLocation`, `passReach`, cada
bloque con su `quality` (`observada | estimada | estimado_configurado | no_disponible`,
`results.ts:28-32`). Sirve igual para una corrida de plantilla.

### 3.6 Acciones: `POST /api/marketing/campaigns/{id}/{activate|pause|end|archive}`

`campaignActionRoute` (`_auth.ts:105-123`) → `transitionCampaign`
(`server/marketing/campaign-actions.ts:45-127`). Sin cuerpo (lo que venga se ignora).
`200 { "campaign": Campaign, "notice"?: string }`; `notice` viaja en `pause` y `end`:
`"Los turnos activos se retiran en el próximo refresco."` (`campaign-actions.ts:17-18`).

Tabla de transiciones (`campaign-transitions.ts:27-35`): `activate` desde `draft`/`paused`;
`pause` desde `active`; `end` desde `active`/`paused`; `archive` desde `ended`/`paused`.

Errores: guard (8-9 con `not_owner`) → `404 not_found` → `409 invalid_transition`
(`campaign-actions.ts:53-58`) → solo `activate`: `402 plan_not_allowed` (`:65-70`),
`409 no_usable_location` (`:71-76`), `409 campaign_expired` (`:89-94`) → `503`. Aplican
igual a una corrida de plantilla (pausar y reanudar una plantilla SI se puede).

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

Catalogo en codigo (`server/marketing/templates.ts:32-56`), en este orden:

| `key` | `title` | `dormantDays.options` | `default` | `message.default` | `couponRecommended` |
|---|---|---|---|---|---|
| `missed_you` | Te extrañamos | `[14, 30]` | `30` | `Hace rato no te vemos. ¡Te esperamos!` | `false` |
| `win_back` | Recuperar perdidos | `[60, 90, 180]` | `90` | `¡Volvé! Te estamos esperando.` | `true` |

Todas llevan `channel: "proximity"` y `message.maxLength: 60`. Las claves estan fijadas
tambien por el `CHECK core_campaign_template_key_check` (migracion `0044`). Una sola
corrida viva (`draft`/`active`/`paused`) por negocio y plantilla, garantizada por el unico
parcial `core_campaign_template_live_unique` (`server/schema/campaign.ts`).

### 4.1 `GET /api/marketing/templates`

`app/api/marketing/templates/route.ts:9-19` → `listTemplates`
(`server/marketing/template-store.ts:224-267`). Sin query.
`200 { "templates": TemplateView[] }`, en el orden del catalogo:

```jsonc
{
  "templates": [
    {
      "key": "missed_you",
      "title": "Te extrañamos",
      "description": "Le recuerda tu local a los clientes que hace un tiempo no vienen, cuando pasan cerca.",
      "channel": "proximity",
      "dormantDays": { "options": [14, 30], "default": 30 },
      "message": { "default": "Hace rato no te vemos. ¡Te esperamos!", "maxLength": 60 },
      "couponRecommended": false,
      "live": null,          // o el DTO Campaign COMPLETO (§2) de la corrida viva
      "runs": [              // corridas anteriores: ended | archived
        { "id": "uuid", "status": "ended",
          "activatedAt": "2026-09-01T12:00:00.000Z", "endedAt": "2026-09-20T12:00:00.000Z" }
      ]
    }
  ]
}
```

`runs`: `activatedAt` desc (nulos al final), maximo 10 (`template-store.ts:22-23`, `:241`).
Tipo `TemplateView` en `template-store.ts:33-36`. Errores: guard; `503`.

### 4.2 `POST /api/marketing/templates/{key}/enable`

`app/api/marketing/templates/[key]/enable/route.ts:12-30` → `enableTemplate`
(`template-store.ts:126-204`). Crea la corrida **ya `active`** (`activatedAt = ahora`,
`name = title`, `kind = proximity`). `201 { "campaign": Campaign }`.

Cuerpo JSON (**`{}` es valido**; un POST sin cuerpo es `400 invalid_body`). Todo opcional
(`parseTemplateInput`, `server/marketing/template-input.ts:101-144`):

| Campo | Regla | Default |
|---|---|---|
| `dormantDays` | entero **dentro de `options`** de la plantilla (`:40-55`) | `default` |
| `message` | 1..60 tras `trim` (`:57-73`) | `message.default` |
| `excludedLocationIds` | uuid[]; duplicados colapsan (`:75-85`) | `[]` |
| `couponLabel`, `couponCost`, `couponMaxRedemptions`, `couponProductId` | **las mismas reglas que el compositor** (`parseCoupon`, `campaign-input.ts:103`) | sin cupon |
| `startsAt` | fecha ISO | ahora |
| `endsAt` | fecha ISO \| `null`; posterior a `startsAt` | `null` |

Cualquier otra clave (`templateKey`, `name`, `locationIds`, un id de negocio) se ignora.
**Locales:** todos los del negocio `active` y con `latitude`/`longitude`, **menos** los
excluidos (`runDoors`, `template-store.ts:87-123`); quedan fijos para esa corrida.

Orden de errores:

| # | Condicion | Status | `code` | Donde |
|---|---|---|---|---|
| 0 | guard | 401/403 | §1 delegable | `enable/route.ts:16` |
| 1 | cuerpo no JSON | 400 | `invalid_body` | `_auth.ts:78-84` |
| 2 | `key` fuera del catalogo | 404 | `not_found` | `template-store.ts:134` |
| 3 | cuerpo invalido | 400 | `validation` (+`fields`) | `:136-142` |
| 4 | el plan no incluye campañas | 402 | `plan_not_allowed` | `:147-152` |
| 5 | un excluido no es local del negocio | 400 | `validation`, `fields.excludedLocationIds` | `:102-108` (en `runDoors`) |
| 6 | no queda ningun local usable | 409 | `no_usable_location` | `:154-159` |
| 7 | `endsAt` ya paso | 409 | `campaign_expired` | `:160-165` |
| 8 | ya hay una corrida viva de esa plantilla | 409 | `template_already_live` | `:168-169` (select) y `:197-198` (`23505` del unico parcial, dos requests simultaneas) |
| — | otra falla | 503 | (sin `code`) | `_auth.ts:75` |

### 4.3 `POST /api/marketing/templates/{key}/disable`

`app/api/marketing/templates/[key]/disable/route.ts:11-23` → `disableTemplate`
(`template-store.ts:207-221`). **Owner-only.** Sin cuerpo. Apagar = **FINALIZAR** la
corrida viva (`transitionCampaign(…, "end")`): es irreversible; volver a encender crea otra.
`200 { "campaign": Campaign, "notice": "Los turnos activos se retiran en el próximo refresco." }`.

| # | Condicion | Status | `code` |
|---|---|---|---|
| 0 | guard (un integrante con permiso `marketing` → `not_owner`) | 401/403 | §1 owner-only |
| 1 | `key` fuera del catalogo | 404 | `not_found` (`template-store.ts:212`) |
| 2 | no hay corrida viva | 404 | `template_not_live` (`:212-217`) |
| 3 | la corrida esta en `draft` (no ocurre por construccion) | 409 | `invalid_transition` |
| — | otra falla | 503 | (sin `code`) |

### 4.4 Solapamiento

Con dos campañas activas del mismo negocio que califican al mismo consumidor, **gana la de
mayor `dormantDays`**: el tick las evalua en orden `dormant_days desc, created_at asc, id asc`
(`loadActiveCampaigns`, `server/marketing/audience-store.ts:74-78`) y la primera se queda con
el turno. Rige para todas, custom incluidas (ADR 0092 §6).

---

## 5. Flujo de una plantilla (para la UI)

1. **Tarjetas:** `GET /api/marketing/templates` → texto, opciones, defaults, `live` (si esta
   encendida) y `runs` (corridas anteriores).
2. **«Hoy son N personas»:** `GET /api/marketing/audience-preview?dormantDays=<d>&locationIds=<ids>`
   con los locales del negocio (`GET /api/locations`) menos los que el comercio destildo.
   Mirar `preview.eligible` (o `reachable` para el alcance total).
3. **Toggle ON:** `POST /api/marketing/templates/{key}/enable` con `{}` o los parametros
   elegidos → `201`, queda `active`. Si ya estaba encendida: `409 template_already_live`.
4. **Toggle OFF:** `POST /api/marketing/templates/{key}/disable` → `200`, queda `ended`. Solo
   el owner (`403 not_owner` para un integrante: la UI deberia ocultar el toggle OFF). Volver
   a encender crea otra corrida; la vieja pasa a `runs`.
5. **Resultados de una corrida** (viva o de `runs`):
   `GET /api/marketing/campaigns/{id}/results` (§3.5).

Una corrida de plantilla **no se edita** (`PATCH` → `409 template_not_editable`): cambiar un
parametro es apagar y encender. Pausar/reanudar con las acciones de §3.6 si se puede.

---

## 6. Rutas vecinas, por remision (sin contrato aca)

- `POST /api/counter/coupon-redeem` — el canje del cupon en caja (dominio del mostrador).
- `POST /api/public/consumer/marketing-opt-out` — la baja de promociones del consumidor.
- `/api/internal/marketing-tick` — el tick (cron), autenticado por secreto, no por sesion.

## 7. Procedencia

Consolida lo de marketing de `0072-contratos-de-api.md` (codes del gate y `plan_not_allowed`)
y `0086-contratos-de-api.md` (permiso `marketing`, `archive`/`end` owner-only), y agrega las
rutas 11-13 de la spec 0101. Ante una discrepancia, este anexo es el vigente por fecha.

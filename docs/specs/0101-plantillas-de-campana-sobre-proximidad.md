---
spec: 0101
fecha: 2026-09-26
estado: cerrada (2026-09-26, OK del owner: «me cierra»)
resumen: Primeras campañas PREARMADAS (ADR 0091/0092) como API — «Te extrañamos» (#3) y «Recuperar perdidos» (#5) sobre el motor de proximidad existente. Tres rutas nuevas (listar plantillas, encender, apagar), columna `campaign.template_key` con una corrida viva por plantilla y negocio, parametros congelados (sin `PATCH`), apagar = finalizar (owner-only), locales = todos los usables menos los excluidos, y el tick con orden determinista (gana el mayor `dormant_days`). Entrega ademas el CONTRATO DE API completo de `/api/marketing/*` para quien construye la UI. No toca un `.tsx`.
disjunta: si (la unica spec abierta, 0100, toca solo `app/backoffice/loyalty/**`)
archivos: apps/merchant/drizzle/0044_*.sql, apps/merchant/drizzle/meta/**, apps/merchant/src/server/schema/campaign.ts, apps/merchant/src/server/marketing/{templates,template-input,template-store,campaign-input,campaign-store,audience-store}.ts, apps/merchant/src/app/api/marketing/{_auth.ts,templates/**}, apps/merchant/src/server/{marketing-route-names.ts,marketing-routes.test.ts,marketing-templates.neon.integration.test.ts,marketing-overlap.neon.integration.test.ts}, apps/merchant/src/server/marketing/{templates,template-input}.test.ts, docs/specs/0101-contratos-de-api.md
---

# 0101 — Plantillas de campaña sobre proximidad

> **Nada de codigo empieza sin esta spec en `cerrada`.** Ver `TEMPLATE.md` para el porque.

## Problema

El comercio no sabe configurar una campaña (owner, 2026-09-26). Hoy la unica forma de tener una
es el compositor custom de la spec 0065: nombre, dias, mensaje, locales, cupon, fechas, crear
borrador y activar. No existe el concepto de campaña prearmada que se enciende con un toggle
(ADR 0091), y no hay un contrato de API de marketing escrito para quien construye la UI nueva: lo
que hay son piezas repartidas en los anexos 0072 (codigos) y 0086 (permisos).

Ademas, medido: con dos campañas activas del mismo negocio cuyo publico se solapa, **cual se queda
con el consumidor es azar** — `loadActiveCampaigns` (`server/marketing/audience-store.ts:43`) no
ordena, y el insert de turnos (`audience-store.ts:198`) hace `on conflict do nothing` sobre el
unico parcial de turnos vivos por `(business_id, consumer_id)`.

## Alcance

**Entra:**

- Catalogo de plantillas en codigo con **dos** plantillas: `missed_you` («Te extrañamos», #3) y
  `win_back` («Recuperar perdidos», #5).
- Columna `core.campaign.template_key` + `CHECK` + unico parcial de corrida viva (migracion 0044).
- `GET /api/marketing/templates`, `POST /api/marketing/templates/{key}/enable`,
  `POST /api/marketing/templates/{key}/disable`.
- `templateKey` en el DTO de campaña; `PATCH` bloqueado para campañas con plantilla.
- Orden determinista del tick: mayor `dormant_days` primero.
- **`docs/specs/0101-contratos-de-api.md`**: contrato de las 13 rutas de `/api/marketing/*`.
- Corregir el docblock de `app/api/marketing/_auth.ts:94`, que cita `marketing-permission.test.ts`
  — **ese archivo no existe**; la asercion vive en `server/marketing-routes.test.ts:199`.

**No entra:**

- Ningun `.tsx`. La pantalla del compositor actual **se queda** hasta que exista la UI nueva
  (owner, 2026-09-26) y no se adapta.
- Canal push, plantillas #7/#8 (spec B), #4 (spec C), catalogo de premios, cualquier otra plantilla.
- Anti-hartazgo mas alla de lo que ya hace proximidad (pendiente del owner).
- Cambios al tick fuera del `ORDER BY`, al calculo de audiencia, a resultados o a la colocacion.
- Borrar o cambiar las rutas custom existentes.

## Diseño

### Lo que ve quien construye la UI

1. `GET /api/marketing/templates` → las dos tarjetas, cada una con su texto, sus opciones, sus
   defaults, si esta encendida (`live`) y sus corridas anteriores (`runs`).
2. Para mostrar «hoy son N personas» usa la ruta que ya existe,
   `GET /api/marketing/audience-preview?dormantDays=&locationIds=`, con los locales del negocio
   (`GET /api/locations`) menos los que el comercio destildo.
3. Toggle ON → `POST …/{key}/enable` con los parametros (todos opcionales). Queda `active`.
4. Toggle OFF → `POST …/{key}/disable`. Queda `ended`. Volver a encender crea otra corrida.
5. Resultados de una corrida: la ruta existente `GET /api/marketing/campaigns/{id}/results`.

### Especificacion tecnica

#### Catalogo (`server/marketing/templates.ts`, PURO)

```ts
export type TemplateKey = "missed_you" | "win_back";
export type TemplateDefinition = {
  key: TemplateKey;
  title: string;            // tambien es el `name` de la campaña creada
  description: string;
  channel: "proximity";
  dormantDays: { options: readonly number[]; default: number };
  message: { default: string; maxLength: 60 };
  couponRecommended: boolean;
};
```

| key | title | description | dormantDays | message.default | couponRecommended |
|---|---|---|---|---|---|
| `missed_you` | Te extrañamos | Le recuerda tu local a los clientes que hace un tiempo no vienen, cuando pasan cerca. | `[14, 30]`, def. `30` | `Hace rato no te vemos. ¡Te esperamos!` | `false` |
| `win_back` | Recuperar perdidos | Busca a los clientes que dejaron de venir hace meses, cuando pasan cerca de tu local. | `[60, 90, 180]`, def. `90` | `¡Volvé! Te estamos esperando.` | `true` |

Las opciones de dias son del owner (#3: 14/30, #5: 60/90/180, 2026-09-26). **Los textos
(`title` salvo los nombres, `description`, `message.default`) son del ORQUESTADOR** y se ajustan sin
spec nueva. El pase ya antepone el nombre del negocio al mensaje (`composeRelevantText`,
`server/marketing/relevant-text.ts`), por eso el default no lo incluye.

Exporta `TEMPLATES: readonly TemplateDefinition[]` y `templateByKey(key: string): TemplateDefinition | null`.

#### Modelo de datos (migracion `0044`, aditiva)

- `core.campaign.template_key text null`.
- `CHECK core_campaign_template_key_check`: `template_key is null or template_key in ('missed_you','win_back')`.
- Unico parcial `core_campaign_template_live_unique` sobre `(business_id, template_key)`
  `where template_key is not null and status in ('draft','active','paused')`.
- Nada mas cambia. Filas existentes: `null` (custom).
- Se genera con drizzle-kit desde `schema/campaign.ts` y se aplica a prod con el procedimiento de
  la skill `gotchas-del-repo` (Neon) **antes** del deploy que lee la columna.

#### Entrada de `enable` (`server/marketing/template-input.ts`, PURO)

Cuerpo JSON, **todos los campos opcionales** (`{}` es valido):

| Campo | Regla | Default |
|---|---|---|
| `dormantDays` | entero **dentro de `options`** de la plantilla | `default` |
| `message` | texto 1..60 tras `trim` | `message.default` |
| `excludedLocationIds` | array de uuid, sin duplicados relevantes | `[]` |
| `couponLabel`, `couponCost`, `couponMaxRedemptions`, `couponProductId` | trio todo-o-nada, **mismas reglas que el compositor** | sin cupon |
| `startsAt` | fecha ISO | ahora |
| `endsAt` | fecha ISO o `null`; posterior a `startsAt` | `null` |

El cupon **reusa** la validacion de `campaign-input.ts` (exportar su funcion `coupon` con otro
nombre, p. ej. `parseCoupon`); no se duplica. Errores → `400 validation` con `fields`, igual que el
compositor. Cualquier otra clave (incluida `templateKey`, `name`, `locationIds`) se ignora.

#### `enable` (`server/marketing/template-store.ts`)

Una sola transaccion, en este orden:

1. `templateByKey(key)` nulo → `404 not_found`.
2. Parse (seccion anterior) → `400 validation`.
3. `planAllowsCampaigns(tx, businessId)` falso → `402 plan_not_allowed` (el mismo gate de
   `createCampaign` y `activate`, `server/marketing/plan-gate.ts:72`).
4. `excludedLocationIds` que no sean del negocio → `400 validation`, campo `excludedLocationIds`.
5. Locales = del negocio, `status = 'active'`, `latitude`/`longitude` no nulos, **menos** los
   excluidos. Si quedan 0 → `409 no_usable_location` (mismo code que `activate`).
6. `endsAt` no nulo y `<= now` → `409 campaign_expired` (mismo code que `activate`).
7. Insert en `core.campaign`: `kind 'proximity'`, `template_key`, `name = title`,
   `status 'active'`, `activated_at = now`, `created_by_user_id`, y los parametros. Insert de los
   `campaign_location`.
8. Violacion del unico parcial (`23505` sobre `core_campaign_template_live_unique`) →
   `409 template_already_live`. **Tambien** se chequea antes con un `select` para contestar rapido,
   pero el que garantiza es el indice (dos requests simultaneas).

Respuesta `201 { campaign }` (DTO de campaña, ver abajo).

#### `disable`

1. Clave desconocida → `404 not_found`.
2. Corrida viva (`status in ('draft','active','paused')`) de esa plantilla y negocio; si no hay →
   `404 template_not_live`.
3. `transitionCampaign(businessId, id, "end")` (`server/marketing/campaign-actions.ts`), que ya
   escribe `ended_at` y devuelve el `notice` de turnos. Una corrida `draft` no existe por
   construccion; si existiera, `end` la rechaza con su `409 invalid_transition`.

Respuesta `200 { campaign, notice }`.

#### `GET /api/marketing/templates`

`200 { templates: TemplateView[] }`, en el orden del catalogo:

```ts
type TemplateView = TemplateDefinition & {
  live: Campaign | null;                 // la corrida draft/active/paused, con su DTO completo
  runs: { id: string; status: "ended" | "archived";
          activatedAt: string | null; endedAt: string | null }[];  // desc por activatedAt, max 10
};
```

#### DTO de campaña y `PATCH`

- `Campaign` (`server/marketing/campaign-store.ts:36`) gana `templateKey: string | null`. Lo
  devuelven todas las rutas que ya devuelven campaña.
- `updateCampaign`: despues del `404` y **antes** del chequeo de estado editable, una campaña con
  `templateKey` no nulo → `409 template_not_editable` («Una campaña prearmada no se edita: apagala
  y encendé una nueva.»).
- `POST /api/marketing/campaigns` sigue creando **siempre** `template_key = null`, aunque el
  cuerpo traiga `templateKey`.
- `pause`, `activate`, `end`, `archive` no cambian para campañas con plantilla.

#### Tick

`loadActiveCampaigns` ordena por `dormant_days desc, created_at asc, id asc`. Con el insert
secuencial y el `on conflict do nothing` existentes, la campaña de mayor umbral evalua primero y se
queda con el consumidor (ADR 0092 §6). Rige para todas las campañas del negocio.

#### Autorizacion

| Ruta | Guard | Por que |
|---|---|---|
| `GET /api/marketing/templates` | `requireMarketingOwner` (permiso `marketing`) | lectura |
| `POST …/{key}/enable` | `requireMarketingOwner` | crear+activar son delegables hoy (ADR 0079 §2) |
| `POST …/{key}/disable` | `requireCampaignOwner` (owner-only, `403 not_owner`) | apagar = `end`, irreversible |

Todas por `business_id` de la sesion; ningun id de negocio viaja en el request.

#### Contrato (`docs/specs/0101-contratos-de-api.md`, ENTREGABLE)

Mismo formato y convenciones que `specs/0099-contratos-de-api.md`. Cubre las **13** rutas de
`MARKETING_ROUTE_NAMES`: por cada una, verbo y path, guard y tabla de `code` por paso, cuerpo o
query con tipos y reglas, forma de la respuesta campo por campo, y errores con status y `code`.
Cita `archivo:linea` de lo que afirma y se escribe **medido contra el codigo final**, no contra
esta spec. Incluye una seccion «flujo de una plantilla» (los 5 pasos de «Lo que ve quien construye
la UI»). Las rutas vecinas (`/api/counter/coupon-redeem`, opt-out del consumidor, tick interno) se
nombran por remision, sin contrato.

### Arquitectura de referencia

ADR 0064, 0065, 0066, 0079 §2, 0091, 0092; spec 0065; anexos 0072, 0086 y 0099 de contratos.

## Archivos

| Archivo | Accion |
|---|---|
| `apps/merchant/src/server/schema/campaign.ts` | editar: columna, check, unico parcial |
| `apps/merchant/drizzle/0044_*.sql` + `drizzle/meta/**` | crear (drizzle-kit) |
| `apps/merchant/src/server/marketing/templates.ts` | crear |
| `apps/merchant/src/server/marketing/template-input.ts` | crear |
| `apps/merchant/src/server/marketing/template-store.ts` | crear |
| `apps/merchant/src/server/marketing/campaign-input.ts` | editar: exportar el parser del cupon |
| `apps/merchant/src/server/marketing/campaign-store.ts` | editar: `templateKey` en DTO + bloqueo de `PATCH` |
| `apps/merchant/src/server/marketing/audience-store.ts` | editar: `ORDER BY` de `loadActiveCampaigns` |
| `apps/merchant/src/app/api/marketing/templates/route.ts` | crear |
| `apps/merchant/src/app/api/marketing/templates/[key]/enable/route.ts` | crear |
| `apps/merchant/src/app/api/marketing/templates/[key]/disable/route.ts` | crear |
| `apps/merchant/src/app/api/marketing/_auth.ts` | editar: solo el docblock de la linea 94 |
| `apps/merchant/src/server/marketing-route-names.ts` | editar: +3 nombres |
| `apps/merchant/src/server/marketing-routes.test.ts` | editar: +3 entradas en `HANDLERS` y el caso owner-only de `disable` |
| `apps/merchant/src/server/marketing/templates.test.ts` | crear |
| `apps/merchant/src/server/marketing/template-input.test.ts` | crear |
| `apps/merchant/src/server/marketing-templates.neon.integration.test.ts` | crear |
| `apps/merchant/src/server/marketing-overlap.neon.integration.test.ts` | crear |
| `docs/specs/0101-contratos-de-api.md` | crear |

Todo archivo por debajo de 300 lineas (hook `file-size`); si `campaign-store.ts` (253 hoy) no
entra, se divide, no se extiende.

### Disjunta?

**Si.** La unica spec en ejecucion (0100) toca `app/backoffice/loyalty/**` y ningun archivo de esta
lista. Las pantallas de `app/backoffice/marketing/**` no se tocan: solo consumen el tipo
`Campaign`, que gana un campo.

### Archivos compartidos

Ninguno que deba dejar listo el orquestador.

## Definition of Done

- [ ] Migracion `0044` generada, aplicada a la rama de test de Neon, y el `CHECK` y el unico
      parcial **existen** (leidos por SQL en esa rama: `pg_constraint` / `pg_indexes`).
- [ ] `GET /api/marketing/templates` devuelve las 2 plantillas con los valores exactos de la tabla
      del catalogo, `live: null` y `runs: []` en un negocio sin corridas.
- [ ] `enable` con `{}` crea una campaña `active`, `template_key` correcto, `name = title`,
      `dormant_days = default`, `message = default`, sin cupon, y un `campaign_location` por cada
      local usable del negocio.
- [ ] `enable` con `excludedLocationIds` deja fuera exactamente esos locales; excluir todos →
      `409 no_usable_location`; un id ajeno → `400 validation` en `excludedLocationIds`.
- [ ] `dormantDays` fuera de las opciones de la plantilla (p. ej. `45` en `missed_you`) → `400`.
- [ ] Segundo `enable` de la misma plantilla con una corrida viva → `409 template_already_live`, y
      dos `enable` concurrentes (`Promise.all`) dejan **exactamente una** corrida viva.
- [ ] `disable` finaliza la corrida (`ended`, `ended_at`), devuelve `notice`; sin corrida →
      `404 template_not_live`; un integrante con permiso `marketing` → `403 not_owner`.
- [ ] Encender → apagar → encender deja 2 filas; `GET` muestra la nueva en `live` y la vieja en
      `runs`.
- [ ] `PATCH` sobre una campaña con plantilla (incluso `paused`) → `409 template_not_editable`;
      `POST /api/marketing/campaigns` con `templateKey` en el cuerpo crea `template_key = null`.
- [ ] Plan sin campañas → `402 plan_not_allowed` en `enable`.
- [ ] Solapamiento: con «Te extrañamos» (30 d) y «Recuperar perdidos» (90 d) activas y un consumidor
      a 100 dias, el turno encolado es de `win_back` **en los dos ordenes de creacion**.
- [ ] `docs/specs/0101-contratos-de-api.md` existe, cubre las 13 rutas, y cada `code` que nombra
      aparece en el codigo (`rg` por cada uno).
- [ ] Docblock de `_auth.ts:94` corregido.
- [ ] Gates: `typecheck`, `lint`, `test`, `format:check`, `build` en verde, y las suites `.neon`
      de marketing (las dos nuevas + `marketing-tick`, `marketing-lifecycle`,
      `marketing-campaign-actions`, `marketing-campaigns`) en verde con `tools/neon-test.sh`.
      `test:e2e` **no aplica**: la spec no toca `.tsx` ni CSS.
- [ ] Revision independiente con `PASS`.

## Plan de pruebas y verificacion

**Unitarias (puras):**

- `templates.test.ts`: las 2 claves, valores exactos del catalogo, cada `default` dentro de sus
  `options`, cada `message.default` ≤ 60, `templateByKey` de clave desconocida → `null`.
- `template-input.test.ts`: `{}` → defaults; `dormantDays` fuera de opciones → error en el campo;
  mensaje vacio y de 61 caracteres → error; cupon incompleto → mismo error que el compositor;
  `endsAt <= startsAt` → error; claves extra ignoradas.

**Integracion (`tools/neon-test.sh`):**

- `marketing-templates.neon.integration.test.ts`: todos los items de la DoD de `enable`, `disable`,
  historial, `PATCH` bloqueado, `POST` custom ignora `templateKey`, gate de plan, concurrencia.
- `marketing-overlap.neon.integration.test.ts`: dos casos — creando primero `missed_you` y despues
  `win_back`, y al reves — un consumidor dormido 100 dias con pase y local atribuible; tras
  `runMarketingTick` el unico turno vivo es de la campaña `win_back`.

**Rutas (`marketing-routes.test.ts`, dobles de `_auth`):** las 3 rutas nuevas en `HANDLERS`;
`disable` con integrante → `403 not_owner`; `enable` con integrante con permiso → pasa el guard.

**Mutaciones — presupuesto: 6, clase: errores PLAUSIBLES de implementacion.** Cada fila se ejecuta y
se transcribe; ninguna se predice. Protocolo de la skill `protocolo-de-verificacion`.

| # | Mutacion | Donde | Oraculo que tiene que ponerse rojo |
|---|---|---|---|
| M1 | Borrar el `orderBy` nuevo | `loadActiveCampaigns`, `audience-store.ts:43` | `marketing-overlap` (al menos uno de los dos ordenes) |
| M2 | Mapear el `23505` a `503` en vez de `409` | `template-store.ts`, paso 8 de `enable` | caso de concurrencia de `marketing-templates` (espera un `409`) |
| M3 | Borrar la llamada al bloqueo de plantilla en `updateCampaign` (**cableado**) | `campaign-store.ts` | `PATCH` sobre plantilla `paused` → `409 template_not_editable` |
| M4 | `disable` con `requireMarketingOwner` en vez de `requireCampaignOwner` | `templates/[key]/disable/route.ts` | `marketing-routes.test.ts`, integrante → `403 not_owner` |
| M5 | Ignorar `excludedLocationIds` al calcular los locales | `template-store.ts`, paso 5 | `marketing-templates`, exclusion de un local |
| M6 | Aceptar cualquier entero 7..365 en `dormantDays` | `template-input.ts` | `template-input.test.ts`, `45` en `missed_you` |

**Declarado afuera:** la concurrencia se prueba con `Promise.all` sobre la misma base, que no
garantiza simultaneidad real — el que protege en produccion es el unico parcial, y su existencia se
lee por SQL (DoD). El orden del heap de Postgres sin `ORDER BY` no esta garantizado: por eso M1 se
mide en los dos ordenes de creacion.

**Comandos:**

```sh
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use
pnpm run typecheck && pnpm run lint && pnpm run test && pnpm run format:check && pnpm run build
tools/neon-test.sh apps/merchant/src/server/marketing-templates.neon.integration.test.ts
tools/neon-test.sh apps/merchant/src/server/marketing-overlap.neon.integration.test.ts
```

**Verificacion manual (orquestador, sobre el deploy `READY` con el sha):** logueado como owner en
`checkpass.club`, abrir `/api/marketing/templates` (JSON visible); desde la consola del navegador,
`fetch('/api/marketing/templates/missed_you/enable', {method:'POST', body:'{}',
headers:{'content-type':'application/json'}})` → `201`; volver a abrir `/api/marketing/templates` →
`live` no nulo; `disable` → `200`; releer → `runs` con una fila.

## Handoff requerido

Formato de `docs/AGENT-WORKFLOW.md`. Un implementador para toda la spec y un revisor independiente
al final (ADR 0071). El revisor re-ejecuta M1–M6 y verifica el contrato contra el codigo con `rg`.

## Abierto

**Nada bloqueante.** Registrado:

- Los textos del catalogo son del orquestador; el owner puede cambiarlos sin spec.
- El owner va a revisar las reglas de solapamiento (posible bloqueo de plantillas similares) con
  la investigacion de Fivestars/Sumo en mano.
- La UI la construye el owner por fuera; el compositor viejo se borra cuando exista.

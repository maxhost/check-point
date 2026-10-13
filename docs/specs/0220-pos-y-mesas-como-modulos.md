---
spec: 0220
fecha: 2026-10-13
estado: cerrada
resumen: Fase 2 del plan de modulos (L3, ADR 0139 + 0141, migracion 0079). El POS y Mesas pasan a ser modulos del registro — tablas al esquema `pos`, `pos_enabled` a `core.business_module`, permiso `pos` declarado por el modulo, rutas bajo `/api/modules/{pos,tables}/…`, puntos de enganche genericos (operacion, inicio, accion por local, `beforeDisable`, `optional`, rutas del owner). Pantallas: encargo a GPT. Migracion y deploy coordinados.
disjunta: no
archivos: apps/merchant/src/modules/**, apps/merchant/src/server/{pos,tables,ticket-settings}/** (se mudan), apps/merchant/src/printing/** (se muda), apps/merchant/src/app/api/{pos,locations/[locationId]/tables,merchant/business/pos,merchant/business/ticket}/** (se borran), apps/merchant/src/server/{staff-landing,staff-permissions,staff-create,staff-module-permissions,session-view,operator-guard}.ts, apps/merchant/src/app/api/merchant/{session,auth/staff}/route.ts, apps/merchant/src/app/{manifest.ts,layout.tsx}, apps/merchant/src/app/backoffice/start/page.tsx (nuevo), packages/db/src/{permissions-catalog.ts,schema.ts,seed-local.ts}, packages/db/src/schema/{business,pos,dining-table,ticket-settings}.ts, packages/db/src/schema/modules/pos.ts (nuevo), packages/db/drizzle.config.ts, packages/db/drizzle/0079_*.sql
---

# 0220 — POS y Mesas como modulos

## Problema

El POS es un switch del core, no un modulo: `core.business.pos_enabled`, permiso `pos` en el catalogo del core,
`requirePosOperator`, `assertPosGrantable`, `posEnabled` en la sesion, rutas `/api/pos/*`, tablas en `core`, y el menu,
Ajustes, Locales, la PWA, el aviso de prueba y el ingreso del personal lo nombran. Inventario medido el 2026-10-13
(`rg` sobre `apps/merchant/src` y `packages/db/src`): 30 archivos del core fuera de `server/pos`, `server/tables`,
`app/api/pos` y `app/backoffice/pos`. Hasta que no se cierre, un cambio en el POS puede romper el core y el POS no se
puede apagar/quitar como Stock o Recetas (ADR 0138: «instalarlo o desinstalarlo como un plugin»).

## Alcance

**Entra (Claude, 2a — servidor, base, contrato, tests):**
- Contrato: los puntos de enganche del ADR 0141 (`operation`, `startPage`, `locationAction` + `locationPanel`,
  `beforeDisable`, `lockModuleEnabled`, `optional`, `owner: true`, contexto con `currencyCode`/`status`).
- Modulo `pos` (`modules/pos/`): manifiesto, `server/` (lo de `server/pos/*`, la vista de mesas del POS de
  `server/tables/pos.ts`, `server/ticket-settings/*`), `routes.ts`, y `ui/printing/` (hoy `src/printing/`, codigo puro).
- Modulo `tables` (`modules/tables/`): manifiesto, `server/` (lo de `server/tables/manage.ts`), `routes.ts`.
- Esquema `pos` y migracion 0079 (mudar tablas, activar modulos, borrar `pos_enabled`).
- Core: borrar `posEnabled`, `requirePosOperator`, `assertPosGrantable`, `pos` del catalogo del core, las rutas viejas;
  `GET /api/merchant/session` con `business.enabledModules`; ingreso del personal y PWA por `startPage`; nombre
  «CheckPass Negocios».
- Frontera: reglas nuevas del ADR 0141 §9 y la lista `PENDING_GPT` con lo que queda para la 2b.

**Entra (GPT, 2b — encargo de Claude, ADR 0114):** mover `app/backoffice/pos/*` a `modules/pos/ui/`, el panel de
Mesas a `modules/tables/ui/`, Ajustes del POS (ticket) como `settingsPanel`, la barra movil y el aviso de prueba por
`operation`, el boton de Locales por `locationAction`, `posRequest` a un helper del core, las URLs nuevas en pantallas y
e2e, y bajar `PENDING_GPT` a `{}`.

**Entra (2c, PROD, con OK del owner):** migracion 0079 + deploy en la misma ventana (ver §Migracion).

**No entra:**
- Cambiar el comportamiento del POS (cerrar, cupon, puntos, impresion, mesas) salvo lo que este ADR obliga: con Mesas
  apagado no hay mesa; `pos_disabled` → `module_disabled`; el toggle del POS es el generico.
- Renombrar constraints e indices `core_pos_*` / `core_dining_table_*` (se mudan con su nombre; cosmetico).
- Las decisiones abiertas de la 0218 (integrante sin permisos efectivos, `onboarding/state` con PIN temporal).
- Un modo sin el marco del panel (ADR 0141: no se usa).

## Diseño

### Especificación técnica

**Manifiestos.**

```ts
// modules/pos/manifest.ts
{ id: "pos", name: "POS", description: "Órdenes de mesa, cobro y ticket",
  requires: [], optional: ["tables"], suggestedFor: [...GASTRONOMIA],
  permissions: [{ id: "pos", label: "POS", description: "Abrir, editar, cobrar y anular órdenes de mesa." }],
  navigation: [{ path: "", label: "POS", icon: "Shop", permission: "pos" }],
  settingsPanel: true,
  operation: { primaryAction: { label: "Nueva orden", icon: "Plus" } },
  startPage: { path: "", permission: "pos" } }

// modules/tables/manifest.ts
{ id: "tables", name: "Mesas", description: "Mesas de cada local para el POS",
  requires: ["pos"], suggestedFor: [...GASTRONOMIA], permissions: [], navigation: [],
  locationAction: { label: "Mesas", permission: "locations" } }   // sin icono, como hoy
```

`suggestedFor` del POS y Mesas: la lista `GASTRONOMIA` se mueve de `stock/manifest.ts` a `modules/categories.ts` (core
de modulos, puro, sin ids de modulo) y la importan los tres. Registro: `[stock, recipes, pos, tables]`.

**Rutas (despachador generico; misma forma de cuerpo y respuesta que hoy salvo lo marcado):**

| Antes | Despues | Guard |
|---|---|---|
| `GET /api/pos/catalog` | `GET /api/modules/pos/catalog` | permiso `pos` |
| `GET\|POST /api/pos/orders` | `GET\|POST /api/modules/pos/orders` | `pos` |
| `GET\|PUT /api/pos/orders/:id` | `GET\|PUT /api/modules/pos/orders/:id` | `pos` |
| `POST /api/pos/orders/:id/close` | `POST /api/modules/pos/orders/:id/close` | `pos` |
| `POST /api/pos/orders/:id/void` | `POST /api/modules/pos/orders/:id/void` | `pos` |
| `POST /api/pos/resolve` | `POST /api/modules/pos/resolve` | `pos` |
| `GET /api/pos/coupon-state`, `POST /api/pos/coupon-remove` | `…/modules/pos/coupon-state`, `…/coupon-remove` | `pos` |
| `GET /api/pos/tables?locationId=` | `GET /api/modules/pos/tables?locationId=` (Mesas apagado → `[]`) | `pos` |
| `GET /api/pos/ticket` | `GET /api/modules/pos/ticket` | `pos` |
| `GET\|PUT /api/merchant/business/ticket` | `GET\|PUT /api/modules/pos/ticket-settings` | `owner: true` |
| `PUT /api/merchant/business/pos` `{enabled}`→`{enabled}` | `PUT /api/modules/pos` (toggle generico) `{enabled}`→`{module}` | owner |
| `GET\|POST /api/locations/:l/tables` | `GET\|POST /api/modules/tables/locations/:l` | `locations` |
| `PATCH /api/locations/:l/tables/:t` | `PATCH /api/modules/tables/locations/:l/:t` | `locations` |
| `POST /api/locations/:l/tables/:t/status` | `POST /api/modules/tables/locations/:l/:t/status` | `locations` |

Todas: despues del permiso, modulo encendido (403 `module_disabled`). Las de `tables` exigen `tables` encendido (y, por
`requires`, el POS). Las rutas viejas se BORRAN (CLAUDE.md: la UI vieja se borra; un `redirect` a una ruta borrada es 404).

**Errores que cambian:** `pos_disabled` → `module_disabled` (403) en las rutas y → `module_disabled_permission` (422) al otorgar; apagar el POS con ordenes abiertas sigue siendo 409
`pos_has_open_orders` con `openCount`, ahora por `PUT /api/modules/pos`; apagar Mesas con ordenes abiertas en una mesa →
409 `tables_has_open_orders` con `openCount`; apagar el POS con Mesas encendido → 409 `module_required_by`
(`dependents: ["tables"]`), que va ANTES de `pos_has_open_orders`; orden con `diningTableId` y Mesas apagado → 422
`tables_disabled` («Las mesas no están activadas.»).

**Concurrencia.** `lockModuleEnabled(tx, businessId, moduleId)` (ADR 0141 §4) en: crear orden (`pos`), crear o mover
una orden a una mesa (`pos` y `tables`), reactivar una mesa (`tables`). El toggle toma el lock exclusivo y corre
`beforeDisable` bajo el. Invariante: nunca queda una orden `open` con el POS apagado, ni una orden `open` con mesa con
Mesas apagado.

**Sesion y personal.**
- `GET /api/merchant/session`: `business.enabledModules: string[]` (ids encendidos, orden del registro). `posEnabled` se
  mantiene hasta que la 2b lo deje de leer y se borra en el paso final de la 2a (DoD).
- Permisos efectivos (`effectiveStaffPermissions`): un permiso de modulo cuenta solo con su modulo encendido — `pos` deja
  de ser caso especial. Otorgar `pos` con el POS apagado: 422 `module_disabled_permission` por la regla generica
  (`staff-module-permissions.ts`; hoy `assertPosGrantable` da 422 `pos_disabled`, `staff-permissions.ts:50`). La
  pantalla del personal ya maneja el codigo generico (`staff-contract.ts:143`); `pos_disabled` desaparece.
- Ingreso del personal (`staffLanding`): ADR 0141 §2. `STAFF_LANDING_POS` desaparece.
- `/backoffice/start` (core, servidor): ADR 0141 §2. PWA: `start_url: "/backoffice/start"`, `id` congelado,
  `name`/`short_name` «CheckPass Negocios»; `layout.tsx` titulo «CheckPass Negocios».

**Datos (migracion 0079, a mano: drizzle-kit genera drop+create para un cambio de esquema; ver `gotchas-del-repo`
§drizzle).**

```sql
create schema if not exists pos;
alter table core.dining_table   set schema pos;
alter table core.pos_order      set schema pos;
alter table core.pos_order_item set schema pos;
alter table core.ticket_settings set schema pos;
insert into core.business_module (business_id, module_id, enabled)
  select id, m.module_id, true from core.business, (values ('pos'), ('tables')) as m(module_id)
  where pos_enabled = true
  on conflict (business_id, module_id) do update set enabled = true, updated_at = now();
alter table core.business drop column pos_enabled;
```

`SET SCHEMA` conserva filas, FKs, indices, constraints y secuencias. El snapshot de drizzle (`meta/`) queda igual al
esquema TS (`drizzle-kit generate` despues de la 0079 no genera nada: es parte del DoD). Esquema TS:
`schema/modules/pos.ts` con `pgSchema("pos")` y las cuatro tablas; se borran `schema/{pos,dining-table,ticket-settings}.ts`
y `posEnabled` de `business.ts`; `drizzle.config.ts` suma `pos` al `schemaFilter`; `seed-local.ts` usa `pos.dining_table`
y enciende `pos`/`tables` donde hoy pone `pos_enabled`.

**Lo que NO cambia:** el cierre del POS llama a `counter/grant-coupon.ts` y `counter/grant.ts` del core (modulo → core);
ninguna tabla del core apunta a `pos` (se verifica, regla 4).

### Arquitectura de referencia

ADR 0138, 0139, **0141**; ADR 0130 (POS), 0133 (ticket), 0079 (permisos), 0114 (zonas), 0140 (ingreso del equipo).

## Archivos

| Archivo | Accion |
|---|---|
| `modules/contract.ts`, `route-table.ts`, `dispatch.ts`, `guard.ts`, `activation.ts`, `navigation.ts`, `permissions.ts`, `registry.ts`, `server-registry.ts`, `ui-registry.ts` (solo los tipos de `locationPanel`; las lineas de pantallas las pone GPT) | editar |
| `modules/categories.ts` | crear |
| `modules/pos/{manifest.ts,server/**,ui/printing/**}`, `modules/tables/{manifest.ts,server/**}` | crear (mudar) |
| `server/pos/**`, `server/tables/**`, `server/ticket-settings/**`, `src/printing/**` | mudar y borrar |
| `app/api/pos/**`, `app/api/locations/[locationId]/tables/**`, `app/api/merchant/business/{pos,ticket}/**` | borrar |
| `server/{staff-landing,staff-permissions,staff-create,staff-module-permissions,session-view,operator-guard,locations-routes-support}.ts`, `app/api/merchant/{session,auth/staff}/route.ts` | editar |
| `app/manifest.ts`, `app/layout.tsx`, `app/backoffice/start/page.tsx` (nuevo; es del core) | editar / crear |
| `packages/db/src/{permissions-catalog.ts,schema.ts,seed-local.ts}`, `schema/business.ts`, `schema/modules/pos.ts` (nuevo), `schema/{pos,dining-table,ticket-settings}.ts` (borrar), `drizzle.config.ts`, `drizzle/0079_*.sql` + `meta/` | editar / crear / borrar |
| `modules/modules-boundary*.test.ts`, `modules-boundary-support.ts`, tests de servidor que nombran rutas o `posEnabled` | editar |

### Disjunta?

**No.** Colisiona con la 0219 (GPT, acceso del equipo: `staff-landing`/sesion) y con cualquier trabajo de pantallas del
POS. Se serializa: la 2a no arranca mientras GPT tenga cambios sin commitear en `app/backoffice/pos/`,
`app/backoffice/staff/` o `app/backoffice/locations/` (se mira `git status` antes de despachar).

### Archivos compartidos

| Que | Quien lo deja listo | Cuando |
|---|---|---|
| Tipos del contrato (`contract.ts`, `route-table.ts`) | implementador, primer commit | antes del resto |
| Contrato HTTP (tabla de rutas de arriba) | esta spec | ya |
| Encargo a GPT (2b) | Claude, despues del PASS de la 2a | — |

## Definition of Done

- [ ] `pos` y `tables` en los tres registros; `modules-boundary*.test.ts` verde con las reglas nuevas (7, 2 ampliada,
      `optional`/`requires` validos), cada una con su mutacion vista en rojo y anotada.
- [ ] `PENDING_GPT` lista, con cuenta exacta, cada archivo de pantalla que todavia nombra el POS (lo baja GPT en la 2b).
- [ ] Fuera de `modules/` y de `PENDING_GPT`, `rg -n 'posEnabled|pos_enabled|requirePosOperator|assertPosGrantable|/api/pos|server/pos|server/tables'
      apps/merchant/src packages/db/src` devuelve solo `posEnabled` de la sesion (paso transitorio) y comentarios
      historicos fechados.
- [ ] Las suites Neon del POS, Mesas y ticket, mudadas, en verde contra las rutas nuevas (`tools/neon-test.sh`, de a
      1-2 suites).
- [ ] Neon: toggle con `beforeDisable` (POS con orden abierta → 409 `pos_has_open_orders`; Mesas con orden en mesa → 409
      `tables_has_open_orders`; POS con Mesas encendido → 409 `module_required_by`) y la carrera crear-orden vs apagar
      (las dos ordenes posibles, ninguna deja una orden `open` con el modulo apagado).
- [ ] Neon: Mesas apagado → `GET /api/modules/pos/tables` `[]` y orden con `diningTableId` 422 `tables_disabled`; orden
      sin mesa 201.
- [ ] Neon: migracion 0079 sobre una rama con datos (negocio con POS encendido + orden abierta con mesa + ticket +
      negocio con POS apagado y mesas): despues, filas iguales en `pos.*` (conteo y hash por tabla), `pos` y `tables`
      encendidos solo para el primero, la orden sigue `open`, `pos_enabled` no existe, regla 4 (FK) verde.
- [ ] `drizzle-kit generate` despues de la 0079: sin migracion nueva.
- [ ] Ingreso del personal y `/backoffice/start`: unitarios con `{pos}` encendido → `/backoffice/pos`, `{pos}` apagado →
      `/backoffice`, `{pos, counter}` → `/backoffice`; owner con POS apagado → `/backoffice`.
- [ ] Paso final (despues de la 2b de GPT): `posEnabled` borrado de la sesion y `PENDING_GPT` = `{}`.
- [ ] Revisor adversarial PASS con los tres focos (abajo).
- [ ] Gates: typecheck, lint, `pnpm run test`; `pnpm verify` completo en el pre-push del push unico.

## Plan de pruebas y verificación

Skill `protocolo-de-verificacion` (mutaciones con shasum + bitacora + etiqueta MUTATION, revertir con diff).

- **Unitarias:** `route-table` con `owner: true`; `dispatch` (owner-only, contexto con `currencyCode`/`status`,
  `beforeDisable` llamado solo al apagar y despues de `module_required_by`); `registry.test.ts` (`optional`/`requires`
  validos, no se nombra a si mismo, `startPage.permission` declarado por el modulo o del core); `staff-landing`.
- **Integracion Neon:** las suites mudadas del POS (`pos-orders`, `pos-close`, `pos-close-races`, `pos-close-reuse`,
  `pos-access`, `pos-best-sellers`), `tables`, `ticket-settings`, `modules-dispatch`, `modules-fk`, y una nueva de la
  migracion 0079 y de `beforeDisable` + carrera.
- **Autorizacion/aislamiento:** `pos-access` reapuntada (staff sin `pos` → `missing_permission` ANTES de
  `module_disabled`; negocio ajeno → 404/403 como hoy; owner sin email verificado; negocio suspendido; prueba vencida;
  PIN temporal → 403 `pin_change_required`). Ticket-settings: staff con `pos` no puede `PUT` (owner only).
- **Mutaciones minimas del implementador (y presupuesto del revisor):** 1) borrar `beforeDisable` del POS → la suite de
  apagado da rojo; 2) tomar el lock compartido en modo no compartido o no tomarlo → la carrera da rojo; 3) un `import` de
  `modules/tables` desde `modules/pos` → regla 7 roja; 4) `permissions.includes("pos")` en un archivo del core → regla 2
  ampliada roja; 5) quitar el `insert` de `tables` en la 0079 → la suite de migracion roja.
- **Revisor adversarial (contexto fresco, presupuesto 10 mutaciones):** (a) acoplamiento oculto: intentar que el core
  dependa del POS o que POS↔Mesas se acoplen sin que ningun test lo vea; (b) regresiones del POS: cerrar orden con y sin
  pase, cupon, puntos, impresion (`GET …/ticket`), mesa ocupada, apagar con ordenes abiertas; (c) migracion de datos.
  Lo que quede afuera se DECLARA.
- **Comandos:** `pnpm -F merchant typecheck`, `pnpm -F merchant lint`, `pnpm run test`,
  `tools/neon-test.sh <archivo>` por suite.
- **Manual (despues de la 2b, en local):** owner con POS + Mesas: abrir PWA → POS; crear orden en mesa, cobrar, imprimir;
  apagar Mesas con la orden abierta → modal 409; integrante solo `pos` entra por `staff.` → POS.

## Migracion a PROD (2c)

Con OK del owner, en el push unico: snapshot de Neon → `merge --ff-only dev` en `main` → push → apenas el deploy de
`checkpass.club` esta `READY` con ese sha, aplicar la 0079 (ventana: el POS de PROD da error entre el deploy y la
migracion — minutos). Verificacion por SQL: comercios con `pos` encendido = los que tenian `pos_enabled` (conteo
guardado ANTES), ordenes `open` antes = despues, `pos.*` con los mismos conteos.

## Handoff requerido

`docs/AGENT-WORKFLOW.md`: un `implementador` (2a), un `revisor` en contexto fresco (presupuesto y clase de error de
arriba). Despues, encargo a GPT (2b) con SOLO lo de la 2b (memoria: no copiar el alcance entero). Ningun hallazgo del
revisor entra a un doc sin reproducirlo.

## Abierto

Nada que bloquee. Decisiones del owner tomadas: plan 2026-10-13 (1-5) y ADR 0141 (Mesas apagado → ordenes sin mesa;
nombre «CheckPass Negocios»).

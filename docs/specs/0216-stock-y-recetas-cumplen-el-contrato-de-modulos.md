---
spec: 0216
fecha: 2026-10-13
estado: cerrada
resumen: Fase 1 del plan de modulos. Stock y Recetas pasan a cumplir el contrato completo (ADR 0139) y quedan como implementacion de referencia. Parte Claude (esta spec): manifiestos completos, tres registros, despachador de API, despachador de pantallas, permisos de modulo (`stock`, `recipes`, CHECK solo de forma, migracion 0078 con asignacion a quien tiene `catalog`), `GET /api/modules` para cualquier integrante con navegacion y permisos, helper de menu, test de frontera ampliado. Parte GPT (encargo aparte): pantallas a `modules/<id>/ui/`, menu y Ajustes desde los manifiestos. Revisor adversarial al final de las dos partes.
disjunta: no
archivos: apps/merchant/src/modules/**, apps/merchant/src/app/api/modules/**, apps/merchant/src/app/backoffice/[module]/**, apps/merchant/src/server/api-permission.ts, apps/merchant/src/server/staff-permissions.ts, apps/merchant/src/server/session-view.ts, apps/merchant/src/server/api-member.ts, packages/db/src/permissions-catalog.ts, packages/db/src/schema/membership.ts, packages/db/drizzle/0078_*
---

# 0216 — Stock y Recetas cumplen el contrato de modulos (Fase 1)

Nivel **L3**. Decisiones: ADR 0139 (contrato), ADR 0138, `docs/MODULOS.md`, plan `docs/plan-modulos-plugin-2026-10-13.md`.
Disjunta: **no** — comparte `app/backoffice/**` con las pantallas de GPT (0215); se serializa: primero esta parte,
despues el encargo de GPT sobre la base que deja.

## Problema (medido 2026-10-13)

- El menu nombra Stock y Recetas (`apps/merchant/src/app/backoffice/backoffice-navigation.tsx:77-88`) y Ajustes tambien
  (`settings/module-navigation.ts` `moduleLinkVisible`: `segment !== "stock" && segment !== "recipes"`).
- Las pantallas viven en `app/backoffice/{stock,recipes}/` y las rutas en `app/api/modules/{stock,recipes}/**`: agregar
  un modulo exige archivos en el arbol del core; la carpeta fija `recipes/` provoco el 405 del toggle
  (`modules/toggle-route.ts`).
- Stock y Recetas usan el permiso `catalog` del core (`modules/guard.ts` `requireModuleAccess`); el catalogo de permisos es
  cerrado con un `CHECK` en la base (`packages/db/src/schema/membership.ts:85`).
- `GET /api/modules` exige `catalog` (`app/api/modules/route.ts`): un integrante sin `catalog` no puede saber que modulos
  ver en el menu.
- `modules-boundary.test.ts` no mira pantallas ni FKs ni choques de rutas.

## Alcance

**Entra (Claude):**
1. Manifiestos `modules/{stock,recipes}/manifest.ts` con `permissions` y `navigation` (ADR 0139 §2); `registry.ts`
   pasa a importarlos (sigue puro).
2. `modules/server-registry.ts` + `modules/<id>/server/routes.ts`: las tablas de rutas de Stock y Recetas (los mismos
   handlers de hoy, movidos). Despachador `app/api/modules/[moduleId]/[[...path]]/route.ts` (GET, POST, PUT, PATCH,
   DELETE). Se BORRAN `app/api/modules/{stock,recipes}/**`, `app/api/modules/[moduleId]/route.ts` y `toggle-route.ts`
   (+ su test). Las URLs y los contratos HTTP de la 0210/0212/0214 NO cambian.
3. Despachador de pantallas `app/backoffice/[module]/[[...path]]/page.tsx` + `modules/ui-registry.ts` (server
   component: sesion de backoffice, modulo del registro, encendido para el negocio, permiso del modulo o owner; si no,
   `notFound()`); `ui-registry` arranca apuntando a las pantallas ACTUALES para que nada se rompa hasta que GPT las mude.
4. Permisos de modulo (ADR 0139 §5): catalogo valido = core + manifiestos (`modules/permissions.ts`, servidor);
   `requireApiPermission` acepta un permiso de modulo; validacion y «no otorgable con el modulo apagado» generalizados en
   `staff-permissions.ts`; el owner recibe tambien los de modulo en la sesion. Migracion **0078**: el `CHECK` cerrado pasa
   a forma (`array_to_string(permissions, ',') ~ '^([a-z][a-z_]{0,39})(,[a-z][a-z_]{0,39})*$'` o arreglo vacio) +
   datos: todo integrante con `catalog` recibe `stock` y `recipes` (sin duplicar).
5. `GET /api/modules` para CUALQUIER integrante del negocio (guard nuevo `requireApiMember` en el core, misma escalera
   sin permiso), devolviendo ademas `navigation` y `permissions` de cada modulo. Helper puro
   `modules/navigation.ts` `moduleNavigation(modules, { isOwner, permissions })` → entradas de menu de los modulos
   encendidos que el usuario puede ver (lo usa GPT).
6. Rutas de Stock con permiso `stock`; de Recetas con `recipes`.
7. `modules-boundary.test.ts` ampliado a las 6 reglas del ADR 0139 §7.

**No entra:** mover las pantallas ni tocar el menu/Ajustes (GPT, encargo aparte), POS/Mesas (Fase 2), cambiar URLs o
contratos HTTP de Stock y Recetas, IA.

## Diseño

### Despachador de API

- `path` vacio: `PUT` = toggle (core, `requireApiOwner`, igual que hoy); otro metodo → 405.
- `path` no vacio: modulo del registro (si no, 404 `module_not_found`), ruta de su tabla por metodo + patron
  (`items/:itemId/purchases`; segmentos literales y `:param`), si no hay → 404 `route_not_found`. Antes del handler:
  `requireApiPermission(request, <permiso de la ruta>)` (por defecto el permiso del modulo; la tabla puede pedir otro)
  y `requireModule` (403 `module_disabled`). El handler recibe `{ request, business, userId, params }`.
- Orden de errores igual que hoy: permiso → modulo encendido → handler (un integrante sin permiso recibe
  `missing_permission` sin saber si el modulo esta encendido).

### Despachador de pantallas

`app/backoffice/[module]/[[...path]]/page.tsx`: `requireBackofficeSession()`; `moduleById(params.module)`; encendido
(`requireModule` sin lanzar → `notFound()`); owner o integrante con el permiso de la entrada de navegacion; resuelve en
`ui-registry` la pantalla para `path` (`""` = principal) o `notFound()`. Nunca nombra un modulo.

### Permisos

- `packages/db/src/permissions-catalog.ts` conserva el catalogo del core (con `pos` hasta la Fase 2) y exporta la regex de
  forma. `membership.ts` declara el `CHECK` de forma. `modules/permissions.ts`: `validPermissions()` (core + manifiestos)
  y `modulePermissionOwner(perm)` (que modulo lo declara).
- `normalizePermissions` y los validadores rechazan un permiso fuera del catalogo valido con el mismo 422 de hoy.
- Otorgar un permiso de un modulo apagado → 422 `module_disabled_permission` (generaliza `pos_disabled` para modulos;
  `pos` conserva su codigo hasta la Fase 2). Conservar uno que ya tenia no es otorgar (como `assertPosGrantable`).
- `allPermissions()` del owner (sesion y API) incluye los de modulo.

### Migracion 0078 (datos de PROD: hoy 4 comercios)

Aditiva para el codigo viejo: el `CHECK` nuevo acepta todo lo que el viejo aceptaba, y `stock`/`recipes` en un
integrante no rompen al codigo viejo (no los mira). Va antes o junto con el deploy. Verificacion por SQL: ningun integrante
con `catalog` quedo sin `stock` y `recipes`; ningun owner con permisos; conteo de filas igual.

### Test de frontera (ADR 0139 §7) — cada regla con su mutacion vista en rojo

1. Imports: nada fuera de `modules/` importa `modules/<id>/…` salvo `registry.ts`, `server-registry.ts`,
   `ui-registry.ts` (y `modules/guard`, `modules/navigation`, `modules/permissions`, que son del core de modulos).
2. Literales: ningun archivo del core contiene `"/backoffice/<id>` ni `"/api/modules/<id>` para un id del registro, ni
   compara un `segment`/`moduleId` contra el id literal. Oraculo: agregar `{ segment: "stock" }` o
   `"/backoffice/stock"` al menu da ROJO; la fuente de imagen `"stock"` del catalogo sigue VERDE. Lo que el barrido no
   puede ver se DECLARA en el docblock (es un proxy sintactico; `gotchas-del-repo` §barridos).
3. Esquema: `packages/db/src/schema/*.ts` del core no importa `schema/modules/`.
4. FKs: suite `.neon.integration` que consulta `information_schema` y falla si una tabla de un esquema del core tiene FK
   hacia un esquema de modulo.
5. Rutas: ningun id del registro coincide con un directorio de `app/backoffice/` ni de `app/api/` (fuera de los
   despachadores).
6. Completitud: cada modulo del registro tiene entrada en `server-registry` y en `ui-registry`.

## Archivos

| Archivo | Accion |
|---|---|
| `apps/merchant/src/modules/{stock,recipes}/manifest.ts`, `{stock,recipes}/server/routes.ts` | crear |
| `apps/merchant/src/modules/registry.ts`, `server-registry.ts`, `ui-registry.ts`, `navigation.ts`, `permissions.ts`, `guard.ts` | editar / crear |
| `apps/merchant/src/modules/toggle-route.ts` (+test) | borrar |
| `apps/merchant/src/app/api/modules/[moduleId]/[[...path]]/route.ts` | crear |
| `apps/merchant/src/app/api/modules/{stock,recipes}/**`, `[moduleId]/route.ts` | borrar |
| `apps/merchant/src/app/api/modules/route.ts` | editar (guard + campos) |
| `apps/merchant/src/app/backoffice/[module]/[[...path]]/page.tsx` | crear |
| `apps/merchant/src/server/api-member.ts`, `api-permission.ts`, `staff-permissions.ts`, `session-view.ts` | crear / editar |
| `packages/db/src/permissions-catalog.ts`, `schema/membership.ts`, `drizzle/0078_*` | editar / crear |
| tests: boundary, despachador, permisos, migracion | crear / editar |

## Plan de pruebas

Presupuesto: < 25 min de suites. Clases de error: **acoplamiento oculto**, **fuga entre comercios o permisos**,
**regresion de los contratos de Stock y Recetas**, **migracion de permisos mal**.

1. Las suites existentes de modulos (Neon: registry, stock, stock-entries, stock-concurrency, stock-draft, recipes,
   recipes-draft) siguen verdes **sin tocar sus aserciones**; solo cambia como llaman al handler (el despachador).
2. Despachador: ruta inexistente 404, metodo equivocado 405, sin permiso 403 `missing_permission` antes de mirar el
   modulo, modulo apagado 403, toggle por `PUT` sin path; params con uuid ajeno → 404 del handler.
3. Permisos: staff con `stock` sin `catalog` usa Stock; con `catalog` sin `stock` → 403; otorgar `recipes` con Recetas
   apagado → 422; conservarlo no falla; owner tiene todos; permiso desconocido 422.
4. Migracion 0078 en local y CI: integrante con `catalog` → `+stock,+recipes`; el `CHECK` rechaza `"Stock"` y `"a b"`.
5. `GET /api/modules` como staff sin `catalog` → 200 con `navigation`/`permissions`.
6. Pantallas: `/backoffice/stock` y `/backoffice/recipes` responden igual que hoy (contra `next dev`); modulo apagado → 404.
7. Frontera: las 6 reglas verdes y cada una con su mutacion en rojo (bitacora).
8. typecheck + lint + unit del paquete; e2e de Stock/Recetas/modulos verdes (son de GPT; si alguno se rompe por esta
   parte, se informa, no se edita).

## DoD

Todo lo anterior con salida real; contratos HTTP de 0210/0212/0214 sin cambios; migracion 0078 en local y CI (PROD con
OK del owner). Despues: encargo a GPT (pantallas a `modules/<id>/ui/`, menu y Ajustes desde manifiestos) y revisor
adversarial sobre las dos partes. No se marca `implementada` sin el PASS.

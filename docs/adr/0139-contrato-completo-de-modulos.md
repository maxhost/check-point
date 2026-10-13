---
adr: 0139
fecha: 2026-10-13
estado: aceptada
resumen: El contrato COMPLETO de modulos (amplia el ADR 0138, que solo cubria servidor y base). Agregar un modulo no toca ningun archivo del core: un modulo es una carpeta `modules/<id>/` con manifiesto, servidor, pantallas y esquema propio; el core tiene UN despachador de pantallas (`app/backoffice/[module]/…`) y UNO de API (`app/api/modules/[moduleId]/…`) que le preguntan al registro; menu, Ajustes y permisos salen de los manifiestos; los permisos de modulo los declara el modulo y la base solo valida su forma. Tests vigilan core→modulo (codigo y pantallas), FKs core→modulo y choques de rutas. Guia operativa: `docs/MODULOS.md`.
---

# 0139 — El contrato completo de modulos

## Contexto

- ADR 0138 (2026-10-12) definio el contrato del SERVIDOR: el core no importa modulos, esquema propio, activacion
  generica, dependencias, apagar no borra. Medido el 2026-10-13 (`docs/plan-modulos-plugin-2026-10-13.md`): servidor y
  base de Stock y Recetas cumplen; las PANTALLAS no — el menu nombra `stock`/`recipes`
  (`backoffice-navigation.tsx:77-88`), las pantallas viven en `app/backoffice/{stock,recipes}/`, Ajustes los conoce
  (`settings/module-navigation.ts`) y el test de frontera no mira pantallas. El POS esta acoplado en 26 archivos.
- Owner 2026-10-13: «todo debe seguir el mismo patron a futuro» y revision adversarial de que «realmente queden
  desacoplados». Decisiones del owner (no volver a preguntar): tablas de modulo en esquema propio (tambien el POS),
  cada modulo declara sus permisos, todas las rutas de modulo bajo `/api/modules/<id>/…`, las pantallas las mueve GPT
  con encargo, Stock y Recetas con permisos propios (a quien hoy tiene `catalog` se le asignan los nuevos).

## Decision

### 1. Un modulo es UNA carpeta

```
apps/merchant/src/modules/<id>/
  manifest.ts      ← PURO (sin servidor ni base): lo que el modulo declara; lo leen cliente y servidor
  server/          ← logica y handlers de API (solo servidor)
  ui/              ← pantallas y paneles (GPT)
packages/db/src/schema/modules/<id>.ts   ← su esquema Postgres propio (`pgSchema("<id>")`)
```

Un modulo puede importar del core y de los modulos que declara en `requires`. Nada mas.

### 2. El manifiesto

```ts
{
  id, name, description,
  requires: string[],            // modulos que tienen que estar encendidos (409 module_requires)
  suggestedFor: string[],        // gcid del rubro: sugerido, no encendido
  permissions: { id, label, description }[],   // permisos propios (§5)
  navigation: { path, label, icon, permission }[],   // entradas del menu; `path` relativo a /backoffice/<id>
  settingsPanel?: true,          // aporta un panel a Ajustes (lo dibuja `ui/`)
}
```

Lo que el POS va a necesitar (`fullscreen`, `startPage` de la PWA, `locationActions`, `canDisable`) se agrega al
manifiesto en la spec del POS con este mismo criterio: el core ofrece el punto de enganche, el modulo lo declara.

### 3. Los registros son la unica puerta

- `modules/registry.ts` — los MANIFIESTOS (puro; lo importan menu, Ajustes, permisos, el despachador).
- `modules/server-registry.ts` — por modulo, su tabla de rutas de API (`{ method, path, handler }`). Solo servidor.
- `modules/ui-registry.ts` — por modulo, sus pantallas y su panel de Ajustes.

Agregar un modulo = crear su carpeta + **una linea en cada registro**. Ningun otro archivo del core cambia.

### 4. Dos despachadores en el core, cero archivos de ruta por modulo

- **Pantallas**: `app/backoffice/[module]/[[...path]]/page.tsx` busca el modulo en el registro, exige que este
  encendido para el negocio (si no, 404) y dibuja la pantalla que declara `ui-registry` para ese `path`. Las URLs no
  cambian (`/backoffice/stock`). Next prioriza los segmentos fijos del core sobre `[module]`, asi que un id de modulo
  igual a una ruta del core quedaria tapado: un test lo prohibe (§7).
- **API**: `app/api/modules/[moduleId]/[[...path]]/route.ts` despacha a la tabla de rutas del modulo. El toggle
  (`PUT /api/modules/:id` sin `path`) lo atiende el core. Se borran las carpetas fijas `app/api/modules/{stock,recipes}/`
  — con ellas desaparece la trampa de Next del 405 (`toggle-route.ts` deja de hacer falta).
- El guard (permiso del modulo + modulo encendido) lo aplica el despachador, una vez, antes de llamar al handler.

### 5. Permisos de modulo

- El core conserva sus permisos (`packages/db/src/permissions-catalog.ts`). El catalogo VALIDO = core + los
  `permissions` de todos los manifiestos (lo arma la app; `packages/db` no puede leer el registro de `apps/`).
- **La base valida la FORMA, no la pertenencia**: el `CHECK` cerrado de `core.business_membership.permissions` pasa a
  `cada elemento ~ '^[a-z][a-z_]{0,39}$'`. Agregar un modulo con permisos ya no migra el core. Pertenencia: la valida
  `staff-permissions.ts` contra el catalogo valido (un permiso desconocido sigue siendo 422).
- Un permiso de un modulo APAGADO queda sin efecto (como hoy `pos`) y no se puede OTORGAR (422, como
  `assertPosGrantable`), generalizado para todo modulo.
- Stock y Recetas declaran `stock` y `recipes`. Migracion de datos: todo integrante con `catalog` recibe `stock` y
  `recipes` (nadie pierde acceso). El owner los tiene implicitamente (`allPermissions` incluye los de modulo).
- `pos` sigue en el core hasta su spec (Fase 2 del plan).

### 6. Menu y Ajustes salen de los manifiestos

- El menu del backoffice dibuja, para cada modulo ENCENDIDO, sus `navigation` filtradas por permiso. No nombra ningun
  modulo. `GET /api/modules` devuelve tambien `navigation` y `permissions` de cada uno.
- Ajustes lista los modulos (switch, dependencias, sugerido) y, para los encendidos con `settingsPanel`, dibuja su panel
  desde `ui-registry`.

### 7. La frontera se vigila con tests (cada uno con su mutacion vista en rojo)

1. Ningun archivo fuera de `modules/` importa `modules/<id>/…` (solo los tres registros y `modules/guard`).
2. Ningun archivo del core —servidor NI pantalla— contiene el id de un modulo como ruta o literal de modulo
   (`"/backoffice/stock"`, `"stock"` como id de modulo): se barre con la lista de ids del registro.
3. Ningun archivo de `packages/db/src/schema/` fuera de `schema/modules/` importa de `schema/modules/`.
4. Ninguna FK de una tabla del core apunta a un esquema de modulo (consulta a `information_schema` en la rama de CI).
5. Ningun id de modulo coincide con un segmento de `app/backoffice/` ni de `app/api/` del core.
6. Cada modulo del registro tiene `manifest`, entrada en `server-registry` y en `ui-registry` (o declara que no tiene
   pantallas/API).

Excepciones permitidas, nombradas en el test: los tres registros, `packages/db/src/schema.ts` y `drizzle.config.ts`.

## Consecuencias

- Un modulo nuevo es una carpeta y tres lineas. Borrar uno es borrar la carpeta y las tres lineas (los datos quedan).
- Las pantallas de Stock y Recetas se mudan a `modules/{stock,recipes}/ui/` (GPT, Fase 1); sus URLs no cambian.
- Las rutas de API de Stock y Recetas no cambian de URL; cambian de archivo (del arbol `app/` al `server/` del modulo).
- El POS (Fase 2) se mide contra este contrato; lo que le falte al contrato se agrega por ADR, no por excepcion.
- Limite declarado (igual que el 0138): un solo deploy; un error de compilacion en un modulo rompe el build.

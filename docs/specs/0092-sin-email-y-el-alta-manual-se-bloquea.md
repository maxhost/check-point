---
spec: 0092
fecha: 2026-09-23
estado: cerrada
resumen: Implementa los ADR 0085 y 0086. (1) Se ELIMINA el aviso por email de la importacion — modulo, copys, tests, las dos llamadas de `finish.ts` y la columna `notified_at` con su migracion. (2) Mientras hay una importacion ABIERTA, crear categoria o producto a mano devuelve 409 desde el SERVIDOR; `GET /api/catalog` suma `importInProgress` y la pantalla lo refleja. Cierra la carrera del 23505 de categoria y la del producto duplicado.
disjunta: si
archivos: apps/merchant/src/server/catalog-import/**, apps/merchant/src/server/catalog/**, apps/merchant/src/app/api/catalog/**, apps/merchant/src/app/backoffice/catalog/**, apps/merchant/drizzle/**
---

# 0092 — Sin email, y el alta manual se bloquea durante una importacion

> Implementa el **ADR 0085** (el email se elimina) y el **ADR 0086** (el alta manual se bloquea).
> **Plantilla grande (ADR 0071): lleva migracion.** Las dos decisiones las tomo el owner el
> 2026-09-23 y estan textuales en sus ADR.

## Problema

**1. Un aviso que nadie pidio, y que sostiene un hueco de verificacion.** `notify.ts` manda un
email al terminar la importacion. La mitad «una sola vez» de ese aviso (`notified_at is null` en
el `WHERE`) **no tiene oraculo**: el doble de `./db` de su suite ignora el `where`, asi que
ningun test de unidad puede verla, y la mitad «despues del resultado final» necesito un archivo
Neon propio. El owner, al preguntarle como cerrarlo, contesto que nunca pidio la funcion.

**2. Dos carreras contra el writer.** El writer relee el catalogo dentro de su transaccion y
despues inserta; en esa ventana otra sesion puede escribir. La de **categoria** produce un 23505
que el codigo recupera —mecanismo ejecutado, *interleaving* sin oraculo— y la de **producto**
puede dejar un duplicado, declarada afuera por la 0091 porque evitarla costaba serializar.

## Alcance

**Entra:**

- borrado del aviso por email: `catalog-import/notify.ts`, `catalog-import-notify.test.ts`, el
  oraculo de cableado `catalog-import-finish-notify.neon.integration.test.ts`, las dos llamadas
  de `finish.ts`, los copys y toda mencion en el contrato;
- borrado de la columna `notified_at` **con su migracion generada por `drizzle-kit`**;
- guard de servidor: `createCategory` y `createProduct` devuelven **409** si el negocio tiene un
  import abierto, con `code: "catalog_import_in_progress"`;
- `CatalogError` gana un `code` **opcional** y la ruta lo emite cuando existe;
- `GET /api/catalog` suma `importInProgress: boolean`;
- la pantalla de catalogo deshabilita el alta y explica por que.

**No entra:**

- tocar `server/email/**` (lo usan recuperacion de contraseña y alta de staff);
- bloquear **editar, renombrar o borrar**: no compiten con el writer, que es solo aditivo;
- borrar la recuperacion del 23505 del writer: es la red que cubre lo que el guard no ve;
- un lock por negocio (descartado por el ADR 0084 y otra vez por el 0086);
- push al backoffice (fuera desde el ADR 0082 §12);
- cambiar estados, cupos, limites, proveedor ni el DTO del import mas alla de lo dicho.

## Diseño

### 1. El email se va entero

`finishAnalysis` y `failImport` dejan de llamar a nada. No queda un flag, ni un modulo, ni una
columna: el ADR 0085 pidio eliminar, no apagar.

`catalog-import-finish-notify.neon.integration.test.ts` **se borra con la funcion**. Existia para
pinnear «el aviso sale despues del resultado final»; sin aviso, no hay invariante. Borrar el
oraculo junto con lo que pinnea es correcto — dejarlo seria un test que afirma sobre codigo
muerto.

### 2. La columna y el ORDEN de despliegue

`notifiedAt` sale del esquema drizzle y la migracion la genera **`drizzle-kit generate`**, nunca
a mano.

**El orden no es opcional (gotcha medido, spec 0081): DEPLOY PRIMERO, MIGRACION DESPUES.** El
codigo que corre hoy en produccion **escribe** `notified_at`; aplicar el `DROP COLUMN` antes del
deploy le rompe la importacion al codigo viejo. Como ademas nada esta pusheado todavia, el orden
real es: pushear → esperar el deploy `READY` → aplicar la migracion.

### 3. El guard, que vive en el SERVIDOR

Una sola funcion, `assertNoOpenImport(businessId)`, que consulta si hay un import en un estado
de `CATALOG_IMPORT_OPEN_STATUSES` y tira `CatalogError(409, …, "catalog_import_in_progress")`.
La llaman **`createCategory` y `createProduct`**, y nadie mas.

**Por que las dos y no solo productos (ADR 0086):** la carrera del 23505 es de **categorias**, y
crear un producto a mano no crea ninguna. Bloquear productos cierra la carrera del duplicado;
bloquear categorias cierra la del 23505. Las dos cierran las dos.

`updateProduct`, `renameCategory`, `deleteProduct` y `deleteCategory` **no** lo llaman: el writer
es estrictamente aditivo y no compite con ellas.

### 4. La pantalla

`GET /api/catalog` devuelve `importInProgress`. La pantalla deshabilita los botones de alta y
dice por que. **No es el guard**: es su reflejo. El 409 sigue siendo la proteccion.

## Archivos

| Archivo | Accion |
|---|---|
| `server/catalog-import/notify.ts` | **borrar** |
| `server/catalog-import-notify.test.ts` | **borrar** |
| `server/catalog-import-finish-notify.neon.integration.test.ts` | **borrar** |
| `server/catalog-import/finish.ts` | editar (fuera las dos llamadas y el import) |
| `server/schema/catalog-import.ts` | editar (fuera `notifiedAt`) |
| `drizzle/00XX_*.sql` | **crear** con `drizzle-kit generate` |
| `server/catalog/core.ts` | editar (`CatalogError` gana `code` opcional) |
| `server/catalog/import-guard.ts` | **crear** (`assertNoOpenImport`) |
| `server/catalog/categories.ts` · `catalog/products.ts` | editar (llaman al guard) |
| `app/api/catalog/_auth.ts` | editar (`catalogError` emite `code`) |
| `app/api/catalog/route.ts` o `catalog/products.ts:listCatalog` | editar (`importInProgress`) |
| `app/backoffice/catalog/*` | editar (refleja el bloqueo) |
| `server/catalog-import-routes.test.ts` · `-contract.test.ts` | editar (fuera `notifiedAt` del seed) |
| `server/catalog-import-guard.neon.integration.test.ts` | **crear** |
| `docs/specs/0090-contratos-de-api.md` | editar, **mismo commit** |

## Definition of Done

- [ ] `rg -n "notifyImportFinished|notifiedAt|notified_at" apps/merchant/src` → **vacio**.
- [ ] `rg -n "catalogImportEmail" apps/merchant/src` → **vacio**; `server/email/**` intacto.
- [ ] La migracion la genero `drizzle-kit` y hace `DROP COLUMN notified_at`; ninguna otra tabla.
- [ ] Con un import `queued`/`analyzing`: `POST /api/catalog/category` y `POST /api/catalog/product`
      → **409** con `code: "catalog_import_in_progress"` (Neon).
- [ ] Con el import `accepted`/`failed`/`cancelled`/`expired`: las dos altas → **201** (Neon).
- [ ] **Editar, renombrar y borrar siguen funcionando** con un import abierto (Neon).
- [ ] El guard es por negocio: un import abierto de OTRO negocio **no bloquea** (Neon).
- [ ] `GET /api/catalog` trae `importInProgress` y **ninguna clave interna** del import.
- [ ] Gates de root con Node 24: `typecheck`, `lint`, `test`, `format:check`, `build`.
- [ ] **`pnpm test:e2e` APLICA** (se toca `.tsx`) y se corre.
- [ ] `rg -n MUTATION apps tools` → vacio.

## Mutaciones — presupuesto: 4. Clase: los plausibles

| # | Mutacion | Oraculo que tiene que ponerse ROJO |
|---|---|---|
| 1 | El guard mira solo `analyzing` en vez de todos los estados abiertos | un import `queued` deja pasar el alta |
| 2 | El guard pierde su `eq(businessId)` | el import abierto de otro negocio bloquea a este |
| 3 | `createProduct` deja de llamar al guard (cableado, no regla) | el alta de producto pasa con un import abierto |
| 4 | El 409 pierde el `code` | la pantalla no puede distinguirlo de otro conflicto |

**La 3 es la del ADR 0071 §2.0-quater**: la regla puede tener su test y no estar llamada por
nadie. Hay **dos** llamadores, asi que el cableado se muta en los dos.

**Protocolo:** `shasum` limpio antes de mutar → fila de bitacora **antes** de medir → etiqueta
`MUTATION` → medir y transcribir lo ejecutado → revertir con `diff`. De a una, leyendo la
asercion del rojo.

## Declarado AFUERA (sin oraculo, a proposito)

- **La ventana no se cierra del todo.** El guard mira el estado en el instante del alta; dos
  requests exactamente simultaneas siguen pudiendo cruzarse. Por eso la recuperacion del 23505
  **no se borra**. Cerrarla de verdad exige el lock por negocio, descartado dos veces.
- **El *interleaving* real del 23505 sigue sin test.** El ADR 0086 eligio volver la carrera
  improbable en vez de pinnearla; la receta de la sonda queda en `TASKS.md` por si se retoma.
- **Que el merchant entienda el copy del bloqueo** lo dice el QA, no un test.

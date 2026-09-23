---
spec: 0091
fecha: 2026-09-23
estado: implementada — su §7 (el aviso por EMAIL) fue ELIMINADO por el ADR 0085 / spec 0092 el 2026-09-23
resumen: Implementa el ADR 0084. La importacion deja de producir un borrador revisable y pasa a escribir el catalogo en una transaccion: concilia contra el catalogo actual, reusa categorias, omite productos existentes, crea lo que falta, deja sin precio lo que no parsea y descarta lo ilegible listandolo en el resumen. Se BORRAN el borrador, `PUT /draft`, `POST /accept` y el estado `ready`. Cero migraciones, cero `.tsx`.
disjunta: si
archivos: apps/merchant/src/server/catalog-import/**, apps/merchant/src/app/api/catalog/imports/**, docs/specs/0090-contratos-de-api.md
---

# 0091 — La importacion de catalogo escribe directo

> Implementa el ADR 0084. **Plantilla CHICA (ADR 0071):** un solo dominio (`catalog-import`),
> **sin migraciones**, y las decisiones de producto las cerro el owner el 2026-09-23.

## Problema

1. **El merchant termina revisando el menu entero.** `finish.ts:52-58` deja el import en `ready`
   con un borrador de ~90 productos y el catalogo no se toca hasta que alguien acepta
   (`accept.ts:31-92`). El producto prometia ahorrar la carga a mano y la devuelve con otra forma.
2. **La mitad del dominio existe solo para sostener ese paso.** `draft.ts` (273 lineas) construye
   resoluciones, `duplicateCandidate` e `include`; `draft-save.ts` (98) los persiste; dos rutas
   (`imports/[id]/draft`, `imports/[id]/accept`) los exponen; `draft_version` y
   `catalog_import_version` versionan una edicion que nadie va a hacer.
3. **Un duplicado hoy es un 409, no una omision.** `accept.ts:218-231` convierte el 23505 de
   `core_product_category_name_unique` en `catalog_import_conflict` y manda a revisar de nuevo:
   la segunda importacion del mismo menu **falla** en vez de no hacer nada.
4. **Un reload pierde el resultado.** `activeImport` (`core.ts:70-85`) solo devuelve imports en los
   cuatro estados abiertos: cuando el import termina, la pantalla que vuelve no encuentra nada.

## Alcance

**Entra:**

- clave canonica unica + plan aditivo puro (categorias y productos) contra el catalogo actual;
- el writer transaccional que escribe el catalogo al terminar el analisis, sin paso del cliente;
- precio parseado **en el servidor** a partir del texto impreso; lo que no parsea nace `null`;
- descarte de items ilegibles, listados en el resumen;
- resumen persistido y servido por el `GET`; `GET /api/catalog/imports` devuelve el ultimo import;
- **borrado** de borrador, `PUT /draft`, `POST /accept`, estado `ready` y sus codigos de error;
- prompt y JSON Schema del proveedor en `v2` (texto del precio en vez de decision del modelo);
- `docs/specs/0090-contratos-de-api.md` actualizado en el mismo commit que el codigo.

**No entra:**

- actualizar o borrar nada existente del catalogo (la operacion es solo aditiva);
- deshacer una importacion, historial de importaciones, tabla de trazabilidad;
- contexto del catalogo existente en el prompt (el ADR 0084 §2 lo elimina);
- lock por negocio, unique nuevo en `product`, fuzzy matching, embeddings;
- modificadores, tamaños, variantes;
- cambiar cupos, limites de archivo, R2, callback, proveedor o modelo;
- **cualquier `.tsx` o CSS**: la pantalla la hace el owner (ADR 0070).

## Diseño

### 1. Estados

`pending_upload → queued → analyzing → accepted | failed | cancelled | expired`.

`ready` **deja de escribirse**. No se toca el `check` ni el indice unico parcial de la tabla (por eso
no hay migracion); queda como valor legacy inalcanzable. `accepted` es el terminal de exito y
significa «importado».

### 2. Clave canonica (`catalog-import/plan.ts`)

`matchKey(value)` = `normalize("NFKD")` → quitar marcas → `toLowerCase()` → toda puntuacion y
separador a espacio → colapsar espacios → `trim()`. Se usa **solo** para conciliar la importacion;
no cambia el indice unico real ni la validacion normal del catalogo. No es fuzzy.

### 3. Plan aditivo (funcion pura, sin base)

Entrada: la extraccion normalizada + el catalogo actual (`{categories:[{id,name,createdAt}],
products:[{id,name,categoryId}]}`). Salida: `{categoriesToCreate, categoryIdByExtractedKey,
productsToCreate, skipped, discarded}`.

- **Categoria:** match canonico contra existentes → reusar. Empate entre dos existentes → **la de
  `createdAt` menor** (determinista, y reusar nunca destruye). Sin match → crear. Dos categorias
  extraidas con la misma clave se agrupan en una, en orden de primera aparicion. Una categoria
  nueva sin un solo producto a crear **no se crea**.
- **Producto:** se compara **solo** contra productos existentes de la categoria conciliada y contra
  los ya planificados por esta misma importacion. Match → `skipped`. Sin match → crear. Mas de un
  existente igual → `skipped` (no hay que elegir: no se modifica ninguno).
- El producto de una categoria nueva **no** se compara con productos de otras categorias.

### 4. Precio: lo decide el servidor

El proveedor devuelve `priceText` (el fragmento impreso, tal cual) y ya **no** decide el estado del
precio. El servidor parsea con una regla unica y testeada:

- se aceptan digitos, `.` y `,`; el ultimo separador seguido de **exactamente 2** digitos es el
  decimal, cualquier otro separador es de miles;
- mas de un candidato a decimal, cero digitos, signo, rango (`3-5`), o algo que no parsea →
  **`unitPrice = null`**;
- el resultado se valida con `parseOptionalMoney` (`catalog/validation.ts`), que ya es el parser de
  dinero del repo.

**Nunca `0`.** Un producto sin precio es seguro: `counter/grant.ts:154-163` le pide el precio al
operador cuando el producto no lo tiene.

### 5. Descartes

Un item se **descarta** (no entra al catalogo) cuando su nombre queda vacio despues de sanitizar,
supera `MAX_PRODUCT_NAME`, o su fila no cumple el esquema propio. Va al resumen como
`{ text, reason }` con `reason ∈ {"unreadable_name","invalid_row"}`, `text` sanitizado y recortado a
120 caracteres, **maximo 50 items** (el resto se cuenta en `discardedCount`).

Una categoria entera invalida descarta sus productos con `reason: "invalid_row"`.

### 6. El writer transaccional (`catalog-import/write.ts`, ex `accept.ts`)

Lo llama `finishAnalysis` cuando el resultado del proveedor aterriza. **No hay ruta que lo dispare**
y no se llama a nuestra propia API por HTTP. Dentro de UNA transaccion:

1. `SELECT … FOR UPDATE` del import por `(id, business_id)`;
2. si ya esta `accepted`, devolver el resumen guardado y no escribir nada (idempotencia del
   callback + reconciliador, igual que hoy);
3. si no esta en `queued`/`analyzing`, no-op (cancelado o terminal);
4. **releer** categorias y productos del negocio **dentro de la transaccion** (el catalogo pudo
   cambiar mientras el proveedor trabajaba);
5. construir el plan aditivo contra esa lectura;
6. insertar categorias nuevas; **un 23505 de `core_product_category_name_unique` se resuelve
   releyendo esa categoria y reusandola**, no fallando;
7. insertar productos en bulk, sin filas de `product_location` (nacen disponibles en todos los
   locales);
8. escribir `status = 'accepted'`, `accepted_at`, `accepted_summary`;
9. commit. **Despues** del commit: cleanup de R2 y email.

Sin llamadas al proveedor, a R2 ni al email adentro de la transaccion.

### 7. `finishAnalysis` y la notificacion

`finishAnalysis` valida la extraccion, **persiste la extraccion cruda en la columna `draft`** —que
deja de ser un borrador editable y pasa a ser el resultado guardado para diagnostico, y sigue siendo
el discriminante del cupo `analyses` (`quota.ts:60-70`)— y llama al writer en la misma invocacion.

> **SUPERADO (ADR 0085, 2026-09-23): el aviso por email SE ELIMINO.** No existe `notify.ts`, ni
> los copys, ni la columna `notified_at`. Lo de abajo describe lo que esta spec construyo, y se
> deja como registro historico. Hoy el merchant se entera por la pantalla, que polea y muestra el
> `result`; el motivo esta en el ADR 0085.

El email se manda **una sola vez y despues del resultado final**: `notified_at` se reclama recien
cuando el import quedo `accepted` o `failed` (hoy se reclama al pasar a `ready`, `finish.ts:90`). Dos
copys: «Tu menu ya esta en el catalogo» y el de fallo que ya existe.

### 8. Reconciliador

Se le **quita el re-submit**: un `queued` que quedo sin submitear pasa a `failed` («volve a
intentarlo»), no se vuelve a mandar al proveedor. Se **conserva** el poll de los `analyzing` con
lease vencido —ir a buscar un resultado ya pagado cuando el webhook se perdio no es un reintento— y
por lo tanto `MAX_ATTEMPTS` deja de gobernar submits y solo acota los polls.

### 9. Contrato HTTP resultante

| Ruta | Cambio |
|---|---|
| `POST /api/catalog/imports` | sin cambios |
| `POST /api/catalog/imports/{id}/uploads` | sin cambios |
| `POST /api/catalog/imports/{id}/analyze` | sin cambios (202) |
| `GET /api/catalog/imports/{id}` | el DTO pierde `draft` y gana `result` |
| `GET /api/catalog/imports` | devuelve **el ultimo import del negocio** (abierto o terminal), o `null` si nunca importo |
| `DELETE /api/catalog/imports/{id}` | sin cambios; `accepted` sigue dando 409 y **no es deshacer** |
| `PUT /api/catalog/imports/{id}/draft` | **se borra** (404 por inexistencia de la ruta) |
| `POST /api/catalog/imports/{id}/accept` | **se borra** |

DTO (allow-list cerrada, se construye campo por campo):

```jsonc
{
  "import": {
    "id": "uuid",
    "status": "accepted",
    "sourceKind": "pdf",
    "fileCount": 1,
    "pageCount": 7,
    "expiresAt": "…",
    "result": {
      "categoriesCreated": 12,
      "categoriesReused": 2,
      "productsCreated": 86,
      "productsSkipped": 4,
      "productsWithoutPrice": 3,
      "discardedCount": 4,
      "discarded": [{ "text": "Milanesa …", "reason": "unreadable_name" }]
    },
    "error": null
  }
}
```

`result` es un objeto **solo** en `accepted`; en cualquier otro estado es `null`. Nunca viajan
`objectKey`, `providerJobId`, `providerRequestId`, tokens, costo, la extraccion cruda ni
`failureDetail` fuera de `error`.

**Codigos de error que se borran** de la lista cerrada (`types.ts:27-42`): `catalog_import_version`,
`unresolved_catalog_import`, `invalid_catalog_draft`, `catalog_import_conflict`. El resto queda
igual. Autorizacion y aislamiento no cambian: mismo guard por permiso `catalog`, y un import ajeno
devuelve el **mismo 404** que uno inexistente.

### 10. Proveedor

`CATALOG_EXTRACTION_SCHEMA_VERSION` pasa a `v2` y el prompt sube de version: el producto devuelve
`{ sourceId, name, priceText }` y ya **no** `unitPrice`/`priceStatus`. Siguen valiendo: el documento
es **dato y no instrucciones**, tools vacias, Structured Outputs, y la salida se valida igual contra
el esquema propio (`validateProviderExtraction`). El adaptador `fake` refleja el mismo contrato,
incluyendo un `priceText` que no parsea y un item ilegible, para que los dos caminos se puedan
probar sin gastar un centavo.

## Archivos

| Archivo | Accion |
|---|---|
| `server/catalog-import/plan.ts` | **crear** (clave canonica + plan aditivo + parseo de precio, puro) |
| `server/catalog-import/write.ts` | **crear** (el writer transaccional; reemplaza `accept.ts`) |
| `server/catalog-import/accept.ts` | **borrar** |
| `server/catalog-import/draft.ts` | **borrar** |
| `server/catalog-import/draft-save.ts` | **borrar** |
| `app/api/catalog/imports/[id]/accept/route.ts` | **borrar** |
| `app/api/catalog/imports/[id]/draft/route.ts` | **borrar** |
| `server/catalog-import/types.ts` | editar (fuera el borrador; entra `ImportResult`; codigos de error) |
| `server/catalog-import/finish.ts` | editar (persiste extraccion, llama al writer, notifica al final) |
| `server/catalog-import/core.ts` | editar (DTO con `result` sin `draft`; `activeImport` → ultimo import) |
| `server/catalog-import/validation.ts` | editar (extraccion `v2` con `priceText`; fuera lo del borrador) |
| `server/catalog-import/notify.ts` | editar (copy de «importado») |
| `server/catalog-import/reconcile.ts` | editar (sin re-submit; solo poll + cierre) |
| `server/catalog-import/providers/openai-schema.ts` · `providers/fake.ts` | editar (prompt y schema `v2`) |
| `server/catalog-import-*.test.ts` (los que tocan borrador/accept) | editar / borrar |
| `server/catalog-import-plan.test.ts` | **crear** |
| `docs/specs/0090-contratos-de-api.md` | editar, **en el mismo commit** |

**Disjunta?** Si. Ninguna otra spec abierta toca `catalog-import/**`. Colisiona con el trabajo sin
commitear de la cancelacion inmediata: **ese se commitea primero**.

## Definition of Done

- [ ] `rg -n "draft" apps/merchant/src/app/api/catalog` → sin resultados de ruta ni de DTO.
- [ ] `rg -ln "validateDraft|duplicateCandidate|draftVersion" apps/merchant/src` → vacio.
- [ ] Un import con catalogo vacio crea todo y deja `status: "accepted"` con su `result`.
- [ ] **Repetir el mismo resultado crea CERO filas** y devuelve el mismo `result`.
- [ ] Una categoria existente se reusa; un producto existente se omite **solo** dentro de su
      categoria; el mismo nombre en otra categoria **si** se crea.
- [ ] Un precio distinto del existente **no** lo actualiza (assert sobre la fila).
- [ ] `priceText` que no parsea → producto creado con `unit_price NULL`; item ilegible → **no
      creado** y presente en `result.discarded`.
- [ ] `GET /api/catalog/imports` devuelve el import ya terminado del negocio, y **nunca** el de otro.
- [ ] Un fallo entre inserts deja **cero** filas de catalogo (rollback total, verificado en Neon).
- [ ] Dos callbacks/reconciliadores concurrentes importan **una sola vez** (Neon, **ejecutado, no
      `skipped`**).
- [ ] Una categoria creada en paralelo durante el analisis se **reusa** (23505 recuperado; Neon).
- [ ] Gates de root con Node 24, una vez al final: `typecheck`, `lint`, `test`, `format:check`,
      `build`.
- [ ] **`pnpm test:e2e` NO aplica** y se demuestra: `git diff --stat` sin un solo `.tsx` ni `.css`.
- [ ] `rg -n MUTATION apps tools` → vacio.
- [ ] `docs/specs/0090-contratos-de-api.md` describe exactamente las rutas de §9.

## Mutaciones — presupuesto: 6. Clase: los plausibles

| # | Mutacion | Oraculo que tiene que ponerse ROJO |
|---|---|---|
| 1 | Conciliar contra una lectura previa a la transaccion en vez de releer adentro | un producto creado durante el analisis se duplica (Neon) |
| 2 | Comparar productos globalmente en vez de por categoria | «el mismo nombre en otra categoria si se crea» |
| 3 | Quitar el `eq(businessId)` de la relectura del catalogo | aislamiento: el import no ve ni escribe el catalogo de otro negocio |
| 4 | `priceText` no parseable → `0` en vez de `null` | «nace sin precio, nunca en cero» |
| 5 | Crear el item ilegible en vez de descartarlo | `result.discarded` + conteo de productos creados |
| 6 | El 23505 de categoria vuelve a ser `catalog_import_conflict` en vez de reusar | «una categoria creada en paralelo se reusa» (Neon) |

**Protocolo:** `shasum` limpio antes de mutar → fila de bitacora **antes** de medir → etiqueta
`MUTATION` → medir y transcribir la salida ejecutada → revertir con `diff` contra la copia limpia.
De a una. **Leer la asercion del rojo**: un rojo por el setup no prueba nada.

**Condicion de corte:** si dos vueltas seguidas terminan en «el fix abrio la siguiente», se corta y
va al owner.

## Declarado AFUERA (sin oraculo, a proposito)

- **La calidad de la extraccion.** Que el LLM lea bien un menu real no lo prueba un test unitario:
  lo mide el corpus de 15-25 menus reales que ya esta pendiente en `TASKS.md`. Esta spec no lo
  bloquea ni lo reemplaza.
- **Un precio mal leido con confianza alta** entra al catalogo y lo cobra el mostrador. Riesgo
  **aceptado por el owner** (ADR 0084); se corrige editando el producto.
- **La carrera del alta manual** contra el writer puede dejar un producto duplicado. Aceptada y sin
  test: el costo de evitarla es serializar las escrituras de catalogo del negocio.

## Handoff

**UN implementador para toda la spec, UN revisor independiente al final** (ADR 0071). El revisor
produce un `PASS` con evidencia ejecutada antes de marcar `implementada`.

## Abierto

Nada. Las tres decisiones de producto las cerro el owner el 2026-09-23: escribir directo, precio
dudoso sin precio, item ilegible descartado y listado.

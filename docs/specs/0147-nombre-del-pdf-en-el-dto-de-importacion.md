---
spec: 0147
fecha: 2026-10-03
estado: cerrada
resumen: El DTO de la importacion con IA (`CatalogImport`) suma `sourceFileName` — el `original_name` del PDF, `null` para imagenes — en TODAS las respuestas que lo devuelven, para que la tarjeta del PDF conserve su nombre al recargar (UI de la 0137). Sin migracion; la allow-list de `toImportDTO` sigue cerrada.
disjunta: si
archivos: apps/merchant/src/server/catalog-import/{core,analyze,types}.ts, apps/merchant/src/app/api/catalog/imports/{route,[id]/route}.ts, apps/merchant/src/server/catalog-import-{contract,routes}.test.ts, tests Neon de catalog-import, docs/specs/0090-contratos-de-api.md
---

# 0147 — El nombre del PDF en el DTO de la importacion con IA

## Problema

- La UI de la 0137 (`apps/merchant/src/app/backoffice/catalog/catalog-ai-import.tsx:205`) muestra
  `selectedPdfName ?? activeImport.sourceFileName`, y `catalog-ai-import-api.ts:40` ya declara `sourceFileName?: string |
  null`. Al recargar mientras se analiza, `selectedPdfName` (memoria local) no existe y el DTO no trae el campo: la tarjeta
  dice solo «PDF».
- El nombre existe: `core.catalog_import_file.original_name` (`packages/db/src/schema/catalog-import.ts:146`), escrito por
  `createImport` (`core.ts`, `originalName: file.name`) ya saneado por `validation.ts:129` (`sanitizeText`, control chars
  fuera, largo acotado). La limpieza marca la fila `deleted` sin borrarla (`cleanup.ts:77`): el nombre sobrevive.
- `toImportDTO` (`apps/merchant/src/server/catalog-import/core.ts:46`) es una allow-list sincronica sobre la fila de
  `catalog_import`; no ve los archivos.

## Decisiones del owner (2026-10-03, textual en el pedido)

«Implementa sourceFileName en las respuestas de GET /api/catalog/imports y GET /api/catalog/imports/{id}: para un import
de PDF, devuelve el original_name de su archivo; para imágenes, devuelve null. Conserva el aislamiento por negocio y la
allow-list explícita de toImportDTO: no expongas claves de R2 ni otros campos internos. Revisa si las demás respuestas que
reutilizan ese DTO deben mantener el mismo contrato.» Y: «No cambies la UI salvo que descubras una incompatibilidad real».

**Lo que resuelve el orquestador sobre «las demás respuestas»:** el contrato (`docs/specs/0090-contratos-de-api.md`) define
UN `CatalogImport` y la UI lo consume con un solo tipo, asi que el campo va en **todas** las respuestas que devuelven el
DTO, no solo en las dos GET: `POST /api/catalog/imports` (`createImport`), `DELETE /api/catalog/imports/{id}`
(`cancelImport`), `POST …/{id}/analyze` (`startAnalyze`) y las dos GET. Dos formas distintas del mismo objeto segun la ruta
serian un contrato roto a medias.

## Alcance

**Entra:** `CatalogImportDTO.sourceFileName: string | null` (siempre presente); `toImportDTO(row, sourceFileName)` con el
nombre como **segundo parametro obligatorio** (que el typecheck obligue a cada llamador a resolverlo); un lector
`importSourceFileName(businessId, row)` que devuelve `null` si `row.sourceKind !== "pdf"` y, si es PDF, el `original_name`
del archivo de `position = 0` **filtrado por `import_id` Y `business_id`**; los 9 llamadores (2 rutas GET, `createImport`
— que ya tiene el nombre saneado en mano y no consulta —, `cancelImport` ×3, `startAnalyze` ×3); el contrato en `0090`.

**No entra:** la UI (compatible: el campo opcional pasa a venir siempre); migracion o indice (el unico
`core_catalog_import_file_position_unique (import_id, position)` ya sirve la consulta); nombres de imagenes; ningun otro
campo de `catalog_import_file` (`object_key`, `declared_content_type`, `byte_size`, `status`, ids).

## Diseño

```ts
export type CatalogImportDTO = { …lo de hoy…; sourceFileName: string | null };
export function toImportDTO(row: ImportRow, sourceFileName: string | null): CatalogImportDTO
// imagenes → null siempre, aunque se le pase un nombre (la regla vive en el DTO, no en el llamador)
```

- `toImportDTO` sigue construyendose campo por campo; `sourceFileName: row.sourceKind === "pdf" ? sourceFileName : null`.
- Si un PDF no tuviera fila de archivo, `null`. Puede pasar: `createImport` inserta el import y despues, en otro
  `insert` sin transaccion comun (`core.ts`, `insert(catalogImportFiles)`), los archivos; si el segundo falla, queda un
  import PDF sin archivo. El lector no lanza en ese caso.
- El `GET` ajeno sigue en 404 antes de leer archivos (`requireImport` primero).

## Archivos

| Archivo | Accion |
|---|---|
| `apps/merchant/src/server/catalog-import/types.ts` | editar (campo) |
| `apps/merchant/src/server/catalog-import/core.ts` | editar (`toImportDTO`, lector, `createImport`, `cancelImport`) |
| `apps/merchant/src/server/catalog-import/analyze.ts` | editar (3 llamadas) |
| `apps/merchant/src/server/catalog-import.ts` | editar (re-exportar el lector si las rutas lo usan) |
| `apps/merchant/src/app/api/catalog/imports/route.ts`, `[id]/route.ts` | editar |
| `apps/merchant/src/server/catalog-import-contract.test.ts` | **reescritura declarada**: pinnea la lista exacta de claves; suma `sourceFileName` porque el contrato crece por pedido del owner |
| tests nuevos (abajo) | crear |
| `docs/specs/0090-contratos-de-api.md` | editar (el campo en el DTO) |

`core.ts` tiene 293 lineas: si el lector no entra bajo 300, va en un archivo propio (`catalog-import/source-file.ts`).

**Disjunta: si.** Zona de Claude (`apps/*/src/server/**`, `app/api/**`); la UI de GPT no se toca.

## Definition of Done

- [ ] Unitario (contrato): `toImportDTO(filaPdf, "Menú otoño.pdf").sourceFileName === "Menú otoño.pdf"`;
      `toImportDTO(filaImagenes, "x.jpg").sourceFileName === null`; la lista exacta de claves suma solo `sourceFileName`.
- [ ] Neon, por las rutas reales: `GET /api/catalog/imports` y `GET /api/catalog/imports/{id}` de un import PDF devuelven
      el `original_name` sembrado; de un import de imagenes, `null`; el cuerpo serializado no contiene la `object_key` del
      archivo ni ningun otro campo de `catalog_import_file` (barrido del JSON contra los valores sembrados).
- [ ] Aislamiento: el import PDF del negocio B pedido por A → 404, y `GET /api/catalog/imports` de A no trae el nombre de
      B; con dos negocios cuyos archivos comparten `position = 0`, cada uno recibe el suyo.
- [ ] `POST`, `DELETE` y `analyze` devuelven el mismo campo (un caso por ruta, o por funcion de dominio si la ruta ya esta
      cubierta por otro test de cableado).
- [ ] `pnpm verify` en verde con Node 24, con su tabla final.
- [ ] `rg -n MUTATION apps packages tools` → vacio.

## Mutaciones — presupuesto: 3. Clase: los plausibles

| # | Mutacion | Oraculo que tiene que ponerse ROJO |
|---|---|---|
| 1 | el lector sin el filtro `business_id` y con el `import_id` de otro import (o sin `import_id`: el primer archivo PDF de cualquiera) | Neon: cada negocio recibe SU nombre |
| 2 | `toImportDTO` devuelve el nombre tambien para `images` | unitario: imagenes → `null` |
| 3 | la ruta `GET /api/catalog/imports` pasa `null` en vez del nombre | Neon: la GET de la lista devuelve el `original_name` |

Guard hermano de M1: `requireImport` corta lo ajeno en la ruta de detalle, por eso el oraculo usa la **lista** y dos
negocios con archivos propios. M3: el tipo no la caza (`null` es valido), por eso el oraculo es el valor.

**Protocolo:** el de `protocolo-de-verificacion` (cuidado con el doble posicional de `./db` en las suites de unidad: un
`TypeError` del doble no mide nada; el cableado se mide en Neon). **Corte:** dos vueltas de «el fix abrio la siguiente» →
al owner.

## Declarado AFUERA (sin oraculo, a proposito)

- El render del nombre en la tarjeta tras recargar: es UI de GPT (la 0137 ya lo prueba con el campo opcional).

## Handoff

Un implementador, un revisor independiente con PASS antes de `implementada`. Aviso a GPT: el campo viene siempre.

## Abierto

Nada.

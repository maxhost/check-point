---
spec: 0214
fecha: 2026-10-12
estado: implementada
resumen: Dictado de recetas como el de Stock. `POST /api/modules/recipes/:productId/draft` convierte el texto dictado en un borrador de receta POR UNIDAD del producto (ingredientes emparejados con los insumos de Stock o nuevos, cantidad en unidad base, «a gusto» sin cantidad, tandas divididas). El `PUT` de la receta acepta `newItem` y `unit` para guardar el borrador en un paso. Uso registrado con `kind`. Migracion 0077.
disjunta: si
archivos: packages/db/src/schema/modules/stock.ts, packages/db/drizzle/0077_*, apps/merchant/src/modules/stock/draft*.ts, apps/merchant/src/modules/recipes/**, apps/merchant/src/app/api/modules/recipes/[productId]/draft/**
---

# 0214 — Borrador de receta desde texto (dictado)

Nivel **L2**. Base: spec 0212 (dictado de Stock, mismo patron), spec 0210 §Recetas, ADR 0138, ADR 0082.

## Decision del owner (2026-10-12)

«vamos a trabajar para que acepte dictado por IA tal cual como lo manejamos por stock. usare un input multiline para
que use el microfono, mande a un LLM y eso genera la receta organizada para que la podamos revisar y guardar».
Sin tope de uso, con conteo (decision de la 0212, vale igual).

## Problema

Armar una receta es elegir insumo por insumo y tipear gramos (`PUT /api/modules/recipes/:productId` solo acepta
`itemId` existentes en unidad base, `apps/merchant/src/modules/recipes/recipes.ts` `parseRecipeLines`). Un ingrediente
que no existe en Stock obliga a salir de la receta a crearlo.

## Alcance

**Entra:** endpoint de borrador; `PUT` ampliado (`newItem`, `unit`); columna `kind` en `stock.draft_request`;
proveedor compartido con Stock; tests.

**No entra:** pantallas (GPT), plantilla en lote para todo el catalogo, sub-recetas (descartadas por el owner),
conversion de medidas caseras con precision (la IA aproxima y el dueño corrige).

## Diseño

### `POST /api/modules/recipes/:productId/draft`

Guard: el de Recetas (`requireModuleAccess(request, "recipes")`). Producto ajeno o inexistente → 404
`product_not_found` (antes de llamar a la IA y sin registrar uso).

Entrada `{ text }` 1..2000 tras `trim` → si no, 422 `invalid_text` (sin registrar uso).

Salida `200`:
```json
{ "draft": {
    "yield": 40,
    "lines": [{ "itemId": "uuid|null", "name": "Harina", "isNew": false,
                "quantity": "25.000|null", "unit": "g|ml|unit", "sourceText": "1 kilo de harina" }],
    "unparsed": [] } }
```
- **Por UNA unidad del producto.** Si el dueño dice para cuantas unidades es lo que dicta («salen 40 medialunas»,
  «para 10 pizzas»), el modelo devuelve `yield` y el SERVIDOR divide cada cantidad por `yield` (redondeo a 3
  decimales, mitades lejos del cero; una cantidad que redondea a 0 queda `null`). Sin rendimiento dicho, `yield: 1`.
  *(Propuesta de Claude para la panaderia; el owner no lo pidio: se informa en la entrega.)*
- `unit` es la **unidad base** (`g`, `ml`, `unit`): el servidor convierte `kg` → g y `l` → ml (× 1000). La pantalla
  guarda con `unit` igual a esa base.
- `quantity: null` = ingrediente sin cantidad («oregano a gusto», «una pizca»): la pantalla exige completarla antes de
  guardar. Las medidas caseras las aproxima el modelo (cucharada ≈ 15 g/ml, cucharadita ≈ 5).
- Validacion del servidor como en la 0212: `itemId` que no es insumo ACTIVO del negocio → nuevo; unidad incompatible
  con el insumo → nuevo; unidad o cantidad invalidas → `unparsed`; maximo 50 lineas (`MAX_RECIPE_LINES`), el resto a
  `unparsed`; dos lineas con el mismo insumo existente se SUMAN (la receta no admite repetidos).
- El modelo recibe: nombre del producto, insumos ACTIVOS del negocio (hasta 300) y el texto; sin tools.
- Errores: 422 `invalid_text`; 404 `product_not_found`; 503 `draft_unavailable` (mismo mensaje que Stock).

### `PUT /api/modules/recipes/:productId` ampliado (compatible hacia atras)

Cada linea: `{ itemId | newItem: { name }, quantity, unit? }`.
- Sin `unit` → como hoy: `quantity` en la unidad base del insumo.
- `unit` ∈ `g | kg | ml | l | unit`; con `itemId`, tiene que corresponder a su base (kg/g → g, l/ml → ml) o 422
  `unit_mismatch` (+ `line`); la cantidad se convierte.
- `newItem` exige `unit` (422 `invalid_unit` si falta) y crea el insumo con esa base en la misma transaccion; nombre
  repetido en la misma receta (sin mayusculas) → un insumo; nombre de un insumo activo → 409 `item_name_taken`.
- `itemId` y `newItem` juntos o ninguno → 422 `invalid_line`. Repetidos (tras resolver) → 422 `duplicate_item`.
- Todo o nada (una transaccion): un error no deja insumos creados.

### Uso

Migracion 0077: `stock.draft_request.kind text not null default 'stock_entry'`, `CHECK in ('stock_entry','recipe')`.
El dictado de recetas registra `kind = 'recipe'` con la misma forma (sin texto). Recetas depende de Stock (ADR 0138),
asi que escribir en una tabla de Stock respeta la direccion de dependencias.

### Proveedor

Se reutiliza la configuracion de la 0212 (`STOCK_DRAFT_PROVIDER` → `CATALOG_EXTRACTION_PROVIDER` → `fake`,
`STOCK_DRAFT_MODEL` default `gpt-6-luna`, `STOCK_DRAFT_REASONING_EFFORT`, `OPENAI_API_KEY`). La llamada estructurada
a OpenAI se comparte (`stock/draft-openai.ts`); cada modulo pone su prompt y su esquema.

## Archivos

| Archivo | Accion |
|---|---|
| `packages/db/src/schema/modules/stock.ts`, `drizzle/0077_*` | editar / crear |
| `apps/merchant/src/modules/stock/draft-openai.ts`, `draft-provider.ts`, `draft.ts` | editar (compartir) |
| `apps/merchant/src/modules/recipes/draft*.ts`, `recipes.ts` | crear / editar |
| `apps/merchant/src/app/api/modules/recipes/[productId]/draft/route.ts` | crear |
| tests unitarios + `recipes-draft.neon.integration.test.ts` | crear |

## Plan de pruebas

Clase de error: **el servidor deja pasar algo inventado**, **fuga entre comercios**, **division por tanda mal**.
1. Unitario: normalizacion (ajeno → nuevo; kg → g; yield 40 divide; «a gusto» null; repetidos se suman).
2. Neon con proveedor inyectado: borrador correcto; producto ajeno → 404 sin fila de uso; fila `kind = 'recipe'`;
   `PUT` con `newItem` + `unit: "kg"` crea el insumo y guarda en g; `unit_mismatch`; `item_name_taken` sin dejar
   insumos; aislamiento.
3. Sonda real contra `gpt-6-luna` con 3-4 frases de receta (QA, no test del repo).
4. typecheck + lint.

## Medido (2026-10-12)

- Unitarios 5 (`recipes/draft.test.ts`) + Neon 5 (`recipes-draft.neon.integration.test.ts`) verdes; los existentes de
  Recetas (15 Neon, `parse.test.ts`) siguen verdes sin tocarlos. M7 (no dividir por `yield`) mordio en unitarios y Neon,
  revertida con el mismo shasum.
- Sonda real `gpt-6-luna` (scratchpad, no es test del repo): napolitana (ignora «la horneo 8 minutos», oregano sin
  cantidad), medialunas (`yield` 40), cafe con leche (cucharadita → 5 g). 2,4-4,7 s; 770-792 tokens de entrada,
  150-337 de salida.
- `recipes.ts` se partio: lectura en `read.ts` (re-exportada), guardado en `recipes.ts`.

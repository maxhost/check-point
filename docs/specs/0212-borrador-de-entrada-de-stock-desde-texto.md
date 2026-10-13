---
spec: 0212
fecha: 2026-10-12
estado: implementada
resumen: `POST /api/modules/stock/entries/draft` recibe el texto dictado por el dueño («hoy compre 1 kg de harina por 25…») y devuelve un BORRADOR de lineas en JSON (emparejadas con sus insumos) que el dueño corrige y confirma con `POST /entries`. No guarda la entrada; guarda un registro de USO por pedido (sin tope por ahora). Migracion 0076.
disjunta: si
archivos: packages/db/src/schema/modules/stock.ts, packages/db/drizzle/0076_*, apps/merchant/src/modules/stock/draft*.ts, apps/merchant/src/app/api/modules/stock/entries/draft/**
---

# 0212 — Borrador de entrada de stock desde texto (dictado)

Nivel **L2** (funcionalidad nueva con migracion; CLAUDE.md §Niveles). Base: spec 0210 §Entradas, ADR 0138, ADR 0082
(la IA nunca escribe: propone un borrador revisable).

## Decisiones del owner (2026-10-12, no volver a preguntar)

- UI de GPT: input multilinea, se le enseña al dueño a usar el **microfono del teclado**, boton **«Analizar»** que manda
  el texto; el resultado vuelve en JSON «como con el menu» para mostrar el resumen y que el dueño **acepte o corrija**.
- **Sin limite de uso por ahora** («para que podamos medir el uso normal antes de poner un tope»), pero **se guarda en
  la base un conteo de uso** para leerlo despues desde el portal de admin, y tiene que ser **facil agregarle el tope**.

## Problema

Cargar una compra de varias cosas es tipear cada linea. El dueño quiere decirla en una frase. La API ya guarda una
entrada de varias lineas (`POST /api/modules/stock/entries`), pero no hay nada que convierta la frase en lineas.

## Alcance

**Entra:** el endpoint de borrador, el proveedor (OpenAI por `fetch`, como la importacion del catalogo) y un falso
para tests, la tabla de uso `stock.draft_request`, tests.

**No entra:** transcripcion de audio en el servidor (el texto lo dicta el teclado del telefono), tope de uso, pantalla
del portal de admin, pantallas (GPT), guardar el borrador.

## Diseño

### `POST /api/modules/stock/entries/draft`

Guard: `requireModuleAccess(request, "stock")` (permiso `catalog` + modulo encendido), igual que el resto de Stock.

Entrada: `{ text: string }`, 1..2000 caracteres tras `trim` → si no, 422 `invalid_text`.

Salida `200`:
```json
{
  "draft": {
    "lines": [
      { "itemId": "uuid|null", "name": "Harina", "isNew": false, "quantity": "1.000", "unit": "kg",
        "totalCost": "25.00|null", "sourceText": "1kg de harina por 25 dolares" }
    ],
    "unparsed": ["texto que no se pudo leer como compra"]
  }
}
```
- Cada linea tiene la forma que `POST /entries` acepta despues de que el dueño la revisa: con `itemId` → linea de
  insumo existente; con `isNew: true` (`itemId: null`) → `newItem: { name }`. La pantalla arma el cuerpo de `/entries`.
- `unit` ∈ `g | kg | ml | l | unit`. `quantity` y `totalCost` como string decimal (`totalCost` puede ser null si el
  dueño no dijo el precio). `totalCost` es el TOTAL de esa linea («un carton de 30 huevos por 4» → `quantity "30"`,
  `unit "unit"`, `totalCost "4.00"`).
- **El servidor valida todo lo que devuelve el modelo** (lo que prometa `strict: true` no alcanza, ADR 0082): un
  `itemId` que no es un insumo ACTIVO del negocio se convierte en `isNew: true` con su nombre; una unidad fuera de la
  lista, una cantidad que no es decimal > 0 o un costo que no es decimal ≥ 0 → la linea pasa a `unparsed` con su
  `sourceText`. Una linea con `itemId` cuya unidad base no es compatible con `unit` (kg/g → g; l/ml → ml; unit →
  unit) → `itemId: null`, `isNew: true` (el dueño decide). Maximo 30 lineas; el resto a `unparsed`.
- El modelo recibe el texto y la lista de insumos ACTIVOS del negocio (id, nombre, unidad base; hasta 300 por
  `lower(name)`), sin herramientas (`tools: []`): el texto del dueño es entrada no confiable y solo puede producir el
  JSON. Instrucciones: emparejar con un insumo existente cuando es claramente el mismo (sin distinguir mayusculas,
  singular/plural), convertir envases a la cantidad que traen cuando el texto lo dice («carton que trae treinta» → 30
  unit), no inventar precios.
- *(Ajuste 2026-10-12, QA del owner con dictado real.)* El texto es habla: muletillas, conectores y verbos sueltos («emm»,
  «hoy compre», «y ah, tambien») se IGNORAN y no van a `unparsed`. `unparsed` es SOLO un insumo mencionado que no se
  pudo convertir (p. ej. «queso» sin cantidad). Las cantidades aproximadas («creo que unos siete») se toman como el
  numero. El esquema obliga `quantity`/`totalCost` a `^[0-9]+(\.[0-9]+)?$`. Medido contra `gpt-5-mini` con las dos
  frases del owner: relleno ignorado, «queso» como unico `unparsed`, cantidades numericas.

Errores: 422 `invalid_text`; 503 `draft_unavailable` (sin proveedor configurado, error de red o del proveedor, salida
que no es JSON valido) con mensaje en español «No pudimos analizar el texto. Probá de nuevo o cargalo a mano.»; los
de guard como el resto (401/403/402, 403 `module_disabled`).

### Proveedor

`apps/merchant/src/modules/stock/draft-provider.ts`: interfaz `StockDraftProvider { id; model; draft(input) }`.
Resolucion por entorno, mismo patron que `catalogExtractionProviderFromEnv`: `STOCK_DRAFT_PROVIDER` (si falta, el de
`CATALOG_EXTRACTION_PROVIDER`; si falta, `fake`), `STOCK_DRAFT_MODEL` (default `gpt-5-mini`), `OPENAI_API_KEY`.
`openai` sin clave → `draft_unavailable` (sin fallback silencioso al falso). OpenAI: Responses API **sincrona** (sin
`background`; un texto corto entra en el tiempo de una funcion), `store: false`, `text.format` `json_schema` strict.
El falso (`fake`) devuelve un borrador vacio con todo el texto en `unparsed`: nunca inventa lineas.

### Uso (`stock.draft_request`, migracion 0076)

| columna | tipo | nota |
|---|---|---|
| id | uuid pk | |
| business_id | uuid FK `core.business` cascade | |
| created_by_user_id | text null | |
| provider | text not null | `openai` / `fake` |
| model | text null | |
| status | text not null | `CHECK in ('ok','failed')` |
| line_count | integer not null default 0 | lineas validas devueltas |
| input_chars | integer not null | largo del texto |
| input_tokens, output_tokens | integer null | del proveedor |
| created_at | timestamptz default now() | indice `(business_id, created_at)` |

Una fila por pedido que pasa la validacion del texto, tambien si el proveedor falla (`failed`). **No guarda el
texto** (puede traer datos personales; para medir alcanza el largo). Para agregar el tope despues: contar filas del
dia por `business_id` antes de llamar al proveedor (la funcion `draftsSince(businessId, desde)` ya queda escrita y probada).

### Archivos

| Archivo | Accion |
|---|---|
| `packages/db/src/schema/modules/stock.ts` | editar (tabla `draft_request`) |
| `packages/db/drizzle/0076_*` + meta | crear (drizzle-kit) |
| `apps/merchant/src/modules/stock/draft.ts`, `draft-provider.ts`, `draft-openai.ts` | crear |
| `apps/merchant/src/app/api/modules/stock/entries/draft/route.ts` | crear |
| tests: `draft.test.ts` (validacion/normalizacion pura), `stock-draft.neon.integration.test.ts` | crear |

## Plan de pruebas

Clase de error a cazar: **el servidor deja pasar algo que el modelo invento** (insumo ajeno, unidad o numero
invalido) y **fuga entre comercios**. Presupuesto: < 5 min.

1. Unitario de la normalizacion con salidas de modelo armadas a mano: itemId ajeno → nuevo; unidad invalida →
   unparsed; cantidad 0 → unparsed; unidad incompatible → nuevo; mas de 30 → unparsed; costo null se conserva.
2. Neon con un proveedor falso inyectado: 200 con lineas emparejadas a insumos del negocio; el insumo de OTRO negocio
   que el «modelo» devuelve sale como nuevo; una fila `ok` en `draft_request` sin el texto; proveedor que falla →
   503 `draft_unavailable` y fila `failed`; texto vacio → 422 sin fila; modulo apagado → 403.
3. Sin llamadas reales a OpenAI en los tests. La prueba con el modelo real es QA del owner con frases reales.
4. typecheck + lint del paquete.

---
spec: 0234
fecha: 2026-10-15
estado: cerrada
resumen: Mostrar costo de receta, precio, ganancia y margen por producto según el local elegido, usando la composición vigente y el costo promedio local.
disjunta: no; backend independiente del wizard L1 y UI dependiente de su integración, con relevo explícito de escritor
archivos: apps/merchant/src/modules/recipes/server/, apps/merchant/src/modules/recipes/ui/
---

# 0234 — Pieza 1.3: costo y margen por producto en Recetas

Piso **L2: dinero**. ADR0144, ADR0139 y `docs/VERIFICACION.md`. El owner autorizó implementar esta spec el 2026-10-15: «implementa la 0234». Sin ADR nuevo, push, migraciones ni operaciones PROD. El endpoint nuevo es de lectura: no modifica inventario, costos ni composiciones.

## Problema

Verificado: R1 declara `GET /api/modules/recipes` con `404 route_not_found`. L1 recupera lista y wizard **sin costo**; esta pieza suma después los importes a esa lista. Preview y consumo usan `model/expand.ts:expandComposition`, que agrega aportes por insumo antes de redondear a escala 3. Spec0228 implementó promedio local `weighted_average_unit_cost numeric(14,6)`, null desconocido y cero conocido. Precio del catálogo: `unit_price numeric(12,2)`, nullable; se considera sin IVA por decisión del owner.

### Preguntas y respuestas del owner

| Pregunta / recomendación presentada | Respuesta |
| --- | --- |
| 1. Calcular exacto y redondear solo al final a la unidad mínima de `currency_code`; porcentaje con 1 decimal. | El owner precisó: costo exacto redondeado una vez a la unidad mínima; **ganancia = precio − costo redondeado**, para que costo + ganancia sumen el precio en pantalla; **margen = (precio − costo exacto) / precio × 100**, con 1 decimal. |
| 2. Sin precio, mostrar costo y «Sin precio», sin ganancia ni margen. | Aceptado. |
| 3. Una sola ruta que devuelva toda la lista del local. | Aceptado. |
| 4. Backend primero; sumar columnas cuando el wizard esté integrado. | Aceptado. |

## Alcance y diseño

### Resultado y límites

La lista de Recetas conserva producto, marca «Combo» y conteo existente de ingredientes o recetas. Agrega **Costo de receta**, **Precio**, **Ganancia** en dinero y **Margen** en porcentaje, para una unidad del producto y el local elegido en la cabecera. El precio es el actual del Catálogo, común a los locales; el costo usa el promedio actual de cada insumo en el local seleccionado.

La pantalla explica: «El costo de receta no incluye merma, packaging ni comisiones». Fuera: Catálogo, costo manual `unit_cost`, costo de lo vendido, Stock, compras, POS, migraciones, Smart Menu, fiscal/IVA, filtros, recientes, archivo, e2e y rediseño.

### Cálculo y fuentes

1. Leer, en una transacción `repeatable read read only`, los productos del comercio con composición vigente que tenga al menos una receta, su revisión de composición, resolución publicada actual y revisiones de receta referenciadas por esa resolución. Obtener esas revisiones en lote. No consultar por separado la receta mutable ni reconstruirla desde ventas históricas.
2. Reutilizar **el mismo `expandComposition`** que utilizan preview y consumo, con una unidad vendida. Esto deriva las cantidades de preview sin invocar el endpoint HTTP una vez por producto. No duplicar ni cambiar su semántica. La resolución publicada mantiene las revisiones que capturaría una venta actual; el fanout R1 de edición de receta ya actualiza esa resolución.
3. Leer en lote los promedios del local seleccionado, con pertenencia explícita al comercio en todas las consultas. Solo `weightedAverageUnitCost`; sin fallback a último costo, costo global, otro local ni `product.unit_cost`. Ausencia de par o promedio null equivale a costo desconocido. **No usar `lockItemLocation`**, porque puede insertar/inicializar pares: esta lectura no crea ni inicializa nada, no drena pendientes y no aplica consumos.
4. Para cada insumo cuya cantidad expandida a escala 3 sea mayor que cero, multiplicar esa cantidad por su promedio a escala 6. Sumar los productos exactos de escala 9. Usar `bigint` y utilidades decimales existentes, sin float ni redondeo monetario intermedio. En un combo, sumar aportes por insumo y aplicar el redondeo de consumo antes de valorar; no sumar importes monetarios ya redondeados por receta.
5. Con costo completo exacto `C`, calcular **una sola vez** el costo visible `Cr` a la unidad mínima de `currency_code`. Con precio conocido `P`, **ganancia visible `G = P − Cr`**, sin un segundo redondeo: costo + ganancia = precio. Si `P > 0`, **margen `M = 100 × (P − C) / P`**, redondeado a 1 decimal. No derivar el porcentaje de `G`: usa el costo exacto. Es margen sobre el precio de venta, no recargo sobre costo. Valores negativos son válidos.

Usar la política de moneda existente `consumptionMinorUnits`: COP, CLP, JPY y PYG tienen escala monetaria 0, las demás monedas soportadas escala 2. Desempates con `roundDiv`, mitades lejos de cero, como el cálculo decimal existente. Sea `C9 = Σ Q3 × A6`, `s` la escala de moneda y `P2` el precio a escala 2:

```text
Cr_s = roundDiv(C9, 10^(9 − s))
P_s  = P2 / 10^(2 − s)           // precio ya en la unidad mínima
G_s  = P_s − Cr_s
M_1  = roundDiv((P2 × 10^7 − C9) × 1000, P2 × 10^7)
```

`M_1` es el porcentaje en décimas; solo se calcula si `P2 > 0`. Formatear `Cr_s`, `P_s` y `G_s` con `s` decimales y `M_1` con 1. No redondear el costo exacto antes del porcentaje ni dividir usando float. La premisa de producto acordada es que el precio ya está en la unidad mínima de la moneda.

Ejemplo decisivo en USD: cantidad `1.000` y promedio `0.104900` dan costo exacto `0.104900000`; con precio `0.21`, costo visible `0.10`, ganancia `0.11` y margen **50.0%**. Calcular margen con la ganancia visible daría 52.4% y sería incorrecto. Costo + ganancia = `0.21`. Otro caso de mitad: costo exacto `0.105000000` → costo visible `0.11`, ganancia `0.10` y margen `50.0%`.

**Estados de datos:**

| Situación | Lectura y presentación |
| --- | --- |
| Todos los insumos descontados tienen costo | Costo calculado; precio, ganancia y margen según disponibilidad del precio. |
| Algún insumo con descuento positivo carece de costo | `recipeCost`, `profit` y `marginPercent` null; mostrar «Falta costo en este local» y los nombres de todos los insumos faltantes, sin presentar una suma parcial como costo total. Precio conocido se conserva. |
| Precio null y costo completo | Costo visible, «Sin precio»; ganancia y margen null. |
| Precio cero y costo completo | Precio cero válido, ganancia igual a menos costo y porcentaje null por división indefinida; mostrar «Sin margen» en el porcentaje. No confundirlo con precio ausente. |
| Promedio cero | Costo conocido cero, participa normalmente. |
| Ingrediente expandido a cantidad cero | No genera descuento ni importe ni aviso de costo faltante. |
| Receta existente sin ingredientes, o todos los descuentos cero | La suma exacta es cero; aplica el cálculo normal de precio, ganancia y margen. No agregar un estado monetario de «receta incompleta». |
| Composición sin recetas | Fuera de esta lista, igual que en el wizard recuperado; no se interpreta como producto con receta de costo cero. |

Conservar la lista de productos configurados del encargo L1: el local determina el costo, no agrega un filtro nuevo por disponibilidad comercial. Los conteos siguen la semántica de la lista restaurada: ingredientes para producto simple y recetas para combo. Una referencia publicada inconsistente no se convierte en costo cero: debe producir un error de lectura.

### Contrato HTTP propuesto

Nueva ruta modular **`GET /api/modules/recipes/costs?locationId=<uuid>`**. No restaura el endpoint raíz retirado ni altera rutas/bodies de R1. Devuelve toda la lista en una respuesta, ordenada por nombre de producto sin distinguir mayúsculas y por ID para desempate; sin paginación ni llamada cliente por producto.

`locationId` es obligatorio y pertenece al comercio autenticado; no se acepta `businessId` cliente. La UI siempre envía el local elegido. Una respuesta exitosa tiene esta forma:

```ts
type RecipeCostList = {
  locationId: string;
  currencyCode: string;
  minorUnits: 0 | 2;
  recipes: {
    productId: string;
    productName: string;
    isCombo: boolean;
    compositionRevisionId: string;
    resolutionId: string;
    ingredientCount: number;
    recipeCount: number;
    recipeCost: string | null;
    price: string | null;
    profit: string | null;
    marginPercent: string | null;
    missingCosts: { itemId: string; itemName: string }[];
  }[];
};
```

`price` conserva el valor exacto del catálogo expresado a escala `minorUnits`, o null; no escribir una versión normalizada en el producto. `recipeCost` y `profit` son strings a esa misma escala; `marginPercent`, string a escala 1 o null. No trasladar aritmética monetaria al cliente ni exponer `C9` por necesidad de presentación. `missingCosts` es una lista única por insumo, ordenada por nombre e ID. Vacío sin productos configurados: `200` con `recipes: []` y contexto de local/moneda válido.

Sesión, membresía, permiso `recipes`, negocio y módulo activo se resuelven en el dispatcher existente. No exigir permiso Catálogo ni Stock adicional para esta pantalla; se conserva `requires: [stock]` y su invariante de activación. El módulo lee tablas del core, nunca se agrega una dependencia del core a Recetas/Stock.

| Caso | Respuesta |
| --- | --- |
| Falta `locationId` | `422 {error,code:"location_required"}`. |
| Local inválido, inexistente o de otro comercio | `404 {error,code:"location_not_found"}`, sin revelar nombres/IDs ajenos. |
| Local propio archivado solicitado explícitamente | Lectura permitida, conforme a las lecturas localizadas existentes; no es una compra. |
| Sesión o permiso insuficiente, módulo apagado | Rechazos vigentes del dispatcher, incluidos `missing_permission` y `module_disabled`; no agregar excepciones. |
| Fallo DB/invariante interna | Error modular existente `503`; mensaje «No pudimos leer los costos de receta». No mostrar cero ni conservar como actual un margen de otro local. |

Moneda del negocio autenticado; sin cache compartido entre comercios/locales. Es costo actual del snapshot, no costo congelado de una venta futura.

### Integración de UI después del wizard

Primero se implementa y comprueba el backend. Una vez integrado el wizard y liberado su writer, la lista usa esta ruta única para sus filas/conteos/importes; se eliminan las lecturas de detalle por producto que `loadRecipes` usa hoy para armar la lista. Las lecturas de biblioteca y productos siguen disponibles para el wizard y sus buscadores; no se consulta preview por fila ni se agrega dinero a sus pasos.

La cabecera ofrece el selector de local usando componentes existentes del kit y la lectura `GET /api/modules/recipes/locations`. Si solo hay un local activo, puede quedar seleccionado; con varios se usa el elegido en la cabecera, sin sumar locales ni inventar un promedio general. El cambio de local invalida la lectura anterior y vuelve a cargar la lista monetaria. Respuestas tardías del local anterior no deben reemplazar la selección actual; guardar una receta refresca la lista del local elegido. Sin local disponible, pedir elegir/crear un local mediante el estado existente del producto, sin mostrar importes como cero. Carga, error y reintento usan patrones existentes.

## Archivos y paralelismo

Sin índices ni estados. Writer L2 en `apps/merchant/src/modules/recipes/server/` para lectura, DTO, ruta y test Neon focal. Reutiliza `model/expand.ts`, `modules/decimal.ts` y datos Stock; sin tocar escrituras R1, esquema, tooling, dependencias o core. Ampliación de paths vuelve al coordinador. Ficha operativa conserva base/worktree/reservas.

El wizard L1 está integrado en main/dev local en `cf2e7552`. El coordinador libera su reserva y asigna al writer L2 `recipes/ui/recipes-console.tsx`, `recipe-requests.ts` y tipos de la lista. No editar modal/pasos del wizard para sumar esta lectura. UI mantiene kit, copy de merchant y frontera modular.

## Definition of Done

- [x] Spec revisada/cerrada y OK expreso del owner antes de implementar; decisiones de redondeo registradas arriba.
- [ ] Una lectura por local devuelve lista completa con costo de receta, precio, ganancia y margen actuales para productos simples y combos; coincide con cantidades de preview/consumo por una unidad.
- [ ] Costos faltantes nombrados y margen oculto; null, cero, precio ausente, precio cero y pérdida tratados según contrato; aislamiento real entre comercios/locales.
- [ ] Lectura sin escrituras, sin fallback a otro costo ni consultas fiscales; catálogo, `unit_cost`, Stock, venta y backend R1 de escritura intactos.
- [ ] Backend listo antes de integrar las columnas en la lista restaurada; selector de local, refresco y respuestas tardías correctos, sin N+1 cliente para filas.
- [ ] Test Neon focal, typecheck y lint merchant aprobados con SHA/entorno explícitos; QA de tarea y de combinación diferenciadas. Coordinador marca implementada tras QA pertinente.

## Pruebas pertinentes

**Plan futuro; no ejecutado en esta entrega documental.** Un solo archivo/test Neon focal mediante `tools/neon-test.sh`, con fixtures reales del esquema y rutas de lectura. Una secuencia verifica los cinco escenarios pedidos y negativos de dinero/aislamiento sin crear otra suite:

1. Producto normal con composición y promedio local; comprobar costo, precio, ganancia y porcentaje contra el criterio aprobado y los ejemplos decisivos `0.104900 / 0.21` y mitad `0.105000 / 0.21`. Cantidades fraccionarias y promedio a 6 decimales deben detectar float o redondeo monetario prematuro. Verificar costo + ganancia = precio en USD y una moneda de escala 0; el porcentaje usa costo exacto, no costo visible ni ganancia visible.
2. Combo con varias recetas, cantidades distintas y un insumo compartido: comparar contra `preview.ingredients.quantity`, incluyendo un caso en que sumar antes de redondear cambia la cantidad; no sumar costos de recetas previamente redondeados. Incluir cantidad redondeada a cero y promedio cero conocido.
3. Insumo con promedio null o par ausente: respuesta enumera faltantes, costo/ganancia/margen null, precio conservado. No rellenar desde último costo, costo manual u otro local.
4. Producto sin precio: costo disponible y ganancia/margen null. En la misma secuencia, precio cero mantiene ganancia negativa y margen indefinido; producto con precio menor al costo tiene margen negativo válido.
5. Dos locales con promedios distintos para los mismos insumos: mismo precio y composición, costos/ganancias/márgenes diferentes. Local ajeno/inválido retorna 404, y no devuelve productos ni insumos de otro comercio. Sin local retorna 422. Comprobar que la lectura no crea pares, inicializa promedios ni cambia ledger, catálogo o revisiones.

Comandos previstos, con Node24 (`source ~/.nvm/nvm.sh && nvm use`) y configuración protegida seleccionada por el coordinador:

```sh
tools/neon-test.sh src/modules/recipes/server/costs.neon.integration.test.ts
pnpm --filter @mi-pasaporte/merchant typecheck
pnpm exec eslint apps/merchant
```

Sin DB PROD, e2e, verify global ni suites adicionales. La QA en browser del owner comprueba lista de producto/Combo, local seleccionado, importes, nombres faltantes, «Sin precio», guardado desde wizard y cambio de local durante carga. El coordinador registra la QA independiente y de combinación sobre el SHA congelado; no anunciar PASS por skips/retries.

## Handoff y abierto

Verificación estática hecha sobre base `b87f5d40def5e4c99de8bafc50a625f55e7712f5`. La UI L1 leída como dependencia corresponde al candidato congelado `cf2e75520ef4f739f94d2176d63b8050b435e019`; no se editó ese checkout. No se ejecutaron tests ni acceso DB, no se implementó producto ni se hicieron commits/push.

Las cuatro preguntas están respondidas y el owner autorizó la implementación; sin decisiones funcionales pendientes. El wizard está integrado y el coordinador asigna el relevo de UI. Nota factual: core admite escala 2 sin validar moneda; esta pieza asume precio ya en unidad mínima, no afirma que existan precios legacy incompatibles ni los corrige. Lectura defensiva ante un dato fuera de esa precisión, sin escribir ni inventar un precio.

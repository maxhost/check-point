# 0242 — CP1c.1 expansor racional de Recetas, puro y dormido

Estado: preparada, código solo con reserva y autor nuevo/contexto vacío. Decoder medido96195674/QA63cd3c97 aceptado; quantity storage tiene su gate independiente. Esta entrega pura no conecta consumidores, no genera DDL ni escribe stock. Leer AGENTS/protocolos, anexo0242 §4, ADR0148 §3, esta ficha y expansor/helpers pertinentes; sin históricos ni subdelegar.

## Objetivo y contrato

Añadir un expansor explícito para una línea vendida medida y su base de composición capturada. Componentes/revisiones/ingredientes inmutables usan los tipos actuales. La base tiene `basisQuantity:Decimal`, `basisUnit:MeasureUnit`, `conversionVersion:'mass-si-1'`; se valida con las reglas de captura existentes (unit discreta, masa kg/lb/g). Venta aporta quantity string y LineMeasure explícita. Base obligatoria y dimensionalmente compatible; nunca adivinar una base mass desde receta actual/precio/nombre. Legacy sigue usando `expandComposition` actual con base1unit, sin cambiar su API ni rango safeInteger histórico.

Factor exacto = cantidad vendida convertida a basisUnit / basisQuantity. Cantidad de receta efectiva = componente capturado × factor. Aporte de ingrediente = cantidad capturada de ingrediente × cantidad de receta efectiva. Racionales BigInt reducidos en toda la cadena; ninguna proyección intermedia escala6/3 es autoridad. Precio/unidad tarifaria no cambia la cantidad física ni reinterpreta la base.

Consolidar por insumo **dentro de la misma línea** y redondear una sola vez a escala3, mitades lejos de cero. Clave stock futura sigue comercio/orden/línea/insumo. Atribuir milésimas por mayor residuo racional exacto (comparar por productos cruzados), desempate recipeId/recipeRevisionId ascendente, como ADR0148; la suma de fuentes asignadas cierra exactamente con el consolidado. No redondear separadamente cada fuente ni mezclar insumos de distinta unidad.

Resultado conserva por fuente tanto racional de cantidad de receta como racional del aporte de ingrediente (`ExactRatio` sin escala monetaria), además de proyecciones legacy `recipeQuantity` escala3, `exactQuantity` escala6 y `allocatedQuantity` escala3. Consolidado incluye su racional y cantidad ledger3. Proyecciones de positivos diminutos pueden ser0: conservar racional positivo y procedencia, estado/razón de redondeo; ledger0 nunca significa consumo/costo inventado. No producir movimiento en este helper puro.

El límite del ledger numeric(14,3) se valida después de consolidar/redondear, sin overflow/coerciones Number. Capturas medidas usan límites acordados; unit V4 confiable admite snapshotsINT32 mediante camino explícito, sin ampliar entrada HTTP nueva. Cantidades internas de componentes/ingredientes se validan exactamente según sus formatos capturados actuales, no se pasan por parser de captura de producto. Ausencia de revisión capturada, revisión de receta ajena o unidades de insumo incoherentes son errores, nunca fallback a receta vigente.

## Paths previstos

- `apps/merchant/src/modules/recipes/server/model/expand-measured.ts` nuevo
- `apps/merchant/src/modules/recipes/server/model/expand-measured.test.ts` nuevo
- `docs/factory/0242-cp1c-recipes-exact-handoff.md`

Importar helpers racionales/medidas existentes y tipos necesarios; no duplicar factores ni usar ExactAmount con escala2 para cantidades físicas. No modificar expansor legacy, schema/procedencia DB, publication/captured/consumption/metrics, core/event wiring, Stock/analytics, UI/auth/kit/tooling/deps/estados/índices. Si se necesita extraer un helper compartido, presentar path/razón al coordinador antes de editar. No publishV4 ni activar masa. Otro autor/contexto conectará este núcleo después de la expansión de procedencia/base y consumidores compatibles.

## Aceptación y checks

Equivalencia de proyecciones con expansor legacy para base1unit (casos reales de componentes/revisiones, reparto/empates/0), manteniendo intacta su API. Base1lb con venta1g produce factor100000/45359237 y racionales no terminantes exactos; ventas equivalentes kg/lb/g dan mismos racionales y ledger. Dos recetas comparten insumo: suma exacta antes de redondear y atribución estable aun al permutar componentes. Cantidad positiva que proyecta0 en recipeQuantity/exactQuantity conserva ambos racionales;0.000 sin consumo ficticio. Separar unidad de insumo y dimensión de venta; cambio solo priceUnit no altera consumo. Negativos de base ausente/incompatible/0/medida inválida, snapshots no válidos, refs capturadas faltantes/ajenas, unidades incoherentes, overflow antes/después del redondeo.

Node24, Vitest expansor antiguo+nuevo y medidas pertinentes, tipos merchant/domain, lint/formato/diff. Guardias de módulos principal/between/literals: no editar guardias; identificar separadamente backlog probado y cualquier offender nuevo. Sin Neon/build/browser para matemática pura; QA independiente nuevo en candidato congelado. Evidencia SHA/base/runtime/lock/config/comandos/resultados/fallos/skips/límites; commit limpio y0 procesos, factory/integración por coordinador. Sin push/PROD. Siguiente bloque con otro agente limpio.

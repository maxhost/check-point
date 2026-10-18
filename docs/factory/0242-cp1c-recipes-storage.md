# 0242 — CP1c.2 base capturada y procedencia racional, solo expansión de esquema

Estado: preparada; no código hasta aceptar quantity storage y reservar writer nuevo. Entrada: decoder medido aceptado y expansor puro de Recetas con contrato separado. Esta entrega solo prepara almacenamiento; no conecta consumidores/V4 ni activa peso. Leer AGENTS/protocolos, anexo0242 §4, ADR0148 §3, schema real y esta ficha; sin históricos ni subdelegar.

## Contrato aditivo

En revisión de composición y resolución de venta agregar columnas capturadas `basisQuantity` numeric(24,9), `basisUnit` text y `conversionVersion` text, defaults históricos1/unit/mass-si-1. Todas las composiciones anteriores eran por producto unit; no reconstruir bases mass desde recetas actuales ni reescribir sus referencias. Base positiva dentro del contrato de captura, unit entera, masa kg/lb/g y versión conocida. Mantener inmutabilidad/publicación de IDs y FKs existentes; el ALTER con defaults no transforma JSON de componentes ni repunta recursos.

En `consumption_source`, añadir `quantityVersion` entero default1 y cuatro campos text nullable: `exactQuantityNumerator`, `exactQuantityDenominator`, `recipeQuantityNumerator`, `recipeQuantityDenominator`. Versión1 conserva reglas legacy y cuatro null; versión2 exige ambos racionales completos con enteros positivos canónicos (sin signo/ceros iniciales), denominadores positivos y proyecciones no negativas. La fracción reducida se produce/valida por helpers de aplicación; no reconstruirla desde proyecciones. No aceptar pares parciales,0/negativos/NaN, versión desconocida ni alegar exactitud para historia legacy.

Conservar `exact_quantity` numeric(20,6), `recipe_quantity` numeric(30,3) y `allocated_quantity` numeric(14,3) como proyecciones/ledger compatibles. Reemplazar positividad incondicional de las dos proyecciones por validación dependiente de versión: legacy sigue>0; racional positivo puede proyectar0 en ambas. Allocated sigue>=0 y sin NaN. Un positivo que proyecta0 es procedencia válida, no consumo/costo completo. No crear filas, movimientos ni completar procedencias históricas en la migración.

Mantener claves de unicidad por orden/línea/insumo/receta, constraints referenciales, triggers de inmutabilidad e índices. No FK/import core→módulo. Defaults permiten writers legacy actuales sin cambios; writer y reader racional se conectarán en otra entrega, con pruebas de replay y costo. Ausencia de provider no inventa receta.

## Paths para reservar

- `packages/db/src/schema/modules/recipes-compositions.ts`
- `packages/db/drizzle`, solo nueva migración y journal/snapshot generados, sin editar historia
- `apps/merchant/src/modules/recipes/server/model/measurement-storage.neon.integration.test.ts` nuevo
- `docs/factory/0242-cp1c-recipes-storage-handoff.md`

Un único writer serial de schema/journal. Verificar última entrada real al generar; no asumir número desde esta ficha. JSONdiff semántico por tablas/columnas/constraints afectadas, sin cargar snapshot entero ni aceptar drift. No helpers de producto, publication/captured/consumption/stock/analytics/UI/config/auth/kit/tooling/deps/estados/índices. Pedir ampliaciones antes de editar.

## Pruebas y activación

Node24, tipos db/domain/merchant y estáticos pertinentes. CI exclusiva incluido DDL/teardown por tools/neon-test.sh --no-file-parallelism; sin otro servidor/test conectado. No local/prod por worker. Migración canónica/journal/tipos/constraints reales y antes/después aislado en tablas/esquema propios usando sustitución estricta solo de identificadores de tabla, sin downcast global ni truncar datos ajenos.

Preservar IDs/JSON/defaults/history/legacy consumo; verificar versión1 exacta y ausencia de racional fabricado. Versión2 con numeradores/denominadores de caso1g/base1lb, ambas proyecciones0 y allocated0 debe persistir íntegra; negativas de cuatro campos parciales, denominador0/negativo, numerador0/negativo, proyección negativa/NaN, base/versión inválidas. Releer exactamente los strings racionales, sin Number. Fixtures propias con todas las referencias reales del mismo negocio, teardown completo incluido owner; no fixture imposible como prueba de rechazo.

Reutilizar suites legacy Recetas/consumo compatibles para acreditar expand no disruptivo; si sus afterAll dejan usuarios/consumidores, preferir casos propios completos o solicitar arreglo acotado antes de editarlas. Sin producerV4 ni runtime consumer ni M0/M1 en este bloque. Guardias de módulos principal/between/literals con atribución de backlog vs nuevos offenders, nunca editar guardias para aprobar.

QA independiente nuevo en candidato congelado; evidencia SHA/base/SQL/runtime/lock/config/schema/fixtures/comandos/resultados/fallos/skips/límites y0 procesos. Root aplica migración local protegida después de PASS y antes de integrar descriptor que usa columnas nuevas; producción siempre requiere autorización explícita propia. Siguiente integración de lectores/writers/validadores de composición corresponde a otro agente y ficha, no se acumula en este autor.

# 0242 — CP1b.2 expansión física de tarifas, operación legacy conservada

Estado: preparada; código solo tras reserva. Nuevo autor con contexto vacío. Lectores unit8624cda8/QA745bff45 aceptados sobre0cf6d209; base nueva exacta por factory. Cliente scope paralelo usa CI hasta detener su servidor/teardown: este autor puede generar y comprobar offline, **no aplicar DDL ni conectar CI hasta transferencia explícita**.

## Corte y contrato

Ampliar exclusivamente `core.product.unit_price/unit_cost` de numeric(12,2) a numeric(24,9) string, sin habilitar tarifas nuevas precisas o productos mass. Conservar null,0 y todos los valores legacy hasta9999999999.99; no ampliar totales/pagos ni convertir columnas a number. No añadir todavía modo/unidad/revisión/configuración: sus writers y locks pertenecen a configuración/catalogoV2 posteriores.

Para que este corte sea seguro por sí solo, la base conserva explícitamente la capacidad operativa legacy: añadir constraints temporales genéricas que exijan precio/costo null o dentro del rango anterior y exactamente representables en centavos, además de no negativos. El padding9 de almacenamiento no es nueva precisión operativa. Las constraints no rechazan ninguna fila válida del esquema anterior. No confiar solo en la UI para mantener dormida la precisión nueva.

La retirada de esos límites temporales requiere otra migración serial en el candidato compatible de activación: lectores/escritoresV2, proyecciones legacy409, composición y cierre/consumidores listos en CP2c. No retirar esa barrera aquí. La definición final admitirá límites nuevos y preservación legacy del anexo; no confundir el límite temporal con el parserV2 definitivo.

Esta decisión de fase permite mantener los writers/importación/DTOv1 actuales sin refactorizar catálogo entero en la misma entrega. Verificar que sus campos ya son string en DB y que no se introduce un writer capaz de almacenar precisión nueva. No modificar la semántica pública anterior de captura legacy ni afirmar implementado catálogoV2.

## Paths y escritor

- `packages/db/src/schema/catalog.ts`
- `packages/db/drizzle`, únicamente SQL nuevo y su journal/snapshot generados; nunca editar migraciones históricas
- `apps/merchant/src/server/catalog-storage-expand.neon.integration.test.ts` nuevo
- `docs/factory/0242-cp1b-catalog-storage-handoff.md`

Asignación explícita de esquema/migración a un único writer. Antes de generar, comprobar último journal real; no reservar número desde una memoria. Usar generador existente, sin cambiar config/kit/tooling/deps. Revisar diff semántico del snapshot con JSON por tablas afectadas; no cargar el snapshot entero como contexto ni aceptar diffs ajenos a estas dos columnas/constraints. Si el generador revela drift, avisar al coordinador, no normalizar otros esquemas.

Lecturas: AGENTS/protocolos, anexo0242 compatibilidad/tarifas, ficha lectores, esta ficha y schema/migraciones/tests pertinentes. Sin históricos ni subdelegar. Ningún backend/UI/catalog/import writer ni columna de cantidades POS/core asignados. Pedir cualquier ampliación antes de editar. No push/PROD ni estados/índices/refs principales.

## Verificación proporcional

Node24; generar SQL/journal/snapshot offline, diff acotado y tipos db/domain/merchant pertinentes, formato/lint. No DB durante generación. Recurso serial de schema/journal reservado; CI inicialmente de Bcliente y luego transferido incluido teardown.

Al recibir CI, toda operación por `tools/neon-test.sh`, DDL aislado con `--no-file-parallelism`, sin otro proceso/servidor usando esa DB. Comprobar tipos reales y journal tras migración. Probar migración de filas legacy extremas/0/null sin pérdida ni cambio de IDs; futuras representaciones padded pasan por lectores aceptados; valores negativos/fuera de rango/no centavos rechazados por constraints, no redondeados. Fixture propia y teardown completo.

No retroceder globalmente tipos ni truncatear datos ajenos para fabricar un antes/después. Si se requiere simular definición anterior, usar tabla/esquema aislado propio con la definición antigua y ejecutar las mismas sentencias de migración mediante sustitución estricta solo del identificador de tabla, documentando esa capa de evidencia. Además verificar migración canónica real por wrapper y schema actual. Ningún DDL directo fuera del wrapper.

Probar lectura catálogo/POS y adición desde tarifa legacy máxima sobre CI migrada, sin cambiar payload HTTP unit a string. Conservar arithmetic exacta aceptada y total persistible; no precio máximo×cantidad máxima como venta positiva. El resto de suites compatibles se reutiliza; no verify global ni M0/M1 por ceremonia.

Handoff: base/SHA, SQL y semántica exacta/constraints temporales, runtime/config/lock/schema/fixtures/comandos/resultados/fallos/skips/límites y0procesos/teardown. QA independiente nuevo en candidato congelado antes de aceptación. Siguiente bloque con autor nuevo: expansión de quantity/snapshots y writers string POS/core, no tarea acumulada en este autor.

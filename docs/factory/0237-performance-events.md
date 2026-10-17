# 0237 — Recuperación de rendimiento: entrega del implementador

Task `analytics-performance`. Base `5fac6608942dd2a71e4ceff0f902169311c51dec`; fuente congelada `b3ca9c6fda419306b013f3781dcc14c9780cd25b`. Worktree `/private/tmp/checkpass-analytics-perf/analytics-performance`. Node 24.20.0; pnpm 11.4.0. Sin push, deploy, lectura ni escritura de PROD.

**Estado: funcional PASS; rendimiento frío FAIL.** Una única observación dio **1.817,621042 ms**, frente al máximo de 1.000 ms. El implementador paró toda operación de DB, reset, nuevas mediciones y cambios de producto inmediatamente. No hay candidato aceptado ni avance de main por esta tarea.

## Cambio y equivalencia

Se conserva el cálculo, las ventanas, los locks, los límites y la transacción completos de `evaluateBusiness`; ningún trabajo se mueve fuera del reloj. `queries/index.ts` transporta las métricas como series con cabecera compartida (métrica, local, dimensión, moneda, unidad menor) y tuplas de ordinal, día, importe, cantidad y count. Cada fila conserva su ordinal previo: el decoder reconstruye el mismo orden, incluidos empates observables. Sigue aceptando el formato plano previo y conserva las comprobaciones de dinero seguro; rechaza grupos truncados, ordinales repetidos o ausentes. No cambia contratos HTTP ni tarjetas.

El oráculo portátil `snapshot-equivalence.test-support.ts` congela deliberadamente el SQL original de la base: compara el input entero y su orden, candidatos completos/textos, hechos, meta e histórico. Se ejecutó en las fixtures reales de AN-1, AN-2 y AN-3: ventanas de 31 de octubre, gastos lejanos, locales, COP con unidad menor 0, productos empatados, gauges/consumo, hechos, días de visita y snapshots de campañas. Los unit existentes conservan las verificaciones de cero frente a dato desconocido y ventas gratuitas; no se modificó el dominio. Unit adicionales cubren cantidades fraccionarias, dinero negativo, cabeceras nulas, orden intercalado, overflow de importes/count y payload incompleto. Las pruebas existentes conservaron sus aserciones.

## Única migración nueva

`0100_analytics_metric_lookup.sql`, SHA-256 `d7be0529f9325bb3dbaa6d3517e10ad3ac9b59a677034f849c258289e5fcfe5a`: un índice parcial btree `analytics_daily_metric_lookup_idx` sobre `(business_id, metric, day)` para `visits`, `promo_discount`, `promo_sales`, `promo_cost`, `voided_tickets` y `stock_consumption`. Sin INCLUDE, tablas, columnas, vistas ni otras modificaciones lógicas. El snapshot conserva las 115 tablas previas exactamente, salvo ese índice. 0097–0099 y sus snapshots no se editaron.

El índice evita recorrer todas las claves producto/día para comprobar que un comercio no tiene visitas/promos antiguas. Su construcción normal recorre la relación una vez y toma los locks propios de CREATE INDEX; tiene costo de almacenamiento y de escrituras de esas seis métricas. No hay despliegue ni migración de PROD autorizados por esta entrega.

Aplicado únicamente por `tools/neon-test.sh` a las dos DB efímeras reservadas: perf y replay válido migration.env. Perf conserva el hash bootstrap histórico de 0097 (`247e7e…bf6d1`) y el parche account-index documentados; no se reparó ni reescribió el ledger. El wrapper aplicó 0098 y 0099 antes del primer inventario, según autorización explícita. Después se comprobó ledger/físico. Antes de 0100 se hizo inventario con 0 writers, manteniendo temporalmente el journal base 99 y restaurando garantizadamente el journal 100 generado al terminar; nunca se editaron entradas previas ni datos. El replay funcional sí usa las migraciones oficiales.

Perf conserva el dataset anterior: 29,2 millones globales de product_revenue según la carga heredada, sin seed ni borrado ni ANALYZE global. El inventario focal corroboró 29.200 filas por cada métrica producto del objetivo, 730 de revenue/commission, 1.120 de revenue_with_cost y payment_commission_with_cost, y un gasto fijo. Se mantuvieron 6.965 métricas decodificadas en el snapshot.

## Evidencia real antes del frío

- SQL actual de AN-3, antes del cambio: EXPLAIN ANALYZE BUFFERS, planificación 91,190 ms; ejecución 1.919,305 ms; 1.859 bloques leídos. La rama histórica visits/promos devolvió 0 filas pero consumió 1.758,892 ms y 1.583 bloques. `/private/tmp/analytics-perf-baseline-explain.log`.
- SQL con índice y compactación: planificación 14,461 ms; ejecución 40,276 ms; 0 bloques leídos en esa observación caliente. Históricas y firstConsumptionDays usan el índice nuevo. `/private/tmp/analytics-perf-index-compact-explain.log`. **EXPLAIN caliente no prueba el objetivo frío.**
- Payload exacto: 743.437 → 283.214 bytes (−61,9 %), conservando las 6.965 métricas. `/private/tmp/analytics-perf-inventory-fixed.log` y `/private/tmp/analytics-perf-final-inventory.log`. La variante inicial sin ordinal fue 242.531 bytes; se añadió el ordinal para conservar el orden.
- Neon funcional: 17/17 PASS, 0 skips, 0 retries, 63,39 s. AN-1 9 casos, AN-2 3, AN-3 5; comparador completo en las mismas fixtures. `/private/tmp/analytics-perf-functional.log`.
- Unit focal: 45/45 PASS, 0 skips. `/private/tmp/analytics-perf-unit.log`.
- Merchant typecheck y lint focal: EXIT 0. El typecheck ocurrió antes de añadir el último caso Neon de empate; producto y helper son idénticos a los comprobados. El lint y la ejecución Neon sí incluyen ese caso. No se repitieron comprobaciones después del STOP. `/private/tmp/analytics-perf-types.log`, `/private/tmp/analytics-perf-lint.log`.
- Diff-check PASS; assert de snapshots: las 115 tablas idénticas salvo el índice nuevo. Hashes 0097 `0836fdec…feac`, 0098 `e53e80ed…1905`, 0099 `2ff9057e…6105` intactos.

## Fallos y límites preservados

El primer inventario falló por una ruta relativa al journal con un nivel de más (ENOENT); no cambió datos. Se corrigió y pasó el único caso seleccionado; los otros dos casos de preparación histórica no se seleccionaron ni ejecutaron. Logs `/private/tmp/analytics-perf-inventory.log` y `analytics-perf-inventory-fixed.log`. Los inventarios posteriores también muestran 1 PASS y 2 casos no seleccionados; no se presentan como 3/3.

Consultar la ayuda de Neon CLI con la cache por defecto falló por EPERM de sandbox en la cache de pnpm del usuario. Se resolvió usando `XDG_CACHE_HOME` dentro de `/private/tmp/checkpass-analytics-perf/cache`, sin cambiar HOME, credenciales ni dependencias del producto. No hubo rechazo de auto-review. Ninguna llamada API operativa ni medición fría había ocurrido al congelar la fuente.

No se ejecutaron verify global, mutaciones, llamadas de clima ni pruebas de CI compartida. No se implementó housekeeping de candidatas. La marca histórica AN-1 de 2.082,39 ms es FAIL previo y no es una medición nueva de AN-3.

## Única observación fría: FAIL y STOP

Fuente exacta `b3ca9c6fda419306b013f3781dcc14c9780cd25b`. QA independiente confirmó previamente método, decoder/oráculo, 17 Neon, 45 unit, snapshot/DDL y añadió 5/5 oráculos propios. Eso es PASS de equivalencia, no del requisito de rendimiento.

Control con `neonctl@8.7.2`, perfil explícito `checkpass`, `--no-analytics`, cache en `/private/tmp/checkpass-analytics-perf/cache`:

1. GET de metadata del endpoint `ep-aged-mode-axjrknyi`, proyecto `red-violet-38772073`: confirmó rama `br-super-math-axhq8e58` y límites min=max 1 CU. No se cambiaron CU ni parámetros. Validación local a `2026-10-17T14:29:17.337987Z`.
2. Reset por el wrapper y harness existente, limitado a comercio `md5('analytics-perf-business:1')` y día `2026-10-20`: quitó exactamente 4 candidatas y 1 run; 0 writers. `/private/tmp/analytics-perf-cold-reset.log`, 1/1 PASS, 0 skips.
3. POST únicamente a ese endpoint `/suspend`: operación `63d8be32-61cc-40e1-9079-1faa2c5e5621`, `suspend_compute`, creada `2026-10-17T14:29:32Z`.
4. Solo metadata: operación FINISHED y endpoint IDLE confirmados a `2026-10-17T14:30:02.712666Z`, mismo 1 CU. `/private/tmp/analytics-perf-control-proof.json`. Ninguna consulta al objetivo ni EXPLAIN después de suspender y antes de medir.
5. Una invocación, sin retry: `ANALYTICS_PERF_MEASURE=1 NEON_TEST_ENV_FILE=/private/tmp/checkpass-0237/perf.env tools/neon-test.sh src/server/analytics/evaluation/performance.neon.integration.test.ts --no-file-parallelism`. 0100 ya estaba aplicada; ningún DDL de producto pendiente. Vitest comenzó a las `09:30:14` locales (`14:30:14Z`).

Resultado de `/private/tmp/analytics-perf-cold-observation.log`: **EXIT 1; 1 test FAIL; 0 skips y 0 retries**. `evaluateBusiness` devolvió `true`; su promesa resuelta implica commit de candidatas y run READY según el código sin modificar. No se hizo una lectura posterior para volver a comprobarlo ni se borró esa corrida.

| Medida | Milisegundos |
| --- | ---: |
| TOTAL sin redondear, usado en la aserción | 1817.6210420000002 |
| TOTAL presentado en el log | 1817.62 |
| Conexión/inicio de transacción | 504.87 |
| Claim + snapshot + transferencia + decoder | 963.39 |
| Cálculo puro | 115.02 |
| Persistencia | 122.54 |
| Resto, que incluye commit y cierre | ≈111.80 |

El reloj incluye pool/conexión y toda la función con claim, lecturas, compactación/descompactación, cálculo, escrituras y commit; no se descontó etapa alguna. La aserción usa el tiempo sin redondear, no el presentado. **El wrapper despierta el compute al comprobar el ledger antes de Vitest:** no se afirma que el arranque del compute esté incluido, conforme a la metodología heredada autorizada. El cliente/pool de la aplicación se creó de forma perezosa en el nuevo proceso de medición.

La consulta caliente de 40,276 ms y la reducción de bytes no predijeron un total menor de 1 s. No se atribuye una mejora causal frente al FAIL histórico AN-1: no hay un baseline frío AN-3 comparable, y no se ejecutó uno nuevo. Tampoco se conoce por esa corrida cuánto del claim corresponde a I/O frío, SQL, transferencia o driver: no se abrió otra sesión ni un EXPLAIN tras el FAIL. La fixture grande es la heredada de AN-1, dominada por productos; el objetivo no contiene resúmenes de visitas/promos/stock. AN-2/AN-3 tienen evidencia funcional, no un benchmark de sus máximos volúmenes.

## Setup, estado de recursos y siguiente paso

El primer GET de metadata no pudo crear el lock de refresh del perfil Neon en el directorio del usuario (EPERM de sandbox); stdout quedó vacío y la lectura JSON local falló por ese motivo. Se informó y se repitió solo ese GET con escalación técnica aprobada, sin copiar credenciales ni cambiar perfil. No fue un intento frío ni un error de producto. Al imprimir la respuesta válida, el lector local asumió el campo opcional pending_state y dio KeyError: se corrigió con `.get()` leyendo el mismo archivo, sin otra llamada API. La validación de IDs/CU pasó antes del reset. Se conservan stdout/stderr en `/private/tmp/analytics-perf-endpoint-before*`.

Junto con el EPERM previo de cache pnpm y el primer inventario ENOENT, estos fallos de setup están registrados; ninguno se convirtió en PASS del criterio frío. No hubo rechazo de auto-review ni exposición de claves.

Después del FAIL no hubo ninguna nueva operación de DB, lectura, reset, suspensión ni medición, y no se cambió la fuente. El último IDLE observado fue antes del wrapper; el wrapper reactivó el compute para medir. **No se afirma IDLE al entregar:** no se consultó metadata posterior ni se volvió a suspender, por instrucción del coordinador. La rama/dataset y el run de la medición permanecen preservados. No hay procesos propios de prueba activos al entregar. El coordinador libera las reservas seriales sin hacer queries; el worktree limpio se conserva porque el candidato con FAIL no está aceptado ni es ancestro de main.

Pendiente: decisión del owner antes de reabrir cualquier investigación, cambio de producto o nueva medición. Rendimiento sigue pendiente; CI compartida y housekeeping siguen fuera de este encargo. La entrega documental conserva el candidato y la evidencia, **no autoriza merge a main ni publicación**.

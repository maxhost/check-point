# 0237 — QA independiente de recuperación de rendimiento

**Dictamen: funcional PASS; rendimiento frío FAIL.** La única observación sobre `b3ca9c6fda419306b013f3781dcc14c9780cd25b` fue **1817,621042 ms**, frente al máximo de **1000 ms**. El requisito sigue pendiente. No se certifica un candidato combinado ni se habilita avance de main local por esta tarea. El implementador detuvo DB, mediciones y cambios de producto después del FAIL, conforme al contrato.

Entrega revisada: `058d7c483bffc07f245611a675f92623eb8a3ea5`, que solo añade `docs/factory/0237-performance-events.md` sobre la fuente congelada. El handoff se conserva como objeto `058d7c483bffc07f245611a675f92623eb8a3ea5:docs/factory/0237-performance-events.md` en la rama local `analytics-performance`; no se incorpora su producto a dev/main. QA trabajó en su worktree limpio desde `e54c57f5b8ea32efd3ca2fb3c375facc904f660d`, revisando objetos Git inmutables y artefactos externos; no implementó el producto, operó DB/API ni actualizó su checkout al producto fallido. Este informe es un registro documental del resultado, no aceptación de la optimización como objetivo completado.

## Método y resultado frío

QA revisó el método antes del GO operativo. El reloj externo rodea `await evaluateBusiness`; la promesa de la transacción resuelve después del commit y el pool/conexión de aplicación se crea perezosamente dentro de la llamada. Se corrigió la aserción para comparar el tiempo **sin redondear**, usando redondeo solo en la salida. `result=true` es obligatorio: una evaluación omitida por run existente no puede producir un falso PASS. No se cambió `evaluation/index.ts`, su claim, locks, timeouts o atomicidad.

Límite explícito de la metodología heredada autorizada: **el wrapper despierta el compute al comprobar migraciones antes de Vitest**. El TOTAL incluye la conexión nueva de la aplicación y toda la evaluación; no se afirma que incluya el arranque de un compute dormido. La 0100 estaba aplicada antes de suspender y no había DDL de producto pendiente en el wrapper de medición. No hubo lecturas del objetivo, EXPLAIN ni precalentamiento de datos entre suspensión y prueba.

Secuencia corroborada en logs y control proof:

1. Metadata del endpoint asignado `ep-aged-mode-axjrknyi`, rama `br-super-math-axhq8e58`, proyecto `red-violet-38772073`: min=max **1 CU**, sin cambiar capacidad.
2. Reset focal anterior a la suspensión: exactamente **4 candidatas y 1 run** del comercio sintético/día `2026-10-20`; **0 writers**. `analytics-perf-cold-reset.log`, 1/1 PASS, leído por QA. No se borraron métricas.
3. Operación de suspensión `63d8be32-61cc-40e1-9079-1faa2c5e5621`, creada a `2026-10-17T14:29:32Z`; FINISHED y endpoint IDLE confirmados a `14:30:02.712666Z`, mismo 1 CU. Archivo `/private/tmp/analytics-perf-control-proof.json`, leído por QA.
4. Una sola invocación de `ANALYTICS_PERF_MEASURE=1 NEON_TEST_ENV_FILE=/private/tmp/checkpass-0237/perf.env tools/neon-test.sh src/server/analytics/evaluation/performance.neon.integration.test.ts --no-file-parallelism`. Vitest inició a `09:30:14` Guayaquil. Fuente congelada b3ca9c6f, sin selección del mejor intento ni retry.

`/private/tmp/analytics-perf-cold-observation.log`: **1 FAIL, 0 skips, EXIT1**. QA leyó la aserción fallida sobre `1817.6210420000002`. La función devolvió true después de completar su transacción; no se hizo SELECT posterior para comprobar de nuevo el run ni se borró la corrida tras el resultado.

| Medida | ms |
| --- | ---: |
| TOTAL crudo, criterio de aceptación | **1817.6210420000002** |
| Conexión/inicio de transacción | 504.87 |
| Claim, snapshot, transferencia y decoder | 963.39 |
| Cálculo puro | 115.02 |
| Persistencia | 122.54 |
| Resto, incluido commit/cierre; derivado de los tramos redondeados | ≈111.80 |

No se restan conexión ni otros tramos. Los `1312,75 ms` posteriores a conexión impresos por el harness son informativos, no otro criterio. Tampoco el EXPLAIN caliente constituye PASS. No hay baseline frío AN-3 nuevo para atribuir causalmente una mejora frente a los 2082,39 ms históricos de AN-1. La medición no separa el bloque claim en I/O frío, SQL, transferencia o driver; no se ejecutó otra consulta para completar ese diagnóstico después del STOP.

## Equivalencia y única migración

La fuente cambia el transporte interno de `inputStatement` a series con cabecera completa y filas individuales con ordinal. `inputFromRow` reconstruye el mismo array, incluidos orden y empates; mantiene el formato plano previo y los controles de overflow, y rechaza ordinales duplicados/ausentes o grupos incompletos. No cambia HTTP, dominio, pesos, tarjetas, ventanas, dinero, null, tenant ni transacciones. La construcción y reconstrucción permanecen dentro del reloj.

QA comprobó que el builder legado portátil del helper es el `inputStatement` exacto de `5fac6608942dd2a71e4ceff0f902169311c51dec`, salvo nombre/export de la función. SHA256 de esa función normalizada: `015b4ce763e9e577199f26aca8e8799cf6aed7caf330046c1967c9a8cb0a4227`. El helper compara el input completo **con orden**, candidatos/textos, carry de hechos, meta e históricos; no se limita a comparar el decoder contra sí mismo ni un multiset de métricas.

La **0100** añade exclusivamente `analytics_daily_metric_lookup_idx`, btree parcial de `(business_id, metric, day)` para visits, promo_discount, promo_sales, promo_cost, voided_tickets y stock_consumption; sin INCLUDE. SQL SHA256 **`d7be0529f9325bb3dbaa6d3517e10ad3ac9b59a677034f849c258289e5fcfe5a`**. El oráculo QA verificó prevId0099, las **115 tablas** y demás metadatos idénticos salvo el índice, así como 0097–0099 intactas. No se añadió tabla, columna, constraint, partición, vista materializada o desnormalización.

El índice agrega almacenamiento y mantenimiento de una entrada para las filas de esas seis métricas; sus tres claves sin columnas de cobertura limitan el ancho. Se justifica por el acceso histórico que el índice anterior no resolvía. No se midió el costo de escritura en un máximo volumen AN-2/AN-3. Se aplicó solo por wrapper a perf y migration.env reservadas. Perf conserva el bootstrap0097 original más el índice físico documentado, junto con 0098/0099/0100 aditivas; no se presenta como replay nuevo ni ledger reparado.

## Evidencia reutilizada y propia

Node **24.20.0**, pnpm **11.4.0**. QA no ejecutó suites DB, nuevos benchmarks, builds o comprobaciones globales. Leyó las assertions y logs de la fuente congelada y ejecutó oráculos propios sin DB antes del frío:

- **17/17 Neon PASS, 0 skips, 0 retries, 63,39 s**, `/private/tmp/analytics-perf-functional.log`: nueve casos AN-1, tres AN-2 y cinco AN-3. Incluyen equivalencia SQL anterior/compacta en fixtures positivas, mes de 31 días, gastos lejanos, locales, COP0, empates, consumo/gauges/hechos, visitas y campañas; conservan guardias, tenant, idempotencia y concurrencia existentes. QA cotejó el helper y sus invocaciones en esas fixtures.
- **45/45 unidades PASS, 0 skips**, `/private/tmp/analytics-perf-unit.log`. Cubren además cabeceras nulas, cantidades fraccionarias, cero, negativo, overflow de importe/count y payload incompleto.
- **5/5 oráculos propios PASS, sin DB**, sobre blobs exactos b3ca9c6f: decoder contra la versión anterior con grupos manuales desordenados, posición y todos los campos, MAX_SAFE_INTEGER/COP/cantidad/null, compatibilidad plana, overflow, ordinales y metadata/DDL. Script `/private/tmp/checkpass-analytics-perf/qa-oracles.mjs`; log `qa-oracles-b3ca9c6f.log` en la misma carpeta. El uso de Git/AST queda en el artefacto externo de QA, no en tests CI versionados.
- Typecheck Merchant EXIT0 compatible para producto/helper, **anterior al último caso Neon de empate añadido al test**. No se afirma typecheck del archivo de test final completo. Lint y los 17 Neon sí incluyen ese caso. Logs `analytics-perf-types.log` y `analytics-perf-lint.log`; no se repitieron tras STOP.
- Inventario final previo al frío: índice nuevo válido/listo, ledger0100 con hash correcto, **0 writers**, **6965 métricas**, payload **743437→283214 bytes**. `/private/tmp/analytics-perf-final-inventory.log`: un caso seleccionado PASS y dos preparaciones antiguas no seleccionadas; no se cuentan como 3/3.

Diagnóstico SQL en `/private/tmp/analytics-perf-baseline-explain.log`: **1919,305 ms** de ejecución; la rama visits/promos devolvía cero filas pero consumía 1758,892 ms. Con índice/compactación, `analytics-perf-index-compact-explain.log` registra **40,276 ms en caliente**, elegido el índice nuevo. Es evidencia de acceso y serialización, no del TOTAL frío.

Dataset preservado: variante heredada de **29,2 millones globales de product_revenue**, no 116,8 millones. Objetivo con cuatro métricas de producto de 29200 filas cada una, revenue/commission de 730 días, auxiliares de dinero conocido de 1120 filas cada una y gasto fijo; el inventario focal conserva esos tamaños. No hubo seed, borrado de métricas ni ANALYZE global. El objetivo perf no tiene actividad de visitas/promos/stock; las fixtures positivas AN-2/AN-3 demuestran exactitud, no rendimiento a su máximo volumen. No se convierte ese límite de representatividad en una promesa general de latencia.

## Fallos, STOP y estado de entrega

Se conservan los fallos de setup: inventario inicial ENOENT por ruta del journal (corregido antes de medir); EPERM de cache del CLI; GET inicial de metadata bloqueado al crear lock de refresh del perfil Neon, stdout vacío, y posterior KeyError del lector local por pending_state opcional. Las correcciones fueron de setup/lectura local y la escalación técnica del mismo GET fue autorizada, sin rechazo de auto-review, copiar claves ni cambiar perfil. Ninguno fue una medición fría ni un retry del resultado de rendimiento.

Después del **único FAIL frío** no hubo otra operación DB/API, reset, suspensión, observación o cambio de producto. No se afirma endpoint IDLE al entregar: el último IDLE probado es anterior al wrapper que lo reactivó. Se preservan dataset y run. No hay procesos propios de QA; el recurso de harness QA se liberó mediante factory antes de entregar el informe. Worktrees conservados; no accept, integrate ni cleanup. El coordinador libera reservas de DB sin hacer consultas.

Solo se entrega este informe desde la base e54, sin traer b3 a dev/main. La combinación de producto y el cierre del requisito no están aprobados. CI compartida, housekeeping, clima, PROD y publicación permanecen fuera de alcance. Cualquier investigación, cambio de producto o nueva observación depende de la próxima decisión expresa del owner; hasta entonces se mantiene STOP.

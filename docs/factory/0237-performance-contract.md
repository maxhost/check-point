# 0237 — Recuperación del rendimiento de evaluación

Encargo del owner 2026-10-17: reabrir solo el pendiente de rendimiento AN-1 sobre AN-1/AN-2/AN-3 integradas. Un implementador dedicado investiga y optimiza con cuidado; coordinador explica el housekeeping (punto 3), sin implementarlo por este encargo. Base dev/main `5afa5294aa844d260313cfc3673f6f69265e0254`.

## Alcance e invariantes

Objetivo: TOTAL evaluateBusiness ≤1000 ms en frío, con conexión, claim/lecturas, cálculo, persistencia y commit incluidos. No restar red/conexión, no precalentar objetivo, no escoger el mejor intento, no mover trabajo fuera del reloj ni bajar carga/CU/umbrales o falsear resultados. Conservar todos los intentos, etapas, SQL/planes, SHAs, parámetros, tamaño de dataset y resultados. La referencia anterior de 2082,39 ms procede de AN-1, no representa una medición nueva de AN-3.

Métodos autorizados: mejorar consultas, índices, agrupaciones, filtros y transferencia de datos redundantes conservando exactamente métricas, ventanas, dinero/null, tarjetas, RLS/tenant, atomicidad/idempotencia y locks/concurrencia. Sin nuevas tablas, particionado, desnormalización, vistas materializadas, columnas/tipos/relaciones nuevos, borrados de datos reales ni cambios de arquitectura o producto. No modificar migraciones 0097–0099; si un índice requiere DDL versionado, proponerlo al coordinador y usar como máximo una migración nueva exclusivamente de índices, asignada antes de escribirla. Cambios de conexiones/transacciones requieren justificar equivalencia y regresiones.

No PROD (ni lectura), push/deploy, llamadas clima, verify global ni mutaciones. No INDEX/TASKS/estado Claude. No solucionar CI compartida ni housekeeping por extensión automática. Si surge contradicción material con la spec, preguntar al owner y parar todo. Un resultado >1000 es FAIL: informar y detener nuevas mediciones frías; entregar diagnóstico para acordar el siguiente paso, sin bucles de reintento. EXPLAIN en caliente no es evidencia del objetivo frío.

## Flujo y reservas

Coordinador reserva contrato/estado. Un implementador en worktree propio desde dev: `analytics-performance`, ruta `/private/tmp/checkpass-analytics-perf/analytics-performance`; entrega `docs/factory/0237-performance-events.md`. QA independiente antes de integración, reutilizando evidencia compatible. No subdelegación. Main local solo tras QA PASS; sin publicación. No tocar root checkout desde workers.

Writer autorizado: `apps/merchant/src/server/analytics/queries/index.ts`, `apps/merchant/src/server/analytics/evaluation/index.ts`, tests focales existentes de evaluation y `docs/factory/0237-performance-events.md`. No alterar dominio/pesos/copias por housekeeping ni tooling/kit/guardias; ampliaciones explícitas por coordinador.

Node24. DB solo `tools/neon-test.sh`; perf exclusiva `/private/tmp/checkpass-0237/perf.env`, recurso `db:analytics-perf` (proyecto/endpoint en perf-resource.json). Wrapper aplica migraciones pendientes: inventariar estáticamente antes, preservar volumen 29,2M y auxiliares, no replay/reset global/seed/ANALYZE global. Se autoriza aplicar las migraciones locales pendientes 0098/0099 únicamente a esta DB efímera si el ledger es compatible, mediante migrador del wrapper. Si hash incompatible, parar e informar; no reparar ledger ni editar migraciones. Reset estrictamente del run/candidatas del comercio sintético/día de medición, conservando métricas. La rama de prueba puede reactivarse/suspenderse para enfriar; no operar otras ramas. Test funcional en replay válido migration.env requiere reserva serial previa por coordinador.

Primera fase sin DB: recuperar evidencia anterior, analizar consultas actuales y proponer hipótesis/plan de medición. Informar al coordinador antes de la primera operación DB. No garantía ficticia de alcanzar 1s: entregar PASS real o bloqueo/FAIL explicado. QA verifica equivalencia, honestidad de medición e identidad del candidato.

## Aclaración operativa — bootstrap perf conocido

El ledger de la DB perf conserva el hash bootstrap de 0097; AN-1 aplicó allí el índice exacto como parche aislado y preservó deliberadamente ese ledger (handoffs AN-1). Ese estado documentado cuenta como base compatible únicamente para aplicar 0098/0099 aditivas mediante el migrador del wrapper, sin reescribir 0097, repetirla ni reparar hashes. Se autoriza inventario físico/ledger dentro del test focal después del migrador, porque el wrapper siempre migra antes del test; dejar ese orden explícito en la evidencia. Un desajuste adicional no documentado sí obliga a detenerse. No se presenta esta DB como un replay desde cero ni como CI compartida reconciliada.

## Asignación explícita — único índice nuevo

Tras EXPLAIN actual AN-3, la rama histórica de visits/promos devolvió cero filas pero consumió 1758,892 ms y 1583 bloques de lectura; firstConsumptionDays añadió 34,854 ms (SQL total 1919,305 ms, no tiempo total de evaluación). Se asigna al implementador `packages/db/src/schema/analytics.ts` únicamente para declarar un índice parcial de daily_metric y una nueva migración 0100 exclusivamente de ese índice, junto con su snapshot/journal. Nunca modificar 0097–0099 ni otros objetos.

Índice candidato btree (business_id, metric, day), predicado sobre visits/promo_discount/promo_sales/promo_cost/voided_tickets/stock_consumption. Incluir columnas de cobertura solo con necesidad acreditada por el plan; justificar costo de almacenamiento/escritura y evitar índices redundantes. No tablas, columnas, constraints ni transformaciones de datos. Construcción únicamente en las DB efímeras asignadas, serial y sin writers competidores; sin operar CI compartida/PROD. Validar snapshot anterior idéntico salvo nuevo índice, hashes previos intactos, resultados exactos equivalentes y plan realmente elegido. No declarar objetivo frío a partir del EXPLAIN.

## Equivalencia del transporte

Se autoriza helper nuevo de prueba `apps/merchant/src/server/analytics/evaluation/snapshot-equivalence.test-support.ts` dentro del scope evaluation reservado. Puede contener el SQL builder legado congelado de base 5fac para comparar con el compacto sobre las mismas fixtures, con procedencia/hashes explícitos; no depender de git show de un SHA histórico en runtime de tests (CI puede ser shallow). Comparar datos y orden completos, candidatos/textos/meta, no solo multisets: el orden de métricas puede afectar empates. No modificar contratos HTTP ni dominio. Trabajo de agrupar/desagrupar queda dentro del reloj. Los casos existentes conservan sus assertions.

## Segundo ciclo autorizado por el owner

Tras informar el FAIL crudo de 1817,621042 ms y preguntar expresamente si autorizaba otro ciclo de lectura, transferencia y conexión con las mismas restricciones, el owner respondió «Ok mientras quiero ver el tema del punto 3» (2026-10-17). Se reabre ese segundo ciclo sobre la fuente conservada b3ca9c6f/entrega058d7c48, sin borrar el FAIL anterior. El coordinador explica el punto 3; no se autoriza cambiar su comportamiento ni la priorización de tarjetas mientras se conversa.

Mismas tablas/datos/CU/criterio TOTAL, sin precalentar el objetivo para la observación fría, mover trabajo fuera del reloj ni escoger un intento favorable. Primero hipótesis y diagnóstico que separen SQL, transferencia/driver, decoder y cálculo; no inferir desde la cifra conjunta que la red es la causa. Se permiten perfiles diagnósticos en caliente declarados como tales, sin llamarlos pruebas frías ni PASS. Nueva observación fría solo tras candidato distinto justificado, regresiones y revisión independiente del método. Si vuelve a exceder 1000 ms, parar e informar; no bucle de reintentos. La 0100 ya aplicada a las DB efímeras se preserva con su hash; no editarla ni añadir más DDL sin nueva asignación explícita del coordinador. No ampliar a nuevas tablas, columnas, particionado, estados de tarjetas, housekeeping o CI compartida.

## Pausa por hallazgo al explicar stock bajo

El owner consulta persistencia/duplicación y prioridad de stock frente a completar gastos. Revisión del coordinador: tarjeta 8 usa amountMinor=null y fingerprint solo sujeto insumo/local+none; aceptar/descartar puede suprimir futuros episodios de ese mismo insumo/local sin reconocer reposición y nueva escasez. La prioridad incluye urgencia/novedad pero no garantiza precedencia de riesgo operativo crítico. No se decide ni corrige por cuenta propia. Se pausa TODO, incluido segundo ciclo de rendimiento, conforme instrucción expresa del owner ante desajustes, hasta aclarar la política.

Al llegar STOP, el diagnóstico de lectura ya iniciado por el implementador terminó EXIT0 sin procesos restantes: wrapper ledger100 sinDDL→WSBEGIN/control select1/input/decode/cálculo/EXPLAIN/wrapped input/commit→HTTPinput. Ningún evaluateBusiness, reset, escritura, DDL, APIcontrol ni nueva observación fría. Log `/private/tmp/analytics-perf-cycle2-warm-profile.log`; un diagnóstico seleccionado y caso frío no seleccionado. Producto b3/FAIL intactos. Harness opt-in añadido sin commit solo en performance.neon.integration.test.ts del worktree, preservado sin descartar. No extrapolar diagnóstico caliente al objetivo frío.

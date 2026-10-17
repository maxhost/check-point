# 0237 — Ciclo del inbox, datos/dominio/servidor (A)

Base común `65b5152e7897ab55023f36358add4df0bd49cb7f`, rama `analytics-lifecycle-data`, worktree `/private/tmp/checkpass-analytics-perf/analytics-performance`. Factory task histórica `analytics-performance`, reutilizada por asignación del coordinador. El WIP de diagnóstico `a900bde2` queda fuera de esta base, preservado en su ref y copias externas. Este encargo no optimiza ni mide rendimiento: el FAIL frío anterior sigue abierto.

## Checkpoint A1: fundamento, no entrega funcional del ciclo

Aprobado por el coordinador para que B pueda comenzar UI/tipos/fixtures sin esperar la transición completa. Catálogo declarativo único con las 13 reglas (11 parqueada), validación, referencias, snapshot profundamente inmutable y versión derivada de todo el catálogo; diccionario de decisiones/categorías y ventanas SQL derivadas. El registro descriptivo no importa evaluadores, evitando el ciclo de inicialización policy → builders → policy.

Entrada pública de configuración: `@mi-pasaporte/domain/analytics/policy/index`. La entrada crea una versión SHA-256 determinista en el servidor; la UI consume exclusivamente los tipos y las capacidades resueltas por DTO. No hay I/O, reloj, variable de entorno, editor ni DB de políticas. A1 todavía no integra todos los parámetros/textos en evaluadores/SQL/ciclo ni ofrece la simulación completa; esas integraciones y la guía definitiva corresponden a A2.

Contrato de tipos congelado:

- `AnalyticsInboxResponse`: contractVersion 2, policyVersion, timezone, state ready/preparing, preparedAt, nextReminderAt y cards.
- `InboxCard`: campos de presentación anteriores y version opaca, category informational/actionable/marketing, expiresAt UTC, period `{ from,to,label }` con fechas locales y decisions `{ key,label }[]`.
- `AnalyticsInboxCommand`: businessId/actorId/cardId, decision resolve/ignore/seen/snooze, expectedVersion, operationId y remindAt opcional.
- `AnalyticsInboxMutation`: cards y nextReminderAt. `AnalyticsCleanupResult`: cutoff/deleted/skipped/budgetExhausted.

A2 implementará las funciones reales `readInbox(businessId,viewer,now?,options?)`, `decideInboxCard(command,viewer,now?,options?)` y `cleanupInbox(now?,options?)` en `server/analytics/lifecycle/index.ts`. Options permite inyectar un snapshot de política; cleanup permite presupuesto/lote acotados. **No se agregan stubs que aparenten servicios ya operativos. HTTP espera A2.** `LegacyInboxCard` es un tipo transitorio interno del lector anterior: este checkpoint no etiqueta su salida como v2 ni afirma que haya cambiado el comportamiento del inbox público.

## Evidencia de A1

Node 24.20.0. Unit `policy.test.ts`: 5/5 PASS, sin DB, skips ni retries. Casos de validación/configuración inmutable, versión completa determinista sin mutar entrada, ventanas según reglas habilitadas, referencias/números/categorías inválidas y Marketing parqueado; textos con campos explícitos. Logs finales `/private/tmp/analytics-lifecycle-a1-unit-final.log` y `/private/tmp/analytics-lifecycle-a1-types-final.log` (Merchant typecheck). Lint focal EXIT 0 en `/private/tmp/analytics-lifecycle-a1-lint-fixed.log`; diff-check PASS.

Fallos conservados: primer unit/tsc no encontró el paquete porque la exportación wildcard requiere `/policy/index`, se corrigieron imports y README sin ampliar package.json. Segundo tsc detectó asignación a propiedad readonly en la fixture negativa; se cambió la construcción de esa entrada inválida, manteniendo la comprobación de rechazo. Logs `/private/tmp/analytics-lifecycle-a1-unit.log`, `analytics-lifecycle-a1-types.log` y `analytics-lifecycle-a1-types-fixed.log`. No se presenta ninguna corrida fallida como PASS.

No se ejecutó DB, API, migración, benchmark, clima, verify global ni mutaciones en A1. El borrador propio de 0101/schema/journal se conserva fuera del checkpoint en `/private/tmp/checkpass-analytics-perf/lifecycle-a2-draft/manifest.json` y archivos exactos; no se aplicó y no se afirma listo. A2 lo completará antes de cualquier wrapper.

## Contrato técnico aprobado para A2

Una migración 0101 sobre las tres tablas existentes. Contenido único comercio/tipo/asunto, edad/caducidad fija y referencia de política/contexto. Estado compacto con identidad persistente sin FK al contenido, últimos cursores/factos de 5/9 sin textos de notificación, decisión/revisión/última operación/digest y recordatorio consumido una vez; no arrays de historial. Evaluation_run registra policyVersion del trabajo. 9 conserva conteo/evento como asunto distinto. Transición conserva el inicio más antiguo demostrado; accepted antiguo no se convierte en Solucionado. Solo ancla una vez los casos sin fecha demostrable. 11 pierde contenido, no métricas ni histórico.

Orden de exclusión acordado: lock estable del comercio antes de cualquier source lock/delta, luego fuentes/asuntos en orden; mismo orden en evaluación/ingesta/comandos/late12/facts/gauges/cleanup. Cleanup usa expiresAt efectivo, lotes y presupuesto del snapshot, try-lock/skip de ocupados y revalidación dentro de la transacción. No locks globales de la DB ni otro sistema de retención.

Para recuperar un hecho legado 5/9 se permite solo el evento genérico core.module_event identificado estructuradamente por una candidata existente y elegible por delivery/H2, con su traductor puro. Sin escanear/backfill de eventos anteriores al encendido, leer tablas de origen, parsear título/cuerpo ni hacer esa recuperación en GET. La ausencia de fuente no se convierte en cero ni en hecho inventado.

## Checkpoint A2 inicial congelado antes de aplicar 0101

0101 SQL SHA-256 `a0ce4609eb527518be6ac5f350e5d33801f3055b4ba49fdd52298778d9a5ce3f`, todavía sin aplicar al escribir este checkpoint. Schema/snapshot solo añaden metadata de ciclo a candidate/state/run, cambian la unicidad de contenido a comercio/tipo/asunto y crean índices de caducidad/recordatorio/identidad. No nuevas tablas ni cambios de métricas o 0097–0100. La transición SQL conserva policy_version/context_version `legacy`; no afirma que se haya reevaluado con la configuración nueva.

`lifecycle/index.ts` implementa realmente readInbox, decideInboxCard y cleanupInbox sobre esas columnas: filtro de política vigente, caducidad efectiva, cierre con eliminación de contenido, CAS/última operación/digest, recordatorio futuro acotado y consumo único al vencer; cleanup por lotes con skip/try-lock y fecha efectiva. El DTO añade refreshAfterMs desde fallbackWaitMs para evitar otra constante de UI. Estos servicios no son stubs. La integración del generador/sincronizador, contextos por tipo, reconstrucción de 5/9 y recuperación causal de 8 sigue en trabajo; el HTTP anterior todavía no sirve v2 y **este checkpoint no equivale a PASS funcional completo**.

El lock estable del comercio se toma ahora antes de source locks/deltas en la entrada de ingesta y antes del lock diario heredado en todas las entradas actuales de evaluación/hechos/campañas/lector/decisión anteriores. No se modificó el corte ni los eventos/métricas. Se probará la carrera real por Neon tras aplicar la migración.

Correcciones tempranas de QA A1: validación cruzada compara existencia para admitir y validar correctamente cero en cuantiles/riesgo; ventanas derivadas incluyen comparisonDays+1; canonicalización usa orden de código Unicode sin localeCompare; policyVersion incluye el registro y ANALYTICS_EVALUATOR_VERSION además de todo el catálogo. Unit de política: 7/7 PASS en `/private/tmp/analytics-lifecycle-a2-policy-unit.log`. Merchant typecheck y lint focal inicial EXIT 0; logs `analytics-lifecycle-a2-types-freeze.log`/`analytics-lifecycle-a2-lint-freeze.log`. La composición efectiva de varias reglas por handler queda pendiente del refactor de evaluadores y no se declara cerrada por estos unit.

Prueba de transición autorizada en dos fases: wrapper con journal sin la entrada PENDIENTE 0101 solo para sembrar el comercio sintético propio, preservando las entradas/hashes 0097–0100 y restaurando el archivo completo mediante finally; luego wrapper oficial con 0101 para comprobar el legado y limpiar únicamente esa fixture. Sin tocar ledger ni reset/replay global. Antes de ejecutarla se entrega este SHA y hash de SQL al coordinador/QA. No se afirma aquí que esa prueba haya corrido todavía.

### Correcciones previas a la primera aplicación de 0101

El SQL inicial anterior NO se aplicó. Lectura temprana del coordinador/QA detectó que day de 1 era día de evaluación, mientras subject_key probaba el período vendido; se conserva ese origen antes de normalizar. Dismissed de ese mismo período conserva Ignorar por período (no por importe); accepted sigue abierto. Candidatas 5/6 sin contexto atendido demostrable, y 9 sin evento inmutable/delivery elegible demostrable, permanecen abiertas por prudencia; una huella monetaria no cierra un hecho nuevo. Contexto conserva únicamente estado/período original y referencias estructuradas, nunca copy. Los 90 días históricos de la transición usan exactamente 2160 horas.

SQL corregido antes de DB: SHA-256 `42698db1378c860d1b85bab4487f9281eb3e4416e3b6b8a5bee6bd255e031d3c`. Añade un índice estrecho episode_started_at/id para que la reducción de TTL tenga un predicado sargable junto al índice expires_at/id. Cleanup descubre sin row locks, intenta business locks en orden, luego row-lock/CAS con skip de ocupados; excluye comercios ocupados y filas ya intentadas durante la invocación y continúa aunque un lote no haya borrado nada. No se aplica el orden inverso candidato→business del primer borrador.

Neones focales escritos, todavía no ejecutados a este checkpoint: transición pre/post y servicios de identidad/medianoche, cierre/retry, recordatorio único, fechas inválidas, límite exacto, rollback y carrera versión/publicación, más ocupado primero/otro comercio elegible. Se mantienen fuera del encargo los benchmarks y todo PROD. El primer lint de estos tests señaló un import no usado, corregido sin cambiar aserciones; fallo en `analytics-lifecycle-a2-lint-corrections.log`, comprobación corregida en `analytics-lifecycle-a2-lint-corrections-fixed.log`.

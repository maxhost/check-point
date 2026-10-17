# 0237 — QA independiente de entrega inmediata de Gastos

**PASS funcional de las entregas A y B y de la combinación final, con dictámenes separados.** Se conserva el primer focal fallido; el PASS nuevo corresponde a otra fuente congelada.

| Objeto | SHA exacto | Dictamen |
|---|---|---|
| Entrega A | `ca6bce0411431c8dc43e708f7e721cdf2cd1dab2`, producto `1ac9aaf8cd52cd4b6b789df3a0a75742891af5ed` | **PASS** de programación/rutas y checks focales en su alcance. |
| Entrega B | `1dffa641474802f29493940503271e979752f129`, test `beeb1339`, Neon sobre dd0bb1b6 | **PASS** de evidencia de integración real y handoff corregido. |
| Combinación | `d10887ad36a568d95d91c0ae120c791b5cf72c6d` | **PASS funcional**, producto apps/packages/tests idéntico al combinado medido `dd0bb1b65a9aaf463601a9ccb0662f2f1e712f4a`. Cambios posteriores son documentación. |

Base QA `c0f727746d19f8d47383c7f4e9825159b10b3f12`, WT `expenses-immediate-qa`, sin mover checkout. Mandantes: [contrato](0237-expenses-immediate-contract.md) y [spec0237 §2.3](../specs/0237-analiticas-inbox-y-resumenes-diarios.md), incluida corrección d4590f57. Handoffs cotejados por blobs `ca6bce04:docs/factory/0237-expenses-immediate-a.md` y `1dffa641:docs/factory/0237-expenses-immediate-b.md`, no por archivos inexistentes en la base QA. QA solo lee código y evidencia, sin producto, DB, API, suites, servidores ni agentes adicionales. Ningún hallazgo funcional abierto en el alcance revisado.

| Invariante | Resultado cotejado en fuente y evidencia |
|---|---|
| Commit antes del intento | POST/PUT/DELETE esperan éxito del writer transaccional antes de programar; fallo de validación/writer no programa. B observa evento durable tras respuesta y antes del callback. |
| Respuesta independiente | No await del procesamiento; after, alternativa fuera de Next y callback/rechazos no convierten un gasto confirmado en error. La respuesta conserva status y JSON existentes. |
| Scope acotado | retryModuleEvents recibe negocio del contexto autenticado, expense.recorded/updated/deleted, solo core.analytics, budgetMs20000 y batchSize50 (corrección técnica documentada en d4590f57). Sin force ni scope global; no toca deliveries Stock. |
| Batch/idempotencia | Una programación por petición, incluso30 líneas. Replay puede drenar pendientes; no duplica eventos ni dinero. No se promete agotar backlog dentro del presupuesto. |
| Cadena real | B usa rutas con contexto autenticado y after controlado: alta→edición→borrado, callback posterior a respuesta, delivery aplicada y resumen exacto/reemplazado/cero. Retry conserva métricas; tenant y suscriptores ajenos intactos. |
| Durabilidad/regresión | Productores, traductor puro, dinero/null/moneda, deduplicación, corte Stock y cron existentes conservados; sin migración ni endpoint/config nuevos. |

Dictamen entrega A corregida: **PASS** de `ca6bce0411431c8dc43e708f7e721cdf2cd1dab2`, solo handoff sobre producto `1ac9aaf8cd52cd4b6b789df3a0a75742891af5ed`. Entrega A inicial `d54533a4` revisada en su alcance propio, sustituida para la combinación final por la corrección técnica. Se reutiliza evidencia focal compatible sin contar filtros/retries como PASS. Rendimiento general FAIL y demás diferidos se conservan; esta aceleración no cambia requisitos de mes cerrado/cobertura.

## Revisión temprana A

Fuente congelada `263790be4ac3fa761c02efa02031d03c2c0c8b2f`, solo delivery.ts, delivery.test.ts y routes.ts. Lectura favorable sin hallazgos: las tres rutas esperan el writer transaccional antes de programar una vez; JSON/status y guard de permiso permanecen. Helper async captura fallos síncronos/asíncronos del retry y la ausencia de contexto Next usa alternativa detached; sin await de finalización ni scope basado en body. Opciones exactas de contrato, sin force. Traductores/writers/retry/cron/Stock intactos.

Leídos los 16 casos del test y `/private/tmp/expenses-immediate-a-unit.log`: 16/16 PASS, sin filtros, 1,07 s. Cubren espera del writer, callback posterior, scope, batch de 30 y replay simulado, fallos del writer y del intento, no programación de GET/drafts, alternativa aún pendiente al responder y rechazo no observado. Tipos/lint de autor declarados EXIT0 en sus logs asignados (sin salida). No son DB ni idempotencia real; la señal B posterior cubre esos límites. Git diff/check del checkpoint limpio. Handoffs A cotejados por blobs d54533a4 y ca6bce04, `docs/factory/0237-expenses-immediate-a.md`; sin ampliar claims sobre DB/Next.

## Lectura focal B antes del resultado

Test inicial `beac70c401c211d1b49b2cf8c91d126c5d5b85a3`, integrado con A en `d93599f79ddd03d4aa9bcc991680771c52252436`. Producto de e6865620 idéntico. La fuente corregida conserva las aserciones y añade solo diagnóstico de duración.

El test usa rutas autenticadas reales y after controlado. Antes de ejecutar el único callback registrado observa gasto/evento confirmados, delivery core pendiente y métrica vacía o importe anterior; después exige aplicada/revisión e importes12345→23456→0 con cambio de fecha/local/concepto/fijo-variable y contribuciones vacías al borrar. POST/DELETE repetidos no duplican eventos ni dinero; PUT ajeno404 no programa. Core ajeno, delivery transport de mismo evento y deliveries sale.closed del mismo comercio se comparan completos e intactos; captureCountCut/validateCountCut no cambian. No se modifica el processor ni se usa force/retry del runner. No prueba servidor Next ni garantía temporal de entrega antes de navegación.

Primera señal real `d93599f7`: **FAIL 1/1**, sin skips/retries, EXIT1; raw `/private/tmp/checkpass-expenses-immediate/expenses-immediate-b-neon-d93599f7.log`, 15,42 s total. El primer callback dejó delivery recorded en processing/attempts1 frente a applied esperado; no se alcanzaron las aserciones posteriores de la cadena. Teardown sin errores de hooks según autor. No se drenó después ni se relajó la expectativa. Estado compatible con vencimiento del presupuesto después del claim, pero el raw no demuestra causalidad: el procesador existente absorbe errores y conserva claims durables recuperables. Ese resultado conserva FAIL; no se presta evidencia posterior a esa fuente.

## Corrección técnica y señal final

Contrato/spec modificados en `d4590f57` antes del producto: 2 s era el default técnico copiado de POS, sin límite exigido por owner. Se ajustó a 20 s. Fuente A `1ac9aaf8cd52cd4b6b789df3a0a75742891af5ed` cambia únicamente literales 2000→20000 en helper y expectativa de scope del unit: **16/16 PASS**, 668 ms, log `/private/tmp/expenses-immediate-a-budget-unit.log`, tipos/lint EXIT0 de autor. B `beeb1339` solo registra phase/elapsedMs en finally del callback; no rebaja applied/importes/scope ni agrega assert de velocidad.

Combinado congelado durante el único focal corregido: `dd0bb1b65a9aaf463601a9ccb0662f2f1e712f4a`. Raw `/private/tmp/checkpass-expenses-immediate/expenses-immediate-b-neon-dd0bb1b6.log`: **1/1 PASS, cero skips/retries, wrapper EXIT0**, 32,68 s total / 28,08 s caso, setup/teardown sin fallos de hooks. Todas las aserciones de la cadena llegaron a ejecutarse. Wrapper `tools/neon-test.sh --app merchant src/modules/expenses/server/immediate.neon.integration.test.ts --no-file-parallelism`, configuración protegida asignada, recurso DB exclusivo B, Node24.20.0. Paso idempotente de migraciones existentes; sin migración nueva ni modificación de ledger. QA no operó DB. Tipos/lint B finales EXIT0, logs `/private/tmp/checkpass-expenses-immediate/expenses-immediate-b-{types,lint}-dd0bb1b6.log`, cotejados.

Elapsed de callbacks: create 3154,78 ms, replay 453,26 ms, update 2744,65 ms, delete 2480,38 ms y replay 457,13 ms. Son diagnósticos de esta corrida, sin SLA, assert de velocidad ni PASS de rendimiento. No hubo drenaje/cron/retry adicional para completar la cadena.

20 s coincide con el tope existente del retry; ruta genérica maxDuration60s no se modifica. Ninguna promesa de completar el backlog ni de disponer de 20 s enteros si el guardado consume el margen. Presupuesto del callback no bloquea respuesta; cron/claim durable conservan responsabilidad si falla. Duraciones diagnósticas no certifican rendimiento general ni prueban por sí solas causa del primer fallo.

## Límites y cierre

after está controlado en el focal; se ejercitan dispatcher, cookies/tenant, writers, eventos, retry, traductor y DB reales, sin servidor Next/browser ni prueba del cron remoto. El batch de 30 y los fallos de transporte son unit; no se atribuye cobertura Neon de esos escenarios. La corrección de una frase del handoff B sobre maxDuration es solo documental: la ruta global no cambió y no requiere nuevas pruebas.

Sin suites adicionales por ceremonia, verify global, mutaciones, API/clima, benchmark, PROD, push/deploy o main por QA. Rendimiento general FAIL y diferidos preservados; este dictamen acotado no mide ni vuelve a cerrar aquel requisito. Worktree retenido, sin cleanup. El recurso harness QA se libera antes de factory deliver; B declara DB liberada tras teardown y sin operaciones posteriores.

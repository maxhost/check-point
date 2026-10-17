# 0237 — Gastos: intento inmediato de entrega a Analíticas

Candidato funcional `f9a190b7371d73f490f9227c0e194df7379184ae`; pendiente informe final de QA y pase local. [Contrato](0237-expenses-immediate-contract.md), spec0237§2.3. Owner pidió que guardar gastos dispare procesamiento como POS, conservando cola/cron durable como respaldo.

## Cambio

POST/PUT/DELETE de Gastos esperan el commit del writer y programan un intento detached con after y fallback seguro fuera del contexto Next. Un intento por solicitud/batch, exclusivo del comercio autenticado, tres eventos expense.* y suscriptor core.analytics. Presupuesto técnico20s, lote50; no espera al procesamiento para responder. Fallos del intento no convierten un gasto confirmado en error. Reintentos usan el mecanismo durable/deduplicación existentes, sin sumar métricas por otra vía.

No cambia transacción de gastos, permisos, respuestas HTTP, traductores, dinero/null/moneda, eventos previos al inicio de Analíticas ni corte Stock. No nueva migración, seed, backfill, UI, cron remoto o modificación de POS/retry genérico. Punto de equilibrio conserva mes cerrado con gastos, cobertura suficiente y margen positivo.

## Fuentes y evidencia

- Base funcional dev/main `819dec19`, contrato e76825db/spec c0f72774. A inicial263790be, entrega d54533a4; corrección técnica documentada d4590f57 antes del producto.
- A final: entrega `ca6bce0411431c8dc43e708f7e721cdf2cd1dab2`, producto `1ac9aaf8cd52cd4b6b789df3a0a75742891af5ed`. [Handoff A](0237-expenses-immediate-a.md).16/16 unit PASS,668ms, sin skips/retries; tipos/lint/diff EXIT0. Logs `/private/tmp/expenses-immediate-a-budget-{unit,types,lint}.log`. Prueban rutas postwriter, batch, scope, no bloqueo, errores sync/async, after/fallback, GET/drafts sin dispatch y respuesta estable; no sustituyen DB real.
- B: fixture originalbeac70c4, diagnóstico beeb1339; entrega `030fed7247e90dbdb97f4cfc86dddba02884b7b4`, sobre combinado `dd0bb1b65a9aaf463601a9ccb0662f2f1e712f4a`. [Handoff B](0237-expenses-immediate-b.md). Un caso Neon real por dispatcher autenticado, callback capturado/awaitable después de respuesta: alta12345→edición23456/cambio fecha-concepto-local→borrado0, revisiones/contribuciones exactas, replays sin doble importe, tenant ajeno/otra delivery/venta fuera de scope y corte Stock estable.1/1 PASS, cero skips/retries,32.68s runner/28.08s caso. Raw `/private/tmp/checkpass-expenses-immediate/expenses-immediate-b-neon-dd0bb1b6.log`; tipos/lint EXIT0 con logs en el mismo directorio.
- Diagnóstico callbacks create3154.78/update2744.65/delete2480.38ms; replays453.26/457.13ms. No benchmark general ni promesa de latencia/SLA. Next after controlado por fixture: no se afirma smoke nuevo del servidor real/navegador.
- QA independiente: pendiente informe definitivo de entregas y combinación; sin ejecutar DB ni implementar producto.

Node24.20.0. DB automatizada solo wrapper tools/neon-test.sh con replay protegido seleccionado, fuente inmóvil en cada corrida y teardown propio. No nuevos DDL/ledger/reset. B liberó recurso replay al entregar; autores no tienen procesos persistentes. Sin verify global, mutaciones de tests, push/deploy/PROD ni llamadas clima.

## Fallo conservado y límites

Primera corrida combinada d93599f7 con presupuesto2s:1/1 FAIL, EXIT1, primer callback dejó core processing/attempts1 en vez de applied; no llegó a comprobar update/delete y no hay PASS parcial. Raw `/private/tmp/checkpass-expenses-immediate/expenses-immediate-b-neon-d93599f7.log`. Diagnóstico compatible con agotamiento del presupuesto después de claim, no causalidad exclusiva demostrada por ese log.

2s era default técnico copiado de POS, no límite del owner. Se cambió a20s (máximo existente del procesador; ruta existente maxDuration60), conservando asserts/scope/lote y no bloqueo. Nueva corrida sobre código corregido completa la cadena sin cron/retry posterior para fabricar aprobación. No se garantiza completar cualquier backlog antes de responder o dentro de una sola invocación; el cron sigue siendo necesario ante fallos/interrupciones/lotes grandes.

Los datos de Joyas de Cutilan en Docker no se modificaron por estos tests ni se drenó su cola durante la implementación. El próximo guardado autenticado de un gasto también intenta procesar pendientes de gastos del mismo comercio. Las dos filas antiguasMXN sin deliverycore no se convierten/backfillean aUSD. Ya se habían aplicado localmente0097–0101 por autorización previa,102/102hashes verificados; esta tarea no necesitó nueva migración.

Rendimiento general de Analíticas sigue FAIL1817.621042ms frente a1000ms, sin nueva medición. Se conservan cron remoto/ciudades/CI original, clima-calendario visible, «cuánto ahorraste», Marketing agregado/cupón y tarjeta11 parqueada. No INDEX/TASKS/estado Claude ni archivos ajenos. Pase main/cleanup pendientes del cierre QA, sin publicación.

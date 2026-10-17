# 0237 — Procesamiento inmediato de Gastos

Encargo del owner: al guardar gastos intentar procesar sus entregas a Analíticas como hace POS, conservando la cola durable y el cron como respaldo. Base dev/main local `819dec19ffbd512c59a28213bed9a236c13b0864`. Coordinador, dos implementadores y QA independiente según ADR0144. Sin push, deploy, PROD, nueva migración, cron remoto, backfill, seed, verify global ni mutaciones de tests.

## Contrato cerrado

- Tras éxito y commit de POST entries, PUT entries/:id y DELETE entries/:id, programar intento acotado no bloqueante de las entregas del comercio autenticado y los tipos expense.recorded/updated/deleted, exclusivamente suscriptor core.analytics. Usar retryModuleEvents existente; no sumar métricas directamente ni cambiar deduplicación, transacciones o corte Stock.
- Como POS: after() cuando hay contexto Next; alternativa segura cuando no lo hay. El programador y su callback nunca convierten un gasto ya confirmado en respuesta de error. Un fallo del guardado no programa procesamiento. El callback debe empezar después del commit, no dentro de la transacción.
- Presupuesto inicial2000ms/lote máximo50 como aceleración POS. No esperar su finalización en la respuesta. Batch de hasta30 gastos sigue siendo batch; sin disparar un worker por línea. Repetir solicitud idempotente no duplica eventos ni importes; puede ayudar a drenar pendientes del mismo comercio.
- HTTP mantiene permisos, validación, códigos y JSON existentes. No endpoint público nuevo ni configuración/env/switch para Analíticas. Traducción pura y dinero exacto/null/moneda siguen iguales. No reabrir condición de mes cerrado o cobertura para punto de equilibrio.
- Existirán entregas pendientes si se agota tiempo, hay error o cae proceso; cron continúa como recuperación durable. No prometer actualización síncrona ni entrega garantizada antes de que el navegador navegue.

## Roles y comprobaciones

A: paths apps/merchant/src/modules/expenses/server/routes.ts, delivery.ts nuevo, delivery.test.ts nuevo y docs/factory/0237-expenses-immediate-a.md. Implementa y prueba programación post-commit, create/update/delete, fallo/rechazo/no bloqueo, scope y fallback. Puede proponer ubicación alternativa al coordinador, no ampliar paths por cuenta propia.

B: nuevo apps/merchant/src/modules/expenses/server/immediate.neon.integration.test.ts y docs/factory/0237-expenses-immediate-b.md. Un focal real de cadena create→update→delete por rutas autenticadas, after controlado ejecutado tras respuesta, delivery/core+resúmenes exactos, retry idempotente, tenant y sin tocar suscriptores/corte Stock. Preparar desde base común, ejecutar solo tras integrar A y refrescar WT limpio. DB exclusivamente tools/neon-test.sh y replay protegido /private/tmp/checkpass-0237/migration.env, recurso serial reservado. No cuenta Joyas ni DB local en tests automatizados.

QA: solo docs/factory/0237-expenses-immediate-qa.md. Dictámenes separados de entregas y combinación exacta; reutiliza evidencia compatible y señala límites. No implementar producto, subdelegar ni ejecutar suites por ceremonia. Coordinador integra en dev y registra handoff/estado. Candidato main local después de QA, dentro de la autorización de mantenimiento local; sin publicar. Si aparece contradicción material consultar al owner y parar.

Pruebas proporcionales: unit focal nuevo, Merchant tipos/lint de paths, Neon focal nuevo y regresión de gastos solo si los cambios invalidan evidencia anterior. Node24.20.0. Evidencia ligada a SHAs/logs/comandos/resultados reales; skips/retries no son PASS. Rendimiento general FAIL y todos los diferidos se conservan.

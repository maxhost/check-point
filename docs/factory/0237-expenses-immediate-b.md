# 0237 — Gastos inmediato, integración B

Task `expenses-immediate-b`, worktree propio
`/private/tmp/checkpass-expenses-immediate/expenses-immediate-b`, base `c0f72774`.
Alcance exclusivo: nuevo `immediate.neon.integration.test.ts` y este handoff.

## Checkpoint de preparación

Un caso Neon prepara una cadena completa por el dispatcher y las cookies reales:
POST gasto fijo/local → replay de operación → PUT a otro concepto/día y ubicación
global → DELETE → replay de borrado. `next/server.after` se captura sin ejecutar
el callback hasta después de recibir/leer cada respuesta. Antes comprueba origen
confirmado, delivery core pendiente y resumen/revisión anterior; después exige
delivery aplicada y dinero exacto/revisión correspondiente. Una operación repetida
no crea evento ni importe adicional. La eliminación deja contribuciones vacías y
revisión tombstone, sin borrar el histórico de eventos.

Scope verificado por el oráculo: otro comercio conserva su gasto/core pendiente;
la edición de un ID ajeno retorna 404 sin programar after. Una venta publicada
por el productor real conserva todas sus deliveries y el corte Stock, incluso
cuando core queda pendiente. Delivery de transporte independiente del evento de
gasto conserva estado/intentos; no es un suscriptor de consumo. El callback no
puede drenar otro tenant, evento no expense ni suscriptor distinto de core.

Preparación con Node 24.20.0: formato/lint focal y diff-check sin errores; Merchant
typecheck EXIT 0. **Todavía no se ejecutó Neon ni hay PASS funcional.** Se espera
el SHA de A integrado por el coordinador, FF del checkout limpio y refresh de
factory antes de obtener GO de DB. No se usan skips como evidencia.

DB asignada: replay protegido mediante `tools/neon-test.sh` y
`NEON_TEST_ENV_FILE=/private/tmp/checkpass-0237/migration.env`, recurso serial
`db:analytics-lifecycle-replay`. Sin DB de Joyas/local/PROD, migración nueva,
reset/ledger, seed global, verify, mutaciones, push o deploy. Se conserva el
presupuesto real de 2000 ms del intento; una aplicación que no quepa se informará
como resultado real, sin drenar después con cron/retry para fabricar aprobación.

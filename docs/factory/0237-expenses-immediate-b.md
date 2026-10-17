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

## Primera ejecución real: FAIL

Checkpoint de test `beac70c4`; fuente combinada inmóvil de la corrida
`d93599f79ddd03d4aa9bcc991680771c52252436` (A `263790be`). Node 24.20.0.
Comando autorizado, exclusivamente ese archivo y sin paralelismo:

```sh
NEON_TEST_ENV_FILE=/private/tmp/checkpass-0237/migration.env \
  tools/neon-test.sh --app merchant \
  src/modules/expenses/server/immediate.neon.integration.test.ts \
  --no-file-parallelism
```

Log crudo:
`/private/tmp/checkpass-expenses-immediate/expenses-immediate-b-neon-d93599f7.log`.
Wrapper EXIT 1; **un test ejecutado, un FAIL, cero skips/retries**. Vitest duró
15,42 s; el caso 9,36 s. El wrapper realizó su paso idempotente de migraciones
existentes; B no creó/cambió migraciones, ledger ni configuración.

El POST respondió 201 y dejó evento/core pendiente con resumen aún vacío. Tras
ejecutar el único callback after esperado, la delivery quedó `processing`,
`attempts:1`, en vez de `applied` (línea 180 del test). La cadena no llegó a los
asserts de edición/borrado. No se afirma PASS del procesamiento inmediato ni de
esa parte no ejecutada. El resultado es compatible con un presupuesto agotado
después del claim; la causa exacta requiere evaluación del coordinador/A.

Se avisó inmediatamente a coordinador, A y QA. No se aumentó el presupuesto de
2000 ms, cambió expectativa ni ejecutó drenaje posterior/cron/retry para ocultar
el fallo. Setup y teardown concluyeron sin errores de hooks; el runner terminó.
El recurso DB continúa reservado hasta la indicación del coordinador.

## Preparación de segundo intento, sin ejecutarlo

El coordinador y QA revisaron el presupuesto técnico que inicialmente se había
copiado de POS: spec/contrato `d4590f57` ahora fijan el máximo existente de retry,
**20000 ms**, con respuesta todavía no bloqueante, lote 50 y mismo scope, sin
force. A cambia el presupuesto del helper y su unit; conserva maxDuration 60 ya existente sin modificar la ruta. B no fija el presupuesto
desde el test ni modifica sus asserts de aplicado/dinero/tenant/corte.

El test añade únicamente diagnóstico `EXPENSE_IMMEDIATE_CALLBACK` por fase:
create, create-replay, update, delete y delete-replay. Registra tiempo real del
callback esperado, sin aserción artificial de velocidad, drenaje posterior,
cron ni retry externo. El FAIL y las fases no ejecutadas de la primera corrida
se conservan arriba; un eventual resultado nuevo no los sustituye.

Se espera combinación del nuevo producto de A, fuente congelada y GO del
coordinador antes de tocar DB otra vez. Este checkpoint no tiene nueva evidencia
Neon ni cambia el resultado de `d93599f7`.

## Segunda ejecución real: PASS del alcance B

Checkpoint de diagnóstico `beeb1339`; fuente combinada congelada durante la corrida
`dd0bb1b65a9aaf463601a9ccb0662f2f1e712f4a`, con producto A `1ac9aaf8` y presupuesto
real 20000 ms. Mismo comando focal/wrapper/configuración protegida y Node 24.20.0,
sin paralelismo. Log crudo distinto:
`/private/tmp/checkpass-expenses-immediate/expenses-immediate-b-neon-dd0bb1b6.log`.

**Wrapper EXIT 0, un archivo/un test PASS, cero skips/retries.** Runner 32,68 s;
caso 28,08 s. Setup y teardown concluyeron sin fallos de hooks. No se alteró el
test para aceptar pendientes ni se ejecutó cron/retry posterior para completar la
cadena. Pasaron todos los asserts originales de aplicado, dinero/revisión,
idempotencia, tenant, suscriptor independiente, evento ajeno y corte Stock.

Diagnósticos observados del callback (no latencia de la respuesta HTTP):

| Fase | Tiempo observado |
|---|---:|
| create | 3154,78 ms |
| create-replay | 453,26 ms |
| update | 2744,65 ms |
| delete | 2480,38 ms |
| delete-replay | 457,13 ms |

Son evidencia del intento acotado en esta DB/snapshot. No se presenta como garantía
de actualización síncrona, entrega de todo backlog, SLA ni PASS del rendimiento
general diferido. La respuesta conserva after detached; los unit de A certifican
su programación/no bloqueo y el fallback, mientras este focal ejecuta el callback
controlado después de leer cada respuesta.

Los dos resultados quedan ligados a sus fuentes: `d93599f7`/2000 ms FAIL, y
`dd0bb1b6`/20000 ms PASS tras la corrección técnica de producto. No se sustituyó el
fallo anterior ni se cuentan sus fases posteriores como ejecutadas. No migración
nueva ni cambios de ledger, configuración, herramientas o estados comunes por B.

Merchant typecheck final y lint focal EXIT 0 sobre esa fuente; logs crudos:
`/private/tmp/checkpass-expenses-immediate/expenses-immediate-b-types-dd0bb1b6.log`
y `expenses-immediate-b-lint-dd0bb1b6.log` en el mismo directorio. Diff-check sin
errores. No procesos de B pendientes; se libera el recurso replay tras finalizar
teardown, antes de factory deliver. QA de combinación/main queda al coordinador;
B no mueve main ni retira worktree por su cuenta.

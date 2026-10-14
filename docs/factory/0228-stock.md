# Entrega A — implementación0228 y esquema común0229

Base operativa `e62b07dd1332acdc30efdda7ee1786de161917c4`; worktree `/private/tmp/checkpass-0228/factory-0228-cost-spec`, rama `factory-0228-cost-spec`, reserva `cost-spec-0228`. Conserva entrega documental59225f9b. Fundamento común `c9e75c87018d49f29f9827880e37dec6a2c22edb`; producto `c22089c37b9d949b8840ddc0096404db90409d74`; revisión final de pruebas `59d3413d98766590d5f62db3acda3ba185f0760b`. El commit de este informe sólo añade documentación. No push, main local, servidores ni PROD.

## Resultado y contrato

0084 añade promedio local numeric(14,6) nullable y marcador de inicialización, además de chargesVat false/saleVatRate numeric(5,2) nullable/recoversPurchaseVat false y sus constraints fiscales. Journal/snapshot únicos generados serialmente; conserva EXPAND0227, sin inferir contract0082/0083. B incorporó el fundamento congelado; A es único writer DB.

Stock calcula con bigint3/2/6 sobre importe exacto y saldo anterior bajo lock insumo→par, antes de insertar. Compra retroactiva pondera en registro actual; último costo conserva orden por fecha. Sin precio conserva null/cero/costo; saldo anterior no positivo o positivo desconocido toma precio nuevo. Entradas repiten líneas en orden y mantienen todo o nada. Ajustes/consumos no reponderan ni borran costo; el lock individual copia último costo del MISMO local una vez, incluido null/cero. El consumidor bulk conserva promedio/marcador. DTO agrega weightedAverageUnitCost nullable6 sin exponer marcador y mantiene lastUnitCost.

Compras/entradas invocan un único retry durable previo por comercio/local con budgetMs2000 y force, fuera de su transacción y de locks POS; fallo/timeout/pending no rechaza la compra. Importe pagado IVA incluido sin consultar dato fiscal ni cambiar Recetas/POS/Marca UI. Ningún cambio del retry/consumption existente en esta revisión.

`tools/stock-average/README.md` concreta expand, pausa/corte verificable de writers, SHA desplegado, seed y rollback. `initializeAverageCosts` exige confirmación técnica de writers antiguos detenidos/SHA, toma locks insumo→pares ordenados, copia último costo local sólo sin marcador, valida pares/costos conservados y admite lote por comercio. No runner/credenciales ni ejecución PROD. Después de rollback a writer antiguo, reactivar requiere resolver explícitamente las compras del intervalo; nunca reseed/replay silencioso.

## Evidencia efectiva

Node24.20.0, pnpm11.4.0 y dependencias propias frozen-lockfile. CI-only `/private/tmp/checkpass-0228-0229-ci.env`; DB reservada exclusivamente A también durante DDL/teardown. Todos los tests DB mediante `tools/neon-test.sh`, con `--no-file-parallelism`; comandos escalados fuera sandbox tras diagnóstico local de procesos/red. No tests contra DATABASE_URL PROD.

- Unit fórmula/parse/frontera `pnpm --filter @mi-pasaporte/merchant exec vitest run src/modules/stock/numbers.test.ts src/modules/stock/parse.test.ts src/modules/modules-boundary.test.ts`: **17/17 PASS, EXIT0**, código idéntico en59d. Incluye ejemplo2.666667, importe exacto1.428571, mitad6, límites y null/cero/negativo.
- Nueva `stock/stock-average.neon.integration.test.ts`: **10/10 PASS sin skips**, dentro de corrida escalada sobrec220. Compras/saldo anterior/retroactiva/IVA total intacto, null/cero/negativo, repeticiones/kg/l, rollback promedio, initúnica local, compra concurrente/consumo, drain previo exitoso, aplicador fallido/timeout real y recuperación durable sin reponderar, único intento por entrada. Revisión59d sólo corrigió título del caso rollback previo; producto/aserciones idénticos.
- `stock/stock-local.neon.integration.test.ts` **5/5 PASS** y `stock/stock-concurrency.neon.integration.test.ts` **1/1 PASS** en esa corrida: tenant/local/archivado/constraints/ajustes concurrentes.
- Corrida posterior sobre59d con selectores reales `stock/stock.neon.integration.test.ts stock/stock-entries.neon.integration.test.ts stock/stock-average-rollback.neon.integration.test.ts`: **14/16 PASS, EXIT1**. Entradas **7/7 PASS** y probe nuevo **1/1 PASS**: falla segunda línea revierte compra y creación inicial de par/marcador, ledger vacío y DTO null. Stock **6/8**, dos errores de lectura API descritos abajo. Log `/private/tmp/checkpass-0228-regression-ci.log`.
- DDL aislado sobre59d `stock-average-migration-0084.neon.integration.test.ts`: **3/3 PASS, EXIT0** junto con cleanup propio1/1. Hash0084 real coincide journalCI, negocio previo simulado/alta nueva false/null/false, constraints rango/NaN/Infinity/tasa requerida/extremos0/100, seed local/NULL/cero/idempotencia/último costo y ledger íntegro. DDL transaccional rollback, contract0227 no aplicado. Log `/private/tmp/checkpass-0228-ddl-ci.log`.
- DB typecheck **PASS** sobrec9; Merchant typecheck **PASS** sobre59d. ESLint y Prettier focales **PASS**, sin kit/UI/guard cambios.

## Fallos abiertos — no QA PASS

La primera corrida dentro sandbox migró0084 e inició tests, pero Stock consumption mostró6 fallos de presupuesto/carreras y se detuvo explícitamente143 tras verificar PIDs propios. Log `/private/tmp/checkpass-0228-functional-ci.log`; **no PASS** ni teardown completo de la segunda suite interrumpida. Diagnósticos read-only CI encontraron ClientRead, sin un lock SQL bloqueante, y afuera sandbox respondió más rápido; eso no cierra la causa.

La corrida escalada `/private/tmp/checkpass-0228-functional-escalated-ci.log` terminó **EXIT1: 28/34 PASS,6FAIL,5archivos**. El selector inicial `entries.neon.integration.test.ts` era inexistente: no afirmar PASS de esa suite; la selección correcta posterior sí corrió7 casos. Cuatro rojos de consumption0227 persisten: concurrencia falla conexión bounded1000ms al conectar, carga10000 queda claimed1/applied0 al agotar20s, cut70000 falla rollback por FATAL08P01 «server conn crashed?», y slow-budget completa0 consultas del handler. Los tests/count/retry/budgets existentes no se cambiaron. Duración3076ms del slow-case es duración completa de caso; su aserción fallida fue completed0, no un fallo observado de su aserción wall.

Los otros dos rojos de esa corrida: oráculo DTO exacto antiguo omitía el nuevo campo aprobado (corregido59d, sin relajar contrato) y tenant API lectura devolvió error08P01. Después de corregir DTO, otra corrida tuvo tenantPASS pero dos lecturas distintas fallaron: lista inicial con error sin pgcode, listado archivado con08P01. No se atribuyen a entorno hipotético ni se aceptan por un retry. Requieren QA baselinec9 y comparación transport/pooler/directa en entorno exacto; hipótesis a comprobar: transaction_timeout termina backend y PgBouncer/Neonpooler devuelve08P01. No cambios runtime ni aumento de presupuestos hechos.

## Recursos y siguiente paso

Todas las sesiones DB propias terminaron y teardown final completó antes de liberar CI a B. La interrupción dejó exactamente dos mundos propios creados19:07:32/34; inventario por UUID/slug/fecha y owner modules-int, cleanup acotado ejecutado por wrapper **1/1 PASS**, sin otros mundos. Probe temporal conservado en `/private/tmp/checkpass-0228-interrupted-cleanup.test.ts` y retirado del árbol; no es parte de suite funcional entregada. Worktree limpio, sin servidor ni proceso DB propio pendiente.

Entregar para revisión/QA con estos límites; **no aceptar ni marcar implementada** todavía. B toma CI para Marca; QA reproduce baseline/transporte, recepción A/B y combinación congelada. Cualquier fix concreto vuelve al writer asignado y repite checks afectados sin PASS por skips/retries. Main local necesita autorización final owner según handoff; push/PROD no autorizados.

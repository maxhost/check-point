# Stock: investigación del fallo original y corrección del backend

Tarea `stock-cause-20261015`, base `e6baa0d088870f8abe6eba09f3f8d6fd12ac9bc8`, worktree `factory-stock-cause-20261015`. Encargo: investigar el fallo real conservando expectativas y límites originales, sin push ni operaciones de producción. No se editaron INDEX, TASKS ni archivos de estado.

## Resultado y alcance

Se reprodujo el fallo original y se capturó su error primario antes de que el rollback lo reemplazara. La corrección final cambia el backend del reintento durable. El test de costo promedio vuelve a ser exactamente el de `7531ae9d`, sin la aceptación condicional introducida en `4cb0dcc9`.

La corrección conserva el contrato 0228: intentar pendientes durante el presupuesto existente, permitir la compra si siguen pendientes y calcular con el ledger confirmado. No garantiza completar un backlog o latencia arbitrarios en dos segundos.

Fuente Stock sin sondas: `0a431c5fed2e96d887bfbe222146686f161d8ba2`. Diff de Stock contra la base: `apps/merchant/src/server/module-events/retry.ts`, restauración de `apps/merchant/src/modules/stock/stock-average.neon.integration.test.ts` y documentación de esta investigación.

## Reproducción y causa observada

1. Sobre `ec05e4f98365ef9647b74c888c8b69f2f9e02155`, se restauraron las diez pruebas originales y se añadieron sondas síncronas auditadas sin queries ni awaits adicionales dentro de la ventana crítica, manteniendo relojes, presupuestos y resultados. El test leía delivery y ledger después de la compra para el diagnóstico. Se ejecutó la carga completa mediante `tools/neon-test.sh`.
2. El caso original volvió a fallar: esperaba saldo `12.000` y promedio `2.833333`, obtuvo `15.000` y `2.666667`. La traza mostró claim confirmado, handler terminado a1.898ms y aplicación sin commit a2.123ms. La delivery quedó `processing`, un intento, y el ledger contenía solo las compras10+5.
3. Esa corrida terminó con **2 fallos/3.939 aprobados/282 omitidos** en tests y504 archivos aprobados/2 fallidos/41 omitidos. El segundo fallo, en el test original de cancelación del aplicador lento, fue `2675 < 2500` falso. Las dos evidencias se conservaron; no se amplió ningún límite. La tanda de migraciones no llegó a comenzar.
4. En `c15f58c7829057a8c173bc6ee2072fb314625ca1`, una sonda de `Client.query` observó las promesas originales y sus errores antes de que los interceptara Drizzle. El foco original volvió a fallar:1 fallido/9 omitidos por selección, EXIT1. El ACK de la delivery terminó; el **COMMIT rechazó con SQLSTATE25P04, `transaction-timeout`**. Después **ROLLBACK rechazó con08P01, `server-connection-crashed`**. Ese error secundario reemplazó el primario en el catch de la librería.

Esto confirma la causa técnica de las reproducciones: el consumo calculado no llegó a confirmarse antes del timeout transaccional. No se atribuye retrospectivamente un código de error al primer log7531, que no lo observaba. PostgreSQL documenta que [transaction_timeout termina la sesión al superar el límite de la transacción](https://www.postgresql.org/docs/17/runtime-config-client.html#GUC-TRANSACTION-TIMEOUT); el código25P04 se observó directamente, no se infirió del08P01.

La transacción revirtió el consumo y el ACK juntos. La compra registró15/2.666667 según el saldo confirmado; no se observó consumo parcial ni un error de la fórmula. El test original, sin observar si había commit, asumía siempre el resultado de consumo aplicado. La corrección anterior solo del test no había explicado esta causa.

## Corrección de producto

Cada transacción hacía dos viajes separados para configurar `transaction_timeout` y `statement_timeout`. La reproducción midió aproximadamente120ms por query; claim y aplicación gastaban cuatro viajes solo en esos SET.

El helper `setRetryTimeouts` configura ambos en un solo `SELECT` con `pg_catalog.set_config` parametrizado y `is_local=true`. Se usa en claim, aplicación y recuperación. El camino claim+aplicación elimina dos viajes de red, manteniendo el deadline absoluto y las transacciones, filtros, locks, ACK y recuperación existentes.

El límite transaccional toma el remanente del presupuesto. El límite de sentencia usa `max(1, remanente−1)` para seguir siendo positivo e inferior al transaccional cuando el remanente supera1ms; así no se desactiva al igualar ambos. El borde1ms y el clamp positivo ya existían. Se conservan los2s del presupuesto global, el batch y los límites de conexión y capacidad del pool. El orden de aplicar/confirmar consumo antes de ponderar la compra permanece igual.

El foco sobre `f9cf553807247f9bc098e18dae1e9a0c288cf0de`, manteniendo las expectativas originales, aprobó **2 casos**,18 omitidos por la selección, EXIT0,31,7s: costo promedio y cancelación del aplicador lento. La traza registró consumo confirmado a**1.924ms**, delivery aplicada, ledger10/−3/5 y saldo/costo**12.000/2.833333**. No hubo error de ACK ni COMMIT.

Observación adicional conservada: tras el commit a1.924ms, un siguiente intento de claim agotó una conexión corta antes de ejecutar su consulta a1.977ms. La compra mantiene el consumo confirmado; no se presenta esa traza como una terminación sin errores del drenaje completo. Es comportamiento fuera del commit que originaba el fallo, no garantía de vaciar cualquier cola.

## Código y verificación finales

Todas las sondas, canales, observadores y spies se retiraron antes de congelar `0a431c5f`. El test Stock average coincide byte por byte con7531, blob `b9b031453715c089d47411577835b8118c4eb2ea`; Stock consumption sigue idéntico, blob `5de93d0c6675d291cfda85a514296d834919d58d`. No se modificaron sus fixtures ni aserciones.

- ESLint de los dos archivos afectados: EXIT0.
- Typecheck de Merchant: EXIT0.
- Cuatro suites unitarias relacionadas: **39/39 aprobadas**,0 omitidas; rutas de retry, decode, lectura Stock y precio de compra.
- QA independiente estático de las sondas y del código final: PASS, con límites temporales de observación declarados. Las sondas añadían algo de CPU/microtareas, sin queries ni awaits adicionales dentro de la ventana crítica; las lecturas diagnósticas se hacían después de comprar.
- Neon completo sobre0a431c5f: **3.940 aprobados/1 fallido/282 omitidos**,505 archivos aprobados/1 fallido/41 omitidos, EXIT1,657,2s. Los10 casos originales de promedio y10 de consumo Stock pasaron, incluidos cancelación≤2500ms y lote10000 dentro20s. El único fallo fue Billing503vs200, descrito abajo.
- Migraciones aisladas sobre el mismo0a431c5f: **10 archivos/30 tests aprobados**,0 omitidos, EXIT0,116,1s. Se conservaron ambos resultados por separado; no se reetiquetó la corrida amplia como verde.

Node24.20.0 y pnpm11.4.0, mismo lockfile y configuraciones que la base. Entorno CI seleccionado `/private/tmp/checkpass-recipes-margin/0234-ci.env`, interlock anti-PROD activo, logs saneados antes de escribir. No se tocaron UI, backend de Recetas R1, esquema, migraciones ni datos de producción.

## Fallo adicional de Billing e identidad de los fixtures

La corrida0a conservó un fallo de `billing.neon.integration.test.ts`: segundo checkout del caso de prueba vencida o menor a48h devolvió503 en lugar de200. La lectura de los fixtures encontró un default global `cus_creado_por_el_checkout` tanto en ese archivo como en el alta de `billing-dead-state`. La DB tiene el índice global `core_subscription_customer_unique`.

Para probar ese mecanismo se construyó un control explícito en `c048b62494a9f1cf1835f35935584a439d034bae`: otro comercio conservaba ya ese customer al ejecutar el segundo checkout original. La aserción200, precio y reglas del trial permanecieron intactas. Una sonda antes del mapeo a503 capturó únicamente códigos/constraint, y ambas fixtures se limpiaron en `finally`.

El control falló con **23505 en core_subscription_customer_unique**, respuesta503`unavailable` y llamadas `customers.create`, `checkout.sessions.create`, `customers.create`: la segunda creación falló al persistir el customer, antes de crear su sesión. Esto demuestra la colisión del doble; el full anterior no registraba la excepción y no se afirma que ese log por sí solo pruebe retrospectivamente su causa.

La corrección cambia únicamente el default `nextCustomerId` de `fakeStripe()` por un UUID diferente para cada instancia del doble. Mantiene el ID estable dentro de la instancia y conserva overrides explícitos. El backend de Billing y sus aserciones se restauran a los originales después del control. No se acepta503 ni se modifica una respuesta para hacer pasar el test.

El mismo control sobre `9d43538a61ba1b5c4c5752827994d90632b9f28c` aprobó: **1 caso aprobado/2 omitidos por selección**, EXIT0,11,0s. Luego se retiraron el control y el logger; el test y la ruta de Billing quedaron idénticos a la base.

## Validación de cierre sin sondas

Fuente congelada `bcfabb3ffee8d409355ebe88df30cb0ed6ef7847`, con el cambio real de Stock y el aislamiento del doble Stripe. Lint y typecheck de Merchant aprobaron tras retirar las sondas de Billing. La entrega limpia conserva ese código byte por byte; solo agrega/actualiza los dos documentos de evidencia. La rama local `factory-stock-cause-20261015` conserva los commits diagnósticos para inspección; esos commits experimentales no integran la entrega.

- La fase general de `tools/neon-test.sh` aprobó **506 archivos/3.941 tests**, con **41 archivos/282 tests omitidos**. Stock average y Stock consumption aprobaron sus diez casos originales cada uno; Billing checkout aprobó sus tres casos. No se cambiaron aserciones, tiempos ni reintentos.
- La continuación DDL de esa misma ejecución falló por `getaddrinfo ENOTFOUND` hacia la API de Neon y timeouts de hooks. El wrapper completo conserva **EXIT1**: diez archivos fallidos, ocho tests fallidos y22 omitidos. No se presenta esa ejecución como verde. El registro de energía muestra suspensión por cierre de tapa a14:47:22−0500, junto al inicio de DDL, y wake posterior; hay correlación temporal, no prueba exclusiva de la causa de DNS.
- Con DNS nuevamente operativo se repitieron **solo las diez suites DDL**, sin modificar código, configuración de tests ni límites, mediante `tools/neon-test.sh ... --no-file-parallelism`. Resultado: **10 archivos/30 tests aprobados**,0 omitidos, EXIT0,118,2s. Se usó prevención de reposo por inactividad durante esta tanda y el build.
- Build de Merchant sobre el mismo SHA: **EXIT0**,24,3s. El archivo `next-env.d.ts` generado por Next se restauró después del build; no forma parte de la entrega.

La cobertura final está verificada por fases sobre la misma fuente, con la interrupción de red conservada. No se afirma un EXIT0 único del wrapper completo ni cobertura de los282 casos omitidos. La evidencia de browser y checks generales anteriores permanece en el informe histórico enlazado, con sus SHAs; no se presenta como una nueva ejecución de browser sobre este cambio de backend.

## Evidencia preservada

Directorio local `/private/tmp/checkpass-stock-cause-20261015/`:

- `results.json` y `neon-full.log`: reproducción completaec05, dos fallos conservados.
- `reproduced-observation.json`: fases y estado de la reproducción original.
- `driver-first-error-results.json`, `driver-first-error.log` y `primary-error-observation.json`: COMMIT25P04 y ROLLBACK08P01 en c15.
- `backend-fix-focal-results.json`, `backend-fix-focal.log` y `backend-fix-observation.json`: comparación focal sobref9, incluido el timeout del claim posterior al commit.
- `postfix-full-results.json` y `postfix-full.log`: validación Stock sin sondas sobre0a431c5f, con el fallo adicional de Billing preservado.
- `postfix-migrations-results.json` y `postfix-migrations.log`:30/30 DDL sobre0a431c5f.
- `billing-collision-control-results.json` y `billing-collision-control.log`: control23505 sobrec048.
- `billing-isolation-control-results.json` y `billing-isolation-control.log`: mismo control tras cambiar el default del doble.
- `final-full-results.json` y `final-full.log`: fase general3.941 aprobados y continuación DDL interrumpida por DNS, EXIT1 conservado.
- `power-signal.json`: señales observadas de suspensión y wake.
- `awake-close-results.json`, `awake-migrations.log` y `awake-close-build.log`: repetición DDL30/30 y build EXIT0 sobrebcfabb3f.

Las omisiones se informan como tales; no se cuentan como cobertura. Los focos seleccionados no se presentan como una suite completa. La integración local se acepta con QA independiente de la entrega y de la combinación. No push ni operaciones PROD.

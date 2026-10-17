# Publicación de eventos de módulos — 2026-10-16

**Operación completada: publicación ON en PROD, venta/stock/costos verificados, retry HTTP200 sin duplicados. Cierre documental local, sin push adicional.**

Operación L2, sin spec nueva. No reconstruir eventos de órdenes anteriores ni generalizar el contrato `sale.closed`.

## Candidato y alcance

- Candidato: `5b834ca0c7953d8684a1cc3e040b7dbc467dc106`.
- Main remoto al inicio: `7531ae9d2f16cfbdb4894fa101ab5e6d7f83e118`.
- SHA subido y comprobado mediante `git ls-remote`: `5b834ca0c7953d8684a1cc3e040b7dbc467dc106`; push terminado 2026-10-16 21:43:57 UTC, EXIT0.
- Main local y dev avanzaron por fast-forward al candidato tras aceptación QA; 19 commits sobre el origin/main inicial. Main local y remoto quedaron en ese SHA; dev recibió después documentos independientes y este informe, sin publicación adicional.
- Incluye `036615c0065874b2fba1369530be7d6bf2996069`, corrección del retry Stock que debe llegar a PROD antes del encendido.
- Incluye `5b834ca0`, ajuste autorizado de `tools/verify.ts`: Neon related recibe `--no-file-parallelism`, conservando todos los archivos seleccionados y los interlocks del wrapper.
- El avance documental `ac7a00cb` está incluido. No hay cambios nuevos de producto, pruebas, esquema, lockfile o configuración respecto del candidato inicial `ab4f379e`.
- Checkout principal permanece en dev; archivos ajenos sin seguimiento preservados. Worktree de release limpio, con dependencias propias y sin copiar configuración PROD.

## Autorizaciones

El owner aprobó el plan con QA acotado al fix y gates, sin bypass; comisión sin configurar es esperada. Si configura una tarifa antes de la venta, debe comprobarse ese cálculo.

El owner autorizó después la corrección mínima de tooling y su verificación: «te autorizo». Registro local de esa fase: 2026-10-16 16:45:54 UTC; la hora exacta del mensaje no está disponible en el cliente.

| Operación PROD                                           | Hora de autorización                                                                                                          | Estado                                                                                                                                                      |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Push del candidato a main                                | 2026-10-16 20:59:31 UTC / 15:59:31 America/Guayaquil (registro de recepción: «si autorizo»)                                   | Ejecutado; terminó 21:43:57 UTC, EXIT0                                                                                                                      |
| Carga de MODULE_EVENTS_ENABLED en Production             | Acción realizada personalmente por el owner; mensaje «ya cargue la variable en vercel»; hora exacta del mensaje no disponible | createdAt Vercel: 2026-10-17 00:14:57.171 UTC / 2026-10-16 19:14:57.171 America/Guayaquil; metadatos comprobados00:15:54 UTC; no ejecutada por el asistente |
| Redeploy de Production                                   | Iniciado personalmente por el owner: «listo empece el redeploy»; hora exacta del mensaje no disponible                        | createdAt Vercel: 2026-10-17 00:16:20.714 UTC / 2026-10-16 19:16:20.714 America/Guayaquil; READY observado00:20:44 UTC, mismo SHA y alias Production        |
| Una llamada posterior a la venta a la ruta de reintentos | 2026-10-17 00:42:03 UTC / 2026-10-16 19:42:03 America/Guayaquil (registro de recepción: «si autorizo»)                        | Una llamada GET,00:42:23.735–00:42:24.428 UTC; HTTP200, oktrue, cuatro contadores0                                                                          |
| Rollback, si corresponde                                 | No se requirió                                                                                                                | No ejecutado                                                                                                                                                |

Cada operación se autoriza individualmente en su momento. La autorización de tooling no autoriza PROD.

## Evidencia previa

Lectura PROD en transacción `REPEATABLE READ READ ONLY`, con `transaction_read_only=on`, a 2026-10-16 16:26:23 UTC (11:26:23 America/Guayaquil):

| Dato observado                        | Resultado |
| ------------------------------------- | --------- |
| Comercios                             | 4         |
| Comercios con Stock y Recetas activos | 2         |
| Eventos / deliveries                  | 0 / 0     |
| Filas en pos.order_payment            | 3         |
| Órdenes cerradas sin evento           | 15        |
| Migraciones aplicadas                 | 93        |
| Comercios con Rentabilidad activo     | 0         |

Hashes de las migraciones 0090/0091/0092 coinciden con el repo. No se extrapolan estos conteos a otro momento.

El bloqueo inicial de Vercel HTTP403 quedó resuelto renovando automáticamente la sesión vencida mediante `vercel whoami` de la CLI oficial60.0.1. No se modificaron variables ni despliegues al renovar la sesión.

La API de Vercel confirmó a21:47:36UTC el deployment Merchant `dpl_RuxkDpecXacKUHuCRV6MRFbN65fi` en **READY**, target `production`, SHA Git/GitHub `5b834ca0`, proyecto `prj_l6uSNCTaE6ez8GfVCwXJCu32ndt0`, alias `business.checkpass.club`. Los cuatro statuses Vercel del commit también terminaron success. Health Merchant HTTP200 a21:50:10UTC.

Metadatos Production comprobados sin mostrar valores: `CRON_SECRET`, id `WgiSxx6AJX3ncDbv`, tipo `sensitive`, targets `production`/`preview`, updatedAt `1791051198525`. `MODULE_EVENTS_ENABLED` no figura entre las variables Production; con el código desplegado queda OFF por defecto.

El owner configuró el formulario del job y ejecutó personalmente una prueba en cron-job.org. Captura aportada por el owner: respuesta del servidor fechada **2026-10-17 00:13:25 UTC / 2026-10-16 19:13:25 America/Guayaquil**, **HTTP200**, duración **2,11s**, ruta coincidente `/api/internal/module-events/retry`, caché Vercel BYPASS. Cuerpo: `{"ok":true,"claimed":0,"applied":0,"pending":0,"failed":0}`. Confirma acceso autenticado y respuesta del endpoint antes de activar publicación; no acredita todavía que el job haya quedado guardado y habilitado con su horario. La llamada posterior a la venta sigue pendiente. El asistente no operó la cuenta externa ni recibió su secreto.

Confirmación posterior del owner: «quedo habilitado pero lo conigure cada 1h no cada 30 minutois, para darle tiempo a neon de descansar». Se registra el job **habilitado cada hora**, por decisión explícita del owner, en lugar de la recomendación inicial de cada30min. La captura de prueba y esta confirmación son evidencias distintas; no se inspeccionó la cuenta externa. La recuperación de un evento pendiente puede esperar hasta la siguiente ejecución horaria; se mantiene el procesamiento inmediato al cerrar la venta. La hora exacta de este mensaje no está disponible en el cliente.

El owner comunicó después que cargó la variable y que hará personalmente el redeploy. Lectura de API Vercel **2026-10-17 00:15:54 UTC / 2026-10-16 19:15:54 America/Guayaquil**: existe `MODULE_EVENTS_ENABLED`, id `czOQegQE3qM82hfQ`, tipo `encrypted`, target exclusivo `production`, createdAt/updatedAt `1792196097171`. Se comprobaron solo clave y metadatos, sin imprimir su valor. El deployment original continúa READY con SHA exacto `5b834ca0c7953d8684a1cc3e040b7dbc467dc106`; queda pendiente comprobar el nuevo deployment y el encendido efectivo mediante la venta de prueba. El redeploy del mismo SHA no requiere nuevas migraciones y el build Merchant es `next build`.

El owner confirmó que inició el redeploy. API observada **2026-10-17 00:16:50 UTC / 2026-10-16 19:16:50 America/Guayaquil**: nuevo deployment `dpl_E4woBdcen3SBacSJeiDYFcUH3jpC`, proyecto `check-point-merchant`, target `production`, acción `redeploy`, estado **BUILDING**, SHA exacto `5b834ca0c7953d8684a1cc3e040b7dbc467dc106`. El deployment anterior seguía READY. Pendiente confirmar READY del nuevo y alias efectivo.

Nueva lectura de Vercel **2026-10-17 00:20:44 UTC / 2026-10-16 19:20:44 America/Guayaquil**: `dpl_E4woBdcen3SBacSJeiDYFcUH3jpC` **READY**, target `production`, SHA Git y GitHub exacto `5b834ca0c7953d8684a1cc3e040b7dbc467dc106`, alias `business.checkpass.club`. Health Merchant a **00:21:03 UTC**: **HTTP200**, `{"service":"merchant","status":"ok"}`. No se ejecutó otra operación PROD por parte del asistente. La venta de prueba verificará publicación y efectos efectivos del flag.

Lectura PROD posterior al redeploy, **2026-10-17 00:22:26 UTC**, identidad verificada y transacción `REPEATABLE READ READ ONLY` con `transaction_read_only=on`: aún sin eventos ni deliveries. Esta ausencia antes de recibir la venta de prueba no certifica ni refuta el encendido.

Nueva transacción PROD READ ONLY a21:49:22UTC: eventos0, deliveries0, órdenes cerradas15, pagos3 y revisiones de comisión0; Rentabilidad sigue apagado en los cuatro comercios. Se identificaron composiciones publicadas con todos los costos locales conocidos para elegir una venta verificable, sin modificar catálogo ni recetas.

## Verificación local y QA

Node24.20.0, pnpm11.4.0. Configuración CI seleccionada: `/private/tmp/checkpass-recipes-margin/0234-ci.env`, SHA256 `95376e14e84df68576d6f93ef07bdf449454b419b201f5956c15f1877e45a938`. Suites DB exclusivamente mediante `tools/neon-test.sh`, con recurso CI reservado y sin workflows GitHub activos al comenzar.

1. Sobre `ab4f379e`, tipos, lint, guardia, formato, unitarios y builds aprobaron. Resumen unit observado: 304 archivos aprobados/253 omitidos; 2906 casos aprobados/1310 omitidos. Browser: 440 aprobados/21 omitidos, cero reintentos. Las omisiones no son cobertura.
2. Ese `pnpm verify` terminó EXIT1: related incluyó DDL en paralelo y mostró tres fallos de Stock0082. Se interrumpió mediante SIGINT; no se certificó su teardown ni la causa primaria de cada aserción. El resultado rojo se conserva.
3. Corrección de tooling `5b834ca0`: lint/formato, 40/40 tests del runner, check-numbers y diff-check aprobaron. QA independiente estático PASS; sin mutaciones ni pruebas adicionales del revisor.
4. Sobre `5b834ca0`, el wrapper related serializado terminó normalmente con **109/109 archivos y 835/835 casos aprobados, EXIT0**, sin omisiones ni reintentos; 2374,03s. Incluye Stock consumo10, promedio10 y Stock0082 con sus ocho casos originales, incluidos los tres antes fallidos.
5. QA independiente aceptó tooling y combinación por identidad de fuentes para main local. Apps, packages, tests, lockfile y configuración permanecen idénticos a `ab4f379e`; el documento nuevo y el runner tienen comprobaciones propias.

6. El pre-push autorizado ejecutó check-numbers y **`pnpm verify` íntegro EXIT0**, sin bypass. Tipos6/6 y builds4/4 reutilizaron caché; lint8,8s, guardia0,6s, formato10,4s, unit54,8s (2906 aprobados/1310 omitidos), browser122,4s (440 aprobados/21 omitidos, cero reintentos), Neon related2373,4s (109 archivos/835 casos aprobados, sin omisiones ni reintentos). Consumer related omitido porque no hay cambios de servidor Consumer. Se conserva por separado el EXIT1 inicial.

Logs saneados y metadatos locales: `/private/tmp/checkpass-release-module-events-20261016/`, incluidos `gates.log`, `gates-result.json`, `tooling-phase.json` y `serial-related/gates.log`, `gates-result.json`, `selection.json`.

## Verificación de venta en PROD

### Venta de prueba seleccionada — antes del cobro

El owner eligió el comercio `5fcaebc2-82f2-4b8c-ba5c-27a44c802c40`. Lectura `REPEATABLE READ READ ONLY` a **2026-10-17 00:38:14 UTC / 2026-10-16 19:38:14 America/Guayaquil**, `transaction_read_only=on`: orden `dc07d3c5-829b-4bb1-8ffc-ec3e81c3d5b8`, estado `open`, versión2; local `11560a0c-e7db-4909-b19c-968ef2ada93c`; línea `339e77d5-ed0c-41a1-b046-7fe6cb20c5cf`; producto `48659125-a8d4-4703-af06-575e4a3911b0`, cantidad1, precio snapshot `4.00`. La composición publicada coincide con resolución `15e22b37-626c-4e0c-9fd2-74b2d56c7891`, revisión de composición `bf64d4f7-123f-4307-b2f4-20d5ea54229f`, receta `fd0063fd-2a77-46af-be3d-10dac87ffcf5`, revisión `e37f4524-18ac-4451-a437-8aa84f2e47d9`, cantidad de receta1.000. Stock y Recetas activos, revisiones de comisión0 y eventos globales0 en esta lectura. La moneda del comercio observada previamente es `ARS`; no se presupone USD.

| Insumo (ID)                            | Cantidad por receta | Saldo previo local | Costo unitario local efectivo previo |
| -------------------------------------- | ------------------- | ------------------ | ------------------------------------ |
| `8ad64b3a-3bd5-4d86-a951-4d76341c6b64` | 3.000 unit          | 30.000             | 0.175000                             |
| `cea7a845-2376-456c-b1a3-7de38730595c` | 5.000 g             | 25000.000          | 0.000220                             |
| `d6865378-0c43-4959-9fe8-106b12de9edf` | 30.000 g            | 1000.000           | 0.005000                             |

La evidencia previa se guarda con IDs y sin datos personales; se compara con la lectura posterior que sigue.

### Resultado posterior al cobro

El owner confirmó «listo cobrado». Cierre persistido a **2026-10-17 00:39:10.731 UTC / 2026-10-16 19:39:10.731 America/Guayaquil**. Lectura PROD `REPEATABLE READ READ ONLY` a **00:39:54.235 UTC**, con identidad verificada y `transaction_read_only=on`:

- Orden `dc07d3c5-829b-4bb1-8ffc-ec3e81c3d5b8`, comercio/local/línea/producto idénticos al baseline, estado **closed**.
- Evento `ad308b1c-a753-4aea-9b58-9e353703efb4`, tipo **sale.closed**, **event_version=2**, source_id de esa orden, local `11560a0c-e7db-4909-b19c-968ef2ada93c`; snapshot monetario **ARS4.00**, minorUnit2, un pago. Creado a00:39:10.593 UTC.
- Pago `b8cdd63e-dfdb-41d9-b5e9-5e7cb2637e2a`, medio `41aa1364-e75e-4884-aebe-805d7cfae819`, proveedor `pos`, forma `none`, importe4.00.

| Delivery ID                            | Suscriptor    | Estado      | Intentos | Diagnóstico / razón terminal | Aplicación       |
| -------------------------------------- | ------------- | ----------- | -------- | ---------------------------- | ---------------- |
| `9362d8ff-a9b5-48a0-ab55-e249ff1964bc` | recipes       | **applied** | 1        | null / null                  | 00:39:11.289 UTC |
| `b6eccbd6-ad1a-4789-8bff-91e682fc882a` | profitability | **skipped** | 0        | null / modules_disabled      | null             |

No se afirma que todos los deliveries estén aplicados: Rentabilidad estaba apagado. Comisión: **«sin configurar»**, resultado esperado por el owner, con0 revisiones y0 filas de resultado de esta venta; no se sustituye esa ausencia por comisión0 ni se afirma cálculo ejecutado.

| Insumo ID                              | Movimiento ID                          | Consumo | Saldo antes → después | Costo unitario congelado |
| -------------------------------------- | -------------------------------------- | ------- | --------------------- | ------------------------ |
| `8ad64b3a-3bd5-4d86-a951-4d76341c6b64` | `2923e06b-2df5-475a-b7cb-3420f4d66e82` | -3.000  | 30.000 → 27.000       | 0.175000                 |
| `cea7a845-2376-456c-b1a3-7de38730595c` | `64c20114-cd53-4809-9373-842b53c7a063` | -5.000  | 25000.000 → 24995.000 | 0.000220                 |
| `d6865378-0c43-4959-9fe8-106b12de9edf` | `277880c5-9481-41ee-80b3-62e1e6777d8e` | -30.000 | 1000.000 → 970.000    | 0.005000                 |

Tres movimientos `kind=consumption`, ligados a la misma orden/línea/producto/local; `total_cost=null` conforme al contrato del movimiento. Los tres guardan `consumption_loss_factor=1.000000`, moneda **ARS**, minorUnits2 y costo unitario conocido coincidente con el local previo. Suma SQL numeric exacta de `-quantity × consumption_unit_cost × consumption_loss_factor`: **0.676100000000000 ARS**, sin costos desconocidos ni lectura de costos actuales para revalorar la venta.

Tres filas `recipes.consumption_source`:

| ID de procedencia                      | Insumo ID                              | Cantidad exacta | Asignada |
| -------------------------------------- | -------------------------------------- | --------------- | -------- |
| `c3618309-45fd-4881-b5e4-d5af89b3487f` | `8ad64b3a-3bd5-4d86-a951-4d76341c6b64` | 3.000000        | 3.000    |
| `208542f9-22b8-4a0a-8748-f457b9deda91` | `cea7a845-2376-456c-b1a3-7de38730595c` | 5.000000        | 5.000    |
| `768a4d31-6206-46c8-99b5-b1dd9dcf8b5b` | `d6865378-0c43-4959-9fe8-106b12de9edf` | 30.000000       | 30.000   |

Todas conservan event_id `ad308b1c-a753-4aea-9b58-9e353703efb4`, orden/línea/local/producto seleccionados, resolución/revisión de composición y receta/revisión documentadas antes del cobro, con recipe_quantity1.000. Cantidades exactas y asignadas coinciden con la receta y los movimientos. La publicación efectiva **ON** queda comprobada por el evento nuevo y su aplicación; sin reconstrucción de órdenes anteriores.

Evidencia saneada local: `test-sale-before-f5.json` y `test-sale-after-f5.json`, en el directorio operativo indicado arriba. La consulta inicial de la orden pidió `settlement.collectedTotal`, que no es la clave del contrato y por eso devolvió null; no se interpreta como dato faltante. La lectura de cierre comprobó la clave vigente `settlement.collected=4.00`, monedaARS, coincidente con el evento y el pago.

### Reintento autorizado y lectura posterior

Autorización del owner «si autorizo», registrada a **2026-10-17 00:42:03 UTC / 2026-10-16 19:42:03 America/Guayaquil**, exclusivamente para una llamada a `GET https://business.checkpass.club/api/internal/module-events/retry`. Se ejecutó **una sola llamada** entre **00:42:23.735 y00:42:24.428 UTC**, sin redirects ni reintentos, usando CRON_SECRET en memoria y sin exponerlo. Respuesta **HTTP200** y ruta coincidente: `{"ok":true,"claimed":0,"applied":0,"pending":0,"failed":0}`.

Lectura PROD posterior **00:42:53.927 UTC**, identidad verificada, `REPEATABLE READ READ ONLY`, `transaction_read_only=on`:

- Orden cerrada, `settlement.collected=4.00`, monedaARS; **un evento**, **tres movimientos** y **tres filas de procedencia**, con los mismos IDs.
- Comparación exacta anterior/posterior de eventos, deliveries, movimientos completos seleccionados (incluidos snapshots de costo), procedencias, pagos, comisiones, saldos y valoración: **8/8 conjuntos idénticos**.
- No se duplicó consumo ni se revaloró costo: saldos27.000/24995.000/970.000 y costo exacto0.676100000000000ARS inalterados.
- Estado global de deliveries: recipes/applied1 y profitability/skipped1; **sin pending ni processing** en esta lectura.

La comprobación operacional de comparación terminó EXIT0, sin mutaciones, tests contra PROD ni llamadas adicionales. Evidencias: `authorized-retry-result.json`, `after-authorized-retry-readonly.json`, `production-authorizations.jsonl`.

Lectura final de Vercel **00:43:14 UTC**: deployment `dpl_E4woBdcen3SBacSJeiDYFcUH3jpC` sigue READY, targetproduction, SHA exacto `5b834ca0c7953d8684a1cc3e040b7dbc467dc106`; la consulta directa del alias `business.checkpass.club` apunta a ese deployment. `MODULE_EVENTS_ENABLED` sigue presente exclusivamente en Production, sin cambios de metadatos; `CRON_SECRET` presente. Solo claves/metadatos, sin imprimir valores.

### Resultado de la operación

- Job externo confirmado por el owner: `GET https://business.checkpass.club/api/internal/module-events/retry`, header Authorization con CRON_SECRET, habilitado cada hora por decisión del owner; zona horaria indicada America/Guayaquil. Prueba HTTP200/ok documentada arriba. No se opera su cuenta de cron-job.org.
- Variable y redeploy realizados personalmente por el owner; metadatos, SHA, READY, alias Production, health y encendido efectivo comprobados.
- Venta, evento v2, delivery Recetas aplicado, consumo, trazabilidad y snapshots de costo: comprobados arriba por SQL de solo lectura.
- Comisión: «sin configurar», sin cálculo ejecutado ni cero inventado; estado real `skipped/modules_disabled` documentado arriba.
- Una llamada autorizada al retry global: HTTP200, oktrue, claimed/applied/pending/failed0; lectura posterior sin duplicados.
- No se requirió rollback. No se reconstruyeron órdenes anteriores, no se activaron módulos ni se cambiaron recetas, costos, permisos o esquema PROD. El cron queda horario por decisión explícita del owner.

## Cierre

SHA subido, deployment, venta y resultado SQL comprobados arriba. Estado final del flag: **ON efectivo comprobado por venta nueva/evento v2 y consumo aplicado; variable Production cargada por el owner y redeploy READY**. El asistente no modificó variables. Reintento posterior aprobado y sin duplicados. Este informe se entrega por commit local en dev, sin push adicional; código PROD permanece en5b834ca0.

QA independiente del cierre documental: **PASS**, cotejo de este informe con las evidencias JSON de Vercel, venta y retry; sin nuevas consultas DB/HTTP, suites, mutaciones ni ediciones del revisor. Formato del informe comprobado explícitamente con `prettier --ignore-path /dev/null` para evitar un PASS por documentos ignorados. `node tools/check-numbers.ts`: EXIT0, sin números duplicados. La revisión acepta la evidencia operacional observada; no atribuye ejecución a las pruebas futuras de la spec0235 paralela.

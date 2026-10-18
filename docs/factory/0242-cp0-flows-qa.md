# 0242 — QA independiente M0 guardar/QR/cobro

## Revisión de preparación

QA nuevo, limitado a esta entrega. Worktree QA limpio en `1f40112e06f2d4652d731d3eb2b97e3cf30130ef`; lectura por blobs del candidato `1bebe5d0f34c5218136df2e92cc3cb50f67e5374`, cinco archivos del harness/fixtures/freeze/handoff. Sin implementación de producto, DB, servidores, cambios de refs o repetición de LISTA. La evidencia anterior de LISTA conserva su aceptación y sus límites propios.

**PASS condicional de preparación para setup/smokes protegidos; campaña y entrega aún no certificadas.** La receta implementa tres smokes owner independientes y dieciocho casos owner/staff×sin cupón/10%/100%×tres. El manifiesto exclusivo asigna identidades antes de escrituras; la orden v1 obtiene ID canónico real y lo persiste antes del cierre. Setup/inspección/cleanup conservan wrapperCI y ownership; cleanup corta enlace POS→ledger y respeta orden de dependencias de marketing/ledger/membresías. No se ejecutó teardown ni se certifica su ejecución por esta lectura.

Freeze incluye hash del manifiesto mutante, archivo control y runner; distingue buildSource `6f8e1e9cecdd33930c5f055db43641d805dbe3c2`/BUILD_ID `VLV2fFFeM_dUWKnxvv7iY` del source nuevo. La excepción de reutilización se limita a tres archivos de fixtures Vitest; el diff real de apps/packages cambia únicamente los dos helpers/suite asignados, sin cambio de producto compilado. Runtime/freeze efectivo y evidencias RAW siguen pendientes.

Hallazgos comunicados antes de campaña: `saveConfirmedMs` termina antes de verificar etiqueta y no exige total visible; `paymentReadyMs` exige botón habilitado pero no importe visible exacto. Incluir los datos reales dentro del fin de cada marcador. Neto0 debe comprobar array de pagos explícito, además de longitud cero. Se pidió también vincular ID de respuesta close con create. El autor corrige y congela nueva fuente antes de campaña; los dieciocho recorridos, efectos durables/delivery, trazas/COMMIT y combinación requieren revisión posterior. Ausencia de fase no representa 0ms; schedule afterGrant no certifica entrega.

**PASS final de preparación pre-run en `7c4a7d5d2f99f5c545c24199b29846ec7ac0295c`.** El delta corrige los cuatro puntos: guardar comprueba etiqueta y total16 antes de terminar marcador; preparar comprueba importe exacto16/14,40/0 y botón habilitado; observa pagos como array; vincula ID close/create. La inspección añade outbox wallet/cross decisions y exige una orden ledger por membresía independiente. Freeze `--flows` preserva el uso previo de listado, exige manifest/archive mutante y compara diff completo apps/packages desde buildSource: solo cambian dos archivos de fixture de la allowlist exacta de tres. Revisión de fuente, sin ejecutar setup/DB. Permite la secuencia protegida setup→freeze→tres smokes→inspección→dieciocho campaña→inspección; no certifica todavía resultados ni CP0 global.

## Smokes y correcciones conservadas

Smoke01 sobre7c4a conserva un intento inválido en catálogo, completed/valid false, exactamente cuatroGET y cero POST/PUT/cierre/IDorden (RAW SHA256 `c43f42d08d3531bff8a2f78b3916b7fb68a7086951fb270c4f900500a91e4cb4`). El botón móvil montaba antes del listado real; corrección `5c81dadebd4fac5cc03fd7637a3f5c589f6ec269` espera filaM0 y acciónAbrir habilitada antes de reloj/click. Salidas y tags incluyen run independiente. Identidad smoke sin efectos se reutilizó, sin ocupar ninguna identidad campaña. QA revisó delta y RAW, sin navegador adicional.

Smoke02 fuente5c81: tres casos owner sin/10%/100% válidos (RAW `2480e48443d8ca586209976bf2751d3e3fcd57801e515ac509068f4693e581a8`). Una solicitud cierre por caso, UUID y cuerpo hash observados, misma orden create/close, arrays de pagos1/1/0, respuestas canónicas correctas. Su freeze archivado SHA256 `25ce284aec048cfa7166e374a7b667de8df926930b9e3068ee48cf0e4ebfc5a3` coincide con RAW y sus268hashes coinciden con blobs Git5c81.

Inspección smoke02 inicial falló por serialización JSONB de numeric como number14.4 frente a string14.40; snapshot `e1cf63e971f0d2dc963a11cdcf3807028289d4302cb7593e843bb0dd8fa2a5b3` conservado. Corrección `29b716cb2682a01ab8970c9a9af4ee19f03769a1` cambia exclusivamente netoSQL a `o.total::text` y documenta fallo; no relaja igualdad ni repite UI/efectos. Reinspección protegida de los mismos tres IDs produce netos exactos14.40/16.00/0.00 y una orden ledger por membresía. Delivery observado: analytics applied, recipes skipped por modules_disabled; wallet suppressed y cross no_origin. No se declara entrega push exitosa.

Freeze29b SHA256 `d2649514130f2a2afd60ff58e7dd78b165da6900e7f4f5b448f872157bd19119`:268/268hashes Git correctos; config, lock, manifest mutante, schema y archivo control coinciden. BuildSource/BUILD_ID original conservados. Campaña18 pendiente de finalizar y auditar.

## Auditoría independiente de ejecución

Campaña fuente `29b716cb2682a01ab8970c9a9af4ee19f03769a1`, RAW SHA256 `530a4c60ac03df7cd5407726cfd0ce327fa7ca784fc2a06ef80c39fe84237d86`: **18/18 válidas**, seis celdas owner/staff×sin/10%/100% con tres intentos por celda; dieciocho IDs de orden distintos y conjunto exacto del manifiesto. QA recalculó datos desde RAW: respuestas create/QR/close canónicas, mismos IDs create/close, un cierre por confirmación con UUID esperada/hash de cuerpo, membresía/cupón correctos y pagos array1/1/0. Neto0 no consulta medios. Marcadores UI ejercen datos reales/acciones autorizadas. Waterfall/TTFB/bytes/long tasks están presentes; cámara sintética no mide captura física.

| Rol | QR/cupón | Guardar mediana ms | QR mediana ms | Preparar mediana ms | CloseConfirmed mediana ms | SQL por intento |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Owner | Sin | 1892,3 | 2362,5 | 1864,3 | 3408,0 | 146 |
| Owner | 10% | 1897,6 | 2371,2 | 1890,3 | 4479,3 | 172 |
| Owner | 100%/neto0 | 1889,0 | 2382,7 | 1389,2 | 4494,0 | 164 |
| Staff | Sin | 1905,5 | 2398,0 | 1874,5 | 3442,8 | 142 |
| Staff | 10% | 1905,8 | 2384,5 | 1892,5 | 4504,0 | 168 |
| Staff | 100%/neto0 | 1900,1 | 2398,3 | 1381,7 | 4468,3 | 160 |

Son medianas descriptivas de tres, sin precisión inferencial de p95, mejora, SLA o equivalencia A/B. No se suman para fabricar un recorrido. Historial crece sin reset; fixtures y programa son sintéticos. Peso no existe en control.

Correlación por dieciocho tags: **2856sql-start/2856sql-end, cero erroresSQL**,108BEGIN/108COMMIT; dieciocho solicitudes close completas200 con cinco transacciones cada una y dieciocho create con una. Guard156pares, scheduleafterGrant18pares y module-events-aftercommit18pares. No aparece phase transaction: la ventana observable es primerBEGIN hasta fin del primerCOMMIT del RIDclose, separada del tiempo de driverCOMMIT; no se presenta CPU PostgreSQL ni duración exclusiva de función. Medianas driverCOMMIT primario por celda108,5–112,5ms, frente a closeConfirmed3408–4504ms; schedule0,43–0,97ms no equivale a entrega wallet/cross. Callback module-events observado~3061–4725ms de mediana por celda, distinto de adopción UI del cerrado y de otros trabajos aftercommit.

Request669start/651end: las dieciocho sin finish son GETlistado de refresco posteriores al cierre. Sus144SQL y dieciocho guards sí terminan; el contexto browser se cierra tras closeConfirmed/observadoresJSON. No se observó evento de cancelación explícito y no se infiere status200, finish ni bytes0 para ese tail. Los dieciocho GETlistado iniciales y los dieciocho close sí completan. Esta laguna se conserva; no invalida la señal UI/cierre durable ni justifica repetir18por ceremonia. M1 debe fijar observación del tail fuera del temporizador antes de cerrar cada contexto en ambas fuentes.

Snapshot durable final SHA256 `ad9b95880e40c6dab2244184e26d32f07ad9c6094b41fca91dab33061e3cebbf`:21órdenes cerradas distintas, tres smokes más dieciocho campaña. QA contrastó individualmente los dieciocho IDs/UUID con RAW y manifiesto: netos16/14,40/0; puntos/saldo16/14/0; consumidor/membresía propios, una orden ledger, un evento y cupones/pagos únicos esperados. Todos21 muestran analytics applied, recipes skipped/modules_disabled, wallet suppressed y cross no_origin. No demuestra receta/stock activo, envío push o selección cross con origen. No se exige éxito externo para reconocer un cierre confirmado. Traza auditada SHA256 `2229711d41791bb1b7514685548cbd0de0b3f2db564d4277b788f6d412b58702`.

## Dictamen de entrega

**PASS acotado para `8dca14ee90b1b9dd53c70c59c860481b4d263a41`.** Fuente medida29b y smoke5c permanecen inmutables; delta final solo añade analizador, resumen saneado y handoff. QA reprodujo exactamente el resumen versionado desde archivos privados mediante ejecución del analizador con escrituras sustituidas por comparación en memoria: SHA256 `e32cbff242cd2627dd57b8a3414b9ee2be98b548ac74ea447d73e8b607ca6bcb`. Los trece hashes de artefactos coinciden. Logs protegidos de setup, reinspecciónsmoke02b e inspeccióncampaña01 contienen un testPASS/0skip cada uno; el primer inspectorFAIL sigue archivado. Se reutilizan tipos/lint focales compatibles del autor, sin verifyglobal, rebuild o DB/navegación extra de QA.

Esta aceptación certifica la receta/evidencia descriptiva M0 de los dieciocho flujos con los límites anteriores. No certifica productoV2, scope/cookies nuevos, peso, replay/carreras/errores de cierre, recetas/stock activos, todos los subscribers, push/cross externos, hostingPROD o mejora/no regresiónM1. No autoriza push/PROD, mainlocal, teardown ni retirarWT. El cierreCP0 y la integración corresponden al coordinador después de QA de combinación sobre candidato congelado.

## QA de combinación y salida CP0

**PASS de combinación sobre candidato congelado `a5cbd20c6da01346bbfa2fb4fc39596bf116d28c`.** Coordinador preparó y actualizó el WT QA; HEAD exacto y limpio antes de comprobar. Se verificó ancestry de contratosA `329c7917`, LISTA `c379c9a8` y flujos `8dca14ee`. Suite/helpers/freeze/runner/resumen/preload coinciden exactamente con entrega8dca; los helpers siguen importados solo desde suiteVitest y login(typeManifest), sin adopción por producto. La combinación incluye además contratos puros de medidas, sin writerV2 activo; no se atribuye el build6f a este SHA combinado ni se usa su diff ampliado para simular una medición nueva.

Node24.20.0, sin DB, navegador, servidores ni nuevas ventas:

- `pnpm --filter @mi-pasaporte/merchant typecheck`: EXIT0.
- Desde `apps/merchant`, `pnpm exec vitest run --config vitest.config.ts src/modules/pos/measure-contract.test.ts src/server/financial.test.ts`: EXIT0,53/53PASS (43medidas+10financial),2archivos,0skip/retry.
- `node --test tools/pos-measurement/instrumentation.test.mjs`: EXIT0,2/2PASS,0skip/cancel/fail. Comprueba fase inerte/conservación de resultado/error y rechazo CI inválida bajo NODE_ENVproduction antes de aplicación, sin secreto centinela. Warning MODULE_TYPELESS_PACKAGE_JSON existente, sin cambios para ocultarlo.
- Diffcheck limpio; informe propio pasa Prettier. No ampliación de tests tras esos resultados ni verifyglobal.

**PASS de salida CP0 acotada:** contratosA329c7917/QA7fc88bad, LISTAc379c9a8/QA80b32497, flujos8dca14ee y combinacióna5cbd20c cubren contratos puros y M0 descriptivo acordados. Puede prepararse CP1 dentro de su nueva reserva. Este cierre no certifica V2 operativo, M1/mejora/no regresión, dinero/auth nuevos, peso, stock activo ni PROD; conserva todas las lagunas y fallos declarados. QA termina este bloque aquí; el siguiente checkpoint recibe QA con contexto nuevo. Coordinador conserva integración/estado/recursos y autor informa procesos detenidos/fixtures intactas, sin cleanup por QA.

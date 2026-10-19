# 0242 D1 — observabilidad previa a otra campaña, sin inferencia

La campañaR1.2 en1fd427d2 congeló receta6bb4f051…a419 y freeze1617de3c…6436.
Setup44.3s, inspect38.0s, login39.6s: cada operación1PASS/0skips. Build directo
Node/Next EXIT0, candidato1fd/BUILD_IDmQAEivzHwhRenkWFyULLz. Prepare/ejecución
metadata coinciden4b03…6f7c, changedKeys[]; identidad final estricta pasó.

Única entrada: warmupCONTROL, primer bloqueowner. APIlist200/válida,12labels,
listUsable3776ms,0pageErrors y settlementfinish, pero functionalValidfalse:
25Fetch RSC /backoffice* con canceledtrue, response200 observada, encodednull y
decodedparcial. FinCDP1859–2096ms trasDocument, antes del marcador3776ms; no lo
causó context.close. Initiators llegan a fetch de Next y son compatibles con
prefetch; al faltar flags/errorText NO se atribuye causa definitiva. CERO muestras
medidas, candidato no observado, NO M1PASS. Reporte privado list-results.jsonSHA
`f6fc1b53819f6aa5954dd14bcb990a7bdb37718b208f7f82a59d180f4ff9dff6`;
server-traceSHAe6029d6d018044321b598515779f392105f2aae7417e5def3ef0b936e2a59756.

Cleanup MISMO1fd antes de editar:1PASS/0skips8.71s,14conteos0/phasecleaned,
43242sinlistener; cleanup.jsonSHA
`2d3095a9926db4520b45c81eaf53a2aff4cfcaf557e84502328405ed3c44f9aa`.
Identity-after-stop.json preserva identidad válida y runtimeDeltas[] antescleanup.
Basales schema0f582307…ccd0 y fixture1fb057bb…6532 se conservaron wx0600;
no postinspect ni reescritura. DB devuelta por factory a regresión, sin nuevos
servidores/fixtures/datos mientras se prepara este delta offline.

D1 propuesto y autorizado offline por coordinador: exactamente2primeras entradas
OWNER normal control→candidato, sin warmups/reloads ni muestras inferenciales.
Receta D1 exacta añadida ANTESdatos. Se agregan flags permitidos booleanos,
CDPcanceled/errorText/blockedReason/wallTime y fases de lifecycle; no cookies,
queries/scope/QR ni capturas. Gates normales NO se relajan; ceroGETcandidate sigue
obligatorio. ObsComplete no equivalePASS y puede salir2 con gate estrictofalse.
Reuso candidato1fd/mQAE sólo COPY privada nueva, compiladosidénticos a freeze1617,
producto/instrumentación/lockdiff vacío, dependencias/configestrictas y fuente1fd
separada del runner nuevo; runtime original nunca se inicia ni modifica.

Se pide revalidaciónQA del delta y autorización técnica nueva ANTES de D1. No se
reutiliza3776 como muestra ni se transforma FAIL previo enPASS. Trece tests offline,
0skips, incluyen allowlist sin secretos y exactamente2entradas noinferenciales.
La revisión de e7e9192e detectó que ExtraInfo temprano podía perder flags.
Se corrige con buffer de booleanos por requestId y correlación local saneada;
prueba ambos órdenes CDP, snapshots independientes y ausencia de headers crudos.
No se ejecutó prepare ni diagnóstico sobre ese candidato rechazado.
Sólo paths asignados m1.mjs/m1-browser.mjs/m1-analysis.test.mjs/receta/handoff.

---

# 0242 M1R1.2 — fallo de identidad previo a muestras y corrección offline

Sobre runner3c07ff93 y namespace `/private/tmp/checkpass-pos-0242/m1-r1-3c07ff93`:
setup1PASS/0skips43.9s; inspectinicial1PASS/0skips31.8s; login realOTP/PIN
1PASS/0skips44.7s. Build propio webpackproduction EXIT0, BUILD_ID
`jkkbjmrA74A1y1VG_oJTw`, buildSource3c07. Control6f/BUILD_IDoriginal intacto.
Freeze SHA256 `8107325fa1bfe863d3fce83f52428d17e8fb00c0aceb8705271b056db5973afa`,
recipeSHA `45a112985ed98c70910e3649c63fec5a69493f0bdba84c340483f1d9cf5ffc75`;
2274sourcehashes,814control/822candidatocompilados,6cookies proveedor.

Primer intento de launcher setup omitió namespace y no llegó a DB; logargvfail
privado preservado antes de corregir argumentos. La única llamada measure3c07
falló por Dependency metadata drift ANTES de importar/lanzar Chromium, servidor,
warmup o muestra. No existe list-results.json; measure.log se conserva. CERO
observaciones temporales, noM1PASS ni conclusión de producto. No se repite ni
sustituye muestra alguna. No hubo servidor propio que detener;43242sinlistener.

Plan tenía `.modules.yaml` SHA aed8958f6e21343c52ee5d09df070ae41728ade96e17ee724e97d5f7a81cd8a6,
observado previo a medida 1d3474e311314209e7d753904ae414d3944baa96e6298eedd92aea47ff20740f.
Lockfuente se conservó `4cfe18864f12af4fe3b0cd84ab477e936ecd52d96847579cc087e6e13b020821`.
Se copió metadataobservado0600: JSON con prunedAt de build, storeDir de candidate
scratch y virtualStoreDir pasando por su symlink a node_modules del WT. El plan
NO guardó bytes iniciales de metadata: no hay diff histórico atribuible, sólo
hashes y contenido observado. Tras cleanup wrapperROOT volvió a cambiar metadata
(hash4b03b10eeeb55917de02ec9395969a3d67a0d6f835c6c8a9e865b278aeb46f7c).
No se atribuye a cambio de paquetes ni se usa para rebajar identidad.

Antes de cualquier edición se hizo cleanup MISMO3c07:1PASS/0skips9.05s,14tablas
propias con SELECT/assert0 y phasecleaned; cleanup.jsonSHA256
`1308b8f17025ac00c0dd7ec0969281d46638cdf63d0871b69beec0f8f31f9604`.
DBtransferida por coordinador de vuelta a regresión; sinDB/build/freeze nuevos
hasta otra asignación. Nunca tocar3201/PID927/túnel/M0/tenants ajenos.

Basales wx0600 conservadas ANTESfreeze, sin postinspect que las sobrescriba:
schema-preflight.baseline.jsonSHA25969cbc24fdb0485fe2d188f816121c1f18b56684928348517fb64abd946879;
fixture.baseline.jsonSHA c4a27aa4cbb9d78a946241bcce9d29e262d837b3ba7f8615033cedb5ee035237.
El archivo fixture.json posterior sólo cambia al estado cleaned; la copia basal
retiene el hash original. Recursos/auth/config/cookies/logs/freeze anteriores
permanecen privados. Setup/inspect/login/build/freeze PASS no son PASSM1.

Delta offline R1.2: copia metadataPREPARE sólo provenance y metadataEJECUCIÓN en
freezeFINAL después de wrapper/build, con hashes y changedKeys de copias reales.
Verificación exacta de ese snapshotfinal durante campaña, nunca contra timestamp
prebuild. Identidad de Node/binpnpm/packageJSON/versiones/realpaths/lockfuente y
installedlock estricta en prepare/freeze/ejecución. Build directo Node/Next evita
que pnpmexec en scratch reconfigure metadatos compartidos. Se añade test negativo
significativo de baselinefinal, cambio durante campaña y drift de dependencias.
No cambia tamaño/orden/estimadores ni marcadores. Total once pruebas offline,
ceroskips; corrección y nueva receta pendientes de QA antes de otros datos.

---

# 0242 P6B — preparación offline M1R1

Prepare offline ee97e93d EXIT0 en namespace
`/private/tmp/checkpass-pos-0242/m1-r1-ee97e93d`, planSHA256
`96874b79235c52a3c05e95ed75b90405b7f4a81bbdc1f38b9b18c6d020d5edb3`.
Control6f/BUILD_IDoriginal/hash54cbc…ec5fe verificados;815archivos.next. Candidato
sólofuente ee97, SIN.next. Archivo fuentecontrol104980480bytes y candidato
111216640bytes, ambos0600. Auditoría7695archivos/1399dirs,14symlinksdeps,
0modos incorrectos; namespace0700/plan0600, archivehistórico conserva0644.
NoDB/build/servidor/fixture/medición. El plan viejo se conserva; siguiente fuente
requiere namespace nuevo y aprobaciónQA del delta antes de datos.

Política freeze siguiente, explicada al coordinador ANTESdatos y acotada por QA:
sólo cache/fetch-cache/**, cache/images/** y trace bajo.next son runtime mutables, con
hashes inicial/final y deltas por intento. Ningún otro cache/webpack/tsbuildinfo,
ISRserver, manifest/server/static/BUILD_ID se excluye. Un cambio compilado aborta;
control también debe igualar mapa compilado archivado inicial. Test significativo
modifica archivos temporales propios: cachepermitido queda observado, cambios
server/manifest/BUILD_ID/webpack/trace-build/cache desconocido se rechazan.

Segunda preparación e58f41b6 falló por ENOBUFS de gitarchive >100MB antes de
extraer fuente: namespace `/private/tmp/checkpass-pos-0242/m1-r1-e58f41b6`
conserva únicamente copiaarchive0600 (6042760bytes/hashoriginal) y control/0700
vacío; sinplan/candidate/build/DB/servidor/datos. El delta siguiente transmite
stdout de gitarchive directamente a FD de archivo propio wx0600, sin límite
de capturaRAM, y sólo después extrae con tar. Manifiesta sourcearchives/hashes
de ambas fuentes. No altera archivo original ni reutiliza intentos fallidos.

Preparación925e3397 revisada por QA sin bloqueantes funcionales de receta/código.
Su primer prepare offline se detuvo por una restricción de modo: archive histórico
0644 bajo padreprivate0700; selected/ci.env son0600. Namespace
`/private/tmp/checkpass-pos-0242/m1-r1-925e3397` queda0700 VACÍO, sin plan/runtime
extraído ni datos. Fix posterior sólo lee archive regular/no-symlink dentro de
padre0700, verifica SHA original y crea copia exclusiva0600 propia antes de tar;
nunca modifica modos/contenido originales. Este fallo es setup de permisos, no
producto ni medición. Nueva preparación requiere namespace/SHA explícitos.

Revisión previa rechazada1c39815c preservada sin datos. Este incrementoR1.1
atiende los cuatro hallazgos de QA antes de cualquier medición: retornoOPEN
candidato por Salir; respuesta exacta de ocho snapshots con IDs premanifestados y
marker limitado a Productos del pedido/Orden, no nombres de catálogo global;
CDPdecoded desconocido null, cero sólo observado/confirmado; cleanup con SELECTs
de ausencia en catorce tablas propias y artefacto saneado antes de cleaned.
Los adaptadores y markers siguen estrictos. Ver recetaR1.1 para contrato exacto.

Nuevo autor/contexto fresco, WT/ref `pos-ui-grid-0242`, base exacta
`b6375774a5b2f5c157df7aadc09b5f6820479c99`, después de QA funcional combinado
`a9d32924` aceptado por coordinador. Este incremento implementa únicamente
harness/receta offline. **No hay datos, build, Nextstart ni operacionesDB M1.**
Tampoco conclusión de rendimiento, aceptaciónQA o cierre0242.

Ocho paths de ficha: cuatro scripts `m1.mjs`, `m1-browser.mjs`, `m1-analyze.mjs`,
`m1-analysis.test.mjs`; dos fixtures `m1-fixture.neon.integration.test.ts` y
`m1-fixture.test-support.ts`; receta `0242-m1-receta.md` y este handoff. Ningún
cambio de producto/kit/guard/schema/tooling compartido ni factory/estados/índices.

RecetaR1 previa a datos:30paresABBA del listado normal por rol; diez primeras
entradas con assets nuevos por fuente/rol; cinco pares por rol separados para
empty, volume, lista→detalle y detalle→lista. Son240observaciones medidas,
240warmups y20preparaciones de detalle, estas últimas dos fuera de las muestras.
TransiciónRSCowner queda diagnóstico pendiente separado; staff sólo[pos] no
tiene landing autorizada distinta equivalente. No se declara ese trayectoPASS.
Control y candidato comparten doce filas visibles/24IDs normales, con primer
localCentro y orden `[Centro,Norte]` manifestado, nunca24contra12.

Launcher separa runnerSHA de buildSource/BUILD_ID, valida configuraciónCI y
antiPROD incondicional, exige autorización de recursos del coordinador para
fixture/build/freeze/measure y usa sólo wrapperNeon para DB. `prepare` construye
scratchruntime sin cuartoWT y sin sobrescribir `.next`/M0: código original6f más
archivecontrol original, candidato fuente congelada, dependencias/paths/hashes
manifestados. Preparación real de scratch ee97 se ejecutó sólo offline, como consta arriba.
No build de candidato ni runtime de servidor.
El control NO se recompila. Uso serial del mismo43242 aprobado por coordinador,
con proceso nuevo por observación y exactamente1warmup equivalente antes del
reloj; assets nuevos son otro contexto después de ese warmup. DB preparada/caliente,
sin afirmaciónDBfría ohostingPROD. Cookie login usa helper OTP/PIN existente.

Browser observa todas las peticiones y sus initiators, incluidos proveedor,
sesión/módulos globales. No oculta un GET global de primera entrada detrás de
un smoke calentado: warmup también debe pasar gates funcionales/estructurales,
se conserva por separado y su fallo detiene campaña. Marcador DOM exige datos
reales y Nueva orden habilitada; responseassertions vinculan IDs/labels/local/
líneas/total. Requests y bytes quedan finish/error/timeout; quietud500ms sin
pendientes, máximo15s fuera de listUsable. No interceptacionesAPI, capturas,
cookies fabricadas ni cuerpos/tokens en reportes. Rutas mutantes quedan fuera de
R1: recetaR2 obligatoria antes de identidades/datos, con cámara sintética igual,
auth/token/API/DB reales y tailpostclose fuera de closeConfirmed bajo la misma
regla declarada de finalización. Las21identidades M0 no se consumen.

Análisis calcula diferencias de medianas/p95 MARGINALES, p95nearest-rank,
bootstrapPAREADO10000/seed24220261018 y ICpercentil95; no mediana de diferencias.
Distingue PASS/FAIL/INCONCLUSIVE y no transforma incertidumbrep95 enPASS.
Rechaza corte incompleto, duplicado, fallos y tamaños incompatibles; los diagnósticos
se reportan separados y no acreditan rutas críticas ausentes. Instrumentación
SQL/fases real existente se conserva, con artefacto privado/hash y resumen por tag.

Checks offline en Node24.20.0/pnpm11.4.0: ESLint focal, Prettier, node--check y
node--test estadístico y validación de snapshots (diez pruebas, ceroskips); tscmerchant--noEmit
--incrementalfalse EXIT0. El SHA definitivo y resultado final de checks se entregan
al coordinador fuera de este archivo para evitar autorreferencia. No se ejecutó
suite DB (no se cuenta un skip comoPASS), browser, build ni servidor. No procesos
propios que detener. RecursosDB siguen reservados al autor de regresión hasta
transferencia explícita. Revisión previa de receta/código por QA es el siguiente
paso antes de cualquier dato M1. No factorydeliver por cuenta del worker.

---

El handoff histórico siguiente corresponde exclusivamente al diagnóstico nativo
previo; sus datos no se reutilizan como M1.

# 0242 P6B — incremento diagnóstico nativo previo a M1

Entrega parcial: harness diagnóstico y una venta nativa nueva con inspección
durable/replay. **M1 no está ejecutado ni implementado.** No hay comparación A/B,
build/start de entrega ni conclusión de rendimiento. El coordinador detuvo la
preparación M1 para cerrar antes el gate combinado P4 con QA independiente.

## Identidad y alcance

- WT/ref asignado: `/private/tmp/checkpass-pos-0242/pos-ui-grid-0242`,
  `pos-ui-grid-0242`. Base documental inicial `ccf003ba`; el coordinador actualizó
  el WT limpio a `2055d566238f78d34073e8360bda54604995d69b`, combinado P4 y
  ampliación explícita de ficha `bbd0ccaf`.
- Código y runner ejecutado: `4f3c57101ced17dd663f54395e9a4be223cdd188`.
  Fuente de producto P4 compatible con `3e292aef`; el incremento no cambia producto.
- Único archivo de código: `tools/pos-measurement/mass-native.mjs`. Este documento
  es el segundo archivo de la entrega. No se crearon los cuatro scripts M1 ni las
  dos fixtures M1; tampoco se congeló todavía `0242-m1-receta.md`.
- Node `24.20.0`, pnpm `11.4.0`; Next development webpack propio en `43252`.
  Este runtime sirve al diagnóstico funcional, no satisface el runtime M1.
- Namespace nuevo exclusivo:
  `/private/tmp/checkpass-pos-0242/mass-native-p6-diag-4f3c5710`.
  Directorio `0700`, todos sus archivos `0600`, sin modificación de M0/selected CI.

## Cambio y límites

Los tres pares `waitForResponse`/click (resolve, create y close) se esperan juntos
con `Promise.all`. Así la espera de respuesta tiene manejador mientras el click
permanece pendiente. Close exige además POST. El runner crea un artefacto exclusivo
de intento **antes de lanzar Chromium**, y lo actualiza por etapas y eventos.
Captura respuestas por path/método/status, requestfailed, pageerror y snapshots de
botones visibles/habilitados, diálogos y alerts; no captura imágenes ni cuerpos
de respuesta. Sanea token/cookie del fixture en errores y snapshots privados.
Persiste el ID canónico de la orden inmediatamente después de recibir create.

El fallo combinado previo quedó preservado por QA: después de resolve no apareció
POST orders y la espera de respuesta rechazó mientras el click seguía pendiente,
sin artefacto de fallo. Este incremento corrige ese patrón de promesas y amplía la
observación. **No demuestra la causa de la ausencia de POST ni que haya desaparecido
un fallo intermitente de producto.** La única venta efectiva nueva no lo reprodujo.

## Comprobaciones y todos los intentos

Antes del commit: `node --check`, ESLint del script, Prettier y `git diff --check`
EXIT0. Checkout limpio al iniciar setup y browser; no cambios generados después.

Secuencia serial sobre reserva CI transferida explícitamente por el coordinador:

1. `POS_MASS_NATIVE_RUN=p6-diag-4f3c5710 node tools/pos-measurement/mass-native.mjs fixture setup`:
   EXIT0, una prueba PASS, cero skips. `fixture loyalty`: igual.
2. Servidor propio iniciado por `mass-native.mjs server`; listener PID `53321`,
   CWD verificado `WT/apps/merchant`, solo `127.0.0.1:43252`.
3. Primer intento browser bajo sandbox: FAIL en launch, cero HTTP y ninguna
   venta. Artefacto `browser-attempt-912ebf05-6494-4e80-b0de-18a71df7a55a.json`:
   SHA256 `073142d1c9515d79a3352a4de4f4070dd1a9eb13c679335bf038c62675f68fc6`.
   El nuevo manejo también conserva fallos anteriores a crear el contexto.
4. Intento efectivo con escalación Chromium permitida: EXIT0. `resolve` 200,
   create 201, close 200; masa `0.75 kg` a tarifa `4.123456789`, bruto `3.09`,
   cupón 10%, cobrado `2.78`; recibo e historial confirmados. Cero pageerrors,
   cero GET de órdenes después de crear y ninguna venta repetida. La entrada del
   pase fue manual legítima: no acredita equivalencia de cámara para M1.
5. `fixture inspect`: EXIT0, una prueba PASS, cero skips. DB: una orden cerrada,
   una línea masa, un pago `2.78`, evento `sale.closed` v4, una redención,
   ledger `2.78`, dos puntos; replay con el mismo cuerpo conserva snapshots.
6. Servidor propio detenido por TERM tras verificar PID/CWD (el sandbox requirió
   escalación). `fixture cleanup`: EXIT0, una prueba PASS, cero skips, ownership
   validado y agregado propio retirado. Puerto `43252` libre; `3201` conserva
   PID `927`. Sesión del launcher terminó y no quedan procesos propios de servidor.

El fallo de launch no se cuenta como PASS ni se elimina; el intento efectivo es
una ejecución funcional separada, permitida porque el primero no emitió HTTP.
No se declara verify global ni aceptación de QA. Las cuatro operaciones DB usaron
exclusivamente el wrapper `tools/neon-test.sh` mediante launcher protegido.

## Artefactos privados preservados

| Archivo | SHA256 |
| --- | --- |
| `browser.json` | `58538973a56fa3cebaf77d8e0360e53384e3fbf4cf9c0823620b824458838f75` |
| `browser-attempt-260e6bb8-2e0a-4aef-9c55-cb2be9a175fd.json` | `24f412c295805b4127b2ebef2b8e5a0ccd862f680f9b52cab7a24d746f263775` |
| `inspection.json` | `ed2e483dd63ce6d4beff126dcddfeff395ff62adc90592c6f7d1cd32a969f057` |
| `cleanup.json` | `fab8b4a316b20817dffafef85f7bfe33fe12b6dd67d48250b81baa62b0544de2` |
| `setup.log` | `2f44d86face18ae381ef66b2e04fd3ae988a0a69e927904fc5611506ee35958b` |
| `loyalty.log` | `c9402652478322034974fec844c3eeb7eec0c90d03a722400b836f83743f9942` |
| `inspect.log` | `1fe53471aff8bbadfdb2af6c73e096b7f172a4e572ca9d20f64bf8c948bcef6f` |
| `cleanup.log` | `e4e59fe7249686737cbf111242b3891931a23371cdee3b688ceb80dc3b590ec0` |

También se conservan manifiestos originales del intento, logs browser/servidor y
el artefacto de fallo de launch. No contienen evidencia temporal M1 utilizable.

## Continuación propuesta, aún sin congelar

Primero QA combinado P4 y freeze explícito nuevo. Después preparar receta/script
offline, revisarlos y comprometer receta antes de recoger datos. Primer corte:
lista normal, navegación completa, 30 pares AB/BA por rol (owner/staff separados),
15 AB y 15 BA con orden permutado por semilla `24220261018`; caché de navegador
caliente mediante warmup fuera del reloj y misma regla por fuente. Diez primeras
entradas con assets nuevos por fuente y rol en población separada. Transición,
retorno, empty y volume: cinco pares diagnósticos por rol, sin gate inferencial.

Estimador propuesto: diferencia de medianas marginales y diferencia de p95
nearest-rank marginales, bootstrap pareado de 10000 remuestras, IC percentil95%.
Gates del protocolo íntegros, todos los intentos/errores conservados. No iniciar
flujos mutantes si la lista revela un fallo sin diagnosticar. Segundo corte con
receta nueva previa: rutas críticas separadas, identidades nuevas premanifestadas
por fuente/rol/variante; muestra que permita resolver p95, sin ampliar después de
mirar datos salvo nueva receta explícita. Inconcluso no es PASS.

Tail postclose propuesto: fuera de closeConfirmed, observar finish/error/timeout
y bytes hasta 500ms sin APIs pendientes, máximo15s, misma condición por fuente.
Cámara sintética idéntica con auth/token/API/DB reales; peso candidato separado.
Mantener control archivado6f/BUILD_ID original, runnerSHA independiente y hashes
de producto/config/fixture/schema/lock antes de medir. No DB fría ni hostingPROD
inferidos. Preservar M0 y sus21identidades consumidas. El coordinador conserva
factory/reservas/aceptación y decidirá el siguiente autor/corte; no factorydeliver
por cuenta del worker. Sin capturas, push ni operacionesPROD.

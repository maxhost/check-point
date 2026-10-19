# 0242 P6B — preparación offline M1R1

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
manifestados. Preparación real de scratch todavía no ejecutada en este incremento.
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
node--test estadístico y validación de snapshots (nueve pruebas, ceroskips); tscmerchant--noEmit
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

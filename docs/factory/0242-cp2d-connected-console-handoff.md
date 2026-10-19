# 0242 CP2d.7 — consola conectada local

FactoryID: `pos-connected-console-0242`. Base: `cd777d933e1d98fa6d436bfbd8155089f3ea5fbf`. Producto congelado: `23b64a19`; revisión de oráculo DB: `b7a8f78a` (solo dos strings esperados, escala numeric(24,9)). Esta entrega requiere QA NUEVO independiente; no declara activación masiva ni publicación.

## Implementación y contrato

`PosScreen` conserva guard/server locations y pasa `previewEnabled` exclusivamente en development. `PosEntry` elige consola medida solo con ese permiso y `?posV2=1`; default y producción mantienen legacy. La nueva consola exige provider listo, identidad y permiso POS reales; usa transporte contrato2/scope sin GET propio de sesión/módulos.

`MeasuredConsoleContent` posee una PosCache y las sesiones aceptadas de editor/pago durante las vistas. El listado usa lecturas de esa caché; create/update/close usan comandos aceptados y sus DTO canónicos. Mostrador crea antes de preparar cobro; otros tipos guardan y pueden reabrirse desde caché. El resultado usa settlement/sale recibidos para total/acreditación/saldo, sin adaptación legacy ni aritmética nueva. La lista filtra abiertas/cerradas/anuladas del día/local y ofrece carga/error/vacío y actualización explícita.

La extensión autorizada de `MeasuredOrderCache.accept(order,{historyWindow:{timeZone,now}})` reproyecta un cierre por su closedAt real y día del negocio. Default de callers previos intacto; la consola aplica la opción después del close aceptado. Conserva invalidez previa del historial e invalida lecturas pendientes; no hace GET postwrite. Prueba frontera Guayaquil 05:00Z, UTC y replay anterior a medianoche.

Cobro closing/uncertain bloquea navegación/selección/nueva orden. Cancelar cobro conserva la orden abierta y la misma sesión. 403 bloquea acciones conservando la intención de la misma identidad, y permite comprobar acceso explícitamente. Retiro real de identidad retira sesiones y descarta callbacks tardíos. El cleanup diferido un microtask evita que el probe StrictMode de development retire al mismo owner inmediatamente remontado. Los helpers aceptados de dinero/editor/pago permanecen intactos.

Paths: pos-screen, pos-entry, measured-console, measured-order-list, measured-order-cache y su test; console-native.neon.integration.test; pos-connected-console.spec y sus dos fixtures; este handoff. Sin kit/guard/schema/tooling/contratos/backend de producto ni legacy modificados. Impresión, ticket, anulación operativa y cutover quedan para incrementos posteriores.

## Evidencia y resultados

Directorio privado fuera del runner: `/private/tmp/checkpass-pos-0242/connected-console/`. `evidence-identity.json` fija base/source, Node24.20.0, SHA256 de lock/config CI seleccionada y archivos; endpoint CI `4e09cdfbd634`. No contiene cookies/credenciales/scope/QR. Capturas finales `editor-390.png` y `editor-1280.png` preservadas y ABIERTAS en lote inicial y una única confirmación; sin overflow horizontal. Son evidencia del editor conectado, no certificación visual nativa completa.

Sobre producto `23b64a19`, todos EXIT0: merchant typecheck; eslint de diez paths; Prettier; UIguard (`5 archivos, sin aumentos`); cache `17/17`; browser conectado `6/6`, sin retries/skips. Casos browser: Mostrador create→cancelar→mismo body/UUID de close incierto→resultado→lista sin GET adicional; pickup guardar/reabrir; conflicto obliga revisión preservando borrador; identidad A→B descarta create tardío; 390/1280. Las matrices monetarias y remount de sesiones aceptadas no se duplicaron completas.

Gate NATIVO sobre `23b64a19`: `native-browser-23b64a19.log`, PASS1/1 sin skips (21.4s). Next development real, guard/auth/cookie/scope reales, HTTP/DB CI reales, Medialuna unit USD3.50: listado→crear→cobrar→resultado→listado. GETorders1, POSTclose1, GETsession/modules0 durante recorrido. Luego cookieB sobre documento/scopeA: POST409 `backoffice_context_changed`, retiro del documento a `/backoffice`, sin efectos en B.

Sobre `b7a8f78a`: `native-inspect-b7a8f78a.log`, PASS1/1, verifica una orden closed/counter con totalSnapshot/settlement gross/collected3.50 y closeRequestId; una línea unit cantidad1.000000000/precio3.500000000; un pago3.50; negocio B sin órdenes. La corrección posterior solo ajusta strings del oráculo al esquema, por lo que evidencia nativa/UI/cache de producto idéntico es reutilizable. Merchant typecheck, lint/formato del fixture corregido EXIT0.

Fallos conservados, no tratados como PASS: browser inicial scope de fixture en mayúsculas y selector Agregar en lugar de Añadir; primer native selector equivocado; primera visita native fría hizo refresh global del provider y falló aserción global sessionGET0. CDP confirmó iniciadores BackofficeProvider/context-controller, no consola. Se mantuvo la aserción y se calentó ruta con auth propia en visita read-only antes del gate final. `provider-initiators.json` registra stacks sin headers/cookies. Inspección inicial usó campo total inexistente, luego omitió escala de numeric: ambos oráculos corregidos dejando logs. Sandbox ps/gitdir requirió escalación acotada; server inicial Watchpack EMFILE se resolvió con polling y runner propio escalado. Ningún fallo de esas corridas se ocultó ni contó como aceptación.

## Receta nativa y teardown

Runner privado `runner.mjs`: valida ambas URLs seleccionadas contra SHA12 antiPROD y endpoint CI; usa selected.json actual, override BETTER_AUTH_URL `http://localhost:43252`, NODE_ENV development y WATCHPACK_POLLING1000. No copia env productivos. Cada operación DB usa exclusivamente `NEON_TEST_ENV_FILE=/private/tmp/checkpass-pos-0242/private/ci.env bash tools/neon-test.sh src/modules/pos/server/console-native.neon.integration.test.ts --no-file-parallelism`, con POS_CONNECTED_CONSOLE_NATIVE=true y operación setup/inspect/cleanup. Setup genera dos mundos propios y sesiones nuevas, tours completos y artefacto600. Inspección/cleanup validan ownership. Para repetir, coordinar reserva DB y archivar el artefacto RETIRADO previo antes de setup; nunca reutilizar sus cookies.

Node24 antes de todos los comandos. Secuencia: `node runner.mjs fixture setup`; `node runner.mjs server` (solo43252); visita read-only `node initiator.mjs` para calentar Next; `node runner.mjs browser`; `node runner.mjs fixture inspect`; detener procesos propios del servidor; `node runner.mjs fixture cleanup`. El runner browser usa config Playwright propia, Chromium escalado y retries0. Logs fueraWT, fixture solo por wrapper.

Teardown final `native-cleanup-b7a8f78a.log` PASS1/1; `native-cleanup.json`: removed=true, ownedBusinesses2, owners0, sessions0. Server detenido y runners browser finalizados; comprobación de procesos pendientes se adjunta en evidencia externa. Reserva se conserva hasta que coordinador confirme retirada. No fullverify/M0/M1, push, PROD,3201/túnel/demos ni artefactos ajenos.

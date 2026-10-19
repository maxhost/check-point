# 0242 P6A — handoff de regresión HTTP

Base `01445a86bdec433e8d7bc75b94dfca1ce8184c19`, WT/ref `pos-ui-card-0242`. Corte inicial6+2 y ampliación5 autorizada por coordinador/contrato `613fbf1f`. Sin producto, guards, esquema, migraciones ni despachador genérico editados.

## Estrategia e invariantes

- `pos` y `openOrder` originales conservan su comportamiento raw: ningún consumidor transitivo recibe cabeceras o traducción de bodies a escondidas.
- `capturePosScope` captura sesión nativa y negocio del caller una sola vez. `scopedPos` representa ese cookie/scope capturado; no recaptura durante reintentos ni toca el cuerpo.
- `openOrderV2` sólo construye fixtures positivas explícitas con UUID, note:null, cantidades string/unit y revisión comercial consultada. Las entradas negativas siguen explícitas/raw.
- `closeWithCash` adopta V2 sólo con cuarto argumento `{scope}` explícito. Neto0 conserva payments:[]. El default raw sigue intacto.
- Histórico se monta por SQL transaccional (`seedLegacyOrder`) con snapshots de productos del propio tenant y constraints vigentes. No se reabre writerHTTPV1. Lectores internos históricos mantienen los oráculos de tarifa/cantidad legacy, centavosCOP y ranking unitario.
- HTTPV1 ausente/1 pasa a409 upgrade antes de consumir body/escritores; se comprueba no efectos. Scope ausente/mismatch y401/403 conservan precedencia. DTOs exactos conservan allowlists actuales y se amplían detalle/línea/medida/membership/accrual.

## Matriz de conservación del corte

| Suite | Invariantes conservadas |
| --- | --- |
| measured-create | permisos/tenant/scope; idempotencia serial/concurrente y replay tras editar/cerrar/anular; precios0/legacy; mesa/local; rollback SQL real; lock comercial |
| measured-update | permisos/tenant/estado; V1 sin mutación; carrera de versión con DTO canónico; rollback de última línea; snapshots/fk borrada/extremos legacy; efectos |
| measured-read | scope/tenant; catálogo mínimo/tarifas; alias/tipo/mesa; histórico SQL/centavosCOP/currency snapshot; cupón/settlement; ranking/local/fecha |
| read-api-v2 | guards/módulo/scope; resúmenes/histórico/tenant; resolve inválido sin enrolar; DTO mínimo exacto; cupón seleccionado; V1 sin cargar catálogo/identidad |
| close-api-v2 | harness explícito con guard mock y sesión cookie nativa para scope; orden guard/scope/contrato/body; pago/evento/acreditación/after exactamente una vez; negativos y DTO |
| void-api-v2 | harness explícito con cookie/scope real; body opcional; JSON/versión inválidos; replay/evento uno; tenant y cerrada sin alterar pagos |
| extensión5 | escaleraauth, owner/staff/tenant, ajustes/pagos, locks mesaocupada/toggle, cuerpos V2 explícitos sin reparar negativos |

## Inventario directo y cierre recursivo de soportes

39 consumidores directos únicos de ambos soportes: seis iniciales +33 fuera del corte inicial. El cierre recursivo posterior descubre40, agregando stock-local-recipes vía stock-local-integration-support;39 nunca fue el universo indirecto completo. Estado actual:18suites con107casos PASS compatibles por cortes;15suites residuales/históricas preparadas offline y pendientesDB;7consumidores noeditados compatibles por lectura. “Compatible por lectura” no significa PASS ejecutado.

| Archivo real | Tratamiento |
| --- | --- |
| `apps/merchant/src/modules/analytics-an3-events.neon.integration.test.ts` | Residual8 actualizado, checks offline PASS; DB pendiente de devolución |
| `apps/merchant/src/modules/brand-fiscal-inert.neon.integration.test.ts` | Residual8 actualizado, checks offline PASS; DB pendiente de devolución |
| `apps/merchant/src/modules/negocio-retirement.neon.integration.test.ts` | Residual8 actualizado, checks offline PASS; DB pendiente de devolución |
| `apps/merchant/src/modules/pos/server/business-access.neon.integration.test.ts` | Compatible por lectura: usa sólo seed/módulo o caller nativo/raw de cutover explícito; no cambiar por el soporte |
| `apps/merchant/src/modules/pos/server/business-failures.neon.integration.test.ts` | PASS DB compatible por corte660add97/25bc5a27/d9d0b8bd; ver resultados y límites abajo |
| `apps/merchant/src/modules/pos/server/business-financial.neon.integration.test.ts` | PASS DB compatible por corte660add97/25bc5a27/d9d0b8bd; ver resultados y límites abajo |
| `apps/merchant/src/modules/pos/server/business-sales-units.neon.integration.test.ts` | Compatible por lectura: usa sólo seed/módulo o caller nativo/raw de cutover explícito; no cambiar por el soporte |
| `apps/merchant/src/modules/pos/server/catalog-measure-storage.neon.integration.test.ts` | Histórico6 actualizado; SQL canónico/clones/constraints de origen conservados y shape0108 activo separado; DB serial pendiente |
| `apps/merchant/src/modules/pos/server/catalog-storage-expand.neon.integration.test.ts` | Histórico6 actualizado; SQL canónico/clones/constraints de origen conservados y shape0108 activo separado; DB serial pendiente |
| `apps/merchant/src/modules/pos/server/close-api-v2.neon.integration.test.ts` | Corte inicial PASS DB en afe7060d |
| `apps/merchant/src/modules/pos/server/console-native.neon.integration.test.ts` | Compatible por lectura: usa sólo seed/módulo o caller nativo/raw de cutover explícito; no cambiar por el soporte |
| `apps/merchant/src/modules/pos/server/legacy-cutover.neon.integration.test.ts` | Compatible por lectura: usa sólo seed/módulo o caller nativo/raw de cutover explícito; no cambiar por el soporte |
| `apps/merchant/src/modules/pos/server/measured-create.neon.integration.test.ts` | Corte inicial PASS DB en afe7060d |
| `apps/merchant/src/modules/pos/server/measured-read.neon.integration.test.ts` | Corte inicial PASS DB en afe7060d |
| `apps/merchant/src/modules/pos/server/measured-summary.neon.integration.test.ts` | PASS DB compatible por corte660add97/25bc5a27/d9d0b8bd; ver resultados y límites abajo |
| `apps/merchant/src/modules/pos/server/measured-update.neon.integration.test.ts` | Corte inicial PASS DB en afe7060d |
| `apps/merchant/src/modules/pos/server/order-intent-storage.neon.integration.test.ts` | Histórico6 actualizado; SQL canónico/clones/constraints de origen conservados y shape0108 activo separado; DB serial pendiente |
| `apps/merchant/src/modules/pos/server/payment-methods.neon.integration.test.ts` | Ampliación5 PASS DB en afe7060d |
| `apps/merchant/src/modules/pos/server/pos-access.neon.integration.test.ts` | Ampliación5 PASS DB en afe7060d |
| `apps/merchant/src/modules/pos/server/pos-best-sellers.neon.integration.test.ts` | PASS DB2/2 en98ffe933, fuente compatible |
| `apps/merchant/src/modules/pos/server/pos-close-races.neon.integration.test.ts` | PASS DB compatible por corte660add97/25bc5a27/d9d0b8bd; ver resultados y límites abajo |
| `apps/merchant/src/modules/pos/server/pos-close-reuse.neon.integration.test.ts` | PASS DB compatible por corte660add97/25bc5a27/d9d0b8bd; ver resultados y límites abajo |
| `apps/merchant/src/modules/pos/server/pos-close.neon.integration.test.ts` | PASS DB compatible por corte660add97/25bc5a27/d9d0b8bd; ver resultados y límites abajo |
| `apps/merchant/src/modules/pos/server/pos-context-native.neon.integration.test.ts` | Compatible por lectura: usa sólo seed/módulo o caller nativo/raw de cutover explícito; no cambiar por el soporte |
| `apps/merchant/src/modules/pos/server/pos-disable-tables.neon.integration.test.ts` | 98ffe933 1/2, timeout120s primer caso; spy/contención/finally corregidos enbaf2a979, retest pendiente |
| `apps/merchant/src/modules/pos/server/pos-disable.neon.integration.test.ts` | PASS DB6/6 en98ffe933 incluidas carreras, fuente compatible |
| `apps/merchant/src/modules/pos/server/pos-ladder.neon.integration.test.ts` | Ampliación5 PASS DB en afe7060d |
| `apps/merchant/src/modules/pos/server/pos-migration-0079.neon.integration.test.ts` | Histórico6 actualizado; SQL canónico/clones/constraints de origen conservados y shape0108 activo separado; DB serial pendiente |
| `apps/merchant/src/modules/pos/server/pos-orders.neon.integration.test.ts` | 98ffe933 7/8, unknown_line→invalid_input422 corregido enbaf2a979; retest focal pendiente |
| `apps/merchant/src/modules/pos/server/pos-scope.neon.integration.test.ts` | Compatible por lectura: usa sólo seed/módulo o caller nativo/raw de cutover explícito; no cambiar por el soporte |
| `apps/merchant/src/modules/pos/server/pos-staff-entry.neon.integration.test.ts` | Compatible por lectura: usa sólo seed/módulo o caller nativo/raw de cutover explícito; no cambiar por el soporte |
| `apps/merchant/src/modules/pos/server/quantity-storage-expand.neon.integration.test.ts` | Histórico6 actualizado; SQL canónico/clones/constraints de origen conservados y shape0108 activo separado; DB serial pendiente |
| `apps/merchant/src/modules/pos/server/read-api-v2.neon.integration.test.ts` | Corte inicial PASS DB en afe7060d |
| `apps/merchant/src/modules/pos/server/settlement.neon.integration.test.ts` | PASS DB compatible por corte660add97/25bc5a27/d9d0b8bd; ver resultados y límites abajo |
| `apps/merchant/src/modules/pos/server/ticket-settings.neon.integration.test.ts` | Ampliación5 PASS DB en afe7060d |
| `apps/merchant/src/modules/pos/server/unit-expand-compat.neon.integration.test.ts` | Histórico6 actualizado; SQL canónico/clones/constraints de origen conservados y shape0108 activo separado; DB serial pendiente |
| `apps/merchant/src/modules/pos/server/void-api-v2.neon.integration.test.ts` | Corte inicial PASS DB en afe7060d |
| `apps/merchant/src/modules/stock-local-recipes.neon.integration.test.ts` | Indirecto vía stock-local-integration-support; opt-inV2 actualizado, checks offline PASS, DB pendiente |
| `apps/merchant/src/modules/stock-local.neon.integration.test.ts` | Residual8 actualizado, checks offline PASS; DB pendiente de devolución |
| `apps/merchant/src/modules/tables/server/tables.neon.integration.test.ts` | Ampliación5 PASS DB en afe7060d |

## Checks e intentos

- Runtime Node24.20.0/pnpm11.4.0 del lock existente. Preparación inicial offline; corridasCI posteriores abajo. Ningún Next/browser/puerto ni accesoPROD.
- Intento preliminar seis: typecheck merchant FAIL por import seedLegacyOrder faltante y ESLint FAIL por cuatro imports pos sobrantes; corregidos.
- Segundo intento seis: `pnpm --filter @mi-pasaporte/merchant typecheck` PASS y ESLint focal8 PASS.
- Intento ampliación5: ESLint focal13 PASS; typecheck merchant FAIL por clave duplicada en fixture mesas; corregida. Tercer intento typecheck merchant PASS.
- Prettier focal ejecutado; diff whitespace limpio. Evidencia offline no certifica comportamiento DB. Ningún PASS atribuido a skips/retries; corridasDB reales abajo.

## Resultado DB inicial congelado

`afe7060d`: wrapper CI seleccionado `NEON_TEST_ENV_FILE=/private/tmp/checkpass-pos-0242/private/ci.env tools/neon-test.sh src/modules/pos/server/{measured-create,measured-update,measured-read,read-api-v2,close-api-v2,void-api-v2,pos-access,pos-ladder,ticket-settings,payment-methods}.neon.integration.test.ts src/modules/tables/server/tables.neon.integration.test.ts --no-file-parallelism`.

EXIT0,11/11 suites,75/75 casos,0skips/0retries,616.03s. SHA limpio antes/durante/tras ejecución; migraciones CI idempotentes y teardown completos. Log privado `p6-first11-attempt1.log`. Dos SQL22012 son inyecciones esperadas con rollback probado; warning consumerURL ausente no aplica a estos casos. Ningún fallo DB en este intento.

## Pendiente

DB devuelta al coordinador/reservaM1 después del cierre d9d0b8bd/0de105f0. Candidato residual fuente ebb9ebd9, con checks offline PASS y sin nuevas corridasDB. Esperar devolución explícita antes de ejecutar9residuales y6históricosDDL seriales/aislados, exclusivamente wrapper `tools/neon-test.sh`/selección privada existente. QA NUEVO independiente sobre congelado, sin repetir107compatibles por ceremonia. closeWithCash sólo unit legacy; masa/precisión nueva exige pagos/oráculo exactos explícitos. No factory/estados/índices/push/PROD.

## Corte dinero en660add97: primer intento completo

WrapperCI serial6, EXIT1:4/6 suites PASS,25/28 casos PASS,3fallos,0skips,430.71s. Log privado `p6-money6-attempt1.log`. PASS:measured-summary5,settlement7,pos-close-races3,pos-close-reuse2. Pos-close4/6 y business-financial4/5.

Los tres fallos son oráculos/fixturesV1 demostrados: summary cerrado sin pase ahora saleTotal9.00 del settlement (esperaba null); V2 preserva note:null literal (esperaba prefijo Mesa automático del writer viejo); cierreV2 publica exactamente1SaleClosedV4 (esperaba0 por flag histórico). La corrección conserva todos los assertions de dinero/comisión/acreditación y añade identidad de evento tras replay; la nota Mesa esperada se declara explícitamente en comando de fixtureV2table. Sin producto cambiado.

Límite de cleanup del primer intento dinero: soporte histórico elimina negocios/dominio/extraUsers, pero no todos los owner/consumerAccounts huérfanos. No se conservaron IDs exactos de esas identidades para retirarlas después del proceso; no se hizo barrido por patrón. En25bc5a27 y d9d0b8bd pos-close/business-financial/business-failures ya capturan IDs propios y se verifican consumidores/owners/sesiones vacíos tras eliminar sus negocios. Esto no invalida los75 iniciales compatibles ni los4archivosPASS dinero no cambiados.

Checks de la corrección: primer typecheck FAIL por import `other` propio faltante; corregido. Segundo typecheck merchant PASS, ESLint3 PASS, Prettier4 PASS y diff whitespace PASS. Se repitieron sólo pos-close/business-financial; business-failures se probó después en invocación DDL aislada, con resultados abajo.

## Revisión25bc5a27 y fallo del montaje de carrera

Repetición focal pos-close/business-financial:EXIT0,2/2 suites y11/11casos PASS,0skips/retries,169.53s (`p6-money2-attempt2.log`). Los4archivos PASS de660add97 siguen idénticos y compatibles; no se repitieron.

Business-failures aislado intento1 en25bc5a27 no certifica4casos: primer rollbackSQL40001 PASS, segundo timeout120s,2casos no ejecutados. El spy viejo esperaba saveCommission externa dentro del capture, pero closeV2 mantiene business-config hasta commit y saveCommission espera ese mismo lock. Se terminó sólo workerPID98024; Vitest informó1unhandled worker-exit error y terminóFAIL/interrumpido. Launcher97538,pnpm98015,Vitest98017,esbuild98023 yworker98024 comprobados ausentes por PIDs exactos. Log `p6-business-failures-attempt1.log`; no se presenta comoPASS ni se subió timeout.

El teardown de ese intento abortado no completó sus raíces/identidades y no había registrado IDs exactos: límite retenido, sin barrido por patrón. La nueva revisión registra IDs de negocio/owners/consumer propios al crearlos, comprueba cero advisorywaiters/idletransactions y ausencia de función/trigger qa_0235_fail antes/después. La carrera se rediseña como capturaA→writerB externo observable esperando el mutex exacto→liberar cierre→esperarB; snapshot/evento deben mantenerA y configuración actual quedarB. Todos los promises se liquidan en finally antes del cleanup. Sin tocar producto, locks ni Counter global.

## Cierre del corte dinero/DDL antes de transferir DB

`d9d0b8bd`, business-failures intento2 aislado:EXIT0,1/1suite,4/4casos PASS,0skips/retries,43.76s. CarreraA→writerBespera→commitA→configB probada con mutex business-config exacto. Preflight/teardown comprobaron advisorywaiters0,idletransactions0,función/trigger qa_0235_fail ausentes; owner/consumerAccounts/sesiones propios eliminados por IDs registrados. Launcher terminóEXIT0; ningún Next/browser/servidor propio arrancado.

Evidencia compatible acumulada por corte:75casos/11suites enafe7060d;17casos/4suites dinero sin cambios en660add97;11casos/2suites corregidas en25bc5a27;4casos/1suite DDL end9d0b8bd. Son107casos distintos en18suites, no una corrida global niQA final. LosFAILs/interrupción anteriores siguen documentados. El límite de raíces/identidades sinIDs del intento DDL abortado permanece declarado; sin barridos. Logs privados `p6-business-failures-attempt2.log`, `p6-money2-attempt2.log` y anteriores conservados.

DB puede volver al coordinador/M1 sólo tras su transferencia explícita. Residual8 e históricos6 permanecen en patches privados propios (`p6-residual8-offline.patch`, `p6-historical6-offline.patch`); siguiente paso autorizado: aplicar/checks offline mientras M1 operaDB, congelar y esperar devolución para suites seriales/DDL separados.

## Residual14 preparado offline tras transferencia a M1

Los8HTTP/toggles/eventos y6históricos autorizados están aplicados. No cambia ningún soporte/producto de los18archivos yaPASS. Casos originales conservados; DTO exacto de orden/línea/medida ahoraV2, payloads negativos explícitos sin arreglos silenciosos. Legacy ranking/centavos siguen comprobándose mediante lectores internos y snapshotsSQL controlados. El antiguo inputV1 quantity:'1.000000000' se conserva raw409 sin efectos; capturas nuevas usan límitesV2 y snapshots2147483647 se siembran históricamente, sin ampliar parser. Precio repetido captura revisiones comerciales reales, nunca unitPrice arbitrario HTTP.

Históricos: SQL0102/0103/0105 canónico, hashes y clones privados conservados; los negativos temporales de masa dormante/tarifa cents quedan en el checkpoint de origen y los shape0108 activos se prueban por separado, incluyendo ausencia de barreras retiradas. Único DROP CONSTRAINT sigue siendo sobre cloneproductTable propio; nada se retira de core/pos reales. Todos los DDL se correrán seriales con teardown y reservaCI. IDs propios de nuevas fixtures se capturan y retiran localmente después de negocios/órdenes, con evidencia de owner/consumer/sesiones; no cambia cleanup Counter global.

Checks offline residual: ESLint14 y Prettier14 PASS. Typecheck intento1 FAIL2errores propios (find potencialmenteundefined y timezone no parte deOperatorBusiness); intento2 FAIL por firma real listPosOrders(segundoargDate); corregido para usar lector autoritativo interno y tercer intento typecheck merchant PASS. Lint privado después de mejorarcleanup tuvo3imports inArray sobrantes, retirados; siguiente privado14 PASS. No se ejecutóDB de este grupo durante la ventanaM1. Pendientes su congelado final, suites8 y suites6DDL aisladas tras devoluciónDB, y QA independiente sobre candidato congelado.

## Dependencia Stock indirecta y universo40

Antes de editar se pidió ampliación concreta; autorizada41c908e8/factory. `stock-local-integration-support.ts` era un writerV1 indirecto de stock-local y stock-local-recipes. Setup({posContract:2}) ahora captura cookie/scope del ModuleWorld real, create positivo declara comandoV2/revisión comercial consultada y close adopta scope explícito; default raw y route genérico siguen intactos. Ambos callers optan expresamente. Negativos de receta/local mantienen422location_required/404foreign y éxito201local elegido con payloadV2 explícito, sin traducir cuerpos negativos. Cleanup de ModuleWorld conserva IDs exactos y verifica users/sesiones propios sólo en opt-in.

Cierre recursivo sobre imports relativos estáticos/dinámicos de pos-integration-support, pos-payment-integration-support, business-core-support y stock-local-integration-support:40archivos de test. Se revisaron también los soportes intermedios tables-integration-support (único caller yaactualizado), retirement-integration-support (historia/domain sin writerHTTP obsoleto) y business-core (financial/failures opt-in; access sólo businessAPI). Nuevas extensiones siguen requiriendo paths concretos antes de editar.

Checks extraStock: types merchant PASS, ESLint3 PASS y Prettier3 PASS; ningunaDB durante reservaM1. Pendiente pasa a9residualesHTTP/eventos (8anteriores+stock-local-recipes) y6históricosDDL:15suites. Los18archivos/107casos yaPASS conservan fuente y compatibilidad;7consumidores noeditados quedan documentados por lectura, no se les atribuyePASS nuevo.


## Lote residual4 congelado98ffe933, primer intento

TransferenciaCI exclusiva posterior a M1 autorizada; wrapper privado serial ejecutó pos-orders, pos-best-sellers, pos-disable y pos-disable-tables sin editar fuente. EXIT1,4suites:2PASS/2FAIL,18casos:16PASS/2FAIL,0skips/retries,292.86s. PASS completos:pos-disable6 y best-sellers2; orders7/8 y tables1/2. Log privado `p6-residual4-attempt1.log`. Unknown_line conservó422 pero recibióinvalid_input; resolveExistingMeasuredLineV2 rechaza una línea sin snapshot autoritativo con esa familia actual. Se conserva el negativo y snapshot sin efectos al actualizar el oráculo. Tables primer caso agotó120s; segundo carreraPASS. La causa del timeout no está probada. Montaje nuevo espía la entrada real del registro tras cargarlo, exige latchA alcanzado y waiterB del mutex exacto del negocio, libera/esperaambos en finally; no cambia producto/locks. Repetición de sólo estos2archivos pendiente devoluciónCI.

Los cuatroafterAll terminaron sinerror y comprobaron cleanup de owners/consumers/sesiones propios según cada fixture. PIDs27995,28472,28474,28480,28483,32775 ausentes al cierre; ningún worker/launcher restante del checkout. Inspector readonly privado autorizado mediante mismo wrapper: advisory_waiters0 y actividadnoidle/tx=[]; no fixtures/DDL/barridos del inspector. Intento diagnóstico1 EXIT1 por CLI --setupFiles no soportado; intento2 con configprivada EXIT0, inspección únicamente,8tests omitidos explícitos NO sonPASS/cobertura. Logs `p6-residual4-diagnostic.log` y `p6-residual4-diagnostic-attempt2.log`. DB transferida de vuelta a M1 por coordinador; no másDB hasta reasignación.


## Cierre dirigido del inventario:46suites pertinentes

La cifra40 era el cierre recursivo de los4soportes POS/pagos/business/Stock, no exhaustividad de writersHTTP independientes. Búsqueda dirigida adicional de literales POS/Counter y imports de sus handlers, más todos los callers de module-events-integration-support, identifica6suites más. Extensión exacta7paths autorizada9b9a1122/factory antes de editar. No se amplía por cercanía a otros módulos.

| Archivo adicional | Relevancia y clasificación |
| --- | --- |
| `apps/merchant/src/modules/module-events-integration-support.ts` | Soporte independiente writerV1 demostrado; setup opt-inV2 por owner real, open positivo completo con revisiónSQL real, caller explícito; post genérico/default intacto. Captura/logIDs y verifica retiro propio |
| `apps/merchant/src/modules/module-events.neon.integration.test.ts` | Adaptado offline, DBpendiente: cierresV2→eventoV4 exacto, cantidadstring/medida, snapshots composición/comisión, stockcoste, tenant/FKs/inmutabilidad/zero contradictorio conservados; publishSaleClosedV1 interno histórico intacto |
| `apps/merchant/src/modules/analytics-covered.neon.integration.test.ts` | Adaptado offline, DBpendiente:2cierresrealesV2/V4, comisiones2/18minorunits y skipmodules/analytics exactos preservados; eventoV1 interno anterior intacto |
| `apps/merchant/src/modules/sale-publisher-v4.neon.integration.test.ts` | Adaptado offline, DBpendiente: sólo seedunit HTTPV2/revisiónreal; masa exacta sigue payload-only sin filas fabricadas. Publisher/replay/V1histórico y cleanupSQL originales conservados |
| `apps/merchant/src/server/billing-guards.neon.integration.test.ts` | Adaptado offline, DBpendiente: positivo tras guards Counter410feature_retired frente APIs200; precedencia402billing/403suspensión conservada. Identidades propias registradas/retiradas/verificadas localmente |
| `apps/merchant/src/server/permisos-mostrador.neon.integration.test.ts` | Adaptado offline, DBpendiente:5endpoints staffSINcounter403missing_permission intactos; staffCONcounter atraviesa guard y obtiene410exacto; owner/staff/consumer/sesiones propios retirados y comprobados |
| `apps/merchant/src/server/staff-entry.neon.integration.test.ts` | Adaptado offline, DBpendiente:PINtemporal403exacto, posteriorAPI200/Counter410exacto y bypassowner conservados; cleanup sóloIDsowner/staff/consumer registrados |

Consultas de cierre: `rg -l '(api/(modules/)?pos|api/counter|pos/orders)' apps/merchant/src --glob '*test.ts' --glob '*support.ts'` y `rg -n 'api/counter|from.*counter/.*/route' apps/merchant/src --glob '*.neon.integration.test.ts' --glob '*support.ts'`; luego lectura de cuerpos/imports (no mera coincidencia textual). module-events support tiene exactamente2consumidores test, ambos opt-in. No otros positivosV1 demostrados en ese cierre dirigido.

Fuera de las46, coincidencias compatibles por lectura: business-status prueba requireOperator directo, counter-email-gate prueba guard/estructura, counter-redeem-races usa dominio (ruta sólo comentario), counter-coupon-support y coupon-cycle-support usan grantAccrual interno. No se reescribe historia/SQL/dominio Counter. Unit/UItests POS/retirement y boundaries encontrados por literales ya prueban contratos actuales o estructura; sin nuevos writersHTTPV1 demostrados. Los7compatibles del grafo original conservan clasificación por lectura, sin atribuirlesPASSDB nuevo.

Estado observable:20suites completas/115casos compatiblesPASSpor cortes (18/107anteriores +pos-disable6 +best-sellers2),2suites parciales con fallos preservados (orders7/8,tables1/2).19suites pendientes de DB sobre fuente final (incluidas esas2corregidas),7compatibles por lectura. Esto no es verifyglobal niQAfinal. Nuevos7checks: typecheck1FAIL por unionSaleClosedV1-3 obsoleta; unionmeasured corregida y typecheck2PASS; cleanup añadido y typecheck3PASS. ESLint7,Prettier8(incluyehandoff) y diff whitespacePASS al congelar. NoDB durante reservaM1.

# 0242 P6A — handoff de regresión HTTP


## Corrección de entrega aún no aceptada: cleanup pos-access

La entrega a8a0795e fue rechazada por fixturecleanup real después de QA combinada en a414:11/11casos funcionalesPASS,129.27s,0skips/retries ytypecheckPASS (informe `aafd55944718f3b22fd015509ae348ee41ac0270`). QA confirmó2owners/2sessions/1consumer propios retenidos por afterAllpos-access; QA ejecutó el retiro de esosIDs exactos con autorización del coordinador y comprobóinspector0/PIDs0; no lo ejecutó el coordinador. ElPASSfuncional sigue compatible, pero no se declara entregaaceptada ni cleanup originalPASS.

Corrección local sólo pos-access+håndoff: consumerId registrado inmediatamente al retornar scannedCustomer; owners desdea/b.seed.userId ystaff desdeextraUsers, capturados antes de dropPosWorld. Tras retirar ambos negocios se eliminan únicamente esos consumer/userIDs y se comprueba SELECT0consumer/users/sessions. Registro privado de IDs alcrear/retirar; setup parcial sólo procesa mundos retornados y listas no vacías, sin inferencia/barridoporpatrones. Seis cuerpos/casos/negativos/guards/scopes/latencias/polls intactos; ningún helperexportado/global/producto/pathnuevo. Retestpos-access6 autorizado tras QAlectura: intento1EXIT1infra antes de Vitest/0casos; inspectorrecuperación autorizado0; intento2PASS6/6,0skips/retries,52.81s sobre619956dd. afterAll integrado ySELECTdurable0 propios probados. Checks offline: typecheckmerchant PASS, ESLint1 PASS, Prettier2 PASS y diff whitespace PASS. La matriz39/197 conserva evidenciafuncional y el cleanup corregido de pos-access ya tiene retest focal/inspector0; sigue pendiente aceptación del coordinador.

## Estado actual para entrega

Código congelado y último corte validado: `619956ddd3f9004871f33a67d04b2d6135b07655`. Esta actualización sólo modifica el handoff. Base `01445a86bdec433e8d7bc75b94dfca1ce8184c19`, WT/ref `pos-ui-card-0242`;45paths propios =39suites+5soportes+este informe. Sin cambios de producto/guards/tooling/esquema/migraciones.

Inventario dirigido46: **39suites completas/197casos distintos PASS compatibles por cortes +7suites compatibles por lectura**. Tras el rechazo descrito arriba, pos-access6 fue retestado ysu cleanup integrado comprobado; no quedan suites asignadas pendientes ni se repitieron39/11. No equivale a corrida global/exhaustividad de toda la app ni a QAfinal. Las7sinPASS nuevo son business-access,business-sales-units,console-native,legacy-cutover,pos-context-native,pos-scope,pos-staff-entry (todas `modules/pos/server`); motivo por archivo en matriz. LosPASSreutilizados conservan fuente compatible; no se repitieron37/189 por ceremonia.

| Últimos gates | Resultado |
| --- | --- |
| pos-access sobre619956dd, selección focal | EXIT0,6/6casos,0skips/retries,52.81s; afterAll integrado ySELECTdurable0roots/memberships/users/sessions/consumer propios |
| unit-expand-compat sobre d67e3181, selección aislada | EXIT0,6/6casos,0skips/retries,53.18s |
| pos-migration-0079 sobre d67e3181, OTRA selección aislada posterior | EXIT0,2/2casos,0skips/retries,20.28s |
| Cierre vigente pos-access619 | afterAll/SELECTdurable0roots2/users6/consumer1 propios ysesiones/memberships0; PIDs41752/42233/42236/42243ausentes; inspectorfinal0advisorywaiters yactividadnoidle/tx=[] |

Invocaciones sólo `NEON_TEST_ENV_FILE=/private/tmp/checkpass-pos-0242/private/ci.env tools/neon-test.sh src/modules/pos/server/<suite>.neon.integration.test.ts --no-file-parallelism`, en Node24.20.0/Vitest4.0.18. Logs privados `p6-unit-expand-attempt2.log`, `p6-unit-expand-attempt2-inspector.log`, `p6-ddl-migration0079-attempt1.log`, `p6-final-inspector.log`. Los8omitidos de cada inspector son harness diagnóstico, NO casosPASS. DDL serial sin otros writers; hashes/SQLoriginal/clones propios y rollback0079 conservados, ningún DROP0108real. Fuente permaneció congelada hasta cerrar DB.

DB CI liberable comunicada al coordinador; ningún proceso/servidor/browser/escritura pendiente ni másDB tras inspectorfinal. Coordinador hará factorydeliver/QAfinal/integración; autor no operó factory ni estados/índices/push/PROD. Tipos/lint/formato/diff pertinentes PASS por cortes; último código619956dd tiene typecheckmerchant,ESLint1,Prettier2 y diffPASS. Se validará esta edición documental con formato/diff.

Se conservan todos losFAILs:dinero1;DDLcarreraabortada;residual4;Stock intentos ytimeouts30s;module-events3FAIL+afterAll40P01;unitDDL5/2codeFAIL. Cada corrección/retest y cleanup adicional están ligados a suSHA abajo. Límite real todavía declarado: dinero1 y business-failuresabortado no conservaron todos los IDs históricos de raíces/identidades; no se afirma cero para esos residuos ni se hizo barrido por patrón. El40P01 posterior sí tuvo ownership capturado, cleanup autorizado exacto y SELECTpostcommit0. closeWithCash sigue limitado a fixtures unit/legacy; COP nuevo usa pago/oráculo explícitos, masa no se certifica con Number/centavos.

Las secciones siguientes conservan estrategia, matriz y registro histórico de cada intento; esta cabecera resume el estado final.

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

39 consumidores directos únicos de ambos soportes: seis iniciales +33 fuera del corte inicial. El cierre recursivo posterior descubre40, agregando stock-local-recipes vía stock-local-integration-support;39 nunca fue el universo indirecto completo. Primer inventario histórico:18suites/107casosPASS,15pendientes y7porlectura. El cierre dirigido final incorpora6writersHTTP independientes y queda46=39PASS+7porlectura, como resume la cabecera. “Compatible por lectura” no significa PASS ejecutado.

| Archivo real | Tratamiento |
| --- | --- |
| `apps/merchant/src/modules/analytics-an3-events.neon.integration.test.ts` | PASS DB7/7 en50e02098, fuente idéntica compatible |
| `apps/merchant/src/modules/brand-fiscal-inert.neon.integration.test.ts` | PASS DB1/1 en5d095652, fuente compatible |
| `apps/merchant/src/modules/negocio-retirement.neon.integration.test.ts` | PASS DB5/5 en5d095652, fuente compatible |
| `apps/merchant/src/modules/pos/server/business-access.neon.integration.test.ts` | Compatible por lectura: usa sólo seed/módulo o caller nativo/raw de cutover explícito; no cambiar por el soporte |
| `apps/merchant/src/modules/pos/server/business-failures.neon.integration.test.ts` | PASS DB compatible por corte660add97/25bc5a27/d9d0b8bd; ver resultados y límites abajo |
| `apps/merchant/src/modules/pos/server/business-financial.neon.integration.test.ts` | PASS DB compatible por corte660add97/25bc5a27/d9d0b8bd; ver resultados y límites abajo |
| `apps/merchant/src/modules/pos/server/business-sales-units.neon.integration.test.ts` | Compatible por lectura: usa sólo seed/módulo o caller nativo/raw de cutover explícito; no cambiar por el soporte |
| `apps/merchant/src/modules/pos/server/catalog-measure-storage.neon.integration.test.ts` | PASS DB5/5 en469422e0, hash/clones/configuración/shapeactivo íntegros |
| `apps/merchant/src/modules/pos/server/catalog-storage-expand.neon.integration.test.ts` | PASS DB4/4 en469422e0, hash/cloneorigen/shapeactivo íntegros |
| `apps/merchant/src/modules/pos/server/close-api-v2.neon.integration.test.ts` | Corte inicial PASS DB en afe7060d |
| `apps/merchant/src/modules/pos/server/console-native.neon.integration.test.ts` | Compatible por lectura: usa sólo seed/módulo o caller nativo/raw de cutover explícito; no cambiar por el soporte |
| `apps/merchant/src/modules/pos/server/legacy-cutover.neon.integration.test.ts` | Compatible por lectura: usa sólo seed/módulo o caller nativo/raw de cutover explícito; no cambiar por el soporte |
| `apps/merchant/src/modules/pos/server/measured-create.neon.integration.test.ts` | Corte inicial PASS DB en afe7060d |
| `apps/merchant/src/modules/pos/server/measured-read.neon.integration.test.ts` | Corte inicial PASS DB en afe7060d |
| `apps/merchant/src/modules/pos/server/measured-summary.neon.integration.test.ts` | PASS DB compatible por corte660add97/25bc5a27/d9d0b8bd; ver resultados y límites abajo |
| `apps/merchant/src/modules/pos/server/measured-update.neon.integration.test.ts` | Corte inicial PASS DB en afe7060d |
| `apps/merchant/src/modules/pos/server/order-intent-storage.neon.integration.test.ts` | PASS DB4/4 en469422e0, histórico/backfill/tenant/fingerprint íntegros |
| `apps/merchant/src/modules/pos/server/payment-methods.neon.integration.test.ts` | Ampliación5 PASS DB en afe7060d |
| `apps/merchant/src/modules/pos/server/pos-access.neon.integration.test.ts` | PASS funcional6/6 enafe7060d compatible; cleanup corregido619956dd yretet6/6PASS52.81s,SELECTdurable0roots/memberships/users/sessions/consumer |
| `apps/merchant/src/modules/pos/server/pos-best-sellers.neon.integration.test.ts` | PASS DB2/2 en98ffe933, fuente compatible |
| `apps/merchant/src/modules/pos/server/pos-close-races.neon.integration.test.ts` | PASS DB compatible por corte660add97/25bc5a27/d9d0b8bd; ver resultados y límites abajo |
| `apps/merchant/src/modules/pos/server/pos-close-reuse.neon.integration.test.ts` | PASS DB compatible por corte660add97/25bc5a27/d9d0b8bd; ver resultados y límites abajo |
| `apps/merchant/src/modules/pos/server/pos-close.neon.integration.test.ts` | PASS DB compatible por corte660add97/25bc5a27/d9d0b8bd; ver resultados y límites abajo |
| `apps/merchant/src/modules/pos/server/pos-context-native.neon.integration.test.ts` | Compatible por lectura: usa sólo seed/módulo o caller nativo/raw de cutover explícito; no cambiar por el soporte |
| `apps/merchant/src/modules/pos/server/pos-disable-tables.neon.integration.test.ts` | PASS retest DB2/2 en5d095652; dos direcciones con contención exacta/finally |
| `apps/merchant/src/modules/pos/server/pos-disable.neon.integration.test.ts` | PASS DB6/6 en98ffe933 incluidas carreras, fuente compatible |
| `apps/merchant/src/modules/pos/server/pos-ladder.neon.integration.test.ts` | Ampliación5 PASS DB en afe7060d |
| `apps/merchant/src/modules/pos/server/pos-migration-0079.neon.integration.test.ts` | PASS DB2/2 en d67e3181; transacciónDDL original/rollback,historia/IDs/FKs íntegros |
| `apps/merchant/src/modules/pos/server/pos-orders.neon.integration.test.ts` | PASS retest DB8/8 en5d095652; invalid_input422 y snapshot sin efectos |
| `apps/merchant/src/modules/pos/server/pos-scope.neon.integration.test.ts` | Compatible por lectura: usa sólo seed/módulo o caller nativo/raw de cutover explícito; no cambiar por el soporte |
| `apps/merchant/src/modules/pos/server/pos-staff-entry.neon.integration.test.ts` | Compatible por lectura: usa sólo seed/módulo o caller nativo/raw de cutover explícito; no cambiar por el soporte |
| `apps/merchant/src/modules/pos/server/quantity-storage-expand.neon.integration.test.ts` | PASS DB3/3 en469422e0, SQL/IDs/snapshots/constraints de origen íntegros |
| `apps/merchant/src/modules/pos/server/read-api-v2.neon.integration.test.ts` | Corte inicial PASS DB en afe7060d |
| `apps/merchant/src/modules/pos/server/settlement.neon.integration.test.ts` | PASS DB compatible por corte660add97/25bc5a27/d9d0b8bd; ver resultados y límites abajo |
| `apps/merchant/src/modules/pos/server/ticket-settings.neon.integration.test.ts` | Ampliación5 PASS DB en afe7060d |
| `apps/merchant/src/modules/pos/server/unit-expand-compat.neon.integration.test.ts` | PASS DB6/6 en d67e3181; cuerposV2exactos,rollback/header/version/noefectos y replay íntegros |
| `apps/merchant/src/modules/pos/server/void-api-v2.neon.integration.test.ts` | Corte inicial PASS DB en afe7060d |
| `apps/merchant/src/modules/stock-local-recipes.neon.integration.test.ts` | PASS DB2/2 en5d095652, fuente compatible |
| `apps/merchant/src/modules/stock-local.neon.integration.test.ts` | PASS DB4/4 en5f424040; V4/snapshots/consumo/recovery/replay y ownership íntegros |
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

## Pendiente en el corte0de105f0 (registro histórico)

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
| `apps/merchant/src/modules/module-events.neon.integration.test.ts` | PASS DB5/5 en469422e0; cierresV2→eventoV4 exacto, cantidadstring/medida, snapshots composición/comisión, stockcoste, tenant/FKs/inmutabilidad/zero contradictorio conservados; publishSaleClosedV1 interno histórico intacto |
| `apps/merchant/src/modules/analytics-covered.neon.integration.test.ts` | PASS DB2/2 en5f424040;2cierresrealesV2/V4, comisiones2/18minorunits y skipmodules/analytics exactos preservados; eventoV1 interno anterior intacto |
| `apps/merchant/src/modules/sale-publisher-v4.neon.integration.test.ts` | PASS DB6/6 en5f424040; sólo seedunit HTTPV2/revisiónreal; masa exacta sigue payload-only sin filas fabricadas. Publisher/replay/V1histórico y cleanupSQL originales conservados |
| `apps/merchant/src/server/billing-guards.neon.integration.test.ts` | PASS DB4/4 en5f424040; positivo tras guards Counter410feature_retired frente APIs200; precedencia402billing/403suspensión conservada. Identidades propias registradas/retiradas/verificadas localmente |
| `apps/merchant/src/server/permisos-mostrador.neon.integration.test.ts` | PASS DB10/10 en5f424040;5endpoints staffSINcounter403missing_permission intactos; staffCONcounter atraviesa guard y obtiene410exacto; owner/staff/consumer/sesiones propios retirados y comprobados |
| `apps/merchant/src/server/staff-entry.neon.integration.test.ts` | PASS DB2/2 en5f424040;PINtemporal403exacto, posteriorAPI200/Counter410exacto y bypassowner conservados; cleanup sóloIDsowner/staff/consumer registrados |

Consultas de cierre: `rg -l '(api/(modules/)?pos|api/counter|pos/orders)' apps/merchant/src --glob '*test.ts' --glob '*support.ts'` y `rg -n 'api/counter|from.*counter/.*/route' apps/merchant/src --glob '*.neon.integration.test.ts' --glob '*support.ts'`; luego lectura de cuerpos/imports (no mera coincidencia textual). module-events support tiene exactamente2consumidores test, ambos opt-in. No otros positivosV1 demostrados en ese cierre dirigido.

Fuera de las46, coincidencias compatibles por lectura: business-status prueba requireOperator directo, counter-email-gate prueba guard/estructura, counter-redeem-races usa dominio (ruta sólo comentario), counter-coupon-support y coupon-cycle-support usan grantAccrual interno. No se reescribe historia/SQL/dominio Counter. Unit/UItests POS/retirement y boundaries encontrados por literales ya prueban contratos actuales o estructura; sin nuevos writersHTTPV1 demostrados. Los7compatibles del grafo original conservan clasificación por lectura, sin atribuirlesPASSDB nuevo.

Estado observable:20suites completas/115casos compatiblesPASSpor cortes (18/107anteriores +pos-disable6 +best-sellers2),2suites parciales con fallos preservados (orders7/8,tables1/2).19suites pendientes de DB sobre fuente final (incluidas esas2corregidas),7compatibles por lectura. Esto no es verifyglobal niQAfinal. Nuevos7checks: typecheck1FAIL por unionSaleClosedV1-3 obsoleta; unionmeasured corregida y typecheck2PASS; cleanup añadido y typecheck3PASS. ESLint7,Prettier8(incluyehandoff) y diff whitespacePASS al congelar. NoDB durante reservaM1.


## Retest2 y residual5 sobre5d095652

Retest corregidos pos-orders8/8 +pos-disable-tables2/2:EXIT0,10/10casos,2/2suites,0skips/retries,85.74s. Ambas direcciones de carrera demostraron latchA y waiterB del mutex propio exacto; afterAll íntegros. PIDs66715,67192,67194,67201ausentes e inspectorreadonly0waiters/actividadtx=[] antes de siguiente lote. Log `p6-residual2-attempt2.log`; inspección `p6-residual2-diagnostic.log` no añade cobertura (8omitidos diagnósticos).

Luego lista5confirmada contra inventario, mismoSHA limpio sin editar durante corrida: stock-local,stock-local-recipes,analytics-an3-events,brand-fiscal-inert,negocio-retirement. EXIT1,3/5suitesPASS,12/19casosPASS,7FAIL,0skips/retries,261.64s. PASS completos recipes2,brand1,retirement5. AN3 4/7; Stock0/4. TodosafterAll completos sinerror, identidadown comprobada por fixtures; PIDs69830,70307,70309,70316ausentes al cierre. Inspectorreadonly posterior:waiters0/actividadtx=[];8omitidos no sonPASS. Logs `p6-residual5-attempt1.log`, `p6-residual5-diagnostic.log`. SQL23505 en AN3void es la inyección real de duplicado fuente con respuesta503 y rollbackopen comprobados; no es el fallo del caso.

| Caso fallido | Esperado/observado en intento1 y corrección offline |
| --- | --- |
| AN3voidhistorial | GETrawV1esperaba200, recibió409; callerV2 local explícito conserva status=voided, cookie/scope de cada owner, histórico2días y aislamiento |
| AN3COP | Esperaba close200, recibió422; helpercentavos operaba total ya normalizadoCOP10 antes de restar0.60. Comando explícito payment10, originales exactos1040−60=980centavos=9.80 y normalizaciónCOP10 comprobados sin Number/helper |
| AN3campaign | Consulta day=today no encontraba fila; persistencia actual ancla candidato a period.to=finishday. Consulta subject exacto mantiene readyday=today,assertdayfin e identidad estable del candidato/edición/replay |
| Stockatomic | Esperaba eventV2, recibióV4. OráculoV4/cantidadstring/medida exacta; inyección ahora sobre capturedMeasuredConsumption real, conservando rollback, fallo, revisión congelada y replay |
| Stockrecovery | Spy legacycapturedConsumption no recibía llamadas del adapterV4; spymeasured corrige el punto real. Conserva cierre/mesalibre/evento/deliveryfallida/borradoproducto y recoverycapturadounico; restore spy/local/producto en finally |
| Stockdisabled | create409location_archived, cascada del assertanterior que salía antes de restaurar local; finally del caso2 elimina esa dependencia. Caso3 conserva skipterminal y composiciónvacía, restaurarecipes en finally |
| Stockwithpass | Esperaba applied1, recibió2. Oráculo ahora exige ambos IDs(core.analytics,recipes), estadosapplied exactos, eventoV4 del negocio/orden/línea reales, replay0applied/0claimed y payloadigual. Consumo−750gúnico/acreditación siguen intactos; ningún ajuste global de conteos |

Las correcciones sólo tocan AN3/Stock y handoff; ninguna modificación de producto/soportes/guardas/esquema. Primera typecheckmerchant de correcciónPASS. SuitesPASScompatibles acumuladas25/133casos completos (22/125 tras retest2 +3/8nuevas), sin sumar parcialesAN3. Quedan14suites por DB:afectadas2 +nuevas6eventos/Counter +6históricasDDL;7compatiblesporlectura. DB devuelta a M1 porfactory; no nuevaDB hasta reasignación. Todos los intentos anteriores siguen conservados.

Checks del congelado AN3/Stock: typecheckmerchant inicial y final PASS, ESLint2 PASS, Prettier3 PASS y diff whitespace PASS. Sólo3paths propios cambiados. Sin corridas DB sobre esta corrección todavía.


## Afectadas2 intento2 en50e02098 y diagnóstico Stock pendiente

WrapperCI exclusivo, sin editar fuente:EXIT1,1/2suitesPASS,8/11casosPASS,3FAIL,0skips/retries,244.02s. AN3PASS7/7(126.56s) con historialtenant,COPoriginalesexactos y candidatefinishday probados; fuente AN3 queda idéntica/compatible, no repetir por el siguiente arreglo Stock. Stock1/4: recoverymeasured/productoborradoPASS22.65s; atomic y disabled-empty timeout30s; customer-pass llegó a ambos suscriptoresapplied/replay0 pero igualdad posterior tomó otro evento del mismo sourceId. Log `p6-an3-stock-attempt2.log`. No se ejecutaron las6nuevas: gate de ambasPASS no satisfecho.

El diff observado en customer-pass muestra payload stock(consumption)eventV2 en lugar de sale.closedV4 después de aplicar recipe; eventOf sólo filtraba business/sourceId. Fix precisa eventType=sale.closed, alineado con la clave única canónica negocio/tipo/fuente, sin ORDER BY arbitrario ni cambiar productor. Sus dos consumidores son Stock/Stockrecipes; sólo Stock utiliza eventOf, raw/default/callers restantes intactos.

Timeouts: sin fase registrada en50e02098, causa aún no demostrada. Se conserva30s para el siguiente intento diagnóstico; se añaden fases/elapsed por operación y IDs propios correlacionados privados. Cada callback async se registra y afterEach lo espera antes de restaurar mocks/seguir; afterAll también espera cualquier pendiente antes de retirar raíces. Así un timeout Vitest no deja el callback mutando fixtures del siguiente caso. No se amplían poll/retry/budgets ni se cambia dinero/consumo/cantidad/estado esperado. Todos los invariantes y finalmente del corte anterior siguen presentes.

Teardown del intento terminado:afterAll sinerror/assertions ownvacías; PIDs4093,4578,4580,4587ausentes. Inspectorreadonly `p6-an3-stock-attempt2-diagnostic.log`:waiters0,actividadtx=[];8testsomitidos diagnósticos no sonPASS. Fuente permaneciólimpia50e02098 hasta cierre; ninguna6nueva/DDL ni másDB tras transferir a M1R1.3. Compatibles completos26suites/140casos(25/133+AN3/7), sin sumar Stockparcial. Pendientes13suites:Stock1+nuevas6+históricas6;7compatiblesporlectura.

Checks congelado diagnóstico Stock: typecheckmerchant inicial/final PASS, ESLint2 PASS, Prettier3 PASS y diff whitespace PASS. Sin DB sobre nueva fuente; el siguiente resultado con30s seguirá siendo intento diagnóstico, no aprobación por relajación.


## Corrección lifecycle tras QA10482e3d, sin DB

QA detectó que el único pendingCase podía sobrescribirse si afterEach agotaba120s mientras el callback seguía vivo. El siguiente trackedCase ahora rechaza empezar antes de cambiar nombre/mocks o ejecutar cuerpo mientras exista ownerpendiente. Una colección ownedCases retiene todas las promesas propias; cada hook espera todas antes de restaurar mocks y afterAll antes de retirar raíces. El hook captura su identidad al entrar y sólo borra/restaura si sigue siendo ese owner; un hook tardío no puede limpiar un caso posterior. El callback arranca en microtask después de registrar su owner. Rechazo original se vuelve a await en afterEach y el guard falla explícitamente: no se convierte timeout/rechazo enPASS ni se oculta el fallo del hook.

Se mantienen30s de los4casos,120s hookdefault,180s teardown; sin nuevos retries/polls ni causa atribuida a los timeouts. eventOf sale.closed exacto y todas las aserciones previas intactos. Únicamente Stocktest/handoff cambiados; ninguna DB durante reservaM1.

Checks lifecycle: typecheckmerchant PASS, ESLint1 PASS, Prettier2 PASS y diff whitespace PASS. Ningún testDB/reintento ejecutado sobre esta revisión.


## Stock diagnóstico3 sobre5c81063c con30s conservados

Selección sólo stock-local, wrapperCI privado serial:EXIT1,1suiteFAIL,2/4casosPASS,2timeouts30s,0skips/retries,118.88s. Archivo congelado y limpio antes/durante/cierre. RecoveryPASS21.819s; customer-passPASS26.655s con ambos subscribersapplied, replay0claimed/applied y payloadsale.closedidéntico. No nuevas6 porque gate de suitePASS no satisfecho; AN3compatible no se repitió. Logprivado `p6-stock-diagnostic-attempt3.log`.

Atomic callback liquidó en32.455s y disabled-empty en30.634s, ambos con todas sus fases/assertions y finalmente terminados sin rechazo posterior; los2timeouts Vitest siguenFAIL. afterEach esperó owner antes de pasar al siguiente caso, sin sobrescribirpromesas ni restaurar mocks mientras trabajaban. No hubo hookFAIL ni callbackreject adicional. Evidencia por operación:

| Caso | Fases medidas (s) |
| --- | --- |
| atomic | put4.286;pointer0.355/resolution0.349/revision0.122;create2.263;close5.039;event0.123;expire0.127;drainfault4.967;put3.512;movements0.352;expire0.120;recoverydrains concurrentes0.808/3.782;replayclose2.963;nuevokeyclose2.565;drain0.459;lecturas0.185/0.122;restauración incluida total32.455 |
| disabled-empty | put4.599;create2.742;close4.694;event0.125;drain4.458;movements0.343;create2.281;close4.773;event0.124;drain3.054;movements0.121;queries/restauración incluidas total30.634 |

Los límites se superaron por duración acumulada de operaciones reales observadas en este intento, sin operación única detenida ni assertion distinta observada; no se extrapola ausencia de bloqueo a otro intento. No se alteró presupuesto antes de medir. Propuesta al coordinador:45s sólo para estos2casos, resto30s/polls/retry inalterados, en nueva fuente antes de futuro retest. Coordinador autorizó45s únicamente para atomic/disabled-empty tras revisar esta evidencia; resto30s/polls/retry/producto/M1 intactos. Retest espera QA de lectura del nuevo congelado.

Frontera final:afterAll completo y ownidentitiesvacías por assertions; PIDs59239,59721,59723,59730ausentes. Inspectorreadonly `p6-stock-diagnostic-attempt3-inspector.log` waiters0/actividadtx=[];8omitidos diagnósticos NO sonPASS. Ningún proceso/escritura pendiente. DB disponible al coordinador, sin corridas adicionales tras esta inspección. La cifra26suites/140casos completos sigue igual; Stock2parciales no se suman como suitePASS.

Congelado de presupuesto45s: diff de test sólo2valores30→45 y comentarios de motivo. Typecheckmerchant PASS, ESLint1 PASS, Prettier2 PASS y diff whitespace PASS. No DB sobre esta revisión; espera QAlectura/GO explícito antes de Stock4 y cualquier nueva6.


## Stock4 y nuevas6 sobre5f424040

Stock4 EXIT0:1/1suite,4/4casosPASS,0skips/retries,121.67s. Atomic32.630s,recovery22.317s,disabled-empty31.050s,customer-pass28.018s, todosasserts y cleanup propios observados. PIDs74017,74497,74499,74506ausentes; inspectorreadonly0waiters/actividadtx=[]; log `p6-stock-attempt4.log`/`p6-stock-attempt4-inspector.log`. Precisión de evidencia previa: máximo5.039s por operación corresponde únicamente a los2casos ajustados; customer-pass tuvo una fase6.713s en diagnóstico3. No se atribuye ese máximo al archivo completo.

Gate satisfecho, se ejecutó selección exacta nuevas6 sobre MISMO5f limpio:EXIT1,5/6suitesPASS,26/29casosPASS,3FAIL,0skips/retries,166.78s. PASS completos:sale-publisher-v4 6,billing-guards4,staff-entry2,analytics-covered2,permisos-mostrador10. Module-events2/5 y afterAllFAIL40P01 (deadlock cascade module_event_delivery), sin presentarlo como cierreverde. Log `p6-new6-attempt1.log`. NoDDL/AN3 ni otras selecciones. Evidencia completa32suites/168casosPASS compatibles; quedan module-events1+históricas6(7suites),7compatiblesporlectura. No sumar los2parciales module-events como suitePASS.

Fallos module-events:selector eventOf sólo negocio/sourceId devolvió eventoV1 en vez de sale.closedV4, y contradictoryzero leyó el mismo payloadambiguo. Selector ahora fija exactamente sale.closed/negocio/sourceId, sin orden artificial. Legacycost esperado3.50 recibió1.50: primer caso debía cambiar coste3→7 al final, pero fallóantes. El propio legacyfixture fija explícitamente7 y restaura valorprevio en finally, conservando0.250g×2=0.500g,3.50, base/revisión capturada, ausencia de comisiónV1 y snapshot inmutable12 del casoV4. Ningún oráculo bajado a1.50.

Deadlockteardown: la fuente muestra otros cierres del casozero con aceleración fallback propia sin espera antes de retirar raíz. El40P01 fue observado; no se capturó una correlación runtime suficiente para asignar el backend1311 a una operación concreta. Se corrige esa carrera posible del montaje sin afirmar causa única probada. Correcciónlocal: cada caso controla aceleración del fixture mediante el spyexistente, forceddrain sigue siendo retryreal; soporte opt-in retiene promises reales retry/drain y espera quiescencia antes de mocks/caso siguiente/raíces. Callbackproducto/locks permanecen intactos. Los5archivosPASS no cambian; analytics-covered comparte soporte, pero no llama eventOf y sus callers/DTO/métodos siguen iguales. Default/raw del soporte intactos.

### Cierre adicional acotado tras afterAll40P01

PIDs77564,78041,78043,78050ausentes. Inspectorpreflight0waiters/actividadtx=[];2roots retenidos por rollbackdeldelete:4d872c38-acfe-41fb-93fa-2134a7eb4356 y42c81a73-6718-4144-8eae-eefa0dcd9e49. Se registraron4posOrders,9eventos,13deliveries y3sessionIDs exactos en privado antes de borrar. Ownersmodules-int-5c029e6d-f3fc-47be-aa28-fbccfb2e7db2 ymodules-int-3ba8a467-f9f0-4107-ae59-0a3400c2f054 coinciden con logssetup. Staffcounter-int-dcf5240c-8ea0-4647-befa-b16c546220fe probado por creaciónfixture, además de pertenencia: único moduleStaff(world,[business]),timestamp posterior de ese caso,nombre/email/handle/PINsentinel coincidentes con seedMember,rolstaff/permisobusiness ymembershipúnica. Nada inferido de patrón para barrer.

Cleanupadicional autorizado explícitamente por coordinador mediante mismo wrapper:preflight0actors/0waiters;commit eliminó exactamente2roots y3users de esosIDs. SELECTpostcommitdurable0:business,business_membership,posOrders4,eventos9,deliveries13,users3,sessions3;final0actors/0waiters. Log `p6-new6-exact-cleanup.log`; ownershiphijos/identidades `p6-new6-ownership-attempt2.log`. Intentoownership1 EXIT1 por tabla privateinspector mal escrita core.pos_order; corregida a pos.pos_order y logconservado `p6-new6-ownership.log`. Losinspector/cleanup usan8omitidos de harness explícitos NOcertificados comoPASS. AfterAll40P01original sigueFAIL pese a limpieza posterior exitosa. Frontera limpia comunicada antes de continuar offline; noDBsobre nuevofix todavía.

Checks fix module-events: typecheckmerchant inicial/final PASS, ESLint2 PASS, Prettier3 PASS y diff whitespace PASS. Trespaths propios; ningúnDB/retry sobre la revisión nueva. Próximo gate:QAlectura y module-events5 focal antes de históricosDDL6 separados.


## Module-events5 y DDL1–5 sobre469422e0

Module-events focal EXIT0,5/5casos,0skips/retries,71.73s; snapshotV4/coste12,legacy0.5×7=3.50,zero/tenant/schema/contradictoryzeroPASS. afterAllsin40P01; ownedretrySet aguardado y cleanup comprobado además en inspector por2roots/3usersregistrados business0/users0/sessions0,0waiters/actividadtx=[]. PIDs94544,95025,95027,95035ausentes. Logs `p6-module-events-attempt2.log` y `p6-module-events-attempt2-inspector.log`;8omitidos deinspección no añadenPASS.

Gatecumplido, cinco invocaciones DDL AISLADAS/seriales, una suite por wrapper, mismoSHA limpio sin cambiar código:

| Suite | Resultado y duración |
| --- | --- |
| catalog-storage-expand | EXIT0,4/4casos,18.76s |
| quantity-storage-expand | EXIT0,3/3casos,23.07s |
| catalog-measure-storage | EXIT0,5/5casos,28.88s |
| order-intent-storage | EXIT0,4/4casos,24.58s |
| unit-expand-compat | EXIT1,4/6casosPASS,2codeFAIL,46.04s |

0skips/retries en todas. SQL/hashes/clones/shapeactivo/constraints de origen preservados; nadaDROP0108real. Logs privados `p6-ddl-{catalog-storage,quantity-storage,catalog-measure,order-intent,unit-expand}-attempt1.log`. Grupo detenido alFAIL5, pos-migration-0079NOejecutado. afterAllunit confirmóbusiness/owner/sessions/consumersvacíos; launchers/workers propios ausentes; inspector0waiters/actividadtx=[] (`p6-ddl-unit-expand-attempt1-inspector.log`). Sin másDB tras cierre.

Unit casosfallidos: createoverflow de línea/aggregate yupdateoverflow de cantidadexistente/líneanueva esperabaninvalid_amount, recibieronamount_out_of_range, ambos422. Contrato actual trazado por lectura:assertMoneyRange emiteMeasureErroramount_out_of_range; captureNewMeasuredLines ythrowMeasuredUpdateError conservanerror.code y textoexacto"La cantidad, medida o tarifa no es válida.". La traduccióninvalid_amount está en summarylegacy. Correcciónmínima sólo2casos:familiaV2/cuerpoexacto, snapshots/órdenes0/rollback/header/version/intentosnegativosrawV1 intactos. Producto/límites/polls no cambian. Próximo gate QAlectura→unit6focal→0079aislado; no repetir module-events niDDL1–4compatibles.

Matriz completa compatible37suites/189casos(32/168+moduleevents5+DDL4/16);unit4parciales no sumados, pendientes2suites(unit/0079),7compatiblesporlectura. Intentos anterioresFAIL/40P01/cleanupadicional se conservan.


Chequeo offline del resto del MISMOcaso create tras fallo tempranooverflow detectó2oráculosinvalid_input obsoletos no alcanzados en ese intento:quantitynumérico1 ystring"1.0000000000". Cuerpos negativos literales se conservan sinbuilder/reparación. Coordinador autorizó4oráculos del mismo path. Flujo HTTPV2 trazado completo por lectura:routes.ts POSTorders→readPosBody JSONdecoder→createPosOrderV2→parsePosCreateV2/items→parseMeasuredLineInput→measured(captureQuantity)→parseQuantity/parseInput; tipo no-string yescala>9 disparanMeasureErrorinvalid_quantity. measured-line-input convierte aCounterError422 conservando código ytexto"La cantidad o la unidad no es válida."; posRoute/posErrorResponse serializa exactamente{error,code}. No se entró transacción para esos2negativos sintácticos. Las4filas ahora declaran respuestas exactas explícitas (2range/2quantity), sin alterar status422/snapshots/noefectos. Es evidenciaoffline de contrato, NO nuevosPASSDB; próximos QA/retest deben comprobar los4negativos reales.

Checks congelado unit: typecheckmerchant inicial/final PASS, ESLint1 PASS, Prettier2 PASS y diff whitespace PASS; sólo unit-expand-compat y handoff. No DB posterior al inspector0; esperaQA/GO paraunit6y0079.


## Cierre final unit6→0079 en d67e3181

unit-expand-compat EXIT0,6/6casos,0skips/retries,53.18s:4negativoscreate con cuerpos exactos,overflowupdate completo/rollback,extremoslegacy/nota/lista y cierres/replay con/sinpase. afterAll verificóbusiness/owner/sessions/consumers0;PIDs14235,14719,14721,14728ausentes;inspector0waiters/actividadtx=[] antes de0079. Luego OTRA invocación aislada pos-migration-0079 EXIT0,2/2casos,0skips/retries,20.28s,DDL/rollbackoriginal e identidadhistórica preservados. afterAll propio completo yPIDs18186,18665,18667,18674ausentes;inspectorfinal0waiters/actividadtx=[]. Sin pendientesni procesos ni otrasDB después. Fuente permaneció limpia/congelada durante ambos gates; sólo esta actualización documental posterior.

Matrizfinal46=39suites completas/197casosPASS compatibles por cortes+7lectura. LosFAILanteriores siguen arriba como intentos, sin resets/skips/retries para fabricarPASS. DB liberable comunicada al coordinador para QAfinal/factorydeliver propio; no aprobaciónfinal autodeclarada.


## Cierre corrección pos-access en619956dd, misma entrega

Intento1 autorizado de pos-access terminóEXIT1 en db:migrate del wrapper con Neon"Connection terminated unexpectedly", ANTES de Vitest/fixtures;0casos ejecutados yningúnIDfixturecreado. Se detuvo sin retry/inspector automático; log `p6-pos-access-cleanup-attempt1.log` conservado. Recuperación acotada autorizada por coordinador:UNinspectorreadonly vía wrapper confirmó configCIhashintacto,journal0108hashcanónico,8/8shapechecks activos/0legacychecks,0waiters/actividadtx=[] yausencia de procesos propios. Log `p6-pos-access-infra-inspector.log`;8omitidos diagnósticos NOcasosPASS.

Sólo entonces se autorizó/ejecutó intento2 como intento NUEVO explícito, mismafuente619956ddd3f9004871f33a67d04b2d6135b07655 congelada,mismaCIseleccionada ywrapper serial:EXIT0,6/6casosPASS,0skips/retries,52.81s. Seis negativos/guards/cuerpos ylatencias/polls preservados. afterAll integrado capturó2roots/6users(2owners+4extraUsers)/1consumer porIDs propios; después de dropambos negocios retiróidentidades ycomprobóusers/sessions/consumer0. Log `p6-pos-access-cleanup-attempt2.log` con IDs alcrear/retirar.

PIDs41752,42233,42236,42243ausentes; inspectorfinalreadonlydurablepor esosIDs exactos confirma roots0,memberships0,users0,sessions0,consumers0,0waiters/actividadtx=[] yconfig/hash0108intactos. Log `p6-pos-access-final-inspector.log`;8omitidos harness no sonPASS. DB liberable comunicada al coordinador; ningún proceso/servidor/browser/escritura pendiente, sin másDB después. Atribuciónprecisa del incidente anterior combinadoa414:QA ejecutó cleanup adicional con autorización del coordinador, no lo ejecutó el coordinador. Rechazo a8 eintentoinfra1 siguen registrados como fallos, sin convertirlos enPASS.

Matriz46=39suites/197casos distintosPASScompatibles+7lectura sigueigual:estos6son retest de casosya contados. Código619956dd tiene tsc/lint/formatoPASSprevios; este cierre sólo cambiahandoff después de cerrarDB, formato/diffdocumentalPASS. Sinfactorydeliver/estados/índices/push/PROD; coordinador conserva aceptación/QAfinal.


Comando exacto del intento2 sobre fuente619 (desde WT asignado, selecciónCIprotegida sin credenciales impresas):

```sh
source ~/.nvm/nvm.sh && nvm use && NEON_TEST_ENV_FILE=/private/tmp/checkpass-pos-0242/private/ci.env tools/neon-test.sh src/modules/pos/server/pos-access.neon.integration.test.ts --no-file-parallelism > /private/tmp/checkpass-pos-0242/private/p6-pos-access-cleanup-attempt2.log 2>&1
```

Node24.20.0 yVitest4.0.18. `git rev-parse HEAD` y `git status --short` antes del wrapper comprobaron619956ddd3f9004871f33a67d04b2d6135b07655/statusvacío; se volvió a comprobar statusvacío después del inspectorfinal, antes de editar este handoff. No se hicieron writes en el repo durante la corrida: sólo logs/setupsprivados, sin cambiarHEAD/fuentes. No hubo archivo freeze privado previo ni muestreoGit de cada fase; la comprobación retrospectiva de compatibilidad de código del commitdocumental no se presenta como snapshot histórico.

Inspección de recuperación exacta:config `p6-pos-access-infra-inspector.config.mjs`/setup `p6-pos-access-infra-inspector-setup.mjs`;inspección final:config `p6-pos-access-final-inspector.config.mjs`/setup `p6-pos-access-final-inspector-setup.mjs`;todos en `/private/tmp/checkpass-pos-0242/private/`, ejecutados exclusivamente por mismo wrappercon `--config <config>`/`--testNamePattern __P6_DIAGNOSTIC_ONLY_NO_PRODUCT_TEST__`/`--no-file-parallelism`. Categoríareadonlyharness,8omitidos en cadauno, ningún caso de productoPASS atribuido. Scripts leen únicamente metadata/hash/config ylosIDs registrados; no requieren publicar ni copiarci.env.

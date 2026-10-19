# Estado de GPT

> Lo escribe **solo GPT** (ADR 0114, `docs/TRABAJO-EN-PARALELO.md`). Es su punto de retorno: lo vigente arriba,
> reescrito entero al cerrar cada sesion. El estado de Claude esta en `claude.md`.

## ESTADO VIGENTE — QA MANUAL DEL OWNER (2026-10-19)

Actualización: owner probó la venta con empleado y confirmó que funciona correctamente. Ese caso queda aprobado; cliente+descuento e impresión siguen pendientes, sin autorización nueva de push/PROD.

Owner confirmó corregido el guardado por peso tras migración local. Resultados del QA manual y mejoras diferidas registrados en `mejoras.md`: unitarios/kg/decimales/validaciones/mezcla/cobro/importes/recarga sin duplicados y anulación de órdenes no cobradas funcionan según owner. Selector sólo kg (no pudo750g) y pérdida de filtro al volver quedan diferidos; cliente+descuento pendiente, impresión mañana, empleado pendiente. Entrada local de empleado `http://localhost:3201/acceso-equipo` verificada HTTP200, sin tocar túnel ni servidor. No declarar QA completo ni reversión de venta cobrada validada.

Owner reordenó: preparar QA real primero y corregir sus incidencias; publicación después de su aceptación y autorización explícita. Harness simplificado/replay/limpieza posteriores; R2 diferido. No reactivar agentes ni campañas. Conservar servidor3201/túnel y cambios ajenos; sin capturas/push/PROD.

Primer bloqueo manual: crear o editar producto por peso devolvía409 `pos_client_upgrade_required`; productos unitarios sí guardaban. UI/API ya transmiten `X-Catalog-Contract: 2`. Inspección de la DB LOCAL usada por merchant confirmó107 migraciones y las tres barreras `product_*_legacy_check`: faltaban0107/0108. Root ejecutó el migrador existente protegido `node --env-file=apps/merchant/.env.local packages/db/src/migrate-local.ts` bajoNode24, sin modificar código. Verificación posterior:109 migraciones, hashes del journal completos/0pendientes, barreras legacy deproducto ausentes y checks permanentes price/cost shape presentes. No pruebas ni fixtures contra DB de QA; pendiente que el owner reintente crear/editar y confirme el resultado desde su sesión. Servidor/túnel preservados, sinPROD.

## HISTÓRICO — DETENIDO POR ORDEN DEL OWNER (2026-10-19)

**NO continuar automáticamente0242, harness, QA niR2.** El owner detuvo el trabajo por tiempo/presupuesto. La autorización posterior fue exclusivamente un agente para comprobar/reproducir el replay pendiente y devolver resumen; ya finalizó. No nuevas ventas/fixtures/builds/instalaciones/servidores/pruebas sin nueva instrucción.

Puntos1–5/REGdirigida/R1listado aceptados enmainLOCAL5c158325. R2sinmuestrasválidas yMASAcompilada sinreplay, no cierreP6global. R1campaña09:43:08→10:20:12UTC (~37min), mejoraslistadoOWNER31.27%/STAFF29.77%; no certifica cobro ni todoslosflujos.

**EntornoMASA cerrado:** rootdetuvoúnicamenteNext38021/runner37978(salida natural)/43242libre, proofbudget-stop b4c6e7d2ea3a327c07e6085f57642798589262245e4f1c26767d04779a239157. Cleanup41916 terminóEXIT0/1PASS0skip14:27:52UTC; agenteconfirmó `cleanup-select0.json` SHA243cb7595ceff8cf531488561d7222d86cf426ff70ddf27790c311889d336312 verifiedtrue/44checksALL0, incluidaorden79247a3f-1540-40dc-b638-9e57de73d005/owner/sesión. ReplayNOejecutado y ahora imposible sobre esosdatoseliminados; no bugnuevo descubierto por replay. No se creóotra venta niHTTP/DBextra para comprobarlo. Cookiearchivada no implica sesiónviva.

Agentes detenidos/completed, no reactivar automáticamente. CARDpreservaWIP53líneas enmass-native.mjs (además patchprivado budget-preserved-unfinished.patch), sinintegrar/validar; no descartar. GRID6cee yQAconservados; noforce/cleanupWT. Owner3201/túnel/ajenosintactos, sinpushPROD/screenshots. ÚltimoQAdiagnóstico26d54ada/últimafuenteMASA0c590, fallo antesreplay porguardoutboxmásestrictoquecontratos, no producto demostrado. El bloque abajo es **HISTÓRICO SUPERADO**; sus órdenes de continuar/GO/servidores vivos NO están vigentes.

## HISTÓRICO — 0242: PUNTOS 1–5 ACEPTADOS; P6 REGRESIÓN Y M1 EN CURSO (2026-10-19)

El owner pide continuar automáticamente hasta completar0242, con flujo agéntico si es posible, sin capturas ni reactivar agentes históricos. UI1 aceptada26222f50: no reabrir diseño. P2 entrega4405da73; P3a63ac5b1e (scope/contract2 obligatorio, Counter5APIs410 tras guard, accesos/locales y0107); P3b30426343/0108 (invariantes permanentes y masa canónica); P4c93a8aff (retirada UI y consumidores) aceptados. Combinado funcional **a9d32924**, entrega QA **29b8592c en main LOCAL**. Native independiente masa+pase10%→create/close/receipt/history→inspect/replay/cleanup PASS,0GETpostwrite/errores; dominio3/3, focal P4 9browser+77unit compatibles. Evidencia en0242-p3b-p4-qa.md. Puntos3–5 cerrados funcionalmente en plan; **P6/M1 no completos, specs/INDEX aún sin cierre global**.

El FAIL nativo original3e292aef/1f4ca3d8 (timeout,0POSTorders/0órdenes, sinDOM) sigue preservado: no causa demostrada ni afirmar intermitencia eliminada. Incremento80a3bbb2/código4f3c5710 mejoró observabilidad; autor/QA pasaron después con identidades nuevas. NativeNextdev NO es M1.

### Vigente: MASA continuación compuesta misma venta; fix outbox OFFLINE, R2 pendiente

**Continuar automáticamente hasta completar0242**, sin capturas/push/PROD/reactivar históricosaceptados. Owner preguntó estado tras7horas: se respondió honestamente1–5/REG/R1cerrados, MASAreplay+cleanup y R2baselinecompatible/D2FUNC24/360flowsaúnpendientes; demoraexcesiva reparandoharness, no minimizartrabajorestante. Priorizarfixmínimo/QAproporcional yreusoevidencia, sin más cortesporoficio. Rootdev **5f155b82 +esteestado**, mainLOCAL **5c158325** sinavances. Conservarowner3201PID927/túnel/ajenos (.impeccable/untracked); no cambiosbranchprincipal ni force.

**Factoryactual3tasksreserved**: CARD pos-ui-card-0242 doc:p6-mass-m1+DBneon-ciEXCLUSIVA+43242; GRID pos-m1-r2-0242 doc:p6-r2ONLY; QA pos-final-qa-0242 doc:p6-r2-qaONLY. GRID **6cee9773192d16e19ab6268251692478461b1044 CLEAN/FROZEN hasta MASAfinish**, no editar. R2autor /root/p6_r2_author completedpropuestaF04, no codeGOhastaMASAfinish+rootfollowup7paths3192ec0e. QA /root/p6_r2_qa COMPLETED **26d54adabe9ee492193ccdbbf50c801fe46949c3** esperaSHAfixoutbox. **AutorMASA /root/p6_mass_m1_author ACTIVO GO OFFLINE5f155b82**, mismoNOaceptado4paths: tools/pos-measurement/mass-native.mjs,mass-native.test.mjs; apps/merchant/src/modules/pos/server/mass-native.neon.integration.test.ts; docs/factory/0242-m1-mass-handoff.md. No nuevosworkers/reviewers/subdelegación. followup_task despierta currentcompletedunaccepted; send_messageNOdespierta.

**ENUSO ahora NS `/private/tmp/checkpass-pos-0242/m1-mass-0c590e38-6cee`**. Runtime fuente **0c590e3815cbc3e750cc4c12533252517bdcc007**, recipe **b8dcf45388cf6ef86e1f60a2fa9b3a4b86c57ab732207dcc8bc1881796fdc41e**. COPYsource6cee/BID **mZNZh0AJI8OcNme9YijKr**, freeze **58df653c945b86f43f9263ba29b511542ee0a2ce32924709909302302848545a**; compiledmanifest **26960e885cfc3e88c3da60a06cca4bb3277b41590b7082cb009849ea1024e6f1**, 822compiled/3615source/7links. SourceQA **bcbb3352**, COPYQA **8e9c16a2**, proofprivate/qa-copy-0c590e38/proof.json **47a9488278400eafbff831f0ec4a688815a107ffaa7caf9e3003e813d60b45f1**. authCOPYcdadd140df6b3b11111f025e21dad6838f675797a4837ebdf3b33074a5938b10/fixture4bace88fd1f1bb88b2ce81634f8dbe74d7fe726f939f477c021dca0c896833ec/run63042b1b5dc95b225c0bb1172b004917474c124b964b2d7d39a7465079191678. Metadata415(sourceGRID)/8e8(runnerCARD) sharedstoreprofileexacto, generatedsourceNext16.3 dosimports exactos, terminalProfile exact export+QArefbcbb/f2dparity. ÚltimotscFINAL **3c0066cc48e894c015ccea3b7fceb4723a1b9678** EXIT0;0c590JSonly31unit0skip/lint/formato/diff/sourceQApassed.

Setup **36066**, loyalty **36639**, login **37196** 1PASS0skipcada/UNAvez/9rootsNUEVOSvs083, cookielegítima1 **exp2026-10-26T14:06:45Z**, OTPIP203.0.113.242bucketreal/noresetrotar. Source0c590 RUNúnico **37978**, ownNext **38021**: **AMBOSPRESERVADOS vivos**, port43242propio, browsercerrado trasquietproof; NOkill/cleanuphastaGOroot. Readiness5actualAPIbodies+DOMpostquiet2PASS/24terminalesEDITORcalificadosporperfil(sinforzar25)/effective0/0pageHTTP; create/close/receipt/history yoráculos **2.78/2points/1payment/1redemption/oneV4** PASARON. Ownorder **79247a3f-1540-40dc-b638-9e57de73d005**,0GETpostwrite. **STOPbefore-replay**1FAIL0skip: fixtureTS502 deliveries.every rechazóboolean, NOreplayejecutado. runvalidfalse/stoppedfalse/functionalDiagnosticValidfalse/strictfalse **ORIGINALESINTOCABLES**. Logfixture-before-replay-7f8ae543-230b-47b8-85f7-21ed9447a72b.log SHA**3ca104531e052654c063042d3cfbceb29b093e54758311c057a6d33e345233ac**; attempta0ca496a SHA**acafc2b302e0ce23521ae0b2fb37a25ab24e2985a20e6124a01083bce5d4c04b**; runresultSHA**5b12ca611ef510b31bc7a58098bd99b4c10d20b39ac8b2d8cf7cbde82a95318e**.

**DiagnósticoREADONLYREAL ya terminado** contrato45ac38b5: quietproofrecovery-readonly-quiet-proof.json **5b55d1a254292217fb53eaeff95fd060d6ab0e3a947e5f463807ffc6e56bdd0c** trace/CDPstable813ms/476rows/pending0/aftercommit1/fragment0/CDPsavedpending0/exacttree37978+38021. Privateinspector40064 EXIT0/1PASS2.11s/11SELECT/RRREADONLYon→ROLLBACK, exact1include/setupglobal[]/node--checkpassed/protectedCIconfigciantiPROD. Proof **readonly-delivery-inspector-proof.json SHA87e9fd9f3a4d468e1d0cba4fc61fdca9deb7c608c354cbed244045c1179e306d**, log **27db2943e71d576c41940221a52ba949a8129f1de8694b61051494dfd44a1536**; persistedrawrows/tipos/settingsantesasserts. Finanzasclosed/payment2.78/coreledger2.78/memberpoints2/redemption1/sale.closedV4único confirmados.4deliveries: saleV4 recipes30a6257f… skipped0/terminalmodules_disabled; saleV4 core.analytics78e36e70… applied1; coupon.redeemedV1 core.analytics88bc6c5c… pending0; visit.recordedV1 core.analytics e229efc6… pending0. Todasdiag/claimtoken/untilNULL. Wallet1 d5865986-0adb-47df-b033-3a91c229c294 transactional/suppressed0/last_errorno_channel/sentNULL/not_before14:13:41.502; **not_before es leaseclaim+5min NOhora supresión**, noatribuiractor/estadoalinstantedeFAIL.

**QA26d54ad fundamentó que guard másestrictoque arquitectura**, no evidenciaactualbugproducto: measured-close296–309 acelera sól sale.closed/recipes.consumption.applied/sale.commission.frozen; coupon-store71/analytics-events48 publicanauxpendingoutbox. Workerinternalretry sinfilter procesa eventual; ADR0153/spec0237§2.3 asincronía/cronrespaldo. Walletsuppressed/no_channel normal porpush-no-channel18/ADR0116/spec0139. No afirmar0globalcallbacks, after-grant-schedule sóloagenda Nextafter/inlinefallback. CurrentSQLsnapshot14:13 noestadodelFAIL14:08, noPASShistórico.

**ContratoPREVIO5f155b82** última sección0242-m1-baseline-compat.md: autorfixOFFLINE guard/observabilidad,guardarrawANTESasserts; saleV4 terminalpropio; sóloauxcoupon.redeemedV1/visit.recordedV1 core.analytics propios/sourcepayloadcampaignlocation exactos pending0diagclaimsNULL o primeraaplicaciónnormal; walletno_channel terminalnormal/pendingdelegadobajocondicionesrealesconlímites. No pending/claim/diagarbitrarios. Replay compara finanzas/snapshots **inclcoreorders/corelines/counts/allbusinessimmutableevents** exactos; outboxmismosIDs/payloads/transicioneslegítimas pending→applied/walletpending→suppressed separadas/doslecturasestables/sindrain. TestshelperREALconproof87e9+negativos wrongtype/version/source/claim/attempt/diag/walletstatuserror/lint/formato/diff/tscFINALsiTS. **NuevoSHAfixture/recetaclean→QA focal ANTESDB/HTTP/stop/cleanup**. Autorproponecomandoprivado/artefactos al entregar, nooperarrecursosahora. Runtimeproduct0c590 conserva sourcepaquetes/preload/GRID/origen intactos mientrasfixharness4paths.

**Siguiente será continuaciónCOMPUESTA n0, NOotra venta/COPY/OTP**: QAviableporfichacc468 yprecedentesP3b (noexigeunaúnicacorridaPASS); rootnuevoauthRECOVERYSHAdual runtime0c590+fixturecorregido/source6cee/mZN/freeze58df/compiled2696/configci/owner/orderliteral+cookielegítimavigente. BaselineSQLRRreadonly propio→UNA repeticiónHTTPclose ORIGINALrawbody/content-type/scope/contract2/clientRequestId exactos/mismacookie; tagobservacionalnuevoúnicocambio; transporteAPIContextnuevo(originalfuepage.evaluate(fetch), browsercerrado; **NOclaimmismoPagecontext**). Requestbytes/headers/hash privados/response200canónico/RID/intervalo; 0create/drain/OTP/retry. AfterSQLRRreadonlyfinancialimmutable/outboxcaracterizado/quiet500max15instrumentadolocal→identityfinalCOPY/origin/meta→stopSOLO37978/38021/cleanupSELECT0. CadafaseGOrootconcreto posterior, aúnNOautorizadas. ArtículoCOMPOSEDnuevoconhashlinks/contextocambiado/intervalos; runresultfalse+fallosoriginalesintactos, noRUNúnicoPASS/strictPASS/creditR2. **DespuésMASAQAaceptar/integrar/descongelarGRID→R2f04harness7paths/D2FUNC24+cleanup0→R2360/gates/combinación/cierre0242**. No terminarpendingP6.

Histórico necesario: RUN083bloqueóbeforecreate25RSC, QAfrontera **f2d4888125b62008b9f53582fd6f16bf7bcd93e6**; rootSIGTERM23095/23053natural/quiet0; cleanuporiginalSQL42846antesborrar corregido3cARRAYsql.joinparametrizado (proofQA f00b), recovery26268 1PASS45.34s/**27ownedSELECT0**authdual/dcbeownership/2e4aSELECT0, OTPledgerintacto; finalQA COPY822+ORIGIN822/3615source/7links/meta/freezeBID/deltas[] proof **88488a1e01db3aa38d0b0194b2aa97557421b9fdfd3addc3a51d18149f42b2a7**. TodosNSaf6/00749/083preservados, nofixturasvivasallí. PerfilRSCactual0c590 predeclara kindpos-mass-prefetch-terminal-v1/candidate6cee/mZN/55d2frames/EDITORendantesreadiness/RSCprefetchExtraInfo/script/clocksraw/multiset1:1tagcontextIDs/noorphans;24calificadosactuales/rawstrictfalseconservado, nuevoserroresfatalpre/postclose. QA528dNO GO062f4hallazgos(dto/cupón10.00/clocks/postquietDOM/rawworphan) cerradospor0c590/QA bcbb. CamposAPI083NOguardados, nuncaatribuirleprereqsretroactivos.

### AHORA: COPY masa detenido antes crear runtime; fix Next generado offline

Masaaf6 **af6a388b7ff2e3248ab14c16260a4c0221f2d8eb**/recipe**b68c9294c77aa67cb906a033479ea8692e4acc3d0952b8dae32c3bb68aae05d9** corrigió sharedstoreexacto;15unit0skip/lint/diffPASS/tsc8181reuseJSonly. QA **4c44c664ef1e3dac1968d531dc357480e8321284 PASSdelta+helperREAL** conmetadata415/8e8 y2linksactuales; proofprivado`/private/tmp/checkpass-pos-0242/private/qa-mass-af6a/proof.json` SHA**97a099ac624d5a7dda5375497ac1115b931d0f73cb4707af2394843da626143d**. FactoryCARDYA **doc:p6-mass-m1,db:neon-ciEXCLUSIVA,port43242**; GRIDdoconly/frozen6cee. RootcreóNS0700 `/private/tmp/checkpass-pos-0242/m1-mass-af6a388b-6cee` y authCOPYONLY0600wx SHA**32a18306cdc7e24004380636df5c652be48b71aefb8d235edadfe4822fd2b34e**, actions['copy']sinfixture; ligadaaf6/recipeb68/freeze58df/config535/ci2f5/47testpaths75ac/metadatapair415+8e8/diff2keysvalues/sharedstoreProvenanceEXACTyQAref4c.

**COPY ÚNICO AF6 FALLÓ EXIT1 PID8430**12:51:59→12:52:01Z: `Frozen source digest differs from runner commit` sourceFreeze1045, **ANTEScrear candidate/compiled**. NSsóloauth/logcopy-prepare.log0600+copy-process.json+invocation-failure-c4439f7c-fb31-4865-9b71-aebce81f4402.json(errorSHA94a8d8abf3ee0c036b332135831b62d32e484586b63601d139318453bad4dfba). Sincandidate/compiled/copiaparcial/DB/fixture/OTP/server/browser/ventas, ningúnretry. FailedNSaf6ylogs intactos. Copysource/grid6cee/freeze58df/metadataboth/config/sourceaf6cleaninmutables. RecursosCARDsiguenreservadossinuso, nodechecksnoactualtimings.

DiagnósticoreadonlyROOT+autor+QA: candidate3616tracked+f.files2277, ÚNICAmismatch `apps/merchant/next-env.d.ts` (Gitmode100644/runtime0600privacidadnormal). **ROOTGit/f.filesSHA0f70629890b72a0a82e91972cc032c04b658b26c265373cb711cf576bfbf8fcc/blob a419cbe4e3a5e8d4b481b851dbf4ac767de069e6**, **runtimegeneratedSHA1862ac4bbbc5192d4bf562161df66ea547ed3e67173100656ab606ae9797db2b/blobce4e94a6b10f160ee021fe18939af160d2927dcf**. ÚNICOS DOSimports './.next/dev/types/routes.d.ts'→'./.next/types/routes.d.ts' y './.next/dev/types/root-params.d.ts'→'./.next/types/root-params.d.ts'; TODOrestobytesidénticos. Control6f3268tracked0diff/mapas822/814+ambosBIDs0drift. QAleyógeneradorNext16.3writeAppTypeDeclarations52/55probótransformaciónnormal, nocausaexternainventada. f.filesrootprebuild≠next-envgeneradopostbuild; noeditarorigin/ROOT/freeze niomitirnext-env.

**Contratoprepatch2f304eea** docs/factory/0242-m1-baseline-compat.md: author **p6_mass_m1_author ACTIVO MISMO bloqueMASANOaceptado4paths** (arranqueconfirmado). HelpercomúnexactgeneratedSourceCompatibilityONEfile/fullbeforeGit+observedAfterbytes/hash/blob/source6cee/freeze58df/BIDmZN/Next16.3/QAref, sólo2sustitucionesliteralunayrestobytestotaligual. Debecerrar sourceFreeze+bucleCOPYalltracked+COPY/origen/final/verifyRuntime/manifestauthoriginal+parityauthposteriores. Authnoadoptaotrofile/transformsarbitrarias. Negativosnoauth/perfil/BID/source/path/bytes/hash/extraimport/whitespace/otrofile/driftpost +bridgeREALactualreadonly; JSonlytsc8181reuse/unitlintdiff/docrecipeSHAclean→QA. **NOretryCOPY/resourcefixture/OTP/server/browser/build/install/store/metadatachanges**; nuevoNS/authCOPYONLYtrasnuevoSHA/recipe/QA. QAcompletedúltimalecturaNextawaitfixdelta; R2autorcompletedpropuesta7pathsF04NODEEDITGRIDhastaMASAfinish+GOroot3192contract. DB/cardreservadaperosinfixturespropios;owner3201/túnel/ajenosintactos. Sin capturas/push/PROD;continuarhastaP6R2+MASA+combinación+cierre0242total,nofinalizarpending.

### AHORA: MASA corrige layout sharedstore antes COPY; R2f04 asignado para después

DB/puertos de prueba TODOSliberados: factorygrid(doc:p6-r2ONLY)/card(doc:p6-mass-m1ONLY), owner3201PID927/túnelintactos. GRID **6cee9773192d16e19ab6268251692478461b1044 CLEAN/INMUTABLE** hastaCOPY/ejecuciónMASA/identidadfinal. D2financialFAIL/SQLpadding4fb/rollback+cleanup89QA476 cerrados, SINflowscompletos ni R2muestras. Root3192ec0e asignóbaselineR2compatf04 en0242-m1-baseline-compat.md: DECISIÓNreleasef04distinto/noUI-only/R1control6fintacto. Propuestaexactaautor7pathsYAreservados(m1.mjs/browser/flows/flow-analyze/flow-analysis.test/recipe/handoff), modoscompat-controlprepare/deps/build/snapshot/diagnose-readonlypropios; firstpartyrealpathf04/NOsymlinknode_modulesGRID, thirdpartylock/hashversionssame, snapshots2artefactos/strictprovenance6lotes, nuevafingerprint2framesQA/DAGpolicy→freeze→authmeasure. **NOimplementar/instalar/buildahora**: despuésMASA+rootGO. p6_r2_authorCOMPLETEDtraspropuesta, no reactivarhistóricos; mismoM1pendientepermitiráfollowup7pathsdespués.

Masaúltimocommit **fd16e51a38c1cae6e4b61552a6e431e2ad5f7535**, recipec873245e89e0db0e3b3fb5ea1a434310ce94f71829ff81ece8b24f70dd73caaf,14unit0skip/lint/diffPASS/sinTS/reusetsc8181, pero **QA NO GOb9a68d87017e50ce228aeff8d7120584c4c06c55** antesCOPY: metadataCompatibilityexigíarealpathstore==lexicalWTstore, entornoreal2WT/.pnpm-storeSONSYMLINK aSHAREDrootstore. Rootcomprobólstat/readlinkreal: targetliteral `/Users/maxi/Documents/claude-workspace/check-point/.pnpm-store`, realstoretargetambos `/Users/maxi/Documents/claude-workspace/check-point/.pnpm-store/v11`; storeDirJSONlexicalsiguenprivateWTrespectivos. Supuestofísicoindependientefalso, noalterarmetadata/store/installparafingirlo.

**Contratoa01c7a64** amendment0242-m1-baseline-compat.md previofix: p6_mass_m1_authorACTIVO MISMO bloqueNOaceptado4paths/sinDBpuertos, corregirguardmínimo AUTHexactaamboslexicalstorepaths+symlinkpaths/literalreadlinktargets+physicalSHAREDtarget/QAref/provenance, lstat/readlink/realpathpre/postprepareyverifyRuntime. Hashsource415e9f6943cbd67803ed9bc9955865cb2afaabbe8689b3b28f25741f3a3fb996/runner8e8d239441c4dc3217b1433deea594d05731ee41201a94c0544ebbda203cb50a; diffEXACT2keysprunedAt/storeDir/valoresEXACTrestoJSONTOTALigual+semanticdepsstrict intactos. NOwrite/install/prune/movesharedstore/noguardwhitelistgenérica. NegativosbridgeREAL2root2symlink→1sharedstore/targetajeno/repoint/postpreparedriftaunhashmetadataigual; JSonlytsc8181reuse+unit/lint/docrecipeSHAclean→QADELTA. QAcompletedb9esperanuevosha; sinNodechecksCPUactivo alúltimoavisoexceptoautorofflinefix. **SINnamespaceMASS/COPYreal/auth/fixtureOTP/server/browser/run hastaQA yfactorytransfer/rootauthCOPYONLY**. CompatproductoROOT6cee→fd16:47paths41neontest+6supportswhitelistONLY/productDiffSHA75ac661c1d245f2d869d58fe324d1bc56ad543137a945831f7d1e37038b9c8a3(losupdatesmjs/docnomodificanapps); recalcantesauthparaSHAfinal.

Secuenciaautónoma: fixmetadataQA→factorytransferDB/43242gridyaDOCONLY aCARD→rootnamespace0700+authCOPYONLY0600ligadaSHAfinal/recipe/hashproductDiff47/metaPAIRexact+symlinkprovenance/freeze58df/config535/ci2f5/QA→COPYorigenLOT6cee(candidateFRESH6cee/BIDmZN)→QAidentidadCOPY→nuevaauthfixture/setup/loyalty/loginlegítimo conbucketfijo/financia3.09-.31=2.78/2p/V4/run/replay/cola/cleanupOWN0→QA/aceptarMASA→descongelarGRIDparaR2f04harness7paths→QAsource/buildcontrolartifactprivado+candidateFRESH/diagreadonlyfingerprintsi cambia→nuevoD2FUNC24yQA/cleanup0→R2n30×6estratos360flows+reconciliaciónindependienteygates→integracióncombinada/cierreP6/specINDEX. No finalizar0242completo mientrasfaltaR2. Sin capturas/push/PROD/owner/túnel/ajenosalterados.

### Frontera más reciente: SQL/cleanup auditados; fix masa offline antes de transferir

SQLproof **4fb965d46f2890166b3d49abcd7ac0d2bad9561612bd06db161157275dea8d03** confirmado/QAauditado:8pricesraw2.000000000numericfailoldcompiledregex≤2dec, quantityRaw1.000000000decodedPgIntegerNUMBER1. PedidoOPENv1/nullcore/closeReq/settlement, control25open0closed/candidate24open0closed; payments/coreorders+lines/events/redemptions0/4balances0, USD. Inspector97774EXIT0/1testPASS0skip/11SELECTREADONLYrepeatable→ROLLBACK/log929c25b40da163eb468471ce49154755ec168747dced75d934057c053d863d4e; primerparseaux0tests0SQL/log7a9bedde/testbackupbb49preservados/no retrycobro. Cleanup6cee98860EXIT0/1testPASS0skip21.09s/89remainingALL0SHAa98f764d893adb5ff25d14f8057e28c374cf909c534f7799690345aa332ad9e1, ownpreownership**8704a90408b26ea3d831e89a37003cfb121fe1f0afa73a7d98b0a335e7c15df0**, log**012b1129d797e958d9dcb7752f430c020210f53a0b4b33ac1243c77d97c1a3af**. OldownPIDs93778/94182/94244/94245/94246/94379/94380/96648/97774/98860ausentes/ports43242/3libres/verifyFreeze58dftrue/runtimeDeltas[][]/grid6ceeclean. QA **476a0161ce0891898d9b6e4c6397644270849310** auditóSQLcausePRICE/rollback/cleanupOWN/stop+MASAdoc73f/recipeec55condicional; D2FAIL0flows/n0. FactorygridresourcesYA **doc:p6-r2ONLY**, DB/puertosliberados, **SINtransferenciaCARDtodavía**.

Pre-COPY rootdetectóharnessMASSsiemprefallaríaigualdadmetadataentreWT: card.modulesSHA**8e8d239441c4dc3217b1433deea594d05731ee41201a94c0544ebbda203cb50a** vsgridfreeze**415e9f6943cbd67803ed9bc9955865cb2afaabbe8689b3b28f25741f3a3fb996**. ÚNICOSdiffs JSON `storeDir` ownWT/.pnpm-store/v11 y `prunedAt` (card04:44:40GMT/grid10:26:11GMT). NOsobrescribirmetadata/installworkaround. **p6_mass_m1_author ACTIVO fixOFFLINE4paths**: compatibilidadporAUTHexacthashes/keylist/valoresstoreDir+fecha+QAref, restoJSONTOTALigual+semdepNode/lock/versions/hashesestrictos; realpathsowncanónicos+fechasválidas; copias/provenance0600 yrecheckAMBOSEnverifyRuntime. Negativosauth/hash/extraKey/path/date, JSonlytsc8181compatible(siTSnotocar). Propuestaleídaaprobadaroot, QAinformado; nuevoSHA/handoffreceta/QAantesresources/COPY. Reutiliza73fdoc/8181codechecksafectadoshasta nuevodelta, NOejecuciónNIauthCOPYactual. Grid6ceeINMUTABLEparafuturoorigenMASA. R2autorACTIVO SÓLOpropuestahistbaselinef04porlectura/mensajeprivado, pedirpathsCLI/DAG/resolver/fingerprint; nocódigo/build/install/DB/OTP/puertos. QAcompleted476esperafixMASS. Contratoc351previo+amendmentsen0242-m1-baseline-compat.md; ningunoautorizaPROD/push/capturas. Preservar3201/túnel/ajenos, continuarhastatodo0242.

### Corte vigente: D2 cierre422; SQL proof pendiente; masa se adelanta

D2nuevo6cee/freeze58df autor94182 STOP enPRIMERcontrolh0/CLOSE: **422invalid_financial_input**, CREATE201/QRresolve200; cinco primerosrelojes observadossólodiagnóstico, SINcloseConfirmed/tail/postflight/replay/flowscompletos/R2muestras. RawflowresultsSHA**d9481e744ee2dc3094150f29d00e2289b37d5ceaa5e2f1670363ae4107d0f94e**, trace**4aac8cdece642168830ec6960d64c33be132cb922a8f9d9b302b1cc927ad321c**; originalUUID/version1/pagocash16.00/sinheadersscopecontrolpreservados. No retry/cambioimporte/parchecontrol/cleanupantesSQLproof. PedidoNUEVOcreado4d681a05-3eb6-4245-ab23-7393b356c433propio y8líneas; NOafirmar0ventas/efectosantesDBreadonly.

Quietud600ms estable/fragment0/request0/work0/networkSavedPending0/pathsBalancedtrue, **HTTP422terminal/failure real conservado** server.failuresrequest-status/functionalValidfalse. Prestopproof**a96d95343f849429b6bff28ba677c87f93dceac87c739266e8c5a71b5000382b**, stopresult**96190450aa7ae2606b683e510a7e38c2b472af3dda43438ea63555d4a547a0df**: propios94182/94244/94245/94246/94379/94380ausentes/43242/43243libres/wrapperEXIT1. DBaúnretenidagrid/source6ceeCLEAN eINMUTABLE inclusoDESPUÉScleanup porCOPYmasaadelantado. Noactivosserver/browser/timings, MASAcompleted/QAcompleted, R2autorACTIVOSQLreadonly.

RootGO UNinspectorSQLreadonlyprivado por tools/neon-test.sh, exact1archivo/1test/configsinsetupglobalhooks/txREPEATABLE READ READ ONLY/ROLLBACK, proof0600antesasserts: rawunit_price_snapshot/quantitytipos8líneas yestadoownorder/core/payments/events/redemptions/membershipbalance/rollback. PrimerPID96648/wrapper96239fallóANTES SQL/test porRollupparsequotinglínea21/0tests/0SELECT(wrappermigraciónidempotente0); test/logpreservados, autorizadocorregirsóloprivado+node--checkylognuevo, no retryclose. Encursoalúltimoaviso, sincleanupautorizadoaún. QuantityDTOnumber1porPgIntegermapNumber.parseInt: NOasegurarquantitystringcausa. Hipótesisprecio: control6f compiledoriginalMoney≤2dec+linesForCloseprecioDBcrudo, schema0108numeric24,9pad9; faltaproofSQLdirecto/rollbackantesdiagnóstico.

**Contrato nuevo c351fbb7** docs/factory/0242-m1-baseline-compat.md (antescódigo): investigarcontrolhistóricoaceptado **f04f323631e9eddd114fe7b0f98f47515f38a715** CP1bexactunitreaders/QA7508310b como PROPUESTAbaselineR2COMPATdistinto, NOautorizaadaptar6f/build/códigoaún. DiffUI/auth/cookies/schema/lockvacío, peroSÍfinancieroCP1a/lectoresunitpadding/BigInt/validación/scopeoptional+cacheheaders/proyecciónSELECT; noafirmarUI-onlyniM0mismacontrol6f. R1control6finmutable/listadoaceptado. R2n0datos→nuevarecetaprevia/mismos6estratos/n30/gates/ABBA. Futurobuildf04necesita firstparty@db/domain resueltosalárbolf04(NOsymlinkROOTgrid6cee), lock/depsversioneshashesiguales/metadatarealpathspropios; artefactoprivadoofflinefrozen/sin4ºWT. Nuevofingerprint2callsitesreales/QAantespolicy, no asumir6f. Autor/QAfavorablescondicionalporlectura; investigacióndespuésSQLpriority, nocódigoaún.

El contrato c351 autoriza **adelantarMASAcandidato-only antesR2**, SÓLOdespuésSQLproof+cleanup0D2/QAfrontera/factorytransferexpresa. MASAactual **73f29505e39a13465203bb1cd3ddecd5fc921db9**, deltaSÓLOhandoff sobre8181codeintacto; recetaSHA**ec55d8be257d60fe9efe14f48a4f4d252148b9afa46223e8d0746e6384506bf2**. QAlecturadocfavorable(condicional/sincommitnuevoaún),reusa12tests/lint/tscFINAL8181/QA4488. OrigenexactoLOT6cee/candidato6cee/BIDmZN/freeze58df, 1masa0.75kg×4.123456789/pase10%→3.09/.31/2.78/2p/V4/replay+cleanup0n0. SINrecursos/OTP/COPYreal/DB/runautorizadosaún. Rootcomparó6cee→73f scopesproducto:47paths(41neontests+6soporteswhitelistexacta), **productDiffSHA75ac661c1d245f2d869d58fe324d1bc56ad543137a945831f7d1e37038b9c8a3**, ningúnotroproducto/lock/instrumentacióndifiere. AuthMASSfutura debecontenerlista47exacta/digest/recipeec55/runner73f/config535/ci2f5/freeze58df/DBtransferport43242. Cardconservadoc:p6-mass-m1SINDBpuertos; GridexclusivoDB/43242/3/doc:p6-r2hastaSQLproof+cleanup. Sincapturas/push/PROD/3201PID927túnelajenosintactos. ContinuarautomáticoMASA/R2hasta0242completo, nofinalizarpendiente.

### Avance inmediato M1 (prevalece sobre los snapshots inferiores)

**Fuente R2/D2 actual congelada:6cee9773192d16e19ab6268251692478461b1044**, recetaSHA21b8ce91bd8baff90cc694f7b14238c81b9f4d377e6c1179d653a6cdaec41c57. Cinco pathsdelta frenteF1: browser/flows/flow-analysis.test/receta/handoff. Tres cierres harness SINproducto: heading+acciónsource-specific detalle/save; títuloQRporfuente; Total:exactodentroregiónreceipt. Auditoría6adaptersincluida.59testsPASS0skip(incl3subtestsDOMChromiumsetContent/red0), lint/formato/diffPASS/sinTS; primerlint4no-undefimportmissingcorregido/documentado. QA82308d97839c330d965aaa5bb15b348d557f90f0PASSdelta/GOcondicionalprepare/setup/build, NOMEASURE. No editar fuente/handoff/receta hasta cleanup del lote nuevo.

**D2 nuevo:** global `/private/tmp/checkpass-pos-0242/m1-d2-6cee9773-global`, primerlote `/private/tmp/checkpass-pos-0242/m1-d2-6cee9773-owner-none`,0700/0600wx. InventarioSHA**dc97d2aa7b15f393193b58aed66675286ea945183195de8749efc634d5dad536**, planSHA**42c2a668b3774d30af8a832200f781c356a2705c686303892a096627f6b54520**.12cohortes/24flows/24warmups/72preps/96tags nuevos/disjuntosdeF1. Primerlote4ABBA controlh0/candidateh0/candidateh1/controlh1, candidatoFRESHsource6cee/reusenull/.nextausente alprepare. Sourcearchive2de0a2120a2835d3a38f58f781d9f19f7ace9269658b04fb9cfb8ea862cea715; controlarchiveoriginal/copia54cbc567143f7d3e2af43309810c14da6bea647ab50926534ecb4b78109ec5fe intactos. Config535be4b240effc5b8e0f0e8079a3ec77aa605c7710da54ae0b8289c84a66ce47/ci.env2f5feba61ffc64659e7faac8afe917e68f5326256dd0ec6a37d4c2fd5cf13280/depsIdentityec5651607405788f0778e76d0e7a7ace5bc4f1c673c8517422e9fe9c5cbd6d27/metadata415e9f6943cbd67803ed9bc9955865cb2afaabbe8689b3b28f25741f3a3fb996/lock4cfe18864f12af4fe3b0cd84ab477e936ecd52d96847579cc087e6e13b020821 sin cambios.

Root creó **authorization-setup.json0600wx SHA7d14ab1a1ba0a728c4ea4f59416a0384e638f40d82856a0bd63bb7fca90e2a1f**, sólofixture+build, source6cee/recipe21b8/inventorydc97/plan42c2ligados. DBneon-ciEXCLUSIVA+43242/43243+doc:p6-r2 asignadosgridporfactory. **SETUP→LOGIN→PREFLIGHT→BUILDFRESH SERIAL EXIT0/no retries/skips** PIDs89484/89603/89727/89834 finalizados; fixturescada1PASS0skip. Cohortes24open/0closed/2memberships0 cadauno. PostbuildobservationSHA9452a40d5889561da11eea064d5a7b32b6c0dcff675dcac04dfe7adb6da3ee87, BIDcandidato**mZNZh0AJI8OcNme9YijKr**/source6cee/822compiled/digest**ed1f0c9f79bbab5f41e68dcd40f65301fe852e0b940dc90e25c4f39e7b5d40a8**, runtimetraceadf4428770b2dbad8bd2e7f7d19111ee113fe10bf1668252c19c85d958d0b439. Candidatechunk8140SHA55d723igualaceptado. QApostbuildACTIVO concheckerpropio /private/tmp/checkpass-pos-0242/private/qa-postbuild-6cee/check-builds.py; faltanproof/SHAQA antes policy. Sinotroestrato. Ownerlegítimo/IP203.0.113.242/bucketreal/SINresetrotación. FalloSTOPpreservaDB/artefactos. AúnSINpolicy/freeze/measure/servidorbrowserv ventas; postbuildrealQA→policy→authfreeze→freeze→authMEASURENUEVA/CPUfrontera antesGO4. Chromium launchsiempreescalacióntécnica porMachPortconocido. Conservar3201PID927/túnel. Después4PASS/cleanup0, otros5D2COPYpropio6cee(sinrebuild),QA24funcionalesSINinferencia→R2seisestratosn30/360flowsnuevos→masa8181compiladaONLYpostR2→combinación/aceptación/integración/cierres0242. No finalizarconR2pendiente.

**MASA actual8181eeedc1d9c8b56fa0697333cd88e2e986a38c**, cardlimpio/4paths/0DBpuertos. HandoffrecetaSHA36cc817a93f4da3af7a857d071639e0f0fd76b5acac8d5d0dc616d3620788c90;12/12unit0skip/lint/diff+merchanttscFINALposteriorTODOSúltimosTSPASS,sin cambiosTSposteriores. QA4488f6006e536fa9da99d12edfa6117f4ab210c5PASSfuenteCONDICIONALpostR2/transferencia. Corrigióf9TDZentrypointROOT/negativoCLIreal ypageerrororiginalstack/cause/contextprivado+handlerrealtest. f9primer8/9unit aliasvarrealpathfallido ytscPREpreservados. SinCPUpropios/DB/OTP/COPYreal/build/browser/servidor/ventas. ModoNextDEVprevio noacreditaM1; diagnóstico futuro1venta0.75kg×4.123456789/pase10%→3.09/.31/2.78/2p/V4/replay/cleanup0, n0 sincomparacióncontrol.

**Historial D2F1 cerrado SINcrédito:** lote `/private/tmp/checkpass-pos-0242/m1-d2-f1e9b1ae-owner-none`, runnerf1e9/recipe616b/build9f6WGdPg088TjaL6JhINv/freeze d0c6c493836deb039c258692a4d94f6984d62765b73d4aae530ca7207a1a07f2. QA97a446e6/proof294b052a auditóbuild814/822/callsitestransitivos/config/deps/schema. PrimerlaunchsandboxMachPortPermissionDenied1100/Chromium74009SIGTRAP,0attempts/ventas: reportflow-results-launch-sandbox-failed.jsonSHA537b3388ad781683a977a4e42af20d8e18365dbe847cecae76136efff0245135/loge4def174. Rootautorizórecuperacióninfraexplícita/mismofreeze/identidades sinreset/build/SINmuestra; authrecoveryf7d4495e/escalaciónAPROBADA. RecoverySTOPcontrolh0/detailheadingM1 000timeout5000: fuentecontrolheadingcontienebotónariaCambiar mesa:M1 000. Report3caf13966fc07827d4a6f4de9c3cfcd90dcab1df4d681c1909fbb6593ff1c2ff/traceprefixa2da961698907001e62d09b012a855207d5fbf2bac6b1a7f7a2bf0235d4c3811. WarmupAPI24/DOM12/tail518PASSestrecho,5CDPcancelserrores/bytesoriginales/strictFunctionalValidfalse/pageerrors0; QA4488auditóCADAconjunciónexacta/frames/BID/sininferircausa. SóloGET/sinorderId/close/0flowscompletos/0ventas.

LIVEGETdiagnósticoseparado820862167a8ff72cba0182c8ca395c55411bd2d0407e23fc334403391d69c6ec confirmóselector(sinPOSTOTPcapturas); prefixtrazaa2da preservado,diagdelta219f/combinedc583385fc6fef1c026629f1faf5a2dc9db9b5c430e0445ab28063a22f55dcfe9 separados. Quietud600ms/pending0instrumentado/noWrites; prestopproof6d1e36c8be817a7c642db389602798b6b97fca71c70dbe97d70ea24b8f099e20/stopd0b58aa7c08b75ae89f3bec622762cf8082033ebde9b34f86f12c6e7146bb521:6PIDs76302/76364/76365/76366/76494/76495ausentes/puertoslibres. RedcontextooriginalsóloCDPguardado/sinconexiónliveexterna, nouniversalcallbacks/0redliveinventado. CleanupEXIT0PID80063/1PASS0skip20.88s, cleanupSHA**a98f764d893adb5ff25d14f8057e28c374cf909c534f7799690345aa332ad9e1/89remainingALL0**/authStartLedgerpreservado; loge83d410d606ad825d0775332df788bdbefaab12969e0c114828e5c8748a2e004/preownership370cbe3decbc11d3beec78651f113c40ac34521f885df174b2139400939aa748(roots/beforecheck/GETproof,noSQLprecountsnuevos). QA4488auditócleanup/ownership/recursos, D2permaneceFAILselector0inferencial. FactorygridliberóDB/puertosalcorregirofflineyreservódenuevoahorapara6cee; sinworkersajenos.

**Última frontera6cee:** QApostbuild **8ac5ead7cefbc26e654e89a99797584649ed96a9 PASS**, proofprivado `/private/tmp/checkpass-pos-0242/private/qa-postbuild-6cee/proof.json` SHA**1a2e36db3143d76f332c4816627b92ac8076e5449a46d14cc3a86e171248c2e9**. Rehash814/822/runtime/BID/source/digest/callsites/metadata/config/deps/schema/roles/cookies/logsactuales; sinCDPcandidatoinventado. Checkerpropio2erroresauxiliares(shapeint/modoarchive)corregidos/documentadossóloQA. RootpolicyLOT/warmup-terminal-policy.json0600wx SHA**738c71dc21a2d5d73267bf6d2346ee2acaa449c2222a376521fc5dd38dbb6cda**/authfreeze**5e8dc27e5b7c696f1d927754d54f4f0b3c5d0e3bbbd0e837a784ce612de5a3d2**. FreezeEXIT0PID92341/logff112a405e6256025cb9469b2ba1d8e77a973439351512e17f579b46392aa202, **freezeSHA58df653c945b86f43f9263ba29b511542ee0a2ce32924709909302302848545a**, verifyFreezeEXIT0/maps exactos/runtimeDeltas[][]/metadata415sin cambios/source6ceelimpia. RootverificóDAG ycreó NUEVA **authorization-measure.json0600wx SHAb48c480e7b8b4561dd24bba46cd09a5d6818dff8ad034fe337dde35110514ef4**, fixture+measure/sinfreeze/ligadafreeze+policy. CPUquiet confirmadaMASA/QAcompletedsinchecks. SiguienteGO **sólo4flowsD2owner-none6cee**, Chromiummediciónrequire_escalatedporMachPortconocido/lognuevo0600wx; no otroestrato/retry/cleanupimplícito. FalloSTOPpreservatodoprocesos/DBhastaquiescenciacoordinada, éxito rootGOcleanup luegoQAactual. No cambiossourcehasta cleanupni Node/lint/tsc/builddurantetimings. GOautor4D2enviado y **mediciónARRANCÓescalaciónAPROBADA:launcher94182/wrapper93778/sesión25405**, logLOT/invocation-flow-d2-measure.log0600wx. Sólo4ABBA, fuente6ceelimpia; nopushPRODcapturas/3201túnelintactos. Esperarsalidadelote, noprogresarestratosautomáticamentesincleanup/QA.

### Operación y recursos vigentes

Principal permanece **dev** con cambios ajenos intactos; **mainLOCAL5c158325aac14618f5f83d6971ff6788bb4a04d4** recibe R1.3 y regresión aceptados (REGmerge648de7fd, QAmerge5c158325). Sin push/PROD/capturas. Node24.20.0/pnpm11.4.0. Conservar3201PID927/túnel, `.impeccable/config.json` y untracked skills/assets, M0/private/freezes y21ventas consumidas; nunca resetear ledger ni reutilizarQR. CI remoto90ebe18f rojo y guards heredados literals5archivos/betweenexpenses→stock sin verdeglobal; no editar guard/baseline.

Tres slots actuales:

- Card `/private/tmp/checkpass-pos-0242/pos-ui-card-0242`, ref/task `pos-ui-card-0242`, basecc468f386d88cf007fa7a1937651b2d84140f7a3: fuenteMASA8181eeed limpia/QA4488PASSsourcecondicional, autorp6_mass_m1_author completed esperandoejecuciónpostR2. Sólo4paths de0242-m1-mass-diagnostic.md/doc:p6-mass-m1/SINDBpuertos. HistóricoREG3aacceptedcontinuedNORMAL; no reactivarautorREG niintegratehastaentreganuevaaceptada/ancestromain. CPUquietduranteD2/R2.
- Grid `/private/tmp/checkpass-pos-0242/pos-ui-grid-0242`, ref/task **pos-m1-r2-0242**, autorp6_r2_author completed tras setup/login/preflight/buildFresh6ceeEXIT0, esperandoQApostbuild (59unitPASS/QA82308d97). Sólo11paths/doc:p6-r2+db:neon-ciEXCLUSIVA+43242/43243. Authsetup7d14ab1a; ningunaotraetapaautorizada. Fuente/receta6cee/21b8inmutableshastacleanup; privadosfueraWT. PrimerloteNUEVO6ceeowner-none/4flows, NOusarF1paraejecutar.
- QA `/private/tmp/checkpass-pos-0242/pos-qa-0242`, ref/task **pos-final-qa-0242**, p6_r2_qa completed postbuild8ac5ead7PASS6cee, MISMO bloqueM1pendiente;82308d97839c330d965aaa5bb15b348d557f90f0 sourceQA6cee;4488MASAsource8181/cleanupF1. Sólo0242-p6-r2-qa.md/doc:p6-r2-qa/SINDB/build/servidor. Followup siguienteQArealD2 cuandoautorloentregue; nofactorydeliverparcial. REGcbd/R1c671compatiblesno repetir.

R1 autores p6_m1_campaign_author y p6_final_qa completed, NO reactivar para bloques nuevos. Entregas1120b4b4/c6714142 aceptadasfactory, integradasdev/main. Coordinador marcó integrated ANTES de continue y factory rechaza continue desde integrated; error operativo ya corregido por cleanup NORMAL (limpios/aceptados/ancestrosmain/sinprocesos) y worktree-new.sh recreó ambos slots mismos paths con dependencias propias offlinefrozenlock/sinenvheredado. Datos/artefactos privados fueraWT preservados; symlinksdeps de runtimes antiguos resuelven de nuevo mismos paths/lock. No edición de registry/tooling ni force. Tareas viejasgrid/QA RETIRED, no usar sus IDs para recursos nuevos.

Factory reserve/extend/resources antes de cambios; no editar registro. Para reutilizar entrega siguiente: continue mientras accepted, ANTES integrate/cleanup; integrated sólo al retirar. No mover checkout detrás de procesos. Git/Chromium/ps propios pueden necesitar escalación técnica, no es producto. Hooks vigentes sin bypass. Cada push/PROD necesitaría autorización explícita nueva, nunca concedida aquí.

QA67b hizo factorydeliver prematuro del incremento parcial; coordinador reabrió MISMOtask con factoryreject ADMINISTRATIVO, motivo conservaPASSlectura/sinFAILproducto, porqueR2/regfinalsiguenpendientes. Taskreserved/basebb9/WTsinmover/commitconservado; noaccept/continue ni QA nuevo por ese incremento. Workers próximos sólo SHA/informe, deliver/accept final porcoordinador.

### QA combinado actual y corrección requerida

QA aafd5594 sobre a41475aa: DOS suites completas **module-events5 + pos-access6 =11/11PASS,0skip/retry,129.27s** (72.573/53.674), typecheckmerchant combinado PASS. No replay propio en esas11: reutiliza Stock4/unitexpand/native canónicos compatibles. AfterAll eventos sin40P01. POS accesos dejó2owners/2sessions/1consumer: hallazgo real de fixture, no fallo de los11invariantes. Captura readonly afterEach probó owner→root y consumer→membership→root antes teardown; coordinador autorizó cleanup suplementario EXACTO por wrapper (IDs privados documentados), preflight29FKrefs sólo2sessions+1push propios, commit/SELECT0durable, finalreadonly22.39s baselineDelta0/vínculos0/locks0/activity[] y PIDsausentes. Namespace privado `/private/tmp/checkpass-pos-0242/private/qa-final-a41475aa`.

Incidentes propiosQA conservados: pre1 nombreSQLincorrecto; pre2 inspector incluyó pos-orders por omitir filtro y ejecutó8casos EXTRA/EXIT0/71.79s (NO crédito11), afterAll y post-extra2 baselineDelta0; post-extra1 importVitest incorrecto/0tests/0SELECT. Configreadonly CORREGIDA sóloreadonly.test.mjs aislado, config11 exacta+capture readonly revisada, no otroswriters. Ningúnrojooculto ni skippresentadoPASS.

**Histórico: a8 fue rechazado:** coordinador factoryreject real por déficitcleanup y devolvió MISMA entrega al autor para fix acotado pos-access+handoff (paths yareservados). Registrar consumerId alcrearlo, owners/extraUsersdesde fixtures; trasdropWorld retiraridentidades propias yassertusers/sessions/consumer0, sinhelperglobal/nuevopath/negativosalterados. Fuenteactual permaneceQAa414, carda8 hastafix; DBnadieasignada. DespuésSHA/checks→lecturaQA→autorposaccess6conDBtransferida→cleanup0→reconciliar nuevoSHA enQA limpio y señalindependiente proporcional; module5/39compatibles no repetir. Sólo luego accept/mergedev/mainLOCAL. No reactivar autores de entregas históricas: esto sigue siendo corrección de bloque NOaceptado.

**Cierre REG actual:** código619956ddd3f9004871f33a67d04b2d6135b07655 corrigió sólo teardown de pos-access+handoff. Primer intento falló Neon Connectionterminated en db:migrate ANTES Vitest/0casos; logs preservados. Recuperaciónreadonly autorizada0/0108hashcanónico/shape8legacy0, segundo intento **6/6PASS52.81s,0skip/retry**. AfterAll integrado+inspectorpor2roots/6users/1consumerregistrados verificaronroots/memberships/users/sessions/consumer0,locks/activity0;PIDs41752/42233/42236/42243ausentes. No freezeprivado/muestreoGitporfase: gitpre/post yautorconfirmaronfuentequieta. Handoffdocfinal3a, QA independiente cbd8cd75 auditórawIDs EXACTOS/compatibilidada8→619/11a414+tsc, no pidiórepeticiónceremonial. Factorydeliver/accept3a; merge dev648de7fd+QA5c158325 y mainLOCAL avanzóFF atómico desdecardlimpio. Sóloarchivo testposaccess difiere del árbol a414 en apps/packages/tools; R1fixtures preservados por merge3way, no reemplazodeárbolcard. REGcerrada; M1R2 pendiente.

### Regresión P6A

Ficha0242-p6-regresion.md; handoff actualizado en cardWT. Scope inicial6+2soportes, auth5, dinero6, business-core/failures, residual8, históricos6, Stockindirecto2, eventos4 y Counter3, todos reservados antes del código. Inventario dirigido final **46suites =39completasPASS/197casos distintos +0pendientesDBautor +7compatiblesporlectura**. No sumar parciales/retests. Helpers raw/defaults intactos; V2 explícito por caller/scope capturado por owner, negativos sin reparación; históricos porSQL/publisher interno, no reabrirHTTPV1. Masa/pagos exactos, no helperlegacyNumber para masa.

Evidencia compatible: afe7060d75/75 en11suites; dinero17casos660add97+11retest25bc5a27; mutex d9d0b8bd4/4 con latch/pg_locks y cleanup0. Total inicial107/18suites. Business-failures intento anterior timeout dejó límite de raíces sin IDs registrados: no barrer por nombre. Retest correctedmutex verificó ausencia de waiters/idleTX/función/trigger e identidades propias. Posterior98ffe933 lote4 16/18FAIL2 conservados; pos-disable6 y best-sellers2 completosPASS. Correcciónbaf2a979 (invalid_input422 V2 y liveentryspy/contención exacta Mesas) retest5d095652 **10/10 en2suites**,0skip/retry85.74s, cleanup/inspector0. Residual5 sobre5d EXIT1 **12/19**,0skip/retry261.64s; recetas2,brand1,retirement5 completosPASS; AN3 4/7 y Stock0/4 no completos. Todos teardowns/inspector0 y PIDs exactos ausentes.

**Último lote50e02098 concluido:** AN3 **7/7PASS126.56s**, Stock1/4PASS; total8/11,0skips/retries244.02s. Recovery measured/productoborradoPASS22.65s; casos1/3timeout30s sin fases registradas, último helper eventOf devuelve eventoStockV2 porque filtra sólo negocio/sourceId, no sale.closed. No iniciaron nuevas6. AfterAll identidades0/PIDs4093/4578/4580/4587ausentes; inspector0waiters/actividadnoidle-txvacía, fuente limpia. DB se transfirió a M1. Autor corrige Stock OFFLINE: eventType sale.closed exacto en soporte ya reservado, fases/tiempos poroperación y afterEach espera promises/cleanup siVitesttimeout para no solapar. Mantiene30s primerdiagnóstico; no atribuir latencia/bloqueo ni aumentar a ciegas. NuevoSHA/checks/QA antesretornarDB. AN3yaPASS no repetir compatible. Nuevas6 módulos/module-events,analytics-covered,sale-publisher-v4 y server/billing-guards,permisos-mostrador,staff-entry siguenpendientes; DDL6 también.

**Stock diagnóstico5c intento3:** EXIT1,2/4PASS,2timeouts30s,0skip/retry118.88s. Atomic callback32.455s y disabled-empty30.634s terminaron TODASfases/aserciones sin rechazo adicional; ningunaoperación>5.039s EN LOS DOS CASOS AJUSTADOS (customer-passPASS tuvo6.713s), sin solape porque afterEach esperóowner. RecoveryPASS21.819s ycustomerPASS26.655s (ambossuscriptores/replay0/payloadsale.closedidéntico). AfterAllidentidades0/PIDs59239/59721/59723/59730ausentes; inspector0waiters/noidleTX; logs p6-stock-diagnostic-attempt3.log privados preservados. **Coordinador autorizó45s SÓLO esos2testfuncionales**, resto30s/polls/retries/operaciones/producto/gateM1 intactos; motivo suma real medida, no causa bloqueo. Fuente limpia5f424040 cambia sólo esos2presupuestos+handoff y tipos/lint/formatoPASS. **QA NUEVO67b aprobó lectura y GO DB Stock4 yaenviado**; nuevas6 sólosiPASS/cleanup0, DDL6posterior. No repetirAN37PASScompatible.

5c81063c histórico conserva eventOfsale.closed exacto y lifecycle robusto: guardantesrun/callbackdiferido/Settodos/hooksesperan/identitycleanup, QA65c leído sinbloqueantes.10482 previo rechazado por overwritependingCase tras timeouthook. No se ocultaron esosFAIL. Stockrecipes no usaeventOf, compatible.

50e02098 sólo corrige fixtures/oráculos de AN3/Stock, tipos/lint/formatoPASS, QA d19f0d62 sin bloqueantes por lectura: historial V2 con query/tenant; COP10.40−0.60=9.80→minor0/payment10 explícito y snapshots originales; campaign subject/finishday exacto manteniendo readytoday; StockV4/capturedMeasuredConsumption y finally para no dejar local archivado. Comprueba dos suscriptores exactos core.analytics/recipes aplicados y payload/orden/línea, replay0claims/applied/payloadigual; recoveryfault conserva1 pendiente. Retest DB aún sin resultado; no producto nuevo probado. SQL23505 en AN3 es inyección de rollback prevista, esperar resumen.

**Últimos cierres de regresión:** Stock5f PASS4/4,0skip/retry121.67s; callbacks32.63/22.32/31.05/28.02s, cleanupidentidades0/PIDsausentes/inspector0. Nuevas6 sobre5f EXIT1:5suitescompletasPASS24casos, module-events2/5 y afterAll40P01 en module_event_delivery;3FAIL ydeadlock conservados. Cleanupadicional autorizado wrappertrasPIDs/locks0 retiró SÓLO2roots y3userscreaciónprobada, SELECTpostcommit0 en business/memberships/4orders/9events/13deliveries/users/sessions; fuenteintacta ysinbarrido.469422e0 corrige selector sale.closed, legacyfixture7explícito/restorefinally conserva3.50, Setretry/drainoptin yholdcadaBeforeEach/esperarconocidosantesmocks/nextcase/roots. QA809f leyósinbloqueantes, no ownershipuniversal inferido. **Module-events469 PASS5/5,0skip/retry71.73s**, V4cost12/legacy3.50/zero/tenant/schema íntegros, afterAllsin40P01/2roots3users0/PIDs94544/95025/95027/95035ausentes/inspector0. Nuevos5suitesPASScompatiblesno repetidos. **GO DDL6yaenviado**, ordenlista siguiente/unoaislado porinvocación, deteneranteFAILsinotroDBwriter. No editar469durantelotes.

Históricos pendientes: catalog-storage-expand,quantity-storage-expand,catalog-measure-storage,order-intent-storage,unit-expand-compat,pos-migration-0079. Clones deSQL0102/0103/0105 con hashes, sólo sustitución de identificadores propios; core0108 actual separado, jamás DROP0108 real. Ejecutar cada DDL aislado/serial sin otro writer, teardown incluido. QA leyó residual14/Stock/eventos/Counter sin bloqueantes; no sonPASSDB. Counter conserva5negativos403/precedencia PIN/billing/status y positivos410 exactos tras guard, otrasAPIs200; soportes dominio/business-status no se tocaron.

### DDL1–5 y retest autorizado

Sobre469422e0: catalog-storage-expand4/4(18.76s), quantity-storage-expand3/3(23.07s), catalog-measure-storage5/5(28.88s), order-intent-storage4/4(24.58s) PASS completos,0skip/retry, SQL/hashes/clones y0108 real preservados. Unit EXIT1,4/6(46.04s): dos casos esperan invalid_amount pero V2 retorna amount_out_of_range/422. Grupo detenido antes0079; teardown IDs/PIDs/inspector0. Fuente d67e3181 corrige sólo oráculos y handoff, respuesta exacta fortalece la aserción: range/create+update y quantitynumber/escala>9 conservan cuerpos negativos,422 y snapshots/rollback/noefectos; rawV1 sigue409. QA independiente trazó ruta→parser→captura→CounterError→posErrorResponse favorable; tipos/lint/formatoPASS. GO unit6→0079 separado ya enviado, sin repetir37/189 compatibles. Informe actualizado de QA pendiente de SHA; esto no es todavía PASS del retest.

Cierre autor d67: unit **6/6PASS,53.18s**,0079 **2/2PASS,20.28s**, ambas0skip/retry en invocaciones aisladas. AfterAllunit business/owner/sessions/consumers0; PIDs14235/14719/14721/14728ausentes.0079 afterAllpropio completo/PIDs18186/18665/18667/18674ausentes. Inspectorfinal0waiters/actividadtx=[],8omitidosdiagnóstico NO cuentanPASS. DBautorliberada yreservadaahoraQA; próximo mergefinalREGenQA limpio+factoryrefresh, dos suitescompletas module-events5/pos-access6. No aceptación autor todavía ni volvera39suitesporceremonia. D2conceptualQA cb56e9f0 viable,contrato5e5c0552, código/recetaofflineautorizados; noDB/build/login/server ni datos hasta lectura adapters/freeze.

### M1 P6B

Ficha0242-p6-m1.md,8paths asignados (más mass-native histórico ya aceptado), receta/handoff en gridWT. Control compilado original6f8e1e9cecdd33930c5f055db43641d805dbe3c2, BUILD_IDVLV2fFFeM_dUWKnxvv7iY, archive privado54cbc567143f7d3e2af43309810c14da6bea647ab50926534ecb4b78109ec5fe; jamás recompilarlo. Candidato reusable **buildSource1fd427d248e41cd6087fb93018f5c251c1bcd844**, BUILD_IDmQAEivzHwhRenkWFyULLz,822compilados; freeze **1617de3cf21db2403f351f4e3753856a870fcecc331b3e1005000ce9589b6436** en `/private/tmp/checkpass-pos-0242/m1-r12-1fd427d2`. Reuso autorizado sólo COPYprivada nueva con hashes exactos/config/deps/lock/diffproducto-instrumentación vacío; buildSource distinto runner manifestado; no rebuild ni iniciar/modificar runtime antiguo.

Todos intentos anteriores925e/e58/ee97/3c07 conservados.3c07 falló DependencyMetadataDrift ANTES de browser/warmup/muestras: prepare capturó metadata antes de pnpmwrapper/build. Cleanup mismoSHA14conteos0. Fix1fd conserva copia/hash prepare como provenance y freeze FINAL tras setup/login/build, exactitud metadata durante campaña +Node/pnpm/lock/installedlock/8packageJSON/realpaths estrictos. BuildNodeNext directo evita pnpmexec en scratch compartido. Únicamente fetch-cache/images/.next/trace runtime mutable observable; compilados/manifest/unknowncache siempre inmutables. R1.2 build/setup/login/freeze PASS; metadata4b03…6f7c estable/changedKeys[].

**R1.2 falló primera warmupCONTROL,0muestras normales**: lista200/DOMlabels válidos,0pageErrors,settlementfinish;25FetchRSCstatus200 cancelados causaron functionalValidfalse. QA probó cancelaciones1859–2096ms antes del marcador3776ms y antes context.close, no causadas por cierre runner. No prefetch probado con datos viejos. IdentidadfinalPASS y cleanupMISMO1fd14conteos0/puertolibre, artefactos originales intactos.

**D1 ya completó diagnóstico NO inferencial, EXIT2/strictGatefalse conservado**. Nueva instrumentación e7e9192e inicialmente rechazada por perder ExtraInfo anticipado; ebf20fbe buffer sóloflagsallowlisted/localrequestN fusiona ambosórdenes y no guarda cookies/scope/rawCDPid,13testsautorPASS. QA59f7 aprobó. Namespace `/private/tmp/checkpass-pos-0242/m1-d1-ebf20fbe`, plan84e6e85b…9e84e, freeze7efe35261b8b10ba7153cb5badd43428c1226bfc78b17df538225e11a9c854a3. Authorization0600 exacta sólofixture/freeze/diagnose, no build. Setup/inspect/login PASS1/1cadauno; baselines previos al freeze. Exactamente2primerasentradas OWNERnormal control→candidate,0warmups/reloads/muestras estadísticas. AmbasAPI/DOM/0pageErrors/quietud/estructura válidas, candidato0GETsession/modules. Control25/candidate23 canceladas TODASFetchGETlocal/backoffice*,RSC+NextRouterPrefetchKnown+ExtraInfo,200text/x-component,ERR_ABORTED/canceledtrue/blockedReasonnull, antesmarker/close. Flags prueban solicitudes especulativas Nextprefetch, NO callsite interno exacto del aborto. Tiempos3571/2916ms son diagnóstico, sin inferencia. Doscatálogos candidato pueden ser precargas de doslocales autorizadas previamente por owner; no ocultar coste ni asumir duplicados sin identidad local.

DatosD1 diagnostic-results.json hashc21b78757e0b03a2933b66d4d7eed91fa67380c148b7ad92688f11bf98a641dc; resumen seguro0600. IdentidadfinalPASScaches/control/candidato[]; cleanupMISMOebf PASS1/1,0skips14conteos0/phasecleaned/43242libre, hash3d227ad873516213979f8fde18553b29756afce769e1e7fca5d9d7ff83f8c2d9. QA c501 leyó datos/hash/fuente y atribución; no M1PASS.

**AHORA M1 R1.3 ejecución autorizada**, fuente limpia **dcd5434c3a98433590976e3fc641df2f179a869c**,14testsautorPASS/lint/syntax/diff. QA **fb6e3ff223ae2596a11679e1498875fe1f19ec6a** leyó políticaestrecha y recalculó hashesD1 exactos sinbloqueantes. Plan240/warmups/estimadores sin cambios; terminal speculativecancel exige conjunción flagsRSC+prefetchKnown+ExtraInfo/GETlocalFetch-backoffice-noAPI/2framesNext exactos+BUILD_ID+chunkSHA/200mime/ERR_ABORTED-canceled-nullblocked/finantespreauditclose+API/DOM/quietudválidos. Sólo listadofull/warmups; detalle/retorno/D1 estrictos. Filasterminationerror/partialbytesnull/costostotales/strictFunctionalValid original permanecen. No allowlistglobal ni reinterpretarFAIL/D1PASS.

PrepareR1.3 offline PASS namespace `/private/tmp/checkpass-pos-0242/m1-r13-dcd5434c`0700, plan3cce52df238d41b401b8c40dbbb51076a6a80f6fb57a97d0fcd0d627f4bf2704, prepare-verification0600 comprueba240exactos/policyr1.3-next-prefetch-terminal-v1/evidenceD1c21b/ambosBUILD_ID-chunkhashes/reusoCOPY1fd-f1617/diffproducto vacío. Tras cleanupregresión0/factorytransferencia REAL coordinador creóauthorization0600 exclusivo ennamespace, accionesfixture/freeze/measure, NObuild. **GOenviado** setup→inspect/loginporwrapper→baselinecopias→freezeFINAL→campañaexacta→identidadfinal→cleanupMISMOdcd. Aún sin resultados nuevos. No inspect mutante trasfreeze ni editarfuente confixturesactivas. Todos artefactos anteriores intactos.

**R1.3 CERRADA/ACEPTADA — listado porrol, NO M1GLOBAL:** fuente ejecutada dcd5434c, entrega sólohandoff **1120b4b4d083936444f9bb048ec0f81b310f14ac**, QAindependiente **c6714142564c75e87c6d693b7064f770c657b8c9**; factoryaccepted/mergeec9d7f0d/mainbb9. Setup/inspect/login1/1PASS45.83/31.02/39.59s; freezeFINAL **d0a0293d4960064a73db88cab3f7f1cd78b301cc7234e40ca4db94c14bbdfca2**. Datos namespace `/private/tmp/checkpass-pos-0242/m1-r13-dcd5434c`,240observaciones+240warmups+20preps válidos, EXIT0/identityfinalverified/runtimeDeltas[]; cleanupMISMOdcd1PASS0skips8.17s/14conteos0/hash19c333c69d438c417b425628abc67edf587a50711f760732f984dc1b326f1680,240PIDspropiosausentes/43242libre. Ningún inspectmutante trasfreeze.

QA reimplementó PythonMulberry32/bootstrappareado10000seed24220261018/medianasMARGINALES/p95nearest-rank, coincidente con autor:

- OWNER n30: med2319→1593.90ms,delta−725.10(−31.27%),IC95[−743.20,−696.50];p952368.20→1662.30,ICdelta[−738.20,−685.80].
- STAFF n30: med2330.40→1636.55ms,delta−693.85(−29.77%),IC95[−711.35,−668.60];p952537.20→1670.80,ICdelta[−905.40,−684.10].

Mejora mediana y no-regmediana/p95 PASSambosroles. Diagnósticos5pares NOinferenciales: detalle candidato+44.6/+44.4msmed yretorno+9.8/+7.7, noPASScriticalfabricado. SQL normal OWNER27→45/STAFF23→41 (+18), no reducciónSQLglobal.

Reconcile independiente500obs/480tagsHTTP+20return0HTTP: raw63112filas/14796reqstart=end/15180SQLstart=end0fail/1580phasestart=end porRID,0unknown/0postpreaudit.5244cancelerror cumplenconjunciónestrecha;18338networkfilas intactas,encodedunknown5244/ningún0inventado. Sumaobservadaencoded265752642/decoded1856921600, no totalcompleto. Compiled814control/822candidate,config/ci/schemafixturebasal/planhash exactos y finalidentityANTEScleanupverificados.2avisos auxiliares SQLtime5.441/5.212ms se conservan: queryStartperf antesHMAC/recordat explica ms>deltaat, no gatepredeclarado ni pruebatru​ncado. Manifestfinal0600 hashesreport6930983e…1387e/rawb2bd03cd…6c3ec/analysisc1889648…77cc3/reconcilee919db73…3f806/clocknotes439a2784…cb83b. TodosFAILprevios preservados.

**M1R2 AHORA offline**, ficha83a37640/QAcontractbb9 y amendment **84959674** PREVIOdatos.30pares×6estratos owner/staff×none/10/100=360flujos+360warmups; seisrelojes/lotes60flujospor estrato/cleanup. Propuesta privada n60 NO autorizada. R1/M0 no se repiten. Reuso COPY1fd/freeze1617 sóloprueba runtime/producto/instrumentación/depsconfig estricta o buildnuevoNodeNextautorizadomásadelante; fixturetestdiffrequierepruebanoimportproducción yQA. Paths11exactos, ningúnproducto/kit/guard/schema.

Autor R2 incrementoprimitives5c5554a6 recibió3hallazgosQA: JSONLfragmentooculto/hashesundefined/no aislamientoentrelotes. **f98a119c50642d55612e097a71af756093935135 limpio** corrigelectorfragmentBytes→nofinish/hash40-64obligatorios/aggregateIDs360+tagsprovenance6freezes;33tests(19R2+14R1)PASS0skip/lintformato/diff0, QA26f6681e favorableporlectura. Ese snapshot aún no tenía fixture/adapters/launcher; offline3 descrito abajo los incorpora, pero noGOdatos. flows/massnative tienensideeffects alimportar, noreutilizarlosporimport. Autor yaautorizado a implementarofflineelrestodentro11paths; nueva fuente aQA antesDB/build/freeze/servidor/medición.

**Offline3 actual78f794bb:**9paths propios/42tests(28R2D2+14R1)PASS0skip,lint/formato/tscMerchant/diff0; receta fbd9e834a0fb7e4c5699e12dd689ae260037efbc558523e9266d5223c5827f52. Cableados fixtures/adapters/launcher/postflight-replay/trace/COPY/cleanup, SIN ejecución real. Freeze/measure bloquean explícitamente pending-qa-r1.3-rebind. Autor corrige próximos deltas mientras QA lee fuente78f mediantegitshow:

1. Warmup reproduce listaR1 con cancelacionesespeculativas conocidas. Amendment95e48dad+QAconceptual permite sólo OFFLINE reutilizar conjunciónisSpeculativeCancelR1.3 paraTAGwarmup/full-list, API/DOM24open+hclosed exactos/sinerror y strictFunctionalValid/error/bytes/costos conservados. ControlFP6f aceptado; candidatoFRESH requiereQApostbuild ANTESdatos byteshashchunk+2frames/callsitepositionsEXACTOS alFPaceptado ymappingpath/nuevoBUILD_ID/buildSource/compiled, privatepolicySHA ligada runner/recipe/auth/freeze. Sinprueba rechazar. Los6relojes/replay/tails estrictos; TODOStags SQL/aftercommitquietos. NegativosTAG/fase/API/mime/flags/frame/hash/build obligatorios. NOejecutarD2para repetirfalloconocido.
2. Coordinador hallócatalogo: candidato precarga2localesyaenlista (R1+18SQL);78f espera NUEVOGET alabrirdespuésdetalle yexigeTOTALGET1. Corregir capturandoAPIrealwarmup PORLOCAL/shape/ranking yusarcachelegítimodelCentroalDOMready;2GETwarmup(1/local)+0redundantes, costosconservados, NOclearcache/falsearproducto. ControlesperasuGETreal. QAconfirmó.
3. QA hallóreplayomiteX-Pos-Contract: candidato daría409upgrade. Capturar/repetircabecerasSEMÁNTICASORIGINALESincl.contractporfuente, mismoUUID/bodyBYTES/scope/cookie; sólotagobservacionalcambia. Negativosmissing/mismatch/source. TodavíanoGOdatos.

QA78f completo50e1ab08 (en informeactualcbd):8brechas deharness/nohallazgoproducto, todasenviadasdirectoautor para deltaoffline. Ademáscatálogoprecargado2locales: controlcampo bestSellingProductIds (no frequentProductIds), empates8productoscontie-breakUUID aleatorio requierenordenrelativoisomorfo premanifestadoporcohorte; controldeja scope/contract AUSENTESoriginales, candidatoexigescope+contract2capturados/noinyectados; tracecotejarmultisetTAG/path (no countssolos) yquery/localID privado; core8líneasverificarproductID/nombre/sourceLineIdademásimporte y eventomoney/currency/gross/discount, negativosmismoimporteproductoerróneo; preservarerrormessage/stack/causeoriginal PRIVADO; propagate/exigir inventorySHA64COMÚN enlos6analysis/agregado, negativomezclacampañas. RSC necesita flags CDP/ExtraInfo/errorText/blockedReasonreales+frames, nofabricación. DOMprecisado QA y contratof19c3e11: API24open+hclosed IDs/resúmenes, DOM12openCentro+acciones, controlpuedemostrarademáshclosed; listaNOpruebasnapshots8líneas. TodoSINdatosR2.

**Offline4 actual72376ef:**8paths delta contra78f/9acumulados,52testsPASS0skip(38R2D2+14R1),lint/formato/tscMerchant/diff0; receta310349c279bd4b38d17a18182b54630bad785f43b10f934489c7dcc8de8aa713. Fuente limpia ySINprepare/inventory/build/DB/login/server/freeze/medición. Autorcorrectivo incorpora8hallazgos+RSC/DAG: runner/recipe/config/deps/builds→privatepolicySHA→autorizaciónfreezeNUEVA→freezeincluyehashpolicy/aprobación→permisoMEASUREposteriorNUEVO(wx)confreezeSHA/policySHA ysinacciónfreeze;setup/buildautorizaciónsinmeasure. Medicióninterna requierefixture+measurepara checks/replay. QA revisa gitshow723 ahora: **NO GO por determinísticoCLIflow-analyze pasaBuffer privateFile a analyzeFlowStratum queexigestring** (testshelperusanstring), necesita `.toString`enboundary ytestCLI. Coordinador también pidió evaluarpageerrorqueaún sólocuenta sinmessage/stackoriginal; guardarcapturaprivada siQAconfirma. Agrupar dictamenantesactivarautorparacorrección, no uncommit/workerporcada línea. Autoridle NO arrancaráporsend_message: rootfollowup_taskcuandollegueinformecompleto. AúnningúnrecursoR2autorizado.

QA723 terminó en6d34aeaf:8fixes78f/RSC-DAG favorables sólolectura, sinproof/buildreal aún. Lote final de3 yfollowupautor correctivo YAenviado: CLIprivateFileBuffer→UTF8string contestbridge; pageerror yJSONresponsecatch guardarerroresoriginales privados(message/stack/cause/URL/tag), no sólocount/bool; DOMwarmup reunirTODOSvisibles, exigirsetexacto12+TODOSenabled (no filtrar!disabledantescardinalidad), guardarlabelsreales ynegativos extradisabled/expecteddisabled. Sinotrasampliaciones/código producto. QAcompletedesperando nuevoSHAparadeltaacotado MISMO bloque; followup alrecibirfuente, no reabrirREG ni8fixescompatibles. Ningúninventario/prepare/DB/build/login/server/freeze/datos todavía.

**Offline5 f1e9 aprobado porlecturaQA bfb6ed68:**6pathsdelta723/trescierresCLI/errororiginal/DOMexacto,55tests0skip/lint/formato/diffPASS,TSno cambió/tsc723compatible. Receta616b2dc5f63d2529658ba8c0358466e89e575b94afe70f7c1dec54b09fccadb6. GOparcialprepare creóglobal yprimernamespaceexclusivo0700: `/private/tmp/checkpass-pos-0242/m1-d2-f1e9b1ae-global` y `.../m1-d2-f1e9b1ae-owner-none`, inventoryglobal/copialot0600 idéntico **b3e540006c8f51df7429c26083253ea8b3ef7202ba1305436201af71f05dfc0b**, plan **8f164b0f84720f447bff9c90621b785cb191e4f3981b72b69e6e27562df11327**. Global12cohortes/24flujos/24warmups/72preps/96tags; primernormal4ABBA(controlh0,candidateh0,candidateh1,controlh1). Restantes5lotes NOpreparados.

RoottransfirióCIgrid ycreó `authorization-setup.json`0600wx enLOT, SHA **6f447627063c6a173dbf12dfc70a0e56704bff2be503fbfa4340ceb3ac1e3e11**, actions[fixture,build]SINfreeze/measure. Flow-setupPID65074/login65605/preflight66131 EXIT0cada1/1/0skip ybuildFresh66649EXIT0serialsinretry. Actualmanifestready2tenants24open0closed,2memberships saldo0. CandidateFRESHsourcef1e9 **BUILD_ID9f6WGdPg088TjaL6JhINv**,822compiled/digest **b1bea0bb085d2e23d2747979a4de6dbd6b0dd22ce89efee31f8815426be9680f**. Chunk8140-6590b424086e36ba.js byteshash55d723bfc4c5053ffe7d073e67011546787116cfd2ed83886c9b073001bcba55 EXACTOaceptado; framesesperanQA. Controlarchive54cbc/control814/compiledDigestbe331a7f11a799b7a3ad40ad2b8961dc470eb30d005bc5cd7290772c5a901047 intactos. Metadata415e9f6943cbd67803ed9bc9955865cb2afaabbe8689b3b28f25741f3a3fb996prepare=postbuild/changedKeys[], deps ec5651607405788f0778e76d0e7a7ace5bc4f1c673c8517422e9fe9c5cbd6d27, selected535be4b240effc5b8e0f0e8079a3ec77aa605c7710da54ae0b8289c84a66ce47, ci2f5feba61ffc64659e7faac8afe917e68f5326256dd0ec6a37d4c2fd5cf13280 intactos. Node24.20/pnpm11.4/Next16.3.0. PostbuildobservaciónNOFREEZE `LOT/postbuild-observation.json`0600wx SHA **e26d29a146538092f16992e4fee41f883b689b762108d2259127d8386ff24b5c**, mapas/hashes/logscompletos. Puertos43242/43243sinlisteners. DBretienegrid, no cleanupadelantado.

QApostbuildACTIVO releyóRAWD1 c21b:control25errorsúnicoFP[(31,32043),(51,75478)] chunk366; candidate23errors[(0,71702),(0,75109)] chunk8140, aúnverificabytestotalactualyposiciones/transitividad. NOCDPnuevoobservado todavía. Próximo: esperarPASS+SHApostbuild→rootcreapolicy0600conBIDnuevo/hash/2positionsaceptadas+authFREEZEseparada→autorfreeze→rootQAidentity/freezeSHA→authMEASURENUEVA[fixture,measure]sinfreeze→fronteraCPUmasaauthor→GO4flowsD2. Ningún permisoactualautorizaFREEZE/medir/ventas.

### Diagnóstico masa compilado en paralelo offline

Ficha nueva **cc468f38** `0242-m1-mass-diagnostic.md`; specperformance requiere masa candidate-only, nativea9NextDEV se reutiliza funcionalsinllamarloM1build/start. Cardcontinuócorrectamenteantesintegrate y AUTORNUEVO p6_mass_m1_author(noREGhistórico) prepara4paths offline. ONEownerNUEVO0.75kg×4.123456789/pase10%→gross3.09/discount.31/net2.78/puntos2/receipt-history-inspect/replayHTTPbody+scope+contractoriginal/cleanup0, sininferencia/compararcontrol/mezclarR2. M1optinCOPYdelcandidatoFRESHfreezeR2exacto yNodeNextstart43242DESPUÉSdelotesR2contransferenciaDB/puerto;defaultNextdev/cookieDesesiónrealvigentes. CompiledmodeauthOWNEROTPlegítimounico/bucketreal(IPfija203.0.113.242)/sinledgerreset,nilcookieDecompiled. SinDB/COPYreal/build/fixture/login/servidor/browser/ventasahora. Sourcecompatibilidad46diffsapps tests+7supports,0producto/packages;allowlistexplícita+diffSHAaprobada, noexcluirappsgenérico. Modoquiescenciaaprobadose limitaatrabajoinstrumentadorequest/sql/phases+module-events-aftercommitfinished,red500ms/max15s,efectos/replayestables/sinclaimsactivos. Walletpushpending/attempts0sinclaimesentregadurabledelegada, registrarnoafirmar0/drenarexterno; module_event_deliveryapplied/skipped/claimvacío(primerintentoexitosopuede1). After-grant-schedule agenda Nextaftercallbacksnotuniversalownership;limitaciónexplícita,noeditarpreload/R2. Cleanupfinalroots/identidades/colasownSELECT0durable. Handoff/source+QAantescualquierrecurso.

D2 reservado5e5c0552:6estratos×1ABBA=24flujos+24warmups,12cohortesNUEVAS,h0/h1porfuente,6OTP+6PINsujetobucketreal, final2closed24open/cadafuente+postflight/replay/cleanup0. Kind/flagdiagnóstico rechazadoinferencia, sincréditoR2n30 ni mezclarevidencia; h0/h1nocubre0..29. Decisiónbuild: candidato FRESHNodeNext webpack sólotrasQA+GO, controlarchive6fintacto. LuegoCOPYpropia delprimerfreeze aotrosnamespaces sólo runner/buildSource/receta/config/deps/lock/compiledidénticos,sinfetch/imagecache, sinarrancarfuente. Noexcluirfixtures paraforzarreuso1fd. No build/COPY/prepare/login/freeze aún.

**Amendmentrealista auth aprobado conceptualQA ANTESdatos:** OTP20/IP/h real, no rotarIP/borrarelledger/bypass.12tenants totales=2isomorfos(uno/fuente) por estrato; autenticarSóloRolmedidoUNAvez6OTPowner+6PINstafftotal sujeto bucketprevio/vigencia.24open×8/120productos/8categorías/2locales y30ventas nuevas cada tenant. Histclosed0→29IGUALporh/sourceIndexordinalENejecución, NOpairIDbarajado; ABBA usa h,h+1. Cada venta consumer/membership/pass/coupon/order/commandNUEVOS; fijosúnicamentemismacohorte(source,estrato), nientrefuentes/lotes. No cambiarselección/fechas/membershipparaevadirguard niresetsledger. Preflight0closed,final30closed24open/tenant, estadosintermediosh/h+1/efectosporventa/rankingventanas/cachéisomorfos, cleanupalfin60/postflightsreplay. Populación CONDICIONAL trayectoria24open+0..29closed en2tenants, NOhistoriaconstante0 ni variaciónentretenants; bootstrap30pareado noresuelvedependenciahistoria. Diagnóstico deltapoh/ABBAprevio, nogateposthoc. Testsnegativos h/cohortmix/dynamicreuse/extraeffect antesGO. Recetaycableado debenactualizarse/revisarseQA; sinDBactualautor.

RecetaR1 sigue240observaciones (normal30paresABBA PORrol,10assets PORfuente/rol,5pares×4diagnósticos PORrol),240warmups y20preparaciones retorno separados. Mismo43242 serial/proceso-poolnuevo/1warmup fijo, noDBfría. Mismos12visibles/24IDs normales y100/200volumen; markers con líneas reales exactas. Primera warmupcandidate exige0GETsession/modules. Mediana/p95 marginales+bootstrap10000/seed24220261018; inconclusoNO PASS. **R1 completa y R2rutascríticas siguen MANDATORIAS**: catálogo/detalle/guardar/QR/preparar/cerrar none/10/100 nuevasidentidades, cámara sintética igual, masa candidato separada, tailpostclose fuera closeConfirmed. RSCowner separado pendiente; staff[pos] no inventarlanding/permisos. No inspect mutante tras freeze; copiasbasales antes y identidadfinal antescleanup, R2pre/postpropios.

### Siguiente secuencia

1. REG cerrada3a/cbd enmainLOCAL5c158325. CardYAcontinuednormal abasecc468/AUTORNUEVO paraMASAcompiladaOFFLINE,4paths,0DBpuertos. No repetirREG/activarautorhistórico; nointegratecardhastaentreganuevaaceptada/ancestromain. QAregcompatibleconservada.
2. NuevoD2source6cee/recipe21b8/QA82308d97: prepareEXIT0, setupauth7d14ab1a+recursosDB/puertosasignados, setup/login/preflight/buildFRESHEXIT0. QApostbuildrealACTIVO→policy→authfreeze→freeze→authMEASURENUEVA→CPUquiet→GO4. F1fallido/cleanup89QA4488históricossincrédito. Sinventasautorizadastodavía.
3. TrasQApostbuild6cee/permisosnuevos ejecutarprimer4D2 ypostflight/replay/cleanup0; luegootros5estratos/namespaces/authfresh unoauno/COPYpropio mismo6ceesinrebuild. D2funcional24sininferencia→QAreal→R2n30seisestratos/lotes60/nuevoglobalconownershipcleanup0entrelotes. Reconciliaciónindependiente6relojes×6estratos/intervalos/gatespredeclarados; NOextenderautomáticamenteinconclusos.
4. RecalcularR2independiente/tracealltags/efectos/replay; después diagnósticoMASAcompilado1flujoautornuevo/QA ycleanup0, integracióncombinada proporcional; sóloentoncescerrarP6/spec/INDEXglobal. ReutilizarR1yfuncional1–5. **Continuarautónomohastacerrar0242;no finalizar como done conR2pendiente.** Sin capturas/push/PROD ni nuevacertificaciónhardware/hosting ni verdeglobalheredado.


ÚLTIMOS AJUSTES L0 (dos mensajes del owner, mismo corte): Nueva orden desktop alineada explícitamente a derecha (wrappermlauto/headernowrap), Plus Iconoir y aumento moderado44→48px/padding20sin cambiar fuente. Misma presentación aplicada a PosConsolelegacy porque sigue siendo entrada usada sinpreview, sin modificar routing/acciones. Navbar mobile dentrooperación ahora SOLO Nueva orden centrada, retirado también enlacePOS, grid1col/justifyselfcenter; Mostrador seguía ya retirado. Sheet y evento primario siguen iguales. Typecheck/lint/formato/UIguard contra6329715c/diff-check PASS; smoke /private/tmp/checkpass-pos-navigation-0242/primary-only.ts PASSnavbarreal: único botón centrado, desktopderecha/Plus/alto48, abreSheet, sidebarAbrirPOS/querypreservada,0writes/pageerrors. Sin capturas/DB/agentes/push/PROD;3201 intacto. Handoff compacto sincronizado. Guardia global con backlog ajeno ya documentado no se repitió ni se declaróPASS. Pendiente owner.

CIERRE DE RONDA UI: owner indica «perfecto… terminamos de ajustar todas las vistas de POS» y pide último ajuste de accesos. Barra mobile de operación ahora solo POS y Nueva orden en2columnas; retirada entradaMostrador solo de esa barra (sin apagar permisos/módulo ni borrar su funcionalidad). Sidebar reemplaza Abrir mostrador por Abrir POS, resuelto genéricamente desde enlaces autorizados de manifiestooperación, sin literalesPOS/rutas de módulo en core. Conservaqueryactual al enlazar la operación activa (previewposV2), también enlacePOSmobile. Typecheck/lint/formato/UIguard contra3d21a3c9/diff-check PASS; navegaciónunit4/4. Smoke /private/tmp/checkpass-pos-navigation-0242/connected.ts PASSnavbarreal: dosenlaces/doscolumnas/sinMostrador, Nueva orden abreSheet, sidebar expandidoAbrirPOS apuntaPOSconquery,0writes/pageerrors. Sin capturas/DB/agentes/push/PROD,3201 intacto.

BARRIDO GLOBAL NO VERDE: modules-boundary-literals.test8/9 (total12/13 con navegación), falla en5archivos ajenos sin diferencias frentea3d21a3c9: app/backoffice/backoffice-context-controller.test.ts(3), backoffice-context-refresh.test.ts(1), onboarding/checklist-context-resource.test.ts(1), server/analytics/evaluation/policy-simulation.test.ts(2), server/analytics/lifecycle/index.ts(1). Navegación no figura como offender. No tocar guard/baseline ni certificarQAglobal. Handoff compacto docs/factory/0242-ui-handoff.md reescrito con todaslasdecisiones actuales, flujoanterior realmenteeliminado vslegacyqueaúntieneconsumidores, limitaciones/próximoplandelowner. Esperar última comprobaciónmanual/nav o siguienteencargo; NOiniciar masa/retiradalegacy/regresión general poroficio. Owner mantiene pruebasbrowser, trabajoDIRECTO sinagentes y SINcapturas/comparaciones.

ÚLTIMO AJUSTE DIRECTO: resultado completado y detalleterminal ahora un único receipt en MeasuredTicket: bannerVenta cerrada/con-sinpase(beneficios/saldo/cupón/extras preservados), negocio/local/nombreorden/estado, fechahistórica con timezoneyautor, líneas cantidad×nombre/precioporunidadcapturada y netcongelado, nota, descuentos/redondeohistóricos, totalcanónico, cierrefechayautor y Noescomprobantefiscal. Imprimir y Volver al historial abajo. Console elimina headingTotal/listado/nota/Volver duplicados; mantiene solo acciones de recuperación para rara detalleabierta. DocumentoPosPrintTicket solo dentro hidden/print:block, ya no repite ticket enpantalla; impresión/gestos/configuración siguen hookexistente. Dinero via decimalstring/settlement sinfloat ni preciosactuales; estadoanulado nunca se rotula venta. Typecheck/lint/formato/UIguard contra527eef3d/diff-check PASS;16tests documentoexacto PASS. Smoke /private/tmp/checkpass-sale-receipt-0242/connected.ts finalPASS: desktopmodal/mobilesheet, create1/close1 simulado con settlementdelkernel, receiptúnicoNegocio/local/Ana/cupón/nota/net2.25, noVenta completada ni segundoticketvisible, reimprimir1fallback sinotroclose, volverhistorial,0pageerrors. Primer intento reimpresión correctamente disabled porque mocksettingsfalse; habilitado mockpara probar print sinrelajarproducto. SinDB/hardware/capturas/agentes/push/PROD;3201 intacto, ownerprueba. E2Egenerales antiguos noejecutados ni certificados; podrían requerir actualizar selectores de resultado por diseño nuevo.

ÚLTIMO AJUSTE DIRECTO: owner pide reemplazar cobrofullscreenmobile por Sheet con contenido compacto de modaldesktop y explícitamente ELIMINAR códigoUI obsoleto. MeasuredCheckout ahora único contenido total/cliente/cupón/medio/recibido/cambio, Dialogdesktop y Sheetmobile (sin X, Confirmar/Cancelar apilados enfooter). Borrados JSX mobile previo/listado deproductos/copy/controles de escaneo en cobro; ELIMINADO archivo measured-scan.tsx y montaje/import de consola, ya sin consumidores productivos tras moverQRaleditor. Se mantiene identificación real por Sheetacciones→MeasuredEditorCustomer y lógica/contratos/cache/clientecupón/cierreincierto/idempotencia. NO se elimina legacyPosConsole/PosCheckout usados por entrada no preview ni detalleterminal. Typecheck/lint/formato/UIguard contra5d874d3e/diff-check PASS;17tests sesiónpago PASS. Smoke /private/tmp/checkpass-mobile-checkout-sheet-0242/connected.ts PASSdesktop+mobile: Sheet con Ana/cupón/descuento, sin listadoniEscanear, recibido5→cambio2.75, botones apilados dentroviewport, Cancelar vuelveeditor, métodos1GET/create1/no close,0pageerrors. APIs simuladas/sin DB/capturas/hardware/agentes/push/PROD,3201 intacto; ownerprueba.

ÚLTIMA CORRECCIÓN DIRECTA: owner pide también mobile Abrir(>)→editoractual, revocando excepción anterior de mantener detallemobile. Eliminado gateviewport al abrir ordenabierta; editor existente inicia pestañaOrden (nuevo iniciaCatálogo). Cobrar desde editor conserva editor subyacente también mobile y cancelar vuelve ahí; terminales siguen detalle/ticket. AccionesX/Sheet/navbaroculta son las ya existentes de editor. Typecheck/lint/formato/UIguard contra7ae3dbeb/diff-check PASS. Smoke /private/tmp/checkpass-open-order-0242/mobile.ts PASSdesktop/móvil: Abrir sinwrite, Ordenaria-pressedtrue/Ventaactual/Cobrar, sinEditar pedido, guardar al editar, cancelar cobro conserva editor,0pageerrors. APIs simuladas/sin DB/capturas/agentes/push/PROD,3201 intacto; ownerprueba.

ÚLTIMO AJUSTE L0: texto de nota en Venta actual mobile lleva Notes Iconoir y prefijo «Notas:», conserva texto completo/saltos. Icono/prefijo ocultosdesktop. Solo presentación measured-pos-editor; formato/lint/UIguard contra74d9e3e1/diff-check PASS. Sin nuevos tests/browser/capturas/DB/agentes/push/PROD; ownerprueba3201.

ÚLTIMO AJUSTE L0: Venta actual mobile oculta bloqueIdentificarcliente + explicación cuando aún nohaycliente, sin reservar hueco; identificación vía SheetEscanearQR/portal sigue montada. Cliente yaidentificado y beneficio permanecen visibles; desktop conserva bloque inicial. Solo wrapperresponsive measured-editor-customer; formato/lint/UIguard contra94b7a474/diff-check PASS. Sin browser/capturas/tests nuevos/DB/agentes/push/PROD, ownerprueba3201.

ÚLTIMO AJUSTE L0: Venta actual mobile oculta botónAñadir/Editar nota; muestra solo texto existente completo con saltosdelínea (vacío sin espacio reservado); desktop conserva botón y resumen. SheetOpciones pasa a botones secondary conborde, orden Notas→Imprimir→Escanear QR→divisoria→Anular orden, destructiva con texto peligro y fullwidth. Handlers/bloqueos/confirmaciónsin cambios. Formato/lint/UIguard contra9a473a82/diff-check PASS; sin nuevos tests/batería/browser/capturas por presentación mínima. Ownerprueba3201. Sin agentes/DB/push/PROD.

ÚLTIMO AJUSTE DIRECTO: pie editor mobile sustituye impresora por MoreVert Iconoir en círculo primarysoft44px; abre Sheetanimado «Opciones de la orden» sin X y con Cancelar, acciones verticales Notas/Imprimir/Anular orden/Escanear QR. Notas usa Dialogexistente, Imprimir usa mismo hook/documento actual+gesture inmediato (sin diferir a efectos), QR usa customer.start y formulario resetea código en cadaapertura. Anular persistida llama owner/confirmación canónica existente; borrador sucio abre descarteconfirmado sincrearorden (vacío limpio disabled). Mantiene permisos/bloqueos/settings/validación de print; desktop conserva botón impresora. Typecheck/lint/formato/UIguard contradb004324/diff-check PASS. Smoke /private/tmp/checkpass-mobile-options-0242/connected.ts finalPASS:4acciones funcionales, vacío noimprime, notaSin hielo enbrowserfallback1 sincreate, QRresolve1/no write, cancelar borradorconfirmado y seguir, guardar1 y anularcanónica1POSTversion1 trasconfirmar,0pageerrors. Primer intento terminó con selector ambiguo de heading delresultado/ticket; precisado nivel2, sin relajar comportamiento. APIs simuladas/no DB/hardware/capturas/agentes/push/PROD,3201 intacto; ownerprueba.

ÚLTIMO AJUSTE L0: cabecera editor mobile muestra directamente badgesorden/local editables y botón Xmark Iconoir44px con aria-labelSalir. TítuloNuevo pedido/status solo sr-onlymobile; desktop conserva título/Salir y badges en fila aparte. Un solo render de badges/botón y mismo requestExit/confirmación por draftdirty; sin alterar persistencia. Typecheck/lint/formato/UIguard contra6831b7ec/diff-check PASS. Smoke /private/tmp/checkpass-hide-navigation-0242/header.ts PASS: título ocupa1pxsr-only, badges visibles, Xvisible/textoSaliroculto, añadirCafé→X confirma, Seguir trabajando conservaeditor/navoculta, Descartar sale/restauranav,0writes/pageerrors. Sin capturas/DB/agentes/push/PROD. Ownerprueba3201.

ÚLTIMO AJUSTE L0: pie del editor mobile pasa a2filas: Totaldelpedido/importe arriba y fila inferior con confirmar/cobrar flexible + impresora circular. Solo clases de mobilePrimary, desktop/dominio intactos. Formato/lint/UIguard contraaa1a1040/diff-check PASS; sin nuevos tests ni browser/capturas por ajuste mínimo. Ownerprueba3201, sin agentes/DB/push/PROD.

ÚLTIMO AJUSTE DIRECTO: editor POS oculta navbarinferior mobile durante su montaje y la restaura al salir/desmontar. BackofficeShell expone contexto genérico useMobileNavigation (hidden/setHidden, defaultno-op para consumidores fuera de shell); navegación aplica hiddenimportant solo a navbar mobile, sin nombres/rutas/permisos de módulo en core ni alterar sidebar. Editor usa layoutEffectsetup/cleanup, sin DOMquery/storage/eventos nuevos. Se conserva pie propio de Venta actual/Confirmar; tras guardar en editor sigue oculto hasta salir. Typecheck/lint/formato/UIguard contraba6c2e3c/diff-check PASS. Smoke /private/tmp/checkpass-hide-navigation-0242 usa navbar/Shell reales con providerfixture: listado muestra navbar, botónsticky abreSheet, Mostrador→editor laoculta, Salir larestaura y botón vuelve a abrirSheet;0writes/0pageerrors. Sin DB/capturas/agentes/push/PROD;3201 intacto. Pendiente owner.

ÚLTIMO AJUSTE L0: Sheet Nueva orden mobile sin X; kitSheet admite showCloseButton opcional defaulttrue, este uso false (conserva Escape/backdrop/Cancelar). Footer de pasoDatos ahora una columna, ancho completo y ordenDOM/visual Continuar→Atrás→Cancelar; pasoTipo conserva solo Cancelar. Desktop mantiene acciones en fila. Typecheck/lint/formato/UIguard contrab2e1b878/diff-check PASS; smoke anterior ampliado verifica Xausente y boundingboxes de3acciones apiladas/mismoancho, recorrido completoPASS0pageerrors. Sin capturas/DB/agentes/push/PROD. Ownerprueba3201.

ÚLTIMO AJUSTE DIRECTO: mobile listado elimina AMBOS botones superiores Nueva orden; desktop conserva uno que abre modal de tipos. Duplicación originada por hidden en Buttonkit (inline-flex); visibilidad desktop ahora en wrapperhidden/mdblock. Bottomsticky existente usa evento genérico checkpass:module-primary; MeasuredConsole escucha moduleIdpos solo mobile/listado/no bloqueado y abre Sheet animado reutilizable, sin editar navegacióncore. Nuevo pedido comparte contenido/validación/tipos/mesa/nombre/catalogcache entre Dialogdesktop y Sheetmobile con footerCancelar/Atrás/Continuar. Toma local del filtro (Todos pide local), Mostrador conserva entrada cuando local/catalog listos. Clave por apertura, sin cambiar al cerrar, permite animaciónsalida y reinicia paso al reabrir. Typecheck/lint/formato/UIguard contra278314ae/diff-check PASS. Smokeaislado /private/tmp/checkpass-mobile-new-order-0242/connected.ts PASS: desktop1botón→Dialog; mobile0arriba, evento bottom→Sheet, evento deotro módulo ignorado, Delivery/nombre/Atrás/conservación/Continuar→editor, reabrir reinicia, Cancelar cierra, catálogo1GET/no writes/0pageerrors. Verifica contrato del evento de navegación mediante dispatch en harness, no navbar real autenticada. Sin capturas/DB/agentes/push/PROD;3201 intacto. Owner prueba navegación real.

ÚLTIMO AJUSTE L0: cámaraQR ampliada208→256px (w64, proporción3:4), owneraprueba tamaño pero reporta scrollbar interior. Retirado maxh96/overflow-y-auto del cuerpo de este modal, altura se ajusta al contenido, footer sigue separado. Formato/lint/UIguard contra21d7406d/diff-check PASS. Smoke con cámaraficticia verifica proporción, campo y botones visibles1280x800/390x667 y ausencia de descendientes con scrollvertical,0pageerrors. Sin capturas/DB/agentes/push/PROD. Ownerprueba3201.

ÚLTIMO AJUSTE L0: owner pide quitar «Escanea el QR o pega el código del pase.» y ampliar un poco cámaraQR. Texto retirado; wrapper centrado pasa176→208px (w52, maxwfull), conserva proporción3:4 nativa y footer independiente. Solo presentación measured-editor-customer; formato/lint/UIguard contraac5e8742/diff-check PASS, sin tests nuevos ni browser/capturas por cambio mínimo. Sin agentes/DB/push/PROD. Owner prueba3201.

CORRECCIÓN L0 MÁS RECIENTE: owner señala que cámaraQR horizontal del ajuste anterior no sirve visualmente. Se restaura proporción nativa VERTICAL3:4 del scanner, dentro de wrapper centrado176px (w44), sin forzar altura/aspect del video. Oculta solo hint interno redundante que se apretaba en anchopequeño; instrucción sobre cámara conservada. Cuerpo maxh96 permite cámara/código y footer externo mantiene botones. Solo clases módulo measured-editor-customer, sin scanner/kit/core/HTTP. Formato/lint/UIguard contrac7297459/diff-check PASS; smoke anterior ajustado verifica proporción3:4, ancho176 y campo/botones dentro viewport1280x800/390x667, Cancelar,0pageerrors con cámaraficticia. Sin capturas/DB/agentes/push/PROD;3201 intacto. Pendiente owner.

ÚLTIMO AJUSTE DIRECTO L0: modal Identificar cliente del editor ya no hereda videovertical3:4 gigantesco del scanner legacy; wrapperlocal limita video160px mediante utilidades descendientes de Tailwind (h40/aspectauto important), sin tocar scanner/core/kit/CSS existente. Cuerpo maxh80 con scroll; Identificar/Cancelar en footer fuera del scroll, presentes también al resolver (Identificar loading/disabled, Cancelar operativo). Conserva QR/código/cancelación del modelo. Typecheck/lint/UIguard contra6269fafb/diff-check PASS. Smoke /private/tmp/checkpass-qr-modal-0242/connected.ts con cámara ficticia PASS: video160, campo y ambos botones dentro de viewport1280x800/390x667, Cancelar cierra,0pageerrors. Sin capturas/DB/agentes/push/PROD;3201 intacto, pendiente owner.

ÚLTIMO AJUSTE DIRECTO: cobrodesktop deja Dialogfullscreen y usa defaultcentrado del kit (512px) con totaldestacado, cliente identificado y cupón compacto si existen, dropdownmedio, Recibido inputModedecimal exacto, cambio/faltante y Confirmar/Cancelar. No lista productos ni repite identificación en desktop (se hace eneditor); conserva recuperación de cliente inválido, cupón inválido/selección de línea, revisión explícita beneficio y cierreincierto. Mobile conserva Dialogfullscreen y controles anteriores. Altura interna limitada con tokens/scroll, sin editar kit. Medios se precargan desde listado con misma PosCache privada de identidad y lectura deduplicada; constructor de pago hidrata snapshot, prepare reutiliza entre órdenes/reaperturas; coupon-state sigue revalidándose y cierre conserva contrato/idempotencia y validaciónserver/comisiones. No storage/timers ni persistenciaentreidentidades; recarga renueva caché. Typecheck/lint/UIguard contrae8109b52/diff-check PASS,17tests sesiónpago PASS (regresión precarga/dedup/reaperturas/otraorden/resetidentidad). Fallo inicial detectó capture extra y se corrigió reutilizando requestcapturado en prepare, sin relajar test; UIguard inicial rechazó maxhalturaarbitrario y se usó token existente sin tocar guard/kit. Smoke aislado /private/tmp/checkpass-checkout-modal-0242/connected.ts final PASS: modalwidth<550centrado, Ana/cupón25%, total2.25/recibido5→cambio2.75, recibido1→faltante1.25/confirmdisabled, Tarjeta oculta inputcash, cancelar/reabrir medios1GET, create1/no close,0pageerrors. Sin DB/capturas/agentes/push/PROD;3201 intacto. Pendiente prueba owner.

ÚLTIMO AJUSTE DIRECTO: Abrir ordenabierta en desktop (>=768px, mismo breakpoint del editor) entra directamente en MeasuredPosEditor con sesión canónica existente, catálogo y Venta actual. Primaria Cobrar limpia, Guardar cambios al editar, sin Editar pedido ni previewticket duplicado. Cobro conserva editor debajo del diálogo para volver al cancelar; resultado de venta mantiene circuito anterior. Acción «Anular cuenta» bajo primaria, solo desktop y ordenpersistida abierta; usa Dialog/owner canónico existente y avisa descarte si hay cambios sin guardar. Editor recibe bloqueo externo para impedir operaciones durante anulación/cobro/denegación. Móvil y órdenes terminales siguen detalle existente. Typecheck/lint/UIguard contra765c0994/diff-check PASS; smokeaislado /private/tmp/checkpass-open-order-0242/connected.ts PASS: Abrir sin write, editor visible, editarNota→Guardar cambios→Cobrar1PUT, cobrar sinotro write, cerrar cobro conserva editor, anulación muestra confirmación/cancelar0writes, mobile conserva Editar pedido/detalle,0pageerrors. Dos intentos previos del harness fallaron por selectorincorrecto y mockPATCH (APIrealPUT); se corrigió harness sin relajar aserciones, no fallos del producto. Sin capturas/DB/agentes/push/PROD,3201 intacto; pendiente owner.

CORRECCIÓN MÁS RECIENTE: owner detectó alerta de ticket al abrir editor vacío en mobile y guardado sin feedback ni cambio de primaria. Editor ya no ofrece documento/builder cuando no hay líneas (kernel rechaza ticket vacío, no era fallo settings); botón imprimir sigue visible disabled. Confirmación exitosa no dirigida a cobro muestra ConfirmationToast «Orden guardada». Orden persistida limpia pasa a «Cobrar», llama onSaved para transferir selección actual de cliente y onPrepare SIN update/create adicional; si se modifica vuelve «Guardar cambios» y guarda antes de cobrar. Mostrador conserva continuar directo. Warning useEffect de consola coincide con Fast Refresh tras ampliar dependencias del hook en ronda previa (5→6), array actual es estático; recarga completa elimina estado de HMR previo. Typecheck/lint/UIguard contra44a7b883/diff-check PASS. Smoke conectado aislado /private/tmp/checkpass-confirm-0242/connected.ts PASS: desktop modal Delivery→mobile editor, vacío sin alerta, añadir Café, confirmar1POST, toast/Cobrar visible, printfallback1, cobro abre sin segundo write, settings1GET,0pageerrors. APIs simuladas/sin DB ni capturas, procesos cerrados;3201 intacto, sin agentes/push/PROD. Pendiente prueba del owner.

ÚLTIMO AJUSTE DIRECTO: padding horizontal del botón Nota corregido; botón circular Printer Iconoir junto a Confirmar orden/Continuar al cobro en Venta actual, desktop/mobile. Editor imprime borrador actual como «Precuenta · Borrador sin confirmar», sin guardar/crear/cobrar; orden limpia existente como Precuenta. Reutiliza settings preparados por consola (sin GET adicional por gesto); importe/descuento del mismo preview financiero, cantidades exactas. Conserva transporte existente, selección de impresora y gesto separado para imprimir, fallback navegador y descarte callbacks obsoletos. Detalle mantiene botón visible aunque no haya configuración/documento y muestra errores/reintento o desactivación real, sin alterar ajustes del owner. Nombre comercial proyectado del contexto existente, sin cambios de autorización/HTTP/DB. Owner confirma **funciona** en navegador y pide incluir nota: documento ya recibe nota actual sin guardar, ambos renderers la muestran condicionalmente; navegador ahora conserva saltos de línea. Typecheck/lint/UIguard contrae91d172b/diff-check PASS;16tests focales documento PASS (incluyen borrador sin ID inventado y descuento del editor). Test e2e existente ajustado a nueva visibilidad con settingsfalse, NO ejecutado en esta ronda. Sin capturas/agentes/QA independiente/DB/push/PROD;3201 intacto. No afirmar hardware físico probado por agente.

ÚLTIMO AJUSTE DIRECTO: POS usa todo el ancho disponible (sin max-w-6xl) en editor/listado/detalle y aviso preview; padding12mobile/16desktop, gaps menores. Editor distribuye Catálogo/Venta actual por containerqueries sobre ancho real tras sidebar (2columnas desde768px de contenido, catálogo2/orden1 desde1024px); orden crece al retirar límite1152 sin fijar ancho porviewport. Productos pasan1/2/3columnas según ancho propio catálogo (nombrecontainer/catalog), ajustando al expandir/compactar menú sinobserver/JSnuevo. Contenedor consultable solo envuelve columnas; primariafixedmobile fuera para conservar anclaje alviewport, renderúnico en ambas pestañas. Sin cambiosdominio/kit/core/DB, sincapturas por instrucciónowner. Formato/lint/UIguard contrae745baf7/diff-check PASS, compilaciónCSS existente tokens.test focal en entrega. Owner prueba distribución ytoggle en3201; sin agentes/push/PROD.

ÚLTIMO AJUSTE DIRECTO: sidebar compacto por defecto en pantalla de operación (usa operation existente del manifiesto, sin nuevos literales/rutas de módulo en core). Barra desktop76px con mismos links autorizados en iconos, title/aria-label y flecha «Expandir menú de navegación»; expandido ofrece contraer y menú completo. Fuera de operación vuelve navegación habitual; mobile intacto, ancho compacto solo desde960px. Nuevo BackofficeShell cliente conserva children/guards server y recibe ancho mediante contexto genérico; una customproperty estática en regla existente globals sin nuevos selectores, layoutgrid cambia por utilidad CSS. Sin modificar kit/guard/permisos ni mantener preferencia en storage. Typecheck/lint/formato/UIguard contra279785a8/diff-check PASS;14tests existentes focales navegación/layoutguard/tokens PASS. Sin browser/capturas por instrucción owner; pendiente su prueba en3201. Sin agentes/DB/push/PROD.

ÚLTIMO TRABAJO DIRECTO: columna Orden adopta panel «Venta actual» del labv004, badgeBorrador/Guardado, controles Iconoir−/+ conservando BigInt y diálogo de cantidad exacta, Quitar; nota por botón+Dialog manteniendo texto, subtotal/descuento/total y primaria ancha «Confirmar orden» (Mostrador conserva «Continuar al cobro»). Moneda Intl desde decimalstring con precisión de tarifa preservada. Owner pidió primero reducir columna a la mitad, vio25% demasiado estrecho y CORRIGIÓ a **aprox33%Orden/67%Catálogo en desktopxl**; md50/50,mobilepestañas/pie siguen. **Owner prueba enbrowser: NOseguir sacando capturas/comparaciones visuales automatizadas**; siguientes ajustes directos+estáticos focales.

Owner respondió pregunta explícita: **mover identificación de cliente al editor en ESTA ronda**. Nuevo MeasuredCustomerModel ligado a sesión/caché/epoch, QR o código de pase en diálogo del editor mediante POSTexistente /api/modules/pos/resolve {qrToken,locationId}, SIN crear/guardar orden al identificar. No búsqueda por nombre simulada ni endpoint nuevo. Cliente/cupón/exclusión temporales; vista previa usa mismokernel medido; al guardar se transfiere selección pororderId al controlador de cobro existente y prepare revalida cupón. El cliente NOsepersiste en ordenabierta ni sobrevive recarga (copyvisible); conserva selección entre editor/cobro y la retira al cambiar local/identidad/acceso. Cancelar descarta resolución tardía y conserva cliente previo; dobleQR no duplica,401/403/scope/epochretiran; cierreincierto no acepta sustitución de cliente. No cambiosserver/DB/authcontrato/aritméticaautoritaria.

Evidencia focal: typecheckMerchant/formato/lint/UIguard contra6d8b00ea/diff-check PASS;35unit en4archivos (5customernegativos+16payments+8preview+6editor),0skip/retry. Se corrigieron tipos de mocks hasta typecheckEXIT0, sin relajar aserciones. SmokeUIaislado /private/tmp/checkpass-order-panel-0242: cantidades−/+, nota,draft; conectado identifica antesdeguardar0orderwrites, descuento, retenciónmobile, create1 y cliente llega a checkoutvalidado sin reescanear; catálogo1GET,0pageerrors, sincloseenviado. Capturasprevias390/1280abiertas; eran25% antes de corrección final33%, no afirmar inspecciónvisualfinal. SmokeAPIssimuladas, no QA DB/hardware ni aceptaciónmanual. Sin agentes/DB/push/PROD,3201/túnel intactos. Esperar feedbackowner.

ÚLTIMO ENCARGO DIRECTO: precarga de catálogo por local desde listado (en paralelo a mesas, también sin móduloMesas), reutiliza PosCache/catalogKey y deduplica requests. Modal asegura catálogo al abrir/cambiar local, Continuar y Mostrador no entran al editor hasta snapshot disponible; fallo muestra Reintentar productos y auth/scope pasa handleError. En carga fría espera dentro del modal, sin prometer redinstantánea. MeasuredEditorSession hidrata catálogo síncrono desde caché en constructor/cambioLocal; loadCatalog cachehit no activa loading ni haceGET, force conserva relectura. Regresión focal añadida asegura catálogo en primer render/0loading/0requests de editor. Formato/lint/typecheck/UIguard contra0c9bdf42/diff-check PASS; suite editor-model6tests en entrega. Sin agentes/DB/batería extensa/push/PROD ni tocar3201; pendiente owner.

ÚLTIMO AJUSTE L0 DIRECTO: botón X junto al dropdown Categoría, visible cuando no está en Todos, aria-label «Mostrar todas las categorías»; vuelve category=all conservando búsqueda. Solo measured-product-catalog.tsx, formato/lint/UIguard contra dbc36d34/diff-check PASS. Sin tests nuevos/DB/agentes/push/PROD; owner prueba3201.

ÚLTIMO AJUSTE DIRECTO: Nuevo pedido sin «Prepara tu venta» (estado guardado/sucio solo para órdenes existentes). Badges redondeados primary-soft/borde-primary para nombre mesa/orden y local, ambos con EditPencil Iconoir; cada uno abre Dialog kit con sus campos pertinentes, conservando selección real/mesas cacheadas y confirmación existente de cambiar local con líneas. Sustituye resumen+«Cambiar datos» y formulario expandible. Catálogo: SearchField existente del kit (lupa y botón X «Borrar búsqueda», Escape) junto a Categoría en misma fila2columnas; limpiar búsqueda conserva categoría. Solo measured-pos-editor.tsx y measured-product-catalog.tsx, sin kit/HTTP/DB. Formato/lint/typecheckMerchant/UIguard contra ce9be0b1/diff-check PASS. Sin browserautomatizado ni tests nuevos por ceremonia en esta ronda de presentación. Disponible3201, pendiente owner; sin agentes/push/PROD.

ÚLTIMO ENCARGO DIRECTO: modal desktop Nueva orden ahora dos pasos: tipo→mesa real libre o nombre (mesa sin configuración, Delivery/Retiro), Atrás/Continuar/Cancelar; Mostrador directo si local definido, si «Todos» con varios pide local antes. Selección conservada al volver; no writes hasta acciones existentes de editor. Datos iniciales (tipo/local/tableId/nombre) fijan baseline limpio; editor oculta campos resueltos tras resumen y «Cambiar datos». Nuevo measured-new-order-dialog.tsx, sin lógica duplicada de mesas (usa PosTablePicker).

CORRECCIÓN MÁS RECIENTE OWNER: mesas deben estar precargadas en caché, sin «Cargando» al elegir Mesa. Console precarga tablas por cada local cuando está en listado y Mesas habilitado; misma PosCache privada de identidad, tablesKey por local y lecturas deduplicadas. usePosTables admite cache opcional sin alterar consumidores legacy; modal/editor leen snapshot cacheado sin parpadeo. Mesa no se habilita mientras una precarga inicial está pendiente (si falla permite entrar a reintentar); en selección de local nuevo reaprovecha precarga de todos los locales. Canonical MeasuredOrderCache parchea ocupación/liberación a partir de respuesta, invalida reads pendientes de mesas y preserva terceros/otros locales, SIN GETpostwrite; Actualizar listado refresca mesas explícitamente. No certifica realtime de otras terminales ni añade polling. Errores/scope pasan cliente existente, sin HTTP/DB nuevos.

Evidencia focal Node24: lint/formato/UIguard contra b1e8ca81/diff/typecheckMerchant PASS; unit existentes+2regresiones decisivas inicialización limpia/no sobrescritura y ocupación cacheada, total23/23 en2archivos,0skip/retry. Smokeaislado /private/tmp/checkpass-new-order-0242: Delivery/Atrás/conservar/Continuar, mesa libre+ocupada disabled, sin mesas nombre, Retiro y Mostrador PASS0pageerrors; repetido tras caché verifica ausencia Cargando al elegir Mesa. Capturas Delivery/Mesa abiertas; harnesssin procesos al cerrar. Sin agentes/QA independiente/DB/push/PROD ni cambios3201. Pendiente prueba manual owner en preview.

ÚLTIMO AJUSTE DIRECTO: nueva orden DESKTOP abre Dialog kit con botones/iconos Mesa/Mostrador/Delivery/Para retirar filtrados por context.saleTypes y Cancelar. Al elegir abre Nuevo pedido con Tipo de venta inicial seleccionado, conserva local del filtro; no crea/guarda orden al elegir ni altera edición existente. Implementado mediante onChooseNew opcional listado→consola y initialSaleType validado en contexto de sesión antes de baseline (draft nuevo no queda sucio por inicialización). Mobile mantiene entrada directa anterior, por alcance desktop pedido. Archivos measured-order-list/console/editor-model; lint/formato/tipos/UIguard contra99a09fed/diff focales PASS; suite existente measured-editor-model focal ejecutada, resultado en entrega. Sin agentes/DB/push/PROD ni tocar3201. Owner prueba modal/tipo en browser antes siguiente cambio.

ÚLTIMO ENCARGO DIRECTO (2026-10-19): owner autoriza crear Sheet reutilizable en kit y usarlo para filtros mobile. Nuevo `src/ui/sheet.tsx`, exportado desde ui/index, estilos cp-sheet en tokens.css capa components (sin CSS import en barrel que rompería harness existente). Modal React Aria con foco/scroll bloqueado, título/descripcion, children/footer reutilizables, X/backdrop/Escape, safe-area/body scroll, slide inferior240ms/salida180ms y reduce-motion sin animación. Listado mobile muestra Iconoir FilterList+«Filtros», abre borrador de estado/local/tipo; footer **Cancelar** explícito pedido owner y Aplicar filtros. Cerrar/cancelar no aplica; desktop filtros visibles. Sin swipe implementado/prometido. Checksfocales formato/lint/UIguard contra5a2977cf/diff/typecheckMerchant PASS; tokens.test5/5. Smoke aislado sin DB ni3201: abrir/cancelar/aplicar/X/Escape/foco/backdrop/reduce-motion/desktop PASS,0pageerrors; detectó prioridad CSS reduce-motion y se corrigió antesPASS. Capturas390/1280 abiertas; última mobile-settled confirma Cancelar/Aplicar visibles. Evidencia/harness temporal `/private/tmp/checkpass-sheet-0242/` (sin procesos al cerrar). Resolución vite del harness temporal corregida por realpath sin tocar toolingrepo. Ojo mobile cambió antes a NavArrowRight en5a2977cf. Sin agentes/push/PROD; pendiente aceptación owner en su navegador.

ÚLTIMO AJUSTE DIRECTO DE CONTROLES: en desktop cantidad de productos ahora círculo44px con número, borde/fondo primary al lado de Abrir; conserva disclosure de productos al click y aria-label con cantidad. En mobile Abrir sustituido por Eye Iconoir en botón44px con borde y esquinas redondeadas, esquina superior derecha; espacio reservado para no solapar título, total compacto conservado. Solo `measured-order-card.tsx`, formato/lint/UIguard contra92ace421/diff-check/typecheckMerchant EXIT0. Disponible3201, pendiente aceptación visual owner; sin agentes/browserautomatizado/DB/push/PROD.

ÚLTIMO AJUSTE DIRECTO (sin agentes): retirado badge local de `measured-order-card.tsx`; `measured-order-list.tsx` inicia filtro con primer local disponible (misma convención de local actual de consola legacy), ofrece «Todos los locales» solo cuando hay más de uno y permite elegir cada local. Nuevo filtro «Tipo de orden»: todos/Mesa/Mostrador/Delivery/Para retirar/Pedido anterior, combinado con estado y local. Sin cambios HTTP/DB ni de dominio. Prettier/eslint2archivos/UIguard contrae6fe5381/diff-check/typecheckMerchant PASS Node24.20.0. Disponible preview3201, pendiente revisión manual. Sin push/PROD. Siguientes ajustes siguen directos, sin agentes.

ACTUALIZACIÓN MÁS RECIENTE: owner confirma que **desde la siguiente ronda el coordinador implementa directamente, SIN agentes**; reconoce que para cambios ligeros concentrados en una tarjeta la coordinación demora más. No volver a abrir dos workers por el acuerdo anterior. Segunda ronda ya integrada en dev `afc164cd8f3e727a2de0f687301c35a7e37cc774` (autores card `4e0fc014`, grid/carga `9f985d18`): icono junto al título en fondo de color distinto por tipo, local en badge bajo precio, badge productos destacado con panel flotante al click (carga/error/vacío/reintento/Cerrar/Escape), móvil UNA columna con icono/título/Abrir y total compacto bajo título. Desktop 2 columnas md/3 lg. Productos cargan bajo demanda con client.capture y detailKey en caché canónica existente, sin navegación ni loading global; respuestas retiradas por identidad/acceso/epoch/desmontaje no se muestran. Ajuste final directo de clases con prioridad de padding/badge y precio móvil. Prettier, ESLint de los3archivos, UIguard contra5a3e3709, diff-check y typecheckMerchant EXIT0. Sin browserautomatizado/QA/DB. Esperar prueba manual. Factory ambos delivered, WTs limpios conservados, main sigue fe1ee796; sin push/PROD ni tocar servidor3201/túnel. Bloques que piden dos nuevos implementadores para próximos ajustes quedan sustituidos por esta instrucción.

Owner pidió convertir listado de órdenes en tarjetas: título de mesa/descripción guardada, total, recuento de productos e icono Iconoir por tipo; desktop como cards de histórico y móvil dos columnas. Dos implementadores NUEVOS, sin QA independiente ni batería extensa: `ui_card` entregó `9b6b18137cf55b354c631e0d49b318c6a4cb2f15` (nuevo `measured-order-card.tsx`); `ui_grid` entregó `5131007674c3e5d41e79f35f7ea8299e7315147f` (`measured-order-list.tsx`). Integrados en dev `72b94a6f1b8c93a56bcaae2539f5558a5988be25`, disponible en preview3201 existente. Card kit, título íntegro, tipo/local, total Intl es-EC desde decimal string, lineCount productos sin sumar magnitudes; botón Abrir conserva disabled/callback. Grid 2 columnas y 3 desde lg. Misma presentación para cerradas/anuladas con estado; ayuda de día solo en esas vistas. Sin cambios de dominio/contratos/creación/pagos/impresión.

Prettier/eslint focales de autores y ui-guard combinado contra ab42ec8b: PASS; diff-check PASS; typecheck Merchant combinado (`tsc --noEmit`, Node24.20.0) EXIT0. Factory `pos-ui-{card,grid}-0242` delivered, WTs limpios conservados pendientes de revisión manual del owner; NO marcar aceptación visual ni cleanup antes de ella. Main local sigue fe1ee796; QA WT previo intacto. Sin push/PROD/DB ni alteración de3201/túnel/artefactos ajenos. CI remoto consultado: 90ebe18 rojo por Unit+integración Neon y backlog de módulos, ajeno a este corte; no se intentó corregir ni afirmar verde global. Sandbox bloqueó refs/índices: escalaciones acotadas de Git local resueltas.

Esperar feedback del owner sobre esta tarjeta o siguiente ajuste concreto; no iniciar auditoría general ni otros pendientes por oficio. Bloques siguientes son contexto anterior subordinado a esta entrega.

## CONTEXTO ANTERIOR — 0242: UI PRIMERO POR INSTRUCCIÓN DEL OWNER (2026-10-18)

CORRECCIÓN EXPLÍCITA MÁS RECIENTE DEL OWNER: el prompt anterior de reanudación era incorrecto. Él va a indicar específicamente QUÉ arreglar de UI. Tratarlo como ajustes **L0 rápidos**, usar dos implementadores NUEVOS con paths separados, **SIN agente QA ni batería extensa**; owner prueba en browser y da feedback. No iniciar auditoría/contraste general, rediseño de superficies ni trabajo antes de su lista. Diff/estáticos focales pertinentes; no tests nuevos por ceremonia, no DB/matrices repetidas por presentación. Esta instrucción del owner prevalece sobre workflowQA anterior para ESTA fase UI. Handoff0242-ui y plan corregidos; prompt nuevo espera lista del owner. No implementadores activos ni códigoUI despachado. Mantener lógica validada, no push/PROD, preservar3201/túnel/artefactosajenos. Párrafos anteriores al clear que pedían QA independiente o reparto fijo de superficies quedan reemplazados por este bloque.

HANDOFF PARA CLEAR PREPARADO: **`docs/factory/0242-ui-handoff.md`** es la lectura compacta de reanudación. Contiene refs reales, preview local, aceptación manual y pendientes del owner, referencias exactas del laboratorio aprobado, invariantes a conservar y propuesta de dos encargos UI con autoresNUEVOS/QA independiente. No reconstruir desde los párrafos históricos de abajo ni releer toda la cadena. Verificado: NO hay agentes implementando ni QA corriendo; todos los agentes anteriores completed. NO existe aún ficha/reserva/WT/autor del arregloUI. Solo QA WT accepted67917506 queda operativo, principaldevd4352018 antes de guardar este handoff, mainfe1ee796. No se inició código ni se tocó3201/DB/PROD para preparar clear. Usuario pregunta por contexto y modo de trabajo: se recomienda clear del coordinador por largo historial, sin reiniciar producto ni perder pruebas; trasclear leer el handoff y empezarUI contraaprobado con cortesvisibles. No pedir nueva autorización para el alcance ya aprobado.

INSTRUCCIÓN VIGENTE DEL OWNER: cambia las prioridades a 1UI contra diseño aprobado,2impresión/precuenta/anulación sobre UI corregida,3peso completo,4retirada legacy/accesos,5fidelización/cupones,6regresión/accesos/rendimiento. Plan0242 actualizado con ese orden; NO continuar el orden anterior ni posponer UI. Dependencia confirmada contrato§150–153: bloquear/retirar writers antiguos POS/Counter ANTES de habilitar writesmass o quitar barreras; ese bloqueo técnico mínimo precede activación dentropunto3, retirada visual/menús/permisos completa puede seguir en4, resolviendo antes cualquier acceso imprescindible sin dejar usuarios bloqueados. Preparación/pruebas aisladas de peso no requieren esperar toda retirada visual. No push/PROD.

ACLARACIONES OWNER ya recibidas: NOTAS FUNCIONAN, problema de descubribilidad al final deOrden; no hay fallo de captura/persistencia confirmado. IMPRESIÓN SÍ ACTIVADA en negocio, ausencia de botón NO explicada por settingapagado; falta reproducir con estado real ycorregir UI/carga deajustes según evidencia. No habilitarautomático ni quitar guard/permisos. Owner ve UI como muy alejada del diseño; NOaceptaciónvisual. Prioridad nueva exige revisar laboratorio aprobado y preparar cortesUI manejables/fichas con autoresNUEVOS+QA antes código. Aún SINnueva ficha/WT/agentesUI; main localfe1ee796, principaldev, QA WT limpio679accepted disponible. Historial previo de circuitounit/Recetas/Stock/dinero/históricos probados porowner permanece válido; fidelización/cupones siguen sinmanual. Precedente«punto1cerrado»eraordenantiguo ysoloaceptaciónQAfuncional, no aceptaciónmanualUI. Párrafos siguientes históricos quedan subordinados a este bloque.

NUEVO REPORTE OWNER CON CAPTURAS: no encuentra impresión de orden/precuenta y reporta que ya no puede dejar notas. NO dar punto1 por aceptado manualmente. Captura detalle muestra sin botónprint, secciónPrecuenta parcial; editor muestra TextAreaField Nota del pedido vacío (no demuestra por sí solo persistenciafallida). Pregunta async pendiente: no permiteescribir / escribenoguarda / quiere notasporproducto / seguardanoseve. No adivinar ni ampliar a notasporlínea sinrespuesta/contrato. Lectura actual muestra note controlado session.change→draft.note→payloadtrim/null, serverupdateguarda ydetalle/renderTicket muestraorder.note; no fallo reproducido aún.

Impresión: MeasuredTicket solo muestra botón si printing.enabled; hookenabled depende settings.printingEnabled; defaultserverFALSE por decisión anterior spec0206. AjustesPOS opción«Imprimir tickets» activa guardado actual. No se leyó estado autenticado del negocio owner y NO se habilitó nada; ausencia de botón compatible con ajusteapagado pero no diagnóstico confirmado. UX oculta razón de indisponibilidad; revisar como parte UI contraaprobado. Capturas evidencian además unit sintraducir, formatoUSD6.00 vsUSD6,00, contenido repetido yjerarquíaalejada del diseño. UI previamente reportada noaceptada, propietario pidió corregir despuésimplementaciones; no iniciar rediseño/kitguarddrift deoficio. ReadskillImpeccable yaaplicada,noinit/contextreload; investigaciónread-only,sin producto edits/agentsnuevos/DB/3201changes. Faltarespuesta sobre nota para reproducciónconcreta.

CHECKPOINT VIGENTE: main local `fe1ee79603fe3ae1b476128c6188fcf788708a2e`, principal sigue dev. Conexión ticket/impresión/anulación autor `1fcba12c60e719ebc7c94f67a306e1ffde21682f` y MISMOQA `679175066559d64b3ec32c1567a1d64703569bf8` sobre `37a25b10f3068050af40e021e229496e94f74428` ACEPTADOS. Identidad de producto contra candidato y CAS desde QA limpio verificadas; factorypos-console-actions integrado/retirado limpio0procesos/main. Fix de captura desde provider vivo validado QA8unit+4browser propios remount→403→remount→replay/401/scope/A→B PASS0skip/retry; FAILdb4030c0 histórico preservado. Usa mismoTicketDoc/hookaceptado, prepareajustestraslistausable, voidcapturaoriginalsinrecapturaalremount/unknownbloqueasalir,cachécanónicasinGETpostwrite. No nuevoNext/authDBnative en este incremento, no hardwarepapelreal, no masscanónica/M1. Logsconsole-actions/evidence-fix-identity.json,informeQA versionado.

Usuario puede recargar http://localhost:3201/backoffice/pos?posV2=1 (Nextdev existente principal) y probar AHORA anular abierta/confirmación/cancelar y precuenta/reimpresión si negocio printingEnabled; no se cambió/detuvo3201/túnel. Punto1 IMPLEMENTADO/QAaceptado, pendientepruebamanualowner impresión/anulación y divergenciasUI. Owner ya confirmó circuito unit y pruebasRecetas/Stock/dinero/cambio/snapshotprecio/recargas/histórico correctas; fidelización/cupones sinmanualporfaltapase. UI NOaceptada, pidecorregirdespuésterminarimplementaciones. No extrapolar a seguridadglobal/cargafría/masa, rendimiento pendiente. Ningúnpush/PRODautorizado.

Siguiente trabajo aún NOdespachado: punto2 cortelegacy/permisos/entradas (Counter conservaClientes;directredeemsuspendido,saldos/historiapreservados), después activacióncompatiblemass yQA canónica completa, M1 ycorrecciónUI según aprobado. Dosimplementadores+QA, agentesNUEVOS/contextovacío por bloqueaceptado; no reasignar autores reciénterminados a trabajoB. Prepararfichas/contratos/paths antes código, serialmigracionesjournal y DBexclusivewrapper. QA WT limpio679175accepted disponible próximo continue. Solo QA WT quedaoperativo; autoresanterioresretirados. Artefactosajenos/M0/control/3201/túnel/demos intactos. Estimacionesprevias6–12h reconocidaspocofundamentadas; no repetircomocuentaregresiva ni ocultaresperascoordinador. Lo que sigue es historia de cortes anteriores.

ACEPTACIÓN MANUAL ADICIONAL DEL OWNER: confirma que todas las pruebas propuestas funcionan, salvo Fidelización y Cupones que NO ejecutó por no disponer de pase. Históricos explícitamente funcionan. Registrar cobertura manual de Recetas/base2unit→consumo proporcional, Stock, importes/cambio, recarga sin duplicación y precio congelado del recorrido propuesto, además del circuito unit previo. No hay registro instrumentado ni SHA/navegador/fixture exactos de esta prueba humana; no sustituir QA automatizada ni extrapolar a masa/seguridad/rendimiento. Fidelización y cupones pendientes de prueba manual, sin clasificarlos como fallo. UI sigue con divergencias reportadas y pendiente de corrección; no aceptación visual ni de todo0242. No push/PROD.

ACEPTACIÓN MANUAL OWNER: probó circuito unit propuesto en preview3201 y confirmó que FUNCIONA. Reporta varias divergencias UI respecto del diseño aprobado; NO aceptación visual. Pide terminar implementación y luego probar/corregir UI; conservar pendientes, no iniciar rediseño ahora. Pregunta qué probar en Recetas/Stock/dinero: proponer receta unit con base2unidades/100g, stock1000g, venta3→consumo150g/stock850g; producto3.25→total9.75/efectivo10/cambio0.25 (moneda2dec), snapshot de precio y recarga sin duplicados; cupones/pase si dispone, histórico/módulos como regresión. Mass canónica aún no activada, no prometer probarla.

Punto1 conexión QA FAILdb4030c0624e1a4a9639a2333803b871e815bdbf sobre675e2d9e. Registry void retiene capture de sourceClient cuyo hookusePosContext se desmontó(activefalse): remount mismaidentity cliente nuevo, retry viejo arrojaDiscardedPosIntent antesfetch y retira unknown/cache/canLeavetrue. Repro externo1FAIL0skip/retry en console-actions/qa-remount.log; harnesssingleton omitía lifecycle. Factoryauthor007rejected→reserved;QAFAILdelivered/rejected→reservedpreservado. MISMOautorconsole_actions_cp2d_impl REACTIVADO, debe proponer fix antes código sin recapturar otraidentity/ignorar scope ni editartransporteaceptadofuerareserva. Añadir regresión createPosClientREAL+lifecycle. MISMOQA revalidará despuésfreeze. Noaceptación niintegración deacciones;main2bd56ab2,sinpushPROD. Másdetalle informeQA enpos-qa.

Punto1: conexión ENTREGADA `007b1d2797ef7ba9d357964dce53b447c708880b`, producto891ffd9d/tests513b0afd/docs007, siete paths sin extensión. Autor tipos/lint/fmt/UIguard/7unit/15browser PASS, capturas390/1280 ABIERTAS y0procesos; logs /private/tmp/checkpass-pos-0242/console-actions/. Factorypos-console-actions delivered. QA NUEVOconsole_actions_cp2d_qa DESPACHADO en CONGELADO675e2d9ea47cea9caadd9578edb28645c4bfbdcb (dev7c3fc09d+autor), único0242-cp2d-console-actions-qa.md,SINDB/env/server. Revisa interacción/registryvoid/identity/capture/incertidumbre/noGETpostwrite yprintinggesto aceptado; no repetir matrices por ceremonia. Aún NOaceptado/integrado este incremento.

Owner quiere probar YA antes de seguir ampliando. Se comprobó servidor existente3201 read-only: node927/parent915 Next dev--port3201 cwdapps/merchant del principal, no se cambió/detuvo. URL http://localhost:3201/backoffice/pos?posV2=1 llega HTTP307→/ sin sesión, modo dev habilita entrypreview de código aceptado principal. Se puede ofrecer primera ronda MANUAL del circuito UNIT aceptado (crear/cobrar/resultado/lista/cancelar/guardar-reabrir), sin ticket/anulación operativa todavía hasta integrar incremento675 tras QA. No afirmar login/recorrido del owner ejecutado ni masa activada. QA nativa previa sí probó unit authDBtraswarmup; no rendimiento frío/securityglobalPASS. Usuario expresó demora>6h, temorregresionesseguridadvelocidad; se reconoció excesofragmentación/esperascoordinador y ETAno respaldada. Prioridad ahora revisión humana del corte existente, no hacer esperar puntos2–4. Main2bd56ab2, sinpushPROD.

ACTUAL punto1: ticket fixbc59c03e223f1232f9364f82313e9af13b2ca83d y QA2910857fa248ba61c7da12d7009a9e6add7ad9c7 sobre d0bcd4e8 ACEPTADOS. MISMO caso externo original esperado0 ahora PASS1/1 sin skips/retries, FAIL7bbb preservado; autor15browser/gates y39puros/capturas compatibles. Integrado mainlocal `2bd56ab2bd173c34274b432da53c4c269fec3654`, identidad producto y CAS desde QA limpio verificados; WTticket retirado factory limpio0procesos/main. Sin push/PROD.

Conexión AHORA DESPACHADA a autor NUEVO console_actions_cp2d_impl en /private/tmp/checkpass-pos-0242/pos-console-actions-0242 base2bd56ab2. Factory IDpos-console-actions-0242 reservado SIETE paths de ficha0242-cp2d-console-actions (guardadaeb65fd19 antescódigo), recursodoc SINDB/env/wrapper/Nextbuild. Propone diseño antescódigo y conecta ticket/impresión/anulación a consola previewlocal, prepareajustes traslistausable, voidinciertoconcaptura/body/versionconservados y navegaciónbloqueada, canónico mismafachada/ventanalocal sinGETpostwrite, elegirsoloelige/imprimirgestoseparado, callbacksidentitytardíosignorados. No cambiahelpersaceptados/entry/backend/activation; consola417líneas, extensiónconcreta previa si separavista. Kit/Impeccablehardencraftfloor/noinitcontextrootunavez, capturasABIERTAS preservadas, checksfocales; QAseráNUEVOalfreeze. AúnNOcódigoniaceptacióndeconexión aldespacho, punto1NOcerrado. QA WT limpio2910857accepted disponible próximo continue. Preservar artefactosajenos/M0/3201/túnel/demos.

Reentrega ticket MISMOautor `bc59c03e223f1232f9364f82313e9af13b2ca83d` (fixproducto8136b5a0,docbc59) YA deliveredfactory. choose fallo libera lock/muestra issue y no llama finish; fallback solo print/retry. Tipos/lint/fmt/UIguard y15/15browser0skip/retry PASSautor, tresregresiones nuevasunsupportedexacta/cancelled/writefailedselección. Financieros/renderers/transportesintactos,39puros/capturaspreviascompatibles sinrepetirporceremonia. MISMOQA measured_ticket_cp2d_qa REACTIVADO en CONGELADOd0bcd4e828410f501be51685f75b4627d7f0c2ab (su7bbbFAIL+fixbc59), factoryrefresh. Reproducecasoexternooriginalexpected0 yvalidadiff/logs;preservaFAILhistórico. TodavíaSINaceptación/conexión. Ficha0242-cp2d-console-actions guardada eb65fd19, esperaaceptarticket paraautorNUEVO/WT/reserva;nointerrumpirQAnimoverWTconchecks. Main707bcdb4,sinpushPROD.

Punto1 NO cerrado: QA ticket FAIL7bbb5697801f809ff85fd4506a0ca59200e158d7 sobre73bda997 reprodujo choose→unsupported→finish→window.print (esperado0/observado1) sin gesto posterior de imprimir. Informe/repro/logs /private/tmp/measured-ticket-qa; no defecto monetario/hardware, simulación determinista de disponibilidad. Factory autorce76 rechazado→reserved; informeQA entregado y rechazado→reserved conservando FAIL. Mismoautor measured_ticket_cp2d_impl REACTIVADO para fix hook+regresión+handoff dentro12paths; mismoQA revalidará trasfreeze, sin repetir matriz exacta ni rondas visuales intactas. No aceptar ticket ni conectarlo aún. Usuario informado del fallo y de que conexión todavía no empezó. Ficha siguiente0242-cp2d-console-actions preparada, requiere ticket aceptado y autorNUEVO; conectar impresión/ticket/anulación sin cambiosbackend/activation, todavía sinWT/reserva/despacho.

ACTUAL: consola eb093108913704a7f856ddc3941800ecf2c54f98 y QA NUEVO180175f5f20825a391095ff97d90c7e22d6e9c5b sobre49576a391ca775c5fd341e4f9b884e5627e8e704 ACEPTADOS. Main local `707bcdb4a99f92e64d12eaa5fcfaba08fdefd961`, identidad de producto contra candidato verificada, CAS desde QA limpio. Factorypos-connected-console integrado/retirado limpio0procesos/main. QA58/58purospropios0skip, reusa6browser/native1/inspect1/cleanup1 compatibles; mantienelímite warmupread-only/NOcoldfirstloadglobalPASS/M1. Consola previewlocal NODE_ENVdevelopment+posV2=1 sin corteproductivo, unitrealcanónicoprobado, sinmass aún.

Ticket ENTREGADOce76a92ffbf998fca44f56e13a955c28f4a660fd limpio12paths,productobac6219e; a95419e7solo2testsCOP±1 yce76solodoc. Tipos/lint/fmt/UIguardPASS,39/39puros y13/13browser0skip/retry,capturas390/1280ABIERTAS conservadas,0procesos. Factorymeasured-ticket delivered. QA NUEVOmeasured_ticket_cp2d_qa en CONGELADO73bda9975bf19210ef5f7c18d0866f93f0d68170 (dev707+autor),solo0242-cp2d-measured-ticket-qa.md,SINDB/env/wrapper. Revisaidentidadcontrato+interacciones,monedahistórica/tarifa9dec/rounding,gestosdirectosprepareexplícito,callbacksfallbacktardíos,legacycompatible. Logs /private/tmp/measured-ticket-0242-evidence/manifest.json,r2,r3;fallos iniciales conservados. Todavía NOaceptadoticket ySINconectarconsola. Siguiente incremento: conectar impresión/ticket y anulación operativa enpreviewlocal conautorNUEVO;ficha/reservaaúnpendientes, no retomarautorconsole para trabajoB. Después cortelegacy/permisos/activacióncompatible,masscanónica yM1. No push/PROD.

ÚLTIMO CHECKPOINT: HTTPvoid b290c57f/QA1c2b78b76f8ceb89154725fa1a7b7c19988fcd5f sobre2a983a6e ACEPTADOS e integrados. Main local `49215e06734bb4ebdbd8587b495e0d1748e10d5e`; identidad de producto/CAS desde QA limpio verificados. Factory pos-void-api-v2-0242 integrado/retirado limpio0procesos/main. QA auditó fuente/config/logs y5señales RequestNode24 propiasPASS, reusóCI5/5r2 compatible; conserva r1fallos y límitesHTTPunit/noauthNext/masscanónica. No push/PROD.

Consola conectada ENTREGADA eb093108913704a7f856ddc3941800ecf2c54f98, producto23b64a19, testfixtureb7a8f78a solo2stringsescala numeric24,9. Factorypos-connected-console-0242 delivered; recursoCI/puerto liberado trascleanupobservado. NativeNextdevelopmentAUTH/HTTP/DBreales unitUSD3.50 PASS1/1 con warmupREADONLYexplícito, GETorders1/POSTclose1/GETsessionmodules0 DURANTErecorrido; contextoantiguoscopeA/cookieB409sin efectos. Inspect1/1:1closed/1unitline/1payment3.50/B0;cleanup1/1bizownerssessions0/procesos0/puerto43252detenido. Cache17/17,browser6/6,tipos/lint/fmt/UIguardPASS. Primera visitafría providerGETsession/modulesFAIL conservada;CDPconfirmaorigenprovider,NOcoldfirstloadglobalPASS/M1. Capturas390/1280 ABIERTAS ypreservadas,logs /private/tmp/checkpass-pos-0242/connected-console/evidence-identity.json. QA NUEVO connected_console_cp2d_qa sobre CONGELADO49576a391ca775c5fd341e4f9b884e5627e8e704 (dev49215e06+autor),únicopath0242-cp2d-connected-console-qa.md,SINDB/env porahora, revisacompatibilidad/interacciones yreusaproporcional. Aún NOaceptada consola; fixesauthororiginal.

B NUEVO measured_ticket_cp2d_impl en /private/tmp/checkpass-pos-0242/measured-ticket-0242 base49215e06;factoryIDmeasured-ticket-0242 con12paths ficha0242-cp2d-measured-ticket/doc,SINDB/env. API propuesta y APROBADA: buildMeasuredTicket(PosOrderV2,settings,{now?,qr?})→TicketDoc comúnquantitynumber|string+metadataopcionalestado/tipo/identificador/nota; useMeasuredPrinting({order,client,context,prepare,onError}) preparaciónexplícita falseceroGET/truefuera camino crítico,documentoreadyantesgesto;choose selección y retry gestoseparado. Mismaautoridadcongelada terminal ykernelúnicoabierta,noNumbermasatarifa; noautoimprimir/recobrar; identidadretira callbacks/fallback/windowprint. MeasuredTicket orden+printing,feedbackestructuralcompatible. SINconsole/entry/routes/transportesnuevos/kit/guardias. Skillharden/craftfloor leída,contextrootunavez,noinit/rerun; capturasABIERTAS fueraautolimpieza. Autorreciéndespachado iniciacódigo, conservafixesQAnew. Después faltaconectar ticket/anulación enpreview,cortelegacy/permisos/activacióncompatible,masscanónica yM1. Sinpush/PROD.

Checkpoint vigente: consola conectada YA DESPACHADA a autor NUEVO connected_console_cp2d_impl en /private/tmp/checkpass-pos-0242/pos-connected-console-0242 basecd777d933e1d98fa6d436bfbd8155089f3ea5fbf. Ficha0242-cp2d-connected-console reservada por commitcd777d93 antescódigo yfactoryIDpos-connected-console-0242 con9paths/doc+CI EXCLUSIVA+puerto43252. Primero proponeownership/montaje/receta nativa; conecta listado→editor→cobro→resultado→listado unit con Next/auth/HTTP/DB reales, sin esperar ticket. Entrada nueva solo NODE_ENVdevelopment y queryposV2=1, producción/defaultlegacy hasta paridad; no authbypass/activaciónmass. No código nuevo aún al despachar. Owner preguntó estado: se informó con claridad que despacho había quedado pendiente del coordinador y se resolvió ahora; no atribuir progreso previo inexistente.

HTTPvoid entregado b290c57f1ab4c5f6fb31b4b0993adc9da1495246 (fuentefinale6c9bbed) limpio3paths,5/5Neon0skips/retries y tipos/lint/fmt/UIguardPASS; r1fallosoráculos/imports conservados. Teardownbiz/owners/sesiones/procesos0, recursoCI liberado alconsole. QA NUEVO void_api_cp2c_qa sobreCONGELADO2a983a6e4f71b2aebd237e88efb5daa9dc67c727 (devcd777+autor), únicoeditable0242-cp2c-void-api-qa.md,SINDB/env. Verificalogsidentidadcontratoycombinación, reutilizaCIcompatible; todavía SINaceptación/integración. Authoranteriorretiene fixes. Main local092c25c8. QAfuncionalconsola seráotroagenteNUEVOdespuésfreeze. Ticket/impresión aúnsinagente; podrátomarsegundaimplementaciónalaceptar/retirarHTTPvoid, pathsindependientesycontratosantescódigo. Sin push/PROD.

Última aceptación: cobro `2a8ce7a593bea0b7ffc6065432ff7cd4021a51e1` y QA NUEVO `581c3f107e2a04b7788de0e01050e1ffe366f7ef` sobre e85eb7f8 ACEPTADOS. Main local `092c25c8838282c11d64251a69f4e485a199043a`, identidad de producto contra candidato verificada y CAS desde QA limpio. QA65/65 puros0skip y tipos PASS, evidencia autor23puros/9browser compatible; límites preparados sin consola/authNext/DB nuevos. WT payment retirado factory limpio/0procesos/main. QA limpio581c disponible al próximo agente nuevo. El siguiente autor UI debe tomar PRIMERO conexión funcional incremental de consola según ajuste16abfcca, sin esperar ticket; todavía falta ficha/reserva y despacho. HTTPvoid B sigue en su WT/baseb681, fuente e6c9bbed, segunda CI viva después de primera3PASS/2FAIL por oráculos del test corregidos; tipos/lint/fmt/UIguard de r2 PASS, no mover ni editar mientras check vivo, CI exclusiva hasta teardown. No push/PROD.

Steering posterior del owner: pide integración por partes para reducir incertidumbre final. Se explicó que los commits ya se integran incrementalmente, pero la conexión funcional nativa se estaba dejando tarde. Plan actualizado: siguiente autor NUEVO tras aceptar cobro conecta primero listado→editor→cobro→resultado→listado con unit real/HTTP/auth nativos y QA, sin esperar ticket/impresión; estos y anulación se conectan como incrementos independientes. Conservar entrada legacy hasta paridad, montaje local explícito antes de código, sin activar masa ni publicar incompleto. Primera venta mass canónica tan pronto cutover compatible lo permita; CP4 confirma regresión y M1, no primera integración. Ficha concreta de consola aún por preparar/reservar. No ampliar scope de autores vivos.

Cobro entregado `2a8ce7a593bea0b7ffc6065432ff7cd4021a51e1` códigoe9ab5b1b. QA NUEVO measured_payment_cp2d_qa sobre candidato `e85eb7f8847e0183220beaff8071c99376c1380f` (dev4357895e+autor) informa sin hallazgos:65/65puros propios0skip/tiposmerchant PASS, hashes11fuentes+config íntegros y logs autor23/9 revisados; prepara informe. No aceptado todavía. B HTTPvoid código065e1122 con CI focal viva: NO editar fuente concurrente; imports sin uso y dos oráculos de error del test detectados, corregir después que termine check y repetir solo afectados. No liberar CI hasta teardown.

Checkpoint más reciente: main local `b68127aa9fbb0beb2121af26e5609eb1702df68b`; principal en dev. CP2c.8 autor `3511c9d28852b5e88604e4986363379cc8dd9441` (código0409a46b), QA NUEVO `10fd918484268191de9ffce308cc5f1253c6f826` sobre `71ca4a95b1765f8e1212fea7a15a7c838a2ea7a2`, aceptados e integrados tras identidad de producto. 57 puros+4 boundary y un escenario real Neon0skips PASS; tiposdb/domain/merchant/lint/fmt/UIguard PASS. Guardias24/2 backlog conocido sin nuevos offenders, NO verde global. QA auditó fuentes/config y logs compatibles, sin repetir DB. Anulación congela líneas/dinero/moneda y evento2 en una tx; replay temprano y legacy1 compatibles, detalle/listado join único escalar, solo voided_tickets. NO HTTP/authNext/mass canónica. WT measured-void retirado factory limpio/0procesos/main, CI liberada. Evidencia `/private/tmp/checkpass-pos-0242/evidence/measured-void/manifest.json`, informe versionado. Main CAS final apunta al merge b681, no a HEAD simbólico de QA.

B NUEVO `/root/pos_void_api_cp2c_impl` en `/private/tmp/checkpass-pos-0242/pos-void-api-v2-0242`, base b681. Ficha `0242-cp2c-void-api.md` reservada por commit8da79252 antes código; factory TRES paths (routes solo void, nuevo void-api-v2.neon.integration.test.ts y handoff propio), doc+CI EXCLUSIVA hasta teardown. Handler2 llama dominio aceptado, ausente/1 legacy intacto, desconocido409 antesbody, bodyV2 opcional real distinto de JSON inválido. Proponer request.body===null antes código, lector estricto para presente. Sin otros dominios/UI/DDL/activación. Env seleccionado privado solo wrapper tools/neon-test.sh serial, no copiar/imprimir. Agente nuevo conserva fixes hasta QA nuevo.

A `/root/measured_payment_cp2d_impl` sigue bloque propio12paths. Root encontró dos bugs concretos antesfreeze: payments[].paymentId prohibido por parserHTTP estricto y retry403 retiraba intención de close ambiguo. Autor corrigió wire local sin paymentId (sin cambiar parser/contratos públicos) y conserva closeUncertain/body/UUID tras403 bajo misma identidad; 401/cambio real sí retira. Regresión pasa body emitido por parser REAL sin DB. Última evidencia23/23 puros,9/9 browser funcionales afectados, tiposmerchant/lint/fmt/UIguard PASS; primera tanda12puros/7browser previa y sandboxlaunch7fail conservadas, no atribuir PASS anterior a fixes. Capturas390/1280 agrupadas ABIERTAS ya hechas. Preparando handoff/freeze, todavía NO aceptado; gitdir/psEPERM resueltos con escalaciones propias, no fallo producto ni espera owner. NO DB/env.

Ficha siguiente UI preparada `0242-cp2d-measured-ticket.md`, commit0ed60a6c previo a código; requiere cobro aceptado, autor NUEVO. Builder exacto V2 sobre TicketDoc compartido, resultado y hook preparados, precuenta/reimpresión y gesto directo sin fetch previo, moneda histórica/cantidades9dec/tarifa sin Number, callback tardío retirado; sin consola/servidor/transportes nuevos. Aún sin autor/WT/reserva. Después integración consola, retirada/permisos/activación compatible, QA mass canónica/combinación y M1. ETA provisional6–12h comunicada con incertidumbre, no promesa ni necesidad de respuesta. Sin push/PROD. Lo siguiente conserva contexto anterior; estos párrafos prevalecen.

### Checkpoint previo

Owner autoriza continuar sin otra respuesta: dos implementadores y QA independiente, entregables pequeños y agentes NUEVOS/contexto vacío después de cada bloque aceptado. Los autores conservan fixes hasta aceptación; no subdelegar. Coordinador único de estados/factory/integración. Main local `cf0fef49ade541e3daf8770b968ed921f95d14df`; principal permanece en dev. Sin push ni PROD. Artefactos ajenos, M0/control,3201/túnel/demos intactos. Decisión cerrada: gratis/2x1 no aplican al target mass; unit elegible en mezcla sí, porcentaje/fijo mass sí;409coupon_measure_not_supported sin efectos. No preguntar de nuevo.

Aceptaciones recientes, con sus handoffs e informes QA versionados: carrito a4f80dc6/QA1cd9c91b sobreca370c5a (producto ca94bed2,17puros y browser compatible compuesto, NO4final integral); publisher66b7d4a3/QA7e0c9c57 sobre4568f4e7 (102puros+3señales QA, CI5PASS1FAIL más focal1PASS5filtrados, NOintegralverde); transporte d35e8017/QA23dfc75b sobre840cdcdb (autor46 yQA39puros/tipos PASS). Sus WT fueron retirados factory limpios/0procesos/main tras verificar identidad de producto. Publisher opt-in V4 exige settlement/capture/paymentsMetadata/commissionByLine, conserva originales y replay antes reobservar; advisory solo garantiza V4 cooperativo READ COMMITTED. Rawmass de publisher NO era POS/core canónico ni E2E. Transporte opt-in1|2 usa captura estable y mismo panelRequest, scope case-insensitive y PosError.payload íntegro. Componentes/harness no certifican nueva auth nativa. Logs cart-*, cart-qa, evidence-sale-publisher-v4, v2-transport-evidence y v2-transport-qa-evidence bajo /private/tmp/checkpass-pos-0242.

Comandos CP2d.3 aceptados: inicialf157 rechazado con QA808cb sobre f0c67a29; fix7dd6bcda52aa243fd1acc4b08dc2facc47d9988e aceptado con QAbb617b4d85c6a11310b9ce1b14942ca2add03c49 sobre dc0b7ad316fe8fe51925753e3f9444a1e5288b6d. Corrigió tres bugs reales: summary cerrado bruto/saleTotalnull en vez de neto, downgrade closed/voided→open con misma versión y pendinghistory sin snapshot no invalidado.46puros/tipos/gates y repro independiente QA PASS; FAIL original conservado. WT retirado, mainba9f tras identidad. API MeasuredOrderCommands(clientV2,mismaPosCache,{historyStatus:active|voided,uuid?}) mantiene intención congelada; facade comparte el mapa y revisa summary adelantado sin falso order autoritativo. Logs order-commands-evidence y order-commands-qa-evidence. Bug posterior de recuperación detallado abajo, ya corregido y aceptado en8fa28a66.

Acreditación CP2c.5 aceptada: autor6ff74300044840cc1d961a438960fe42e22b2848, QA61b251601b0ec7617d39473ecba6b43ac055174e sobre7d6f0186.50puros/tipos/señal independiente de JPY/COP entero, USD decimal, cociente exacto, net0 e int32 PASS. LegacycomputeAccrual intacto; nueva variante acepta collected entero minor0. CI18 casos reales compatibles más focal1PASS18filtrados tras fixtures corregidas; NO19integralverde. Lookup coreprevia409request_reused, replayPOS pertenece al caller, sin reconstruir settlement ni catch23505 como éxito. WT retirado; logs evidence-measured-accredit y evidence-measured-accredit-qa. Masa positiva solo pura en ese bloque.

Cierre CP2c.6 ACEPTADO: autor214a5e1006227d9d823d64a2761a6de059375155 (código84716f54), QA41640d79c80cef11f982e5aad993a037a206b101 sobre cb232c3b4a366204292d424280abd2fc19d1b233. Main e72b9d2d por identidad y CAS desde QA limpio; WT retirado factory limpio/0procesos/main y DB liberada. Opt-in INTERNO, sin rutas/activación: módulo compartido sin validar→config→businessSHARE→POSUPDATE; replay misma key antes reobservar, snapshots exactos, acreditación una vez como autoridad de settlement y pagos/capture/comisión/publisherV4/freeze/closed en una tx. closedAt de orden/evento es capture.captured_at, now solo cupón. Ronda2 congelada14PASS1FAIL (15casos), único oráculo originalAmount strings→racionales corregido focal1PASS13filtrados; NO15integralverde. QA reconstruyó hash anterior cambiando solo expectativa. Unit canónico real: venta20/fee0.50, recursosRecipes/comisión, Stock−2, deliveries2 aplicadas, derivadoV2 y replay congelado. Exploratoria3PASS9FAIL con fuente mutable NO reutilizada. Tiposdb/domain/merchant/lint/formato/UIguard PASS, parser21+boundary10 y QA31/tiposmerchant PASS; guardias45/2backlog sin nuevos offenders. Rolconsumer, masa positiva canónica, HTTP/auth/Next/M1 excluidos. Logs measured-close-evidence e informe versionado.

Editor CP2d.4 ACEPTADO: autor02b2160e794b7e8ff0336300d654ddc7b09a4dbc baseba9f, QA58b9d17f6630ab204bd0128d72831483d0d5dcec sobre ee4de9004fbf8762d69f047c633243ed5ba47c9a (incluye dependencia aceptada8fa). Diez paths tras extensión9487b1c1 de measured-cart.tsx. Session padre mantiene commands+borrador, requestExit bloquea pending/uncertain y selección no abandona incierto; identidad real retira, DTOclosed/voided nunca onPrepare.4tipos/local/mesa/nota/catálogo/conflictos/preparaciónMostrador, aún SIN consola/checkout/ruta productiva. Kernel único distribuye total/filas y prop opcional lineAmounts defaultcompatible; COP2×0.49 muestra1+0=1, buffer parcial no muestra importe viejo. Hookmesas acepta clientV2 opcional sin cambiar legacy. Autor4puros/tipos/lint/fmt/guardPASS, browser10/10 previo y8/8 final tras note1000; capturas normales/COP3901280ABIERTAS en inspección+única confirmación. QA tipos integrados,8browser y3confirmacióncaptura PASS: POST perdido→retry403/422/409 sigue uncertain, misma intent/UUID/body/capture incluso remount, salida/local/tipo/primaria/nueva save bloqueados y recovery posterior canónico; lateunmount/voided/conflictos/identidad PASS. No full10final por retry; evidencia compuesta explícita. WT retirado factory limpio0procesos/puertos/main, identidad contraee4 yCASmainaae9. Logs editor-evidence, editor capturas y directorio QA del informe. SIN DB/Next/auth nativa nueva.

Hallazgo root RESUELTO por fix8fa28a66 tras aceptar comandos7dd6: POST pierde respuesta→uncertain, retry403→rejected, nueva create generaUUID2 aunque recurso previo sigue desconocido. Repro aislado de state con contexto/transporte doblados, NOauth/DB/commitreal: /private/tmp/checkpass-pos-0242/uncertain-retry-evidence/reproduce.cjs y reproduce.log EXIT1 generated2/sentKeys key1,key1,key2 sobremainba9f. Primer script falló por resoluciónTSX, setup-failure.log preservado y excluido. Root no editó producto. Ficha0242-cp2d-create-uncertain-recovery reservada por commit b1372078 antes código.

Fix recuperación CP2d.3b ACEPTADO: autor NUEVO8fa28a66db233f93c4eec53218303c5ae51d25b4, QA NUEVO2099e941c895ce4a7dad5070b419f7ecfb00f9b4 sobre da0726a976d8fc783f10038506fd595c269f9ac9. Flag interno attempt.uncertainCreate conserva stateuncertain+error completo ante403/422/409 tras POST ambiguo, sin liberar otra UUID/body/capture; primero4xx y PUTconflicto intactos. DTO válido limpiaflag antes facade para conservar revisión cache_revision_ahead del recurso conocido.56/56 focales (46previas), tiposmerchant/lint/formato/UIguard PASS; antesfix6FAIL50PASS y typefixturefallida preservados. QA56 y repro root mismo script PASS generated1/keys key1,key1. Identidad comprobada; main8cb6439f porCAS desdeQA limpio; WT fix retiradofactory limpio0procesos/main. SIN DB/env/browser. Logs create-uncertain-recovery-evidence, informe versionado. API pública igual; autor UI NO trae main a su WT (evitar cambiar scope/base), candidato QA del editor incluirá fix aceptado y probará interacción. Ningún PASS del helper viejo acredita rechazo posterior a incertidumbre.

HTTPclose CP2c.7 ACEPTADO: autor31f47658aa6df3b18ee75e9f1bdc2c869c25304c (código58118dd0), QA40d23b52b832d17e260914b12f5b3d7eab10bdcc sobre6b9f19f2d588c12c440d739b20820ac8953717c0. Handler headerausente1legacy/2closeMeasuredPosOrder/desconocido409 antesbody/efectos trasguard/scope; private/no-store/DTO2/errororder íntegros. CI final completa4/4PASS0skip, tiposmerchant/lint/fmt/UIguardPASS; boundaries24/2backlog sinnew. QA tiposintegrados+35focales y hashes fuente/configPASS, CI compatible reutilizada sin repetirDB. PrimeraCI4/4 antes oráculo añadiódiscount:null por tipo; segunda4/4 final, hashes conservados. Harnessguard explícito/dispatcher/scope/dominioDB real NOauthnativaNext. Maincf0 por identidadcontra6b9f yCAS desdeQA limpio, WT retiradofactory limpio0procesos/main, CI liberada. Logs close-api-evidence e informe versionado. NOvoid/activaciónmass/UI ni POScompleto. QA terminó40d23b52 limpio0checks/procesos, factoryaccepted; pos-qa disponible para próximo NUEVO agente al freeze, SIN DB/env/wrapper.

Restan editor/consola/checkout/QR/cupones/result/ticket/impresión, ensambladoHTTP/void, retiro legacy/permisos, activación compatible, QA real mass/combinación y M1. Antes quitar barreras mass, retirar/rechazar Counter legacy y escritoresPOS antiguos. total_snapshot no autoridad única de abiertas con moneda mutable. M1 incluye smoke control antiguo contra schema y30pares AB/BA, todavía no iniciado. User pidió estado/pendiente/ETA: respondido cinco bloques y estimación PROVISIONAL6–12h adicionales de ejecución/verificación con incertidumbre de integración/M1; no promesa ni decisión pendiente. No necesita aportar nada para continuar; no detenerse con un final de solo estado.

CI remoto releído pnpmci:status: origin/main90ebe18 ROJO Unit+Neon, run39080150647; no corregido/publicado ni verde global. Guardias conservan backlog expenses→stock y cinco core literals probados, sin nuevos offenders permitidos. Skill impeccable aplicada/contexto cargado una vez por root, no rerun/init/drift ni artefactos ajenos. UI kit/COPY/harden/craft-floor, inspección390/1280 agrupada+máximo confirmación; ChromiumMachPort1100 runner propio escalado autorizado. Gitdir/psEPERM son setup recurrente: escalación acotada propia autorizada, aviso inmediato, no esperar owner.107migraciones LOCAL previas, ninguna migración en estos bloques. Sin push/PROD autorizados.


A NUEVOmeasured_payment_cp2d_impl en /private/tmp/checkpass-pos-0242/measured-payment-0242 baseaae9a860916402d9e61e3d481bc23bef2a63f356. Factoryreserved ONCEpaths ficha0242-cp2d-measured-payment (5e730dc1 antes código), recurso doc, SIN DB/env. Sesión de cobro padre y vistas QR/cupón/checkout preparadas, NOconsola/listado/ticket/impresión/ruta productiva. Proponer API/ownership/estados antes código. Reusar decideMeasuredBenefit/buildFinancialAmountsFromSnapshots/computeAccrualFromMoney puro; no Numberautoridad ni adaptar masa aCounterDTO. Resolve explícito y contexto temporal, revalidacióncupón/métodos/importe requiere revisión, excluir beneficioLOCAL sin POSTremove; gratis/2x1noMASStarget/mixunitválido/pctfijomass. Neto0payments[] sin medioficticio/GETmedios. Congelar closeUUID/body/version/target/payments/capture antesawait, doubleclick1, cierreincierto conserva intención a través de rechazo de recuperación hastaDTO/revisión explícita; no nueva clave ni salir/remount para abandonar, identidadREALretira. Canonicalclose callback una vez/cache sinGETextra. Kit/COPY/impeccableyaaplicada contextrootuna vez; no rerun/init/drift, inspección3901280 agrupada+confirmaciónmáxima, runnerChromiumpropioescalado autorizado. Evidencia focal/harness noauth/DB/cámara real. Autor nuevo recién despachado, conserva fixes hastaQA NUEVO.

B NUEVO measured_void_cp2c_impl en /private/tmp/checkpass-pos-0242/measured-void-0242 basecf0fef49ade541e3daf8770b968ed921f95d14df. Factoryreserved NUEVE paths de ficha0242-cp2c-measured-void (f002c84f antescódigo), doc+DB CI EXCLUSIVA hasta teardown; env seleccionado privado solo tools/neon-test.sh serial, sin copiar/imprimir ni otrasDB. Diseño APROBADO parserpuro undefined→{} solo versionopcional1..int32+UUID; advisorymóduloshared→config→businessSHARE→POSUPDATE por tenant; replayvoided temprano antes reobservar y sinappend, abierta revalida lockModuleEnabled antes escribir (root aclaró que advisory no prueba móduloactivo), versión y snapshotsordenados. KernelAmounts una vez, financialSnapshot+totalSnapshot y appendvoided2→status/hora en una tx, SINsettlement/pagos/venta/loyalty/cupón/Stock/comisión. Vacía formato exacto cero si kernel necesita rama. Helpervoid-snapshot valida envelope/payload2 y proyección SQL escalares evento único business/type/source/version para read/list; moneda/total congelados y líneas financialSnapshot, legacyvoid1 intacto. Métricas alias1+versión2 explícita solo voided_tickets, no revenue/physicalventas. Sin DDL/routes/activación. Autor inspecciona fixtures y prepara SQLrollback postappend/analyticsreal antes código. Gates unitcanónico real/negativos/replay/monedaposterior; masspositivo puro, no canónico/HTTP. Fuentes congeladas antes tests, no editar mientras vivos, teardown IDs propios completo0procesos antes liberar. Trasaceptar otroagente conectará HTTPvoid, todavía sin ficha/reserva.
### Checkpoint anterior conservado

### ESTADO ANTERIOR — 0242: DESCUENTOS Y HTTP V2 ACEPTADOS; CARRITO UI Y PUBLISHER V4 CON AUTORES NUEVOS (2026-10-18 UTC)

El owner autorizó continuar autónomamente con dos implementadores y QA independiente, entregables pequeños y agentes nuevos/contexto vacío por bloque aceptado. No hace falta respuesta para seguir. Coordinador único de estados/factory/integración; máximo tres WT, sin subdelegar. Main local `62bd1e907fe87635b0917261517e1b810a7502fc`; principal permanece en dev. Sin push ni PROD. Artefactos ajenos, M0/control,3201/túnel/demos intactos.

Aceptados antes: lectores6a5124cb/QA639de186; listado2548c454/QAc1dcf81b; create61228394/QA4ad8af0f; writer core5eb2d647/QAf7a55793; PUT79b6b4b0/QA04f914c9; QR mínimo94aee107/QA07780cf3. Sus handoffs/QA conservan evidencia y fallos originales. PUT pasó corrida completa19/19 (11create+8update),35puros QA y tipos; arregló conflicto `products[]` real descubierto después de aceptar create. QR pasó4CI/1puro/tipos3; intento extra de assertions tras PASS fue revertido114e8d6a, árbol final idéntico86bd y no se atribuyen asserts no ejecutadas. Todos sus WT retirados por factory limpios/0procesos/main tras verificar identidad de producto. No confundir componentes/opt-ins con cierre medido E2E.

Descuento exacto ACEPTADO: autor `af9797c9d13ae3fb55286c5a3477cdd57823a2c8`, QA `bf6f732c44362ce8673b3373c95a9d138a5d61a4` sobre `c944b0e83d368852a2a73695100fc4029948f1bc`. Main avanzó a da3cfbc5 tras identidad producto. FinancialInput legacy intacto; V2/snapshots aceptan unión XOR amount decimal | originalAmount racional exacto, mismo d0/normalización/reparto/validator. Helper POS puro compartido usa originales para %/clamp fijo, monedaNULL legacy compatible, selector unit para gratis/2x1, sin imports de servidor ni límites arbitrarios de dígitos. Root+QA hallaron porcentaje padded real10.00/100.00 rechazado en9c784: repro independiente FAIL conservado y fix BigInt exacto enaf979. Final130/130 puros, repro4/4 y tipos3 QA/autor, lint/formato/UIguard/check-numbers PASS. SIN DB/coupon locks/consumo/accrual/cierre. WT exact-benefit retirado limpio0procesos/main. Logs `/private/tmp/checkpass-pos-0242/exact-benefit-evidence` y `exact-benefit-qa-evidence`.

Ensamblado HTTP ACEPTADO: autor `bec11e2a41094ffd67b33d53a0ca3285070be666`, QA `2bb944b29d2a12a63886e000941e182524ff4354` sobre `9ee11e981da63c80685e163b6e4454c61f73a66c`. Main actual62bd1e90 tras identidad. GETorders header2 ya conecta listado V2; POSTresolve header2 ya usa mínimo sin catálogo/rewards/shortcuts. Ausente/1 legacy, desconocido409 tras guard/scope y antes de efectos, private/no-store. CI inicialcf98327a4PASS/1FAIL por fixture0.499 que violaba barrera; test corregidod8222eef usa spy de catálogo y DB real, focal1PASS/4filtrados. Evidencia compuesta compatible, NO corrida integral verde. QA tipos merchant+130puros PASS; autor tipos3/lint/formato/UIguard y56tools PASS. Teardown explícito negocio/consumer/membresías/proyección/owner/staff/sesiones0;0procesos. WT pos-read-api retirado factory. Logs `/private/tmp/checkpass-pos-0242/read-api-evidence-cf98327a` y directorio d8222eef del handoff. CI liberada antes de retirar.

A NUEVO `measured_cart_ui_cp2d_impl` en `/private/tmp/checkpass-pos-0242/measured-cart-ui-0242`, base da3cfbc56a481c105d7251bc8bc7ce426c5102cd. Factory `measured-cart-ui-0242` reserva ocho paths de ficha0242-cp2d-measured-cart (commit6bdcff6b previo a código), recurso doc; SIN DB/env/wrapper. Modelo aprobado: snapshot por línea existing/new y catalogRevision solo nuevo, fuente quantity/unit separada de buffer/presentación/touched, aproximación no terminante nunca se serializa por cambiar vista, captura mass explícita sin1kg implícito, inválidos bloquean confirmación/serialización. Mantener líneas separadas es válido; no llamar canCombine por ceremonia si no fusiona. Harness reutiliza startCatalogHarness sin extensión prevista. No sustituye PosConsole ni conecta transporte/cobro en este bloque. Skill impeccable aplicada; root ya cargó contexto una vez, no rerun/init/drift ni artefactos ajenos. Leer harden/craft-floor antes UI; kit/COPY obligatorios. Inspección390/1280 agrupada y máximo una confirmación; Chromium sandbox1100 runner propio escalado autorizado. Autor estaba empezando código, aún sin freeze.

B NUEVO `sale_publisher_v4_cp2c_impl` en `/private/tmp/checkpass-pos-0242/sale-publisher-v4-0242`, base `c031e0d1ee01084784d231c5cf6ff539bf38e830` (main62bd+ficha). Factory `sale-publisher-v4-0242` cinco paths exactos de ficha0242-cp2c-sale-publisher-v4, doc y DB CI EXCLUSIVA. Publisher interno opt-in V4 con originales/settlement/capture explícitos y replay congelado; legacy publishSaleClosed y alias1–3 intactos. No close, consumers, schema ni activación. Debe proponer firma/bijección/replay antes de código. Env seleccionado `/private/tmp/checkpass-pos-0242/private/ci.env` autorizado solo con tools/neon-test.sh serial tras freeze hasta teardown; no copiar env ni otrasDB. Todavía sin wrapper al despachar.

QA anterior HTTP terminó. WT `pos-qa-0242` limpio en2bb944b2 aceptado,0procesos, disponible para continue/merge/refresh y NUEVO agente según próximo freeze. No mover un WT con checks vivos. Autores anteriores terminaron; no darles otra tarea/contexto. Commits QA propios del único informe reservado están autorizados; prohibición de refs se refiere a principales/ajenas, no a su commit de entrega. Gitdir/ps EPERM son setup conocido, escalaciones acotadas autorizadas sin pedir otra vez al owner.

Restan carrito/editor/interfaz POS conectada, cierre/voidV2/acreditación con cupones/efectos reales/recuperación/ticket, retiro legacy y QA conjunta/M1. Sin decisión owner pendiente ni porcentaje/ETA fiable. Antes de habilitar masa, retirar/rechazar también Counter legacy y escrituras POS antiguas; barreras siguen activas. total_snapshot no es autoridad única de abiertas con moneda mutable. Publicación y PROD solo con autorización explícita por caso, no solicitada ahora. Guardias amplias conservan backlog24/2 conocido, no afirmar verde global ni origin/main arreglado.

Decisión cerrada: «No aplican a productos por peso. Gratis ni 2x1». Solo se excluye el target mass; unit elegible en venta mixta y porcentaje/importe sobre peso siguen permitidos.409 coupon_measure_not_supported sin efectos. PWA fuera, canje directo suspendido, saldos/historia intactos. No volver a preguntar.

CP0 aceptado e integrado: tipos A329c7917/QA7fc88bad; LISTA c379c9a8/QA80b32497; flujos8dca14ee/QA9ee475dc, combinado a5cbd20c (53 pruebas puras+2 instrumentales y tipos). M0:36 entradas (30 reload+6 first),888 SQL pares;18 flujos+3 smokes,2856 SQL pares y21 cierres/ledgers/eventos propios verificados, cero erroresSQL. Solo referencia descriptiva, no POSV2 ni mejoraM1. Fallos originales preservados. Recetas desactivadas, wallet suprimido y cross sin origen: no certificar entrega externa.18 GET de refresco sin finish después del cierre: M1 observará esa cola fuera de closeConfirmed simétricamente; no inferir cancelación/status/bytes.

Control archivado: buildSource6f8e1e9c, BUILD_ID VLV2fFFeM_dUWKnxvv7iY; /private/tmp/checkpass-pos-0242/private/control-build-6f.tar.gz, SHA25654cbc567143f7d3e2af43309810c14da6bea647ab50926534ecb4b78109ec5fe. Campaña flujos fuente29b716cb. Selected/env/fixtures/cookies/RAW privados en esa carpeta, no imprimir secretos. M0 preservado, no cleanup DB/WT/archivos. Sus servidores ya detenidos.

CP1a financial e9d409ac/QA9a4a52a6 aceptado e integrado:88 pruebas, tipos; núcleo único, input medido estricto y wrappers snapshots confiables separados. Scope servidor1af3d7f3/QA0b52df93 aceptado con financial sobre8a9b76f9:138 focales+4 CI/teardown0,15 rutas POS optional, guard→scope→dominio, private/no-store. Dos guardias between/literals FAIL preexistentes demostradas por6 blobs/hash idénticos a00efff81; no afirmar todas verdes. Fallo inicial fixture staff[]/cleanup preservado y3 usuarios propios saneados por wrapper.

CP1b.1 lectores8624cda8/QA745bff45 aceptados e integrados sobre0cf6d209:101 pruebas puras+6 CI y tipos. DBnumber/string padding9→unit seguro, snapshots/carrito exactos; overflow de edición422 revierte cabecera, versión y líneas dentro de la transacción. Sin DDL en ese bloque; teardown completo y0 procesos.

Cliente scope b0127037/QA7f9dce96 aceptado e integrado sobre0465a6c2:15 puros/boundary+16 browser (5 contexto+8 pago+3 impresión), tipos y guard UI. Producto/build2c4ef9eb, BUILD_ID cE0AIVAqRwZmMQ5K5Q_ER. Nativo:0 GET sesión/módulos extra,1 listado scoped, guardar intenciónA/cookieB409,1 escritura sin retry, retiro documental/borradorA ausente; inspect/cleanup propios1/1, sin efectos. Evidencia /private/tmp/checkpass-pos-0242/scope-client. Captura inicial body falló por navegación; CDP pausa entrega de respuesta real sin sustituir payload (no latenciaM1). Test impresión584 actualizado con autorización bb77: NavigationAPI retiene intención en componente para observar ticket tardío/print0 en documento viejo y luego libera navegación; nativo separado acredita fullnav real. Fallos anteriores preservados. Servidor18812 detenido con TERM escalado,43242 libre, fixtures propias eliminadas,0 procesos. No certificar dispositivos físicos/R2. Skill impeccable aplicada: context cargado una vez por root sobre pos-console, refinamiento harden/optimize/craft-floor, sin init/rediseño/artefactos ajenos.

Catálogo storage ad9df221/QA98ab4e39 aceptados e integrados:0102,2 tarifas numeric24,9 y barreras temporales de centavos/rango legacy;56 pruebas autor yQA (46 puras+4 storage+6 lectores), tipos, teardown0. Decoder puro96195674/QA63cd3c97 sobre639aff67 aceptado e integrado:157 focales+4 app-boundary, tipos. Wire union legacy|V4 sin mutar payload; vista separada {payload,lines}. Legacy decoder sigue1–3, safeInteger sin estrechar; no productores/subscribers/V4 operativo. Los4 app-boundary no sustituyen las guardias de módulos.

Quantity storage00ce3546/QA6cb655d8 sobre46d1d9b0 aceptados e integrados:0103;4 tipos numeric24,9,8 metadatos históricos unit y6 barreras temporales, writers string/cast numeric preservan DTO/eventos number.16 CI storage/lectores/catálogo/FK, decoder68, principal10, tipos db/domain/merchant PASS. ENOENT inicial0casos preservado y corregido. Se corrigieron2 regresiones NUEVAS0242 de fixtures sin tocar guardias: test catálogo movido de server/ a modules/pos/server/ (solo imports/URL) y provider recipes→provider-a en decode-measured.test. Quedan únicamente between/literals del backlog00efff81:expenses→stock y5archivos core, hashes sin cambio. No atribuir regresiones nuevas al backlog por estar en base posterior. Fixtures/owners/esquemas propios retirados,0 procesos, CI liberada.

Root aplicó0102+0103 a la base LOCAL con Node24 `node --env-file=<principal>/apps/merchant/.env.local packages/db/src/migrate-local.ts` desde WTdata00ce después del PASSQA y antes de integrar descriptores:EXIT0,104 migraciones local. Host local proxy verificado; ningún endpointPROD ni env copiado. Local health3201/api/health HTTP200 después de integrar; servidores/túnel intactos. Esto no es una migraciónPROD ni una nueva prueba financiera autenticada.

Recetas storage285662df/QA646b12b5 aceptado e integrado tras candidato dcbc9f98035067f0e69484fdd8fb061d5573ea94:0104,3CI/0FAIL/0SKIP54.28s y34puras; tipos db/domain/merchant,lint/formato PASS. JSONdiff solo3tablas/11columnas/3checks, bases capturadasdefault1unit y sourcesV2 con4ratios canónicos positivos/proyecciones0. Legacywriter/consumer reales preservados. Primer fallo de fixture esperaba1delivery, observado2 recipes+core.analytics; corregido exacto2 y ambas deliveries explícitas, log original preservado. Guardias24PASS/2FAIL exclusivamente backlog conocido, sin nuevos offenders. Teardown owner/negocio/esquemaPASS y0procesos, CI liberada.

Root aplicó0104 LOCAL protegida desde WTdata después del PASS independiente y antes de integrar: script migrate-local rechaza host no local antes de conectar, EXIT0/105 migraciones. Sin env copiado, PROD ni test fuerawrapper. Health3201 después de integración HTTP200; servidores/túnel/demos intactos.

Expansor puro Recetas41d2aaa2/QA8287f8fb aceptado sobre13140830:125 focales+122 escenarios propios PASS, tipos/lint, guardias24PASS/2FAIL backlog. Sin runtime; ambos racionales y ledger3 por línea/insumo con proyecciones0 conservadas. Autores anteriores terminaron: no darles nuevo bloque.

Analytics base 9bc8f49f (código00c8fd26)/QAa2580a80 aceptado sobre0a699913:115PASS (62domain+53merchant), tipos/lint/formato. quantityExact autoridad, unit/mass separadas, inválidos complete:false; fixture unit fraccional corregido por contrato y revisado. ConfigTEMP fuera repo para pruebas domain, intento inicial0tests preservado.

Lector analytics be66d39e (código9b62b86c)/QA373d6917 aceptado sobre f2d192ebc59d71763f5681bc307b940f4274c631. Autor69puras/consumidores/app-boundary,4CI monthly y2CI evaluation con7excluidos deliberados; QA reprodujo12decoder+tipos/lint y revisó/reutilizó DB compatible, sin repetir por ceremonia. Texto exacto previo Number, allowlists mass conservan local reference/extended, oráculo solo añade campos/allowlists sin debilitar criterio. Teardown/0procesos. WT/task pos-recipes-exact retirados tras main.

Captura/provenance 637ae1f2 (código f9a35b9fae04d1cce442c1c821d3d525ae7127fb)/QA70d82a5b aceptados funcionalmente con límites sobre e9dd2d4847c01e663fe33efd58460ae78ecc4420.59puras/tipos3/lint/formato, guardias24PASS/2FAIL backlog. QA completa10PASS/1FAIL por timeout Neon pool.connect antes de assertion de combo vacío; recheck afectado1PASS/4excluidos, mismo código/config y teardown. NO afirmar full11PASS ni global verde por retry. Autor también preserva10PASS/1FAIL por duplicado derivado y foco posterior1PASS/4excluidos tras fix. Revisión/identidad y cobertura compuesta permitieron aceptación local proporcional; no publicación.

Dos fixes reales de replay dentro de esa entrega: persistProvenance rechaza añadir/omitir/cambiar fuentes de snapshot existente; publisher recipes.consumption.applied conserva evento/ID/observedAt/deliveries originales y valida identidad sin reobservar costo/inventario. Replays por delivery serializada, no garantía de llamadas directas concurrentes. Snapshot vacío sin marker. Fixtures rawV4 persistidas con refs reales de producto/insumo/recetas/composición/resoluciones, pero sourceOrder/Line son UUIDpayload sin filasPOS/core. No afirmar cierre E2E; gate órdenes reales sigueCP2c. Primer autor tuvo fallos de capacidad:4archivos/hash/patch preservados en /private/tmp/checkpass-pos-0242/captured-capacity-recovery; sustituto limpio terminó, incidencias en handoff. WT/task pos-data retirados tras aceptación/main, logs privados intactos.

Traductor POS 6dc4b621 (código d3c40dfc, fixture3e1bffed)/QA740af13f aceptado sobre d2d4cdd1635cf66c40d8758c15d4eb3f3614dc6d:192PASS independientes, tipos/lint/formato, guardias24PASS/2FAIL backlog exacto. V4 unit→units_sold, mass→mass_sold_g exactos; legacy/source keys/revisions/conteos/dinero/campañas intactos. Helper AN3 envelope1/payload3 corregido explícitamente a versión real del payload sin relajar decoder. Sin DB ni producer4. WT/task pos-metrics retirados tras main.

**Hook aceptado e integrado:** autor03cab45d8ee279cbb3098d04f66f942063fc0dc1, código corregido61dca7448959a99b7cbf77b05644926fa7271171, QA9ad94226355a15c450ccbff2149535b5ddae9a13 sobre030dd65796edd9d2577828f14b8e9b10829ccf37. Hallazgo QA real [A,A] frente[A,B] corregido con mapa/unicidad/biyectividad y negativo persistible, sin debilitar constraints. Primera CI70361885=1PASS/4FAILtimeouts preservada; R2 completa6PASS/0FAIL/0skip92.64s, teardown ambos owners/negocios/0procesos.4puras/tipos3/lint/formato PASS; guardias24PASS/2FAIL backlog. QA revisó fix/log y reutilizó CI compatible sin repetir. Main local b109a36540035e4f3de7bb9ea36e373289e37cce por CASFF desde WTQA limpio, identidad producto con030dd comprobada. Hook todavía no llamado por writers catálogo/importación ni certificado para carreras. WT/task measurement-hook retirado por factory limpio/aceptado/main; CI liberada.

**Derivado aceptado e integrado:** autor28728305870cbd6e605ea91d7f14e9d550ea3b64, QA6c3ff0ec63b9c99830c58b475880b08d7e5673a2 sobre efd067cf826027cf0b5904bbc642d74579491187. QA reprodujo37puras y4CI PASS/0skip97.80s, merchant tipos/lint/formato PASS, guardias24PASS/2FAIL backlog exacto. Parent completo por JSONB parametrizado incl originales subminor diferentes que normalizan igual; replay conserva payload/observedAt/delivery analytics real no vacía. Costo0 cubre, tiny incompleto; legacy1–3 wire1 intacto.5legacy anteriores del autor compatibles, no atribuirlos al final. Sin subscriptions/producer4 ni órdenes realesPOS/core. Aceptación de publisher opt-in, no E2E. WT/task recipes-events retirado por factory tras mainafbe2ce4 limpio/0procesos.

**Metadatos catálogo aceptados e integrados:** autor d25543876b097337bace38b6d18916293b6dacf3 (código30c684348fbdb6558aca459563fff0bbe81db927), QA9df585d6231a88c1ca4f2832f1cbde3b71a8831c sobre a15e3b9a9cf060bb4e6e4a4328ffec436b989d39.0105 agrega product soldByWeightfalse/pricingUnitunit/salesRevision1 +config salesMassUnitskg, checks permanentes y barrera temporal unit; tarifas/barreras previas intactas. Snapshot aditivo solo2tablas/4columnas/4checks, sin drift.5CI PASS/0skip25.63s primer intento;46puras/tipos3/lint/formato PASS, QA revisó SQL/JSONdiff/test/log y reutilizó CI compatible, guardias24PASS/2FAIL backlog. Colisión nueva fixture literalstock corregida aunsplash sin editar guardias. Root aplicó0105 a DB LOCAL protegida despuésQA y antes de integrar: migrate-local hostguard, EXIT0/106migraciones; health3201 HTTP200. No test fuera wrapper ni PROD. WT/task catalog-measure-storage retirado factory limpio/0procesos/main.

**Consumidores aceptados e integrados:** autor0ba07ce7201d731f22fadb5a41cb8c152047d238, producto dd47524f40ba683a3bafc8243b351efdc8c8456a, corrección solo tests80414cf92ca372525c387497ff31e48cb75e4317, QA1efcf2f678b914e697b24da6963efea50647e27c sobre0f65de5516b43124943264f243cf0414da9e97ec. Suscripción decode/captured medidos, lector costo1–4 seguro y envelope antes de TODAS ramasinclcore.analytics. Primera CI11PASS/6FAIL/0skip331.30s preservada: nuevo5PASS172.99s y modelo5PASS80.66s; costo5 bloqueados por expectativa1delivery frente2reales, origins1fallo por seleccionar recipes.product_cost.changed por índice0. Ampliación root/factory/ficha SOLO tests: retries focalesRecipes y assertion exacta ambasdeliveries/cardinalidad2, originslookup eventType+existencia. Rerun dos suites7PASS/0skip100.92s; evidencia compuesta compatible, NO corrida integral verde por retry.122puras autor/103QA PASS, tipos3/lint/formato; guardias24PASS2FAIL backlog. QA revisó logs/config/SQL y reutilizó CI sin duda concreta. Journal autor0104 y DB/candidato0105 compatibles explícitos. Raw4refs sin filasPOS/core, no E2E/producer4/mass. WT measured-delivery retirado factory limpio/0procesos/main9b462a7a.

**API unidades aceptada e integrada:** autor d60f70859967891e307dc9a8ebd4d6c1b72ca556, código65ce09c235ba10ab65a6ede1a5e2a8be77201637, QA32da087f1b1b0fcf30813ee0e2e8f0a9373c6791 sobre5128d67bad276e9f9523f358a5f055cd019fb3fb. GET/PUT business/sales-units con guardbusiness, mutex/revision compartidos,422fields, no-store, conflicto/concurrencia/rollback/tenant reales.6CI PASS/0skip/0retry47.02s, teardown negocios/owners/staff/sesiones/0procesos; tipos/lint/formato/guardias24/2 backlog. Autor NO guardó archivo de log: recuperó salida original de tools sesión90030 chunks0bdfa9(HEAD65ce09c2),c24f54(migración/RUN),699293(final6PASS/EXIT0). QA contrastó esa salida con código/config, sin inventar ruta/log ni repetir DB por ceremonia. Consultaunit_in_use implementada, pero negativo realmass/carrera catálogo pendienteCP2c por barrera0105. WT sales-units-api retirado factory limpio/0procesos/main8b73fe4e.

**Revisiones comerciales aceptadas:** autor51a37d830697cae770dc50af0d01e1de892d2383 / QA b7c8066b41ed4ec78fab863d227b6c1cd5217228 sobre6f217fecb2c41cc0fb1a87958be6d018e754a500. Writers catálogo/importación atómicos, mutex compartido, revisiones semánticas y rollback de enlaces/imagen. Original CI25PASS/4FAIL preservada; nueva suite6PASS, legacy10PASS tras adaptar seis expectativas exactas de escala2 a9 autorizadas. Evidencia compuesta29 casos compatibles, NO integral verde por retries.47puras/tipos3/lint/formato, guardias24/2 solo backlog. Fixture nueva imageActionstock corregida a replace/uploadId sin editar guardias. No archivos rawlog: QA contrastó salidas originales de tools, límite explícito en informe. Task retirado tras mainc822e40c.

**UI unidades aceptada:** autor5a29b739b1dae042eb695bc6ed0e65574e7d0e95 / QA e168d7dfe7f9f0bf413d99a69bca3229e00fa40a sobre12a6f5c87fbbd1e0a41f88393e7d7551099fe57c. Producto8b43bc38: tercera sección y reconciliación por campo de tres borradores con revisión compartida, conflictos y estados inciertos. QA20/20 browser final+1 teclado/doble envío,3puras/tipos/lint/formato/guardUI; capturas390/1280 vistas. Harness API controlado NO certifica Next→guard→DB; API6CI aparte. Fallos de arranque Chromium/locator preservados. Evidencia /private/tmp/cp0242-qa-independent y capturas /private/tmp/cp0242-ui-visual-8b43bc38. Task retirado tras mainbe6ffb59.

**Catálogo V2 aceptado e integrado:** autor ffbcf8d14a392896b8b8321ea567da9eea98b131 / QA1bfa32541720fae9c8b87a165c6fbe8d67076682 sobre82cf1fa7fac07b24c828bd53a89e61610003304a. Main local4ed096fd1fc301e314ff555878516008eb31c099, producto idéntico candidato QA. Task/WT catalog-v2-server-0242 retirado por factory limpio/0procesos/main, sin force. Sandbox bloqueó metadata tras retirar carpeta; git worktree remove sin force y factory cleanup escalado completaron retiro acotado. Autor catalog_v2_server_cp2a_impl en catalog-v2-server-0242, basec822e40c. Ficha0242-cp2a-catalog-v2-server.md comprometida antes del código; ampliación test de provider en modules/recipes/server evita acoplamiento POS→Recipes. Contrato V2 exacto, revisión/mutex, callback medido y no-store; V1 seguro y barreras mass/precisión conservadas. Último código68030da912c86a51ae5721b9bd5057aebe88f6cc. QA detectó coerción de array en pricingUnit y cache ausente en DELETE; corregidos con pruebas, sin debilitar aserciones. CI original882d0831:21PASS/1FAIL/8SKIP más error beforeAll por fixture staff sin permisos; corregido, no certificar por skips. Orphan exacto saneado por wrapper CI: primer cleanup falló por nombre de tabla antes de DELETE; segundo1PASS y teardown. Corrida a12ed237:10PASS/1FAIL/0skip (único cacheDELETE). Focal final68030da9: POS9PASS/0FAIL/0skip, compatible con Recipes2PASS de a12 y suites legacy anteriores; NO corrida integral nueva. Logs completos /private/tmp/checkpass-pos-0242/catalog-v2-server-logs. Teardown y cero procesos verificados; CI liberada a B. Entrega final ffbcf8d1 limpia y factory deliver completado; código idéntico68030da9. Informe QA PASS y aceptación completados.

**QA de catálogo cerrada:** catalog_v2_server_cp2a_qa en pos-qa-0242, candidato final82cf1fa7fac07b24c828bd53a89e61610003304a (mainbe6+entrega ffbcf8d1, código68030da9). Sin DB. Hallazgos anteriores cerrados en fuente;6puras independientes PASS tras fix parser, CI final inspeccionada. Entrega final adjunta, refresh completado; informe0242-cp2a-catalog-v2-server-qa.md aceptado1bfa3254, WT limpio/0procesos. No mover WT durante comprobaciones. Logs /private/tmp/checkpass-pos-0242/catalog-v2-qa-logs.

**Base/costo de Recetas aceptados e integrados:** autorafb9bac3a26e743f5fdedda765e47070851745b1, producto4cb59def5a5be0083a9b7a9973ae88d973b73372, adaptación testf137f2f0d0daae5579f86689cf9b7f09537a2dbb / QA0e22389faadcbac96ed0d6bf422bf0ea5ac46950 sobre06dd298b59ae98458446083ec5ecff239c94fef4. Main local58e9a5efa18d2c496fadd3d28fbfd1a37f2c9e94, identidad de producto comprobada; publicación/base inmutable, preview y costo comparable exacto/incompatibilidad explícita. Autor73puras/tipos3/lint/formato/UIguard PASS; QA reprodujo73/0skip y verificó combinación con lock business-config→recipes aceptado de catálogo. CI original10PASS/1FAIL/0skip234.66s: Micro positivo ledger0 esperaba costo0 antiguo. Scope ampliado/adaptación solo test autorizada separa Micro incompleto/null+rounded_to_zero y preserva Gratis/Vacía0válidos. Solo costos repetido1PASS/0skip56.53s, producto idéntico; evidencia compuesta, NO integral verde por retries. Logs completos /private/tmp/checkpass-pos-0242/composition-basis-evidence y composition-basis-qa-logs. Todos afterAll completos, cleanup owner/business/sesiones cascade, auditoría0procesos. CI liberada, WT/task retirado por factory limpio/main. Sin mass real/activación por barrera0105, no DB QA adicional.

**UI catálogo ACEPTADA e integrada:** autor c699852cb552698d0b2479ee7bb1aa4b7a092cef (código5c31ea38, runtime cac3d766 salvo anotaciónMassUnit[] borrada) / QAa2d70273bd04d72da7067c620261177214a8c371 sobre52c5270d99bbe31aa2c565974d1fc53a10d9aecc. Main localb617c86b4c5cabf3b65a7538714b80ecc3cf118c, identidad producto con candidato comprobada. Tipos3/lint/formato/UIguard, HTTP10/10cac3 PASS59.80s; browser originalcac3=13PASS/3FAIL, luego afectados/nuevo/delete6PASS5c31, NO full16finalverde. QA5puros y3browser independientes (cruce comercial, POST abort+GET503/200 y revocación401) PASS. Capturas390/1280 abiertas por autor/QA, sin desborde visible; modal scroll, fondo fuera captura no certificado visualmente. Logs catalog-ui-0242-evidence y catalog-ui-qa-evidence fueraWT.

Hallazgos reales cerrados: POST incierto no se desbloquea al descartar sin GET autoritativo; cambio cruzado de medida/tarifa se revisa como bloque comercial para no reinterpretar precio. Revisión nombres/labels, no UUID/booleans crudos. GETcatalogV2 salesMassUnits guardcatalog sinbusiness, defaultkg soloausencia/V1intacto, expectedSalesRevision puro corregido string. Scope amplió harnessBackofficeProvider requerido; fallo setup4254/EXIT130 preservado, CI4254=9PASS1FAIL por helper nuevo cacheV1 inaplicable corregido sin cambiarV1. Browsercac3 fallos overlay/selectorerror y ecd checkboxhidden input (1FAIL2noejecutados) resueltos usando guía/label visibles, sinforce; tour cancelado conEscape y nuevo tour no equivale a continuidad. Nuevo literalrutaRecipes retirado, NO backlog; arquitectura24PASS2FAIL yconguardiascatálogo62PASS2FAIL backlogexacto. No massreal, constraints siguen hastaCP2c. Factory integrate/cleanup retirócatalog-ui-0242 limpio/0procesos/main, no reutilizarID.

**UI Recetas ACEPTADA/integrada:** autor116c5a2133d8f1764de37d1920845fa617f46a20 (producto7ec17a74/test0503370a) / QAb5e130b3ba1cde1d06345a8bf0a0c72d33e85cdd sobree3c0f52a1002ccae1b2d4129cd6613b80b82fcda. Autor18/18browser0skip/retry,26puras,tipos3/lint/formato/UIguard; QA26puras+5browser decisivos PASS y4capturas390/1280 abiertas/legibles. Base/costStatus/biblioteca/yieldIA/partialSave/revisión explícita; tres negativosbibliotecaPOSTincierto/library409/respuestatardía host→no composición PASS. Desmontajehost en harness no navegación/authnativa niHTTPDB, límites explícitos. Fallos testsoriginales y compatibilidad/extracción organizacional preservados en handoff. SinDB/env/0procesos, factoryaceptación/integración/cleanup tras main3de82609 completados, IDretirado no reutilizar.

**Storage0106 ACEPTADO/integrado:** autor281637c94369817f658a6b7ac1d2e09a70288bce (código3b3cef73) / QA02ebb45652164a1f1f0924727b5ee24450e52515 sobre7f6e0fcecdc53e9b5d23d05b4c4e2b770c533767. Solo pos_order4columnasnullable+3checks+unique/journal, backfilltipo porFKreal sin money/timestamps/JSONcambios. CI4/4PASS0skip/retry yteardownfull,28unitboundary+17tooling/tipos3/lint/formato/UIguardPASS, módulos24/2backlogexacto. QAsemánticaJSON/SQL/journal yblobs+CIinspeccionada compatibles, SINDBQA. Root despuésPASSQAantesdescriptor aplicó LOCAL protegida con migrate-local hostguard desdeWTpropio: EXIT0/107migraciones, log /private/tmp/checkpass-pos-0242/evidence/order-intent-storage/local-281637c9.log; main4322456d integradoidentidadproducto, health3201HTTP200. NingunaPROD. Task/WTretirado factory limpio0procesos/main. totalSnapshot privado NOautoridadúnica abierta sinmoneda/originalracional; nuevo listado normalizaoriginales para evitar dobleredondeo moneda0.499USD→COP.

**InputV2 puro ACEPTADO/integrado:** autor39aab82beacc9c64c6c1618b3e5e0167462f3d54 (códigoca87073000712156d0a251354efff0e3e63f065c) / QAf11dbb182167526e9b2efc615341b40bec8b5a27 sobrecf83d05cc9c8eabcbf88785a78dfb5b62af89c15. Main localaa58db729da8f25b7f4f2448c36955d1314ce89a, identidadproducto comprobada.72purasautor+72QA+5independientesPASS0skip; tipos3/lint/formato/UIguard, QAmerchanttipo integradoPASS, guardias24/2backlogexacto. Parseo transportevs resolución snapshotautoritativo2pasos, excepciónqtylegacyINT32sin cambios solo fuenteconfiable, huellaSHA256canónica sinDB. NO rutas/guard/scope/locks/idempotenciaAPI certificadas aún. Primerfallotipo inferenciaampliadasaleType corregidoretornotyped antesca; EPERMGit/ps escalacionesacotadasautorizadas. Logs /private/tmp/checkpass-pos-0242/pos-command-input-logs. WT/taskretiradofactory limpio/0procesos/main.

**Ronda servidor V2 actual:** fichas0242-cp2b-readers.md y0242-cp2b-list.md comprometidas5222047f/c72630a0 antescódigo; lista separada para no megaentrega. Catálogo/detalle modifica solo2GET, defaultV1seguro/metadataantesNumber, price/factorfrozen/items ysharedreadSaleexacta, frecuenciaV2pororden cerrada30d, salesMassUnitsPOSbajomismoguard adicióncontratoprecomprometida. Detalle conserva totalgross/sale.totalcollected; listadoV2neto aparte, confirmadoroot. Listado nuevo trabaja fuera rutas/HTTP, overloadV1defaultcompatible, LCMratio gramsFactor/escala9+9 conSUMNUMERICnumeradores enteros/CASEsinredondeo/divisiónSQL, normalizadounavez núcleoBigInt; numéricaSQLVALUESmassnoafirmaPOSmasscanónico. Anulada importehistóricogross/saleTotalnull noingreso, no fixtureDBimposiblevoided+settlement. SINDBlistado hasta transferencia. EnsambleAPIposterior debeconectarGETordersV2 ademáscreate/update sin interferir autorcatalogodetalle.

**Pendientes de seguridad antes activarCP2c:** Counterlegacy businessCatalog/read/buildDetailed hoy no comprueba toda metadata mass; retirarAPI410 o añadir rechazo previo a Número antes de quitar barreras, junto con circuitocompleto. No afirmarlegacyseguro por solovalidarpreciocentavos/qtyentera. Gatefinal requiere consumo/costes/efectos de órdenesPOS/core reales, cuponesgratis/2x1unitonly, dinero/replay/recuperación/tickets y M1 nuevo con controlarchivado. Ningunaactivación/pushPROD autorizada.

El owner preguntó repetidamente cuánto falta: respuesta honesta, queda conexión de efectos, configuración/catálogo, toda UI POS, retiro de Mostrador y QA/M1 final; estimación anterior12–18 cortes ya desactualizada, sin ETA fiable; pendientes UI catálogo/base, POSV2 editor y cierre completo, retiro legacy y QA/M1. No presentar fundamentos como POS terminado. También vio varias veces “Selected model is at capacity”; aclaró por herramienta que aparece EN EL CHAT PRINCIPAL, no solo subagente. Se corrigió atribución anterior demasiado tranquilizadora. Implementador/QA vigentes siguieron activos y entregaron; no afirmar que servicio esté resuelto ni outage global. Skill openai-docs leída y anunciada, documentación oficial error-codes abierta: sobrecarga temporal es interpretación compatible, no diagnóstico exacto del aviso UI. Root no puede cambiar modelo de este chat; no se cambió modelo de agentes/config/cuenta. Estado guardado para reanudar sin pérdida si se corta.

Contratos input9dec, gramos derivados14dec, tarifa legacy12,2/qtyINT32 y racionales Recetas separados. CP1c consumidores por cadena; CP2a config,2b editor,2c cierre/activación mass/V4/precisión completa. No writes operativas mass antes de2c. Barreras temporales de precisión/unit se quitan solo en candidato compatible. Scopeclient skillimpeccable ya aplicada una vez, sin init/rediseño/artefactos ajenos.

Main localaa58db729da8f25b7f4f2448c36955d1314ce89a (inputV2 aceptado); dev mismo candidato antes de este checkpoint; principal en dev, cambios ajenos .impeccable/untracked preservados. CI remoto rojo90ebe18f conocido, no reparado.3201/túnel/demos previos intactos. Git y Chromium requieren escalaciones acotadas ya autorizadas; reportar bloqueos, no confundirlos con producto. Sin push ni PROD; cada caso requiere autorización explícita. No marcar0242 implementada hasta CP2/3/4 y QA final.

## HISTÓRICO — 0242 POS: MAPA/SPEC/PLAN, UNA DECISIÓN MONETARIA PENDIENTE (2026-10-18 UTC)

Owner pidió mapear con agentes el POS actual, compararlo con laboratorio y preparar spec/plan antes de implementar con dos workers+QA. Producto base5f9cb2b2; reserva documental spec0242/ADR0155/INDEX commiteada ec454681. Mapeo read-only por2agentes y QA documental independiente: sin código/DB/worktrees/servidores de producto, sin push/PROD. Laboratorio persistido en docs/design-explorations/2026-10-18-mostrador, v001–v004 y decisiones. POS único con listado abierto/cerrado/anulado y ciclo entero, Mostrador modalidad, Retiro/Delivery etiqueta obligatoria y cobro solo al cierre. Peso checkbox en catálogo y unidades kg/lb/g habilitadas en business; captura manual sin balanza; exactitud y snapshots toda cadena.

Scope actualizado explícitamente: PWA/emisión/políticas de premios fuera; owner eligió «Dejar de ofrecer ese canje por ahora» al retirar Mostrador. Preservar saldos/historia, no crear canje dentro POS. Reglas de cupón como texto para operador, sin parseo/exclusiones nuevas por contenerpeso. Pregunta monetaria única pendiente: cantidad bonificada para gratis/2x1 de masa (operador indica /1unidadtarifaria/diferir); NO asumir respuesta. Spec está en borrador técnico por ese punto.

Docs: specs/0242-pos-unificado-y-venta-por-peso.md +0242-contratos-pos-y-medidas.md; adr/0155-pos-unificado-cantidades-y-cupones-de-premio.md (nombre reservado antes del recorte de PWA, contenido ya acotado); factory/0242-{mapa-actual,performance,plan-implementacion,qa-documental,handoff}.md. QA inicial FAIL por decisión de bono sin aprobación y contrato business impreciso. Business corregido a /api/business/sales-units, revisión/mutex regional-fiscal compartidos, catalogRevision/salesRevision y header v2. QA segunda revisión focal PASS de ese bloqueo; global pendiente solo bono de masa. Leer handoff antes de clear/implementar; no confundir spec con producto certificado.

0238/ADR0154 es la mejora previa: provider/contexto porRequest, seed y scope. POS aún reporter→orders y no scope en endpoints ordinarios; plan adopta protocolo completo sin cookieCache ni cambios globales de cookies/pool. Eventos actuales V3; medidas V4 replay1–3; core/POS quantityint y demás consumidores deben migrar juntos. M0/M1 y pruebas reales pendientes; no extrapolar49→18SQL ni20%Inbox al POS. Core counter también Clientes/accesosstaff: inventario/migración antes retiro; no borrar dominio común.

Checks documentales: números sin duplicados, formato y enlaces nuevos conformes; no testsproducto/DB/M0. CI remoto consultado sigue ROJO90ebe18f verifyUnit+Neon; no reparado por documentación. Diferidos previos y demo/3201/túnel intactos. .impeccable/config.json tiene excepciones puntuales de turnos anteriores, no mezclar con producto; artefactos ajenos .agents/.claude/.codex/.github/public/consumer preservados. Servidor propio de laboratorio4387 efímero; index local persistido. Cada push/operaciónPROD requiere autorización nueva.

## HISTÓRICO — 0241 IMPLEMENTADA Y QA CONFORME; SOLO LOCAL (2026-10-18 UTC)

Owner autorizó revisar gastos/equilibrio y eligió «Aún no podemos estimarlo» con motivo breve cuando faltan costos o referencias. [Spec0241](../specs/0241-gastos-y-equilibrio-mensual.md) e INDEX reservados antes de código; contrato compartido34263158. Dos implementadores en WT propios y QA independiente: datos88df2147d404b5931855a0e6a8e6e7a218e51934, UI0d216d609863f34b18c2b290e441741c6f4ebfd0; producto combinado6fbd0b68fd5ebb0f712e69cbf124800a1998b381. [QA](../factory/0241-qa.md)9e3b05d0e0078e60dfbe33ab4eb82090871c35e9 conforme. Integración y main exclusivamente locales tras QA; sin push/PROD.

Modelo v2: pagado+pendiente estimado por referencias positivas observadas, sin inventar meses0 ni tratar pago parcial como completo. Previsión desconocida si faltan referencias. Ventas adicionales descuentan aporte real tras costos/comisiones; costos completos por importe/unidades/contadores y segmento producto/día/local, sin extrapolar fracción desconocida. Moneda+minorUnit propios sin conversión ni borrado ajeno. Ventanas28d/3meses configurables por política existente. Histórico, resumen, Inbox/contextos actualizados y política monthly-finance-2 para reevaluación normal, sin resets manuales. UI «Para cubrir los gastos del mes» con mes/corte, Te falta vender, pagado/pendiente/total y detalle opcional; no margen técnico visible. Gastos distingue pagado del período. Sin kit/guard/tooling/migraciones/deps nuevas.

Conciliación y lectura local readonly:516,75=450fijos+66,75variables, ventas569, costo conocido54/569=9,49% por importe. Antiguo570 omitía variables actuales y680,23 usaba margen histórico; ya no se publican como metas con datos incompletos. finance unavailable por sales_costs+expense_history, pendiente/previsión/objetivo null. Local Principal y filtro3meses conservan cálculo mensual; demos Promos3/seriesstock8 intactos. Evidencia auditoría `/private/tmp/checkpass-finance-review/`; implementación `/private/tmp/checkpass-0241-evidence/{data,ui,combination}/`.

Checks:31modelo/resumen+59regresión+2NeonCI protegido+4boundary conformes; tipos dominio/UI/lint/guard focal conformes. A aislado merchanttypes FAILTS7053 resuelto con B y typecheck completo combinado PASS. UI21casos únicos:16PASS3FAIL iniciales de navegación obsoleta+confirmación7PASS, sin presentar suite global verde. QA combinada2/2browser390/1440 sin retries/skips sobre DTO financiero local real y parser expense_history; locator externo inicial falló, logs preservados y confirmación focal conforme. Capturas abiertas por QA/coordinador. Harness mezcla finance real con otros fixtures; no Nextautenticado browser ni M1 nuevo. CI handler autenticado probado, smoke3201 health200/history401private-no-store sin sesión. Factories finance-data/ui/qa-0241 aceptadas; cierre y retiro local de worktrees propios tras incorporación en main, sin afectar procesos ajenos.

Demos, server3201/túnel y archivos ajenos intactos. Diferidos conservados: QAmanual0237/owner, CIrojo90ebe18f, guardias24PASS2FAIL, FAILfrío1817.621042ms, M1previo66067758 no certifica payload ampliado (segmentos financieros), ciudades/weather/calendarios/crons/Marketingcupón11/realtimeinfra y PROD102migraciones histórico. No reparar fuenteslegacyMXN sin proyección ni duplicados manuales de gastos/stock de oficio. Próximo paso: revisión del owner en /backoffice/analytics; cada push/PROD requiere autorización nueva.

## HISTÓRICO — 0240 IMPLEMENTADA LOCALMENTE: EVOLUCIÓN DE COSTOS POR INSUMO (2026-10-18 UTC)

L0 solicitado owner: Ganancia y gastos se llama Gastos; quitadas líneas Ventas:importe en estados cobertura0/parcial y explicación del umbral80%. Rango real history.from/to localizado visible junto a Gastos del período, flexwrap móvil. Cifras/estados de cálculo y resto del contenido conservados, sin cambios de dinero/HTTP/DB/kit. TiposUI/lint/guard/diff PASS;2browserlayout existentes390/1440 PASSsin retries/skips, capturas abiertas y conservadas en `/private/tmp/checkpass-gastos-layout/`. Selectores de título existentes actualizados. En dev, demos y diferidos intactos, sin push/PROD.

L1 Promos solicitado owner: tabla semántica Promoción/Descuentos/Ventas asociadas/Costo de premios, cabecera sutil y separadores, ventas text-success y descuentos/costos text-danger del sistema; desconocido Sin dato y cero monetario explícito. Movida inmediatamente bajo las3Cards de Clientes en columna izquierda, sin esperar altura derecha. Móvil scroll horizontal local enfocable por teclado, no overflow de página. Disclaimer de ventas asociadas conservado breve. Sin nuevosdatos/cálculos/HTTP/DB/kit; demos intactos. TiposUI/lint/guard/diff PASS, browserAN-3history2/2 a390/1280 sin retries/skips: columnas/importes/null/filtros/posición bajoClientes verificados, capturas pobladas abiertas en tanda. Evidencia `/private/tmp/checkpass-promos-layout/`. Guardado en dev, sin push/PROD; diferidos conservados.

L0 seed local Promos del período autorizado owner: Joyas de Cutilan/Principal/día2026-10-18,3campañas ficticias [DEMO] Combo del día(descuento6USD/ventas36/costo desconocido), Promo de la tarde(12/84/costo8), Beneficio clientes frecuentes(4.50/30/costo2.25). Sólo proyecciones analytics propias con UUID nuevos: dimension_label/source_revision/metric_contribution/daily_metric, ninguna transacción/cupón real/envío ni filas existentes alteradas. Guard localDbUrlOrExit + identidad owner/negocio/local, transacción y candado lifecycle. Manifest/seed/cleanup y verification.json en `/private/tmp/checkpass-joyas-promo-demo/`; `node seed.mjs --cleanup` retira sólo IDs propios bajo Node24. readHistory real verificado tras COMMIT:3promos con importes esperados para Todos y Principal, revenue/tickets/ganancia/resultado/stock/goal/clientes sin cambios. Primer intento falló antes de escrituras por columna business.minor_unit inexistente, rollback y corregido. No testDB/CI/migraciones/PROD/push. Demos anteriores y diferidos intactos.

L1 layout Clientes solicitado owner: se sustituyó tarjeta única por tres Cards independientes Clientes/Visitas/Clientes que regresaron con Text metric, fila compacta bajo ranking en columna izquierda del masonry; móvil apilado. Grupo conserva nombre accesible Clientes del período, se quita párrafo redundante y se mantiene vacío de visitas explícito. No comparaciones inventadas ni cambiosdatos/SQL/HTTP/kit. HelperMetric ya sin consumidores retirado. TiposUI/lint/ui-guard/diff PASS; browser AN-3 history2/2 a390/1280 sin retries/skips comprueba valores+filtros y posición bajo ranking/alineación de la fila. Capturas abiertas en tanda y confirmación de padding compacto; evidencia `/private/tmp/checkpass-customers-layout/`. En dev, sin push/PROD, diferidos y demos intactos.

L0 posterior solicitado: nodos de precio duplican radio3→6; se quita fila último costo/fecha y botón Ver registros. Cada nodo tiene área interactiva44aprox con Tooltip ReactAria al hover/foco/press, precio decimal exacto+fecha y baseline marcada, Escape/cambiofoco para cerrar. Sin dato/SQL/DB nuevo. TiposUI/lint/guard PASS; browser3/3390/1440 PASSsin retries/skips tras corregir hover inicial (logFAIL conservado y confirmación en `/private/tmp/checkpass-0240-evidence/nodes/`). Capturas abiertas. Ajuste queda en dev; no avanzar main antes de revisión focal. Demos y diferidos conservados, sin push/PROD.

Refinamiento L1 posterior pedido owner: cifra de valoración en Text metric, fecha secundaria localizada, fila costo/fecha compacta sin nombre duplicado, explicaciones al desplegable, resumen agregado en dos métricas; gráfico con área degradada lavanda y línea info de contraste (kit ya autorizado), manteniendo rectas/fechas reales y singleton explícito. TiposUI/lint/guard y6unit PASS;3browser390/1440 PASSsin retries/skips, capturas en `/private/tmp/checkpass-0240-evidence/redesign/` revisadas. Sin DB ni cambiosHTTP, demos/diferidos intactos. Capturas iniciales en ui/stock-*.png fueron sobrescritas al ejecutar el harness heredado; logs históricos preservados y nuevas capturas aisladas desde confirmación. QA independiente focal PASS sobre90f5c4714b3cdcdc1df91bee9bd3f9414c0bec8d, diff/capturas revisados y evidencia compatible reutilizada sin DB ni nuevas campañas. Avanzado main local tras QA; sin push/PROD.

Owner pidió spec e implementación con flujo de agentes; clasificada L2 por contrato UI/selección/datos monetarios. Autorizó explícitamente gráfico nuevo en kit. [Spec0240](../specs/0240-evolucion-costos-insumos.md) e INDEX reservados9010d335 antes del código; contrato puro compartidoac5fedf8. Entrega datos0f027cf8 y UI corregidaeec922c3 aceptadas por QA independiente, integradas conservando commits en candidato298134aba0b81154cbfa06d11e9fc29e21629f1d. Sin push/PROD. Documentación de cierre posterior no cambia producto.

Stock e insumos incorpora selector insumo+local y gráfico LineChart del kit. Default comparable más reciente, selección válida conservada entre filtros; cambio de dropdown usa snapshot sin GET/SQL adicionales. readHistory conserva5consultas. Registros diarios reales y una referencia previa con fecha original, línea recta/espaciado temporal, valores exactos/subcentavo y listado completo accesible desplegable. Cero/un punto/plano/vacío y costos pendientes explícitos. Valoración y resumen del conjunto conservados. QA rechazó9b8cf2b por comparar extremos con Number; eec922c3 corrige comparación decimal exacta y agrega regresión. Number sólo en geometría.

Evidencia `/private/tmp/checkpass-0240-evidence/`: dominio8/8, NeonCI protegido3/3 con teardown propio, boundary4/4, UI/formato/geometría6/6, tipos domain/merchant/UI, lint/guard pertinentes PASS. QA combinación en tercerWT congelado298134ab: merchant types y browser3/3 PASS sin retries/skips. Capturas390/1440 abiertas en tanda, sin overflow. [Handoff datos](../factory/0240-data-handoff.md), [UI](../factory/0240-ui-handoff.md), [QA](../factory/0240-qa.md). Evidencia autor compatible reutilizada; no verifyglobal/M1 nuevo. Fallos de sandbox y overflow corregido preservados en logs.

Lectura DB local protegida readonly confirmó default [DEMO] Bolsa de empaque/Principal: Sep30 costo100minor baseline, Oct5 costo110, Oct12 costo125; además7insumos singleton reales con subcentavo. No escritura local ni cambios a demos anteriores. Smoke3201 health200 e history401 private,no-store sin sesión; NO certifica recorrido Next autenticado. Servidor3201/túnel intactos. Próximo paso owner: revisar /backoffice/analytics con sesión y estos demos; no hace falta seed nuevo.

CI remoto ROJO90ebe18f sigue diferido, no corregir/publicar de oficio. Diferidos intactos: QAmanual0237/owner, guardias24PASS2FAIL, FAILfrío1817.621042ms, ciudades/weather/calendarios/crons/Marketingcupón11/realtimeinfra. M1 anterior66067758 no certifica payload nuevo; PROD102migraciones histórico. Main local sólo tras QA; tareas factory0240 retiradas al cerrar limpias y ancestros de main, evidencia externa conservada. Cada push/operación PROD sigue requiriendo autorización nueva.

## HISTÓRICO — 0239 CÁLCULO SIN MARGEN VISIBLE Y MOVIMIENTOS; LISTO PARA OWNER EN DEV (2026-10-18 UTC)

L0 layout ranking pedido owner: tabla semántica (roles table/row/columnheader/cell) Producto/Unidades/Ventas, sin fotos ni filtros/botones nuevos, importes alineados y nombres completos. Ranking vive directamente bajo Ganancia/gastos en columna izquierda independiente; cálculo/stock columna derecha, eliminando espera de altura de cálculo para posicionar ranking. Móvil ordenDOM:ganancia→ranking→cálculo→stock. Sin números/cálculos/HTTP/DB nuevos; tiposUI/lint/guard/diffPASS,2browserexistentes390/1440PASSsinretries/skips y capturas abiertas. Demos/diferidos intactos; sin push/PROD.

L0 posterior owner: boxes Para cubrir el mes/Ventas del mes con borde y fondo surface, iconosIconoir Archery/Coins junto a etiqueta, importe Textmetric grande abajo; sin badges/variaciones inventadas. Sólo presentación local en analytics-console, móvil apilado/desktop2columnas, datos/estados intactos. TiposUI/lint/guard/diff-checkPASS y2browserexistentes390/1440sinretries/skips, capturas abiertas en tanda. Ganancia/gastos mantiene altura natural. Sin push/PROD; demos/diferidos intactos.

L0 posterior solicitado por owner: Ganancia/gastos usa self-start para tomar altura natural y no estirarse con la tarjeta de movimientos contigua; owner acepta alturas distintas. Sólo una clase, sin cambiar datos/layout restantes. Diff/ESLint/ui-guard focales, sin nueva campaña browser ni DB. Diferidos intactos; sin push/PROD.

Owner pidió quitar margen visible y rediseñar cálculo mensual con boxes y lista, sin ViewAll; aclaró «Ventas y gastos recientes». Producto`92fcbd344b88f7499a747fb71982e77dc2c24cab`, base4f124e4f (contrato0239 reservado antes del código). [Entrega](../factory/0239-monthly-activity.md). Margen sigue en fórmula; tarjeta mantiene equilibrio/ventasmes/gastos estimados/meta/plazo, lista visible incluso pendiente y vacío explícito. No desglose desplegable ni botón/enlaceViewAll.

HistoryGET incorpora recentMovements hasta4 operaciones vigentes de metric_contribution: revenue/expense_fixed/expense_variable, negocio/local/moneda/unidad/mescalendariolocal actual (como goal), agrupadasfuente/día/tipo/local. Fechadesc/desempateestable, NOordenhorario intradía ni promesa sincronía cobro. Tipo/fecha/concepto/importe, sin fuentes ni clientes/personal. Core no importa módulos, sin esquema ni APIs de módulos. UnSELECTadicional/ceroGETadicional, sin caché/polling; M1previo no certifica esta ampliación. History adopta scope trasguards antesdominio y private/no-store en todasrespuestas; day/Inbox/summary intactos.

Autor: merchant typecheckcompleto, ESLintfocal/UIguard1sin aumentos/diff-check PASS.32unitHTTP/query/lifecyclePASS; NeonCI2/2 real sin skips/retries sólo wrapperprotegido (aislamiento tenant/local/moneda/unidad/fechas/limit/agrupación/cero/negativo/retiradafuente), fixturespropias retiradas.5browser390/768/1440PASS sin retries/skips; capturas390/1440 abiertas. QAindependiente `/root/qa_analytics_layout` PASSacotado sobreSHA92fcbd34, reutilizaevidencia y revisaSQL/guards/ingestión/UI. Límite: componentes/API simulada + CIquery, no flujoautenticadoNextcompleto. SetupVitest --projectmerchant sinproyecto preservado en handoff, comando corregido.

Factory monthly-activity-0239 entregado/aceptado/integradoFFdev-mainlocal y retirado limpio/sinprocesos, evidencia `/private/tmp/checkpass-monthly-activity-evidence/`. Combinación: fuenteidéntica; health3201HTTP200, historysinlogin401JSON/private,no-store. Lectura READONLY guardadalocal con código candidato sobreJoyas: equilibrio disponible y4movimientos17oct (ventas13/26/15USD +gastoGas3.75), sinmutar demos. No nueva lectura financiera autenticadaHTTP.3201/túnel intactos; probar dev-business.checkpass.club/backoffice/analytics. Sin push/PROD; origin/main90ebe18f. Untrackedajenosintactos.

Demos locales anteriores conservadas y reversibles: `/private/tmp/checkpass-joyas-goal-demo/` (Servicios120USDhistórico) y `/private/tmp/checkpass-joyas-stock-demo/` (3costosDEMO), ademásInboxDEMO anterior. Todas las refinacionesL0previas (fechaarriba, cifrasgrandes/Iconoir, ganancia/barra/paletas) preservadas; detalleenhistóricosiguiente.

Diferidos conservados: QA manual0237/owner, CI remoto rojo/guardias24PASS2FAIL, FAILfrío1817.621042ms, ciudades/weather/calendarios/crons/Marketingcupón11/realtimeinfra. M1 de0238 sólo fuente66067758 anterior, no certificaDashboardampliado. PROD102migraciones dato histórico. Próximo: feedback manual, sin publicación hasta autorización explícita para ese caso.

## HISTÓRICO — 0239 ANALÍTICAS REORGANIZADA; PRUEBA OWNER EN DEV (2026-10-18 UTC)

L0 paleta barra posterior: owner pide tonos suaves como nueva referencia. Fijos lavanda#8C9EFF/variables celeste#94DAFA en barra y puntos de leyenda, tokenschart del kit separados del coral de resultado (que sigue#FD5C63). Segmentos con gap1 y radio pequeño; sólo2categorías reales, sin inventar segmentos. Etiquetas/importes de leyenda en oscuro. Diff/ESLint/tiposUI/guardfocales, sin nueva campaña browser por paleta. Sin cambios de datos/HTTP/cálculos, push ni PROD; diferidos/demos intactos.

L0 colores pedido owner: barra/leyenda Fijos usan tokenacento del comercio; Variables tokenlocaldelkit`expense-variable`=#FD5C63; importes disponibles de Resultado después de gastos usan mismo#FD5C63 (Pendiente conserva neutral). Se amplían tonos SegmentedBar sin cambiar consumidores/semántica restantes, sin alterar danger/success globales. Diff/lint/tiposUI/ui-guard focales, sin cambios de datos/cálculos/HTTP, ni campaña browser por color puntual. Demos/diferidos intactos, sin push/PROD.

L0 Ganancia/gastos según referenciaSpending solicitado owner: total de gastos fijos+variables destacado con Textmetric (suma entera segura sumIntegers), barra proporcional primary/info y leyenda/importes; ganancia bruta/resultado quedan en franja secundaria con cero/null/cobertura/signo y explicaciones originales conservados. Owner autorizó EXPLÍCITAMENTE añadir SegmentedBar al kit mediante pregunta. Nueva primitiva estática con nombre accesible; anchos dinámicos encapsulados kit, sin tocar guard; cero/negativos/nofinitos no dibujan distribución engañosa, leyenda mantiene importes. Sin serie/porcentajes inventados ni backend/DB nuevos. Node24 tiposUI/lint/ui-guard1sin aumentos/diff-checkPASS; recorridos existentes390/1440 2/2sinretries/skips y capturas abiertas en tanda (fixturevariable0 muestra sólo segmento fijo, correctamente). Sin tests nuevos para esteL0, sin push/PROD, demos y diferidos intactos.

L0 franja Ventas del período solicitada por owner: cifras grandes con nueva variante`Text metric` (text3xl/sm4xl/tabular; autorización EXPLÍCITA del owner vía pregunta kit), sin alterar variantes existentes ni guardia. Tres columnas con separadores, Iconoir Coins/Cart/StatsReport y tokens primary/info/complement; móvil apilado legible, comparación de ventas en pie único con dirección textual y colores semánticos, cero variaciones inventadas para tickets/promedio. Datos/moneda/annual/null y flujo idénticos. TiposUI/lint/guard1sin aumentos/diff-checkPASS;2recorridos existentes390/1440 sin retries/skips y capturas abiertas en tanda. Sin tests nuevos para esteL0; sin DB/push/PROD, demos y diferidos intactos.

L0 visual posterior pedido owner con referencias nuevas: Ganancia/gastos y Cálculo mensual ahora son un par en grid1/2columnas, ancho50/50 y altura compartida desktop (sin altura fija ni recorte), contenido alineado arriba. Ambas arrancan con2cifras principales; gastos fijos/variables pasan a franja secundaria similar a margen/gastos/meta. Conserva todos los importes/estados/explicaciones/desglose y mobile lineal, sin cálculos/HTTP/DB nuevos. TiposUI/lint/ui-guard/diff-checkPASS; recorridos existentes390/1440 2/2 sin retries/skips y capturas abiertas en una tanda. Sin tests nuevos ni QAagente adicional para esteL0. En dev, sin push/PROD y todos los diferidos/demos intactos.

Ajuste visual cálculo mensual pedido por owner tras datosDEMO: producto`040beb9a` (basef6bcacfc), sólo analytics-console+testfocal. Margen/gastos estimados/meta diaria en indicadores dl compactos, plazo de venta en aclaración breve y conceptos en desglose cerrado por defecto con Buttonkit/useId/aria-expanded/controls/hidden; estimado con meses anteriores/pagado este mes completos al abrir. Sin fórmulas/HTTP/DB/kit nuevos. Node24 tiposUI/lint/guard1sin aumentos/diff-checkPASS, browser5/5 sin skips/retries390/768/1440 con Enter+Space, capturas390/1440 abiertas en una tanda. Evidencia `/private/tmp/checkpass-goal-compact/`; fallo inicial selector de nombre cambiante conservado y corregido, sin esconder fallo de producto. QA independiente `/root/qa_analytics_layout` revisa mismoSHA/diff/capturas: sin bloqueos funcionales/layout, semántica/estimado/pagado conservados; versionados limpios, untracked ajenos intactos. En dev para revisión owner; sin push/PROD, todos los diferidos y demos locales previos intactos.

Demo local Stock autorizada por owner (L0 visual2026-10-18): Joyas de Cutilan, localPrincipal, guardlocalDbUrlOrExit/identidad. Tres daily_gauge`stock_unit_cost` para nuevo insumo analítico «[DEMO] Bolsa de empaque»:30sep100cent,5oct110,12oct125; un dimension_label, cero actualizaciones existentes, sin cambiar existencias/productos/costos operativos. Comparación real summarizeStockHistory persistida y verificada segunda conexión: variación25%,2subas,7díasentreellas; valoración stock5856cent intacta. Manifest y seed/cleanup en `/private/tmp/checkpass-joyas-stock-demo/`; retirar sólo estos IDs: Node24 `node /private/tmp/checkpass-joyas-stock-demo/seed.mjs --cleanup`; verificar`--verify`. Son observaciones ficticias para preview, no compras reales. Sin cambios de producto/migraciones/testsDB/push/PROD. Demo equilibrio e Inbox previas y diferidos intactos.

Demo local adicional autorizada por owner (2026-10-18, L0 visual): Joyas de Cutilan/joyas@local.com, DB guard `localDbUrlOrExit` confirma host local. Se agregó UN gasto analítico ficticio120USD del2026-09-15, concepto «[DEMO] Servicios»67f7a39b-80f9-4d13-b731-103bd314c2bf, source`local-demo:0239:goal:2026-10-18`:1daily_metric+1metric_contribution+source_revision+dimension_label; cero registros existentes actualizados, sin crear ventas/órdenes/pagos ni alterar gastos operativos. Sólo demuestra cálculo sobre proyección local: gastos570USD (alquiler existente450+demo120estimado), equilibrio680.23, ventasmes54, margen83.7963%, metahoy313.12/2días. Verificado persistido con segunda conexión y funciones reales inputStatement/inputFromRow/calculateGoal deSHA18b831a8. Afecta también resumen financiero local por diseño; no confundir con cifras reales. Manifest/seed/verify/rollback en `/private/tmp/checkpass-joyas-goal-demo/`; retirar sólo esta demo: Node24 `node /private/tmp/checkpass-joyas-goal-demo/seed.mjs --cleanup` (guardidentidad/IDs/source). Intentos previos sintaxisASday y updated_at revirtieron transacción; manifest fallido preservado. Sin migraciones, tests DB, push ni PROD. InboxDEMO anterior intacto; todos los diferidos conservados.

Ajuste L0 posterior solicitado por owner: «Ver un día» junto a Período/Local en la fila superior (tres columnas desde sm, apilados móvil); resultado diario debajo de filtros sólo con fecha/datos, sin tarjeta vacía al pie. Mismo DateField/estado/GET y contenido diario. Diff/ESLint/typecheck:ui/ui-guard focales; sin tests nuevos ni nueva campaña browser para este L0. Sin push/PROD; todos los diferidos intactos.

Owner aportó ocho referencias de composición y pidió aprovechar el layout de `/backoffice/analytics` sin abandonar Tailwind/React Aria/sistema visual. Refinamiento L1 dentro de0239, sin nueva spec funcional: indicadores de ventas en franja, ganancia/equilibrio paralelo7/5, ranking/stock7/5, clientes/promos5/7; móvil indicadores etiqueta/importe compactos, orden DOM lineal. Datos/cálculos/HTTP y todos los matices de costos/cobertura/null/cero/estimaciones/comparación anual/causalidad conservados. Sin gráficos o series inventadas, kit/guard/deps/DB intactos.

Producto `13b4988e6f269ee607f9ed45cecf4e2b7ae0a686` sobre37c98622; integradoFF en dev/main local tras QA independiente `/root/qa_analytics_layout` PASS acotado sobre eseSHA. [Entrega/QA](../factory/0239-analytics-layout.md). Factory analytics-layout-0239 aceptado/integrado/retirado, WT propio limpio eliminado, evidencia fuera delWT `/private/tmp/checkpass-analytics-layout-evidence/`. Sin push/PROD; origin/main sigue90ebe18f. Untracked ajenos intactos.

Node24.20/pnpm11.4: typecheck:ui, ESLint focal, ui-guard1archivo sin aumentos, diff-check PASS. Browser5/5 sin retries/skips390/768/1440: paralelo desktop/lineal móvil/sin overflow, pérdida/cero/nombre largo/estimado/pendiente, filtros/día y error-reintento. UI/CSS reales con API simulada, NO Next/auth/DB certificado. Capturas390/1440 abiertas; ajuste de compactación móvil y una confirmación final. Fallos setup sandbox y oráculo inicial decimal punto preservados, corregido formato esperado español coma; no ocultados. Detector layout[] base/final. Combinación: código idéntico al candidato, health3201HTTP200, analytics sin sesión307a`/` esperado; no nueva lectura financiera autenticada. Servidor3201/túnel intactos; disponible dev-business.checkpass.club/backoffice/analytics para QA manual owner.

Dashboard0239 anterior conserva Inbox compacto, tres números reales (mensual/diario/hoy), owner0238 y supuesto diario calendario comunicado, sin nueva modificación. Sus evidencias/limitaciones se conservan en bloque histórico siguiente. Ninguna campaña M1 nueva.

Diferidos conservados: QA manual0237/owner, CI remoto rojo/guardias24PASS2FAIL, FAILfrío1817.621042ms, ciudades/weather/calendarios/crons/Marketingcupón11/realtimeinfra. M1 de0238 sólo fuente66067758 anterior, no certificaDashboardampliado. PROD102migraciones dato histórico. Próximo: recibir feedback manual, sin publicación hasta autorización explícita para ese caso.

## HISTÓRICO — 0239 DASHBOARD COMPACTO IMPLEMENTADO; PRUEBA OWNER EN DEV (2026-10-18 UTC)

Owner pidió Inbox tipo correo y tres indicadores; solicitó UN agente con contexto limpio. `/root/dashboard_compacto` implementó sin subdelegación; coordinador revisó independientemente y aceptó factory. Spec0239/INDEX reservados antes del código en a8b2195f; entrega limpia `aac013dac939e9343408256466ab02244db1aede`, producto5d7d601f + correcciónuseId db390ddd. Integración dev `f27bce11a496bd072b45d58fc8928769d9ad5a0e`, sin conflictos. [Handoff](../factory/0239-dashboard-handoff.md), [QA](../factory/0239-qa.md), [spec](../specs/0239-dashboard-compacto-y-resumen.md). Main local avanzado tras QA, NO push/PROD; origin/main sigue90ebe18f. No migraciones ni kit/guard/deps modificados.

Inbox: lista de filas ~45px desktop/dos líneas móvil, todos cerrados/uno abierto, detalle y decisiones/recordatorio conservados. useId evita IDs duplicados de panel/encabezado en dos consumidores. Summary hermano encima: equilibrio mensual existente, diarioceil(mensual/díascalendario), ventas netas del día local todos los locales. Diario es supuesto explícito comunicado, pregunta opcional sin respuesta; no atribuir elección al owner. Null pendiente con explicación, cero ventas válido; moneda/unidad/estimado preservados. Avisos DEMO no generan cifras financieras.

GET analytics/summary privado/no-store con SinGateDeEmail consistente con Analíticas, scope despuésguards/antesdominio; una readInput para3números, paraleloInbox, jamásinputextraenInboxGET. Quinto recurso del mismo owner/contexto, sólo observado, remount/foco/online/manual; retiro401/scope409 y restricciones402403. Coste adicional deliberado un GET + guards + input (~4SQL por código), NO benchmark nuevo ni promesa de tiempo real tras cobrar. readAt hora consulta, no garantía de procesamiento completo. Sin polling/SSE/ws/cache nueva.

Autor157unitmerchant+11domain,16browserlifecycle+6focalcontext, tipos/lint/guardPASS. Coordinador14unitHTTP/resource/serverPASS independiente, diff revisado y ambas capturas390/1280 abiertas. Hallazgo IDs duplicados corregido y probado con dos consumidores. Fallos previos sandbox/oráculosnuevos y overflowmóvil corregido preservados en handoff, sin skips/retries para aprobar. Combinación smoke nativo3201 summary401JSON/private,no-store, healthlocal200/túnel200; sin nueva lectura financiera autenticada ni M1. Evidencia externa `/private/tmp/checkpass-0239-evidence/`. Disponible dev-business.checkpass.club/backoffice, prueba manual owner pendiente.

WT/task dashboard-0239 retirado correctamente vía factory después de aceptación/integración en main local, limpio y sin procesos propios. Evidencia fueraWT preservada. No tocar3201/túnel. Datos locales anteriores5avisos[DEMO] JoyasdeCutilan, joyas@local.com, sólo candidates/states, sin ventas/gastos/proyecciones. Scripts/manifest `/private/tmp/checkpass-joyas-demo/`, sujetos local-demo:2026-10-17:*; resumen diario puede caducar al cruzar día. Sin operar DB en0239.

Diferidos conservados: QA manual0237/owner, CI remoto rojo/guardias24PASS2FAIL, FAILfrío1817.621042ms, ciudades/weather/calendarios/crons/Marketingcupón11/realtimeinfra. M1 de0238 sólo fuente66067758 anterior, no certificaDashboardampliado. PROD102migraciones dato histórico. Untracked ajenos intactos. Próximo: recibir feedback manual, sin publicación hasta autorización explícita para ese caso.

## HISTÓRICO — 0238 QA FUNCIONAL/M1 PASS; PRUEBA OWNER EN DEV HABILITADA (2026-10-18 UTC)

Producto660677583d406d6e4f58a1900383ffff1fb3ef2a integrado, QA independiente final PASS ACOTADO en `/private/tmp/checkpass-0238/final-smoke/qa-final-combination-v1.json`; performance recalculadaexacta porQA `/artifacts/qa-m1-independent.json`. [M1](../factory/0238-m1.md) registra números/fuentes/fallos/límites; spec implementada, ADR aceptada. Owner YAavisado puedeprobar dev-business.checkpass.club/backoffice; dominiohealth200 UAnavegador, local3201health200. Sin push ni PROD. Cierre QA versionado34a78beedc9fc6e69848c6687b2c8ee091a0ec99 aceptado/integrado en dev y main local por fast-forward; origin/main sigue90ebe18f.

M1 finalizada EXIT0:24bloques seriales,144/144válidos=120reload+24firstseparadas;30reloadpor caso/fuente,6ABBApares, mismoNode24.20/Next16.3webpackprod/Chromium153.0.8010.12/NeonCI/fixturesdía18. Vacío med1988.10→1593.35ms/p952276.40→1796.20; cinco2040.65→1632.15/p952203.40→1824.90. Aproximadamente20%menostiempo. TTFB/FCPmejoranmed+p95, todosCIgatescongeladosPASS. Primeraentradaassetsnuevos med3345.70→3056.80(vacío),3376.60→3110.95(cinco),n6/caso/fuente descriptivas, noocultarque~3.1s. APIInboxHTTPmed~1.17/1.19s sigueocupandomayorparte, noatribuciónCPUDB.

Conteos todos144:doc9→4SELECT,2GETsesión+2módulos→0aux,Inbox1/checklist1,49→18SQL(4824balanced0erroresSQL). Doc/JS/CSS0failed; muchosRSCprefetchcanceladosAMBASfuentes preservados, bytesRSCparciales, noafirmartodosHTTP200. Core638bytes/módulos1628 JSONlógico, NOwire. JS inicialcodificado~655→658KB,doc~8.5→10.6KB:mejoratiempo no esreducciónbundle.

Nativev3 scope-negativePASS 4f677fcc…: cookieA→Bsinreporter/focoantesintent,PUT409codebackoffice_context_changed/marcaA,1writer/1fullnav,4ticketsnull+navdesconectadaobservados antescommitnuevo,GETB200Gastosintacto. V1res.jsonrace/V2bindingpagehidenorecibido mantienenFAILobservación. V3bindingaliveMO/interval+JSONpromiseoriginal conservado; legacyretiredBeforePagehide:false significa sinseñalpagehide,NOretirofalseobservado. Handoffv3recibiódelta<=a<justoantesrun; reportscriptSha4f coincidefuenteactual/startedposteriorfinalhandoff, estrictoTRUE.

Streaming4diagnósticosPASS trascorrelaciónRIDv2; nativeformulario (bootnuevo/scope/input/draft/tab/selection) PASScriterioacotado. V5/V6strictEOF siguenFAIL:200ERR_ABORTED ybootnuevoobservado enprobeDESPUÉSdelterminal, NOestámedidoordencommit-vsabort; corregirafirmaciónanteriorde«despuésdelcommit». Fuente/JSobserver nohallaroniniciador; no benignclaim/cambioproductoconjetural. StrictModeDoDaceptadocompuesto unidadrealacquire-release-reattach+apprealbuild, NO replayNextdevbrowsercertificado. Asyncrouter.refreshsinboot yblocked→subscribedwrappersconservanlímitesexplícitos, sinnuevosrequisitos.

Servidoresmedición propiososdetenidos (streaming48236/M1last85684 SIGTERM143intencional);3201/túnel intactos. Día18setup/stabilize/login/cleanup wrapperCI EXIT0,2fixturespropiasretiradas, M0día17datos+artefactosintactos. OriginalM0fixtureSHA7777dc30…sin cambios. Candidatebuildtar SHA312779d0131380c9c6a83b951e7efb2cdef1514c35d89bc38ffbb93c375a9828 archivado; baseline7d23220…intacto. Day18manifestprecleanuphash1cde…preservado en archivoEXPLÍCITAMENTEreconstruidodefase(cleaned→ready-exposed)conhashidéntico alregistrado antesnative, nosimulardocumentooriginalinalterado.

Cierre operativo COMPLETO: QAmdfinal34a78bee entregado/aceptado e integradoFFdev→mainlocal. Los tres tasks factory backoffice-0238-client/server e inbox-measurement-20261018 integrated/retired, worktrees retirados limpios y sin procesos, sinforce. Snapshot candidato/branches diagnósticas/artefactos preservados fuera del producto; hooksDB NOintegrados. Checkoutprincipal siguedev, códigoapps/packagesidéntico aproducto660. Sólo resta QA manual del owner y eventual nueva autorización de push/PROD; no continuar implementando ni abrir más pruebas de oficio. Archivosuntrackedajenosintactos. CIremotorojo/FAIL1817.621042ms/guardias24PASS2FAIL/todosdiferidosintactos;102PROD sólohistórico. Ownerfrustrado por >3h: se reconociódemora innecesariaendiagnósticosdeobservadores, seconfirmódevlistoynúmeros20%/1.6swarm/3.1sassetsnuevos.

## HISTÓRICO — 0238 CÓDIGO INTEGRADO; COMBINACIÓN NATIVA Y M1 PENDIENTES (2026-10-18 UTC)

Actualización05:05UTC: M1 **EN EJECUCIÓN**, exec78893, runner normal sin inyección, frozen config `/artifacts/m1-campaign-config.json` SHA cb46a53d4b413865c28c46473330fca1ba5341cd577887ae70626499f6339ca0; inicio05:02:13UTC,24bloques seriales encurso, sin resultados inferidos. Servidor streaming48236 detenidoTERM intencional143, no3201. Día18 fixtures setup/stabilize/login protegidosEXIT0, privadas `/artifacts/m1-fixtures-20261018`, amboscontrol/candidatomismas; day17COPYpreservada final-smoke/fixture-day17-before-rollover.json, originalM0intacto. Intento day18setup4:59 abortóguardANTESoperación, preservado; luego05:00setupválido. Build/fuente ycookie/manifests hashes freeze `/artifacts/m1-build-freeze.json`,`m1-fixture-input-freeze.json`.

NativeV6 intento sandbox fallósetup antesUI (reporte sólo Error, causa específica no registrada), preservado; mismafuente escalada `/final-smoke/real-smoke-v6-escalated.json` vuelveRSC200ERR_ABORTED pero committednewboot/form/nodo/selectionconservados/restoredtrue. PassiveJSobserver no signalRSC/noreader.cancel; todosAbortControllerstacks8750 mapeados APIowner releases/invalidate/ack, no señalRSC; sourceNext/preload sin mecanismo causal probado. QAindependiente `/final-smoke/qa-rsc-criterion-review-v1.json` acepta criterioACOTADO refreshmismoámbito+cambiomódulo+formularioconservado: EOF exitoso no exigido paraesecriterio; EOFdocument streamingespruebaparteypasó. V5/V6strictFAILintactos/cancelaciónsinexplicaciónseguirálimiteabierto, no declararbenignoniignorarfallo. QAparcialgeneral `/final-smoke/qa-partial-review-v1.json` corrobora4readycounts/streaming4diagnósticos/seedDTOlógico638+1628/noRSCbytes. Aprepara script recursos M1 sóloarchivo, noDB/app mientrascampaña; QAidledisponiblefinal.

Owner YAavisado puedeprobar dev-business.checkpass.club/backoffice (últimocommentary), código integradoensource660/HEADdocumentalc27e8964, localhealth200/backofficeredirectesperadoonboarding200sinlogin. CloudflarebloqueaPythonUA403code1010, peticiónequivalenteUAnavegadorhealth200, nofalloproducto. MediciónseparadaCI no afectaDBlocalowner; tiemposfinalespendientes. No main/push/PROD.

Producto dev `660677583d406d6e4f58a1900383ffff1fb3ef2a`: integra refresh fuente `64c9f5a4` tras QA congelada `ce55e0a7`. QA56unit+8browser PASS; autor103unit+40browser compatibles, fallos de setup/expectativas previos preservados en handoff. A/B aceptados y sin nuevos cambios producto. Main local no avanzado; sin push/PROD. Dev-business sirve checkout principal3201 pero no se anunció listo para prueba final.

Root posee temporalmente tercer WT `/private/tmp/checkpass-inbox-measurement/inbox-measurement-20261018`, branch diagnóstico `backoffice-0238-m1-native`, HEAD `fd311140e0d795a14d4411bbd9e97e13c591807f` limpio. Contiene sólo hooks DB idénticos M0 y next-env generado encima de producto660; NUNCA integrar commits diagnósticos en producto. QA branch preservada660. Factory task `inbox-measurement-20261018` reservado, recursos db:ci-integration,port:43152,harness:0238-m1-native. Build Next webpack producción EXIT0, BuildID RoKl_95Hr1WmuwmlyZrZs. Servidor propio43152 activo runner-streaming.cjs (exec91751); no tocar3201/túnel. Control archivado BuildID0aSS2kXLE25vivcaGSmhi, tar hash7d23220… verificado, no modificar.

Smokes nativos ready-empty/ready-five,4entradas válidas, versiones hash verificadas/0pageerrors/0timeouts, documento4SELECT (antes9),0GET inicial sesión/módulos,1Inbox/1checklist. Sólo diagnóstico, no mejora temporal demostrada. Provider snapshot lógico638bytes core+1628bytes modulesSeed,5módulos, allowlist sin privados; no confundir con bytes wire. Artefactos `/private/tmp/checkpass-0238/final-smoke/` y `/artifacts/seed-bytes.json`.

Streaming: inyección controlada módulos documento5s y rechazo previo transporte,2intentos/caso. Analyzer-v2 SHA8f830514e1a19b16dfd9e99c6b09ae8af82327ae685652932e90df22267ff65d correlaciona request-end por RID SQL inyectado (prefetch mismo path hacía falsoFAIL original, preservado). Recomputación RAW originales slow2/2: Inbox ready3243/2027ms antes EOF6170/5712ms; reject2/2 recuperación1GET módulos200/entrada,22SQLbalanced. Root/QA revisión pendiente, no outage realNeon ni benchmark.

Prueba dos pestañas nativa: artefactos v1-v5 preservados. v5 04:54UTC RSC real no-prefetch200 abortado netERR_ABORTED a475ms; HostRoot confirma nuevo boot, mismo scope/timeOrigin/input/value/tab/selection y0POSTcatalog, restauración módulo true verificada. Oráculo EOF FAIL, no PASS final. A investiga código local Next/React READONLY para determinar cancelación tras commit vs bug; QA revisa evidencia parcial sin moverrefs ni DB/app. No seguir reruns ciegos ni relajar tests para ocultar fallos.

M1 cuantitativa aún NO ejecutada. Orquestador011d/inspector2562db/analyzer37e20 permanecen congelados,24bloques/120reload+24firstentries ABBA,settle5000, sin retry/overwrite. Al cruzar05:00UTC día Guayaquil18 preparar fixtures EQUIVALENTES nuevas para AMBAS fuentes, no tocar originalM0. Runner privado `/artifacts/run-fixture-day18.cjs` SHAe228e2ea52bd82daa8457d65309682a19a81843f25c915e70639f3b8f8ae08e5 preparado/checkPASS, no ejecutado; setup/stabilize/login sólo wrapper protegido, manifiesto nuevo `/artifacts/m1-fixtures-20261018`, copiar a mutable final-smoke/fixture.json para inspector. Preflight M1 previo102/0DDL/111columnas iguales/drift histórico intacto. Fixture originalM0 SHA7777dc30… intacta. Control contemporáneo ambos con mismas cookies/fixtures/día/config, M0 histórico~2.04s no cifra nueva.

Owner frustrado por demora, última respuesta: código QA por componentes,9→4consultas, fallo cancelación Next por aclarar, sin cifra de mejora ni listo final. Estimación04:13UTC60–90min provisional, no dar otra promesa sin resolver. Continuar trabajo hasta evidencia final y aviso dev, no finalizar sólo con status. QA manual anterior/CIremoto rojo/FAIL1817.621042ms/guardias24PASS2FAIL/todos diferidos intactos,102PROD sólo histórico. Untracked ajenos no tocar.

## HISTÓRICO — 0238 CHECKLIST/MÓDULOS ACEPTADOS; ÚLTIMA PIEZA REFRESH (2026-10-18 UTC)

Actualización preparatoria mientras B implementa: A INSPECT wrapper EXIT0, sinteardownpendiente ysincrear/eliminar/exponer; copia `/private/tmp/checkpass-0238/final-smoke/fixture.json`, díaactual2026-10-17Guayaquil,0/0 y5/5. OriginalM0 SHA7777dc30…intacto; faseJSONstale ready-unexposed no sustituye observaciónSQL. DB CI liberada, A resource sóloharness:0238-final-smoke-prep y scriptNextreal aún enpreparación/noejecutado. Rootorquestadorprivado `/artifacts/run-m1-campaign.py` ACTUALSHA011d42686993914844995865d2ee6bdcbac658e022d54fe8acb603038de86f07; inspectorroot `/artifacts/run-fixture-m1-inspect.cjs` SHA2562db917f909a6f8ec8d980b1c2b4c615e0bb0700fb98c4383d7bc7d363521d. SyntaxPASS,noejecucióncampaña/configfinalaúnnoexiste. QApreparatoria leyócampaign54d4495+inspect2562db(trascorreccionesSETTLE5000recetacuant,SIGTERMcleanup,TERMgrupoownedaunqueparentmuerto,24tags/logs/summarieswx,invarianteM0falseexitnon0). Delta posteriorroot011d sólo TCPport-open guardpreflight/stop (health200solo readiness), atendió límiteQA. NoafirmarQAhash011d explícito; reutilizarevidenciacompatiblemáslecturarootdelta. Build/productSHAs/manifest/binariesfreeze necesitanverificaciónexterna, configdeclarativa no certifica fuenteautomáticamente. Secuencia24reports6ABBApares/caso*5reload/control+candidato=120reload+24firstentries, tags/nombrescompatiblesanalyzer; dayGuayaquilantesydespuéscada bloque, nooverwrite/retry, fracaso STOPpreservapartial. Inspector usaCOPIAAfixtureyCIseleccionadaWT, tagregex24únicos, logs/summariesrootm1-inspections/; originalAinspectrunneresSINGLE-USE(logax)NOusarlo24veces. Preload/runnerM1/analyzer numérico anterioresinalterados, traceM1appendseparado. RecursosCI exclusivos deben reasignarse durantecampaña, snapshots fuera reloj. Userestimación04:13UTC60–90min sigueprovisional, M1todavíaNOdatos.

Dev `8f34359e` integra checklist fuente `61e5214edb7c7c17bee86337407c74e0da3ba832` y módulos `a2bd4668a30cfe54c79b2a9489f00263f7dcb36e`, ambas factoryaccepted tras QA congeladae90c581c5f8fb87d5d86d4b672642aced9364ed3. QA TSCmerchant0,79unit+7checklistbrowser+4ModuleSettingsUI/provideroptinPASSsinretry. Dependencia TSC A ausente APIsB resuelta ENcombinado sincasts. QAoptinfuera repo /private/tmp/checkpass-0238/checklist-modules-qa/module-settings-qa.spec.ts; primer2locatorFAIL/1interrupted/1norun (clickinputKitinterceptado, noPUT) preservados; tecladoSpaceaccesible4PASSsalidaseparadasinforce/relajaroráculos. AutorB100unit35browsercompatibles, A27unit. ChecklistAPI authverifyexenta/capturadescartaviejo, ENDcallbacktourreal, scopedGET confirmaitems; móduloDTOFULLticket/base/shape ycopy→invalida3ANTESmerge. NoNext/DB/perf certificado. QAtercerWT limpio8f34359e, recursosliberados.

B continue8f34359e y GO ÚLTIMOpiece GLOBALFOCUS/RECONNECT/ROUTERREFRESH, resourceharness:0238-client-refresh, artifacts /private/tmp/checkpass-0238/client-refresh/. Pathscontroller/.test/provider,nuevo backoffice-context-refresh.ts/.test, Inbox/checklisthelpers/.test, Inboxhook (retirarlistenerfocuspropio), layoutSÓLOnombreconsumer, contextbrowser/fixture/handoff. Firmaconfirmadaestructuralnormalizadarole/permsordenados/status/billingaccess/id-enabledmódulos, initialbaselineNOrefresh; revisionesmonótonas/demandamarkantesrouter.refresh void/ackbootcomprometidomismoscope,1pendingúltima inclusoA→B→A,sinloopniinstalarseedfreshness. PIN403pin_change_required1demandaportransición, email403NOloop. Focusvisible+onlinecoalesce1/resource; session/modulescoreválido, Inbox/checklistSÓLOobservados;0GETauxinitialready, noSSRInbox/nopolling. Nombrecore cambia medianteconsumerprovider8líneasaproxenlayoutblocked,SINguard/branches/estilos. GuardRSCautoridad,sinRBACclientnuevo. BrowserformBusinessSettingsREAL conRSCmock/trial→subscribed/permisoajeno/noreset; mergeNextrealpendiente. Bloqueado→subscribedwrapperslímiteexplícito,norediseñoporconjetura.

A ARTIFACT-ONLY final-smoke prep, taskbackoffice-0238-serveracceptedWTlimpioAa2bd (NOcontinue/moverrefs), resources db:ci-integration,harness:0238-final-smoke-prep exclusivos. Sólo /private/tmp/checkpass-0238/final-smoke/: directorio0700,COPIAnuevafixtureoriginalM0, runnerguardadoclonrun-fixture conM1preflight/COPIAmanifest/logspropios, operación INSPECT sólo wrappertools/neon-test.sh; nologin/stabilize/setup/cleanup/DBdirect/PROD. RootpreflightM1readonlyejecutado Node24PASS: /artifacts/ci-preflight-m1.cjs/.json102/0DDL/111columnasiguales/drifthistórico intacto, endpoint4e09cdfbd634. No repetirDDLni tocaroriginalfixtureM0/manifests/control. A reportarádía/inspectsegurosypreparará(noejecutaUI) scriptPlaywrightnativo2tabs: catalogCategoríasinputborradorsinAñadir, tabBtoggleGastosUIREAL→focusA→RSCcatalogterminado/sametimeOrigin/mismonodo/value/tab/0POSTcatalog, restaurartogglefuera relojM1; sinmocks/HAR/markslogs/productglobals/framework. Build/serverfinalroottrasfreeze, no tocar3201/túnel.

Rootpreparó artefacto /private/tmp/checkpass-0238/streaming/runner-streaming.cjs SHA256e257f24bf10408a0c48e25de9e1689268289781fbe96b8b4e05463f8a9962a6e, sintaxisNode24PASS/noejecutado; varianteM1launcherconpreloadstreaming/logPIDpropios ybuildrootexplícitoobligatorio, guardCIpreflightM1. Preload/analyzerstreaminganterioresinalterados. M1 NOejecutada. A las04:13UTC user pidiótiempo: estimaciónPROVISIONAL60–90min para conjuntodev, luego M1; no promesa ni mejora demostrada. FixtureGuayaquil día17 cruza05:00UTC: si cruza, preservaroldcampañayreprepararequivalente antes A/B, noinvalidarmétodo.

Siguiente: Brefresh→QA/integrar; freezeC ysmokeNextreal/streaming/headers/formularios; campañaM1concontrolcontemporáneo6bloquesAB/BA y30recargasporcaso/fuente; QAevidenciafinal/avisarownerdev. Healthdev200noequivale listo, dominio3201sirvecheckoutprincipalDBlocal, sinpushnecesario. MainlocalSINavanzar; nopush/PROD; QAmanualanterior/CIremotorojo/FAIL1817.621042ms/guardias24PASS2FAIL/todosdiferidos/archivosajenosintactos. Estadosanterioresconartefactos/recetas detalladosmásabajo.

## HISTÓRICO — 0238 INBOX+TOURS ACEPTADOS; CHECKLIST/MÓDULOS EN PARALELO (2026-10-18 UTC)

Owner pide tiempo restante y dev para probar/números nuevos. Se dio estimación PROVISIONAL1–2h para conjunto dev si no aparecen fallos, luego medición; no promesa cumplida ni velocidad demostrada. Hora observada03:37UTC18oct: fixtureM0 día17Guayaquil cambia05:00UTC, revisar día antes M1 y preservar campaña si cruza. Dominio existente health200/merchant3201 cwdprincipal/DBlocal envcheckPASS; no publicar/push necesario para servirdev. No anunciar conjunto listo por health.

Dev `6173451c` integra Inbox fuente `e2eba8af7709a0b0f4fff74cd87639f465cea523` y tours `e04a8f1c681c1a1e62c348dfa8992c3742c7c373`, ambas factoryaccepted tras QA congelada `752703a7`. QA71unit+28browserPASS sinretries/skips; autorInbox73unit/28browser, tours56unit, compatibles. GETcancelado lifecycle espera terminal poridentidadantesdecisión (finished/failed), conserva3→4GET/2cards/1POST. Histórico26PASS/1FAIL y27setupMachPort preservado.403/402limpianInboxsinretirarcore/loop;401/scope409retiran. Últimolectorcleanup libera lease sininvalidarseed, decisiónreal síinvalida/recupera módulos. Tourscincocallers/tresretries capturanantesRAF/click, generaciónchecklist no invalida intención, sinPOSTayudapersistfalse. NoNextreal/M1/DBnuevo. QAtercerWT limpio6173451c, recursosliberados.

B `/root/backoffice_0238_client` continue a6173451c y GO CHECKLIST OWNER, resourceharness:0238-client-checklist, artifacts /private/tmp/checkpass-0238/client-checklist/. Reservados controller/.test/provider,onboarding-checklist.tsx,nuevos checklist-context-resource.ts/.test,contextbrowser/fixture,handoff; inbox-context-resource.test.ts explícitamenteextend para mocks nuevosadapters sinrelajar24oráculos. acquireChecklist/refreshChecklist/verifyChecklistEmail y snapshotúnico, MISMOowner. ENDproviderúnico/uihideonly, coalescing/pendiente/StrictMode/lastcleanup;0counterSSRGET;401scope409retiran/402403sólorestricted; authverifyexento capturaantesawaitdescartaviejo, verifiedtrueGETconfirma sinparcheitemsraw. No globalfocus/routerrefresh aún.

A `/root/backoffice_0238_server` continue a6173451c y GO MÓDULOS UI/INTENCIÓN, resourceharness:0238-client-modules, artifacts /private/tmp/checkpass-0238/client-modules/. Reservados settings/module-settings.tsx,module-configuration.tsx,use-business-modules.ts,module-navigation.ts,nuevo module-toggle-intent.ts/.test, handoffPROPIO0238-modules-client-handoff.md. NOcontroller/provider/owner/onboarding porunionvieja. Fuenteúnicasnapshot, eliminaGETsesión/móduloslocales/rawDTOautoridad. Capturascope/ticketantesawaitPUT, invalidation3recursosantesPUT, scope409retirosinreplay, errortardíonoaplica; pierde generaciónmismascope→revalida,sinrepetirescritura. Quitarrouter.refreshadhoc, refreshcoordinado siguependiente.

API dependencia explícita a implementar por B ÚNICOescritor mientraschecklist: applyConfirmedModule(ticket:BackofficeResourceTicket,module:ModuleDTO):boolean y revalidateModules():void. ApplyvalidaticketCOMPLETO/DTOid/baseactualready; invalida generacionesmodules/inbox/checklist SINCRÓNICOANTES mergeDTOconfirmado (oldGETnopisa), false siobsoleto/no base. Revalidateinvalidamódulos+ownercola, sinsegundoHTTPstore. A desarrollahelper/UIcontrafirmas; TSCfinal espera APIsB/integracióncoordinador, no importarworkingtreeajeno ni fingirPASS. RecursosmockReact/harness sinDB/appreal. Specs/INDEX/estadoonlycoordinator; no extraagentes.

Siguiente: entregaschecklist/módulos→QA/integrar; foco/reconexión/refreshcoordinado preservandoformularios; QAappreal/streaming/seguridad/conteos; candidatoC/M1controlcontemporáneo. M1NOejecutada, baselineM0~2.04s no resultado nuevo. Artefactosstreaming/numerical y receta congeladaenbloquesprevios. Mainlocal sinavanzar; nopush/PROD; QAmanualanterior/CIremotorojo/FAIL1817.621042ms/guardias24PASS2FAIL/todosdiferidosintactos. Archivosajenos sinseguimiento intactos.

## HISTÓRICO — 0238 CLIENTE B1b+B2a ACEPTADO; B2b-I INBOX EN EJECUCIÓN (2026-10-18 UTC)

Owner pide aviso explícito cuando pueda probar el conjunto en dev-business.checkpass.club y números antes/después; está frustrado por la demora. No confundir M0 ~2.04s con resultado mejorado: M1 todavía pendiente. Dominio health200, merchant PID927 cwdcheckoutprincipal/apps/merchant puerto3201; envcheckPASS conDBlocal/orígenesdev, no publicación/push necesario (túnel existente). Que responda health no certifica candidato listo.

Dev `556a313b` integra fuente B corregida `d24957504d2443727ac3be208260ab83e441cdea`, aceptada por factory tras QA independiente del candidato congelado `f8875c2c`. QA reprodujo58/58unit y16/16browser (context10+módulos6 completos), autor22browser compatibles. Primer arranque browser QA sandbox falló16casos0ms por MachPort; mismo candidato con permiso técnico pasó, logs separados/preservados, sin retries de casos. No es PASS Next real/StrictModebrowser explícito ni rendimiento. Fallos4916 históricos conservados; revisión corregida aceptada conjuntamente, no aceptación retrospectiva de4916.

B factory continue a dev496296f4 completado y GO B2b-I Inbox enviado. Primer intento ORIG_HEAD.lock EPERM de sandbox, resuelto con permiso técnico escalado, sin rechazo auto-review ni fallo del producto. Paths nuevos reservados analytics/inbox-state.ts y opcional.test, inbox-context-resource.ts/.test; controller/.test/provider y browser context/fixture/handoff siguen reservados. Recurso harness:0238-client-inbox, artefactos propios /private/tmp/checkpass-0238/client-inbox/, solo React/mock HTTP/puerto efímero, sin DB/app real. API específica acquireInbox/refreshInbox/decideInbox y snapshot único usan mismo owner/tickets; captura antes await, operación invalida GET anterior, máximo un refresco pendiente durante POST, mantiene operationId/version y timers/foco existentes, scope409 retira sin replay. Pruebas de dos lectores/StrictMode, GET viejo→POST→foco/remount, errores/reintento e Inbox realdecisión con seedmódulos pendiente. Siguiente II subdividido checklist+tours → módulosPUT → señalesglobales/refresh/forms; no habilitado todavía. Provider/controller/estado/owner compartidos y sesión/módulos ya integrados; Inbox GET/POST todavía legacy y checklist/escritores/foco/reconnect/router.refresh pendientes. QA tercerWT limpio en556a313b tras informe; recurso harness:0238-client-qa liberado. A preparación streaming terminada, recurso harness:0238-streaming-prep liberado, artefactos intactos; todavía falta revisión/ejecución real. Backend S aceptado permanece integrado. No tarea DB/app real activa.

Siguiente: reservar y habilitar B2b en piezas pequeñas, QA pertinente/combinación real, campaña M1 comparable. M1 NO ejecutada, sin mejora declarada. Main local sin avanzar; sin push/PROD; todos los diferidos, QA manual anterior, CI remoto rojo y FAIL histórico conservados. Contexto operativo/artefactos/SHAs anteriores en bloques siguientes. Archivos ajenos sin seguimiento intactos.

## HISTÓRICO — 0238 S-SERVER ACEPTADO; CORRECCIÓN CLIENTE EN CURSO (2026-10-18 UTC)

Dev `15a8772aaf5d4ea8a5e19c1671a9c18c008a3f81` integra S-servidor `3c5b330eaf8c8f8722240527e504aa92550ce3fe`, aceptado tras QA independiente139/139 unit y reutilización compatible de6 Neon nativas del autor (297unit). Scope HTTP en seis superficies adoptadas, guards antes de comparación constante y dominio después; reporter/auth exentos. Snapshots nativos verifican conteos de cinco tablas, no valores completos. No certifica aún cliente vinculado, RSC real ni rendimiento. Backend de A completo; DB CI libre, último preflight S102ledger/0DDL/111columnas relevantes iguales y drift histórico intacto.

B1b `4916ab386fbeb5afb4b5d2da201dee5906d0f642` RECHAZADO por dos fallos browser de módulos; no integrado en dev. B conserva revisión/evidencia y corrige sobre misma base `a40a3be6`, factory reserved, junto con B2a sesión/módulos: controlador atómico, parser reporter, owner existente y provider useSyncExternalStore; eventos crudos solo señal para revalidar servidor. Autor reportó19/19 browser y58 unit focales; todavía no hay SHA final ni QA independiente de la corrección. Pendiente cerrar último caso legado GET preevento con respuesta vieja retenida y nueva generación autoritativa; autorizado adaptar stub servidor conservando aserciones, controles negativos y evidencia4916. No afirmar spec browser completa verde hasta ejecutarla. Inbox/checklist, foco/reconexión y refresh conservando formularios aún pendientes de B2b. B artifactowner/resource `harness:0238-client-b1b`, sin DB/app real.

QA tercer WT está limpio en `15a8772a`, base factory `6857fdd1`, detenido tras S aceptado, esperando revisión B congelada. A preparó SOLO artefactos privados en `/private/tmp/checkpass-0238/streaming/`: preload-streaming.mjs SHA256 f701c32c86da99b71b780ed3529fdfb3ec61cb1257a8f74206ce9ca24fd55811, analyze-streaming.mjs177eed53b6bb722c41c3445c3c66075f939f738246b5286d6406529c04f2271c, README4446d47766ff314a36e41b3271f3588dfcc6784c6f50e3398ccaa3281ea88a0f. Sintaxis Node24PASS, sin app/DB/red ni cambios repo. Inyección diagnóstica5s/rechazo antes de transporte SOLO query exacta módulos en documento /backoffice, recuperación /api/modules sin inyección. Pendiente revisión completa del coordinador y ejecución real; no es evidencia de outage Neon ni de streaming correcto. Recurso A `harness:0238-streaming-prep` hasta cierre de preparación.

M0/receta M1/analizador numérico y límites siguen en bloque anterior. M1 NO ejecutada; no declarar mejora de velocidad. Siguiente: entrega corrección B→QA independiente→integración, B2b consumidores, QA combinación real/streaming/formularios, campaña comparable M1. Main local sin avanzar; sin push/PROD. QA manual anterior, FAIL1817.621042ms, CI remoto rojo, guardias24PASS/2FAIL y todos los diferidos conservados.102migracionesPROD sigue dato histórico. Archivos ajenos sin seguimiento intactos.

## HISTÓRICO — 0238 A2c ACEPTADO; B1b Y S-SERVER EN PARALELO (2026-10-18 UTC)

Owner autorizó implementación por checkpoints y aceptó scopeKey. Dev a40a3be608830e0a4e7c837accfbd1896047f681 integra A1/B1a/A2a/A2b JOIN, S1-client opt-in, B2a-owner aislado y **A2c constructores** (fuente7072dd6a, QAa40a3be6). QA A2c reprodujo88/88 unit y reutilizó8 reporter Neon compatibles, autor250 unit/tipos/lint/formatoPASS. A2b previo4ecf365d/QA6db184bf: QA206/206, autor420unit+5Neon+9auth nativas. readBilling(biz,mode) obligatorio, fallback una vez por modo, sin mezclar errores del mismo negocio; readSelection privado. HMAC puro/canonical, core mínimo y módulos separados, getter readBackofficePagePlan sinSQLextra, categoría precargada y reporter JSON200/inactiva nula sin revocar. **No Dashboard completo, velocidad, RSC real ni protocolo HTTP certificado aún.** Doce DB legacy adaptadas no ejecutadas; dos warnings staff y guardias módulos24PASS/2FAIL heredados conservados.

A `/root/backoffice_0238_server`, WT/task/branch backoffice-0238-server en /private/tmp/checkpass-0238/backoffice-0238-server: factory continue a40a; **GO S-server** helper backoffice-scope-http.ts/unit/neon y soportes unit/native separados; adapters InboxGET/decisionPOST, modulesGET/toggle(dispatch.ts), checklistGET/tourPOST. Paths reservados exactos, más dispatch.test.ts. Comparación UNA vez solo adapters tras guards COMPLETOS, sin cambiar selectores/autorización ni reAuth/SQL: null header legacy; vacío/malformed409, regex64hex/HMAC timingSafeEqual; nada de dominio antes. Reporter/auth/history/day/cron/resto dispatcher exentos. Respuestas privadas adoptadas en todos retornos private,no-store. Coordinador autorizó mínimo catch operativo en Inbox/módulos: antes framework500 por guardthrow fuera try, ahora503 codificado por mapper existente; 401/403/402 y orden intactos, documentar delta. Primer unit59PASS tras fallo setup hoisted preservado; regresión197PASS/types inicialPASS; matriz Neon nativa preparada (6superficies staleA-cookieB, mismaUID nueva sesión, staffA-ownerB, gates, matched/legacy, spies passthrough y snapshots). **Aún NO DB S**, pedir recurso/preflight antes. Recurso CI actualmente libre; preflight último a2c102ledger/0DDL/111columnas iguales, drift59/60/64/97 intacto. A2c reporter8Neon teardown terminado/liberado.

B `/root/backoffice_0238_client`, WT/task/branch backoffice-0238-client en /private/tmp/checkpass-0238/backoffice-0238-client: factory continue a40a; **GO B1b** layout/page/nav/TrialNotice/provider/state/hoja backoffice-modules-seed.tsx, layout guard/billing tests CORRECTOS en app/backoffice, nuevo tests/e2e/backoffice-context.spec.ts y support/backoffice-context-fixture.tsx. Reservados7fixtures existentes (modules-ui-harness,tables-harness,loyalty-entry,pos-counter-harness,counter-harness,analytics-fixture,billing-harness) y backoffice-seed-fixture.tsx. Nav/TrialNotice provider obligatorio: rechazado agregar fallback productivo solo por fixtures; bootstrap HTTP SOLOtest legado conserva roles/módulos/billing sin simular eventos/store posttoggle ni relajar asserts. Nuevo fixture seedDIRECTO verifica0GETaux al montar y Suspense/retirada; no equivale a RSC real. Provider oculta TODOSchildren core:null, AMBAS ramas layout; nav/trial fuente única, PagePlan privado quitaSELECT. B1b interno no certifica recuperación/foco/eventos hasta B2: registrar FAIL dependientes, no aparentar verde con legado. Artifactowner B exclusivo /private/tmp/checkpass-0238/client-b1b/{playwright.config.mjs,results,...}; registryresource harness:0238-client-b1b, puerto ephemeral propio startCatalogHarness; autorizado mocked Reactbrowser, SIN app real/DB, cerrar anteshandoff. Todavía NO adoptar headers cliente. B2a-owner3ffd/QA07578 ya integrado10/10; S1-client9de/QA5ad integrado29/29. Integración atómica posterior B2: reconcile solo estado local autoritativo, nunca RSC/stamp viejo; decisión Inbox antes módulos lentos cierra seed y exige recuperación coordinada, no loading eterno.

QA `/root/backoffice_0238_qa`, tercer WT /private/tmp/checkpass-inbox-measurement/inbox-measurement-20261018, branch backoffice-0238-qa-b1a/task inbox-measurement-20261018: limpioa40a3be6, factory basefb83a43e; detenido tras informe A2c aceptado. No mover mientraspruebaactiva. Branch producto SIN hooks c9; instrumentación vieja/next-env preservados en branch originale5f9cb05, no incorporar al producto. No cuartoWT ni agentes extra. Nuevas entregas B1b/S requieren QA independiente y final combinación; nativos anteriores no sustituyen scope HTTP ni RSC/browser.

M0 completa con límites: [informe](../factory/0238-m0.md),62/62 válidos; ready recarga vacío mediana/p952045,8/2276,6ms, cinco2037,85/2289,5ms; documento9SELECT/guardInbox4lecturas. Artefactos/buildbase privados /private/tmp/checkpass-0238/artifacts; servidores reales detenidos. M1 aún SIN ejecutar: seis pares AB/BA,5reload/source/block,30por caso, control contemporáneo archivado. Harness0c0f/f107 valida versiones hash AMBOS (M016ec no lo hacía; límite y originales intactos). Preparados preload-m1.mjs/runner-m1.cjs con trace/log/PID separados, require ci-preflight-m1.json fresco aún inexistente/buildroot explícito; baselinecompiled chunk9773 contienehookWS c9 archivado, no depende de sourceDBactual. Analizador analyze-m1.py SHA37e20d531962c5f7628e756405006ebbb67af02b73352aff829ca6d9bf1be9db **PASS preparatorio QA sintética**, no rendimiento. Hallazgo caso vacío renombrado cinco corregido (case+IDs0/5), fuente rechazada exactaa7ff preservada analyze-m1-invalid-case-a7ff.py; sintéticos separados /private/tmp/checkpass-0238-qa-synthetic-numerical-20261018. Método registrado antes datos enplan. EXIT0+booleanfalse NO PASS; timestamps no prueban exclusividad, conservar orquestación serial. Py_compile falló cacheMac fuera sandbox, compile enmemoriaPASSsinbytecode; no ocultarsetup.

Skill Impeccable aplicada solo integración frontend acotada: SKILL/optimize leídos, context UNA vez contra layout; incumbente autorizado sin PRODUCT/DESIGN. B leyó craft-floor antes UI. Sin init/update/rediseño/agentes extra ni cambios kit/guard/estética por extensión. Usuario informado en commentary.

Siguiente: entregar B1b/S-server→QA/integrar dev, B2 atómico/invalidación/eventos/callers scope; combinación real RSC/streaming/matriz negativa; M1 comparable; QA final antes main local. Main local sin avanzar. **Sin push ni operacionesPROD**, QA manual anterior/CI remoto rojo/FAIL histórico/todos los diferidos intactos;102migracionesPROD es histórico sin nueva comprobación. Estado/INDEX/contrato/plan coordinator-only; archivos ajenos sin seguimiento intactos.

## HISTÓRICO — 0238 M0 COMPLETA; QA PREPARACIÓN PASS CON LÍMITES, A1 SIGUIENTE (2026-10-17/18 UTC)

Owner aceptó scopeKey y autorizó implementación por checkpoints. D0 cerrado6e45066c. [M0](../factory/0238-m0.md): buildWebpackprod/Chromium real contraNeonCI protegido, fixtures propias0/5 yloginOTP real.62/62intentos válidos (primeraentrada+30recargasporcaso),0timeouts. Mediana/p95 ready recarga vacío2045,8/2276,6ms ycinco2037,85/2289,5ms. Documento9SELECT; Inbox11operaciones(9SELECTincllock+BEGIN/COMMIT), guardauth4. Navegador2módulos/2sesión/1Inbox/1checklist. No mejora niSLOPROD demostrados aún. Artefactos ybuildbasearchivado privados en /private/tmp/checkpass-0238/artifacts; app43152detenida.

QAindependiente `/root/backoffice_0238_qa` en tercerWTmedición existente: informe iniciale1a8ded0 SOLOdocs/factory/0238-qa.md, cherry-picksoloesecommit(no rama c9conDBhooks). Recomputó62muestras y3038SQLstart=end (49/entrada); PASSpreparación conlímites, no producto. FixtureA8591e003 genérica moduleIdsconfigexterno, inspect1/1,24guardPASS2FAILheredadossinnewoffenders; B16ecM0versionsfiltrabadecimalenvezhashstring, limitéafrontendready/IDs yfixture/SQL estado. BcorrigiómétodoM1en0c0f9a44, QAestáticodeltaenprogreso; manifestsM1versionhash reales, controlA/candidatoBusaránmismométodocorregido. RecipeM0histórico16ec preservado. RootfiltroHTTPNeoncorregido(hostapi vsDB): primerascapturas62http-incomplete conservadasfueradeconteos, repeticiónM0completaantesproductoconHTTP+WS. No ocultar errores/primerfixture7d/noCPUporfunción.

A/B tasksfactory entregadas (A8591, B0c0f trasreject16ec); pendienteaceptarsegúnQAymergepreparaciónDev, sincronizarWT ydespacharA1contrato único. A2a/B1anoantesA1entregado. Aactualresource db:ci-integration trasinspect, liberarloparaotrotramo; servidornoactivo. TercerWTtienenext-env.d.ts generado porbuildyQAlorespetó; preservarloencommitpropioantescambioramaQA, nunca descartar. M0soloRAMruntimeproducto005b=cierreD0, hookc9fueraDev. CIremoto90ebe rojo, QAmanual/FAIL1817,621042ms/diferidos intactos.102migracionesPRODhistóricas, sin nueva comprobación. Sin push/PROD.

## HISTÓRICO — 0238 SCOPEKEY ACEPTADO; D0 CERRADO, M0 EN PREPARACIÓN (2026-10-17/18 UTC)

Owner aceptó explícitamente protección scopeKey tras ejemplo UIA/cookieB. Spec cerrada, ADR aceptado, INDEX actualizado en6e45066c; autorización de implementación por checkpoints vigente, sin push/PROD. A/B iniciados y preparaciones documentadas en susWT; encargos actuales SOLO harness/fixtureM0 previos a optimización. A fixture/loginauthreal opt-in en testsneon focales reservados; B harnessPlaywright externo con observadorDOM/fetch/red previo navegación. NoA1/A2/B1a antes deM0. [Registro actualizado](../factory/0238-launch.md).

PreflightCI readonly:102ledger,latesttimestamp0101igual,0DDLpendiente; drift histórico hashes59/60/64/97 preservado SINreparar.111columnas relevantescoincidenlocal. A tiene resource db:ci-integration y envCI-only seleccionado. Baseline viejoWTmedición preservado encommitc9fe9356 de instrumentaciónpropia; producto005b8235 igual apps/packages deD0. BuildWebpackprod EXIT0, servidor propio43152 iniciado solo para próximoM0 sobreCI. Rootrunner/preload/config privados en /private/tmp/checkpass-0238/artifacts. Primerfixturevisible0/5 noM0válida porvida7d vswriterpolicy, A corrige/restaura concleanupIDspropios conservandolog/manifiestov1. Loginreal desdeproceso test/console parafixtures, cookielegítimavalidadaenbuildprod, no habilitarconsoleenPRODniinventartoken. No mediciónnueva todavía. QAmanual/FAILhistórico/CIremotorojo/diferidos intactos.

## HISTÓRICO — DOS IMPLEMENTADORES 0238 INICIADOS EN PREPARACIÓN; D0/M0 PENDIENTES (2026-10-17/18 UTC)

Owner autorizó poner en marcha agentes por piezas pequeñas. [Registro](../factory/0238-launch.md): A `/root/backoffice_0238_server` en `/private/tmp/checkpass-0238/backoffice-0238-server`; B `/root/backoffice_0238_client` en `/private/tmp/checkpass-0238/backoffice-0238-client`; basee93d0487, dependencias propias y reservasfactory con susIDs. Encargo actual SOLO inventario/handoff, sin producto/tests/DB/server. Pregunta async pendiente: aceptar/rechazar scopeKey§4.3 antes del cierre D0; no inferir respuesta de autorización de lanzamiento. M0 aún no ejecutado; no habilitar A1/B1a antes de sus dependencias. Tras cierre/M0 despachar solo checkpoint habilitado, extender paths y coordinar contrato común.

Preparación detecta reporter no distingue sesión nueva mismo user/business: mantenerJSON; si U1aceptado señal409 de siguienteAPI adoptada, no detección inmediata. B identifica consumidores adicionales a inventariar/reservar antes de adaptación, sin ampliar dominio/UI. Tercera reservaoperativa es medición0237 preservada; no cuartoWT ni cleanupforzado, reconciliar/reutilizar para M0/QA. CI remoto90ebe18 observadoROJO unit+Neon (detalle enregistro), no verde prestado ni corrección fuera de scope. QA manual, FAIL histórico,102migraciones como dato previo y diferidos intactos; sin push/PROD ni implementación comenzada.

## HISTÓRICO — PLAN OPERATIVO 0238 PARA DOS IMPLEMENTADORES; SIN ARRANQUE (2026-10-17/18 UTC)

Owner cuestionó tamaño/capacidad de encargos. Plan refinado en checkpoints A1, A2a contexto conservando consultas separadas, A2b JOIN/fallback, A2c constructores/reporters, B1a provider aislado, B1b shell/streaming, B2a transporte compartido, B2b revalidación y S condicional de ámbito. Solo despachar siguiente tramo habilitado con commit/evidencia; no tratar A/B como dos prompts monolíticos ni prometer paralelismo total: B1b requiere A2c. Mantener dos implementadores y QA independiente; sin nuevos agentes ni implementación. Checkpoints no son entregas parciales a main ni nuevos benchmarks/gates.

Owner pidió preparar plan de implementación con dos agentes. Ampliada [ficha0238](../factory/0238-plan-carga-backoffice.md), sección «Ejecución con dos implementadores», sobre referencia documental21f4f629: A contexto/guards/JOIN/constructores servidor y contrato puro; B shell/hoja RSC/provider/transportes cliente. A1 entrega contrato separado antes de paralelizar A2 y B1→B2; paths exclusivos y suites focales, tareas condicionales scopeKey, recursos/worktrees/DB, handoffs y QA independiente. Coordinador controla M0 antes de optimizar, integración serial y M1 con control contemporáneo, estados/índices y reservas. Hasta3worktrees operativos; DB real/mediciones serializadas, sin cuarta copia por benchmark; dos implementadores también corrigen y QA no implementa.

No agentes nuevos, producto, worktrees, DB ni benchmarks iniciados. Spec sigue borrador/ADR propuesto; scopeKey todavía requiere decisión explícita antes de cerrar/despachar, no inferida de pedir plan. Recomendación: adoptar garantía acotada propuesta; alternativa rechazada exige retirar tareas/garantías. Guardias/kit/schema/PROD/push fuera del arranque y harnessDB/tooling requiere paths asignados explícitamente antes de cambios. Checks documentales pertinentes; evidencia/revisiones previas, QA manual, FAIL histórico y todos los diferidos preservados.102migraciones sigue dato histórico, sin nueva comprobación.

## HISTÓRICO — 0238 CONTRASTADA CON INDUSTRIA Y CÓDIGO; SOLO DOCUMENTACIÓN (2026-10-17/18 UTC)

Owner pidió dos agentes separados y secuenciales: comparación con prácticas publicadas y contraste posterior con código/backend para evitar sobreingeniería. [Industria](../factory/0238-industry-review.md), `/root/backoffice_industry_review`, y [aplicabilidad](../factory/0238-applicability-review.md), `/root/backoffice_applicability_review`, revisaron base congelada `c642af5a`; ninguno autor del plan ni reviewer adversarial anterior. Confirman pertinencia de1+2+3 frente a duplicaciones concretas, sin nuevos bloqueantes demostrados. No certifican implementación/latencia PROD ni sustituyen aceptación pendiente de scopeKey. Fuentes primarias y límites históricos en informe de industria.

Coordinador incorporó después precisiones I1–I4 a spec/receta: bytes JS/CSS/documento/RSC/seed y CPU focal sin doble conteo; caché/perfil/prefetch y topología proxy local/Neon explícitos; recorrido diagnóstico de navegación persistente/refresh; proyección/plan JOIN y cardinalidad real de candidatas frente a5visibles. Sin nuevos gates temporales, DDL, plataforma APM/RUM, Redis, cambio de pooling o refactor de bundles por conjetura. Provider acotado; si se acepta scopeKey, priorizar su409 por code frente al conflicto genérico de tarjeta. Agentes no validaron este delta documental posterior. Spec borrador/ADR propuesto; sin código, M0, DB, servidores, push/PROD ni nueva comprobación de102migraciones. Diferidos, QA manual y FAIL histórico conservados. Checks documentales proporcionales; informes y actualización solo locales.

## HISTÓRICO — ADVERSARIAL Y REVISIÓN DEL AUTOR DE0238; CONTRATO ADICIONAL PENDIENTE (2026-10-17)

Owner pidió agente adversarial y luego revisión propia del coordinador por riesgo de sesgo. Aclaración: yo redacté el plan; el agente independiente `/root/backoffice_adversarial` no lo creó. [Informe independiente](../factory/0238-adversarial-review.md) revisó03949d2e:2bloqueantes(B1JOIN/falloBillingyorden, B2seed/layout/membresía nula) y4mejoras(R1controlA/Bcontemporáneo/intervalos, R2estado temporal/efectos fixtures, R3streamingmódulos/paths, R4propietario/generaciones/abortos). Corregidos en20e81dfb; mismo agente revalidó ese delta y cerró sus6hallazgos documentalmente, sin PASS de producto. Precisión DOMutilizable observado antes de load/EOF incorporada después. Ningún código/DB/API/medición nueva ni PROD/push.

Revisión propia posterior solicitada por owner, **del autor y no independiente**, [informe](../factory/0238-author-review.md): U1ticketscliente no vinculan intenciónAcon cookieB cambiada en otra pestaña; U2navegación completa por permisos/billing puede perder formularios autorizados. U2actualiza propuesta a provider+router.refresh mismo ámbito, reserva navegación completa para cambio/pérdida ámbito. U1se concreta en spec§4.3/ADR como **contrato propuesto pendiente de aceptación**:scopeKeyHMAC ligado a sesión/usuario/negocio, X-Backoffice-Scopecapturado al inicio, validar guardsactuales antes de comparar y rechazar409antes de dominio, sin reintento de escritura en otro ámbito; clientes sin cabecera compatibles/reporterauth exentos. Sin consultas nuevas ni privilegios por marca. No declarar que el agente revisó ese protocolo posterior ni que todo el plan está cerrado. Spec0238sigueborrador/ADR0154propuesto y M0/código no comienzan antes de resolverlo. INDEX/plan actualizados; enlaces/números/diffchecks pertinentes. Evidencia y WT de medición anteriores preservados; QAmanual, FAIL1817,621042ms y todos los diferidos conservados. Solo documentación local, sin push/PROD ni nueva comprobación de102migraciones.

## HISTÓRICO — PLAN 1+2+3 DEL BACKOFFICE DOCUMENTADO; SIN IMPLEMENTACIÓN (2026-10-17)

Owner eligió aplicar las alternativas 1, 2 y 3 juntas y medir después; pidió plan production grade, spec y ADR. Preparados [spec 0238](../specs/0238-carga-inicial-del-backoffice.md) en borrador, [ADR 0154](../adr/0154-contexto-del-backoffice-por-peticion.md) propuesto y [plan](../factory/0238-plan-carga-backoffice.md), con filas INDEX. Diseño completo para revisión: contexto de datos por petición conservando diferencias de guards/selección, seed mínimo de navegación/prueba/módulos, JOIN de membresía/negocio con suscripción sin reemplazar Better Auth. Objetivos normales: página/contexto inicial máximo4lecturas (incluye módulos), guardInbox4→3; ceroGETsesión/módulos al montar con seedready y1Inbox. No SSR/prefetch de readInbox por sus efectos; acceso de módulos del seed respeta su endpoint. No caché de autorización entre peticiones, Redis/JWT/DDL ni nuevas cifras del Dashboard. Ficha define base comparable de build antes de código, medición del combinado después, readyvacío/con5tarjetas, primera entrada y30recargas por caso; gates relativos de mediana/p95 y funcionales, sin inventar SLA. Revisión de propuesta/ADR pendiente, no declarados aceptados ni implementados. Este encargo no lanza agentes ni código/DB/mediciones nuevas. Check-numbers, enlaces locales y diffcheckPASS; reserva documental mediante commit local, sin push. Evidencia previa y WT de medición se preservan; QAmanual, FAIL1817,621042ms y todos los diferidos anteriores vigentes. Sin PROD ni nueva comprobación de102migraciones.

## HISTÓRICO — INBOX MEDIDO EN JOYAS LOCAL; SOLO PASO 1 (2026-10-17/18 UTC)

Owner acotó a medir; indicó cuenta local joyas@local.com. [Informe](../factory/0237-inbox-measurement.md). Fuente005b8235, Node24, servidor propio43151, NextdevWebpack/StrictMode y Chromium real contra DBlocal. Cuatro capturas preservadas: primeras/recompilación26,739s y17,752s; recargas4,185s y4,624s hasta Inbox utilizable. Siempre200ready/0tarjetas, run existente; no fallback3s ni caso con tarjetas, no benchmark frío/PROD. Página9consultas: cuatro parejas exactas (sesión/usuario/membresía-negocio/suscripción-acceso) +plan/status; cadenas layout/página ya paralelas. Navegador por entrada2Inbox/4módulos/4sesión/2checklist; desarrollo duplica efectos, además código tiene2efectosmódulos y2consumidoressesión. CadaInbox11operaciones(8lecturas+lock+BEGIN/COMMIT); últimas4lecturasHTTPauth/acceso978ms y658ms; candidatas4,3/30,9ms, sin atribuir transporte a CPUdePostgres. No extrapolar conteos/tiempos aPROD ni prometer ahorro.

Solo instrumentación en WTpropio `/private/tmp/checkpass-inbox-measurement/inbox-measurement-20261018`, taskfactoryinbox-measurement-20261018, sin agentes ni optimizaciones/integración. Evidencia saneada y scripts en `/private/tmp/checkpass-inbox-measurement/artifacts/`; typecheckDBfinalEXIT0, diffcheckPASS. ArranqueTurbopackEMFILE y primerChromiumbloqueado por sandbox conservados como setup, resueltos Webpack/polling/escalación; relojHTTPdeprimeras2capturas incompleto para ServerComponents, corregido y otras2capturas etiquetadas sin ocultar ninguna. SignoutJoyas200/cookieprivadaeliminada; server43151detenido/sinlistener y recursosfactoryvacíos. WTcon cambios propios preservado, no cleanupforzado. Principal solo docs. Owner pregunta por4lecturas teniendo sesión: explicado que no es relogin, validar contexto por petición no exige4consultas separadas; no se cambió auth. QAmanual/FAIL1817,621042ms y todos los diferidos conservados. Sin push/operacionesPROD/DDL/EXPLAIN/testsDB ni verificación nueva de102migraciones.

## HISTÓRICO — DIAGNÓSTICO PREVIO DE CARGA, SIN CAMBIO DE PRODUCTO (2026-10-17)

Owner pide medir entrada Inbox y planificar Dashboard con Inbox, equilibrio mensual/diario y avance, caché selectiva y DB. [Diagnóstico y plan](../factory/0237-dashboard-inbox-diagnostic.md). Solo lectura de código/logs y documentación: logs locales preexistentes con7entradas/backoffice669–939ms y últimas12Inbox605–1015ms; NO nueva medición autenticada, pintura de navegador ni benchmark frío. Evidencia saneada `/private/tmp/checkpass-inbox-log-baseline-20261017.json`, con hash/fecha del log y HEAD005b8235 (cambios concurrentes solo documentales preservados). Node24/check-envPASS configuración local; sin DBtests, PROD, push, agentes ni cambio de código. Pendientes email de cuenta local para medir por flujo existente y aclaración del problema adicional de análisis del mensaje del owner, solicitados por preguntas asincrónicas. No leer sesión privada del navegador. Definir referencia diaria: targetMinor actual es objetivo condicionado de recuperación, no cuota fija universal. Plan propone medir etapas, compartir lecturas por petición, carga inicial servidor sin GET duplicado, snapshot numérico/invalidación y notificación tras proyección; nada implementado. QA manual y FAIL1817,621042ms y todos los diferidos anteriores conservados;102migracionesPROD sigue dato del cierre anterior, no nueva verificación.

## ESTADO — PUSH Y MIGRACIÓN PROD AUTORIZADOS, COMPLETADOS (2026-10-17)

Owner autorizó explícitamente push rápido sin pre-push y migración PROD; reiteró «continua». Push normal (sin force) --no-verify confirmó origin/main `90ebe18fe795e11029a11409fbe8167e25b365c4`, desde db3175d2, incluye producto L1 b1098173 y todos los cierres anteriores. Main/dev coincidían90ebe al terminar push; este estado posterior es solo documentación local. No afirmar QA manual aprobado, verify/check-numbers ni despliegue Ready: L1 sigue con QA manual owner; rendimiento FAIL y diferidos conservados. [Registro publicación](../factory/0237-release-2026-10-17.md).

PROD ledger inicial96 (hasta0095), pendientes0096–0101; guard0096 verificó0costos/periodos/asignaciones/activaciones/permisos antes de DDL. Dos CLI db:migrate:prod fallaron WebSocket «Connection terminated unexpectedly», sin cambio observado en ledger/esquemas. Migrador transaccional oficial Drizzle con WebSocket nativo Node24, mismo SQL/journal/huellaPROD validada, EXIT0:102migraciones. Verificación102/102hashes,0pendientes. Fingerprint19categorías y comparelocal==PROD PASS en ese momento.

Auto-review RECHAZÓ primer push que incluía actualización de huellas-prod.txt por metadatos PROD no autorizados específicamente para publicar. Se resolvió con alternativa indicada: excluir ese archivo, guardar fingerprint nuevo en `/private/tmp/checkpass-prod-fingerprint-20261017.txt` y publicar solo código/registro autorizado. Huellas-prod.txt versionado conserva valor anterior; no volver a publicar esa actualización sin resolver autorización. Un gitrestore inicial falló por sandbox(index.lock); posterior escalado funcionó, sin force/discard ajeno. Push final EXIT0. No secretos impresos/copias de env, cron remoto ni nuevas pruebas/smoke PROD. INDEX/TASKS/Claude/archivos ajenos preservados.

## ESTADO — POS/COSTOS Y COPY L1; QA MANUAL OWNER (2026-10-17)

Owner pidió rapidez/pocos tokens: sin agentes ni QA automatizado, QA navegador suyo. Cola LOCAL procesada manualmente por endpoint interno existente:30applied/0failed y siguiente0claimed; lectura Joyas confirma5400revenue/875cost,5unidades/5concosto,0pendientes. POS after ahora incluye sale.closed+recipes.consumption.applied+sale.commission.frozen,20s/lote50/comercio, sin bloquear respuesta. Histórico añade datos de unidades/costos ya calculados; copy aprobado pendiente/incompleto con unidades faltantes/completo con ventas y costo; oculta ganancia aparente sin costos completos. [Handoff L1](../factory/0237-pos-costs-l1.md). Solo diff--check, sin tests/types/browser automático. Candidato dev sobre f08e22bc; QA manual pendiente y main siguef08e22bc hasta cierre manual. Sin push/deploy/PROD/migración/backfill/seed/cron remoto/INDEX/TASKS/Claude. Todos los diferidos y FAIL rendimiento conservados.

## ESTADO — GASTOS: INTENTO INMEDIATO EN MAIN LOCAL, QA PASS (2026-10-17)

Owner pidió procesar Gastos al guardarlos como POS. Implementado en POST/PUT/DELETE tras commit: after/fallback seguro, comercio autenticado+expense3+core.analytics, presupuesto20s/lote50, una programación por petición/batch. Respuesta no espera ni falla por procesamiento; dedup/cron durable/corte Stock se conservan. No nueva migración ni cambio de punto de equilibrio. [Handoff](../factory/0237-expenses-immediate-handoff.md), [QA](../factory/0237-expenses-immediate-qa.md), [contrato](../factory/0237-expenses-immediate-contract.md), spec§2.3.

QA independiente PASS separado A `ca6bce0411431c8dc43e708f7e721cdf2cd1dab2` (producto1ac9aaf8), B `1dffa641474802f29493940503271e979752f129` y combinación `d10887ad36a568d95d91c0ae120c791b5cf72c6d`; informe aceptado `2480ca9c7669321f6530d9f277e206d296db64f9`.16unit/tipos/lintPASS y1/1Neon real sobredd0bb1b6, sin skips/retries,32.68s; alta→edición→borrado/replays/tenant/Stock exactos. Primer focald935/2s FAIL1/1 preservado; presupuesto2s era default técnico nuestro y se corrigió documentadamente a20s, sin relajar aserciones. Callbacks finales2.48–3.15s diagnósticos, no SLA/benchmark general. Sin smoke nuevo Next/browser ni tests globales.

Main local avanzó por fast-forward al cierre `df0d1587039239699d28d0073f4ad315d7910512`, seguido de este cierre documental con producto idéntico al candidato QA. Principal vuelve a dev. Las tres tareas expenses-immediate-{a,b,qa} accepted→integrated→retired, recursos vacíos y WTs/ramas propios limpios retirados por factory, sin procesosCWD ni force. Solo checkout principal operativo. Origin/main sigue db3175d2; sin push/deploy/PROD ni INDEX/TASKS/Claude/archivos ajenos. Diagnóstico a900bde2 preservado en sus refs.

Contexto QA manual local: owner autorizó0097–0101 en Docker antes de este ajuste, ledger102/102hashes/estructuras correctas. Joyas8032fb73-f6d6-450f-8d3e-51f0bf76f7ad tuvo450USDfijos+63variables pendientes, venta13USD y otros tipos pendientes. Esta implementación y sus tests no editaron ni drenaron esa cuenta: próximos guardados autenticados intentan procesar pendientes de Gastos del mismo comercio. DosgastosMXN previos sin deliverycore no se mezclan/backfillean; punto de equilibrio sin mes anterior sigue null conforme a spec. Rendimiento general FAIL1817.621042ms >1000ms y todos los diferidos de abajo siguen vigentes, sin nueva medición/cron remoto/clima.

## ESTADO — CICLO DEL INBOX EN MAIN LOCAL CON QA PASS (2026-10-17)

Owner autorizó «Pasemos a main local», resolviendo el gate de pase local y conservando rendimiento como pendiente. Main avanzó por fast-forward al candidato `d8584fa45361332780fd62c8047cb394ed453a36`; este cierre documental también se integra por fast-forward, con producto idéntico al revisado. Checkout principal vuelve a dev. Origin/main local permanece `db3175d237cdcf4ec41e32d70cc1c4f1e06ab2cf`; no push/deploy/PROD ni operaciones DB, clima o benchmark en este cierre.

QA funcional independiente PASS separado de A `6582570cc8912c92ee070c4680eda57cacac5ed3` (producto `d07265cd571dae727da103e359622686903979c8`), B `1038c2efd4c99bf9dd8b5d8a5453084bcf76c710` y combinación `c90a8f30da97db602773b20b20438a80fad438fb`. Informe aceptado `e29775af9c602e171e56d535bfeded19e4ca9f47`. [Handoff](../factory/0237-inbox-lifecycle-handoff.md), [QA](../factory/0237-inbox-lifecycle-qa.md). Evidencia por SHA:72 unit,28 HTTP y Neon compuesto32/33 +3 focales +1 focal, con filtros/fallos explícitos; no corrida global nueva ni nueva certificación de rendimiento.

Las tres tareas factory quedaron accepted→integrated→retired; worktrees y ramas propios retirados por factory tras verificar limpieza, entregas ancestros de main y ausencia de procesosCWD. Recursos vacíos, solo checkout principal operativo. Ref de diagnóstico `analytics-performance-diagnostic-preserved` y rama original de rendimiento preservadas; ningún force/discard. Archivos ajenos sin seguimiento, INDEX/TASKS y estado Claude intactos.

Rendimiento sigue **FAIL1817.621042ms frente a1000ms**, sin nueva medición ni aceptación del requisito. Se conservan CI compartida roja original, ciudades/cron remoto, mostrar clima/calendario, «cuánto ahorraste» y Marketing agregado/cupón/tarjeta11 parqueada. Clima real de AN-3 ya cerrado, sin repetición. Próxima tarea de rendimiento requiere encargo propio; este pase local no autoriza publicación ni PROD.

## HISTÓRICO — CHECKPOINTS PREVIOS DEL CICLO DEL INBOX

**Cierre funcional en revisión:** combinado congelado `5c4746b2ab9cec2f564392a58dfd99437a6cad8a`, A producto final `d07265cd571dae727da103e359622686903979c8` + B103 aceptado. Segunda Neon7da32 PASS/1 FAIL; selector COP corregido por identidad/período vendido sin cambiar40n/COP0. Focales e6773 PASS/15 no seleccionados (COP, recovery antiguo calificable, ciclo12 real) y d0721 PASS/9 no seleccionados (origen real >90d aunque builder0 por umbral), ambos EXIT0/teardown; logs a3-focal-e6773759/a3-threshold-d07265cd. No afirmar corrida35/35. QA cotejó fuente y logs, cerró todos los hallazgos conocidos; prepara informe y espera entrega documental A.72unit/tipos/lint compatibles. A cesó DB tras último focal; liberación factory en entrega. Handoff coordinador preparado `docs/factory/0237-inbox-lifecycle-handoff.md`, aún PENDIENTE. Main sigue igual: falta QA final/aceptación y disposición explícita del gate de rendimiento FAIL antes de main según contrato. Sin decisiones funcionales nuevas ni publicación.

**Checkpoint vigente:** dev `2ba6dd0223c16edc85d9bf290c91e6f4545dd28f` integra A `7da87404d07dee11b8b2fa5f1081687f07a45da2` y B aceptado `1038c2ef`. Segunda corrida A3 de 33 casos Neon en curso sobre 7da inmóvil, recurso exclusivo de A; aún no hay resultado final ni QA de combinación. Primera corrida b60 conservada: 21 PASS / 12 FAIL / 0 SKIP, log `/private/tmp/analytics-lifecycle-a3-neon-b60db5c2.log`; correcciones de SQL, fixture visible y orden del oráculo no sustituyen el resultado pendiente. Unit71/71 y tipos/lint focal PASS en 7da. QA cotejó delta, guía, receta real/restauración exacta de config y extras SQL independientes; sin nuevo bloqueo estático en ese delta, dictamen final pendiente.

Coordinador comprobó HTTP/actions/fallback combinados en `84d771af`: 28/28 PASS sin filtros/retries, log crudo `/private/tmp/analytics-lifecycle-combination-http-84d771af.log`. No sustituye Neon ni QA independiente. Guía documenta capacidades estructurales de poda12 y baseline conservador; receta TTL90→60/peso1→1.2 produjo inspección1 PASS/17 filtrados (no regresión), config restaurada hash b924d0364421be5cdf498f606a31a2ca3360ceec7f1dc69f9619f63e21e8fb5f. QA revisa además el anclaje temporal de recuperación legacy y necesidad de focal de ciclo real12, sin tocar la fuente durante la corrida. SQL0101 dfb581… sigue inmutable. Main/origin-main sin cambios; rendimiento FAIL y todos los diferidos preservados. Los checkpoints siguientes son históricos y no reemplazan este bloque.

**Checkpoint corregido posterior:** dev `fe9fe658` integra **`8430c3a7`**;67/67unit y types/lint PASS, aún sin Neon A3/entrega final. QA confirmó fixes label/material7/causal8/rebase5-9 en estático, pero señaló calculationKey incluyendo parámetros de peso (A corrige whitelist), fecha de origen reinterpretada con TZ actual (usar originDay capturado) y poda12 insegura al cambiar TTL/delay después de eliminar control. Ninguno es PASS combinado. QA/B conservan sus entregas y worktrees; no moverlos detrás de pruebas.

Resolución técnica de poda12 dentro del control mínimo necesario aprobado: la deduplicación del evento no impide que el evaluador diario reemita un snapshot viejo si cambia delay. Solo borrar control cuando finishDay+máximo emissionDelayDays admitido por registro(actual3650) ya pasó, además de expiry/sourceproof/sin contenido ni reminder. Hasta entonces compactar al último ciclo/cursor por campaña, sin descuentos/ventas/texto/snapshots/log de decisiones; el contenido sí vence90default. No son avisos/snoozes10años ni una fila por ciclo. Guía debe explicar límite estructural y que ampliarlo exige revisar prueba de poda/compatibilidad histórica, no tratarlo como knob inocuo. A implementa y QA debe validar prueba finita; SQL0101 inmutable. Reloj8 confirmado en productor/traductor: stock_consumption usa closedAt económico, gauge observado guarda aplicación/publicación real; cursor causal usa gauge pareado mismo evento, nunca reloj de delivery Analytics. Replay conserva observedAt, no rejuvenece.

**Avance más reciente:** dev `a873ec6e` integra checkpoint A3 **`9e42c62f`**, todavía NO entrega ni QA PASS del producto. Merchant types/lint y62/62unit PASS en esa fuente; logs `/private/tmp/analytics-lifecycle-a3-{types-freeze,lint-fixed,unit-freeze}.log`. B entrega `1038c2efd4c99bf9dd8b5d8a5453084bcf76c710` recibió PASS independiente de alcance HTTP/UI/actions, factory accepted e integrada; 28/28 unit y browsers compatibles documentados, sin DB ni Next smoke B. No cleanup de WT porque no es ancestro de main todavía. Main/origin-main sin cambios.

A continúa sobre `9e42c62f` sin mover WT: guía/README, oracle de ventanas y Neon causal pendientes; **ninguna DB A3 operada aún**. QA estático sobre ese checkpoint encontró período con label vacío (?? no activa template), material7 agregado de productos ajenos, y causal8 que podía atribuir un ajuste al consumo anterior. A corrige. Root/QA exigieron corregir simulación (summaryFixed sin novelty, incluir fuentes5/9, planEpisode compartido para origen/expiry), cubiertos en62, pero revisar de nuevo la equivalencia final. Primer POST que devuelve nuevas cards debe contar exposición real, retry reconocido no la repite: A asignado. Poda incluye control3 mensual viejo, además9/12; permanentes no forman un log.

Ventanas5/9: conservar ocurrióEn y no recalcular con ventas futuras. Cambiar parámetros de captura relevantes exige rebase de Analytics en fecha de origen durante reevaluación, no GET pesado ni tablas de módulos; no relabelar un importe28d como45d ni7d como14d. No reiniciar episodio/decisión/snooze por política. Simulación requiere snapshot suficiente, nunca cero inventado. QA coincide que el carry del importe capturado sin vínculo a ventanas es un defecto técnico de §3.11. Oracle legacySQL5fac se conserva; la nueva metadata y ventana45 impiden igualdad byte-a-byte del input completo: comparar proyección explícita de todos los campos/órdenes compartidos y extras exactos por separado, sin prestar PASS de rendimiento b3.

Último checkpoint combinado **`f5b92a38`**: A `197821a1` + B `3c35094f`; ambos WTs limpios y factory refrescada allí antes de retomar. Servicios reales `fd5e6ae1` **9/9 Neon PASS**, sin omisiones/retries, log `/private/tmp/analytics-lifecycle-services-fd5e6ae1.log`. Incluye try-lock de lectura/evaluación que responde antes de liberar el bloqueo, recordatorio una vez, expiración, CAS/rollback y fairness por IDs propios; QA leyó evidencia y código compatible. No certifica A3 todavía. B prepara actions/HTTP completos con labels centrales (ya existen defaults validados); A debe pasar snapshot a actionContext y completar todos los consumidores. QA mantiene borrador propio PENDIENTE sin delivery. Los párrafos posteriores conservan fuentes parciales anteriores, no reemplazan este avance.

Actualización operativa: dev `f33a99f7` integra checkpoints A1/A2, UI y HTTP v2; main local sigue `5afa5294` y origin/main local `db3175d2`. No hay PASS funcional de esta implementación. B congeló `acc58d01`: 23/23 HTTP/fallback con servicios simulados y 1/1 browser preparing, además de los checks UI compatibles descritos abajo. Tres llamadas obsoletas de pruebas Neon aún deben actualizarse por A; no aflojar el contrato HTTP. A quedó limpio y factory refrescada a `f33a99f7`, con recurso exclusivo de replay. B prepara guía externa para A sin escribir policy/.

0101 **aplicada únicamente en replay protegido** por wrapper, fuente combinada `f33a99f7`; SQL congelado en `38da41b0`, SHA256 `dfb581e66cddd45ddcad7b400de57db86f372cf4de53c57bc9d7aaf9625f191b`. Sustituye los borradores/hash anteriores y ya es inmutable. QA dio GO técnico para dos fases: origen observado→originDay válido5/9 en TZ→día de preparación. Preseed propio1PASS/1fase excluida; journal restaurado exacto hash `d55e693032f1dc4a0ead296946f2ca81f4ece58af5433dc576f573bbb7935225`. Migrador EXIT0. Post original7PASS/2FAIL/1fase excluida: cleanup global de una fixture retiró legítimamente el aviso legado vencido antes de verificarlo; fallaron conteos globales6vs5 y1vs2. No se observó contenido6 inmediatamente tras migración; no afirmar replay limpio. Recovery `4f064020` verifica estado actual1PASS/1fase excluida: cinco contenidos, ocho controles por IDs exactos (origenJan1/expiryApr1/expired/sin contenido) y métrica1234 intacta. Logs `/private/tmp/analytics-lifecycle-0101-{post,recovery-verify}.log`; fairness aislado aún pendiente. Sin reset, modificación SQL/ledger ni DB concurrente.

Resta A3: conectar sincronización/evaluación/ingesta con política y contextos causales, despacho real por regla (incluidos handlers repetidos), fuentes5/9 independientes del texto, stock intradiario fuera de orden, limpieza segura de controles factuales, guía y simulación pura. QA descubrió fallback3s bloqueado por businesslock de evaluación: A corregirá readInbox público try-lock con preparing seguro y admisión de evaluación sin cola; B prueba contrato y centraliza labels de navegación con snapshot común. Luego entregas y QA de combinación exacta. Sin nuevas decisiones de producto; ante contradicción material preguntar y parar. Rendimiento FAIL y demás diferidos conservados; ningún benchmark nuevo ni movimiento de main.

Encargo actual: implementar tras cierre de spec0237/addendumADR0152/contrato, dos implementadores y QA independiente. Owner aprobó última regla y pidió lanzar agentes; sin push/deploy/PROD. Reserva original40bbec96; sin código, DB, migración, cron remoto ni publicación. Dev documental previo4de3ffbf; main local5afa5294 y origin/main localdb3175d2 sin cambios. [Contrato vigente](../factory/0237-inbox-lifecycle-contract.md). Archivos ajenos preservados; no INDEX/TASKS/Claude. Ante contradicción material, preguntar y parar.

Owner corrigió dos puntos: (1) clientes es categoría Marketing; parquea tarjeta11 en vez de crear reglas paralelas o avisos por cada cliente. El plan retira generación/exposición de11, incluidas candidatas antiguas y fallback, sin quitar eventos/métricas/histórico. (2) no quiere avisos viejos: todo contenido vence tras90 días, también pendiente/pospuesto. Se elimina la excepción anterior y el snooze ilimitado. Inicio de episodio fijo, no reiniciado por texto/recálculo/lectura/snooze; fechas solo hasta expiresAt. Lector excluye vencidos sin esperar cron; limpieza semanal borra contenido, control compacto mínimo impide recrearlo mañana. Datos numéricos/eventos/deduplicación intactos. Legado toma fecha más antigua demostrable o ancla única de transición si no se conoce, sin excepción eterna ni cierre inventado. Los históricos de propuesta/adversarial conservan sus fuentes; sus antiguas excepciones no son contrato vigente.

Se conservan decisiones anteriores: informativas sin Solucionado/snooze; accionables con tres decisiones; diario marcado se retira y sin marcar renueva misma ID/período/versión sin acumular anteayer. Navegar no marca ni cierra. Marketing es tercera categoría reservada a11 parqueada, no habilita campañas ni acceso a tablas de módulos desde core.

Investigación solicitada al agente /root/marketing_research completada en fuente4de3ffbf, estrictamente solo lectura, sin archivos/DB/API/red/credenciales. Etapas por rubro existen en spec0110 borrador, no implementadas como clasificación viva. Solo welcome/cross habilitadas; missed_you/at_risk/win_back/compositor apagados. No envío manual individual de cupón; preview agregado existente no clasifica por etapas. Evidencia de rutas en contrato. Se informó la diferencia al owner sin resolver Marketing por cuenta propia. No nuevo worktree ni recurso para este lector.

Nuevo requisito crucial del owner: centralizador único de toda política de tarjetas (pesos, umbrales, ventanas, frecuencia, vigencia/eliminación, categoría, reglas habilitadas y decisiones/acciones). Se incorpora §3.11, addendum y contrato: AnalyticsPolicy validada/versionada + registro de reglas en domain/analytics/policy/, snapshot único en evaluadores/queries/selección/ciclo/API/UI/cleanup, simulación pura de balances e inventario antes de checkpoint. Configuración no es switch de Analíticas ni módulo; dinero exacto/permisos/dedup/corteStock no son desactivables. Nueva lógica/fuente/acción requiere implementación y registro, no motor de SQL/JS arbitrario. Defaults iniciales preservados; cambio de política no rejuvenece episodios ni resucita atendidos/vencidos. TTL inicial90 central: reducir revalida existentes; ampliar aplica a episodios nuevos, sin extensión de los ya abiertos.

Owner confirmó archivos por ahora, no consola; quizás pantalla futura. Plan concreta policy/config.ts (únicos valores editables), rules.ts (registro), schema.ts (contrato/validación), index.ts (entrada pública) y README.md (guía en español), writer A. Guía obligatoria de parámetros/unidades/defaults/rangos/efectos/consumidores, fichas por regla, recetas de cambio/validación/simulación/reversión con ejemplos antes/después y comandos reales probados. Explicar impacto en episodios/reevaluación/versión, recarga local y que no cambia despliegue publicado automáticamente. Sin API/editor/permisos/tabla de configuración ni ajustes por comercio en esta etapa. Una futura pantalla consumirá el mismo contrato.

Owner aprobó novedad al vencer snooze:reset1unavez, vuelve a competir sin cupo ni extensión; no reinicia agedecay. Spec cerrada74125ab9. QA documental independiente PASS, informe ae4c759222fa2c55c6c23395934306c2efd1b894 aceptado/integrado. No quedan preguntas de producto. Timezone aditivo técnico enDTO para kitDateTimeField aprobado por coordinador, sin nueva pantalla/settings.

Base común congelada 48d43abbfa71d5f478b0629aac53cca4d5dcd0d9: merge funcional exacto058d7c48 con0100; conserva rendimiento FAIL1817,621042ms y no habilita main. WIP diagnóstico a900bde2 en ref analytics-performance-diagnostic-preserved, copias externas diagnostic-harness-preserved.patch/.ts/.sha256, fuera de base. Checkpoint de A primero; B sololectura hasta consumirlo. A /root/analytics_performance reutiliza WT analytics-performance en branch nuevaanalytics-lifecycle-data y taskfactoryanalytics-performance, sin rendimiento. B /root/analytics_lifecycle_ui en WT/task/branch analytics-lifecycle-ui, puerto43142. QA /root/an3_qa reutiliza WT/taskanalytics-performance-qa, informe producto0237-inbox-lifecycle-qa.md. Reservas se actualizan antes de GO; máximo3WT.

A tiene una sola0101, dominio/policy/README, schema/queries/eval/ingestion/lifecycle; B HTTP/actions/rutas/inbox y fixture/browser; QA independiente. DB serial solo replay privado migration.env por wrapper Node24, recurso exclusivo A hasta teardown; no operación ejecutada todavía. Main5afa5294 y origin/maindb3175d2 intactos. CIstatus leído: remoto rojo en db3175d2, fallo históricoStockcount_changed, sin arreglo ni suiteglobal. No push/deploy/PROD/cronremoto/verifyglobal/mutaciones ni INDEX/TASKS/Claude. Preservar todos los diferidos, sin declarar implementaciónPASS.

Progreso actual: A1 25b56583 congelado(policy/DTOs),5/5unit/types/lint,sinDB/migración/servicios; Btest-only636ddbe2(harnessv2/regresionesobsoletas)sinPASSfuncional. IntegradospreservandoSHAen40f1cb68; BFF/refresheda40 yGOUI,mientrasHTTPesperaA2. A sigueA2desde25,schema0101draftpreservadobajo/tmpantesA1. QAearlyA1encontró3defectostécnicos(repetidohandlerignorado,comparisonDaystruncada,truthinesscon0), AaceptócorregirA2conbordes. Sincontradicciónnuevaproducto. DTOsuma refreshAfterMs ademástimezone, centralizaesperapreparing; noNodecryptoimportenbrowser. Bscopeextendió3e2ehistóricos+fixturesconmotivo. Todaaceptaciónfuncionalpendientehastaentregas/combofinal, nofalsePASS.

Último avance: B UIcfe0c788:19/19browser390/1280PASSconHTTPsimulado, UItypes/lint/guard, noNext/DB. Fixcarreraloading6324dec6:4/4focalPASS(retryopId,duemutación,dueread,finallyantiguo), oráculorefuerzo923da085:1/1racePASS; BWTlimpioesperaA2paraHTTP. Hookinbox-state.tsreservaextendida, configuracióncentralnofrontendNodecrypto. QAleyóUIfavorabledelimitado,sinPASSservicios.

A2parcial35e888a6realread/decide/cleanup+0101,tipos/lint/unitpolicy7/7; NOintegradoenrootnisobreDB. SQLhasha0ce4609eb527518be6ac5f350e5d33801f3055b4ba49fdd52298778d9a5ce3f NOAPLICADOyrequierecorrección. STOPsoloaplicarDBhastaQAlecturanueva:summarylegacyc.dayespreparaciónnoorigsubjectdíaVentas; dismissednosepuedeaplicaraotrocontexto;2160horasexactas;cleanupindexable/fairness/businesslockprimero. A corrigedentrocontratotécnico,sinpreguntanuevaproducto. 1dismissedporPERÍODOoriginaldemostrableconservaatenciónmismoperíodo, nofppruebatodoctx; nuevoperíodoOPEN, acceptedOPEN. 5/6unknownconservadorOPEN;9soloidentidadeventoelegible; sinparsearcopy. QAartefacto/tmp/checkpass-analytics-perf/lifecycle-qa-a2-ddl-review.md.

PruebaNeontransiciónautorizadaDOSfasestrasGOQA:preseedúnicafixturepropiasinincluirentradaPENDIENTE0101enjournal(concopiahahseada+traprestoreinmediato), luegowrapperoficialaplica0101yverificalegado/teardownsoloesecomercio. Históricos0097–100/ledgerintactos,noperf/CI/reset/backfill. Aconrecursoexclusivemigration.env; sinDBhastaSHA/hashcorregidos. CLIci:statusremotorojooriginalconservado. Roothead04aee2c3draftmetadata+A1+Btest-only, main/originmainintactos.

## HISTÓRICO — PROPUESTA DE RETENCIÓN Y ADVERSARIAL DE DISEÑO (2026-10-17)

Owner aprobó la propuesta de ciclo de avisos, pidió adversarial y limpieza periódica; tras aclarar 90 días vs meses, pidió al coordinador proponer el corte. Se propone **90 días móviles solo de restos cerrados/vencidos y job semanal**, excluyendo pendientes/pospuestos de cualquier edad y controles anti-repetición aún necesarios. [Propuesta y contrato de revisión](../factory/0237-inbox-lifecycle-proposal.md). No código/DB/cron remoto ni cambios de spec original en esta fase. Adversarial independiente entregado `3819d4973c80fa2238bc28a376b82fbfc4145b05` y aceptado/integrado en dev solo como informe documental ([revisión](../factory/0237-inbox-lifecycle-adversarial.md)): corte 90 días móviles/semanal razonable condicionado, sin PASS de implementación. Cierres nuevos eliminan contenido al acto; 90 días es red de seguridad/legado, no un log nuevo. No borrar por createdAt/auto-updatedAt ni por mes; usar cierre/vencimiento probado. Pendientes/pospuestos inmunes a edad; controles compactos necesarios sin TTL ciego. No garantizar tamaño constante si se acumulan asuntos reales distintos ni eliminación antes de 97 días ante backlog/fallos. Antes de implementar quedan catálogo por tipo de contexto/emisión/vigencia/expiración, transición segura de legado (accepted antiguo era navegar, no declarar solucionado), fuentes 5/9, locks/versión en carreras y reconciliación12/recordatorios. Worktree QA limpio conservado, recurso vacío; tarea aceptada, no main. Rendimiento sigue parado, harness de diagnóstico conservado y sin nuevas operaciones. Todos los fallos y diferidos anteriores siguen vigentes. No INDEX/TASKS/estado Claude ni publicación. El diseño base aprobado no autoriza una limpieza destructiva del modelo actual.

## HISTÓRICO — PAUSA POR HALLAZGO STOCK/PRIORIDAD; SEGUNDO CICLO CONSERVADO (2026-10-17)

El owner reabrió el pendiente 1 con un implementador y prohibió nuevas tablas/rediseño de DB y atajos. [Contrato vigente](../factory/0237-performance-contract.md). **Única observación fría de fuente `b3ca9c6fda419306b013f3781dcc14c9780cd25b`: TOTAL crudo 1817,621042 ms, FAIL frente a ≤1000 ms**, result=true y run persistido. Conexión 504,87; claim/lectura 963,39; cálculo 115,02; persistencia 122,54; resto/commit ≈111,80 ms. Log `/private/tmp/analytics-perf-cold-observation.log`, EXIT1, un fallo, cero skips/retries. Se paró inmediatamente DB, nuevas mediciones y cambios de producto. Owner informado; respondió «Ok mientras quiero ver el tema del punto 3» a la pregunta expresa de reabrir otro ciclo con las mismas restricciones. Se reanuda SOLO el segundo ciclo de lectura/transporte/conexión, conservando el FAIL. Coordinador verifica y explica stock bajo/prioridades, sin cambiar el punto 3. Al revisar el ejemplo del owner se encontró que tarjeta 8 tiene amountMinor=null y fingerprint solo por insumo/local+none: aceptar/descartar puede silenciar futuros episodios del mismo insumo/local, aunque reponga y vuelva a faltar. La relevancia actual usa p fijo1, urgencia por días y novedad; no jerarquía que garantice stock inminente sobre completar gastos. Se debe explicar al owner y cerrar regla de reactivación antes de cambiarla. Por la instrucción expresa de parar TODO ante desajustes, agente de rendimiento detenido de nuevo, sin continuar hasta respuesta. No afirmar mejora causal frente a AN-1: no se hizo baseline frío AN-3 sin cambios.

Dev contiene solo contrato/estado y el informe QA de este encargo, sin incorporar el producto fallido; diff de apps/packages/tools/tests contra main vacío. Main local permanece `5afa5294` (AN-1/AN-2/AN-3 QA funcional PASS). Origin/main sigue referencia local `db3175d2`. Nada de push/deploy/lectura o migración PROD, clima, verify global ni mutaciones. No INDEX/TASKS/estado Claude; archivos ajenos sin seguimiento preservados.

Implementador `/root/analytics_performance`, task/worktree `analytics-performance` en `/private/tmp/checkpass-analytics-perf/analytics-performance`, base `5fac6608`; fuente congelada `b3ca9c6f`, entrega documental `058d7c483bffc07f245611a675f92623eb8a3ea5` completa y worktree limpio. Factory registró REJECT de ese SHA por rendimiento FAIL; reservas DB liberadas sin queries y revisión preservada. Incluye índice parcial mínimo de tres claves y seis métricas en **una 0100**, sin INCLUDE, SQL SHA256 `d7be0529f9325bb3dbaa6d3517e10ad3ac9b59a677034f849c258289e5fcfe5a`. 115 tablas/snapshot previos idénticos salvo ese índice, 0097–0099 intactas. Transporte JSON agrupa cabeceras repetidas y conserva todos los valores/orden mediante ordinal, mismo AnalyticsInput y dominio sin cambios. Producto no aceptado por rendimiento.

QA independiente `/root/an3_qa`, task/worktree `analytics-performance-qa`, base `e54c57f5`, writer solo informe. QA confirmó equivalencia/método PASS y rendimiento FAIL; sin habilitar main por este criterio. [Informe QA](../factory/0237-performance-qa.md) `79c1b6982692ba7ccbba0338f6118f52b488e1c7`, aceptado e integrado únicamente como registro documental fiel del FAIL. Su task queda accepted, recursos vacíos y worktree limpio conservado; no es aceptación del producto. Evidencia anterior al frío: 17/17 Neon sin skips/retries en AN-1/AN-2/AN-3, 45/45 unitarios, tipos/lint EXIT0 (typecheck anterior al último caso Neon de empate, producto/helper idénticos; lint/Neon sí incluyen ese caso, no se repitió nada tras STOP); SQL legado congelado portátil comparado con input completo/orden/candidatos/textos/meta/histórico, incluidos empates, COP y 31oct. Oráculos QA 5/5 por blobs y metadata. EXPLAIN 1919,305→40,276 ms servidor; payload 743437→283214 bytes, mismas 6965 filas. Ninguna de esas cifras equivale a PASS frío.

DB exclusivamente wrapper/Node24, recurso serial de perf.env y migration.env. Dataset global preservado de 29,2M product_revenue más métricas completas AN-1 del objetivo, no 116,8M ni carga densa de clientes/promos. Bootstrap perf 0097 original/índice físico preservado; 0098/99/100 aditivas aplicadas solo en DB efímeras. Sin seed/replay/reset/ANALYZE global. Reset previo estrictamente cuatro candidatas y un run del comercio sintético/día2026-10-20; cero writers. Perfil Neon checkpass, endpoint ep-aged-mode-axjrknyi, branch br-super-math-axhq8e58, min=max1CU. Suspensión operation `63d8be32-61cc-40e1-9079-1faa2c5e5621` FINISHED/idle a2026-10-17T14:30:02.712Z. Luego única obs, sin leer objetivo entre suspensión y reloj; wrapper despierta compute antes del reloj por migrador, sin DDL pendiente. TOTAL incluye conexión WS nueva/evaluación/commit, no startup compute dormido. Compute reactivado por wrapper; no más API/DB después del FAIL.

Fallos de setup preservados: inventario ENOENT por ruta journal corregida, cache CLI EPERM resuelta con cache tmp y refreshlock Neon EPERM resuelto con escalación técnica del mismo GET; no son intentos fríos ni auto-review rechazada. CLI neonctl@8.7.2 fijado, perfil explícito; credenciales nunca impresas/copiadas. Worktrees se conservan; no cleanup de un candidato fallido no integrado en main.

Punto 3 explicado: candidatas 5/9 bajo 0,05 o descartadas pueden copiarse internamente aunque no se muestren; el peso también cambia con venta promedio, así que no basta filtrar por peso actual sin preservar elegibilidad/nuevos hechos. No se implementó housekeeping. CI compartida se puede reconciliar aparte y deberá corresponder al candidato final antes de publicar; no se operó. Todos los demás diferidos conservados.

## HISTÓRICO — ANALÍTICAS 0237 AN-3 EN MAIN LOCAL CON QA PASS (2026-10-17)

AN-3 implementada sobre AN-1/AN-2. **QA independiente PASS de entregas y combinación `1713d9423d3761a05daebeef660ddeb8502cd788`**, informe `3e901602fa5354186be53cd9d4660e4286c4fbc5` integrado en dev y main local. [Handoff de cierre](../factory/0237-an3-handoff.md), [QA](../factory/0237-an3-qa.md), [contrato](../factory/0237-an3-contract.md). Main local avanzó por fast-forward autorizado hasta el cierre `7465914c`, conservando AN-1/AN-2. Este ajuste posterior solo documenta el retiro ya verificado; dev y main recibirán también este cierre documental, con producto idéntico al candidato QA. Sin push, deploy, operaciones PROD, verify global ni mutaciones. INDEX/TASKS/estado Claude y archivos ajenos sin seguimiento preservados.

A entrega `99eac508`, fuente final `482cc115`: productores atómicos pos.order.voided, visit.recorded, coupon.redeemed, snapshots de campaña, traductores puros y deduplicación POS/core. B entrega `ef3b4227`, fuente `421ef60c`: tarjetas 10/11/12, clientes e histórico promos, reconciliador tardío en la misma tx después de aplicar todos los grupos. Ningún rediseño de AN-1/AN-2 ni alteración del corte Stock. Una 0099 para analytics.campaign_snapshot, probada solo en DB aislada; 0097/0098 intactas. SQL SHA256 `2ff9057ef236676792e1a7d47b59f6f70946a3429cebf64d8aa42a2fbaf76105`.

Decisiones owner aplicadas: UUIDv5 fijo por comercio/consumer sin columna ni backfill; snapshots de ciclo sin cambiar Marketing; **tarjeta 11 exige ≥4 fechas locales distintas**, unidas entre locales del comercio. Cuatro operaciones en un día son un día para hábito, conservando todas las operaciones/importes en métricas. Mediana de intervalos entre fechas y gasto por día visitado; copy explícita de intervalo habitual y días desde última visita. H5 cerrado: acción «Ver cliente», destino específico pseudónimo, permiso counter y customer_reader/RLS. Si surge nueva contradicción, preguntar y PARAR TODO hasta respuesta del owner.

Evidencia focal con SHA/alcance/fallos en los handoffs: A 6/6 Neon de productores compatibles más 1 caso seleccionado del hook final (seis anteriores no seleccionados, no nuevos PASS), 58/58 unitarios; B 34/34 unitarios, 5/5 Neon, cuatro casos browser de componentes. QA 10/10 oráculos en candidato exacto; coordinador 58/58 comprobaciones y tipos PASS sobre 1713. Tipos/lint/guard y browser POS móvil/escritorio PASS. No nuevo smoke de app real. Node 24.20.0; DB solo tools/neon-test.sh con `/private/tmp/checkpass-0237/migration.env`, replay válido y recurso serial, teardown completo. Nunca DATABASE_URL raíz, CI antigua, perf ni PROD.

**Visual Crossing real cerrado:** una llamada Cuenca, queryCost=2, observado 16oct y pronóstico 17oct persistidos por ruta interna autenticada, 1/1 PASS sin retry. Request 2026-10-17T13:43:18.711Z–13:43:20.817Z, gate normal de 6 h, sin override de hora. Clave solo en memoria desde el env indicado, nunca impresa ni copiada a otro env; contexto invisible. Harness exacto preservado como `.txt`, no suite automática. No repetir la llamada. Fallos iniciales, correcciones y límites conservados, sin atribuir PASS a skips.

**Diferidos conservados:** rendimiento AN-1 último frío 2082,39 ms FAIL frente a 1000 ms, CI compartida con hash 0097 original y CI remoto histórico rojo, housekeeping de candidatas bajo 0,05, ciudades/cron operativos y «cuánto ahorraste». Prueba real de clima y H5 ahora cerrados. No ampliar este encargo para resolver los diferidos. Origin/main referencia local `db3175d237cdcf4ec41e32d70cc1c4f1e06ab2cf` sin publicar. Los bloques históricos siguientes describen sus cortes anteriores; este bloque vigente los actualiza.

Tres tareas factory aceptadas, integradas y **retiradas** (`analytics-an2-{events,product,qa}`, IDs históricos continuados para AN-3). Worktrees y ramas propias retirados sin force/discard tras comprobar ancestros de main, limpieza y ausencia de procesos. Solo queda el checkout principal en dev; no hay reservas activas ni recursos DB propios. El registro retirado QA conserva la etiqueta histórica harness:an3-qa; no es una reserva activa. Archivos ajenos sin seguimiento intactos. Encargo terminado; no continuar con los diferidos por iniciativa propia.

## HISTÓRICO — ANALÍTICAS0237 AN-2 EN DEV CON QA PASS (2026-10-17)

Implementado SOLO AN-2 conforme encargo: eventos Stock de compra/ajuste atómicos (uno por línea de lote), suscripción Recetas/cambio de costo y traductores puros, gauges exactos, tarjetas 5/8/9 e histórico stock/subas. Core reutiliza AN-1, sin switch ni imports de módulos concretos. Conteo intacto. [Handoff de cierre](../factory/0237-an2-handoff.md), [contrato](../factory/0237-an2-contract.md), [QA](../factory/0237-an2-qa.md), [eventos](../factory/0237-an2-events.md), [producto](../factory/0237-an2-product.md).

**Candidato en dev `672e7e1c111bce92cd420605edb4752f8ccc00fa`, QA independiente PASS de entregas y combinación; informe `7e74c821`.** A entrega `b3260d7e`/producto `d6b7c8a2`, B entrega `8dfd0d43`/producto `17507bb3`. Evidencia real: A 5/5 Neon + 25/25 unitarios/fronteras + 3/3 navegador; B 3/3 Neon + 36/36 unitarios + 19/19 fronteras + 2/2 navegador; QA 9/9 oráculos exactos; combinación 39/39 unitarios/fronteras + tipos PASS. Sin skips/retries como aprobación; fallos iniciales SQL/precisión/sandbox/oráculos conservados. Sin verify global ni mutaciones. Browser de componente, no smoke app real.

Owner corrigió tarjeta 9 a max(ticket promedio exacto de 28 días del local, 1% de ventas de 7 días del local), sin FX; sin ventas en 28 días cualquier faltante costeado elegible. COP y sin ventas probados. Costos nullable confirmados: desconocido → conocido publica sin delta ni tarjeta 5; ambos desconocidos no publican. **Una 0098 preparada y probada solo en DB aislada**, SQL SHA256 `e53e80ed3a89109dc8128a11ea0ca7bb17ca21a358ac7b213ffe47a67d611905`, 0097 intacta. Neon exclusivamente wrapper/migration.env, recursos seriales y teardown completo.

**Pendientes diferidos AN-1 conservados:** rendimiento 2082,39 ms FAIL ≤1000, Visual Crossing real para AN-3, CI compartida con 0097 original, ciudades existentes/cron operativos. No se reabrieron. Housekeeping de candidatas bajo 0,05 documentado sin ampliar código. No AN-3 implementada; docs ajenos de prompt AN-3/estado Claude/decisión del owner preservados. No INDEX/TASKS/estado Claude editados por este equipo. Sin push/deploy/lectura o migración PROD. Main local se mantiene `0f543dd8`, origin/main referencia local `db3175d2`; cierre documental posterior al candidato no cambia producto.

Tres tareas factory aceptadas, recursos liberados, sin procesos propios; worktrees limpios conservados en `/private/tmp/checkpass-an2/` porque entrega pedida en dev no es ancestro de main local. Archivos ajenos sin seguimiento intactos.

## HISTÓRICO — ANALÍTICAS0237 AN-1 INTEGRADA EN MAIN LOCAL; RENDIMIENTO DIFERIDO (2026-10-17)

AN-1 cerrada funcionalmente por instrucción expresa del owner: «dejemos de momento las optimizaciones parqueadas, así podemos cerrar esto e integrarlo en main local para poder avanzar al AN-2». QA independiente **PASS funcional con excepción autorizada de §Pruebas9**; no se afirma rendimiento≤1s. [Informe QA](../factory/0237-an1-qa.md), [contrato](../factory/0237-an1-contract.md), [eventos/esquema](../factory/0237-an1-events.md), [dominio/UI/rendimiento](../factory/0237-an1-product.md). Main local y dev recibieron `26493249d375c800b795793c88fd67ad344c3bb2` (informe QA), candidato `65c84251169cbe6e19b86de1ae6d76041c6646dc`, producto idéntico a `e90d1dc878130111c5a881fcb68721f3cf53ec05`; este estado es documentación posterior. Origin/main sigue `db3175d237cdcf4ec41e32d70cc1c4f1e06ab2cf`: sin push, deploy, lectura/migración PROD ni cambio de variable Vercel. No INDEX/TASKS/estadoClaude.

Implementado SOLO AN-1: resúmenes diarios y suscriptor core sin switch, contratos genéricos, tarjetas1/2/3/4/6/7/13, histórico/día/permisos, contexto invisible y retiro del flag. Owner confirmó referencia de peso20 unidades de moneda del comercio, sin FX. Hallazgos H2 y pérdida de asociación intradiaria comunicados antes de resolver: causalidad genérica, métricas de neto/comisión costeados con counts completos, comisión por línea exacta y NULL distinto de0. QA cerró también COP0, overflow, tickets gratuitos, copy con histórico, solape31oct y equilibrio con promedios fraccionarios. Sin AN-2/3 implementada; prompt ajeno `a70ed478` preservado.

Evidencia focal compatible, detallada con SHAs/logs/fallos en handoffs: A18/18Neon +36/36unit/fronteras; Stock11/11 y contexto3/3; B26/26unit y combinación final8/8Neon; coordinador26/26fronteras sobre e90. QA propio8/8oráculos de dinero y único build/tipos+smoke real1/1PASS al primer intento, sin interceptar APIs (sesión owner, staff permisos, dismiss/accept/navegación, histórico3m/local/día). Los casos finales citados no usan skips/retries como aprobación; corridas iniciales rojas y selecciones focales quedan explícitas. Sin verify global ni mutaciones.

**Optimización parqueada:** fríos reales TOTAL12767,59→4795,88→2082,39ms, todosFAIL≤1000ms. Último e90: conexión518,71; claim+lectura1220,97; dominio82,32; persistencia136,25; resto/commit124,14ms. Se paró e informó cada fallo; el owner autorizó cerrar con ese requisito pendiente. Índice parcial y query ya verificados se conservan; no más diagnósticos/mediciones/índices. EXPLAIN33,214ms servidor demuestra uso del índice, no equivale a PASS frío.

**UNA0097 preparada**, SHA256SQL `0836fdec3b0dcbde56eab184faed958f599a237532d9d23b0856aea9f5f7feac`; schema/snapshot/journal coherentes, sin0098. Cadena oficial desde0 en DB vacía `analytics_an1_migration_check`:2/2PASS y ledgerhashnuevo. Perf preservó29,2M filas globales product_revenue + métricas del objetivo; sólo2240auxiliares28d/1120countsCOGS/1fijo para contrato exacto. Índice aplicado como parche exacto del bootstrap original:2/2PASS, ledger completo intacto, sin COUNT/reseed/ANALYZEglobal. No afirmar escenario116,8M ni replay completo en perf.

**CI compartida sigue con0097original** (hash `247e7e684054f9ec462dd1a32f3dde9f96ec52ec6db23dac50ace032c03bf6d1`) y sin índice ampliado. Preflight de replay rechazó15dependencias vs1 antesDDL: rollback, ningún DROP/delete/reset/replay;2oráculos no ejecutados. Experimento se revirtió por commit nuevo y fixture final es exactamente el aprobado; su historia/fallo se conservan. Antes de futuro CI/push seleccionar DB con replay válido (p.ej. `migration.env`) o reconciliar CI mediante operación específica; no presentarla como lista para publicación. Optimizaciones/actualización operativa quedan pendientes, no continuar por iniciativa propia tras la pausa del owner.

**Visual Crossing:** el owner informa después del cierre que la clave ya está en `apps/merchant/.env.local` y decide dejar la prueba real para AN-3. No se leyó/imprimió la clave ni se llamó API real. Proveedor simulado, persistencia/calendario y fuentes oficiales Ecuador validados; contexto sigue invisible. Script de ciudades existentes preparado/no ejecutado, invocación operativa pendiente; cron remoto no creado.

Neon sólo perfil `checkpass`, proyecto confirmado `red-violet-38772073`; Sintetica-cuenca intacta. Configs privadas seleccionadas en `/private/tmp/checkpass-0237/{ci,perf,migration}.env`, nunca copiar env productivos; DB exclusivamente tools/neon-test.sh/Node24. Rama efímera `br-super-math-axhq8e58` desde CI `br-icy-hat-axsfqc8k`, endpoint `ep-aged-mode-axjrknyi`,1CU fijo, expira2026-10-19T08:00Z. Quedó SUSPENDIDA (operación `0be3e707-5ea0-4ad0-a216-af57e12e343c`,FINISHED0fail528ms) para conservar datos sin compute activo hasta expiración. Artefactos/logs fuera repo en `/private/tmp/checkpass-0237` y /tmp.

Dos implementadores y QA terminaron: tareas factory aceptadas con la excepción owner, integradas/retiradas; tres worktrees/ref propios limpios retirados sinforce tras comprobar ancestro main y cero procesos. Root permanece en dev, archivos ajenos sin seguimiento preservados. Base local lista para un encargo separado AN-2; no iniciarlo ni reabrir optimizaciones en este cierre.

## HISTÓRICO — GASTOS: REVISIÓN SIMPLIFICADA LISTA EN DEV (2026-10-16)

Owner autorizó aplicar la simplificación del modal y revisarla. Implementado: introducción única, DateField con calendario sin hora y teclado, «Qué pagaste» principal, clasificación/concepto bajo corrección, detalle opcional con fallback al concepto, local heredado con «Cambiar local», fijo visible. Conserva conceptos estables, descripción histórica/propuesta y HTTP completo. **Ajuste L1 de presentación**, backend/esquema/eventos idénticos. Owner señaló «no deberían ser cambios tan grandes, eran L0 a lo sumo L1»; el coordinador reconoció que sobredimensionó el proceso. Para retoques comparables, mini plan y verificaciones focales; no abrir otra fábrica ni ampliar gates por ceremonia.

[Contrato y addendum](../factory/0236-review-contract.md) base994ff28c. A calendario fuente063007ee, entrega1b11225d; B UI fuente0dda1f66, entrega2e7f9b83. [QA breve](../factory/0236-review-qa.md) PASS entregas y combinación **f0f93b2d1e76b7ca7b952675729975647197c993**, informe **56114bb4c31b3e33915f1a95d6f36ebb0d911067**. Dev y main local contienen ese candidato; commit documental de este estado posterior. Origin/main sigue referencia localdb3175d, sin push. Fuente del kit y UI/tests comprobada idéntica a las entregas probadas; diff backend/esquema/eventos cero. Capturas revisadas390/1280 tras análisis completo. A2/2 browser día pasado/teclado/min/default datetime; B12/12 browser con payloads y oráculos previos,0skip/retry. Tipos/lint/formato/guard pertinentes EXIT0. QA reutilizó evidencia compatible, sin nuevas baterías ni build/Neon. Primer fallo B por dos selectores accesibles quedó documentado, seguido de PASS real sin reducir aserciones. [Handoffs calendario](../factory/0236-review-calendar.md) y [UI](../factory/0236-review-ui.md).

Tres tasks factory gastos-review-calendar/ui/qa aceptadas, integrated/retired y worktrees propios retirados limpios tras ancestro main/procesos. Sin procesos propios. Capturas y fixtures efímeras de este ajuste en `/private/tmp/checkpass-gastos-review/`; cambios ajenos sin seguimiento preservados. No INDEX/TASKS/estadoClaude editados. El servidor existente3201 sirve dev vía `https://dev-business.checkpass.club`; owner ya informado que puede recargar Gastos. Sin pendientes técnicos del encargo; espera su revisión de uso.

Base local preparada en el encargo anterior: migrador oficial db:local:migrate EXIT0, journal97 hasta0096; hash SQL **bb59c940a2f5ba28a16be0dfec10df5dcbf6216710de7f93a7572376afcb5fde**, expenses.concept/expense/expense_revision y esquema viejo retirado. No DB en este ajuste de modal. SPEC0236 implementada local/ADR0151 aceptada; [QA original](../factory/0236-qa.md), [core/rollout](../factory/0236-core.md), [UI original](../factory/0236-ui.md). Preflight PROD específico de lectura ya consumido2026-10-17T03:55:08.839Z, read_only=on/tablas0231/activaciones/permisos0; evidencia saneada `/private/tmp/checkpass-gastos-implementation/prod-readonly.json`. **Sin push/deploy/migración o escritura PROD de Gastos**. Toda operación PROD futura requiere autorización específica nueva y baseline fresco; no reutilizar el permiso de lectura ya consumido.

## HISTÓRICO — GASTOS: SPEC0236 + ADR0151 DOCUMENTALES EN DEV (2026-10-16)

Encargo del owner terminado **solo documentos; detenerse antes de implementar**. Candidato integrado en `dev` **a82d179d75a505163b056f63fd143bde421e4430**, base **45a3f2269320c8e28e202f7369a89f4fedee1009** (N y últimas decisiones del owner integrados). [Spec0236](../specs/0236-gastos-registro-de-pagos.md) cerrada como diseño, DoD de implementación pendiente; [ADR0151](../adr/0151-gastos-y-eventos-autosuficientes.md) propuesta técnica, sin atribuir su aceptación al owner. Decisiones de producto citadas desde F rediseñada y el encargo; eventos mandados por ADR0152 §4. No nuevas decisiones de producto bloqueantes.

Flujo: dos autores en worktrees propios y QA independiente `/root/qa_gastos_docs`. Entregas **35f8895ec6e7a823c52a6ab83381fa57b725b2e8** (spec) y **f2a8b8889f72e21f828787ffd8241ed3fca00c5f** (ADR), ambas aceptadas en factory; merge conserva sus commits. QA de entrega documental y combinación **PASS** exacto a82d179d: blobs/scope, fuentes de código y decisiones/contratos coherentes. Coordinador reprodujo fuentes y comprobó Node24.20.0, Prettier de ambos documentos, check-numbers, diff --check y15 enlaces locales existentes; EXIT0. **0 mutaciones/DB/suites de producto/operaciones PROD/push**, ningún SQL generado. No se operó main local ni remoto.

Hallazgos técnicos separados del owner: además de source_id por edición y location_id nullable, hay que discriminar decoder/retry por tipo y acotar los tres predicados de Stock a sale.closed; filtros opcionales para sus callers de retry/pendingSummary. El test residual de comisión core se reubica, no se pierde al retirar profitability. Compatibilidad histórica de N se conserva; no DROP CASCADE indiscriminado. Los conteos PROD vacíos son históricos proporcionados: **antes de implementar, volver a verificarlos con autorización específica del owner**. Este encargo no habilita implementación, migración ni publicación.

Dos worktrees limpios aceptados conservados en `/private/tmp/checkpass-gastos-docs/`: `gastos-0236-spec` y `gastos-0151-adr`; no retirados porque la entrega pedida queda en dev y aún no es ancestro de main local. Sin servidores ni DB asignados. Copia congelada QA sin env en `qa-a82d179d`. Sandbox exigió escalaciones locales para refs/índices Git; aprobadas, no fallos del producto. No INDEX/TASKS/estados de Claude editados; assets/skills/config ajenos sin seguimiento preservados. El estado de release Negocio y venta F5 se conserva debajo.

## HISTÓRICO — NEGOCIO0235 EN PROD; VENTA REAL F5 VERIFICADA (2026-10-16)

Release publicado **db3175d237cdcf4ec41e32d70cc1c4f1e06ab2cf**, migraciones0093–95 en PROD/journal96,4deploysREADY ysmoke6/6PASS como abajo. **Nueva prueba del owner**: «hice la prueba con el negocio F5 cerre session, inicie de nuevo, abri una orden, la cobre». SQL2026-10-17T03:36:51.028Z, RepeatableRead ReadOnly yguardendpointbf545fdce7a0: **PASS venta530b45ab-11ff-49b2-b80d-8fa70a53d67e**, negocio5fcaebc2-82f2-4b8c-ba5c-27a44c802c40/local11560a0c-e7db-4909-b19c-968ef2ada93c, cerrada03:35:32.629UTC, **ARS9.50**. Única cerrada trasdeploy; pago6d642ce3-d287-409a-aa72-3c5a234e6893, Efectivo41aa1364-e75e-4884-aebe-805d7cfae819 activo/mismo comercio, **method_provider_id=core**.

Core.sale_commission3c257494-118c-423b-b3c7-b3322c9121f9 ycore.payment_commission8fa8c158-f84c-450d-b641-da72314ee89b guardadas, mismas identidades/importe/local/evento. Comisión **0.00, completo, configured:true,reasons[]**, revisiónnull; **CORRECTO para Efectivo/charge_shape=none, cero conocido** según0235/0150. No llamar a este resultado «Sin configurar» ni inventarfalta: el aviso provisional aplica a componentes de un medio que requiere tasa/fijo. Esta prueba no cubre tarifaporcentual/fija ni cambio de comisióncongelado, que tienen evidenciaCIprevia.

Evento857b2a82-047d-468a-887a-c3268bc2983b sale.closedv2 mismo negocio/local/orden/pago/money; solo deliveryRecipesapplied,1intento,03:35:33.265UTC,0claims. Comisiones se guardaron en cierre, no faltadeliveryprofitability. Línea48eeabff-d09a-45c2-aa96-73cfbe953703 tiene composicióncongelada15e22b37-626c-4e0c-9fd2-74b2d56c7891/revisiónrecetae37f4524-18ac-4451-a437-8aa84f2e47d9;3fuentes y3movimientos únicos **-3/-5/-30**, costoscongelados0.175/0.000220/0.005ARS factor1, costoexactoesalínea0.6761. **Otras2líneas sincomposición: no afirmar costocompleto/margen de toda venta**. Sin duplicados observados. No se ejecutó retry ni escritura/testPROD.

Informe actualizado commit **7b9c955f** en dev [release](../factory/release-negocio-2026-10-16.md), sin push extra. Evidencia saneada /private/tmp/checkpass-negocio-release/f5-sale-after.json y f5-sale-verification.json; lectorverify-f5-sale.cjs usa checkoutprincipalvigente (elreleaseWT sigue retirado). Cierre/iniciosesión es reporteowner; no se inspeccionó su navegador. Sigue pendiente si ownerquiere aceptaciónvisual: Negocio3secciones yMarca branding; **reactivación efectiva delcron cada1h aún no confirmada explícitamente**. Puede usarapp/reactivarcron desdecortevalidado; no pedirpermisosgeneralesni rehacerbaterías. Autorizaciónprevia push/migración ya consumida, no usarpara nuevasopsPROD. Credenciales solo memoria sinvalores impresos.

Solo worktreeprincipaldev, factoryrelease retired/recursosliberados; agentes anteriorescompletados. Antes de nuestro informeHEAD95967d1e incorporaba docsADR0152Analíticas ajenos, preservados; ya no aparecen los antiguos docsPARQUEADO/plan como dirty. No editarINDEX/TASKS/estadoClaude ni publicar docs. Mainlocal/remoto permanecendb3175d2; devincluye cierrelocal ytrabajo documentalajeno. Sin código/migracionesnuevas enesta revisión.

## HISTÓRICO — NEGOCIO0235 EN PROD; MIGRACIONES Y DEPLOYS VERIFICADOS (2026-10-16)

**Publicación completa del candidato db3175d237cdcf4ec41e32d70cc1c4f1e06ab2cf**, origin/main y main local exactos. Owner confirmó pausa y ordenó «listo pausado, hace el push y las migraiones», registrado2026-10-17T03:27:25.545Z. Wrapper recibió esta confirmación nueva posterior al pre-push real PASS03:22:16UTC, comprobó SQL read-only sin writers/obligaciones/claims/orphans y permitió el push; Git EXIT0 sin force/bypass. No reutilizar esta autorización para operaciones nuevas.

Migrador oficial0093+94+95 en PROD **EXIT0**,03:27:38.585→03:27:44.805UTC, en una transacción mientras Vercel construía. Baseline final03:27:37.765 y post03:27:50.054: **PASS93→96 journal**, hashes/timestamps exactos/93anteriores idénticos;4comercios,22medios,4inicializaciones,4pagos providerpos,0revs/resultados,38movimientosStock preservados con fingerprints, IDs/OIDs/FK, datos fiscales/regionales/membresías,8punteros normalizados y2funciones históricas iguales. Mapping histórico exactoprofitability/sale.closed/commission_snapshot/pos; retirement_readytrue,0pendientes/claims/huérfanos. No SQL manual/rollback/ventas/commisiones configuradas ni suites PROD. No variables ni cron modificados por GPT.

**4deploys READY con eseSHA**, verificados03:32:02.939UTC. Merchantdpl_HugPt7VRgL3pRePFRXFqmUhypPMg READY03:31:17.244; Customerdpl_21GQpFuBAJrL8x3LRKSP3sJQ27zQ; Admindpl_GXFHXLWZ82th16rS8pQSDpKojkcv; Publicdpl_EQ78j8Y7dJ99M83JbQece1nzfkN5. Aliasescheckpass.club ybusiness.checkpass.club READY mismoSHA03:32:01.879. Smokeanónimo6/6PASS: health200, regional/fiscal/medios/catálogo401, páginaNegocio307. No sondeada CI GitHub traspush. Owner informado que ya puede usarapp yreactivarcron **cada1h**; **no confirmó aún reactivación efectiva**. Pendiente manualconowner: recorrido autenticado Negocio3secciones/Marca branding, selectorPOSyventa real. No darlo porPASS por smokeanónimo. Sincomisiónconfigurada esperado0provisional «Sin configurar», no margenreal; no inventarresultado real aún.

Informe commit **6eaab6571daea7125beac79e3f1aca5e3a90eafe** en dev: [release](../factory/release-negocio-2026-10-16.md). Correccionesdocumentales de cierre solo dev, **sin push extra**. Detalle gates2916unitPASS/4builds/447browserPASS21omitidos/Neon3999PASS282omitidos yfallosanteriores conservados allí. Evidencias operativas sanitizadas en /private/tmp/checkpass-negocio-release/: prepush-final.log,cron-paused.json,prod-before.json,prod-after.json,migration-prod.log,migration-result.json,vercel-release.json,vercel-surfaces.json,prod-smoke.json. Credenciales solo memoria/claves+metadata; no valores.

Factorynegocio-release-0235 **integrated y retired**, worktree/rama retirados limpios tras verificar procesos; recursosCI/puertos liberados. Solo checkoutprincipaldev; todoslosworkers/QAprevios completados. Los scripts operativos que fijaban /private/tmp/checkpass-negocio-followups/negocio-release-0235 apuntan ahora a árbol retirado: no repetir migración/push ni crear señales; para futura consulta readonly ajustar lector al checkoutvigente sin credencialesimpresas. Dev actualincluye informe6eaab657+esteestado, main/remoto se quedan db3175d2. Cambios ajenos sin commit **docs/PARQUEADO.md y docs/plan-margen-ganancia-2026-10-14.md**, y assets/skills/configuntracked preservados. No INDEX/TASKS/estadoClaude editados. Spec/ADR0235/0150 implementados; Gastos/renameexpenses/Analíticas fuera alcance. Después del movimiento no volver a binario0092 ni invertir tablas; recuperación/publicación futura exige autorización propia.

## HISTÓRICO — RELEASE NEGOCIO0235: PRE-PUSH APROBADO; ESPERA CONFIRMACIÓN NUEVA DE PAUSA (2026-10-16)

**Pre-push real completo PASS** sobre candidato **db3175d237cdcf4ec41e32d70cc1c4f1e06ab2cf**, `verify: ok`, originalHookExit0 a2026-10-17T03:22:16.511Z. Log /private/tmp/checkpass-negocio-release/prepush-final.log; sesión56896 sigue viva, ahora detenida por wrapper antes de transmitir. Tipos/lint/guardia/formato verdes;2916unitPASS,4buildsPASS,447browserPASS/21omitidos; Neon paralelo3965PASS/282omitidos, serial34PASS en11archivos,0fallos. Restaurado solo public/next-env.d.ts generado; releaseWT limpio. Reporte actualizado/commiteado en dev **9e8776cb**, sin push documental. No cambiar candidato ni repetir gates aprobados sin motivo.

Owner ya autorizó push main y0093–95 para este corte; no pedir esa autorización general otra vez. **Falta confirmar la pausa nueva del cron después de gates**, solicitada por request_user_input_async al owner. No inferirla de «Cron parado» anterior ni de preguntas de estado. Hasta su respuesta real, NO crear release-continue.json; NO push efectivo ni migración. Marcador prepush-ready.json existe con hora/SHA anteriores. Wrapper espera máximo1h desde03:22:16UTC; si caduca, no afirmar push aprobado/transmitido. Remote aún5b834ca0; PROD sin migraciones del release.

Con respuesta nueva «parado/app sin uso» registrar UTC posterior al marcador y mensaje exacto en /private/tmp/checkpass-negocio-release/release-continue.json {sha:db317...,ownerConfirmed:true,confirmedAt,ownerMessage}. Wrapper read-onlypreflight exige93journal/cero obligaciones/claims/writers/orphans; entonces permite transmitir. Esperar sesión56896 EXIT0 y ls-remote exactodb317. Capturar read-prod.cjs before fresco +check-migration.cjs y ejecutar migrate-prod.cjs inmediatamente mientras Vercel construye (pnpm db:migrate:prod oficial, PROD env existente/guardhost,0093+94+95 en una transacción). Luego read-prod.cjs after+check-migration.cjs after exige96journal/hashes/identidades/FK/pagos/Stock/permisos/punteros/funciones/retirement y mapping histórico. Confirmar Vercel alias READY mismoSHA y smoke-prod.cjs; no sondear CI GitHub. App sigue sin uso hasta verificar. Owner reactiva cron luego; prueba real Negocio/cierre queda a pedir al terminar.

Scripts listos en /private/tmp/checkpass-negocio-release/, Node24. Credential .env solo memoria, jamás valores. CIenv protegido seleccionado /private/tmp/checkpass-recipes-margin/0234-ci.env, suites solo wrapper. Lectura PROD inspection más reciente03:14:35UTC:93journal,4comercios,22medios,4pagosproviderpos,0revs/resultados,profitabilityskipped1/recipesapplied1,0claims/pendientes/writers/orphans,38movimientos; punteros normalizados8 y2funciones históricas. No usar inspection como baseline definitivo. Última ampliación readonly incluye fingerprint punteros normalizados y OID/prosrc/tipos de2funciones; before/after exige igualdad.

Worktree único operativo /private/tmp/checkpass-negocio-followups/negocio-release-0235, tarea accepted exactodb317 y reserva db:modules-ci/puertos3100–2. Mantener mientras push sigue vivo; cerrar/liberar/factoryintegrate+cleanup al terminar sin force. Dos workers/QA ya completados, correcciones solo tests/helper/runtime igual27a3befb. Checkout principaldev conserva cambios **ajenos sin commit en docs/PARQUEADO.md y docs/plan-margen-ganancia-2026-10-14.md**, más assets/skills untracked; no incorporarlos. No INDEX/TASKS/estadosClaude. Al terminar operación actualizar reporte y luego propioestado con commits locales sin push extra. No volver a binario0092 tras mover esquema; recuperación nueva requiere su autorización propia. Información detallada/errores previos preservada debajo.

## HISTÓRICO — RELEASE NEGOCIO0235: PRE-PUSH db3175d2 ACTIVO; NO TRANSMITIR SIN NUEVA PAUSA (2026-10-16)

Owner autorizó push main y0093–0095 para este corte directo, sin usuarios; luego corrigió pausa anticipada: cron puede seguir durante gates y hay que avisarle después para frenarlo. **La primera respuesta «Cron parado» no se reutiliza: falta confirmación nueva posterior a gates.** No pedir de nuevo la autorización general de push/migración ya dada, pero no transmitir ni migrar sin esa pausa/preflight. Scripts operativos bloquean el envío hasta señal manual basada en respuesta real del owner. No modificar cron ni variables por él.

Candidato vigente **db3175d237cdcf4ec41e32d70cc1c4f1e06ab2cf**, QA exacto PASS, main local y dev lo contienen. Worktree limpio al arrancar /private/tmp/checkpass-negocio-followups/negocio-release-0235, task negocio-release-0235 accepted con db:modules-ci y puertos3100/1/2 reservados. **TERCER INTENTO PRE-PUSH REAL EN CURSO, sesión56896**, log /private/tmp/checkpass-negocio-release/prepush-final.log. No lanzar otro push ni modificar candidato mientras corra. Metadata/script release-sha.txt y preparation.json apuntan a db3175d2, QA/focals/formato aprobados. Wrapper temporal llama original.githooks/pre-push intacto una vez; tras EXIT0 crea prepush-ready.json y espera release-continue.json fresco, SHA/ownertrue/timestamp finito posterior y no futuro. Config persistente.githooks. Antes de retornar para enviar ejecuta readonlyprod-before+check-migration. No existe ready/continue/cron-paused al arrancar.

Correcciones aceptadas A f150317aed11d6b007044395d478c8396d5ea9a6 (fuente f0a7a8f0) y B fca45e9c68f8ab36ed0484e47af77cac3a0ddc63 (fuente74cf1bc3), combinadas7cb270d5; informe d09adbd0. **53/53 DB** en9suites,6wrappers focales seriales sin skips + **3/3 browser componente**, con logs/teardowns y QA independiente. Runtime igual27a3befb; solo12tests+helper importado únicamente porbrand.neon cambian. Dos workers ya integrados/retirados limpios en factory, sin procesos. Contrato/handoffs y [reporte](../factory/release-negocio-2026-10-16.md) en dev/main. El plan ajeno sin commit y assets/skills sin seguimiento siguen intactos, no incorporarlos ni tocar INDEX/TASKS/estadoClaude.

Intentos anteriores preservados: prepush.log sobre3fb EXIT1, navegador1FAIL/446PASS/21excluidos127s (tour esperaba Regional retirado; el coordinador omitió inicialmente el fallo y lo corrigió), Neon15FAIL/3950PASS/282skip681,62s porcontratosviejos, serial11noalcanzado; no transmisión ni DNS/red. Tipos/lint/UIguard/formato/unit2916/build4 síPASS en esa tanda. prepush-corrected.log sobred09 se detuvo143 al detectar faltaformato del nuevohelper antesbuild/browser/Neon. Coor ejecutó Prettier solohelper (14líneas indent/cadena); commitdb3175d2, **pnpm format:check completoEXIT0** y AST TypeScript igual a d09 omitiendo texto del SourceFile, sin semántica distinta. QA aceptó exactodb317 reutilizando53+3; no se atribuye verify verde a focals. No repetir verificación parcial por ceremonia: hookactual ejecuta todo de nuevo. Si rojo DNS/red delprepush, detener y consultar según owner; jamás bypass.

Operación preparada en /private/tmp/checkpass-negocio-release/: run-gates.cjs push ejecuta gitconcore.hooksPath temporal push-hooks; wrapper conserva stdin/args y exige remoto inicial5b834ca0 ySHAarchivo. Credenciales solo memoria, desde packages/db/.env.prod.local para PROD con guardendpointbf545fdce7a0; nunca copiar/imprimirvalores. Testenv CI seleccionado /private/tmp/checkpass-recipes-margin/0234-ci.env, DBlocal paraapps y orígenes127.0.0.1:3100/1/2, fake/disposables. read-prod.cjs before/after hace SELECT RepeatableRead/ReadOnly; check-migration.cjs valida93→96/hashes/OIDs/fingerprints/pagos/permisos/Stock/FK; migrate-prod.cjs exige remotoSHA, pausa y baseline<2min y llama pnpm db:migrate:prod con MIGRATE_PROD_ENV_FILE absoluto a envPROD existente, oficialtransaccional0093+94+95. vercel-read.cjs alias/latest/project imprime solo metadata. smoke-prod.cjs solo GET sin sesión health200,regional/fiscal/medios/catálogo401,páginaNegocio307.

PROD aún **SIN PUSH NI MIGRACIÓN de este release**. Último remoto5b834ca0, aliasMerchant dpl_E4woBdcen3SBacSJeiDYFcUH3jpC READY. Inspeccionesreadonlyprevias:93journal hasta0092,4comercios,22medios,4pagosproviderpos,0revs/results,profitabilityskipped1/recipesapplied1,0claims/obligaciones/writers,38movimientosStock. No son baseline definitivo. Al hookEXIT0/marcadorready, leer tabla completa y restaurar solo next-env generados al contenido versionado si aparecen; exigir checkout limpio. Avisar owner/pedir nueva pausa con request_user_input_async; esperar respuesta, nunca crear señal por timeout. Con confirmación nueva escribir release-continue.json {sha:db317...,ownerConfirmed:true,confirmedAt:UTCposteriorready,ownerMessage:texto}; wrapper genera cron-paused yprod-before y devuelve0 solo si condicionespasan. Entonces esperar sesión56896→EXIT0/remoto exactodb317; capturar before fresco y ejecutar migrate-prod.cjs mientras Vercel construye. No esperar READY para migrar. Leer after y check-migration after, confirmar Vercel READY/alias mismoSHA y smoke. Mantener app sin uso hasta esquema completo+datosidénticos+READY. Reanudar cron porowner luego; pedirle prueba real si corresponde, nunca suites PROD.

Después del corte no volver al binario0092 ni invertir tablas; cualquier recuperaciónpublicaciónnueva conserva su autorización propia. Si preflight encuentra pendientes/claims, abortar sin maquillarlos ni reintentar endpoint sin permiso. Registrar SHA/autorizaciones con hora/baseline/migración/deploy/resultados; actualizar reporte/estado por commits locales en dev, sin push extra documental. Mantener reserva CI hasta hook/teardowns terminados, luego liberar y factoryintegrate/cleanup del release solo tras evidencia ymainlocal; no force/discard de trabajo ajeno.

## HISTÓRICO — RELEASE NEGOCIO0235: PRE-PUSH ANTES DE LA PAUSA CRON (2026-10-16)

Owner confirmó que nadie usa la app, aceptó breve interrupción y eliminó la necesidad de publicar puente. Autorización explícita para este caso: «vamos a preparar todo para push, dime cuando quieres que pare cron y cuando estes listo subes a github y aplicas en neon las migraciones». Registrada2026-10-17 02:13:52UTC. Push main y migración0093–0095 autorizados condicionados a pausa confirmada, ausencia de writers/obligaciones/claims y hookprepush completo. Owner después dijo «Cron parado» pero pidió reactivarlo mientras demora el pre-push y avisarle al pasar los gates para frenarlo allí. GPT reconoció pausa anticipada y le indicó que puede reactivarlo. **No usar esa primera confirmación como pausa vigente: esperar otra posterior al hook aprobado antes de transmitir/migrar.** App queda sin uso hasta READY+esquema completo+comparación. Owner opera su cron; no cambiar variables ni cron por él.

Candidato final **3fbcd8a6ad969dbde01087cacd734193abfb3d11**, dev/main local contienen integración65b5f443 más dos fixtures corregidos. Árbol limpio de publicación /private/tmp/checkpass-negocio-followups/negocio-release-0235, task negocio-release-0235 accepted; db:modules-ci y puertos3100/3101/3102 reservados durante prepush/teardown. [Contrato/evidencia release](../factory/release-negocio-2026-10-16.md). Checkout principal conserva plan ajeno sin commit y assets/skills sin seguimiento; no incorporarlos. QA /root/qa_release_plan PASS exacto3fbcd8a6,0mutaciones/DB/suites propias. Runtime idéntico27a3befb; solo dos tests difieren: Marca sin timezone, catálogo exacto agrega business. Entregas retiro1dfb776b y combinación570e169d ahora ancestros del candidato; limpieza factory de esos dos árboles iniciada tras aceptación/mainlocal.

**PRE-PUSH REAL TERMINÓ EXIT1**, sesión68650 cerrada, log /private/tmp/checkpass-negocio-release/prepush.log. No transmitió: remoto sigue5b834ca0. Wrapper adicional revisado QA PASS tras rechazar timestamps NaN/antiguos/futuros. Config persistente.githooks intacta. No existen prepush-ready/continue/cron-paused actuales. Entrega release3fb rechazada en factory por los gates; no volver a intentar ese SHA. Rootrestauró exactamente el único next-env generado (public), releaseWT limpio. Retiro/QA anteriores ya retirados; ahora hay release+dos workers de corrección.

Resultado exacto pre-push: tipos6,6s/lint8/UIguard0,9/formato9,7 PASS,2916unitPASS56,2s,build4PASS20,4s; navegador **1FAIL/446PASS/21excluidos**,127s (GPT omitió inicialmente ese fallo y lo corrigió ante owner). Neon paralelo **15FAIL/3950PASS/282excluidos en8archivos**,681,62s; fase serial11archivos NOalcanzada por wrapperEXIT1. Sin DNS/red observado ni bypass. [Contrato fixes](../factory/0235-release-fixes-contract.md). Dos workers desde3fb en /private/tmp/checkpass-negocio-followups/: negocio-release-contract-tests (A /root/negocio_ui_0235) ahora tiene EXCLUSIVA db:modules-ci tras fin/teardown global; corrige FKconteos/nombrescore, registryliteral, legacyv1soloRecipes, profitability-migration OIDsahoracore y recipes/consumption-cost que esperaba comisiónskipped. Código congelado **f0a7a8f039a0d0f3e95d7a791d1e9b5b2c7eab38**, estáticosPASS; arranca4invocacioneswrapper de1–2archivos y DDLaislado. B /root/spec_negocio_0235, negocio-release-fiscal-test, tiene SOLOpuertos3100/1/2 para brand-progressbrowserfocal, SINDBhastaAteardown; corrige fiscal-inert/brand/helper/slug/permisos-brand-loyalty y tourBrandsinpasoregional. B códigoafc6b89d previoalbrowser; debecongelarúltimoSHA. Luego DBdos selecciones2archivoscadauna:7casos fiscal+brand y24permisos+slug. Nada runtime/SQL/guardias/índices/estadoClaude cambiado. QA favorable estático80b/a855 y573fd, faltan ampliacionesúltimas+focalsDB+teardown para PASSexacto.

Siguiente inmediato: esperar A4selecciones+teardown, transferir reservaCI A→B (release sinrecursosactualmente); recibirentregas/handoffs/QA deSHAs exactos. Integrarcommitsaceptados en releaseWT solo cuando ningún gate corre. Taskrelease estáreserved trasreject; puede refresh a integración limpia y después registrar propiohand-off. Fuente runtime debe seguir idéntica27a3befb: diferencias nuevas solo tests/helpers/documentos. Preparar nuevoSHArelease, QA ymainlocal; actualizar release-sha/preparation y expectativaSHAwrapperdinámica antes de segundo pre-push completo. Preparación3fb invalidada enpreparation.json para impedir retryaccidental. Al siguiente verifyEXIT0 wrapperesperará nueva pausa realdelowner antesdehacerreadonlypreflight/transmitir; cronpuede seguiractivo mientrasgates. No crear continuación sinrespuesta. Scriptsmigración/compare/metadataVercel permanecenlistos,sinPRODejecutado.

Preparación: verify inicial interrumpido antesbuild/browser para fijar orígenes locales; segundo verify tipos6/6,lint,UIguard32,formato y build4apps33,964s PASS, unit2914PASS/2FAIL/1328DBskipped porfixturesobsoletos. Se detuvo durantebrowser antesNeon para corregirlos, sin atribuir PASS global. Corrección63/63PASS1,52s,Merchanttypes/lint/formato/diffEXIT0. **Falta el verify completo del hook de pre-push sobre3fbcd8a6.** Nunca bypass. Si falla DNS/red, parar y consultar como pidió owner; rojo funcional requiere corregir antes de transmitir. No repetir verify preparatorio entero por ceremonia: el hook lo hará obligatorio antes del push.

Artefactos operativos fuera del repo en /private/tmp/checkpass-negocio-release/: run-gates.cjs (verify/push con guardas), read-prod.cjs (solo SELECT RepeatableRead/ReadOnly), check-migration.cjs y migrate-prod.cjs (wrapper oficial, exige remotoSHA, pausa y baseline fresco), vercel-read.cjs (solo metadata). preparation.json y release-sha.txt fijan3fbcd8a6 y evidenciaQA/focal. Wrapper adicional push-hooks/pre-push invoca el hook original INTACTO con stdin/args íntegros, propaga errores y solo tras EXIT0 genera prepush-ready.json; espera release-continue.json con confirmación nueva del owner, ejecuta readonlyprod-before+check y recién retorna0 para transmitir. core.hooksPath temporal SOLO en comando git; config persistente sigue.githooks. Sin bypass ni replay de evidencia; no usar --no-verify. **No crear release-continue/cron-paused sin respuesta posterior al hook.** QA independiente revisa este bloqueo operacional antes de arrancar. Credenciales PROD solo memoria desde packages/db/.env.prod.local; huellaendpointbf545fdce7a0. Testenv: CI seleccionado /private/tmp/checkpass-recipes-margin/0234-ci.env; apps usan DB local, orígenes127.0.0.1:3100/3101/3102 y proveedoresfake, secretos descartables. No copiar envPROD ni imprimir valores.

PROD solo leído02:15:39 y02:17:35UTC, snapshots guardados prod-inspection.json/log: journal93 hasta0092,4 comercios,22medios,4pagosproviderpos,0revisiones/resultados; profitabilityskipped1/recipesapplied1,0pendientes/claims,0writersactivos,0huérfanos,38movimientosStock. Fingerprints/OIDs/FK/membresías para comparación. AliasMerchant sigueREADY dpl_E4woBdcen3SBacSJeiDYFcUH3jpC SHA5b834ca0; proyecto prj_l6uSNCTaE6ez8GfVCwXJCu32ndt0 producciónmain confirmado. Remoto main5b834ca0 leído; no push/migración actuales aún. GitHub histórico38971334745 rojo conocido, fixes incluidos; no sondear CI tras push.

Siguiente: ejecutar run-gates.cjs push desde árbol limpio con logprepush; el hook original checknumbers+verify real corre una vez, sin force/bypass. Cron puede seguir activo durante esa fase; el wrapper impide enviar el commit aunque pase. Al aparecer prepush-ready.json avisar al owner y pedir nueva pausa. Solo con su respuesta registrar release-continue.json con SHA y hora posterior; wrapper captura baselineprod-before y valida0obligaciones/claims/writers + journal93/últimohash0092 antes de transmitir. Si pushEXIT0 confirmar remoto3fbcd8a6; volver a leer baseline antes de migrar mientras app sin uso, ejecutar migrate-prod.cjs con0093+0094+0095 en transacción del migrador (driver instalado confirmado). Leer prod-after.json y check-migration.cjs after:96journal+hashes exactos, mismosdatos/OIDs/FK/pagos/permisos/Stock y preflightretirementtrue. Confirmar Vercel READY mismoSHA, smoke y pedir venta de prueba al owner. Solo después reactivar cron a cargoowner. No volver a binario0092 ni invertir tablas tras corte; recuperar hacia adelante/compatible con autorización propia. Registrar resultado y actualizar estado/entrega local sin push extra documental.

## HISTÓRICO — MIGRACIONES LOCALES Y FIX CI CERRADOS; RETIRO0235 PREPARADO (2026-10-16)

Encargo owner satisfecho localmente: migrador re-ejecutado EXIT0,96→96, hashes0093/0094/0095 coinciden; ya estaban aplicadas, sin reset/seed. URL solo memoria y guard local, huella16d3a8712ad6. Evidencia /private/tmp/checkpass-negocio-local-migration-confirmation.json. No se operó PROD ni se hizo push. Preservados INDEX/TASKS, estados de Claude y archivos ajenos sin seguimiento.

Dos workers y QA independiente terminaron. [Contrato y ampliaciones](../factory/0235-followup-contract.md), [cierre QA](../factory/0235-followup-qa.md), [handoff CI](../factory/0235-ci-fix.md). Trabajo/documentación cerrado c02b8b9672f5aa88656a31229abb4ee4da218d42; dev y main local contienen el fix CI99d18e2f, integrado794140d4. Main local avanzado desde checkout limpio a c02b8b96, comparando apps/packages/tools/.github con entregaCI: idénticos. Estado propio se registra después en commit documental; ningún retiro de compatibilidad está en dev/main.

CI: log remoto40P01 durante teardown cruzado con DDL y timeout Stock que no superaba budget. Arreglo unifica workflow con tools/neon-test.sh, mismas exclusiones/selección serial para DDL/business-failures y env efímero0600/trap; sin serializar todo ni ocultar errores. Timeout conserva2000/2500ms, prueba INSERT+rollback, no ACK y recuperación1. También mueve los cuatro casos del test de acceso core a modules/pos, sin tocar guardia. QA PASS; evidencia focal/historial de fallos en handoff. Run remoto38971334745 sigue siendo el histórico rojo: no se publicó ni se lanzó rerun. Task ci-baseline-0235 aceptada, integrada y retirada con factory; worktree/rama eliminados limpios, logs durables fuera del árbol.

Retiro worker1dfb776b8160ffa588ca4c29292b60b5c367243d, runtime d4eda771, aceptado condicionado. Handoff conservado en esa rama: git show 1dfb776b:docs/factory/0235-retirement.md. Elimina adaptadores/aplicadores precorte conservando lectura/mapping/IDs/avisos y rechaza obligación sin handler antes de ACK. Dos tandas DB vía wrapper y reserva serial:5/5 y9/9 PASS sin skips; teardown terminado y recurso liberado2026-10-17 01:51:03UTC. SQL preflight solo lectura preparado, no ejecutado contra PROD: detecta esquema/obligaciones/claims, no demuestra READY ni ausencia de writers antiguos.

Combinación código27a3befb6436ffdd21d7ebce5a766a96f8dea1ed: tiposMerchant PASS,67/67 unitarios focales y único buildMerchant PASS. Rama negocio-followup-qa final documental570e169d206480055f5afc7583999083fcde8696, aceptada por QA exacta; apps/packages/tools/.github idénticos27. Conserva por merge el commit ajeno1300a07b del plan sin editarlo ni atribuirlo al coordinador. Dos ramas/worktrees retenidos y limpios: negocio-retirement-0235 y negocio-followup-qa, ambos accepted sin recursos; no integrar/retirar mientras falten precondiciones. Sin suites, servidores ni túneles propios activos.

Pendiente operativo: preparar puente compatible basado en e5eaa741 **actualizado con el fix CI** (el antiguo SHA no lo contiene), gates del SHA exacto y autorización específica de cada push/deploy/operación PROD. READY y ausencia de writers antiguos antes de0093+0094+0095 juntas en una transacción; preservar/comparar datos y drenar/certificar obligaciones/claims antes de integrar/publicar retiro. Código preparado no certifica ese drenaje. Rollback posterior al corte solo a puente compatible, nunca a0092 ni moviendo tablas atrás. No pedir autorización por anticipado ni publicar main final directamente sobre esquema viejo. Gastos/Analíticas fuera de alcance.

## HISTÓRICO — CI PREVIO Y RETIRO CONDICIONADO0235 EN CURSO (2026-10-16)

Owner pidió aplicar migraciones locales y lanzar un agente para el CI rojo y otro para el punto4 (retiro de compatibilidad). [Contrato](../factory/0235-followup-contract.md) comprometido05863466, ampliacionesb5f6f1af. No push, migración/deploy/drenaje PROD autorizados. Dev integra trabajo; main local permanece e2cd4544 con Negocio verificado. Preservar todos los assets/skills/configs ajenos sin seguimiento, INDEX/TASKS y estados de Claude.

Migrador LOCAL re-ejecutado EXIT0:96→96, hashes0093/0094/0095 coinciden con journal y SQL. DATABASE_URL solo memoria, host local verificado, huella16d3a8712ad6; sin reset/seed ni valores impresos. Resultado /private/tmp/checkpass-negocio-local-migration-confirmation.json. Aplicación local satisfecha; no quedan migraciones actuales pendientes.

Worker CI `/root/negocio_ui_0235`, task/rama ci-baseline-0235, árbol /private/tmp/checkpass-negocio-followups/ci-baseline-0235, base05863466. Único poseedor db:modules-ci, env seleccionado /private/tmp/checkpass-recipes-margin/0234-ci.env; SOLO tools/neon-test.sh y selección serial, incluyendo teardown. Paths testStock/permissionshelper/handoff CI más workflow y wrapper/tests nominales en contrato/factory. Sin runtime fuera de scope ni presupuestos/assertions relajados. Guardar logs reales durables sanitizados.

CI status confirmó main5b834ca0 run38971334745 rojo: Stock637 completed10<10 y DELETEbusiness86. Log remoto leído por root confirma40P01 deadlock, no FK; archivo /private/tmp/checkpass-ci-baseline-0235/remote-failures.log. Workflow usa pnpm test directo y omite el aislamiento de DDL del wrapper local; se investiga reproducción/orden de locks antes de certificar causa/resolución. Diez sleeps0.1 suman1s frente budget2s, hipótesis de inducción insuficiente pendiente de medición. Suite nueva business-failures tiene trigger global40001 y nombre sin migration: el arreglo de aislamiento debe cubrirla también, sin tocar el archivo reservado a retiro. Ningún PASS de arreglo todavía.

Worker retiro `/root/spec_negocio_0235`, task/rama negocio-retirement-0235, árbol /private/tmp/checkpass-negocio-followups/negocio-retirement-0235, base05863466. Implementa candidato separado postcut/drain: retirar elección de schema/onEnable/provider POS, ramas Brand precorte y suscripción/aplicación/retry antiguos; conservar lectores/IDs/avisos y sale_settlement si se usa. SQL precondición solo lectura distingue readiness/queue/claims de evidencia externa oldwriters/READY. No consultas PROD ni DB de CI hasta turno explícito tras liberar el otro worker. Paths amplios explícitos en factory/contrato; ampliados resources.neon y stock-local-integration-support. Tests del candidato prueban ausencia de ACK ante obligación inesperada y conservación histórica; bridge/ACK original permanece en e5eaa741. No skips para esconder retiro ni borrar obligaciones.

QA `/root/qa_release_plan` leyó contrato y espera SHAs congelados; sin DB/suites, presupuesto0 mutaciones. CI fix puede integrarse tras QA; retiro se conserva como artefacto condicionado, no sustituye puente ni certifica corte/drenaje PROD. No integrar/publicar retirada antes de su precondición operativa. Sin subdelegación/revisores extra. Siguiente: recibir diagnósticos/commits, transferir reserva DB solo después de teardown, QA focal y actualización de handoffs/estado. No verify global ni publicación por inferencia.

Negocio local anterior queda íntegro: [QA](../factory/0235-qa.md), [core/rollout](../factory/0235-core.md), [UI](../factory/0235-ui.md); candidato finalb6dcb1bc, puente combinadoe5eaa741. Operación eventos PROD anterior terminada en d60711a3, sin nuevas operaciones en este seguimiento.

## HISTÓRICO — NEGOCIO0235 IMPLEMENTADO LOCAL; QA PASS; SIN PUBLICAR (2026-10-16)

Owner pidió lanzar la implementación tras aprobar0235/0150. Dev y main local incluyen el cierre `2ce13f3258f1fb9582bcaeae2dbce2a36619f999`; producto combinado `b6dcb1bc412d113b1417366bbee12ab62666a8cc`, informe QA `be7cafe4`. [QA y candidatos](../factory/0235-qa.md), [core y rollout](../factory/0235-core.md), [UI](../factory/0235-ui.md), [spec](../specs/0235-negocio-y-medios-de-pago-core.md). No push, deploy ni migración PROD autorizados/ejecutados para0235.

Entregas aceptadas: A4ae464bb (runtime a97995f1, idéntico a598a0264) y B d0517a18. QA independiente PASS de entrega/combinación y documental. Negocio core con Medios/Regional/Fiscal, permiso business sin backfill y owner por rol; Marca conserva branding; selector POS intacto. Captura común y comisión/cabecera inmutables en el mismo cierre, también flagOFF/neto0; provisional/incompatible/ausente conservan calidad, condiciones comerciales no bloquean y fallo DB revierte. Correcciones verificadas: archivo ante respuesta tardía, moneda del fijo409 sin reinterpretación y GET medios de una sola instantánea.

Evidencia combinada: tipos DB/dominio/Merchant3/3 PASS y Merchant tras GETfix PASS; build único Merchant Turbopack41805587 EXIT0. Diff de apps/packages contra candidato final EXIT0, reutilización por identidad. Smoke compilado sin sesión: tres APIs401, página Negocio307; servidor43122 detenido. UI:10/10 confirmación,25 regresiones compatibles,5/5 correcciones y2/2 vistas390/1280; selecciones unit con solapamientos, no sumar. A:13/13 DB dinero/acceso,2/2 DDL,26 compat emitidos PASS aunque tanda EXIT1 por path temporal movido; puente definitivo5/5 más signup1/1 seleccionado EXIT0, otros5 onboarding fuera de filtro;68 unit finales PASS. DB solo wrapperCI con reserva serial. Salidas DB conservadas en sesiones de herramientas74202/55803/27479/30654, sin logs físicos inventados. No smoke autenticado completo ni verify global de publicación.

Base LOCAL migrada0093/0094/0095,93→96 journal, host local guardado por huella URL16d3a8712ad6, sin revelar valor. Diez medios y dos marcadores previos conservaron fingerprints exactos; tercer comercio sin medios recibió cinco y un marcador (comparador global inicialfalse explicado y preservado). Pagos/revisiones/resultados anteriores idénticos. Sin reset/seed general. Ruta local para owner: /backoffice/business.

Publicación futura exige **puente combinado e5eaa741e5f1b3f1f0787b134b3d00d1c5d5c45c** (incluye B; backendfac323aa aislado no es publicable), gates del SHA, READY y retiro de writers anteriores; después autorización propia para0093+0094+0095 juntas en una transacción y comparación de datos/drenaje; solo después publicar retiro administrativo final. El migrador instalado envuelve todas las pendientes en session.transaction y conserva advisory2350150 hasta COMMIT después0095. No afirmar que main final se publica directamente antes de ese corte. Adaptadores de ubicación/onEnable y recuperación histórica aún conservados necesitan señal operativa de retiro: DoD lo deja abierto, no se certifica PROD por QA local.

Baseline CI inicial main5b834ca0 sigue rojo run38971334745, consumo Stock637 y teardown permisos86; no se certificó causa ni resolución y no se relajaron tests. Resolver o acordar antes de publicar, junto con pre-push vigente sin bypass. Ninguna autorización de publicación anterior se transfiere a0235.

Factory integrate/cleanup completados para spec-negocio-0235, negocio-ui-0235 y negocio-integration-0235: aceptados, limpios, ancestros de main, sin procesos; tres tareas retiradas y worktrees/ramas operativos propios eliminados sin force. Solo checkout principal dev. Evidencias externas conservadas bajo /private/tmp/checkpass-negocio-integration-0235 y /private/tmp/checkpass-negocio-0235; handoffs/commits persisten. Skills/assets/configs ajenos sin seguimiento intactos; no INDEX/TASKS ni estados Claude editados.

Operación anterior de eventos PROD sigue terminada y separada: informe release-module-events-2026-10-16.md en d60711a3, flagON y cron horario del owner, deploy5b834ca0READY y venta F5/retry verificados. No hubo otra operación PROD durante Negocio. Siguiente: prueba owner local y preparar rollout solo cuando lo solicite, con autorización paso a paso. Gastos va después de esta integración, conservando los contratos/compatibilidad necesarios.

## HISTÓRICO — SPEC0235 EN IMPLEMENTACIÓN; EVENTOS PROD ON VERIFICADO (2026-10-16)

Owner pidió lanzar implementación de Negocio después de aprobar las cuatro decisiones de [0235](../specs/0235-negocio-y-medios-de-pago-core.md)/[0150](../adr/0150-negocio-y-comisiones-core.md). Diseño documental `209f5937` con QA PASS; preparación/contrato `48d024c0`, ampliaciones `defe8f6f`. [Contrato de implementación](../factory/0235-implementation-contract.md). Sin implementación integrada todavía: dev tiene documentos; main local/remoto registrado en5b834ca0. No push, migración PROD ni deploy autorizados para0235.

A `/root/spec_negocio_0235`: taskfactory `spec-negocio-0235`, rama del mismo nombre, worktree `/private/tmp/checkpass-spec-negocio-20261016/spec-negocio-0235`; continúa base48d024c0 con foundation compartida00624614, backend/esquema/API/migración preparada y pruebas CI focales. Reserva exclusiva `db:modules-ci`, configuración seleccionada `/private/tmp/checkpass-recipes-margin/0234-ci.env`, solo wrapperNeon y DDL serial. Ampliación nominal de domain/server/brand aprobada; no UI/kit/guardia/PROD. Código aún en progreso, no PASS funcional declarado.

B `/root/negocio_ui_0235`: taskfactory/rama `negocio-ui-0235`, worktree `/private/tmp/checkpass-negocio-0235/negocio-ui-0235`; base refrescada00624614 tras FF de tipos, stash propio reaplicado y retirado sin trabajo ajeno. UI Negocio/Marca/nav y regresiones en progreso; permisos de recursos43120/43121 y loopback efímero para harness incumbente, sin DB. No toca Settings/servidor/esquema/kit. QA `/root/qa_release_plan` hizo preflight estático sin bloqueantes y esperará entregas congeladas; no ejecutó DB/suites ni implementó.

CI inicial obligatoria de main5b834ca0: ROJO run38971334745 en Unit+Neon, Stock consumo637 (completed10<10) y teardown permisos86 DELETEbusiness. Causas no certificadas: el test Stock tiene esperas mínimas1s frente budget2s, plausible dependencia de latencia; teardown carece de pgcode para diagnosticar. No aflojar oráculos ni publicar candidato con este baseline sin resolver/acordar. No sondear después CI ni ejecutar suites globales por ceremonia.

Operación previa de eventos terminada: [informe](../factory/release-module-events-2026-10-16.md), commit localdev `d60711a3`, sin push adicional. PROD Merchant READY `dpl_E4woBdcen3SBacSJeiDYFcUH3jpC`, SHA5b834ca0, aliasbusiness.checkpass.club. Owner cargó flag y redeploy personalmente; ON efectivo por venta `dc07d3c5-829b-4bb1-8ffc-ec3e81c3d5b8`, evento v2 `ad308b1c-a753-4aea-9b58-9e353703efb4`, recipesapplied, tres consumos/costos congelados0.6761ARS, profitabilityskipped/modules_disabled y comisión «sin configurar». Retry único autorizado17oct00:42:03UTC ejecutadoHTTP200/ok0contadores; SQL posterior8conjuntosidénticos sin duplicados. Cron horario configurado por owner. Worktree release retirado con factorycleanup; evidencias externas preservadas. Ninguna autorización PROD de esa operación se traslada a0235.

Siguiente: recibir commits/handoffs A/B, QA de entrega y combinación focal, integrar dev y habilitar prueba local con DB local protegida cuando esquema/candidato estén listos. No marcar implementada ni avanzar/publicar por inferencia. Preservar assets/skills/config ajenos sin seguimiento y commits documentales de Claude0752d249 sin editarlos.

## HISTÓRICO — SPECS0228/0229 INTEGRADAS EN MAIN LOCAL; QA PASS (2026-10-14)

Owner autorizó continuar el [handoff0228/0229](../handoff-0228-0229-implementacion.md) automáticamente hasta QA pasado, con dos implementadores y QA independiente. Producto congelado `07393f2cacbad43cc3d92fd98b028ab1f8ff8a70`, A `bc9b29bd674452e11f70943f06850be0d2bb277e`, B `4b25cfabf857c480400c475f4aaa2d4a61579b35`; [QA independiente](../factory/0228-0229-qa.md), [A](../factory/0228-stock.md), [B](../factory/0229-brand.md), [fichas](../factory/0228-0229-contract.md). Owner autorizó el merge a main local: «si autorizo el merge a main local». Candidato `9b7b323fb96a908dacf8bdd6bfe64adceaf08fd7` integrado por fast-forward desde `39d00edfca6347773c03a015a2ffcd1a1d38b0dd`, sin cambiar la rama dev del checkout principal. Cierre posterior sólo documental; ningún push ni operación PROD autorizados.

Promedio móvil nullable6 por insumo/local, apertura única desde último costo local, bigint3/2/6 con importe exacto y compra/entrada atómicas bajo locks compatibles. Drenaje previo acotado fuera de transacción; fallo/timeout no bloquea compra válida y recuperación no repondera. Marca guarda tres datos privados por comercio con decimal exacto, legacy/guardbrand/idguard/revisión409, kit y recuperación existentes; no activa cálculos. Esquema único0084 aditivo, conserva EXPAND0227 y flag de consumo. Rollout/corte/seed/rollback en tools/stock-average, sin ejecución PROD.

Retoma tras clear: [handoff de próximas features](../handoff-proximas-features.md). El owner quiere continuar con dos implementadores, coordinación y QA independiente; aún no asignó las nuevas features. Main local permanece120ecbc9, cierre de0228/0229; este handoff sólo añade documentación a dev. Preservar modificaciones ajenas de docs/estado/claude.md y claude-historico.md.

Operación local posterior autorizada:0084 aplicada con db:local:migrate contra db.localtest.me (85 entradas de journal), sin reset/seed ni cambio de código. Se comprobaron las cinco columnas y hash0084 `8bf7a3919dc381ba9f57ffdf63c8fbf4f61035099307fc1971b275c4507b6dc5`. Resuelve la falta de columna que provocaba503 al cargar insumos desde Recetas; no equivale a smoke autenticado de UI. Vercel apunta a producción según owner; CI de pruebas no actualiza esa DB ni la local. En futuras entregas con migración comprobar alineación de la app local, sin inferir autorización PROD.

QA candidato: **29/29DB +1/1probe fiscal bruto,77/77unit, tipos DB/dominio/Merchant, ESLint, guard10, detector[], check-numbers y build Merchant PASS**, sin skips/retries. Lote10000 aplicado íntegro en5867ms dentro20s; corte70000 en1000ms. Browser fiscal4+regresión19 y visual390/1280 claro/oscuro, DBMarca20, DDL3 y entradas7/local5/conteoconcurrente1 se reutilizan según identidad de fuentes registrada. Formato de documentos de coordinación corregido preservando contenido histórico y rutas literales; cierre documental se valida además sobre su SHA.

Se conservan los rojos iniciales: algunos diagnósticos cruzaron reposo real (pmset), pero las corridas A14:08/14:16 no; no atribuir todos a suspensión. Baseline c9 controlado despierto pasó10/10 y candidato corregido pasó todos los afectados. QA detectó idlePoolError sin listener normal; A corrigió todos los pools sin cambiar URLs/budgets/capacidad, unitdriver2+antiPROD10PASS. En diagnóstico se imprimió inesperadamente contexto con credencialCI: owner informado, logs restringidos/redactados y salida posterior sanitizada antes de disco; **rotación de credencialCI pendiente**: contraseña compartida por NEON_CI_DATABASE_URL y NEON_CI_DATABASE_URL_UNPOOLED; NEON_CI_CONSUMER_DATABASE_URL usa otra credencial. Se explicó al owner sin mostrar valores; ninguna operación PROD.

Factory integrate/cleanup completados para cost-spec-0228, brand-tax-spec-0229 y qa-0228-0229: tres reservas retiradas, worktrees y ramas operativas propios eliminados sin force tras comprobar aceptación, ancestro de main, HEAD/árbol limpio y ausencia de procesos. Sólo queda el checkout principal. Historial/evidencia, ref candidate y backup/0229-brand-before-foundation preservados. Artefactos y skills ajenos del checkout principal intactos.

## HISTÓRICO — SPECS0228/0229 EN IMPLEMENTACIÓN; QA ABIERTA (2026-10-14)

Owner autorizó continuar el [handoff0228/0229](../handoff-0228-0229-implementacion.md) con dos implementadores y QA independiente hasta PASS completo. Reserva/coordinación/harness `e62b07dd`: continuidad documental validada5/5 por autor y QA, histórico preservado, checkout limpio/ancestros/repositorio/scope/recursos/procesos comprobados, cleanup intacto. [Fichas y ampliación B](../factory/0228-0229-contract.md). Main local permanece39d00edf; ningún push/PROD ni autorización final de merge solicitada aún.

A usa reserva `cost-spec-0228`, worktree `/private/tmp/checkpass-0228/factory-0228-cost-spec`, basee62b07dd; fundamento común esquema `c9e75c87`, producto `c22089c3`. Único writer esquema/journal0084 de ambos encargos; expand5columnas3checks, sin contract0227 ni seed histórico. Unit17 y tipos/lint/formatoPASS autor. CI protegida migró0084 mediante wrapper. CorridaDB inicial en sandbox detenida143 con timeouts; escalada posterior sigue abierta, coreconsumption6PASS/4FAIL (concurrencia,10k/20s,cut70k/2s,cancelación). NoPASSfuncional; se comparará baseline exacta si procede, sin subir límites/relajarasserts.

B usa `brand-tax-spec-0229`, worktree `/private/tmp/checkpass-0229/factory-0229-brand-tax-spec`, basec9e75c87; producto/testcorregido `6980207e`, trabajo previo preservado en `backup/0229-brand-before-foundation`. Unit41 y tipos/lint/guardPASS; fiscalbrowser4+regresión19PASS, QA visual390/1280 claro/oscuro conforme. Prueba noefectos movida a raízmodules por frontera,17/17PASS tras corregir ubicación. DB20casos reales preparados, espera reservaA. Ninguna fiscalidad activa ni cálculo Stock lee datosMarca.

QA usa `qa-0228-0229`, tercer árbol `/private/tmp/checkpass-0228-0229/factory-0228-0229-qa`, basee62b07dd; informe propio en elaboración. Harness/snapshot inspeccionados, aceptación A/B y combinación pendientes. Reproducirá señales decisivas y verificará buildMerchant una vez sobre candidato congelado. DB sólo wrapperCI y turno serial reservado también teardown; archivo CI-only `/private/tmp/checkpass-0228-0229-ci.env`. Conservar los tres árboles y entregas, sin cleanup hasta aceptación/merge autorizado a main local.

## HISTÓRICO — SPEC0227 IMPLEMENTADA E INTEGRADA EN MAIN LOCAL; QA PASS (2026-10-14)

Owner autorizó el merge local: «si hacemos el merge a local». Candidato `f37785190ebbb598abbf36dc3111d3cf0a385610` integrado por fast-forward desde `402f38b2`; `dev` sincronizada, sin cambiar de rama el checkout principal ni tocar archivos ajenos. Producto verificado `2c58a61fe600a4b20d504b9f99fa085368c2ade1`, entregas A `87deae34` y B `4a07b7e1`. El cierre posterior modifica sólo documentación. [Informe QA independiente](../factory/0227-qa.md), [entrega A](../factory/0227-stock.md), [entrega B](../factory/0227-integration.md).

Stock por local, revisión inmutable y outbox/consumo después del cierre implementados. QA detectó y cerró consumo grande que agotaba20s: batching aplica10000 movimientos y delivery atómicamente en6136ms medidos en CI; corte70000 IDs usa un solo array bind. No se ampliaron presupuestos ni límites. QA final17/17DB +1probe real,25/25unit, tipos/lint/formato/buildMerchant PASS; UI6 y visual390/1280, DDL8 y evidencia de autores reutilizados por identidad explícita. Sin skips/retries usados como PASS. Dos implementadores y QA independiente; entregas aceptadas en factory y retirada de los tres worktrees propios al cerrar la integración conforme registro local `.factory/registry.json`.

**Cierre local, sin push ni operación PROD.** CI protegida recibió expand0082/0083; contract sólo probado con rollback. Schema entregado representa expand, flag `MODULE_EVENTS_ENABLED` OFF por defecto y sin reconstrucción histórica. Rollout/contract revisables en `tools/stock-local/README.md`; cada push/operación PROD requiere autorización propia. Owner configura cron-job.org0/30,24h Guayaquil. DB de desarrollo original y artefactos/skills ajenos preservados.

## HISTÓRICO — PUBLICACIÓN Y VERIFICACIÓN PROD COMPLETADAS (2026-10-13)

Owner aplicó personalmente las migraciones de producción. Verificación posterior READ ONLY: journal/hash0079/0080/0081 coinciden con SQL local, tablasPOS en esquema pos, core.ai_request existe, tablas/columnas antiguas retiradas, cero pendingAI huérfanos. Se regeneró huellas-prod.txt local y compare.sh PASS19categorías. Health Merchant y ConsumerHTTP200. Cuatro deploysVercel completados para54dbff34 confirmados por statusesGitHub. No se ejecutó otra migración ni hubo otro push. Logs /private/tmp/checkpass-post-migration-readonly.log y /private/tmp/checkpass-release-prepush.log; sin baseline de conteos anterior aportada en este cierre, no certificar conservación de filas por comparación pre/post.

Agente documentación terminó en bdd07785, rama factory-stock-spec/worktree /private/tmp/checkpass-stock-spec. Dos archivos: docs/specs/0227-stock-por-local-y-consumo-por-receta.md y docs/adr/0145-consumo-stock-al-cobrar.md. Borrador/propuesta por hallazgos: corte de conteos vs pendientes, POSmulti-local antes del selector futuro, rollout y captura del snapshot frente a fallaDB. Cronpropuesto cada30min24h conCRON_SECRET, aparte delwallet; owner configura/aprueba horario. Solo docs, formatter/diffcheck; sin código/migraciones/tests/push niINDEX/TASKS/estado por ese agente. Se conserva árbol limpio de documentación para revisar; no incluido en publicación54dbff34.

## HISTÓRICO — PUSH COMPLETADO, ANTES DE MIGRACIÓN

Owner confirmó QA real completo (incluido Mesas y centralizador de IA), AI_PROVIDER y snapshot; autorizó push, NO migración todavía: «te aviso cuando esté listo para aplicar la migración». Main remoto confirmado54dbff34 por ls-remote. Push desde copia limpia exacta54dbff34, pre-push obligatorio EXIT0: tipos10,2s/lint7,7/guardia1,9/formato8,7/unit2726/build4Turbopack29,7s/e2e390PASS62skip299,5s/Neon3674PASS282skip514,5s (3660+14, migraciones aisladas5/5). Log /private/tmp/checkpass-release-prepush.log. Ninguna migración de PRODUCCIÓN ejecutada. La anterior limitaciónTurbopack y los deadlocks no se reprodujeron en esta corrida final. Antes de migrar0079→0080→0081 confirmar READY del commit y aviso explícito owner; cotejar copia según0224.

Worktree hotfix Mesas retirado tras QA owner. Spec nueva etapa0Stocklocal/consumo solo documentación por otro agente; respuestas1–11 recibidas, redacta0227 y ADR0145 en /private/tmp/checkpass-stock-spec, sin INDEX/TASKS/estado/código/migraciones/push. No incluida en publicación54dbff34. Mantener separado el encargo de documentación de la operación de publicación/migración actual.

## HISTÓRICO — PILOTO FACTORY IMPLEMENTADO, QA ACEPTADO (2026-10-13)

Hotfix Mesas durante QA owner: `0b9d467b` en main/dev locales, túnel activo desde main. Un agente añadió autoscroll del listado al crear para revelar la nueva fila; root revisó diff. POST201/duplicado409 y cinco mesas activas confirmados en logs/DB local. Causa scroll plausible, no confirmada por browser: owner cortó probes/pruebas y hace QA visual. Sin pruebas nuevas ejecutadas; probe del agente quedó esperando permiso sandbox y se canceló. Worktree `factory-tables-fix` integrado, conservado hasta resultado QA/corrección. Sin push/PROD.

Owner ratificó autonomía del trabajo local; push y migraciones de producción exigen su autorización por caso. AGENTS distingue autorización funcional y permisos técnicos. Preferencia del proyecto en `.codex/config.toml`: on-request + auto_review, network_access para workspace. Debe cargarse en nueva sesión/configuración confiable; el modo actual de permisos y requisitos gestionados prevalecen. En el chat actual seleccionar “Approve for me”; no se afirmó haber cambiado en caliente sus permisos. Sin desactivar sandbox ni modificar configuración global.

Owner aprobó dos implementadores fullstack, coordinador y QA independiente, dev como base, main local listo y cada publicación con autorización explícita. Base Claude bca17ec + handoff148c38af. Harness a6dc532d, correcciones ee9a0081/968de91d, fotosStock244882bb y Recetasa2fab2e2; QA2b7ae272 incorporado. [Informe independiente](../factory/0225-qa.md), ADR0144 y specs0225/0226. OpenAI real sobre datos ficticios/local: Stock200 con2líneas8s; Recetas200 con3líneas/yield2 en5s; no compras/recetas guardadas, flags/sesión temporal restaurados. No smoke real del menú/dictado.

Evidencia:9/9browser focal,44/44tools,19/19antiPROD/runner. Tipos/lint/guardia/unit2726 verdes; format corregido f00b093e;4buildsWebpack verdes (TurbopackEPERM). Globalbrowser390PASS62skip sin retries. Neon inicial3674PASS282skip y2suitesPOSFAIL por deadlockDDL; solo esas2repetidas secuencialmente7/7PASS. Nueva receta separa migraciones del resto: auditada y comprobada con guard19/19; no nueva corrida global real. NO afirmar pnpmverifyEXIT0. Preparar publicación con sus gates y migraciones0079/0080/0081 solo cuando owner autorice; PROD/originmain4208714 intactos.

Corrección tras feedback owner40min: main local exige evidencia focal+QA+integración proporcional, sin batería de publicación por defecto. Repetir/ampliar solo por cambio/fallo/riesgo concreto. Pre-push vigente conserva verify, sin bypass; no ocultar duplicación. Factory es piloto operado por coordinador con registro local/locks y tres worktrees temporales, no scheduler autónomo continuo. Siguiente trabajo: tomar otras dos tareas con contratos/scopes disjuntos. Main local avanzó por fast-forward fab728e→9ed5ccc2 y recibe también este cierre documental. Los tres worktrees/rama de worker y QA retirados sin force, registro retired; solo checkout raíz en dev. Dev y main local quedan sincronizados tras el cierre; artefactos/skills ajenos preservados.

## HISTÓRICO — INVESTIGACIÓN PREVIA A ADOPCIÓN FACTORY (2026-10-13)

Owner pidió investigar factory continua: descomposición producto→feature→tarea,2implementadores que toman otra tarea mientras QA revisa, fixes reasignables y un integrador. [Investigación Symphony/casos](../investigacion-software-factory-symphony-2026-10-13.md), enlazada desde [plan pendiente](../plan-piloto-multiagente-2026-10-13.md). Recomienda pool2workers incluyendo fixes,1QA y coordinador/integrador para los4lugares actuales; escalar por cola/WIP/aceptación integrada, no todos ocupados ni cero cuellos prometidos. Entregas/SHA preservados y contexto fresco QA; aceptación tarea/feature/combinación/release separadas. Symphony scheduler candidato para spike después del piloto, no instalar ahora; ejemplo WORKFLOW no copiar(PR/push/rework). Main/live deben separarse si se quieren merges remotos continuos. GPT UI/backend al adoptar política; cierre completo/merge/sincronización Claude siguen condición previa, sin inicio automático.

Fuentes primarias abiertas: SymphonyREADME/SPEC/elixirREADME/WORKFLOW; OpenAIharnessengineering y guía verificación; StrongDMfactory relatoCTO; Cursor self-driving investigación; entrevista original RyanCarson/Untangle(agosto2026). Casos pequeños equipos/solo y prototipos separados de equivalenciaSalesforce: no se certifica calidad/escala por PRs o númeroagentes. Symphonypreview; referencia actual documenta Linear/GitHub/Jira/Asana, límites global/estado y workspaces; QAindependiente/migraciones/WIP son adaptación a comprobar. Solo investigación/enlace/estado propio, formato comprobado al cerrar; sin instalación/agentes/worktrees, números reservados, código/hooks/reglas/permisos, commit/merge/push ni operacionesPROD. Backend/staging Claude preservados. CI última consulta previa main4208714 rojoPOS; no se revalidó salud de producto en esta investigación. Pendiente cierre independiente0222 indicado abajo.

## HISTÓRICO — ENTREGA POS Y MESAS COMO MÓDULOS, SPEC0222 / 0220 PARTE 2b (2026-10-13)

Encargo completo entregado en `dev`, sin push/merge/deploy. Reserva `549ae06`; helper HTTP `369da93`; traslado/enganches `1ff282f`; marcado visual de barra `c4ca538`; e2e `f779b80`. Evidencia y bitácora en [spec0222](../specs/0222-pantallas-pos-mesas-modulos.md). Spec cerrada, pendiente PASS independiente conjunto de Claude.

POS, ticket y Mesas en modules/<id>/ui, páginas fijas borradas y registro UI conectado. URLs nuevas /api/modules/{pos,tables}; PosError adapta helper HTTP genérico del core sin dependencias entre módulos. Pantalla POS conserva locales activos leídos en servidor. Ajustes/Locales reciben paneles como slots React desde ui-registry en sus páginas servidor, sin importar la pantalla servidor en bundles cliente. Mesas conserva cierre bloqueado al guardar, reintento y remonta por instancia. Menú/barra/aviso usan manifiestos; acción checkpass:module-primary con moduleId y barra con marcado/estilos anteriores. Ajustes switches/errores409/paneles genéricos; toggle confirmado emite checkpass:modules-changed; navegación/Locales releen sesión con generaciones para evitar respuestas viejas. Equipo solo permisos del DTO, sin posEnabled; permisos apagados previos se conservan. POS sin Mesas ofrece nombre libre, no consulta mesas ni envía tableId.

PENDING_GPT_DIRS/IMPORTS/SCREENS=[]; PENDING_GPT solo tres filas del servidor: session-view.ts=4, read-surfaces-leak.test.ts=1, session.neon.integration.test.ts=2. Solo se quitaron pendientes resueltos, sin modificar patrones/aserciones/excepciones. Claude debe quitar esas tres filas y posEnabled del servidor después de esta entrega.

Node24.20.0: tipos6paquetes verdes (merchant ejecutado5,485s, otros5caché), merchant0 tras restaurar next-env generado; lint0; guardia --base origin/main115archivos sin aumentos; módulos215aprobados/122omitidos en28archivos aprobados/25omitidos,15,98s. E2e ocho suites afectadas165aprobados, sin fallos/reintentos,59s, workers2. Diez regresiones nuevas cubren Mesas apagado390/1280,409Mesas, montaje de ticket/eventos, Locales/permiso, acción móvil/moduleId/icono y aviso operación7/8días/subruta/core. Asunciones de cobro/cupón/UUID/impresión/versiones/dobles envíos/cierre permanecen. Prettier propio/diffcheck0. CapturasPOS390/1280,409móvil,configuración/ticketescritorio y barra móvil vistas; barra corregida y confirmada. M1 en copia aislada fuerza selector con Mesas apagado:2rojos correctos por nombre libre ausente, restauraciónSHA/bytes idénticos. Selectores nuevos informativo/SVG diferido corregidos tras rojos de selector, sin aflojar pruebas existentes.

Cambios paralelos0223 inicialmente rompieron tipos y dos fronteras; preservados sin editar. Snapshot propio a790599+UI pasó tipos6paquetes,246pruebas y buildMerchantWebpack. Después árbol compartido final tipos/fronteras verdes. Turbopack adicional falló porEPERM de puerto interno incluso con escalación; Webpack snapshot pasó. Logs /tmp/checkpass-0222-*.log y capturas /tmp/checkpass-0222-results. No se habilitó DATABASE_URL ni suitesNeon de producción.

AFUERA: servidor posEnabled (Claude), revisor adversarial conjunto, QAowner en base local/túnel y migración/deploy0079PROD. No se modificaron servidor/API/manifiestos/packages-db/kit/guardias/tooling/PWA/inicio. Cambios0223 y archivos/artefactos ajenos sin seguimiento preservados; next-env generado restaurado. Cierre documental se registra aparte.

## HISTÓRICO — LANDING: PREPARACIÓN DE IMÁGENES, SPEC0221 (2026-10-13)

Reserva58714dd; código2ea68ec; cierre fab728e. Owner autorizó merge local el13/10: main avanzó por fast-forward792d7ed→fab728e (snapshot verificado2ea68ec + cierre solo docs). Sin push. Se volvió a dev; los cinco commits posteriores de Claude0220 hasta a46be31 quedaron en dev porque requieren UI2b y nueva verificación. [Handoff](../handoff-0221-landing-imagenes.md). Sustituye warmUpHTTP del srcset (sin Accept navegador, sin consumo/validación, errores ocultos) por Chromium390/1440 con scroll, complete/naturalWidth/decode y diagnósticoURL/ruta. Sin producto/assets/API/servidor/kit ni aflojar aserciones. Diagnóstico original aislado1/1 en14.3s y17/17 en15.8s: intermitencia anterior no reproducida y no se afirma causa única.

Arreglo17/17 en18.7s sin reintentos, capturas hero móvil/escritorio vistas; M1 intercepta hero404 en copia temporal: rojo correcto loaded:false en preparación, SHA/bytes restaurados. ESLint/Prettier/diffcheck verdes. Verify único en copia limpia2ea68ec con CI=true y base4208714, sin DATABASE_URL: EXIT0, todo verde (tipo14.9s/lint8.1/guardia1.2/formato9/unit43.9/build33.8/e2e277.9/Neon468.7). E2e369aprobados/62omitidos, sin fallos/reintentos, incluye17landing+24equipo; Neon3583aprobados/282omitidos en449archivosaprobados/41omitidos. Unit2677 y cuatro builds verdes. CapturasPOS390/1440 del global vistas. Logs /private/tmp/checkpass-0221-*.log. Snapshot excluye cambios SIN commit de Claude0220. CI remoto sigue rojo4208714 por pathsPOS ya corregidos en dev, sin publicación. Spec cerrada hasta revisión independiente; QA real pendiente.

Reserva inicialmente incorporó tres borrados ya preparados por Claude: commit corregido inmediatamente58714dd, solo docs, eliminaciones restablecidas al staging sin tocar archivos. Commit código se hizo con --only landing.spec.ts y no tomó el staging paralelo.

## HISTÓRICO — ACCESO DEL EQUIPO, SPEC0219 (2026-10-13)

UI implementada en dev: reservaee228d2; precisión de estilos83eeb61; codec80b347; whitelist avisos9e4734a. Ruta /acceso-equipo pública fuera de locale, sin push/merge/deploy. [Handoff](../handoff-0219-acceso-equipo.md) con contrato pendiente y tabla REAL. Spec0219 cerrada hasta PASS independiente/QA. Main remoto4208714 sigue rojo por capturasPOS ya corregidas en devb2482c4, sin publicación.

Reutiliza kit Form/TextField/Button/InlineApiError/Heading/Text y marco del dueño WizardShell. La entrada estilizada antigua page.tsx se trasladó a _components/merchant-entry.tsx (rename84%, mismo importCSS), dueño page.ts reexporta default/generateMetadata; audience opcional Para el equipo, default Para negocios intacto. Sin CSS/paleta/kit nuevos. PinField compone campos6números con inputMode numeric, one-time-code, maxLength6 y pattern. Login POST identifier/pin, GET sesión confirma usuario/permisos; cambio obligatorio con currentPin/newPin/repetición, entrada directa GET user.id y fallback/backoffice. Landing del servidor, navegación de documento nuevo, locks/errores/reintento/contador429 y cuatro avisosURL. Propiedades heredadas/desconocidas se ignoran. PIN en memoria, sin storage/URL/logs. Permisos vacíos o membresía inactiva muestran solo Tu acceso no está activado, sin formularios/botones/redirección.

Límite real: APIactual crea sesión con cero permisos. UI corta el flujo; el rechazo ANTES de cookie y el guard del panel los debe cerrar Claude según contrato escrito0219 (decisión owner ya tomada, no pregunta abierta). No se editó servidor/API/kit/migraciones/host/noindex/DNS, no se afirma autorización protegida solo por UI.

Node24.20.0:24/24 e2e Next/Turbopack con HTTPsimulado en10.2s; login/PINerror/cambio, ceros, coincidencia,429ambos, avisos4, GET/directo/sin sesión/permisos0/destino inválido/retry/dobles envíos/claves heredadas. Cuatro capturas390/1280 vistas en dos rondas; marco sin CSS detectado y corregido por compartir estilos existentes. Primeros rojos de selectores Next annuncer/devtools y runner de otra instalación corregidos, sin aflojar aserciones. M1 fuerza cambio con permisos vacíos: rojo correcto por heading no activado ausente, revertida con SHA/bytes iguales. Tipos/lint/formato/diffcheck/guardia46 sin aumentos y build Merchant final0.

Verify único CI=true en copia temporal sobrec80b347: typecheck/lint/guardia/formato/unit2677/build4/NeonCI3583 verdes. ROJO e2e:350pasan62omitidos15no corrieron(grupo serial),1fallo landing390light por naturalWidth0 (hero30s, reintentos POS60s). Dueño y21tests iniciales de equipo pasaron global. No se modificó landing ni se afirma verify verde. Corrección avisos9e posterior validada con24e2e y build final. Env de copia sin DATABASE_URL; DB solo wrapperCI. Servidores/archivos ajenos preservados. Logs /private/tmp/checkpass-0219-*.log y capturas /private/tmp/checkpass-0219-results.

## HISTÓRICO — MÓDULOS FASE 1, SPEC0217 (2026-10-13)

Encargo387e6fc completado en dev. Specf656cb6; UI6f2272f; corrección CI POSb2482c4; ampliación mecánica documentada6fe87da y esperas de imagen landing8e837c8. Sin merge/push/deploy. [Handoff](../handoff-0217-modulos-fase1-2026-10-13.md) con tabla real y logs. Claude documentó PASS conjunto0216+0217 en9204c30; H2(iconos) corregido3e33436 y verificado después. Spec0217 sigue cerrada hasta confirmaciónH2; QA owner antes de publicar.

Stock/Recetas mudados a modules/<id>/ui con imports corregidos, páginas fijas borradas y registro actualizado; URLs y payloads intactos. Menú usa moduleNavigation+DTO para cualquier integrante y permisos propios, conserva defensa GET antiguo/evento confirmado; iconos genéricos desde exports iconoir en diferido, sin mapa manual. Ajustes lista DTO completo con name/description/requires/suggested, dependencias genéricas y 409 missing/dependents. Equipo muestra labels/descriptions del DTO en selector/listado; módulos apagados deshabilitados, permisos previos conservados al editar otros; reintento GET y copy422, protecciones admin/propios intactas. Listas PENDING_GPT={} y PENDING_GPT_DIRS=[]; sin excepciones nuevas. Fixtures completos y tercer módulo sintético. POS captura portable; landing naturalWidth>0 espera30s con presupuesto120s y umbrales conservados.

Node24.20.0: 48/48 unitarios/frontera; tipos merchant/lint/diffcheck/guardia UI sin aumentos. E2e específicos21/21 en13.2s, notaPOS4/4; ocho capturas390/1280 vistas. Verify único en copia temporal aislada (HEAD0f3cb87+30 archivos propios, sin cambios sin commit de Claude0218): tipos/lint/guardia/formato/unitarios2628/build4/NeonCI3531 verdes. Verify devolvió ROJO por imagen landing desktop con poll5s; corregido y landing Turbopack EN FRÍO4/4 en34.6s. Repetición global normal368pasaron21omitidos18fallos por Merchant caído ERR_CONNECTION_REFUSED. Repetición con servidores nuevos, CI=true workers2 retries0:345pasaron62omitidos0fallos. Gate e2e resuelto; no se afirma verify verde en una sola invocación. Env de copia sin DATABASE_URL; Neon exclusivamente por wrapperCI, sin producción. Servidores originales y trabajo paralelo de Claude/API/kit/paquetes/archivos generados/assets sin seguimiento preservados.

H2 del revisor de Claude: cerrado en código3e33436; Planet declarado solo en módulo sintético se verifica por su SVG en390/1280. Frontera actual13/13 (incluye regla1b nueva deClaude), tipos del árbol actual con0218/lint/guardia38 sin aumentos; e2e afectados18/18 en11.3s y build MerchantTurbopack aisladoexit0. Primer intento de tipos/build del helper falló por never; unknown antes de validar react.forward_ref lo corrigió. Suite global y Neon arriba son anteriores aH2; no se repitieron. Falta confirmar H2 con el revisor.

## HISTÓRICO — LANDING EN FRÍO, NÚMEROS Y CIERRE0215 (2026-10-13)

Owner pidió tres tareas L1 en dev, sin mover archivos mientras Claude trabaja0216. Commit autorizado `f82130b`, solo landing.spec.ts y archivos actuales backoffice/stock y backoffice/recipes + documentación propia. No se tocaron API/módulos backend/kit/paquetes ni el staging ajeno de Claude. Sin merge ni push de estas tareas.

Landing: gotoReady usa DOMContentLoaded, espera heading visible, hojas CSS cargadas y document.fonts.ready. WarmUp también corre con PUBLIC_LANDING_TEST_URL, incluye rutas punto-de-venta/privacy antes faltantes. Mediciones x/límite horizontal/ancho móvil usan expect.poll con los mismos umbrales, imagen naturalWidth>0 conservada, presupuesto de carga en frío explícito (sin sleeps). Prueba real aislada, Next dev --webpack, copia temporal sin .next y sin tocar los servidores abiertos:4/4 landing390/1440 light/dark en34.3s. Artefactos /private/tmp/checkpass-landing-cold-zb7g0xp3/results. No se afirma corrida con Turbopack ni suite completa. Primer arranque bloqueado EPERM se repitió autorizado; filtro inicial no seleccionó tests, corregido. Hubo avisos de hidratación de details en consola del servidor, sin pageerrors y con las cuatro pruebas verdes; no se cambió producto fuera de alcance.

Stock/Recetas: formatAmount español máximo3 decimales para log (cantidades/conteos/precio total), editableAmount sin agrupación para valores recibidos de API/draft en ambos modales, null sigue vacío. No reformatea cada pulsación; payloads siguen punto decimal y cantidades exactas. No existen costes por unidad renderizados en estas pantallas (analítica fuera de0215); no se añadieron métricas. Rendimiento también localizado. Vitest receta13/13 en136ms, incluye ejemplos15/7,5/0,1, null y miles sin agrupación, persistencia del valor. Typecheck merchant/ESLint/Prettier/guardia sin aumentos/diffcheck0. Estado0215 cerrado documentalmente: implementación868f3b3 ya mergeada; ningún pendiente funcional en alcance, QA visual/LLM owner declarado fuera. Sin movimientos de pantallas0216, sin merge/push nuevo.

## HISTÓRICO — RECETAS: DICTADO Y REVISIÓN (2026-10-13)

Spec0215 reservada92c088d; implementación868f3b3 incluye UI de Recetas y ajustes de layout/skeleton Stock. Owner autorizó commit y merge local a main, y confirmó continuar con límite de e2e bloqueado por servidor local existente. Sin push/deploy. Owner pidió Nueva receta → buscar producto del catálogo → multiline micrófono teclado → analizar → ingredientes editables y guardar. RecipesConsole GET recipes, lista guardadas por lineCount y Nueva receta busca productos sin receta; vacío/error/retry/skeleton/toast. Modal reutiliza StaffFormModal de Stock, GET receta + items?status=all; edición existente conserva archivados originales, selector solo activos/archivado presente. POST recipes/:id/draft, yield informado sin dividir nuevamente; null exige cantidad; sourceText y unparsed con reconocimiento. Manual alternativo/volver al texto preservan datos; PUT itemId o newItem+quantity+unit atómico vía API. Validaciones50/duplicados/nombres/unidades/decimales/coma, receta existente vacía elimina con aviso. Bloqueo de doble envío/cierre en vuelo, error conserva borrador, éxito cierra y recarga sin repetir escritura. Sin costes/márgenes ni servidor/API/kit/migraciones. Mantiene layout anterior de Stock/Catálogo.

Node24: Vitest12/12 en183ms con config merchant (primer filtro --project merchant inválido, corregido). Typecheck final0 (test union itemId/newItem corregido), ESLint/Prettier/guardia sin aumentos/diffcheck0. Al solicitar merge se ejecutó verify: tipos/lint/guardia/build pasan; formato caché local .impeccable/hook.cache.json corregido y format:check global repetido0. E2e no arrancó por next dev Consumer ya activo, PID30027; servidor preservado. Neon via wrapper contra CI en curso al registrar este cierre; no producción. Owner autorizó explícitamente merge pese al límite de e2e. Skills/assets y next-env generados ajenos excluidos del commit. Revisión visual/LLM sigue a cargo owner.

## HISTÓRICO — STOCK REAL: COMPRAS, DICTADO Y CONTEOS (2026-10-12)

Ajuste visual local posterior, sin commit: Stock reutiliza ModuleHeader de Catálogo/Equipo y contenedor brand-page/catalog-page (980px centrado, padding inferior y fondo del catálogo), conservando padding exterior merchant-shell (24px móvil/48px desde700px). Registrar stock queda en fila propia debajo del encabezado, separación24px y tabla alineada al contenedor. Sin Chrome por preferencia owner; revisión visual pendiente en dev-business. No cambios de API/kit ni publicación.

Skeleton local posterior: reemplaza texto visible de carga por StockLogSkeleton, cinco filas con fecha y dos líneas de resumen, encabezados y espacios iguales a la tabla. Reutiliza Skeleton/SkeletonScreen existentes; carga anunciada solo a lectores de pantalla. Se usa también al recargar tras guardar/reintentar; estados error/vacío intactos. Tipos/lint/formato/guardia UI sin aumentos/diffcheck0. Sin Chrome ni commit.

Recetas: ajuste visual local sin commit, mismo contenedor brand-page/catalog-page y ModuleHeader que Stock, centrado980px, padding exterior compartido y gap24px. Contenido provisional y permiso catalog conservados; sin endpoints nuevos. Tipos/lint/formato/guardia/diffcheck0; revisión visual a cargo owner, sin Chrome.

Spec0213 reserva `2016ff3`, implementación `8ee7a91` en dev. Owner aprobó adaptar Stock a contratos0210/0212 y quitar Foto/archivo. Log GET movements?limit=200, filas individuales fecha createdAt y compra/conteo+insumo+cantidad+precio total opcional. Sesión aporta timezone/currency; sin métricas de Analítica. Nuevo stock: Audio default/Manual; insumo activo o nuevo, cantidad/unidad separadas, totalCost opcional y coma decimal. Dictado trim1..2000→POST entries/draft, revisión editable real con sourceText, unparsed y reconocimiento de pendientes; nada persiste hasta POST entries. Sin ejemplos falsos. Conteo solo manual, un insumo por guardado, cantidad≥0, kg/l convertidos exactamente a base antes de POST adjustments; sin precio. Load/error/retry, locks y cierre deshabilitado en vuelo, errores conservan borrador; éxito cierra y recarga log. Helper StaffFormModal incluye textarea/select y tabindex0 en foco. API/servidor/kit/Recetas/migraciones intactos. Sin merge/push/deploy.

Node24: tipo merchant final0 (primer intento Alert import faltante, corregido), ESLint, formato, guardia --base HEAD y diffcheck0. 22 aserciones Node de unidades/cantidades/validaciones/payloads0. No Chrome/e2e/LLM/escritura real por preferencia owner; revisa en dev-business. Tabla real en spec0213. No verify global ni producción. StockTypes frontend sin importar módulos del servidor. Skills/config/assets y next-env generados ajenos preservados. Ajustes locales anteriores de Audio/Manual/multiline quedan incluidos en implementación final.

## HISTÓRICO — ACTIVACIÓN REAL STOCK/RECETAS Y MENÚ (2026-10-12)

Ajuste visual local pendiente de commit: Audio usa TextAreaField con «Usa el micrófono en tu teclado» y Analizar. Sin endpoint, muestra etapa editable con dos ítems explícitamente de ejemplo (no extraídos del texto), Guardar/Descartar y Volver al texto conservando transcripción. Manual y revisión mantienen borradores separados. Guardar sigue solo estado mock. Incluye orden previo Audio/Foto o archivo/Manual pendiente. Tipos merchant/ESLint/formato/guardia/diffcheck0; sin Chrome/tests por owner.

Commit `d1a213b` en dev. Contrato0210 revisado, API implementada. Toggles ya hacían GET /api/modules + PUT /api/modules/:id; ahora publican estado completo confirmado por GET/PUT y menú consulta GET sin caché (owner/catalog). Stock y Recetas se filtran por enabled tanto desktop/móvil como delegados. Sin estado real aparecen ocultos; GET anterior no pisa un evento confirmado posterior. Fallo PUT conserva estado y no publica cambio. Dependencias Recetas→Stock intactas. Contenido Stock/Recetas sigue prototipo, no se conectó; no cambios API/servidor/kit/migraciones. Sin merge/push/deploy.

Node24 tipos merchant/ESLint/Prettier/guardia --base HEAD/diffcheck0; 9 aserciones Node de visibilidad/evento0. Sin Chrome/e2e/verify por preferencia owner, quien comprueba en dev-business. Activación contra servidor real autenticado pendiente del owner; no se escribieron datos vía herramientas. Spec0211 documenta extensión. Ajuste L0 anterior Audio/Foto o archivo/Manual sigue local pendiente de commit; archivos next-env/config/assets ajenos preservados.

## HISTÓRICO — MENÚ STOCK/RECETAS Y REGISTRO VISUAL STOCK, L1 (2026-10-12)

Ajuste L0 local pendiente de commit: orden Audio / Foto o archivo / Manual; Audio seleccionado por defecto. Formato, ESLint y diffcheck0. Sin Chrome/tests por owner.

Propuesta de entradas `f4226fc`: Nuevo stock/Ajustar stock abren StockInputModal reutilizando StaffFormModal de importación catálogo según captura del owner. Tres opciones Foto o archivo/Por voz/Escribir, área archivo con FileButton y lista local, voz visual con ejemplo, texto filas nombre/cantidad/precio y añadir/quitar ítem. IA/grabación deshabilitadas y descritas como propuesta; no subidas/audio/API. Texto añade solo resumen mock a la tabla. Node24 tipos/lint/formato/guardia/diffcheck0. Sin Chrome/tests por owner; revisión visual y significado precio/ajustes aún a definir, no implementación de negocio.

Último ajuste `d729aea`: Registrar stock abre selector Dialog del kit, Nuevo stock primero y Ajustar stock segundo. Botones secondary/iconos Package y EditPencil, gap3 y cierre circular Xmark idéntico a acciones POS. Opciones abren modal de resumen, inline retirado; mock sin API/persistencia. Typecheck/lint/formato/guardia/diffcheck0, sin Chrome/tests por owner.

Commit `08e274c` en dev. Owner pidió links Stock y Recetas (debajo de Stock) visibles como activados, sin consultar API de módulos. Ambos en Mi negocio, desktop y menú móvil, permiso catalog existente y guardas de página equivalentes a Catálogo. Stock muestra tabla/log fecha de creación y resumen, tres registros ficticios y Añadir Stock. Alta provisional inline añade resumen solo al estado React; recargar restaura muestras. Aviso visible de muestra/sin persistencia. Recetas placeholder pendiente de diseño del owner. UI solo, no backend/kit/migraciones. Sin merge/push/deploy.

Owner pidió revisar personalmente y no comprobar en Chrome. No se ejecutó QA visual ni pruebas de navegador; harness/tests preparados retirados. Node24 typecheck merchant, ESLint archivos, guardia --base HEAD y diffcheck0, formato aplicado. No verify global por L1. Revisión visual pendiente del owner en dev-business /backoffice/stock. Trabajo paralelo Claude y next-env generados preservados.

## HISTÓRICO — CONFIGURACIÓN COMPACTA CON TOGGLES, L1 (2026-10-12)

Owner pidió cards Stock/Recetas en Ajustes y clasificó L1; después pidió compactar y reemplazar botones por toggles como impresión. Reserva previa0211 `7791399`, cards `327d0a7`, diseño compacto/toggles `65878d1` en dev. Un panel con filas POS/Stock/Recetas, descripción conservada y estado + Switch del kit; impresión aparte. Recetas requiere Stock y Stock no se apaga con Recetas activo; carga/reintento/error/lock y estados confirmados vía contrato0210. UI solo, sin API/servidor/kit/migraciones. No merge/push/deploy. Backend0210 y base local en trabajo paralelo de Claude, no verificados por GPT.

Node24: typecheck merchant, ESLint tocados, formato, guardia --base HEAD y diffcheck0. Tres pruebas Chromium HTTPsimulado verdes, última corrida3/3 en4.7s; capturas390/1280 vistas sin overflow. Primera ejecución bloqueada listenEPERM, repetida con autorización. Sin verify global/revisor/subagentes por L1(ADR0129). SelectoresPOS ajustados mecánicamente, suitePOS no ejecutada; fixtureticket actualizado para nuevoGET. Evidencia `/private/tmp/checkpass-0211-results/`. Cambios paralelos db/modules y skills/config/assets preservados, no mezclados.

## HISTÓRICO — NOTA POS0209 IMPLEMENTADA EN DEV (2026-10-12)

Owner pidió nota de orden en pasos2/3 del POS, contrato0169 ya en main y base local migrada. Reserva `73e203a`, UI `dbeb469`, fixture anterior actualizado `ae9a5d1`. Ajuste posterior del owner `5faeed5`: padding inferior del footer18px + safe-area (antes10px), compartido con mostrador. CSS compilado medido en Chromium390/1280:18px, posición fixed/sticky conservada; formato/guardia/diffcheck0. Sin nuevas suites para este ajuste L0. Ajuste L0 `a067159`: en órdenes creadas el botón Nota pasa a la fila Editar/Pedido (ambas pestañas), retirado del footer; wizard intacto. Sin tests ni nuevas capturas por instrucción explícita del owner; formato/diffcheck0. Capturas anteriores preceden este movimiento. Ajuste L0 más reciente `b49bdcb` reemplaza ubicación anterior: menú circular48px inferior junto a CTA concentra QR/Nota/Imprimir/Anular; menú superior y nota junto a tabs retirados. Nota presente muestra borde verde/distintivo documento; sin contenido de nota en pedido. Editar limpio mantiene footer para acceder a acciones, Guardar cambios deshabilitado hasta cambios. Última corrección L0 `35c04a3`: wizard2/3 vuelve al icono Notes directo al modal; órdenes creadas conservan el menú MoreVert. Sin tests por owner, formato/diffcheck0. Bloqueos anteriores conservados. Sin tests/capturas/verify por owner; formato/diffcheck0 y revisión estática. E2E anteriores conservan selectores de los accesos viejos y deberán adaptarse cuando se retome verificación, no ejecutados en L0. Último L0 `327a4bb`: distintivo Notes superpuesto retirado del menú circular, borde y aria de nota conservados; wizard intacto. Sin tests, formato/diffcheck0. Último L0 `b5a092c` ordena menú: Nota, Escanear QR, Imprimir, Anular; bloqueos/etiquetas intactos. Formato/diffcheck0, sin tests. Último L0 `06e0f0f`: toast tras guardado exitoso de nota editada «Nota actualizada»/«Nota eliminada»; otros cambios siguen «Pedido actualizado». Aplicar borrador/fallos no anuncian persistencia. Formato/diffcheck0, sin tests. Último L0 `75a27e0`: selección de producto en búsqueda de orden abierta limpia query; +unidad también limpia y emite Producto añadido. Prop opcional DetailedSale activada solo en orden creada; wizard/mostrador intactos. Formato/diffcheck0, sin tests. Último L0 `5f67add` reemplaza guardado de nota en orden creada: Aplicar nota hace PUT inmediato con snapshot de items/contexto guardados, conserva borrador de productos y actualiza baseline/version. Éxito cierra modal y muestra toast; fallo conserva texto/modal y muestra error. Busy impide cierre/duplicados. Wizard conserva nota local hasta crear orden. Formato/diffcheck0, sin tests por owner. Último ajuste `541be5f`: guardado de nota optimista, modal cierra/toast y caché privada se actualizan antes de esperar PUT; servidor confirma version real. Éxito reemplaza snapshot; fallo revierte caché/nota, retira toast y reabre modal con texto pendiente. Epoch protege sesión y bloqueo conserva versión para otras escrituras. Wizard/productos intactos. Tipos merchant/formato/diffcheck0, sin tests/capturas. Corregido reset anterior de toast false→null en descarte detectado por tsc. Corrección L0 `d9002a7`: claves toast producto/actualización prefijadas product-added/order-updated, elimina colisión de contadores numéricos reportada por owner al editar. Formato/diffcheck0, sin tests. Checkout dev; main intacto para esta tarea, sin push/deploy. Skills/config/assets ajenos sin seguimiento preservados.

Botón circular Iconoir junto a Revisar pedido y Guardar pedido, modal del kit Cancelar/Aplicar nota, borrador conservado entre pasos. Orden abierta permite edición, cerrada/anulada lectura. Campo note en DTO; POST note/null, PUT omite si intacta y null borra. Trim/límite1000 y saltos internos; cambio de mesa conserva nota pendiente; conflicto compara nota local/vigente. No se imprime. API/servidor/kit/migraciones sin cambios.

Node24, Chromium5/5 nuevos con HTTP simulado, captura390/1280 vistas y sin overflow. Verify UNA corrida en detached `/private/tmp/checkpass-pos-note-0209`: tipos/lint/guardia/formato/unit/build/relatedmerchant verdes; e2e326pass/62skipped/1fail por expectativa antigua del POST sin note:null. Corregido test y repetido solo gatee2e:327pass/62skipped, salida0, sin flaky. Unit2530pass/1091skipped; relatedmerchant32pass. No producción. Tabla real y límites en docs/qa/0209/README.md, logs `/private/tmp/0209-verify.log` y `/private/tmp/0209-e2e-final.log`. No se afirma que la corrida original fue verde.

Reviewer independiente ship para extensión acotada; documenter confirma compatibilidad y preserva sistema. Spec0209 implementada. Pendiente: owner probar en dev; merge/publicación solamente cuando lo solicite. Servidores habituales preservados; worktree temporal detached queda para evidencia.

## HISTÓRICO — WALLET0208 COMMITEADA Y MERGE LOCAL A MAIN (2026-10-12)

Owner aprobó diseño y pidió merge. UI, mocks y evidencia en `04159ea6f99dc86c722afee2b67be12dbe0820f1`; preparación de imágenes lazy del e2e público en `0ddf72ae7702f35d10d3b6fe28ca2d98439bb563`. Main local avanzó por fast-forward `7f2d757` → `0ddf72a`; SHA main/dev confirmado idéntico. El cierre documental se incorpora con un segundo FF. Sin push ni deploy. Checkout habitual permanece dev y sus servidores no se apagaron ni cambiaron.

Verify final verde: `CI=true pnpm verify --base main` en `/private/tmp/checkpass-wallet-0208-merge`, dependencias319 offline y entornos locales copiados sin imprimir valores. Tipos/lint/guardia/formato/unit/build/e2e/Neon relacionados todos0; tabla real en `docs/qa/0208/README.md`, log `/private/tmp/0208-merge-verify-ci.log`. Unit2530pasaron/1091saltados; e2e322pasaron/62saltados (config CI), sin errores/flaky. Neon relacionado merchant7/7 y consumer19/19 vía wrapper protegido, no producción. El fallo anterior de copy ya estaba corregido; se activaron imágenes lazy antes de medirlas, sin cambiar la landing ni sus aserciones. Diagnóstico y prueba específica1/1 confirmados. Intentos anteriores ROJO quedan documentados; no se confunden con el gate final verde.

Entrada /wallet sin sesión, enroll sin/con sesión/ya miembro/no disponible y ready/install con Club cotidiano+paletaA y NunitoSans local. Google/Apple, consentimiento explícito, programId/loc, manifest, ofertas y avisos conservados. Wallet interna/API/servidor/paquetes/kit sin cambios. Revisión visual owner y reviewer independiente aprobadas; OAuth/instalación en teléfono físico no probados por el owner. Spec0208 implementada, INDEX cerrado a merge local.

Pendiente: publicación solo si la solicita el owner. Main ya incluía el trabajo de Claude0073, sin migrar PROD según su estado: coordinar antes de un eventual push, no migrado por GPT. Worktree de verificación queda detached; mock58407 y servidores3200/3201 preservados. Skills/config/assets ajenos sin seguimiento no entraron al commit.

## HISTÓRICO — ENTRADA WALLET0208 APLICADA LOCAL Y APROBADA (2026-10-12)

Owner aprobó mock0207 y pidió aplicarlo. Implementada entrada sin sesión en /wallet, inscripción sin/con sesión/ya miembro/no disponible y confirmación/install en enroll/ready. Club cotidiano+paletaA, NunitoSans local con OFL, marcaC real, logo/nombre reales o inicial. URLsprograma/local y ordenGoogle/Apple, POST201/409/401/errores/red, manifest y notificaciones conservados. CSS module aislado; wallet interna/API/servidor/paquetes/kit sin cambios. Reserva0208 `3b3af23` en dev; implementación SIN commit/merge/push/deploy. Owner dice «está perfecto» visualmente; no puede probarlocal.

Checks específicos Node24: typecheck, ESLint y formato consumer/e2e0; unit14/14; Chromium11/11 con datos/HTTP simulados y1/1 posterior para limpiar error al appinstalled. Capturas seis estados390/1440 y overflow320/360/390/430/1440; Nextreal3200 /wallet200, fontNunito y sin erroresJS. Revisor independiente fuente/fondo/composición/truthpass, fixdocumental resuelto, verdictpassship. PRODUCT/DESIGN/sidecar actualizados a páginas reales deentrada y excepciones proveedores. Evidencia `docs/qa/0208/README.md` y capturas.

Verify UNA corrida, ROJO: tipos/lint/guard/build0; formato JSONs deImpeccable generados; unit2529pass+1fail y NeonCI3375pass+1fail (mismo test merchantwelcomeUI por dosstringscopy anteriores); e2egeneral no inició porque otroNextdev del mismoconsumer sigue en3200. Actualizadas dosaserciones mecánicas dewelcomeUI según§6;7/7posteriorpasó y no se quitó protección de premio. Formato artefactos normalizado; hookcache puede regenerarse otra vez, no esUI. Logs `/private/tmp/0208-verify.log` y `/private/tmp/0208-format-final.log`. No se repitió verifyglobal; no afirmar verdecompleto. Neon solo vía tools/neon-test.sh con URLsCI; no producción. Next-env generados se restauran y servidoresowner sepreservan.

Confirmación final: next-env generados restaurados; `pnpm format:check` posterior0 y diffcheck0. No se repitió la suite global; los resultadosROJO de la tabla original se conservan como ejecutados.

Pendiente antes depublicar: cerrar e2egeneral en ambiente sin colisiónNext, guardarimplementación, paseamain ypush solo solicitado porowner. No cambios visuales necesarios. Spec0208 registra UI implementada con e2egeneralpendiente; no marcado cierrecompleto. Mock58407 y server3200 preservados. Skills/config/assets paralelos no mezclados.

## HISTÓRICO — MOCKS WALLET, CLUB COTIDIANO + PALETA A (2026-10-12)

Owner pidió rediseño, eligió concepto2 Club cotidiano y paletaA (verdeprofundo/coral/blanco), luego mocksHTML/CSS para ajustar copy y espacios. Spec0207 reservada en dev con commit `cf1247e`; implementación está local SIN commit, sin merge/push/deploy. Prototipo autónomo `docs/qa/0207/mocks/`; servidor Python puerto58407, http://127.0.0.1:58407/. No toca rutas reales, OAuth, API, servidor, paquetes, kit ni producción.

Cuatro pantallas: login puro, inscripción sin sesión, inscripción con sesión y confirmación/instalación iPhone/Android. Comparar y vistaindividual; controles nombre/comercio/ancho/titular/margen/separación y textos editables. Acciones solo simuladas, datos ficticios; ajustes no persisten al recargar. Referencia visual y PRODUCT documentadas; DESIGN y sidecar se documentan con alcance de prototipo, no reemplazan aún la app.

Node24, Chromium salida0: cuatro estados a320/360/390/430, nueve capturas finales (incluye comparación1440), sin overflow/erroresJS/solicitudesAPI. Controles y navegación comprobados; evidencia `docs/qa/0207/captures/checks.json`, README y capturas. Fuente NunitoSans autohospedada con OFL; contrastes principales≥4.5, iconoverde/coral4.40. Revisor independiente pidió fuente distinta del sistema; corregido y verdictpass ship para ese hallazgo, acciones/saltos preservados. Hook darkglow corregido, scan posterior limpio, sin supresiones. SintaxisJS/diffcheck0. Sin verify global ni suites de app para mock documental.

Stop posterior: icon-tile-stack triado como sello de confirmación intencional del concepto2 elegido por owner. Excepción persistida vía hooks ignore-value únicamente para esta regla en `docs/qa/0207/mocks/index.html`, config `.impeccable/config.json` del repo. Sin cambios visuales ni nuevas capturas necesarias; README actualizado.

Owner revisa y ajusta en navegador. App real sigue igual. Otros untracked de skills/config/assets preservados. Main no se cambia.

## HISTÓRICO — IMPRESIÓN Y AJUSTES POS APROBADOS, MERGE LOCAL A MAIN (2026-10-11)

Owner probó los ajustes y autorizó commit + merge de todos los cambios, sin tests
adicionales. Commit L0 `b6a04c7e52c672d23ede5e45f950e4a8cb2bb9ee`: pie de creación/orden abierta al fondo en escritorio,
banner de prueba en POS solo con 7 días o menos. Main local avanzó por fast-forward
f42460b → b6a04c7, incorporando también UI0206 da9c924 y cierre022c681.
SHA main/dev confirmado. Sin push ni deploy; checkout habitual sigue dev y
servidores locales preservados. Cierre documental se incorpora con otro FF.

Checks ya ejecutados para L0: typecheck, ESLint, formato, guardia UI y diffcheck
salida0. Revisión visual/funcional del owner aprobada. Sin suites adicionales ni
verify, por instrucción explícita. UI0206 conserva su evidencia previa121/121 e2e
específicos con rutas simuladas y gates0; no se presenta como corrida nueva.
Migración0072 ya aplicada en Docker local (73 migraciones en total); columna
printing_enabled NOT NULL DEFAULT false y lectura del rol de app verificadas.
Producción no migrada por GPT; publicación y migración a PROD pendientes del owner/Claude.

Trabajos de UI y documentación guardados; configuración/skills/assets locales
sin seguimiento preservados y excluidos. API, servidor, packages y kit intactos.
Próximo paso: publicación solamente si el owner la solicita.

## HISTÓRICO — PIE DEL POS AL FONDO EN ESCRITORIO, LOCAL (2026-10-11)

Ajuste L0 solicitado con dos capturas: en escritorio Tomar pedido y el pie de
la orden abierta quedaban justo tras el contenido. Main del workspace, wrapper
y editor ahora crecen como columna flex; el pie usa mt-auto y sticky bottom-0
en md. Móvil conserva sus clases existentes. Aplicado en pos-console.tsx y
pos-editor.tsx, sin commit ni merge/push. Revisión visual del owner pendiente.
Node24: typecheck, ESLint merchant, formato, guardia UI y diffcheck en0. Sin suites
ni capturas nuevas para este ajuste rápido. No se tocaron API, servidor, kit o CSS.

UI0206 ya commiteada en dev (da9c924, cierre022c681) y e2e121/121 previos al ajuste
L0. Migración0072 aplicada después a Docker local, columna printing_enabled
NOT NULL DEFAULT false confirmada; error503 de Ajustes corregido en ambiente.
Banner de prueba en POS (últimos7 días) sigue pendiente de commit junto con
este ajuste; no incluir otros archivos sin seguimiento ni trabajo de Claude.

## HISTÓRICO — 0206 IMPRESIÓN POR NEGOCIO, UI COMMITEADA EN DEV (2026-10-11)

Corrección del ambiente local (2026-10-11): 503 en Ajustes por SQLSTATE42703.
Confirmado por logs y information_schema: faltaba printing_enabled. Ejecutado
el migrador db:local:migrate con URL fija de Docker local: salida0,73 migraciones.
Columna printing_enabled verificada NOT NULL DEFAULT false; lectura de los tres
campos con neondb_owner en0. No se modificó código ni se migró producción.
El owner debe recargar Ajustes para renovar la lectura que había fallado.

Commit UI `da9c924a8099ee58b28a691c7266a8b1d18d07fc`. API de Claude `1106798` ya en dev. Owner pidió solo pantalla,
commit en dev sin push ni merge. No se tocaron API, servidor, packages, kit,
printing/** ni tooling. DTO frontend de tres booleanos compartido entre Ajustes
y POS en settings/ticket-settings-types.ts.

Imprimir tickets controla printingEnabled guardado; apagado oculta nombre del
comercio/mesa sin borrar sus valores. PUT siempre manda los tres booleanos. Carga
y errores visibles aun apagado; mientras carga, el interruptor está deshabilitado.
POS toma el ajuste de pos-printing.ts y oculta Imprimir en orden abierta y detalle
cuando false o pendiente. Validación exige los tres campos, sin defaults inventados;
print() también respeta la regla. Fixtures POS, mesas e impresión con enabled=true
para preservar sus recorridos; casos nuevos prueban false/true y PUT completo.

Node24, salida0: typecheck merchant, ESLint merchant + cuatro e2e, Prettier merchant
y e2e, guardia UI y diffcheck. Chromium 121/121 específicos de pos.spec,
pos-printing.spec, ticket-settings.spec y tables.spec (50.6s). Rutas simuladas con
page.route; sin Neon ni suite completa. Reporte /private/tmp/0206-report/index.html.
CI main verde4c40a6a consultado. Spec0206 e INDEX actualizados con evidencia y SHA.
Pendiente QA del owner en local y pase a live con migración0072 (zona Claude).

Ajuste previo del banner de prueba en POS (solo últimos7 días) sigue aplicado
localmente y SIN commit en trial-notice.tsx; no se mezcló en este commit de0206.
Se conserva en el histórico siguiente. Main mantiene cierre9496e0b y no incorpora
API/UI0206. Sin merge, push ni deploy, según instrucción.

## HISTÓRICO — AVISO DE PRUEBA EN POS SOLO ÚLTIMOS 7 DÍAS, LOCAL (2026-10-11)

Ajuste L0 solicitado por el owner: TrialNotice se oculta en /backoffice/pos y sus
subrutas cuando trialDaysLeft > 7; aparece con 7 días o menos. Otras pantallas
conservan comportamiento. Usa el dato de sesión existente, sin recalcular fechas.
Aplicado localmente en dev, sin commit, merge ni push. Revisión del owner pendiente.
Node24: typecheck y ESLint merchant, formato del archivo, guardia UI y diffcheck en 0.
Sin suites ni navegador; cambios paralelos de Claude en tickets/DB preservados.
Pestañas y trabajos anteriores ya quedaron en main/dev con el cierre 9496e0b.

## HISTÓRICO — PESTAÑAS DE ACCESO APROBADAS Y MERGE LOCAL A MAIN (2026-10-11)

Owner aprobó las pestañas en local («funciona perfecto») y autorizó commit +
merge de todo a main. Commit UI `7797b242f19fd9afdc11361fef7542d117ab8a07`.
Main ya incorporaba los trabajos anteriores (a480692, incluido dev:link de
Claude); fast-forward local a480692 → 7797b24 realizado y SHA confirmado.
Sin push ni deploy. Checkout habitual sigue dev; servidores 3200/3201 preservados.

Tabs del kit arriba del formulario: Iniciar sesión / Crear un negocio, opción
activa marcada y accesos inferiores retirados. Alternar actualiza la URL con
signup=1 para registro y sin signup para login; conserva otras queries/hash y el
estado interno de Next. Crear negocio se deshabilita mientras se pide el código.
No se tocaron API, servidor, paquetes, kit, estilos, tooling ni sesión.

Node24: typecheck, ESLint merchant y guardia UI en 0; formato de cuatro archivos y
diffcheck en 0. Owner revisó funcionamiento en local. Sin tests nuevos ni suites
para este L0. Al preparar el merge se creó checkout temporal y se instalaron
319 dependencias offline; plan de verify leído, pero la ejecución NO llegó a
iniciarse. Owner indicó expresamente no ejecutar suite completa para este merge.
Los e2e18/18 y unit4/4 de 0205 previos al ajuste permanecen como evidencia previa,
no como una nueva corrida. No se omitió ningún hook de push: no hubo push.

Spec0205 e INDEX actualizados con aprobación y merge. Los archivos sin seguimiento
de Impeccable/configuración/assets se conservaron y no entraron en commits.
Estado documental se integra con un segundo fast-forward a main al cerrar.
Próximo paso: publicación solo cuando el owner la pida; no reiniciar servidores.

## HISTÓRICO — 0205 LOGIN POR DEFECTO EN MERCHANT, COMMITEADO EN DEV (2026-10-11)

Commit UI `0af3d6a38a1d538fb631b91dfda32935c725998c`, reserva local `b8201e3`. Sin push ni merge.
Owner pidió que business.checkpass.club abra login; registro solo por enlace
explícito. Raíz y /es/business/onboarding abren login sin sesión por defecto.
`?signup=1` abre alta desde la raíz o desde onboarding; otros valores/duplicados
no habilitan registro. Crear un negocio cambia manualmente al alta, e Iniciar
sesión regresa al login. Sesión válida sigue al panel y rebotes ?e= conservan
prioridad. Metadata acompaña la entrada pedida. Los CTA compartidos de alta de
la web pública llevan signup=1, preservando MERCHANT_ONBOARDING_URL y sus queries.

Verificación real Node 24.20.0, salida 0: typecheck merchant/public, ESLint ambos
paquetes y e2e, Prettier ambos paquetes/archivos, guardia UI y diffcheck. E2E18/18
(entrada8, login código7, alta3), unit existentes4/4 (entry-billing y onboarding-flow).
Reporte `/private/tmp/0205-report/index.html`. URL de alta con default y override
comprobado: signup=1 y campaign=qa preservados. CI main verde4c40a6a consultado.
Sin API, servidor, paquetes, kit, CSS ni tooling tocados. Sin base de producción
para pruebas; no se corrió verify global (queda para el pase conjunto a live).

Spec0205 e INDEX cerrados con evidencia. Revisión local del owner pendiente.
Merchant local en http://localhost:3101 sirve el cambio. Acumulado en dev: login
con código0202 (`c59ef50`), vencimiento solo en wizard0195 (`0f44916`) y esta entrada.
Main no incorpora esas UIs nuevas; publicación conjunta a cargo del owner.

## HISTÓRICO — 0195 VENCIMIENTO SOLO EN WIZARD, COMMITEADO EN DEV (2026-10-11)

Commit UI `0f449164e14030688124526e90decbebf1b02498`. Alcance final del owner: solo configurar en el paso
«Unidades» (puntos) / «Sello y objetivo» (sellos), tanto creación como edición.
Sin información de vencimiento en la vista del programa, inscripción, wallet ni
app del cliente. U5–U6 retiradas, no se presentan como implementadas. API de
Claude y migración ya en PROD según el owner. Sin push ni merge; habrá un solo
push del owner con todo. No se tocaron API, servidor, packages, kit ni tooling.

Regla apagada por defecto; selector 3/6/9/12 con 6 al activar. Activar/acortar
confirma «Empieza a contar hoy para todos tus clientes». Alargar/apagar directo.
Edición guarda por ruta propia al cambiar; creación retiene borrador y ejecuta
PUT /expiry después de activar el programa. Fallo parcial muestra error y vuelve
al paso para reintentar solo la regla, sin duplicar creación. State_changed relee
el programa, conserva borrador del editor y muestra mensaje del servidor.
Permisos y errores 401/403 mantienen el manejo existente; el GET actual requiere
loyalty. Ningún cambio al tour ni a la ruta/formulario del programa.

Node 24.20.0, salida 0: typecheck merchant y consumer, ESLint ambos paquetes +
e2e, Prettier ambos paquetes + docs, guardia UI y diffcheck. CI main verde
4c40a6a consultado. E2E Chromium 30/30: diez nuevos (incluyen cuatro capturas) y
veinte regresiones de estados/validación/CSS. Rutas simuladas con page.route;
sin pruebas contra producción. [Capturas 390 y evidencia](../qa/0195/README.md).
Reporte local `/private/tmp/0195-report/index.html`. Claro por defecto;
oscuro inspeccionado forzando data-theme, con el aspecto existente del kit.

PARQUEADO: U1–U3 en PROD, cerradas por el owner; U4 hecha con SHA; U5–U6 retiradas.
Spec 0195 registra alcance actualizado y SHA al pie. Pendiente revisión local
del owner. Login por código 0202 ya está en dev (`c59ef50`, cierre `4b7eab4`),
con QA en PWA iPhone todavía pendiente. Main no incorpora estas dos UIs nuevas.

## HISTÓRICO — 0202 LOGIN DEL OWNER CON CÓDIGO, UI COMMITEADA EN DEV (2026-10-11)

Commit UI `c59ef5047103365277af02550ee7e23b8bbfea82`. Pedido del owner: solo pantalla; sin push ni merge.
API de Claude `2e2e0dc` ya disponible. No se tocaron `src/app/api/`, `src/server/`,
el kit ni tooling; pendientes ajenos preservados.

Login por email → código de seis números, `inputMode="numeric"`,
`autoComplete="one-time-code"`, `maxLength=6` y patrón de seis dígitos.
`MagicLinkState` y etapa `magic-link` reemplazadas por `LoginCodeState`/`login-code`.
Verify con navegación completa a destination; errores del servidor; reenvío al
mismo email con confirmación y campo limpio; bloqueo diario sin reintento ni
reenvío; usar otro email vuelve atrás. Alta y verificación conservan sus enlaces.
Contrato de errores UI ampliado en `_lib/contracts.ts`.

Verificación real, Node 24.20.0: typecheck merchant, ESLint paquete merchant + e2e,
Prettier paquete merchant + archivos nuevos, guardia UI y diffcheck en 0.
E2E Chromium 10/10: siete de login (incluyen dos de capturas) y tres regresiones
de alta. [Evidencia y cuatro capturas 390 claro/oscuro](../qa/0202/README.md).
Prueba de navegador con API real, base Docker local y cuenta sembrada:
pedido 200, código en asunto de `email_console`, verify 200, navegación a
`/backoffice` y sesión persistida (`authenticated: true`). Sin correo real ni
base de producción. Merchant local queda en http://localhost:3101 para revisión;
log `/private/tmp/0202-merchant-server.log` y reporte `/private/tmp/0202-report/index.html`.

INDEX 0202: «API + UI implementadas; QA del owner pendiente».
Pendiente: owner prueba PWA instalada en iPhone y sugerencia real del código de
Mail. El oscuro se inspeccionó con `data-theme="dark"`; layout conserva claro
por defecto. Main local tenía el merge previo documentado en `035fd66`; esta UI
nueva está solo en dev. No hubo push, merge ni deploy.

## HISTÓRICO — 0204 FIDELIZACIÓN FUNCIONAL Y COPY LOCAL (2026-10-11)

Commit4469753, reservae5055c2. Owner pidió auditoría de /programa-de-fidelizacion para lograr lo mismo que marketing: estructura, visual y copy Funcional. Aplicada localmente, QA owner pendiente; sin autorización para publicar.

Hero «Puntos o sellos. Motivos para volver.». Secuencia QR/compra acreditada/canje confirmado por equipo; transición e historial compactos; reglas por modalidad y ejemplos3/6 y30 puntos preservados. Previsión ahora compara$30 de consumo con$3 precio de venta del premio, sin «quedan $27» ni sugerir ganancia. FAQ conserva alcance sin costos/margen. Habituales en Mostrador; programas, saldos y registros separados; cashback Próximamente. No cambia backend, funciones ni condiciones. CSS exclusivo program-page, sin stylesheet viejo; guía/PRODUCT/sidecar actualizados, POS queda pendiente.

Node24: typecheck público, ESLint específico, formato, diffcheck y números0. Build público0; landing17/17 en13.1s (home, negocios, marketing preservadas y4 nuevos casos de fidelización). Capturas1440/390 claro/oscuro,320/768 claro vistas: ocho secciones,17px, sin overflow/errores JS/anclas rotas; salto al contenido y FAQ teclado6/6. Evidencia /private/tmp/0204-review.json,0204-after-*.png,0204-e2e.log y0204-build.log. Altura5255→3639 desktop;7655→5957 móvil390. No evidencia de conversión o comprensión. CI main verde4c40a6a consultado.

Detector0 primarios y25 advisory compactos/responsive; Arial conservado por filosofía aprobada, ignore-value estrecho programa.css. Sin ignore-file/rule. Auditoría inline ADR0129, sin revisor independiente. Fuente de producto: spec0191 y reglas/programa/previsión leídos, no editados.

Preview http://localhost:3003/programa-de-fidelizacion. Home0201 hero intacto y aprobado; negocios0200 aprobado; marketing0203 aplicada, QA owner pendiente. Sin push, merge, deploy ni verify global. Cambios paralelos de Claude preservados. Próximo paso: revisión owner de fidelización, o auditoría POS si la solicita.

## HISTÓRICO — 0203 MARKETING FUNCIONAL Y COPY LOCAL (2026-10-11)

Commit9e5b119, reserva441180f. Owner pidió analizar y mejorar estructura, visual y copy de /marketing-para-comercios con la filosofía de /negocios. Implementación local, QA owner del ensamblado pendiente; sin publicar.

Hero centrado en nuevos clientes y regreso; demostración de Bienvenida, campañas por audiencia y condición, pasos compactos, dos situaciones de Impulso, FAQ más directas y cierre contenido. Condiciones2km/rubros, permiso/compatibilidad push, independencia de POS, planes y prueba3 meses conservados. Copy contrastado con spec0192 y reglas locales de marketing leídas; sin tocar backend ni prometer visitas garantizadas. CSS exclusivo marketing, importación del stylesheet viejo retirada de esa página; herencia global de fuente/cierre corregida dentro del scope.

Typecheck público, ESLint específico, formato, diffcheck y números0. Build público0; landing13/13 en12.7s, conserva home/negocios y agrega4 casos marketing. Capturas1440/390 claro/oscuro,320/768 claro vistas: seis secciones, sin overflow, errores JS o anclas rotas; salto al contenido y FAQ por teclado6/6. Texto17px en los seis. Evidencia /private/tmp/0203-review.json,0203-after-*.png,0203-e2e.log y0203-build.log. Altura desktop3777→3244px, móvil5259→4939px; no evidencia de conversión. CI main verde4c40a6a consultado.

DESIGN/PRODUCT y sidecar actualizados; marketing adopta Funcional, fidelización/POS todavía pendientes. Arial preservado por filosofía aprobada; ignore-value estrecho marketing.css. Detector0 primarios,24 advisory de variantes compactas/responsive; sin ignore-file ni ignore-rule. Auditoría inline ADR0129, no estudio de usuarios ni revisión independiente.

Home0201 aprobada por owner, hero intacto; /negocios0200 aprobada intacta. Preview http://localhost:3003/marketing-para-comercios. No push, merge, deploy ni verify global. Mantener cambios paralelos de Claude en auth, tooling y su estado. Siguiente paso: QA owner del marketing, o revisión de otro producto si la solicita.

## HISTÓRICO — 0201 HOME FUNCIONAL LOCAL, HERO IDÉNTICO (2026-10-11)

Commit5da3c84, reserva437c39f. Owner confirmó /negocios Funcional y pidió extender el diseño a la home, excluyendo explícitamente su hero. Sin autorización para publicar.

Home debajo del hero aplicada: pasos numerados compactos, demostración HTML de pase identificada como ejemplo, programa ilustrativo de6 sellos, CTA comercial contenido, FAQ y footer alineados. Conserva orden, copy principal, enlaces y avisos ilustrativos. Scope consumer-content; header, hero, metadata e imagen preservados. Captura de hero idéntica por SHA256 en1440/390 claro/oscuro,320/768 claro (6/6).

Typecheck público, ESLint específico, formato y diffcheck0; build público0. Suite landing9/9, última corrida11.2s. CI main verde4c40a6a, comprobado; no publicación de estos commits. Cuerpo sin overflow6/6, sin errores JS, FAQ teclado6/6. Persiste desborde preexistente5px del hero a320px, excluido del alcance. Fuentes secundarias y foco del CTA con contraste calculado y foco real verificado claro/oscuro. Evidencia /private/tmp/0201-before-review.json,0201-after-review.json,0201-e2e.log y0201-build.log.

DESIGN y PRODUCT actualizados: adopción de home parcial, excepción de hero/header, productos aún pendientes. Sidecar actualizado. Detector0 primarios,36 avisos de variantes tipográficas y estilos preservados; Arial ignorado solo en consumer-home.css por elección aprobada, sin ignore-file ni ignore-rule.

/negocios Funcional spec0200 permanece aprobada, intacta: Conecta destacado cálido, Impulso neutral, sin corazones. Home y negocios disponibles en http://localhost:3003. Próximo paso: QA owner de home, o revisión de páginas de producto si la solicita. Sin push, merge ni deploy. Mantener intactos los cambios paralelos de Claude en merchant/auth, tooling y su estado.

## HISTÓRICO — 0199 IMPLEMENTADA LOCAL; QA OWNER DEL ENSAMBLADO PENDIENTE (2026-10-11)

Implementación local9f4e3c5. El barrio conectado elegido y confirmado por owner.
Spec0199 reserva890a37e,
recursosf2bee16. Cuerpo /negocios REEMPLAZADO: mapa e invitación, QR/premio sobre
mesa, tablet y paneles POS, inicio compacto, planes, cinco FAQ y cierre verde.
Burbujas rectangulares completas con icono a izquierda según nota del owner.
Todas las referencias visibles a ejemplo retiradas solo de /negocios.
Hero aprobado preservado, burbuja Café y sin disclaimer. Home y páginas de
productos preservan defaults; export antiguo de previews conservado.
URL REAL del ensamblado: http://localhost:3003/negocios. Sin publicación.

Plan/recursos aprobados en navegador y chat «aprobado»:
session07814800c7438f3d7eb890741a4965d08a0583cea2d4409c2b080ca7d8ef63bc,
revision3cc9cc3c35f01b29749200b09ec171d295fa84016018e2a74d0f4436513cd873.
Referencia actual .impeccable/mocks/completa/barrio-burbujas-integradas.png,
corregida a pedido del owner, vista y guardada. Tres plates nuevas aprobadas
con prompt embebido, public/images/negocios-{neighborhood,reward-scene,service-scene}.
No crops enviados a producción, sidecars con evidencia de aprobación real.

Node24: tipos/ESLint/formato0, diffcheck0, numeración0. Landing final9/9 en10.5s,
/private/tmp/0199-e2e-final.log; build público final0,
/private/tmp/0199-build-final.log. Capturas1440/390 claro/oscuro vistas, sin
pageerrors ni overflow. Scan de provenance3/3 sin faltantes. Revisión inline L2,
sin subagentes, DB/Neon/adversarial o verify global. Detector sin hallazgos.
Comp-diff76% drift; corrección de encabezado, orden móvil y planes/FAQ hecha.
Quedan diferencias de tamaño/posición de burbujas, paneles y cierre; ningún módulo
omitido. No afirmar igualdad pixel a pixel ni aprobación del sitio ensamblado.

IMPORTANTE workflow helper: spec65 regiones y26 textos medidos. Medición de
fuentes después de aprobación cambió hash de spec: recibo técnico stale aunque
recibo REAL de recursos sí existe y owner aprobó. Se continuó bajo esa aprobación
explícita, sin nueva solicitud redundante, sin fabricar recibos ni forzar gates.
Plates sigue abierto, hero/sections/motion/responsive pendientes en helper;
finish ship rechazado por fases abiertas. Cierre del helper pendiente de resolver
stale o aceptación real del ensamblado; no certificarlo completo.
QA OWNER del sitio completo pendiente. No nueva ronda de elección de diseño.

No push/merge/deploy. No commitear instalación ni helpers/capturas temporales.
CI main9405c93 rojo histórico por screenshots tmp, fix local4f37e70 ya existente.
Siguiente: owner revisa localhost; aceptar/corregir solo hallazgos concretos.
Para publicación se necesita autorización expresa y verify previo.

## ⇥ 0197 IMPLEMENTADA LOCAL, APROBADA POR OWNER (2026-10-10)

Home / dirigida a consumidores con escena ilustrativa, tres burbujas HTML (sin
dispositivo Mi pase flotante), explicación QR→acumular→canjear, acceso a pase,
ejemplos, CTA comercial y FAQ. /negocios conserva contenido y diseño previo; SEO
propio, anclas de planes y accesos por audiencia ajustados. PRODUCT actualizado.
Spec0197 reservada132ac2e; implementación71a7f91 en dev, sin merge/push/deploy.

Owner aceptó el plan y assets en navegador (ronda2) y confirmó en chat.
Session07814800c7438f3d7eb890741a4965d08a0583cea2d4409c2b080ca7d8ef63bc,
revision d1645304c943c9abaab37ca5f61943d322dd49254f130badbafd65a8a3d88942.
Referencia aprobada ejemplo-visita-notificaciones.png y sidecar con evidencia.
Impeccable build state se reinició sobre esa variante. Su gate reporta revisión
no aceptada tras remeasure de fuentes, aunque status/verify confirma aceptación
real; no se fabrica recibo ni se repite aprobación del plan. Ensamblado NextTSX
verificado con Playwright real. Workflow helper no se declara completado.

Verificación Node24 real: typecheck y ESLint públicos salida0; build público
salida0 (final /private/tmp/0197-build-final.log); Playwright9/9 (13.5s), segunda
corrida tras corregir Arial heredado; configtemporal
/private/tmp/checkpass-0197-playwright.cjs sin servidores compartidos/DB.
Capturas 390/1440 claro/oscuro vistas en /private/tmp/checkpass-0197-results.
Sin overflow ni pageerrors. Numeración y diffcheck correctos. Sin tests Neon.
No verify global: corresponde al paso live ADR0128/0129.

Servidor para owner: http://localhost:3003, execsession75652.
Owner aprobó la revisión local del sitio ensamblado: «ok, me parece bien».
QA local de0197 cerrada. /negocios y / quedan disponibles.
Pendiente: publicación, con autorización explícita y verify previo.
CI remoto main9405c93 sigue rojo histórico por screenshotsPOS /private/tmp,
fixlocal4f37e70 previo existente, no regresión introducida por0197.

No commitear archivos de instalación .agents/.claude/.codex/.github ni otros
comps exploratorios, assets/plates duplicados o sesiones helper temporales.
Pendientes0196 Stripe/verifyglobal siguen en el bloque siguiente.

## ⇥ U1–U3 IMPLEMENTADAS EN DEV (2026-10-10)

Rama local `dev`. SHA del trabajo UI: `8611689` (spec 0196). Correcciones E2E:
`da78bbc`. Reserva de spec: `d2b49f6`. Trabajo público anterior: `60590de`.
Sin merge ni push; producción sin cambios.

Owner pidió landing.spec.ts y ticket-settings.spec.ts verdes antes del commit:
selector Cómo empezar acotado a #contenido, título con barra escapada y capturas
con testInfo.outputPath. Pasaron 7/7 antes de `da78bbc`. Corrida final conjunta
con billing-ui.spec.ts: 18/18, `/private/tmp/0196-e2e-final.log`.

U1: Conecta/Impulso (base/plus), períodos y precios de GET billing/state; checkout
con plan/interval/from; cambio confirmado con explicación del cobro; cancelación
al final del período y reanudación. Recibos y reconciliación conservados. Red,
402 y 409 permiten corregir/reintentar; topes enlazan Locales/Campañas.
U2: etiquetas del plan Free/Gratis retiradas del panel, home y cancelación.
U3: días de prueba del contrato de sesión; bloqueado solo suscripción y salida,
sin navegación/checklist; rebote payment_required del personal explicado. La
suspensión del negocio conserva prioridad. Kit existente, sin CSS ni API nueva.

Verificación real Node 24: billing UI 11 E2E; layout 4/4, entrada 2/2, guardias
layout 5/5, pruebas de cobro existentes 12/12. Vistas capturas 390/1440 sin
overflow. Mutaciones M1 (checkout sin plan) y M2 (baja inmediata) rojas por su
aserción y revertidas con SHA256 idéntico. Bitácora /private/tmp/0196-mutations.md.
Typecheck/lint/ui-guard finales correctos; numeración y diff --check correctos.

pnpm verify --base HEAD ejecutado una vez: tipos, lint, ui-guard, formato,
2465 unitarias y build de las 4 apps correctos. ROJO: E2E general no arranca por
Next dev existente en 3200/3201; Neon related 37/41 inicial por etiqueta Plan Plus
anterior. Textos esperados actualizados y suite fallida repetida por
tools/neon-test.sh src/server/billing-reconcile-page.neon.integration.test.ts:
5/5 en CI. No se repitió todo verify ni se afirma verde. Registros
/private/tmp/0196-verify.log y /private/tmp/0196-neon-recheck.log. Tres suites E2E
usaron configuración temporal sin webServer y public3003 existente. Tipos Next
generados por build restaurados antes del commit.

Zona Claude: solo cambios mecánicos de textos/campos en cuatro pruebas de cobro,
por §6 de TRABAJO-EN-PARALELO. Sin tocar servidor, kit, API ni tooling.
Handoff D9 a Claude: la UI usa Conecta/Impulso; planLabel del servidor conserva
Base/Plus en sus mensajes y puede alinearse en su zona.

Pendiente: QA owner con Stripe real y desbloquear gate E2E general antes de live.
U4–U6 de PARQUEADO esperan que el owner mergee 0195; no implementadas.
La sección U1–U6 se recuperó desde spec-0195 en PARQUEADO, preservando sus filas.
Los bloques siguientes son históricos, no describen el estado actual.

## ⇥ 0192 — REVISIÓN UX APLICADA, LOCAL (2026-10-10)

Owner pidió agente independiente y aprobó recomendaciones. Informe antes en
/private/tmp/0192-ux-review.md. Hero sustituye NetworkPreview por una invitación
compacta. Campañas con condición→beneficio y párrafos reducidos; estilos propios
marketing.css, sin plan-card/plan-grid. Eyebrow «Campañas automáticas para tu
negocio», títulos más concretos, Impulso compacto, pasos/FAQ/CTA conservados.
Componente compartido NetworkPreview y landing intactos.

Verificación real: typecheck public/lint/formato/diff0. Agente revisó Chromium3003
390/1440 claro/oscuro: HTTP200,H1 único,canonical/anclas, sin overflow/pageerror.
Hero desktop886→609px; móvil1427→848px. Gráfico745→260pxdesktop,757→201mobile;
flows114pxdesktop,110/134mobile, labels16px. JSON /private/tmp/0192-ux-after.json.
Capturas /private/tmp/0192-after-{hero,campaigns}-{390,1440}-{light,dark}.png;
root inspeccionó hero escritorio claro y campañas móvil claro. Informe posterior
/private/tmp/0192-ux-after.md. QA owner pendiente; sin suite/verify, commit/merge/push.

## ⇥ 0191 — CONSISTENCIA CON LANDING COMPROBADA (2026-10-10)

Owner pide pasada de colores/tipografía/tamaños respecto a landing. Medición
Chromium de estilos calculados en ambas rutas390/1440 claro/oscuro: hero, Arial,
body, pesos/interlineados, CTA/enlaces, labels y header ya coincidían. Diferencias
corregidas en programa.css: títulos de split56/36→escala heredada65/41; radios de
paneles12 como POS landing; tarjetas1.7 de interlineado; elimina verde oscuro propio
#244638 y usa color-mix naranja10%/paper que ya usa landing. Variables base iguales.
Selectores huérfanos de notas/encabezados retirados. Pase ampliado aprobado conservado;
transición compacta y cifras de cálculo mantienen jerarquía propia intencional.

Verificación final real: /tmp/0191-consistency-final.json, 4 comparaciones pares
(claro/oscuro390/1440) sin diferencias en tokens/h1/h2 principales/body/CTA/link/
kicker/header, HTTP200 y sin overflow/pageerror. Capturas completas ambas rutas
/tmp/0191-consistency-{landing,program}-{390,1440}-{light,dark}.png. Vistas landing
escritorio claro y programa escritorio claro/móvil oscuro. Typecheck public/lint/
diff0; Prettier de CSS/spec. Sin suite/verify ni commit/merge/push, QAowner pendiente.

Último visual atención aprobado: solo paseQR, 300pxdesktop/260mobile, logo64 y
QR156/128. Escena de productos/leyendas retirada; también quitada leyenda de cuenta.
Cálculo30→3→27, modalidades6sellos→café/30puntos→café. Server3003 activo y responde.

## ⇥ 0191 — ESCENA DE ATENCIÓN EN PRUEBA (2026-10-10)

Owner rechazó vista simplificada de Mostrador; aprobó escena con menos texto:
«Sus favoritos, a mano», paseQR→café y empanada, frase «Identifica al cliente y
encuentra lo que suele pedir». Aplicada con HTML/CSS y SVG Iconoir. Copy de la
sección conservado. Supersede visual anterior, sin capturas ficticias de producto.

Checks reales Node24: typecheck public/lint/diff0; Prettier aplicado. Localhost3003
HTTP200, H1/canonical/anclas, sin overflow/pageerror390/1440. Captura móvil de
escena vista /tmp/0191-history-390.png; también generada1440. QA owner pendiente.
Sin suite/verify ni commit/merge/push. Servidor público3003 sigue activo.

## ⇥ 0191 — ATENCIÓN CON UI DE HABITUALES, LOCAL (2026-10-10)

Owner pide visual coherente con atención personalizada. Aplicada ilustración
simplificada de Mostrador: cliente identificado, Habituales de este cliente en
bloque destacado superior, resto del catálogo debajo. Basada en sale-forms.tsx
(sección habitual) y CSS merchant existente, sin tocar merchant/kit. No es captura
real ni promesa de habituales en editor POS, que todavía pasa lista vacía.
Investigación NN/G imagery-in-visual-design prioriza visuales informativos.

Localhost3003 fue reiniciado por pedido explícito owner: antiguoPID67362 no liberó
lock con TERM, cerrado con KILL; Next webpack actual sesion88478 activo. HTTP200.
Typecheck public/lint/diff0 y formato. QA390/1440 en3003: HTTP200, H1/canonical,
anclas, sin overflow/pageerror. Capturas /tmp/0191-history-{390,1440}.png vistas.

Cambios iterativos previos conservados: leyendas retiradas, cálculo30→3→27 sin
porcentajes; reglas simplificadas6sellos→café y30puntos→café; encabezado hero
retirado. Sin suite/verify ni commit/merge/push. Capturas reales demo y QAowner
pendientes. Representaciones son ilustraciones, no clientes/operaciones reales.

## ⇥ 0191 — HERO EN CUADRÍCULA, LOCAL (2026-10-10)

Owner pidió retirar nota del hero, más separación entre encabezado y título, y
texto mayor o foto/cuadrícula con criterio UX. Elegida cuadrícula informativa
con NN/G imagery-in-visual-design: QR/entrada protagonista, acumulación y canje.
Encabezado «Lo que antes quedaba en un cartón / Una historia que puedes seguir»
con gap18 y título28–36; tarjetas con títulos23–29, texto16/1.65 e iconos mayores.
Nota inferior retirada. Sin foto decorativa ni métricas inventadas.

Typecheck public/lint/diff0 y Prettier aplicados. Copia temporal3013 actualizada:
HTTP200, H1 único/canonical/anclas, sin overflow/errores390/1440; capturas hero
/tmp/0191-hero-{390,1440}.png vistas. Diseño legible y espacio aprovechado con
bloque grande superior y dos inferiores; móvil en columna. Server3003 sigue
agotando curl10s0bytes, por tanto owner puede estar viendo versión anterior.
Sin reiniciar3003, sin suite/verify, commit/merge/push. Servidor QA3013 detenido.

## ⇥ 0191 — REVISIÓN UX APLICADA, LOCAL (2026-10-10)

Owner pidió agente UX/UI independiente y aprobó sus propuestas. Informe en
/private/tmp/0191-ux-review.md; auditoría previa sustentada en código e investigación,
sin render porque localhost3003 agotó espera. Implementación: hero nombra puntos y
sellos; transición breve; reglas con ejemplos visuales en dos columnas y cashback
secundario; cálculo $50→$5 con 10% destacado; historial ilustrativo y diagrama de
una cuenta con dos programas/saldos separados. Títulos concretos, sin filas de
3 tarjetas. CSS propio programa.css, paleta adaptada a modo oscuro. Conservadas
las dos eliminaciones de copy pedidas por owner. Sin capturas demo verificables:
esquemas explícitamente ilustrativos, no supuestas capturas reales.

Checks reales Node24: typecheck public, lint de página, Prettier y diff --check 0.
Localhost3003 volvió a agotar 30s. Para QA, copia exacta temporal de app en
/private/tmp/0191-public-qa con Next webpack3013, sin reiniciar servidor compartido.
HTTP200, H1 único, canonical propio, sin anclas rotas, overflow ni errores de página
390/1440 claro y oscuro. Capturas /tmp/product-programa-de-fidelizacion-{390,1440}.png
inspeccionadas, además móvil oscuro; diagramas y cifras legibles, composición vista.
QA owner en entorno habitual3003 y capturas reales demo pendientes. Sin suite ni
verify global; sin commit/merge/push. Material actual conserva scope Mostrador para
productos habituales y previsión consumo/precio de venta, no margen por costos.

## ⇥ 0191 — REENFOQUE APROBADO, LOCAL (2026-10-10)

Owner aprobó sustituir la repetición de landing por origen para comercios de
barrio, actividad registrada, reglas de sellos/puntos, previsión antes de activar,
historial y una cuenta común con programas/saldos/datos separados. Aplicado en
programa-de-fidelizacion/page.tsx; retirados LoyaltyJourney y pasos de preparación
repetidos. Metadatos propios actualizados; CTA y precios conservados. Ejemplos
explícitamente ilustrativos, sin capturas ficticias de producto ni clientes reales.
Cashback Próximamente. Productos habituales mencionados en Mostrador, donde
existen; no prometidos durante edición de pedidos POS.

Previsión aprobada: consumo necesario frente a precio de venta del premio.
Ejemplo 1 punto/$1, premio $5 por 50 puntos: $50 de consumo, premio equivalente
al 10%. No llamarlo margen real: faltan costos y gastos. FAQ explica alcance.

Checks reales con Node 24: typecheck public, eslint de página y diff --check en 0;
Prettier aplicado. Revisión Chromium intentada a 390/1440: sandbox bloqueó el
inicio; repetida con escalación, navegación agotó 30 s esperando localhost:3003.
El puerto tiene un proceso escuchando, pero la página no respondió a la sonda.
No se afirma QA visual nuevo; capturas anteriores pertenecen a la versión previa.
QA visual owner y capturas reales de demo pendientes. Sin suite ni verify global,
sin commit, merge ni push; cambios previos del árbol conservados.

## ⇥ 0191–0194 — PÁGINAS DE PRODUCTO Y SEO LOCAL (2026-10-10)

Tres agentes por autorización del owner crearon rutas independientes de fidelización,
marketing y POS. Root revisó contenido, integró enlaces y sitemap, ajustó footer para
anclas de raíz y crédito de foto solo en landing. Metadatos de raíz actualizados y
WebSite añadido. Precios expresamente conservados; cashback Próximamente.

Typecheck public/merchant/consumer y lint afectados en 0. HTTP 200, H1 único,
canonical propio, anclas válidas, sin errores de página ni overflow en las tres rutas
a 390/1440 con Chromium. Se inspeccionaron seis capturas /tmp/product-*-{390,1440}.png.
No se corrió suite de tests ni verify completo para estas páginas informativas.

Noindex aplicado a layouts raíz merchant/consumer; comprobado en HTML local de
onboarding y raíz consumer. Admin es zona Claude: encargo concreto y siguientes
pasos en docs/plan-seo-merchant-2026-10-10.md. Noindex global de respuestas no HTML,
validación producción y retirada de índices siguen pendientes. Sin merge ni push.

Capturas de producto aún por preparar con datos demo, para páginas interiores:
editor/pase en programa, campañas en marketing, catálogo/mesas/pedido en POS.
Imagen social pendiente. No hay casos reales: no inventarlos. QA owner pendiente.
La landing conserva los ajustes iterativos aprobados sin commit aún.

## ⇥ 0188 (2026-10-10) — LANDING EN DEV, QA LOCAL

Ajustes de copy L0 aprobados por el owner, aplicados localmente sin commit aún:
hero «Atrae nuevos clientes y dales motivos para volver», eyebrow «PARA COMERCIOS
LOCALES», descripción en lenguaje concreto y «Empezamos en Cuenca». Franja con
personas/regalo/reloj: Atrae nuevos clientes, Motívalos a volver y Ahorra tiempo al
atender, cada uno con la descripción aprobada. Tres columnas en escritorio y los
tres beneficios visibles en una columna móvil. Por indicación del owner no se
corren tests para estos ajustes; QA visual en localhost a cargo del owner. La
aserción existente del título se actualizó mecánicamente, sin ejecutar E2E.

Iconoir aplicado en toda la landing por pedido del owner: franja (Group, Gift,
Clock), flechas, confirmaciones, listas de planes, plus de FAQ y sellos ilustrados
(Circle). Dependencia directa iconoir-react 7.11.0 en public, misma versión que
merchant; lock actualizado sin descargas. Sin SVG de iconos hechos a mano ni
glifos usados como iconos. Marca y números ilustrativos conservados. Typecheck
public y lint de componentes en 0; sin E2E ni revisión visual automatizada: owner
comprueba en localhost. Cambios locales todavía sin commit.

Gráfico de red actualizado según opción aprobada por owner: tres momentos con
María/peluquería → regalo destacado de café → motivo para visitar tu cafetería.
Iconoir Scissor/User/Gift/CoffeeCup y flechas; se eliminan rubro, distancia y Cuenca
del gráfico. Nota explícita de ejemplo ilustrativo y beneficio elegido por negocio.
QA visual pendiente del owner en localhost; sin E2E para este ajuste.

Owner reemplaza la historia individual por diagrama de convergencia: grupos de
personas en gimnasio/peluquería/veterinaria → café de bienvenida → tu local.
Grupos Iconoir arriba, conexiones CSS, regalo central y destino «Nuevas personas
descubren tu negocio / Más oportunidades de recibir nuevos clientes». Sin métricas
ni visitas garantizadas. Tres fuentes visibles también en móvil; QA local por owner.

Owner aprueba reordenamiento de contenido L0 sin tests: sección Programa de
recompensas antes de la red, explicando QR, puntos/sellos y canje de premios.
La sección de red conserva pregunta y gráfico, integra canal de avisos al teléfono,
campañas automatizadas y Venta cruzada como ejemplo para atraer nuevos clientes.
CampaignSection y seis tarjetas retirados de la landing; archivo conservado.
Texto de futura página del programa ubicado en su propia sección, sin enlace aún.
Asersión de tarjetas actualizada mecánicamente, sin corrida; QA visual por owner.

Owner pide probar secuencia visual del programa: mismo pase digital con 0, 3 y
6 sellos, QR ilustrativo Iconoir al unirse y regalo disponible al completar.
Escenas Se une / Avanza hacia su premio / Disfruta su recompensa conectadas por
flechas horizontales en escritorio y verticales en móvil. Sustituye los tres
bloques textuales de fidelización. QA local por owner, sin ejecutar tests.

Último ajuste aprobado: owner descarta tres pases similares. Secuencia simplificada
con escenas distintas (celular frente a QR, tres sellos grandes, café de recompensa),
sin tarjetas ni texto pequeño. Título y una frase por escena, Iconoir y flechas.
QA visual por owner en localhost; sin tests. Los diseños anteriores son históricos.

Ilustración POS sustituida por teléfono central con pedido, mesa, cliente y cobro;
acompañan catálogo desde foto/PDF con IA, mesas y recompensa +1 sello. Solo SVG
Iconoir, sin leyendas de ejemplo ni datos reales. Adaptación responsiva de la
composición. QA visual del owner en localhost, sin tests.

Última propuesta POS aprobada: cuadrícula de cinco bloques de tamaños distintos,
Pedidos/cobros protagonista, Catálogo IA, Mesas, Fidelización y Tickets. Reemplaza
composición alrededor del teléfono. Iconoir, poco texto y paleta propia; en móvil
pedido a ancho completo y cuatro bloques en dos columnas. QA en localhost por
owner, sin tests ni publicación. Los previews anteriores son históricos.

Trabajo del owner implementado en `84df923`, después de reservar spec cerrada en
`b101434`. Rama dev; sin merge a main, push, publicación ni cambios de billing.
Se conserva el lenguaje visual de la landing y se reordena: hero, red, campañas,
POS/mostrador, tres pasos, cliente, planes, FAQ y CTA. SEO alineado con red en
Cuenca; enlace a /explorar y redirect /negocios conservados. Previews de red y POS
son ilustrativos; no inventan métricas, clientes reales ni QR de tickets.

Hero recomendado «Más clientes nuevos. Más razones para volver.»; antes de código
se propusieron también «Tu negocio de barrio, con herramientas de gran cadena» y
«Que te descubran. Que vuelvan. Que tu negocio crezca», con bajadas y copy completo.
Planes recomendados Conecta/Impulso; alternativas Club/Club Pro y Esencial/Crece.
Propuesta visual $20 (1 local), $45 (hasta 3), $12/local adicional, todos USD/mes,
con nota referencial. CTA «Pruébalo gratis 3 meses», todo incluido; sin prometer
que no requiere tarjeta. POS fuera de columnas; no se decide su asignación.

Verificación real: typecheck public, lint public/prueba, formato de cambios y
git diff --check en 0 con Node 24. E2E 4/4 a 390 y 1440 px, claro/oscuro;
última corrida con servidor Next levantado/cerrado por la propia suite, 5.1 s,
log /tmp/0188-landing-autonomous.log. Capturas hero/red/POS/planes inspeccionadas.
La revisión visual detectó columnas móviles heredadas y recorte oculto: oráculo
nuevo rojo por ancho 183.921875 < 292.5 y luego verde con una columna y gap fijo;
log /tmp/0188-mobile-regression-red.log. Contraste secundario oscuro corregido.
No se corrió verify completo ni se afirma CI remoto verde; gates específicos L2
según encargo y ADR 0129. Artefactos en test-results/landing-*.

Antes de landing se arregló CI de nuestra zona en `4f37e70`: capturas POS,
impresión y mesas pasan de ruta macOS /private/tmp a /tmp portable. E2E 116/116,
20.8 s, lint/formato/diff en 0; log /tmp/0187-ci-portable.log. Pendiente confirmar
Linux en CI cuando exista push autorizado; no se tocaron tooling ni tests de API.

QA del owner: abrir http://localhost:3003 (pnpm dev:public). El modo oscuro sigue
el esquema del sistema. Los CTA conservan onboardingUrl; esta tarea no cambia
el alta real ni concede un trial. El ambiente merchant/consumer continúa aparte.

**Antes de live:** Claude debe implementar la prueba de 3 meses y Venta cruzada en
el plan base (hoy alta free y campañas plus), salvo excepción explícita del owner.
Owner debe confirmar nombres, $45, $12/local y en qué plan va POS. Precios finales,
cobro y publicación son dependencias externas; aquí solo propuesta local. Kit,
API, servidor y DB intactos. QA visual del owner pendiente.

## ⇥ MAIN LOCAL — HISTÓRICO: MESAS MERGEADAS, SIN PUSH

Owner autorizó merge a main. Árbol limpio; fetch confirmó main/origin main
9405c93 como ancestros de dev. Fast-forward local ejecutado hasta 869e65c,
incluyendo 0187 y ajustes del owner. Sin conflictos, push ni publicación.
Este registro se commitea en dev y se incorpora por fast-forward de docs;
se deja checkout main para QA del owner y se restaura el ambiente local.

Gates acumulados reales: typecheck/lint/guard/formato/unit2458/build verdes;
Neon related merchant 4/4, consumer omitido sin cambios; E2E final 298 passed
y 21 skipped, 1.3 min, salida 0. Verify inicial devolvió ROJO porque el ambiente
local impedía levantar otros Next; se detuvo temporalmente para repetir E2E.
La corrida real encontró un oráculo de impresión sin la nueva lectura de mesas;
869e65c añade mock y espera esa lectura antes del baseline, manteniendo la
igualdad estricta de fetch durante impresión. Printing15/15 y E2E completo
posterior verdes; lint/formato de prueba en 0. Sin modificar printing ni API.

Detalle, tabla y logs en docs/preparacion-main-2026-10-10.md. No se afirma
una segunda corrida de verify completa ni CI remoto verde. Sin migración PROD:
0067/0068 ya aplicadas. QA main local por owner y push live quedan pendientes.

## ⇥ 0187 (2026-10-09) — HISTÓRICO: MESAS EN DEV LOCAL

Ajuste visual en 8cdb050: eliminado «Mesa seleccionada» del paso 1 y prop
redundante del selector. Chip elegido con borde accent de 1 px y accent-soft,
sin ring. Capturas de paso 1 y modal vistas; captura inicial finaliza animaciones
para medir el color final. E2E mesas 10/10 en 4.5 s y caso de captura repetido
en 0; typecheck merchant, lint de pantallas, guardia sin aumentos, formato
y diff --check en 0. Logs /private/tmp/0187-accent.log y
/private/tmp/0187-accent-capture.log. Dev local, sin merge/push ni cambios de kit.

Ajuste de texto en 3b1f37f: quitado el nombre del único local («Principal»)
debajo del selector del paso 1. Typecheck merchant, lint del archivo, guardia
sin aumentos, formato del archivo y diff --check en 0. Solo se eliminó copy;
no se repitieron E2E. Dev local, sin merge ni push.

Regla vigente del owner en d3fe5c4: Nombre de mesa solo cuando la consulta del
local confirma cero mesas, tanto nueva orden como Cambiar mesa. Sin input con
mesas configuradas, todas ocupadas o carga/error. Sin mesas, edición libre
conserva Guardar directo. Nueva orden con mesas requiere id; una orden antigua
libre no necesita reasignarse para editar productos, pero al cambiar mesa en
local configurado debe elegir una registrada. Eliminada alternativa Usar nombre.
Verificado: 101/101 E2E (10 mesas + 91 POS), 17.1 s; typecheck merchant,
lint de archivos cambiados, guardia de dos pantallas, formato global y diff
en 0. Log /private/tmp/0187-configured-tables.log. Casos todas ocupadas y error
sin fallback hasta confirmar lista vacía incluidos. Dev, sin merge/push;
API, kit y DB intactos. Los registros siguientes son históricos.

Último ajuste del owner implementado en fe5803b: modal Cambiar mesa muestra
libres y la propia, oculta las ocupadas por otras órdenes. Guardar reemplaza
Listo; deshabilitado sin cambios o selección inválida. PUT directo de mesa con
versión y productos confirmados; conserva aparte productos editados pendientes.
Éxito cierra y muestra toast; error literal dentro del modal conserva selección.
Verificado: 100/100 E2E (9 mesas + 91 POS), 17.3 s; merchant typecheck y lint
de archivos cambiados en 0; guardia de tres pantallas sin aumentos; formato
global y diff --check en 0. Captura móvil actual vista. Log
/private/tmp/0187-direct-save.log. Caché ahora usa productos como borrador;
texto libre comprueba fallo/reintento y conservación/guardado separado del
borrador de productos. Dev local, sin merge/push ni cambios API/kit/DB.

Ajuste posterior del owner: reserva 227a798, implementación 6851d7a.
Selector con chips como el badge, borde de 1 px y sin ring exterior recortado.
Cambiar mesa elimina «Mesa seleccionada» y «Usar nombre de mesa»; texto libre
se conserva en el paso inicial y al editar una orden que ya tiene nombre libre.
Ya no se ofrece desligar una mesa registrada desde ese modal. E2E actual
9/9 verdes, 4.4 s; typecheck merchant, lint de archivos cambiados, guardia de
dos pantallas y formato global en 0. Capturas nuevas del modal móvil/desktop
vistas; log /private/tmp/0187-chips.log. Sin cambios API/kit ni merge/push.
La evidencia de 99/99 más abajo corresponde al cierre previo al ajuste.

Encargo del owner leído completo, contrato 0182 y ADR 0131 completos. L2,
sin subagentes. Reserva local 5b4bb99; Locales eb54d1c, POS 550fab1,
pruebas y cierre 8a944ff. Checkout dev, sin merge ni push por instrucción
del encargo. API y migración 0067 ya en live: no se migró de nuevo.

Locales: Mesas junto a Editar con POS activo según sesión. Modal independiente,
solo activas, crear/renombrar/quitar con guardado inmediato y confirmación de
archivo. Busy impide dobles escrituras y cierre; respuestas tardías aisladas
por local; errores HTTP literales, toast compartido. Editar intacto.

POS: selección de mesas del local con ocupación; propia mesa elegible al editar.
POST con tableId, PUT con id o null explícito para texto libre. Dirty, descarte
y conflicto incluyen id; cambio a texto libre con igual nombre se detecta.
Ocupada/archivada refresca sin perder productos y permite volver a Mesa.
Fallo de lectura ofrece reintento o texto libre. Mesa elegida con borde y fondo
semánticos; no hubo cambios en el kit ni CSS.

Checks reales finales: typecheck seis paquetes en 0, lint global en 0,
format:check global en 0, ui-guard seis archivos sin aumentos, check-numbers
y diff --check en 0. E2e final 99/99 verdes (8 mesas + 91 POS), 17.4 s.
Los oráculos previos de caché siguen comparando sus endpoints originales y
cuentan aparte las lecturas nuevas. Corregido el heading posterior al POST del
wizard para esperar el pedido guardado, evitando pasar en la pantalla previa.

Capturas Locales 390/1280 y POS 390 vistas; evidencia, comando y QA en
docs/handoff-0187-mesas-locales-pos.md. HTTP simulado con UI/CSS reales:
persistencia real y QA owner pendientes. No se afirma verify global ni CI
remoto verde (ci:status al inicio no accedió por red). PARQUEADO #83 punto (1)
cerrado localmente; publicación pendiente. Server/API/kit/printing/DB/tooling
intactos. Cambio previo en apps/merchant/next-env.d.ts dejado fuera de commits.

## ⇥ MAIN LOCAL (2026-10-09) — HISTÓRICO: MERGE COMPLETADO, SIN PUSH

Owner entrega cierreClaude ef769b6 (Prettier14archivos, format:check/diff0 y
printing23/23) y estado4c9032b con árbol limpio. Comprobados commits/rutas,
main ancestro de dev. Merge --ff-only ejecutado: main3e26701→4c9032b, sin
conflictos ni push. Este registro se commitea en dev y se incorpora también
por fastforward a main; se deja checkoutmain para QA local antes de live.

Gates acumulados reales: typecheck/lint/guard/unit2458/build/Neon3256 verdes,
e2e completo final288/21skip verde, formato corregido/verificado por Claude.
Sin repetir suites por docs/formato; no se afirma segunda verify completa.
Owner informa0067/0068 YA aplicadas enPROD con snapshot
pre-0067-0068-2026-10-09 y SQL de integridad: no migrar de nuevo. EstadoClaude
confirma69migraciones y tablas/columna/índices/datos intactos.
Publicación no ejecutada: pushmain pendiente de OK y QAowner enmainlocal.

## ⇥ PREPARACIÓN MAIN (2026-10-09) — HISTÓRICO DEL GATE

Owner autoriza todos los commits y dev→main, live después. Notas ajenas pendientes
guardadas e1f685a con autorización de todos los cambios. Plan cierre3c4eab9.
Primera verify completa: typecheck/lint/guard30/unit2458/build/Neon3256 verdes;
formato14archivosClaude rojo; e2e270/18rojos. Detalle/tabla en
docs/preparacion-main-2026-10-09.md y log /private/tmp/checkpass-2026-10-09-pre-main-verify.log.

Corregidos los18fallos de navegador en500f8fa: selectorAyuda acotado a main en
3specs y8referencias Dialog revisadas conoverlay actual, sin tocar kit/relajar
tolerancias. Gate e2e completo repetido288passed/21skip,1.3m verde. Formato de
printing/API prohibido por encargo anterior: autorización consultada al owner,
sin respuesta aún. Main permanece3e26701; no merge/push. No afirmar verifyverde.
Entorno local detenido para gates y volviendo a levantarse en dev al cierre.
Al obtener permiso, aplicar soloPrettier a14archivos, correrformat:check y
registrar evidencia antes de fastforwardmain; no repetir otros gates sin motivo.
Luego QA main local por owner; live requiere0067/0068PROD y autorización posterior.

## ⇥ 0186 (2026-10-09) — OPCIONES DEL TICKET EN CONFIGURACIÓN

Incidente owner503 al abrir Configuración: log merchant pos_route_failed42P01
en GETticket; consulta Docker confirmó core.ticket_settings ausente y68
migraciones (hasta0067). Aplicado migrador local existente con URL Docker fija,
sin seed/reset ni PROD. Exit0:69migraciones; to_regclass ahora devuelve tabla y
SELECTshow_business_name/show_table exitoso (sin filas, defaultsAPI). No cambios
UI/API/DBfuentes. Owner debe recargar para confirmar GET autenticado en navegador;
no se afirma HTTP200 sin su sesión. ImpresiónPOS fallaba por la misma tabla.

Reserva b2d4f89; UI7664df1 en dev local sin merge/push. Owner aclaró que
impresión siempre activa: toggle Imprimir tickets solo abre/cierra opciones,
sin persistir ese estado visual. Propuesta de ampliar API/DB descartada.

Tarjeta owner junto a POS consume GET/PUT existente de0184. Switch del kit
para nombre y mesa; cambios guardados automáticamente, ambos falsos válido.
Éxito ConfirmationToast compartido; fallo conserva configuración confirmada,
lectura fallida ofrece reintento, bloqueo síncrono durante PUT evita concurrencia.
Abrir/cerrar no escribe, desmontaje ignora respuestas tardías. Sin owner no
consulta ticket. Sin cambios POS/printing/API/DB/kit ni ajustes de impresora.

Typecheck/lint merchant completos en0; formato/diff verdes; guard2archivos sin
incrementos. E2e3tickets+regresiónPOS4verdes2.5s, final3verdes2.8s con capturas
390/1280 vistas. Harness API simulado; PUT persistente real ya probado por Claude
0184, sin DB real ni migraciones en esta tarea. Evidencia/comando en spec0186.
QA owner pendiente; sin gate global/live ni CI remoto declarado (red falla).
Commits --only preservan cambios ajenos gotchas/LECCIONES.

## ⇥ 0185 (2026-10-09) — BOTÓN IMPRIMIR POS CONECTADO

Reserva 8264cc5; implementación 9dfd240 en dev local, sin merge/push. Encargo
2026-10-09 y printing/README leídos completos. Botón circular junto a Cobrar
consume printing/index de 0184/c264dbf; módulo, API, kit y DB intactos.

GET ajuste al abrir POS autorizado, sin defaults ni fetch al tocar. buildTicket
y printTicket en gesto; guard síncrono y botón bloqueado durante impresión o
borrador sin guardar. Éxito con ConfirmationToast compartido. no_printer y
not_found ofrecen elección/reemplazo BLE o serial en gesto nuevo; reimprimen
el documento congelado. Mensajes del módulo intactos. Unsupported publica
TicketDoc antes de window.print, sin Precuenta/QR, nombre/mesa opcionales.
Orden/contexto invalidan resultados tardíos; error de autorización revoca POS.

Typecheck y lint completos merchant en cero. Corrida conjunta: 105 verdes
(14 impresión + 91 POS), 21.6s; final específica con caso adicional de revocación:
15 verdes, 6.7s. Transportes simulados, módulo real. Formato/diff verdes y
guard de cinco archivos UI sin incrementos. Capturas diálogo desktop y ticket
con media print vistas. Evidencia en docs/handoff-0185-impresion-pos.md.

QA físico WD-58P1/Chrome Android pendiente del owner: dos tickets seguidos y
uno tras recargar para comprobar el filtro guardado. No se certifica hardware,
serial real ni CI remoto (ci:status falló por red); gate global antes de live.
Commits --only con rutas explícitas preservan gotchas/LECCIONES ajenos.
Fuera: ajustes dispositivo/papel58/80, pantalla owner, QR, órdenes cerradas.

## ⇥ AJUSTE (2026-10-09) — ACENTO Y TRASH EN CLIENTE

Commit a7e0bef devlocal. Owner pide borde noverde, precisa1px y papelera roja.
Cliente usa border-accent naranja por defecto y TrashIconoir/text-danger;
fondo/ancho responsive y confirmación intactos. L0 lint/typecheck:ui/diff verdes,
sin nueva suite ni captura. Spec/handoff0183 actualizados, sin kit/CSS/API/push.
Commits --only preservan ajenos; QA/gateglobal previos pendientes.

## ⇥ AJUSTE (2026-10-09) — CLIENTE COMO CONTEXTO VISUAL

Commit99e56c1 devlocal. Owner pide fullwidth móvil/compactodesktop y menos
competencia con tabs. Cardneutral surface-subtle/bordersuave con iconocírculo,
etiqueta Cliente/nombre; retirado segmentoverde. X discreta/modal intactos.
Cuatro casos existentesverdes3.7s usados para capturas320/390/1280; capturas
390/1280vistas confirman anchomóvil y compactodesktop. Lint/typecheck:ui,
formato/diff/guardscoped verdes. Sin kit/CSS/API ni handlers nuevos.
Spec/handoff0183 actualizados. Commits --only rutas explícitas preservan ajenos;
sin merge/push, pendientesQA/gateglobalprevios conservados.

## ⇥ AJUSTE (2026-10-09) — BADGE DE CLIENTE Y CONFIRMACIÓN

Commit ee2dc5a devlocal. Owner pide cápsula de cliente en Pedido con estilo
pestañas/mesa: contorno surface, segmento primary con User/nombre y Xmark.
Nombre largo ajusta con wrap-anywhere; modal confirma retiro. Cancelar/Escape
conserva cliente/cupón; confirmar removeClient existente, productos intactos.
ErrorclientError usa mismo modal, busy bloquea; Cobrar y kit/API/CSS intactos.
Corrida6casos5verdes/1fallo320por nombre sin espacios; corregido. Última2/2verde
1.6s a390/320. Loading/confirmaciones4verdes previas. Capturasbadge390/320 y
modal390vistas; lint/typecheck:ui/formato/diff/guardscoped verdes.
Handoff/spec0183 actualizados. QA/gateglobalprevios pendientes, sinpush.

Incidente staging concurrente: commit inicialc893314 incluyó8eliminaciones de
Claude. Corregido con índice temporal/amend comprobando HEAD estable: ee2dc5a
contiene SOLO4archivos previstos; staging real/deletionsClaude intactos.
En próximos commits compartidos usar commit --only con rutas explícitas para
no consumir staging ajeno aunque cambie durante aprobación. Cambios0184,
paquetes/schema/lock/ticket/printer temporales y estadosClaude preservados.

## ⇥ AJUSTE (2026-10-09) — ACCIONES DE ORDEN SOLO ANULAR

Commitfc07a30 devlocal. Owner retira Imprimir precuenta de modalAcciones;
Anular usa Button danger. Copydirty antesdeanular, guardas/handler conservados.
BotónImprimirPedido y trabajoClaude0184 intactos. L0: lint/typecheck:ui/diff
verdes, regresión existenteadaptada sin corrernavegador; mediaprint conservada.
Spec/handoff0183 actualizados antes/cierre. Sin kit/CSS/API/push.
Ajenos paquetes/schema/lock/ticketservidor/spec0184/estadosClaude preservados.
QA/gateglobal previospendientes.

## ⇥ CORRECCIÓN (2026-10-09) — AVISO SOLO TRAS GUARDAR

Owner corrige trigger: Descartar no actualiza pedido, vuelve sin toast.
Mini plan326183a, códigoa555ce2. Pedido actualizado se publica solo tras
Guardar cambios exitoso de orden existente. Fallo no avisa éxito y mantiene
Editar; guardadoysalida/nuevas conservados. Tres pruebasverdes2.7s,
casosdescarte390/1280 y falloguardado→éxito. Typecheck6/lint/formato/diff verdes.
Handoff0183 actualizado. Localdev sin merge/push, ajenos preservados,
pendientesQA/gateglobalprevios intactos. Esta decisión reemplaza aviso al
confirmar descarte documentado anteriormente.

## ⇥ AJUSTE (2026-10-09) — DESCARTAR CAMBIOS EN EDITAR

Mini plan2a3c12b, codec7ec4c1, devlocal sin merge/push. Owner pide Xroja junto a
Guardar cambios cuando Editar dirty. Button danger circular48/IconoirXmark y
Dialog Descartar cambios reutilizan kit. Cancelar/Escape conserva borrador/tab;
confirmar restaura apply(order), limpia eliminaciones/aviso producto, vuelve a
Pedido con ConfirmationToast Pedido actualizado (copy owner). Sinrequests,
cliente/cupón intactos, busy bloquea. Nueva orden/salida previas intactas.
5pruebas específicasverdes4.5s y2descarte finalesverdes1.8s trasajuste círculo;
verifican inline, cancelar, snapshotrestaurado, ceroescrituras, tab y toast.
Capturasinline/modal390vistas;1280capturado. Typecheck6/lint/formato/diff y
scopedguardeditor sinincrementos. Handoff0183 actualizado. QA/gateglobalprevios
pendientes; ajenosgotchas/LECCIONES/estadosClaude preservados.

## ⇥ AJUSTE (2026-10-09) — CONFIRMACIONES UNIFICADAS

Owner define confirmaciones iguales a Producto añadido: cápsula oscura,
móvil abajo centro, desktop arriba derecha. Mini plan1a8e83d, código59998d2.
ConfirmationToast en app/components adapta Toast compartido con Tailwind/tokens;
pos-editor y pos-scan lo reutilizan sin clases propias. Patrón futuro obligatorio
para confirmaciones documentado en design-system con ejemplo. No kit/CSS/API.
Cinco pruebas verdes2.8s, comparan cliente/producto a390/1280 y conservan
loading/cancelación/pedido largo. Capturasmobile/desktop vistas; lint/formato,
typecheck6/diff y guardscoped3archivos sin incrementos. Handoff0183 actualizado.
Devlocal sin merge/push, ajenos preservados, QA/gateglobal previos pendientes.

## ⇥ CORRECCIÓN (2026-10-09) — TOAST POS ALCANZABLE EN VIEWPORT

Owner no veía toast. Regla counter-flow.toast positionstatic lo dejaba después
pedido fuera pantalla. Mini plan6b31c78, fixec69ffb: Toast compartido fixed
arriba centrado por utilidades explícitas, sin CSS/kit ni cambios de resolve.
Regresión20líneas: rojo antes viewportratio0, verde después positionfixed y
viewport. Tres pruebas específicasverdes1.9s, typecheck6/lint/formato/diff verdes;
captura390×600vista. Handoff0183 registra evidencia. Devlocal sin merge/push.
Cambios ajenos preservados; QA físico/gateglobal previos siguen pendientes.

## ⇥ AJUSTE (2026-10-09) — IDENTIFICACIÓN POS CON C ANIMADA

Owner pidió pantalla loading intermedia y toast al encontrar cliente.
Mini plan L1 cerrado en1660b87, código68ab865, dev local sin merge/push.
pos-scan mantiene fullscreen durante resolve con C oficial centrada/pulso,
texto solo sr-only, reduced-motion sin animación y Cancelar alcanzable.
Toast compartido Cliente identificado solo tras éxito vigente; nuevo escaneo
limpia aviso, cancelar/error/tardío no avisan éxito. No kit/CSS/API ni dinero.

3pruebas específicas verdes2.1s (éxito/loading/reducedmotion, cancelartardío,
error/auth); typecheck6verde, lint/formato/diff verdes. Dos capturas390px vistas.
Guardgeneral rojo por nuevos archivos ajenos prueba-impresora; countFile
antes/después del cambio POS:increases[] ambos. Handoff0183 registra límites.
QA físico y gateglobal de0183 siguen pendientes; PASSindependiente76ff4ed
es del flujo anterior, ajuste L1 no usó subagentes ni suiteglobal.
Cambiosajenos gotchas/LECCIONES/PARQUEADO/prueba-impresora/investigación preservados.

## ⇥ ESTADO (2026-10-09) — 0183 LOCAL, PASS AUTOMATIZADO INDEPENDIENTE

Código **03fad03**, corrección **76ff4ed**, rama dev sin merge/push.
[Spec 0183](../specs/0183-pos-escanear-pase-y-confirmar-cobro.md) sigue cerrada:
QA físico y gate global pendientes. [Handoff](../handoff-0183-implementacion.md)
y [revisión independiente](../revision-0183-pos-cobro.md).

QR por cámara identifica desde Pedido; cliente/beneficio temporal. Cobrar y
Escanear fullscreen; Código del pase retirado por decisión owner. Dialog es
única excepción de kit autorizada expresamente antes del código (03b9306).
Preview en centavos/base+extras, Cancelar sin close, cierre incierto conserva
UUID/cuerpo y bloquea navegación. Ningún servidor/API/tooling modificado.

Revisor encontró FAIL real: GET de recuperación503 tras409 permitía reabrir
con snapshot anterior. Root corrigió barrera persistente recoveryRequired:
Cancelar, reintentar o Quitar cliente no permiten confirmar hasta GET exitoso
más revisión. Seis regresiones nuevas verifican ambas vías, exclusión de cliente,
versión recuperada y nuevo UUID después de revisar.
Revisor **PASS automatizado76ff4ed**:86e2e+6reproducer,28preview,11Neon,
checks y Merchant Webpack verdes. Dos mutaciones rojas y fuentes restauradas.
Root6regresiones/typecheck6/lint/format/diff verdes. Corrida root81tests:
80pasan/1wizard falla por nombre accesible de heading; rerun puntual1/1verde,
y mismo wizard verde en suite86independiente. Se registra intermitencia,
no se afirma causa ni PASSglobal.

Root unitarios globales con4workers2435pasan/1036skip, lintglobal verde.
Verifyglobal previo rojo: formato servidor ajeno, tours10, referenciaskit8,
TurbopackEPERM incluso escalado. Kitbaseline03b9306==actual por8hashes;
no referencias regeneradas. QA cámara/teclado físico pendiente; viewport320x400
con scroll/foco pasa simulado. No marcar spec implementada ni publicar.

Dev local owner3200/3201 intacto. Copia aislada build:
/private/tmp/check-point-0183-build-_w_xmqt_, envlocal validada.
No DATABASE_URL producción. Owner preguntó solo cómo probar sin usuario real:
seed define Carla Ficticia/Café de bienvenida, pase dev-my /c/seed-local-web-1,
condicional a base sembrada; no ejecutar seed por esa consulta.
Cambios ajenos gotchas/LECCIONES y commits concurrentes de Claude preservados.

## ⇥ AJUSTE (2026-10-08) — CABECERA LIMPIA EN TOMAR PEDIDO

Owner pidió menos texto en paso 2. Ajuste 0181 cerrado en d739938 antes de código:
progreso Paso N de 3 solo sr-only; título de etapa y contexto mesa/local pequeño.
Volver a mesa/tomar pedido pasa a flecha circular junto al título (aria-label
conservado); X protegida sigue a derecha. Catálogo ya no tiene título/fila adicional
en nueva: categorías y lupa en una fila. DetailedSale showHeading true por defecto
conserva Mostrador/abiertas. Sin CSS, kit, API ni cambios de cache/escrituras.
Typecheck 6 paquetes (4,348 s), lint, formato, guardia 6 archivos sin aumentos,
diff-check verdes. E2e existente adaptado sin ejecución, QA visual owner pendiente.
Dev, sin merge/push, cambios ajenos preservados.

## ⇥ AJUSTE (2026-10-08) — PRECARGA POS EN MESA

Owner pidió catálogo listo antes de Tomar pedido. Ajuste 0181 cerrado en a179fcc:
nueva orden inicia catálogo en Mesa, inmediatamente con local único/recordado o
al seleccionarlo. Cache reutiliza/deduplica por local; no se precargan todos los
locales. Tomar pedido espera contexto/catalogo; spinner y reintento local explícito
en Mesa. Errores ordinarios de catálogo locales, auth 401/403 sigue limpiando contexto.
Navegar al paso 2 no hace otra lectura; abiertas mantienen carga al entrar Productos.
Typecheck, lint, formato, guardia sin aumentos y diff-check verdes. Aserción e2e
existente adaptada para lectura en Mesa y sin lectura/cargando al pasar; no ejecutada.
QA owner pnpm dev:local pendiente. Solo dev, sin merge/push, ajenos preservados.

## ⇥ ESTADO (2026-10-08) — SPEC 0181: WIZARD DE TOMA DE PEDIDO

Owner confirmó API POS sin productos null y autorizó concepto en pasos. Spec
reservada en d4d3819 antes de código. Nueva: Mesa / Tomar pedido / Revisar, guardar
al final; contexto compacto, catálogo reutilizado con lupa opcional, revisión sin
importes y búsqueda para añadir sin salir, Quitar línea completa y Deshacer.
Captura de precio retirada de POS, cero conservado, null rechazado sin inventar
precio. Snapshot/lineId y abiertos/cobro/ticket preservados. Mostrador conserva defaults;
props compartidas opcionales. Cache sin refresh/polling/autosave ni cambios de API.
[Handoff](../handoff-0181-wizard-pos-2026-10-08.md).

Typecheck 6 paquetes (3,792 s), ESLint UI/fixture, Prettier, guardia 6 archivos sin
aumentos, números y diff-check verdes. E2e adaptados y escenario wizard/cero/undo/add/cache
agregado sin ejecución: owner mantiene preferencia de no más suites. QA visual/teclado
y gates de publicación pendientes; no declarar implementada ni PASS completo.
Solo dev, sin merge/push; kit/CSS/servidor/contrato intactos y ajenos preservados.

## ⇥ INVESTIGACIÓN (2026-10-08) — WIZARD DE NUEVA ORDEN

Owner pidió evidencia antes de avanzar: Mesa / Tomar pedido / Revisar, sin precios
habituales y con eliminación de línea completa. Consultadas fuentes NN/g, Toast y
Apple; [informe](../design-explorations/2026-10-08-pos-wizard-toma-de-pedido.md).
Tres etapas son candidata razonable, no mejoría medida; wizard tiene costo en tarea
repetitiva. Eliminación completa respaldada por POS real, con Deshacer propuesto.
Ocultar importes es inferencia del contexto; sin estudio específico comparativo.
No evidencia para prohibir búsqueda al tomar pedido: Toast la mantiene; lupa opcional
recomendada frente a solo búsqueda en revisión. API 0169 requiere precio excepcional
si catálogo no lo tiene; no ocultar ese requisito ni guardar cero automáticamente.
Sin implementación ni nueva spec cerrada. Evaluación de campo propuesta, no ejecutada.
Solo docs en dev; sin merge/push, cambios ajenos preservados.

## ⇥ ESTADO (2026-10-08) — SPEC 0180: NUEVA ORDEN CON REVISIÓN

Spec cerrada antes de código en 60b773b. Owner cuestionó tabs/botones duplicados y
resumen fijo durante selección. Nueva orden: catálogo sin tabs ni total/cantidad
fijos, única CTA Revisar pedido; revisión con líneas editables, Total y Guardar orden.
Volver a productos conserva catálogo montado/draft. No crea desde selección,
incluso salida protegida ofrece revisar antes de guardar. Orden abierta conserva
su UI; cache/contrato/API/Mostrador/kit intactos, sin autosave.
Typecheck 6 paquetes (3,59 s), ESLint, formato, guardia 4 archivos sin aumentos,
números y diff-check verdes. E2e existentes adaptados sin ejecución adicional.
QA visual owner con pnpm dev:local pendiente. Dev, sin merge/push, ajenos preservados.

## ⇥ AJUSTE (2026-10-08) — MÁRGENES COMUNES POS

Owner pidió alinear listado, nueva orden y orden abierta. Ajuste 0178 cerrado en
fa86d77 antes de código: main común w-full px-6 pt-6 md:px-12 md:pt-12; contenido
backoffice-home w-full en todos los estados. Padding lateral/superior 24 px mobile,
48 px desde md; ya no alterna 24/14 px ni ancho máximo del listado contra workspace.
Padding inferior/navbar/footer/print mantienen comportamiento existente.
Sin CSS, kit, API ni escrituras. Formato, lint y guardia sin aumentos verificados;
QA visual owner en pnpm dev:local pendiente, sin suites adicionales.
Solo dev, sin merge/push; archivos ajenos preservados.

## ⇥ AJUSTE (2026-10-08) — TEXTO CENTRAL NAVBAR POS

Owner pidió misma tipografía que Mostrador original. Ajuste 0179 cerrado antes de
código en f3f9267: acceso central reutiliza Link con texto directo y clase existente
mobile-counter-access, eliminando Button/Text que imponían 16/14 px. Tamaño original
10 px, 9 px hasta 380 px, mismo peso/altura de línea, sin CSS ni tokens nuevos.
Click previene navegación y conserva evento local a consola; permisos y posición
sin cambios. Sin pruebas de navegador adicionales; QA visual owner pendiente.
Solo dev, sin merge/push; cambios ajenos preservados.

## ⇥ ESTADO (2026-10-08) — SPEC 0179: NAVBAR POS

Owner confirmó POS / Nueva orden destacada / Mostrador. UI local en dev: tres
columnas, Nueva orden central usa Button del kit e icono Plus con la clase
mobile-counter-access existente, mismos tokens/paleta del backoffice. Evento local
compartido abre editor desde listado autorizado sin escrituras ni refresh; botón
superior permanece solo en escritorio. Navbar sigue oculta dentro del pedido.
Sin kit, API, servidor, CSS, dependencias, merge ni push. Spec 0179 reservada en
3da4356; implementación en el commit ui: destacar Nueva orden en navbar mobile POS.

Typecheck 6 paquetes, ESLint UI/fixtures, guardia 3 archivos sin aumentos, formato,
números y diff-check verdes. Fixture POS ahora selecciona segmento pos; demás
fixtures conservan loyalty. Sin suites adicionales por preferencia del owner.
QA visual owner con pnpm dev:local pendiente; no marcar implementada aún.
Cambios ajenos gotchas/LECCIONES preservados, staging vacío al entregar.

## ⇥ ESTADO (2026-10-08) — SPEC 0178: ENTREGA A CLAUDE

UI POS commiteada en **eb5a950**, spec reservada en **92c5913**. Nueva orden y
orden abierta comparten Pedido/Productos, catálogo reutilizado de Mostrador,
líneas editables, contexto compacto, guardado explícito y salida protegida.
Footer contextual y Más acciones para imprimir/anular; conflictos preservan
borrador hasta revisión. Cache sin TTL/polling/autosave; API/servidor/kit intactos.
[Handoff](../handoff-0178-pos-workspace-2026-10-08.md).

Owner probó: «listo. parece estar todo funcionando», y pidió no ejecutar más
pruebas, dejar preparado para live y que publique Claude. GPT no hizo merge ni
push, todo en dev. Verificaciones previas: 5 e2e seleccionados verdes (4,7 s),
typecheck 6 paquetes, lint de pantallas, guardia sin aumentos y formato aplicado.
Adaptaciones finales de otros e2e y ajustes de impresión/contexto sin rerun;
no se declara suite completa verde ni DoD íntegramente cumplido. Claude conserva
los gates normales de publicación. Próximas mejoras visuales quedan para después.
Staging vacío al entregar; cambios ajenos gotchas/LECCIONES preservados.

## ⇥ ESTADO (2026-10-08) — INVESTIGACIÓN UX POS MOBILE

Owner pidió investigación con agente porque orden abierta y nueva orden siguen
con UX pobre. Agente pos_mobile_ux ejecutado explícitamente autorizado: auditó
editor/carrito/flujo y fuentes oficiales; sin modificaciones ni órdenes reales.
GPT revisó código, capturas y documentación Square, Shopify, Toast y Apple.
Informe en [investigación UX](../design-explorations/2026-10-08-pos-mobile-ux.md).

Recomendación para revisar, sin spec nueva cerrada: workspace común Pedido/Productos
para nueva/existente; mesa/local compactos, eliminar modo Editar como paso obligatorio,
review de carrito con un scroll, estado guardado/dirty, X protegida, acciones contextuales.
Guardar explícito conservado; no auto-save/polling/TTL, no cambios de API ni tablas
inventadas. Impresión/anulación según frecuencia real, nunca perder snapshots/precios.
Captura catálogo 390×844: primer producto≈551, footer≈727, ~176px útiles; evidencia
heurística, no prueba con operadores ni teclado real. Propuesta tiene escenarios
para comparar tiempos/toques/errores con 3–5 operadores y dispositivos reales.

Solo docs, formato y diff-check verdes; código del producto intacto. Dev, sin
merge/push. Siguiente paso propuesto: maqueta navegable de los dos flujos y definir
salida/guardado/cobro antes de spec funcional. No marcar propuesta implementada.
Cambios ajenos gotchas/LECCIONES preservados; staging vacío al entregar.

## ⇥ ESTADO (2026-10-08) — SPEC 0177: JERARQUÍA DE ORDEN ABIERTA

Spec cerrada y reservada en 2e982c5. Orden abierta muestra mesa como título,
Orden abierta/local como contexto. PosTicket compact opcional oculta encabezados
repetidos solo en pantalla; impresión conserva comercio, local y mesa. Checkout
conserva ticket completo. Footer existente de Mostrador, móvil fijo con espacio
reservado; desde md estático: Editar secundaria y Cobrar primaria de ancho igual,
48 px mínimo; Imprimir/Anular discretas, Anular danger. X/caché/escrituras sin
cambios. Kit/Tailwind/tokens; sin CSS, API, servidor, tooling ni dependencias.

33 pruebas POS verdes (14,3 s), incluidos flujo de cobro/conflicto, caché,
jerarquía, espacio del footer, sin overflow y ticket impreso completo.
Capturas vistas /private/tmp/pos-0177-mobile.png y pos-0177-desktop.png.
Typecheck 6 paquetes, ESLint, Prettier, guardia UI sin aumentos (22 archivos),
números y diff-check verdes. Sin build/global verify (L1, dev activo).
Owner debe probar pnpm dev:local antes de main. Solo rama dev, sin merge/push;
staging vacío al entregar, cambios ajenos en gotchas y LECCIONES preservados.

## ⇥ AJUSTE VIGENTE (2026-10-08) — CABECERA Y X DEL POS

Owner pidió retirar Volver al historial de abiertas, quitar el bloque blanco de
cabecera y X con aspecto de Marca pero círculo simétrico. Spec 0176 ampliada y
cerrada antes del código (4ad8ea9). Se retiró module-topline del header POS,
que activaba fondo canvas en counter-flow móvil. X usa tokens, círculo 44×44,
icono 24 px y padding cero; solo X devuelve al listado en abiertas. Cerradas
mantienen retorno inferior. Sin cambios en Marca ni kit/CSS/API.
32 pruebas POS pasan (14,8 s), incluidos tamaño real, cabecera transparente,
retorno y ausencia del botón. Captura móvil vista. Typecheck 6 paquetes, lint,
formato, guardia UI sin aumentos y diff-check verdes. Rama dev, sin merge/push;
QA owner con pnpm dev:local pendiente. Archivos ajenos preservados.

## ⇥ ESTADO (2026-10-08) — SPECS 0174–0176: UI POS

0174 en **268b951**: se retiró Actualizar órdenes; X del listado vuelve a
/backoffice con Link del kit. Owner probó y confirmó. Sin refresh automático;
recarga/salir y volver monta caché nueva. Tests adaptados a recarga y validación
previa a anular. Retirados dos escenarios browser de GET tardío contra escritura
que dependían del flujo manual eliminado y uno de identidad durante refresh;
pruebas directas de generaciones, versiones y aislamiento permanecen.

0175 en **c3b1d03**: abiertas en filas compactas con mesa, total, Abrir; nombre
accesible individual, nombres largos permiten salto. Cerradas hoy conserva tarjetas.
Owner probó y confirmó. 31 pruebas POS verdes (14,0 s).

0176 en **9c9e550**, ajuste de padding/tamaño de la X en el commit siguiente:
orden abierta usa counter-shell/counter-flow con ancho disponible completo y
sin Card exterior. Sin navbar mobile, como Venta detallada. Sidebar escritorio
conservado como Mostrador. X de detalle/edición vuelve al listado con back y caché;
X de listado sale al inicio. Checkout/órdenes cerradas mantienen presentación.
No se tocó kit, CSS, API, servidor, tooling ni contratos. Componentes/Tailwind/tokens
existentes. 32 pruebas POS verdes (14,5 s); prueba puntual final 1/1 (2,0 s).
Aserciones: padding/borde cero, fondo transparente, ancho móvil 390 px, navbar oculta,
retorno sin GET extra, edición/listado correctos e icono X con ancho real 24 px.
Capturas móvil/escritorio vistas en `/private/tmp/pos-0176-*.png` y `pos-0175-*.png`.
Typecheck 6 paquetes, ESLint, Prettier, guardia UI 22 archivos sin aumentos,
números y diff-check verdes. Sin build/full verify sobre dev activo.

Pendiente QA owner de 0176 con pnpm dev:local antes de main. Todo en dev,
sin merge ni push. Archivos ajenos .claude/skills/gotchas-del-repo/SKILL.md y
LECCIONES.md preservados. Los avisos entre operadores siguen para el futuro.

## ⇥ ESTADO (2026-10-08) — SPEC 0173: NAVBAR MOBILE POS

Owner confirmó que la caché funciona perfectamente; incidente cache.peek ya no
se reproduce según su prueba. Configuración Cloudflare del handoff anterior
sigue siendo una recomendación pendiente de aplicar, sin acceso de GPT.

[0173](../specs/0173-navbar-mobile-pos.md), L1, reservada localmente en ecb19c8.
En POS la barra mobile usa NavLink existentes: POS y Mostrador en columnas iguales,
con permisos pos/counter respectivamente. POS activo. Otras vistas y escritorio
conservan navegación. Sin cambios de kit, CSS, servidor, API ni caché.
Actualizar órdenes se explicó al owner: sincronización explícita de historial,
validación de sesión e invalidación de recursos; sin polling para cambios ajenos.

Next real local con sesión ficticia de semilla y lecturas simuladas: mobile 390 px,
dos enlaces y destinos correctos, aria-current, columnas 189/189; desktop 1100 px
sidebar visible/barra oculta. Capturas vistas. Nueva orden y catálogo visibles,
cero pageErrors. Script /private/tmp/checkpoint-pos-0173-live.cjs.
Typecheck 6 paquetes, ESLint, formato, guardia UI sin aumentos (22 archivos),
números y diff-check verdes con Node 24.20.0. Sin suite nueva ni build (L1).
Pendiente owner probar con pnpm dev:local antes de pasar a main. Solo dev, sin
merge ni push. Archivos ajenos .claude/skills/gotchas-del-repo/SKILL.md y
LECCIONES preservados fuera del staging.

## ⇥ ESTADO (2026-10-08) — SPEC 0172: CACHÉ POS IMPLEMENTADA LOCALMENTE

Owner autorizó implementar la spec cerrada y dejó avisos entre operadores para después.
[0172](../specs/0172-cache-en-memoria-del-pos.md) reservada en 69191fc; implementación y
handoff en **8a422c3**, solo paths de GPT. Rama dev, sin merge ni push. API/servidor/kit/CSS,
migraciones, dependencias y tooling intactos; cambios ajenos preservados.

PosCache privado por montaje e identidad user/business, sin TTL, intervalos, listeners de
foco/visibilidad o persistencia. Reabrir/editar reutiliza detalle y catálogo por local.
Crear/guardar publica respuesta real y parchea historial sin GET extra. Cerrar/anular relee
historial una vez para Cerradas hoy; anular lee detalle antes de confirmar. Actualizar órdenes
sincroniza explícitamente e invalida; conserva borradores durante edición, los destruye al
cambiar identidad/perder autorización. Cambios de otros operadores: actualización explícita
o conflicto, no sondeo. Cupón mantiene su polling del cobro activo, fuera de esta spec.

Se deduplican GET y descartan generaciones/respuestas viejas. Cache no sobreescribe snapshots,
versiones nuevas, otra mesa seleccionada ni UUID/cuerpo de cierre. 401/403 limpian, 404 retira
mesa, lectura 5xx/transportes conserva copia con error. Conflicto sin snapshot bloquea acciones
hasta releer; fallo vuelve a historial sin permitir continuar con borrador obsoleto.

Node 24.20.0: **37 pruebas afectadas pasan en 24,7 s** (32 POS, incluidas 2 pruebas directas
sin navegador, + 5 Mostrador). Typecheck, ESLint, formato, guardia (22 archivos sin aumentos),
números y diff-check verdes. Capturas móvil 390 px/escritorio 1100 px vistas. Aserciones:
cero GET adicionales al crear/editar/volver/abrir o avanzar 1 h/foco; primera apertura un GET,
segunda cero; catálogo Centro/Norte una vez cada uno; actualización manual/cierre/anulación
leen solo lo definido. Tests retienen GET y comprueban carreras contra guardar/conflicto,
cambio de contexto y autorización. Log /private/tmp/pos-0172-e2e-final.log.

[Handoff y tabla](../handoff-0172-cache-pos-2026-10-08.md). **Owner debe probar con
pnpm dev:local** antes de pasar a main: recorrido de mesa e interacción de dos operadores.
Spec sigue cerrada por QA/entrega pendientes. No build/full verify sobre dev activo (L2);
verify global antes de main. ci:status no consultó GitHub (fetch failed, informativo).
Avisos a cachés de otros operadores son trabajo futuro separado, sin nuevas consultas periódicas.

### Incidente local posterior: Nueva orden y cache undefined

Owner reportó TypeError cache.peek con mapa de fuente apuntando al diálogo en console:515.
Fuente actual sí pasa cache/catalogRevision; en .next/dev/static/chunks había tres variantes
PosConsole: dos antiguas sin props de caché y una actual. Eso encaja con mezcla de versiones
por HMR, no se reprodujo en código actual. Se detuvo dev:local, movió la caché merchant a
/private/tmp/checkpoint-merchant-next-dev-pos-cache-20261008 y se levantó nuevamente.
Petición local /backoffice/pos dio 307 (sin sesión, esperado); compiló una única variante de
PosConsole que pasa ambas props. Dos pruebas de crear/reabrir verdes (3,0 s), log
/private/tmp/pos-0172-restart-smoke.log. No cambios de código ni fallback de caché.
El owner hizo hard refresh y reportó el mismo error: el diagnóstico de caché local
no fue concluyente. Se comparó el mismo chunk en origen y túnel: Next devuelve
no-cache/must-revalidate, pero Cloudflare impone max-age=14400/must-revalidate
(CF-Cache-Status EXPIRED). Después de esa lectura ambos cuerpos coincidieron.
Prueba con Next real y sesión de semilla local, primero origen y después túnel:
Nueva orden y catálogo visibles, cero pageErrors en ambos. Se simularon únicamente
habilitación POS y lecturas; no se crearon órdenes. Script temporal
/private/tmp/checkpoint-pos-next-live.cjs. La pestaña concreta del owner no se inspeccionó.
[Handoff de configuración](../handoff-2026-10-08-cache-cloudflare-dev.md): bypass edge
y respetar headers de origen para los dos hosts dev, sin alterar producción.
Aplicación en Cloudflare pendiente; GPT no tiene conector a esa cuenta.
Owner posteriormente confirmó que la caché funciona perfectamente. Sin cambios
de fuente para este incidente.
Mensaje chrome-extension sobre recordConsoleEvents.js corresponde a una extensión.

## ⇥ ESTADO (2026-10-08) — SPEC 0171: POS REUTILIZA MOSTRADOR

Owner pidió misma interfaz para añadir productos y confirmó ranking por más vendidos del local.
Reserva local `f640dc9`; implementación `8e19a38`; rama dev, sin merge ni push. POS importa DetailedSale existente de
Mostrador: carrusel horizontal, búsqueda y cantidades en tarjetas; no copia markup ni CSS.
Shell usa ancho/padding existentes, con min-w-0 para impedir desbordamiento del carrusel.
Resumen expandible mantiene snapshots por lineId, incluso precios duplicados/productos borrados.
Shared DetailedSale recibe disabled y productOrder opcionales; Mostrador conserva defaults.
No cambios de API, kit, CSS o tooling; cambios ajenos de Claude conservados.

Actualización de contrato confirmada por owner: commit local **2810d33** hace obligatorio
bestSellingProductIds en PosCatalog y actualiza mocks. POS conserva orden recibido, seguido
por productos sin ranking alfabéticos; [] conserva catálogo alfabético. Mostrador mantiene
productOrder opcional/default, sin cambios. Sin cálculo de ventas ni fechas en cliente.

16 e2e afectados verdes (11 POS + 5 Mostrador, 18,7 s), incluidos ranking parcial/vacío y
producto sin ventas visible y añadible. Typecheck, lint, formato, ui-guard sin aumentos y
números verdes con Node 24.20.0. Capturas vistas en entrega anterior. L2 sin mutaciones
nuevas ni build sobre dev activo. Pendientes QA owner con pnpm dev:local e independiente;
0171 permanece cerrada. Gate global anterior de 0170 sigue documentado abajo.

Contrato 0169: unidades de mesas POS cerradas con/sin pase, últimos 30 días por cierre;
local seleccionado o negocio entero sin locationId; excluye abiertas/anuladas y ventas
Mostrador. Claude entrega servidor y sus pruebas por separado. GPT no tocó ni commiteó
archivos de Claude. ci:status no pudo consultar GitHub (fetch failed, informativo).

Settings/hydration anterior: se encontró mezcla de chunks viejos/nuevos en .next/dev; se
reinició pnpm dev:local con caché merchant renovada, sin cambio fuente. Owner confirmó que
pudo probar. Próximo paso: probar esta corrección con pnpm dev:local antes de pasar a main.

## ⇥ ESTADO (2026-10-08) — SPEC 0170: PANTALLAS POS LOCALES EN DEV

El owner pidió ejecutar `docs/encargo-gpt-2026-10-08-pos.md` contra la API 0169, exclusivamente
sobre `dev`, sin merge ni push. Spec 0170 reservada en `4f533dc`; implementación y evidencia
commiteadas localmente en **`448e285`**. Rama sigue `dev`; no se tocó servidor, API, kit,
paquetes, migraciones ni tooling del repo. Se conservaron los cambios previos de Claude,
LECCIONES y ambos next-env.d.ts.

Cuenta → Configuración permite activar/desactivar POS (owner), con modal del número de mesas
abiertas. POS aparece en Mi negocio/Administración con módulo y permiso; Equipo condiciona el
toggle. `/backoffice/pos` ofrece Abiertas/Cerradas hoy, local activo, mesa, catálogo con precio
escrito si falta, snapshots/lineId al editar, conflicto de versión visible, detalle, precuenta,
anulación confirmada y cobro opcional con pase. Escáner del mostrador, endpoints solo POS,
sondeo/quitar cupón, calculadora no persistida y resultado/impresión desde sale del servidor.
Cierre con UUID/cuerpo congelados ante desconexión o 5xx. UI usa kit, Tailwind y tokens; guardia
sin aumentos. Producto fijo de cupón ausente pide editar la orden, sin alterar una mesa guardada
silenciosamente. Sin canje de premios.

Verificación con Node 24.20.0: siete e2e POS verdes (4.4 s), dos mutaciones rojas por las
aserciones correctas y restauradas con bytes idénticos; captura móvil a 390 px vista, sin
horizontal overflow; impresión por media print y window.print verificada. Typecheck, lint,
formato, números, unitarios (2395 pasan/1025 omitidos), build Turbopack y Neon relacionado
(10/10 con runner aislado) verdes. `pnpm ci:status` no pudo consultar GitHub.

**Gate global e2e pendiente:** `pnpm verify --base 4f533dc` corrió una vez: e2e no arrancó por
Next dev existente en 3200. La repetición de e2e con proxies temporales hacia los servidores
locales, sin apagarlos ni modificar tooling, dio **172 pasan, 21 omitidos, 14 fallan**; POS 7/7.
Diez fallos son strict-mode por dos botones Ayuda en los tours de Fidelización (ambos existen en
la base). Cuatro son onboarding/entrada que no encuentran la pantalla esperada en ese ambiente;
no se aseguró su causa ni se modificaron esas pantallas o tests. No hay PASS global ni revisión
independiente: la spec permanece **cerrada**.

[Handoff y tabla](../handoff-0170-pos-2026-10-08.md). **Siguiente paso: owner prueba en local con
`pnpm dev:local`**, activación, editar/imprimir/anular, cobrar sin pase y con pase/cupón reales,
resultado y movimiento en Mostrador. Pendientes cámara/impresora físicas, QA e independiente,
y resolver/aislar los fallos globales antes de pasar a main. El paso a main y push es de Claude
solo con OK del owner. No usar DATABASE_URL de PROD para tests.

## ⇥ TRABAJO ANTERIOR (2026-10-05) — SPEC 0163: LA RAÍZ MERCHANT ABRE EL ALTA SIN SESIÓN

El owner reportó que `business.checkpass.club/` mostraba la portada vieja. Reservé y publiqué la
[spec 0163](../specs/0163-raiz-del-merchant-abre-onboarding.md) (`1889b6d`); el cambio UI `bc8f3fd`
se publicó en `main` con el estado `37776ae`. La raíz consulta la cookie de sesión de
Better Auth: sin ella redirige en servidor a `/es/business/onboarding`; con ella valida la sesión
y conserva la portada para los rebotes del guard, evitando un ciclo con `/backoffice`.

Prueba e2e de navegador sin sesión: URL exacta del onboarding y título «Encuentra tu negocio».
Una mutación del destino a `/backoffice` produjo el rojo esperado en `toHaveURL` y se restauró
con hash idéntico. La primera corrida global falló por formato y una intermitencia en ese e2e;
tras el ajuste de cookie y formato, `pnpm verify` con Node 24.20.0 pasó: typecheck, lint,
format:check, unitarios, build, e2e (179 pasan, 21 omitidos) y Neon related merchant (sin tests
relacionados). El hook de push repitió `pnpm verify` en verde. En producción,
`curl -sSI https://business.checkpass.club/` respondió HTTP 307 con
`Location: /es/business/onboarding` sin sesión. La spec sigue `cerrada` hasta PASS independiente;
el caso de sesión activa se conservó por inspección del código, sin prueba automatizada nueva.
[Handoff para el revisor](../handoff-0163-entrada-merchant-2026-10-05.md), con commits, oráculos
y límites. `pnpm ci:status` no pudo consultar GitHub al redactarlo (`fetch failed`); el hook
local de push y la sonda HTTP de producción sí quedaron verificados.

## ⇥ TRABAJO ANTERIOR (2026-10-05) — SPEC 0157 REBASADA SOBRE ONBOARDING-GOOGLE; PUSH BLOQUEADO POR TURBOPACK

El owner entregó `onboarding-google` `1953afe` con las specs 0155 y 0156 y PASS del revisor. Rebasé los commits locales de la [spec UI 0157](../specs/0157-pantallas-de-alta-con-google-places.md) sobre esa rama; `docs/INDEX.md` conserva el ADR 0122, la fila 0156 implementada y la 0157. La UI y la spec están completas en `e659b86` y `60777dc`. **No hubo push:** el owner pidió uno solo con servidor y UI, y el hook exige `pnpm verify` verde salvo autorización expresa.

La UI tiene wizard negocio → email → confirmación con P1/P2/P3/P4, sesión UUID por búsqueda, login existente, 201/200/422 y reenvío de verificación. Locales envía `address.selectionToken` o solo texto; se retiraron los componentes y el CSS de Geoapify, el programa y el QR del wizard. `rg` de rutas antiguas y Geoapify en `app`/`lib`: vacío. Las dos mutaciones de la spec se pusieron rojas por la aserción esperada y se restauraron con SHA idéntico.

Con Node 24.20.0, `pnpm verify` pasó typecheck, lint, formato, unitarios, e2e global (117 pasaron, 5 omitidos) y Neon completo (3043 pasaron, 277 omitidos). La migración 0065 se aplicó a la rama Neon CI. El único gate **ROJO** es build Turbopack (`driver.css`, `Operation not permitted` al abrir un puerto), repetido fuera del sandbox. El build Webpack de Merchant pasó.

**Para publicar en un solo push:** se necesita resolver el fallo de Turbopack o autorización expresa del owner para la excepción del hook. Faltan QA real del alta y locales, PASS independiente de UI y deploy; 0157 sigue `cerrada`.

## ⇥ TRABAJO ANTERIOR (2026-10-04) — SPECS 0152 Y 0154 PUBLICADAS; QA PENDIENTE

El owner entregó `motor` `8a635b0` con el servidor 0153. Rebasé `main` sobre
esa rama y resolví el conflicto de `docs/INDEX.md` conservando las specs 0152,
0153 y 0154. La [spec UI 0154](../specs/0154-veredicto-automatico-del-cupon-en-mostrador.md)
está implementada en el commit `eaa03b3`: veredicto verde/rojo literal en Venta detallada y
rápida, sin M2; «Quitar» siempre; M4 manda cupón solo si es válido; producto fijo
agregado una vez por escaneo; y ticket con unidades del cupón separadas. La 0152
y el servidor 0153 se publicaron junto con la UI en `origin/main` `1927742`.

Verificación con Node 24.20.0: typecheck, lint, formato, unitarios, e2e
global (115 pasaron, 5 omitidos), Neon merchant (410 pasaron, 25 omitidos) y
Neon consumer (60 pasaron) en verde. Las 4 pruebas de navegador de la 0154
pasaron y revisé las capturas móviles verde y roja. `pnpm verify` quedó
**ROJO solo en build**: Turbopack falla al abrir un puerto interno al procesar
`business/onboarding/onboarding.css` (`Operation not permitted`), incluso fuera
del sandbox. El build Webpack de Merchant se comprobó aparte.

El owner autorizó explícitamente `--no-verify` para el único push conjunto por
el fallo de Turbopack. Confirmó que el deploy de Vercel de `1927742` ya terminó.
Faltan su QA con pase/cupón reales y PASS independiente de la UI; no se marca
`implementada` mientras el gate completo siga rojo.
[Handoff para retomar después del clear](../handoff-0154-mostrador-cupon-2026-10-04.md).

## ⇥ TRABAJO ANTERIOR (2026-10-04) — SPEC 0152: MOSTRADOR MÓVIL

La [spec 0152](../specs/0152-mostrador-mobile-sin-nav-y-sin-tarjeta.md) quedó
reservada y publicada en `1ea1e5e`; la UI quedó en `d30136f` tras el rebase.
Las etapas activas de Mostrador ocultan la navegación inferior; la X vuelve a la
pantalla inicial y sigue visible al desplazarse; el aviso no la tapa; en móvil
se elimina la tarjeta blanca interior y el footer detallado deja visibles
«Cancelar» y «Acreditar compra». Escritorio conserva la tarjeta.

Verificación con Node 24.20.0: prueba de navegador a 390 px 1/1, captura vista,
typecheck, lint, formato y tests unitarios verdes; e2e global 111 pasaron y 5
omitidos; Neon relacionado de Merchant 9/9; build Webpack de Merchant verde.
`pnpm verify` quedó **ROJO solo en build**: Turbopack falla al abrir un puerto
interno de PostCSS en `business/onboarding/onboarding.css` (`Operation not
permitted`), incluso fuera del sandbox. No se usó `--no-verify`. El owner pidió
dejar la UI local en ese momento. La autorización posterior incluyó la 0152 en
el push `1927742`, con deploy confirmado por el owner. Pendientes: resolver el build,
hacer QA móvil y obtener PASS independiente
antes de marcar la spec `implementada`.

## ⇥ TRABAJO ANTERIOR (2026-10-04) — SPEC 0149: PANTALLAS DEL CUPÓN ELEGIDO PUBLICADAS

La [spec 0149](../specs/0149-pantallas-de-cupon-elegido.md) quedó cerrada en
`b4f7f43` y su UI se publicó en `main` con `3006a2f` (código `9837a5a`),
sobre los commits de Claude de la 0148. La PWA usa P0–P2 con «Acá», coordenadas si ya existe
permiso, grupos por comercio y selección visible. El mostrador muestra M0,
sondea M1 cada 4 s, valida M2, quita M3 y envía M4 con ticket de bruto,
descuento y neto. El historial distingue los cupones y las unidades extra.
`stages.tsx` quedó en 289 líneas.

Verificación local con Node 24.20.0: typecheck, lint, formato, tests unitarios
(incluidos 34 de la consola), e2e y Neon completo pasaron (2968 tests, 277
omitidos). `pnpm verify` quedó **ROJO solo en build**: Turbopack de Merchant
falla al abrir un puerto interno de PostCSS (`driver.css`, `Operation not
permitted`) tanto dentro como fuera del sandbox y aun aislado. Los builds
Webpack de Merchant y Consumer pasaron. El gate reportó: typecheck ok,
lint ok, format:check ok, test ok, build ROJO, test:e2e ok, neon full ok.
`pnpm ci:status` reporta verde para el remoto `24ce0df`, que incluye la 0149.
**Pendiente:** QA del owner según la 0148 §«QA del owner» y PASS independiente
antes de marcar la spec como implementada. La 0150 (login temporal de QA) ya
está en producción y la 0151 está tomada por Claude; la próxima spec libre es
la 0152. Los botones de QA en onboarding deben aparecer solo cuando
`GET /api/merchant/auth/qa-login` responda 200.

## ⇥ TRABAJO ANTERIOR (2026-10-03) — SPEC 0145: VENTA CRUZADA EN MARKETING

La [spec 0145](../specs/0145-venta-cruzada-por-compra-en-marketing.md) quedó
reservada en `92a464c` y publicada en `main` desde `e61e3d5` (handoff
`dfa1646`). El cambio de UI exige `endsAt` al activar una
cruzada y actualiza editor, resumen, detalle y confirmaciones para la entrega
automática del cupón de la 0143. La prueba `cross-ui.test.ts` pasó 4/4; su
mutación M1 falló en la aserción esperada y se restauró. `pnpm verify` con Node
24.20.0 pasó typecheck, lint, formato, tests, e2e y Neon relacionado de
Marketing; el build Turbopack quedó rojo por `Operation not permitted` al abrir
un puerto interno del procesador CSS, incluso fuera del sandbox. El build
Webpack de Merchant pasó. [Tabla y evidencia](../handoff-0145-venta-cruzada-marketing-2026-10-03.md).
El owner autorizó el push excepcional y se publicó con `--no-verify`; el árbol
quedó limpio tras el push. La consulta posterior de CI falló por conexión a
GitHub, así que no se afirmó verde para ese SHA. La spec sigue `cerrada` hasta
resolver el gate de Turbopack y obtener PASS independiente.

**Al retomar:** el `main` local avanzó después con cuatro commits de Claude
de la [spec 0148](../specs/0148-cupon-elegido-y-atado-a-la-venta.md),
hasta `6cc8f47`, todavía sin push (`origin/main` en `afa6e77`). Según el
[estado de Claude](claude.md), la migración 0064 ya está en PROD y el owner
decidió que el próximo push de GPT arrastre también esos commits. La UI del
contrato 0148 está pendiente; este handoff no la implementa. Al iniciar:
`nvm use`, `git pull --ff-only`, `pnpm ci:status` y revisar el estado del árbol.

## ⇥ TRABAJO ANTERIOR (2026-10-03) — SPEC 0142: ICONO DE LA PWA EN WEB PUSH

La [spec 0142](../specs/0142-icono-de-la-pwa-en-web-push.md) quedó reservada
en `6488227` y el cambio de `sw.js` está publicado en `main` desde `0e055a6`.
El Web Push usa ahora `/checkpass-icon-192-v2.png`, el mismo PNG de 192 px del
manifest. El badge monocromo de Android y el comportamiento del click siguen igual.
`pnpm verify` con Node 24.20.0 pasó completo, incluidos 110 e2e (5 omitidos), y
el hook ejecutable repitió el gate en verde. [Handoff y tabla](../handoff-0142-icono-web-push-2026-10-03.md).

Wallet: el `icon.png` del pase Apple se genera en paquetes desde
`wallet-logo-trama-v1.png`; Claude debe revisarlo si se desea usar el icono v2 de
la PWA en los avisos de Apple. Google controla la presentación de sus avisos y
su `programLogo` es global para los pases; no se cambió el diseño aprobado.
Pendientes: QA visual de un push real, decisión sobre el logo global de Google y
PASS independiente antes de marcar la spec `implementada`.

## ⇥ TRABAJO ANTERIOR (2026-10-02) — SPEC 0140: AVISOS DE MOSTRADOR EN ACTIVIDAD

La [spec 0140](../specs/0140-avisos-de-mostrador-en-actividad.md) quedó
reservada en `daf9bac`. El cableado UI está publicado en `main` desde `0e76439`:
`wallet/page.tsx` lee `listConsumerNotices(account.id)` y pasa los avisos por
`WalletShell` a Actividad. La vista los mezcla por fecha con cupones y programas,
muestra comercio, texto y fecha, y abre «Mis programas» al tocarlos. Claude
agregó el mock del test de servidor en `0a66bc8`; GPT no tocó su zona.

`pnpm verify` con Node 24.20.0 terminó verde: typecheck, lint, formato, test,
build, e2e y Neon relacionado del consumidor. Tabla y límites en el
[handoff](../handoff-0140-avisos-de-mostrador-en-actividad-2026-10-02.md).
El hook local `.githooks/pre-push` quedó ejecutable y el push normal repitió el
gate en verde. Pendientes: QA manual con un cliente que haya sumado un sello y PASS
independiente antes de marcar la spec `implementada`.

## ⇥ TRABAJO ANTERIOR (2026-10-02) — SPEC 0137: UI PUBLICADA, GATE VERDE

El owner pidió tarjetas cuadradas para los archivos elegidos en «Importar con IA» del
catálogo, con miniatura y X para quitar cada foto. Confirmó que las nuevas fotos se
agregan a la selección y que el PDF conserva el análisis automático. La
[spec 0137](../specs/0137-vistas-previas-de-archivos-en-importacion-con-ia.md)
quedó cerrada en `489cdf1`; la UI está publicada en `main` desde `873ff6d`
y el gate verde está registrado en `9fbe3d8`.
Verificación: 7/7 e2e de importación con harness móvil, captura a 390 px vista,
2 mutaciones rojas y revertidas, build Webpack de merchant, typecheck, lint, formato,
tests unitarios y Neon related merchant verdes. `pnpm verify` pasó completo:
e2e global 110 passed / 5 skipped y build Turbopack consumer verde. El `EPERM`
anterior no se reprodujo en la última corrida; la prueba de bind local fuera del
sandbox también pasó. Falta PASS independiente. La UI admite `sourceFileName`
opcional, pero el API actual no lo devuelve: `catalog_import_file.original_name`
ya está persistido y Claude debe
exponerlo en el DTO de `GET /api/catalog/imports` y `GET /api/catalog/imports/{id}`.

## ⇥ TRABAJO ANTERIOR DEL OWNER (2026-10-02) — TRAMA VIVA EN EL PASE DE LA PWA

Después de `/clear`, leer el
[handoff Apple → pase PWA](../handoff-2026-10-02-wallet-apple-a-pase-pwa.md).
El owner quiere diseñar una versión de Trama viva para «Tu pase» dentro de
`my.checkpass.club`, con el QR en la tarjeta. La vista actual está en
`apps/consumer/src/app/(consumer)/wallet/qr-tab.tsx` y `apps/consumer/src/app/wallet.css`.
El owner aprobó la [maqueta Trama viva del pase PWA](../design-explorations/pwa-pase-trama-viva.html)
y aclaró que debe mostrarse un solo botón de Wallet según el SO, con su marca.
[Spec 0130](../specs/0130-pase-pwa-trama-viva.md) cerrada el 02/10/2026. Código local
aplicado; tests afectados 8/8, typecheck, lint y build Webpack del consumidor verdes.
Turbopack no pudo abrir un puerto interno en este entorno. Faltan QA en teléfono real,
escaneo de mostrador y PASS independiente antes de marcarla implementada.
[Handoff](../handoff-0130-pase-pwa-trama-viva-2026-10-02.md).

## ⇥ ESTADO (2026-10-02) — APPLE WALLET 0123: «IPHONE · STRIP VISIBLE» APROBADO; ARTE IMPLEMENTADO LOCALMENTE

El owner eligió la vista «iPhone · strip visible» de Trama viva. La spec 0123 está
cerrada. `0790956` está pusheado en `origin/main`. El constructor `.pkpass` incluye icono, logo y `strip` a 1x/2x/3x,
contacto público y revisión de marca nueva; preserva el QR y las referencias del
pase. Prueba Wallet, typecheck, lint y build pasan. **Live sin verificar:** faltan QA en
iPhone para confirmar que `strip` aparece en la versión objetivo, comprobar despliegue,
refresco de un pase existente con APNs, y PASS independiente antes de marcar
`implementada`. [Handoff](../handoff-0123-apple-wallet-trama-viva-2026-10-02.md) y
[guías de diseño](../wallet/apple-wallet-design-rules.md) y de
[actualización de pases viejos](../wallet/apple-wallet-update-existing-passes.md).

## ⇥ ESTADO (2026-10-01) — GOOGLE WALLET 0122: CLASE REAL TRAMA VIVA ACTUALIZADA Y APPROVED; PUBLICACIÓN GENERAL POR CONFIRMAR

Spec 0122 «Trama viva» aprobada por el owner. `f595842` está pusheado en `main`; ambos PNG
responden HTTP 200 desde `my.checkpass.club` y su SHA-256 coincide con el commit. La clase
`qa_trama_viva_0122` fue creada y Google devolvió `reviewStatus=approved`. El owner guardó
el pase QA en Android y aprobó el diseño: «perfecto, funcionó, quedó hermoso». Las
verificaciones de build, typecheck, lint, provisionador y regresión de Wallet pasan. La
clase real recibió `PATCH` autorizado y la lectura posterior confirmó logo/hero Trama viva,
emisor «CheckPass Club», plantilla y `reviewStatus=approved`. Siguiente secuencia:
verificación de pase viejo/nuevo y QR/enlace reales, confirmar acceso de publicación del
emisor en Console y PASS independiente. [Handoff](../handoff-0122-google-wallet-trama-viva-2026-10-01.md)
y [guía de diseño/publicación](../wallet/google-wallet-design-and-release.md).

Ajuste L0 de landing (2026-10-10): retiradas la sección «FÁCIL DE QUERER, FÁCIL DE USAR» y su ilustración. Selectores existentes actualizados; sin correr tests, conforme a la instrucción del owner para estos ajustes. Revisión en localhost pendiente del owner.

Ajuste L0 aprobado (2026-10-10): el cierre práctico queda en este orden: 01 Prepara tu local, 02 Activa tu programa, 03 Invita a tu primer cliente. Aplicado sin tests; el owner revisa en localhost.

Ajuste L0 aprobado (2026-10-10): encabezado de planes cambiado a «MÁS POSIBILIDADES PARA TU NEGOCIO». Sin tests; revisión en localhost por el owner.

Ajuste L0 aprobado (2026-10-10): título de planes directo, banner de prueba con las tres herramientas y campañas explicadas por beneficio. POS mencionado como herramienta de la plataforma sin asignarlo a un plan: el encargo mantiene esa decisión abierta. Precios sin cambios. Sin tests; revisión del owner en localhost.

Decisión del owner (2026-10-10), aplicada a la comparación de planes: POS, catálogo con IA, mesas, pedidos, Bienvenida, Venta cruzada, push y ficha pública en ambos; puntos y sellos en Conecta; Impulso agrega cashback y todas las campañas avanzadas, sin enumerar campañas pendientes de definir. Locales y precios sin cambios. Push con nota de límites futuros por tipo de cuenta (hoy sin límites); precio referencial con doble asterisco para distinguirlo. Esta decisión reemplaza la restricción de copy sobre cashback del encargo original; no implementa cashback ni cambia contratos de API. Requiere coordinar esa funcionalidad con Claude antes de publicar la promesa. Ajuste L0, sin tests, revisión del owner en localhost.

Ajuste L0 aprobado (2026-10-10): FAQ con «Resuelve tus dudas antes de empezar», sin bajada redundante, nueve preguntas sobre prueba, fin de prueba, uso independiente del programa, app, premios, Venta cruzada, puntos/sellos, equipos y locales. Fin de prueba descrito conforme al ADR 0134 (bloqueo sin suscripción y conservación de datos). Selector de pregunta actualizado; sin tests, revisión del owner en localhost.

Ajuste L0 aprobado (2026-10-10): cierre final «PRUÉBALO EN TU NEGOCIO», título «Empieza hoy. Descubre lo que puedes lograr en tres meses», resumen de fidelización, contacto y ventas con prueba gratuita. CTA de registro conservado. Sin tests; revisión del owner en localhost.

Ajuste L0 aprobado (2026-10-10): CTA de registro «Pruébalo gratis 3 meses» y nota «Todo incluido durante la prueba» añadidos en las secciones de marketing y POS usando SignupLink y start-actions existentes, como en el cierre práctico. Accesos informativos futuros conservados. Sin tests; revisión del owner en localhost.

Ajustes L0 aprobados tras revisión UX (2026-10-10): hero identifica fidelización, marketing y POS; programa explica QR → acumulación → canje; marketing distingue clientes propios y nuevos; planes resumen diferencias, simplifican POS y avisos al teléfono y explican campañas avanzadas; preparación del POS opcional en paso 1; anclas de configuración dicen Cómo empezar. Diseño, precios y mecanismo de cashback conservados. Selectores de copy actualizados; sin tests, conforme a instrucción del owner. Revisión en localhost pendiente.

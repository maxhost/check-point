# 0242 — Handoff para retomar después de clear

## Reanudación del18oct: expansiones unit y cálculo puro de Recetas aceptados

Owner exige entregables pequeños y **agentes nuevos/contexto vacío por bloque aceptado**, incluidos QA. Gratis/2x1 no aplican a líneas por peso; decisión cerrada. CP0 aceptado: contratos329c7917, LISTAc379c9a8, flujos8dca14ee y sus QA. Después se aceptaron financiale9d409ac/QA9a4a52a6, scope servidor1af3d7f3/QA0b52df93, lectores unit8624cda8/QA745bff45 y cliente scopeb0127037/QA7f9dce96. Ver sus fichas/handoffs/QA y el bloque vigente de estado. No confundir M0 descriptivo con POSV2/M1.

Catálogo ad9df221/QA98ab4e39, decoder96195674/QA63cd3c97 y quantity storage00ce3546/QA6cb655d8 ya aceptados/integrados.0102/0103 aplicadas a CI y, por root trasQA, a local protegida. Recetas storage0104 285662df/QA646b12b5 también aceptado e integrado (3CI+34puras, tipos/estáticosPASS); root aplicó0104 local despuésQA antes de integrar:105 migraciones, health3201 HTTP200. Main localbe6ffb59 por FF tras entregas posteriores, sin push/PROD. Dos regresiones nuevas de fixtures se corrigieron en00ce sin tocar guardias: prueba catálogo ahora en modules/pos/server y provider de decoder genérico; solo queda backlog00efff81 probado.

Expansor puro41d2aaa2/QA8287f8fb y base financiera analytics9bc8f49f/QAa2580a80 aceptados. Después: lector analyticsbe66d39e/QA373d6917 (4CI+2seleccionadas,12purasQA); captura/provenance637ae1f2/QA70d82a5b (aceptación funcional con completa10PASS/1FAILtimeoutNeon y foco1PASS/4excluidos, NO full11PASS); traductor POS6dc4b621/QA740af13f (192PASS, tipos/lint). Ver handoffs/QA para evidencia compuesta y fallos preservados. Captura corrige dos bugs reales de replay; rawV4 no tiene filasPOS/core, no es cierre E2E.

Hook aceptado: autor03cab45d/QA9ad94226 sobre030dd657, código61dca744,4puras+6CI finales PASS. QA detectó y cerró bug real de recetas duplicadas [A,A] frente[A,B]. Primera CI1PASS/4timeouts preservada; no se reetiqueta. Main localb109a365 tras identidad con QA; WT measurement-hook retirado por factory limpio/0procesos. Hook no llamado por catálogo/importación todavía.

Derivado ya aceptado: autor28728305/QA6c3ff0ec sobreefd067cf,37puras+4CI97.80s PASS sin skips, parentJSONB completo/replay con delivery real, legacy intacto. Sin cierre E2E. WT recipes-events retirado factory tras mainafbe2ce4.

Metadatos0105 ya aceptados: autor d2554387(código30c68434)/QA9df585d6 sobrea15e3b9a,5CI25.63s+46puras/tipos PASS, guardias24PASS/2FAIL backlog, SQL/JSONdiff aditivo solo2tablas. Root migró LOCAL protegida despuésQA antes de integrar:106migraciones/EXIT0; health3201 HTTP200. Defaults unit y configkg, mass dormido por barrera temporal. WT catalog-measure-storage retirado factory limpio/0procesos/main993390ca. Sin PROD.

Consumidores ya aceptados: autor0ba07ce7/QA1efcf2f6 sobre0f65de55. Producto dd47524f, tests80414cf9. CI original11PASS/6FAIL preservada: nuevo5+modelo5PASS, costo/origins6fallos de tests obsoletos. Rerun focal7PASS100.92s tras adaptación autorizada de tests (ambasdeliveries reales y lookuptranslator exacto); evidencia compuesta, NO integralverde.122puras autor/103QA PASS, tipos3/guardias24/2 backlog. V4consumer/costo/envelope conectados, productor3/unitbarriers intactos, sin E2Eraw4. WT measured-delivery retirado factory.

APIunidades aceptada: autor d60f7085(código65ce09c2)/QA32da087f sobre5128d67b,6CI PASS0skip/retry47.02s y teardowncompleto. No archivo rawlog: salida original recuperada de tools sesión90030 chunks0bdfa9/c24f54/699293, QA contrastó sin inventarruta. GET/PUTguardbusiness/revisiónmutexcompartidos/no-store, masstype domainreutilizado. unit_in_use realmass/carrera pendienteCP2c barrera0105. WT sales-units-api retirado factory/main8b73fe4e.

Revisiones comerciales aceptadas: autor51a37d83/QA b7c8066b sobre6f217fec, mainc822e40c. Original25PASS/4FAIL preservada; nueva6PASS y legacy10PASS tras ajuste exacto de seis expectativas escala9. Evidencia compuesta, no integral verde por retries. UI unidades aceptada: autor5a29b739/QA e168d7df sobre12a6f5c8, main local actualbe6ffb59. QA20browser final+1 teclado/doble envío,3puras/estáticos/capturas390/1280; harness no prueba DB. Ambos tasks retirados por factory limpios/aceptados/main.

Catálogo V2 ACEPTADO: autor ffbcf8d1 / QA1bfa3254 sobre82cf1fa7, main local4ed096fd1fc301e314ff555878516008eb31c099. Identidad de producto comprobada; factory integrate/cleanup completados limpio/0procesos/ancestro main, sin force. Antes, catalog-v2-server-0242, autor catalog_v2_server_cp2a_impl, basec822e40c; contratoV2/guard/callback/mutex sin activar mass. Código final68030da912c86a51ae5721b9bd5057aebe88f6cc. QA encontró parser coercitivo y DELETE sin cacheprivate; ambos corregidos. Original882d0831 21PASS/1FAIL/8SKIP+beforeAll fixture inválida preservada; orphan exacto saneado wrapper tras un primer cleanup fallido. a12ed237 10PASS/1FAIL/0skip (cacheDELETE); final68030da9 POS9PASS/0skip compatible con Recipes2PASS a12 y legacy anterior. No integral nueva. Logs completos catalog-v2-server-logs fuera WT. Teardown/0procesos, CI transferida a B. Entrega final ffbcf8d14a392896b8b8321ea567da9eea98b131 limpia, último commit solo handoff; factory deliver completado.

QA catalog_v2_server_cp2a_qa en pos-qa-0242 congelado final82cf1fa7fac07b24c828bd53a89e61610003304a; sin DB,6puros independientes finales PASS y CI final inspeccionada. Entrega ffbcf8d1 adjunta/refresh completado, informe PASS1bfa3254 aceptado. WT QA limpio/0procesos, disponible para continuación explícita con agente nuevo. No mover bajo pruebas.

Bases/costos Recetas ACEPTADOS: autorafb9bac3 / QA0e22389f sobre06dd298b, main local58e9a5efa18d2c496fadd3d28fbfd1a37f2c9e94, producto idéntico.73puras autor y73QA PASS, tipos3/lint/formato/UIguard; guardias24/2 backlog. CI original10PASS1FAIL234.66s por expectativa Micro antigua; adaptación autorizada solo test y costos1PASS56.53s. Cero real válido preservado, tiny incompleto; evidencia compuesta NO integral verde. QA verificó lock combinado catálogo, sin otraDB. AfterAll completos/0procesos; factory integrate/cleanup retiró composition-basis-server-0242, CI liberada. Logs composition-basis-evidence y composition-basis-qa-logs fueraWT.

UI catálogo ACEPTADA/integrada: autorc699852c / QAa2d70273 sobre52c5270d, main localb617c86b4c5cabf3b65a7538714b80ecc3cf118c; identidad producto y factory integrate/cleanup limpio/0procesos/main comprobados. HTTP10/10cac3PASS, browseroriginal13PASS3FAIL +focal6PASS5c31 (evidencia compuesta, NO full16finalverde). QA5puros+3browser propios cruce/POSTincierto/401PASS, capturas390/1280 vistas. Bugs reales incertidumbreglobal y medida↔tarifa cruzadas resueltos, tipos/labels/guardcatalog metadata sinbusiness correctos. Fallos originales setupProvider/MachPort/checklistoverlay/selector/inputhidden preservados, tests reales sinforce. Guardias24/2 backlog, no massreal ni barreras retiradas. WTcatalog-ui-0242 retirado, no reutilizarID.

UI Recetas ACEPTADA: autor116c5a21/QAb5e130b3 sobree3c0f52a, main3de82609. Autor18/18browser+26puros, QA26puros+5browserdecisivosPASS0skip,4capturas390/1280 vistas. Fallosoriginales/extracción/límites enhandoff. Lifecycleharness noauthnativa/HTTPDB. Factoryintegrate/cleanup retiróWT limpio0procesos/main.

Storage0106 ACEPTADO: autor281637c9/QA02ebb456 sobre7f6e0fce, código3b3cef73, main4322456d. CI4/4PASS0skip/retryteardowncompleto, tipos3/28unit+17tooling/lint/formato/UIguard; guardias24/2backlogexacto. SQL/snapshotsolo pos_order4nullable3checksunique+backfilltipoFKreal, nomoney/timestamps/settlementcambios. Root aplicó LOCALprotegida trasQAantesdescriptor: EXIT0/107migraciones, hostguardmigrate-local, log evidence/order-intent-storage/local-281637c9.log. health3201HTTP200después. SinPROD; WTretiradofactory limpio0procesos/main.

InputV2puro ACEPTADO: autor39aab82b (códigoca870730)/QAf11dbb18 sobrecf83d05c, main localaa58db729da8f25b7f4f2448c36955d1314ce89a.72autor+72QA+5independientesPASS0skip/tipos3/lint/formato/UIguard/QAmerchantintegrado; guardias24/2backlog. Transportesintaxis vs fuentesnapshotautoritativo2pasos yhuellacanónicaSHA256, noAPI/guard/scope/locks/DBidempotencia aún. Task/WTpos-command-input retiradofactory limpio0procesos/main.

Actuales DOSAUTORESNUEVOS: pos_catalog_detail_cp2b_impl en pos-readers-v2-0242 basec72630a0, SOLOGETcatalog/detalle, NOlist. RecursoCIEXCLUSIVO suyo. pos_list_cp2b_impl en pos-list-v2-0242 baseaa58db72, SOLOlist.ts/proyecciónagregadaV1default/V2función, SINroutesniheaderHTTPV2 hastaensambleAPIposterior; SINDB/env porahora. Fichasreaders/list comprometidas522/c726 antescódigo. QApos-qa-0242 limpio conserva informeaceptadof11; siguienteentregaQAnewcontexto. TresWTmax; no subdelegar. Detalletotalgross/sale.totalcollected confirmado, listadocerradonetoyanuladaimportehistóricosiningreso. SQLagregadooriginalesracionales LCMgramsFactor/9+9SUMenteros, coreBigIntnormalizauna; nofloat/divisiónNUMERICaproximada/roundSQL/arrayslineas. totalSnapshotnoautoridadabiertasmonedamutable (0.499dobleredondeo). GatealgebraSQLVALUESmass distintoPOScanónico bloqueado.

AntesactivarCP2c, bloquear/retirarCounterlegacyquehoyignorametadata(masaconqtyentera/preciocentavo seinterpretaríaunit): no bastaadaptarPOS, finalAPI410o405compatantesbarreras. ContinúanpendientesAPIcreate/update/cableadoGETlistV2, UInuevaPOS, cierre/efectos reales/cupones/recuperación/tickets, cortepermisos yM1 contemporáneo. Mainaa58db72, devmismo antescheckpoint. Sinpush/PROD; M0/control/RAW/3201/túnel/demos intactos.

Owner ve error repetido “Selected model is at capacity” EN ESTE CHAT PRINCIPAL; no atribuirlo exclusivamente a un subagente ni prometer resuelto. Se usó openai-docs y guía oficial de sobrecarga como explicación compatible, no diagnóstico exacto UI. Root no puede cambiar modelo del chat y no cambió modelos/config. Continúa encargo; guardar checkpoints y preservar entregas. Queda bastante del plan, sin ETA fiable.

La precisión nueva y mass/V4 siguen dormidas hasta CP2c compatible; las expansiones físicas mantienen barreras temporales. El resto del handoff es contexto histórico del mapeo: sus afirmaciones de preparación sin código no describen las entregas ya aceptadas.

## Objetivo actual

Preparar y revisar spec/contratos/plan del **rediseño integral del POS**, usando el laboratorio aprobado como referencia. Usuario pidió agentes y rendimiento production grade. Se ejecutó mapeo con2agentes read-only y revisión documental independiente. Todavía no se implementó producto ni se crearon worktrees de código, DB o servidores de producto.

## Orden de lectura al retomar

1. AGENTS.md y bloque vigente docs/estado/gpt.md; protocolos paralelos/workflow/verificación.
2. `docs/specs/0242-pos-unificado-y-venta-por-peso.md`.
3. `docs/specs/0242-contratos-pos-y-medidas.md` y ADR0155.
4. `docs/factory/0242-plan-implementacion.md` y `0242-performance.md`.
5. `docs/factory/0242-qa-documental.md` (resultado/limitaciones) y mapa actual solo para paths pertinentes.
6. Laboratorio `docs/design-explorations/2026-10-18-mostrador/index.html`, decisiones y versionesv001–v004 como referencia; no copiar su aritmética JS ni su CSS al producto.

## Hechos y decisiones que no deben perderse

- Un POS con lista de abiertas/cerradas/anuladas, creación/editor/confirmación/QR/cobro/resultado/impresión y conflictos. Mostrador tipo venta; deja de existir consola independiente.
- Mesa, Retiro, Delivery: confirmar guarda abierta; cobrar solo al cerrarla. Retiro/Delivery etiqueta obligatoria como Mesa. Mostrador no pide mesa ni paso manual Guardar, pero usa órdenes/ledger actuales.
- Negocio habilita kg/lb/g; catálogo checkbox por peso y tarifa por unidad elegida; captura manual sin balanza. Medidas/tarifas/snapshots exactos en toda cadena, legacy unit.
- Móvil CTA/total final único en pie; escritorio catálogo+orden. Kit/tokens/guardia merchant, tuteo. No reemplazar impresión/estados inciertos por happy path del mockup.
- **PWA/emisión de cupones de premio fuera**. El owner decidió **suspender canje directo de premios por ahora** al retirar legacy. Conservar saldos/registros. No implementar ni mantener un canje directo oculto por asumir continuidad.
- Cupones existentes con reglas visibles para revisión humana, sin parsear texto ni nuevas exclusiones por contenerpeso. Ver contrato final para cantidad bonificada de masa: no adivinarla desde precio.
- Fidelización de compras cobradas afuera y Agenda/otros rubros quedan diferidos. Los escenarios de cita en maqueta no autorizan construir Agenda en esta entrega.
- Cliente/cupón de orden abierta siguen temporales; no copiar persistencia de simulación a DB.

## Hallazgos técnicos

- Producto mapeado `5f9cb2b2af49fa45850c059ef33f8bb69ea15172` dev; reserva docsec454681. Confirmar nuevoHEAD al iniciar implementación, no usar el SHA viejo como candidato.
- Mejora de carga es0238/ADR0154, no0239. POS aún hace GETsession→orders. Ya hay contextoporRequest/seed/pool compartido. Adoptar scopeKey en cliente+servidorPOS antes de dominio y conservar guards; no cookieCache/global auth cache.
- Event sale.closed vigente llega aV3; medidas emitenV4 con replay1–3. Cantidades hoyint en POS/core y consumers usan BigInt de enteros.
- Counter controla también Clientes/entry staff y dominio compartido. Retirar pantalla/API sin migrar accesos rompe operación; no borrar código por nombre.
- Business real es `/api/business/[...path]`, regional/fiscal con revisión compartida. Sales-units es recurso nuevo con la misma concurrencia; catálogo tiene rutas existentes y revisión de venta nueva definida en contrato.
- Datos/finanzas/eventos ya tienen transacciones/idempotencia/aftercommit; conservar garantías, no inventar otro ledger.

## Verificación y límites

La QA de esta etapa es **documental/estática**; no valida rendimiento/DB/auth de implementación inexistente. CP0 debe congelar M0/contratos ejecutables y fichas antes de implementar. DB solo tools/neon-test.sh CI protegida; reservar schema/journal y teardown. Dos implementadores + QA en3WT, coordinador único de estados/índices/integración.

CI remoto main observadoROJO90ebe18f (verify Unit+Neon), antecedente ya conocido. No se arregló por esta tarea documental. No publicar candidato sin tratar los gates aplicables a release. Push/PROD necesitan autorización explícita por caso. Mainlocal no es publicación.

## Trabajo ajeno y procesos

Checkout dev no se cambió de rama. Había artefactos .agents/.claude/.codex/.github y apps public/consumer de Impeccable sin seguimiento; preservarlos. `.impeccable/config.json` tiene excepciones puntuales de fuente/texto añadidas en conversación previa; no mezclarlas en cambios de producto ni resetearlas.

Laboratorio se sirve desde una carpeta temporal propia en localhost4387; fuente persistida en docs/design-explorations. Su disponibilidad tras clear no es garantía del handoff: index.html funciona como archivo local. Servidor3201/túnel/demos previos intactos. No detener procesos ajenos.

## Prompt de reanudación

«Retoma0242 desde docs/estado/gpt.md y docs/factory/0242-handoff.md. Lee spec, contrato, QA documental y plan. Confirma refs/factory, inicia CP0 con dos implementadores y QA según las fichas; conserva alcance POS/peso/auth/performance y retiro legacy, PWA fuera y canje directo suspendido. No push ni PROD.»

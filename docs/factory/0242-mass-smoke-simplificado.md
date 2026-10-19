# 0242 — smoke funcional manual simplificado

Nueva instrucción del owner: reducir harness al objetivo funcional y preparar QA real/candidato para publicar hoy. R2 y nuevas campañas quedan DIFERIDOS. Objetivo operativo45–60min desde este corte, informar un bloqueo concreto sin ampliar campaña. Push/PROD conservan autorización explícita por operación; ahora sólo candidato local y QA.

## Alcance

AutorMISMO /root/p6_mass_m1_author, WTcard/ref pos-ui-card-0242, fuente base0c590e3815cbc3e750cc4c12533252517bdcc007. Cuatro paths ya reservados: tools/pos-measurement/mass-native.mjs, mass-native.test.mjs; apps/merchant/src/modules/pos/server/mass-native.neon.integration.test.ts; docs/factory/0242-m1-mass-handoff.md. PreservarWIP en patchbudget ya existente. No producto/kit/guard/preload/m1/R1/R2/schema/migraciones/otrospaths.

Único entrypoint manual opt-in `POS_MASS_NATIVE=true node tools/pos-measurement/mass-native.mjs smoke --config <selected-CI.json> --port 43242 --output <privado-nuevo>`. No conexión automática a CI ni ejecución por defecto. NextDEV propio explícito prueba funcional, no rendimiento ni certificación compiled. QA de entrega también comprobará buildproduction por separado y candidatoSHA, sin campañas estadísticas.

Eliminar del smoke modosCOPY/freeze, mapas masivos, comparadoresde metadata/generated-source, perfiles CDP/cancelprefetch, bootstrap, campañas ycompatibilidadhistórica. Reusar fixtures/oráculos del caso y testsdominio exactos existentes, no reimplementar matemáticas ni reejecutar toda batería.

## Único recorrido

Seed propio registradoANTESprimerwrite; CIseleccionadaprotegida antiPROD y tools/neon-test.sh para DB; ownerOTPlegítimo sinresetledger/IP. Una venta 0.75kg (UI0,75) ×4.123456789/pasecupón10%→gross3.09/discount.31/collected2.78/puntos2. Crear201/cerrar200/recibo/historial; capturaroriginalrawbody/scope/contract2/clientRequestId/contentType y repetirUNAvez el cierre original. Verificar responsecanónica y sinduplicar orden/pago/puntos/cupón/eventoV4: snapshotsfinancieros/IDs/counts antesdespués. No inventarheaders ni nuevoUUID para replay.

Esperas sólo de respuestas/DOM y efectos financieros propios. Outboxdelegado se registra sin exigir todosapplied ni vacíodecolas; no drenar jobs, no claim0globalcallbacks. Errores de página/API funcionales conservados; cancelprefetch auxiliar no se transforma en motor de clasificación. Sin screenshots/interceptar APIs.

Finally INCONDICIONAL independientedelPASS: cerrarbrowser, detener/esperarsóloservidorpropio, cleanupdirecto porwrapper deIDspropios ySELECT0. Errororiginal ycleanupFAIL separados; no bloquearcleanup porvalidfalse. Preservarowner3201/túnel/ajenos.

## Entrega y comprobación proporcional

Código reducido de verdad (no otroframework), pocosnegativos deconfigantiPROD/optin/cleanupenfallo y replay relevante, sin testsdeverificadoresdeverificadores. Lint/formato/diff ymerchanttsc siTS cambia. UnúnicoSHAclean/receta breve con quécorre yquésuplanta, pruebasproporcionales; QA independiente focal antes delúnicosmoke real y revisión delresultado+limpieza. SourceQA y observaciónreal formanun mismo corte, no multiplicar fichas/reviewers. Nada DB/browser/server/build hasta GOroot concreto; el códigooffline está autorizado ahora.

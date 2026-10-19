# 0242 — CP2c.9 ensamblado HTTP de anulación V2

Estado: preparada. Requiere anulación interna CP2c.8 aceptada. Autor NUEVO con contexto vacío; coordinador fija base, worktree y reserva antes del código. Bloque de una ruta, sin retirada legacy, activación, UI ni nuevo dominio. Leer protocolos y contrato 0242 de anulación/scope/versiones.

## Resultado y contrato

POST /api/modules/pos/orders/:id/void selecciona posReadContract(request) dentro del handler protegido por posRoute. Ausente/1 conserva voidPosOrder legacy y su cuerpo históricamente ignorado; 2 llama voidMeasuredPosOrder con PosVoidV2 opcional. Desconocido devuelve 409 pos_client_upgrade_required antes de leer cuerpo o ejecutar dominio. Guard ordinario y scope preceden handler y dominio; respuestas privadas/no-store. No agregar autenticación alternativa ni GET de sesión/módulos.

Para V2 distinguir cuerpo ausente de JSON inválido: ausencia válida equivale al comando opcional sin versión; JSON presente usa el lector estricto existente y respeta sus límites. No aceptar JSON malformado como ausencia. Si el lector común no permite distinguirlos, presentar al coordinador una solución local al handler antes de extender otro archivo. La versión enviada se valida en dominio; stale devuelve 409 version_conflict con orden V2 canónica. UUID, tenant, módulo y transición se validan en las capas aceptadas, sin duplicar su lógica. Anulada reenvía su snapshot congelado y no publica otro evento; cerrada devuelve not_open, sin cambiar pagos/ventas.

La ruta transporta cadenas de cantidades/tarifas/importes y metadatos V2 completos sin pasar por DTO legacy. No adapta masa a Number. Esta entrega habilita solo opt-in compatible: no activa masa ni retira escritores viejos ni certifica autenticación nativa Next.

## Paths autorizables

- apps/merchant/src/modules/pos/server/routes.ts, solo import y handler de void.
- apps/merchant/src/modules/pos/server/void-api-v2.neon.integration.test.ts.
- docs/factory/0242-cp2c-void-api-handoff.md.

Sin cambios de dominio/readers/list/metrics, close, contratos públicos, guards/core, schema/journal, UI/kit/tooling/dependencias/estados/índices. Un defecto de una dependencia aceptada vuelve al coordinador antes de editar fuera de scope.

## Aceptación y evidencia

Node24, tipos merchant, lint/formato/UIguard y guardias pertinentes. Prueba HTTP focal con fixture canónica unit V2: comando con versión, cuerpo ausente, replay y evento único; ausente/1 conserva DTO legacy; desconocido con JSON inválido no lee cuerpo ni produce efectos. V2 con JSON inválido y versión inválida falla sin efectos. Conflicto devuelve orden V2 íntegra; tenant ajeno no lee/anula; guard/scope incorrecto se rechaza antes del dominio; éxito/error private/no-store. Reutilizar la evidencia compatible de locks, rollback, snapshots y analytics del bloque interno, sin repetir su matriz financiera ni sus carreras por ceremonia.

DB exclusiva solo tools/neon-test.sh con env CI seleccionado por coordinador, sin copiar/imprimir secretos. Reservar hasta teardown verificado por IDs propios, incluyendo owners/sesiones y cero procesos. Fuente congelada antes de checks; logs fuera del worktree con SHA/base/config/comandos/exits/skips y fallos conservados. Harness dispatcher/guard explícito no equivale a Next/auth nativos. QA NUEVO independiente; autor conserva fixes hasta aceptación. Sin browser/build/fullverify/M0/M1, migración, push ni PROD; preservar 3201/túnel/demos y artefactos ajenos.

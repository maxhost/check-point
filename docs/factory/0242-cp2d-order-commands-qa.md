# 0242 CP2d.3 — QA independiente: FAIL

Candidato congelado `f0c67a29da54bf433aeb705e96ebbbbc9863394a`, autor `f157a57d7a6784aad944e13b463874225ceb8f0c`, sobre main local `fc28dfbb` (acreditación aceptada). Worktree QA `/private/tmp/checkpass-pos-0242/pos-qa-0242`. Revisión nueva del contrato0242 §3, ficha, handoff, transporte capturado, PosCache y consumidores/listado pertinentes. Solo este informe se edita; no correcciones de producto/tests.

## Hallazgos bloqueantes

1. **Resumen cerrado diverge del listado V2.** `measured-order-cache.ts:49–51` copia `order.total` bruto y toma `saleTotal` exclusivamente de `sale`. `read.ts:245` devuelve settlement.gross en detalle, mientras `list.ts:209–232` y `measured-summary.ts:179–204` proyectan ambos importes desde settlement.collected para closed, incluso venta anónima sin core sale. Reproducción de proyección pura con línea unitaria, closed/sale:null, settlement gross=collected10: saleTotal observado null, esperado10. Variante sintética gross10/collected8: observado total10/saleTotalnull, esperado8/8. No simula un cierre HTTP ni certifica elegibilidad comercial del descuento. Impacto: recuperación canónica corrompe importes de una fila histórica conocida. Open conserva bruto; voided conserva bruto/saleTotalnull según contrato.

2. **Respuesta abierta tardía degrada estado terminal de igual versión.** `measured-order-cache.ts:15–24` protege solo versiones estrictamente mayores. Con detalle y summary closed v3, aceptar open v3 reemplaza ambos por open y mueve la fila a abiertas; misma reproducción para voided v3. Esperado: conservar estado terminal conocido y no confirmar abierto obsoleto. Es una carrera posible: `close.ts:302` y `orders.ts:301` actualizan estado/closedAt sin incrementar version. Impacto: estado cerrado/anulado ya observado se pierde pese a protección nominal de versión.

3. **Historial pendiente sin snapshot sobrevive al éxito.** Ejecutar beginWrite, iniciar read(historyKey) con promesa pendiente y sin entrada previa, aceptar orden canónica open y resolver aquella lectura con historial antiguo vacío. `measured-order-cache.ts:37` retorna antes de invalidar generation de historyKey: la promesa resuelve exitosamente y deja [] válido. Esperado: descartar lectura antigua mediante DiscardedPosRead sin cargar historia adicional. Impacto: historial obsoleto válido después de guardar. El test existente cubre una lectura pendiente cuando ya hay snapshot, no esta variante.

Señal reproducible externa: `/private/tmp/checkpass-pos-0242/order-commands-qa-evidence/reproduce.cjs` y `reproduce.log`. Desde este WT, con Node24: `node /private/tmp/checkpass-pos-0242/order-commands-qa-evidence/reproduce.cjs`. El script transpila únicamente fuentes reales mediante TypeScript instalado, invoca facade/PosCache públicos y registra esperado/observado; EXIT0 significa ejecución del diagnóstico, **no PASS de aceptación**. Coordinador avisado inmediatamente; autor conserva fixes.

## Checks e identidad

Node24.20.0, pnpm11.4.0, hooks `.githooks`. Coinciden SHA256 del lockfile, vitest raíz/merchant, tsconfig merchant y las cuatro fuentes/tests con `order-commands-evidence/identity.log` del autor. Lint/formato/UIguard EXIT0 del autor reutilizados por identidad; sin cambios a sus cuatro paths. Advertencia existente MODULE_TYPELESS_PACKAGE_JSON en guard.

- QA: `pnpm exec vitest run apps/merchant/src/modules/pos/ui/measured-order-commands.test.ts apps/merchant/src/modules/pos/ui/measured-order-cache.test.ts`: EXIT0, 35/35, 2 archivos, 0 skips. Log `order-commands-qa-evidence/tests.log`.
- QA integrado: `pnpm --filter @mi-pasaporte/merchant typecheck`: EXIT0. Log `order-commands-qa-evidence/types.log`.
- Revisión/casos verdes: captura real V2 hasta fetch mocked; misma UUID/body/scope en retry explícito; mutación posterior y double click; DTO actual closed/voided; PUT incierto→409 revisión; payload/products completos; clasificación4xx/408/5xx; scope/epoch/retiro y callbacks; summary adelantado produce cache_revision_ahead sin order falso. Sin mapa paralelo ni GET adicional; historyStatus obligatorio. Esos PASS focales no neutralizan los tres fallos de interacción.

Fallos iniciales del autor conservados: fixture compartida (24PASS/3FAIL) y conversionVersion incorrecta; logs originales tests-fixture-failure.log/types-fixture-failure.log no se atribuyen como PASS. No se relajaron tests desde QA.

## Límites y entrega

Sin DB/env/wrapper/browser/build/fullverify/M0/M1, servidores/túnel/3201, auth nativa, publicación ni PROD. Fetch mocked no acredita idempotencia servidor/autenticación real. Caller futuro debe configurar contractVersion2 y historyStatus acorde al mismo PosCache; retirar instancia solo por retiro real del editor/contexto, nunca para abandonar creación incierta y generar otra key.

Checks propios finalizados; cero procesos persistentes iniciados. `ps` inicialmente EPERM: coordinador avisado y lectura acotada escalada autorizada confirmó solo la propia inspección/rg, sin procesos QA pendientes. Informe único commit local; checkout limpio al entregar. Requiere corrección del autor y nueva revisión focal de hallazgos antes de aceptación.

## Recheck de la misma entrega — PASS

Candidato congelado `dc0b7ad316fe8fe51925753e3f9444a1e5288b6d`, incluyendo fix autor `7dd6bcda52aa243fd1acc4b08dc2facc47d9988e`. El FAIL anterior y su evidencia permanecen: este PASS acredita exclusivamente la revisión corregida. Revisión focal del diff de facade y regresiones, handoff actualizado e identity-fixes.log; manager de producción sin cambios. Sin nuevo alcance ni cambios de producto desde QA.

Repetido el mismo diagnóstico externo original, sin modificarlo: `node /private/tmp/checkpass-pos-0242/order-commands-qa-evidence/reproduce.cjs`. Resultado observado contra esperado:

- Cerrada anónima gross=collected10: summary total10/saleTotal10.
- Proyección sintética cerrada gross10/collected8: summary total8/saleTotal8; detalle conserva bruto10. No certifica un cierre ni elegibilidad comercial del descuento.
- Detalle y summary closed/voided v3 frente a respuesta abierta tardía v3: se preservan closed/voided, ninguna reaparece en abiertas. Si solo summary acredita estado terminal, las nuevas regresiones del manager verifican conflicto cache_revision_ahead con receivedOrder/summary, sin order autoritativo inventado.
- Historia ausente y lectura pendiente iniciada después de beginWrite: respuesta antigua rechazada con DiscardedPosRead; no historial fabricado ni GET adicional.

La facade invalida historyKey antes del retorno sin snapshot, conserva estados terminales en empates de versión y proyecta cerrado desde settlement.collected, luego sale.total, luego order.total. Open/voided conservan bruto y saleTotal:null. Los tres bloqueantes originales quedan resueltos en esta revisión.

Comprobaciones propias sobre este candidato, todas finalizadas EXIT0:

- Mismos dos archivos focales de Vitest: **46/46**, 2 archivos, **0 skips**, incluyendo las regresiones afectadas y transporte real hasta fetch mocked.
- `pnpm --filter @mi-pasaporte/merchant typecheck`: EXIT0; repetido por cambios de facade/tests y candidato integrado nuevo.
- Identidad SHA256 coincidente con identity-fixes.log: lockfile, configs Vitest/tsconfig y cuatro archivos de fuentes/tests. Node24.20.0/pnpm11.4.0. Se reutilizan lint/formato/UIguard del autor, logs qa-fixes-lint/format/guard.log EXIT0; warning de guard existente, sin aumentos.

Logs propios preservados junto a los anteriores en `/private/tmp/checkpass-pos-0242/order-commands-qa-evidence/`: recheck-identity.log, recheck-reproduce.log, recheck-tests.log y recheck-types.log. El diagnóstico EXIT0 indica ejecución; aceptación se apoya en revisión de observaciones y regresiones con aserciones, sin retries ni skips. Formato del informe y git diff --check EXIT0.

Mismos límites originales: sin DB/env/browser/build/fullverify/auth nativa/PROD/push. Cero checks o procesos persistentes propios pendientes; checkout limpio al entregar commit exclusivo del informe. PASS QA local del candidato citado; aceptación/factory/integración/publicación corresponden al coordinador y a las autorizaciones vigentes.

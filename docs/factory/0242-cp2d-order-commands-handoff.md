# 0242 CP2d.3 — comandos V2

Autor NUEVO A, base `75bbd1774105a68ed4ec9f70e3dfbd8190524c5c`, worktree `/private/tmp/checkpass-pos-0242/measured-order-commands-0242`. Revisión entregada: commit que contiene este handoff; SHA exacto e identidad de configuración en `/private/tmp/checkpass-pos-0242/order-commands-evidence/identity-fixes.log`. Solo los cinco paths reservados, sin dependencias nuevas ni cambios de transporte/contrato/legacy. API propuesta y aprobada por coordinador antes de código.

## Consumo

`new MeasuredOrderCommands(clientV2, samePosCache, {historyStatus: 'active'|'voided', uuid?})`. El cliente debe estar configurado con contractVersion2; historyStatus es obligatorio y coincide con el filtro de construcción de PosCache. El bloque no crea cache, hace lecturas iniciales ni monta UI. `getSnapshot/subscribe` sirven a useSyncExternalStore. `create(draft)` genera UUID; `update(id, snapshotCompleto)` no añade UUID; `retry()` solo reenvía uncertain explícitamente. `retire()` es permanente y debe llamarse al desmontar/retirar identidad del editor. La captura real rechaza también reenvío bajo identidad cambiada; epoch de cache protege cambios de contexto.

Estados idle/pending/uncertain/conflict/rejected/confirmed/retired. Pending comparte promesa; llamadas con otro borrador conservan intención original visible, nunca sustituyen cuerpo. Uncertain bloquea create/update y conserva la captura y copia profundamente congelada; no existe reset que permita abandonar una creación incierta y generar otra clave. Una nueva instancia requiere retirada real del editor/contexto, no es recuperación. Tras rechazo/conflicto una llamada deliberada create/update inicia intención revisada. No hay retry automático.

Errores conocidos HTTP4xx salvo408 son definitivos:409→conflict, otros→rejected. 401/context_changed retiran. HTTP408/5xx, red, parse y DTO exitoso inutilizable→uncertain. Conflictos se mantienen íntegros en `state.error` (PosError.payload), incluyendo `version_conflict.order` y `catalog_changed.products`. Códigos409 desconocidos siguen conflictos;412 nunca es éxito. PUT incierto reenviado conserva version/body;409 posterior queda revisión, aunque partes coincidan. Recovery create acepta DTO actual closed/voided sin recapturar catálogo.

## Caché y fronteras

MeasuredOrderCache utiliza públicas de la misma PosCache, sin mapa paralelo ni métodos legacy numéricos. Actualiza detalle canónico y parchea solo historial existente, lineCount de número de líneas y total/saleTotal strings. Conserva versión máxima de detalle y guards epoch/generation; descarta lecturas previas pendientes. No GET detalle/history/session/modules/catalog ni invalidación que dispare GET propio.

Lista normal incluye open y closedToday closed+voided conforme list.ts; lista voided nunca recibe open/closed. Una fila histórica ya conocida se actualiza en su partición. Si una respuesta cerrada/anulada no tiene fila histórica conocida, conserva snapshot parcheado pero inválido, sin adivinar día local ni cargar historial. No inventa entradas closedToday. El futuro editor puede ofrecer lectura/revisión explícita.

Si historial ya observó versión superior al detalle recibido, conserva historial, guarda detalle recibido inválido y publica conflicto local `cache_revision_ahead` con `{receivedOrder, summary}`. No presenta ese recibido como orden autoritativa actual ni como éxito. Requiere revisión/lectura explícita, sin autoretry.

## Evidencia focal

Logs fuera WT: `/private/tmp/checkpass-pos-0242/order-commands-evidence/`. Node24.20.0, pnpm11.4.0, hooks `.githooks`. Config/lockfile hashes en identity-fixes.log; identity.log conserva entrega inicial rechazada.

- `pnpm exec vitest run apps/merchant/src/modules/pos/ui/measured-order-commands.test.ts apps/merchant/src/modules/pos/ui/measured-order-cache.test.ts`: EXIT0,46 tests/2 archivos,0 skips (qa-fixes-tests.log). Transporte real createPosClient→posRequest→panelRequest→fetch mocked; sin DB/auth nativa.
- `pnpm --filter @mi-pasaporte/merchant typecheck`: EXIT0.
- `pnpm exec eslint apps/merchant/src/modules/pos/ui/measured-order-{commands,cache}{,.test}.ts`: EXIT0.
- `node tools/ui-guard.ts --base 75bbd1774105a68ed4ec9f70e3dfbd8190524c5c`: EXIT0,2 archivos producción,sin aumentos. Advertencia existente MODULE_TYPELESS_PACKAGE_JSON.
- Prettier sobre cuatro fuentes y handoff: EXIT0.

Fallos iniciales honestos: tres casos compartían fixture y la mutaban entre tests (24PASS/3FAIL); se aisló cada borrador con structuredClone, no se debilitó aserción. Typecheck detectó conversionVersion de fixture incorrecta (number); corregida a literal real mass-si-1. Logs tests-fixture-failure.log/types-fixture-failure.log conservados; los resultados previos no son PASS del candidato.

Casos observados: create perdido/recovery misma UUID/body/headers y mutación posterior; double click; recuperación closed/voided; PUTconflictos completos y sin retries; PUT perdido→409 sin inferir éxito;403/412/422 vs408/500/503; éxito sin JSON/DTO; scopeA→B antes/después await, retire y cacheepoch; detalle versionmonotónica/lectura antigua descartada; summary adelantado; lineCount mixto sin sumar masa/unidades; ausencia GET extra; filtro explícito de anuladas.

Sin DB/env/wrapper/browser/build/fullverify/M0/M1, servidor/túnel/3201 ni push/PROD. Estas pruebas no certifican idempotencia de servidor/auth real; reutilizan contratos y transporte aceptados. Sin procesos persistentes iniciados. QA NUEVO independiente pendiente; autor conserva fixes. Factory/integración/cleanup corresponden al coordinador.

## Corrección tras QA independiente FAIL

La entrega inicial f157a57d fue rechazada por QA 808cb7a5b11752ae48b5b46cfb83f682c8e5e80e sobre candidato combinado f0c67a29. No se atribuye aceptación al PASS de35 tests original. Se leyeron informe y reproducción originales; sin editar sus artefactos ni incorporar su ref.

Los tres hallazgos se corrigieron solo en facade/tests propios:

1. El historial closed proyecta `total = saleTotal = settlement.collected`, con fallback legacy `sale.total`, luego `order.total`. Open/voided proyectan bruto `settlement.gross ?? order.total`, saleTotal:null. Detalle conserva DTO canónico sin cambiar importes. Regresiones usan settlement generado por kernel puro, sin afirmar elegibilidad comercial de descuento anónimo ni cierre HTTP.
2. En empate de version gana estado terminal: open < closed < voided. Detalle terminal conocido se conserva; si solo historial acredita estado posterior, se conserva historial y se publica cache_revision_ahead con receivedOrder/summary, guardando detalle inválido sin construir una orden autoritativa del resumen. Dos regresiones también verifican ese resultado a través del manager/transporterealfetchmock.
3. Cada accept invalida generation de historyKey antes de cualquier retorno, aun sin snapshot: lectura pendiente iniciada después de beginWrite termina DiscardedPosRead. No hay GET ni fabricación de historial.

Regresiones agregadas antes del fix:7FAIL/9PASS en cache (qa-regressions-before.log), confirmando los tres problemas. Tras fix:46/46 tests,2 archivos,0 skips,EXIT0 (qa-fixes-tests.log). Merchanttypecheck, lint, UIguard y formato EXIT0 (qa-fixes-types/lint/guard/format.log). Config y comandos en identity-fixes.log. Gates amplios no ejecutados.

También se ejecutó sin modificar el diagnóstico externo de QA: `node /private/tmp/checkpass-pos-0242/order-commands-qa-evidence/reproduce.cjs`, log propio qa-fixes-reproduce.log. Ahora observa10/10,8/8,closed/voided preservados en version3 y DiscardedPosRead. Su EXIT0 solo indica ejecución; las aserciones vinculantes están en las regresiones. El FAIL original y sus logs siguen conservados. Nuevo QA independiente del candidato combinado pendiente; autor conserva fixes.

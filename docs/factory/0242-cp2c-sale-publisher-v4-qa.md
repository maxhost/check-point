# 0242 CP2c.4 — QA independiente del publisher opt-in V4

Resultado: **PASS** de entrega y combinación sobre candidato congelado `4568f4e74e46cb2ec4553d3fb9a3f727acaffd66`, base integrada `8770048c`, autor final `66b7d4a334a61be3e4d5e7c7c3ee4eb360fa7a07`. Handoff final leído. Sin hallazgos bloqueantes reproducibles. El PASS es del publisher interno explícito; no acredita activación ni cierre POS E2E.

## Alcance observado

- Entrada separada `publishMeasuredSaleClosed`; settlement, ResourceCapture, metadata efectiva y comisión por línea obligatorios. Correspondencia biyectiva de IDs y posiciones, originales racionales por línea frente a snapshots servidor de cantidad/tarifa/medida; strings conservados, extremos unit confiables y restricciones mass del helper aceptado. No reconstruye tarifa desde neto ni decide autoridad con Number.
- Payload V4 conserva dinero/originales/normalizationAdjustments, etiquetas/comisiones, payments/paymentOriginals y referencias; añade cantidad/medida explícitas y excluye unitPrice privado. Decoder medido actual valida antes del mismo append/deliveries transaccionales. Legacy publisher/alias/consumers/callers/close no cambian; índice sólo exporta publisher/tipo.
- Lock advisory por negocio/tipo/source precede al lookup durable. Un replay devuelve ID/payload/closedAt persistidos antes de validar captura, líneas, settlement o metadata nuevos; no captura punteros ni añade deliveries. Garantía concurrente limitada a V4 cooperativos en READ COMMITTED. Legacy no cooperativo u otro aislamiento siguen sujetos a unique/serialización y retry de la transacción completa por el caller; no se certifica éxito automático de esas carreras.
- Masa tiene payload con recursos reales pero sin fila POS/core ni cierre; unit sí parte de orden POS abierta real. No confundir publicación directa con venta medida canónica, autorización HTTP, ejecución de handlers ni cierre E2E.

## Reproducción QA sobre 4568f4e7

Node24.20.0, pnpm11.4.0, lockfile SHA256 `4cfe18864f12af4fe3b0cd84ab477e936ecd52d96847579cc087e6e13b020821`. Evidencia privada completa en `/private/tmp/checkpass-pos-0242/evidence-sale-publisher-v4/qa-4568f4e7/`: identidad, comandos, salidas, exit y script/config externos al WT.

- `pnpm --filter @mi-pasaporte/merchant exec vitest run src/server/module-events/publish-measured.test.ts src/server/module-events/decode-measured.test.ts src/server/module-events/decode.test.ts`: **102 PASS, 0 skips, EXIT0** (`pure.log`).
- `pnpm --filter @mi-pasaporte/merchant typecheck`: **PASS, EXIT0** (`types-merchant.log`), comprueba la combinación con UI aceptada.
- `pnpm exec vitest run --config /private/tmp/checkpass-pos-0242/evidence-sale-publisher-v4/qa-4568f4e7/vitest.config.mjs`: **3 PASS, 0 skips, EXIT0** (`independent.log`). Señales nuevas fuera del árbol: cantidad1→2 con tarifa0.000000001 conserva normalizado USD0.00 pero se rechaza por original; proveedor de pago vacío se rechaza con settlement válido; replay con Proxy que lanza ante cualquier lectura distinta de businessId/sourceOrderId devuelve evento completo y realiza un lock/lookup. El doble transaccional prueba ausencia de reobservación en la función, no sustituye concurrencia/rollback DB reales.

Primer intento del script externo: error de setup de QA por ruta financiera `/financial/index.ts` inexistente, 0 tests ejecutados, EXIT1; preservado en `independent-setup-failure.log`, excluido del PASS. Se corrigieron únicamente imports externos a `financial.ts`/`measures.ts`; producto/tests del WT intactos.

## Evidencia compatible inspeccionada y reutilizada

Directorios de autor `/private/tmp/checkpass-pos-0242/evidence-sale-publisher-v4/{6a1826b2bd62c748f1649a3ddadddfff8694c36b,66b7d4a334a61be3e4d5e7c7c3ee4eb360fa7a07}/`, manifest y logs completos leídos. Diff66b→4568 de publisher/index/tests de entrega, DB/domain, lockfile y configuración Vitest vacío; diferencia de base c031→877 sólo UI/docs/harness medido ya aceptados. Producto publisher/index idéntico desde6a. La recolocación de la suite a `apps/merchant/src/modules/sale-publisher-v4.neon.integration.test.ts` usa imports reales equivalentes en ensamblado raíz, con extensión coordinada; evita dependencia falsa POS→Recipes sin editar guardias.

CI real inicial6a: **5 PASS / 1 FAIL / 0 skips, EXIT1**. Pasan concurrencia cooperativa, rollback posterior al append, negativos sin append parcial, masa interna y replay legacy. El fallo era del oráculo que esperaba compositionRevisionId cuando el pointer publicado es recipeSaleResolution.id. Diff final conserva los otros cinco cuerpos y corrige sólo ese caso comprobando además resolución del mismo negocio/producto y composiciónRevisionId real; sin cambiar producto.

CI afectada66b con wrapper exclusivo `tools/neon-test.sh src/modules/sale-publisher-v4.neon.integration.test.ts --no-file-parallelism -t 'persists complete V4'`: **1 PASS / 5 filtrados, EXIT0**. Demuestra persistencia, decoder, referencias reales, deliveries habilitadas y replay íntegro tras cambiar pointer/activación con captura inválida. Los cinco filtrados no cuentan como PASS nuevo; se reutilizan sus resultados compatibles6a. **No hubo corrida integral Neon verde.** Ambos teardowns asertaron negocio/membresías/owners+staff/sesiones/eventos/deliveries0 por IDs propios; no se crearon consumidores ni staff. Warning de rol consumidor CI ausente queda fuera del alcance, sin afirmar cobertura de ese rol.

Autor66b: tipos merchant/lint/formato/UIguard y puros102 PASS; DB/domain tipos6a compatibles PASS. Guardias completas: **18 PASS / 2 FAIL, EXIT1**, exclusivamente backlog idéntico a base: import expenses immediate→stock/count y literales core en context-controller, context-refresh, checklist-context-resource, policy-simulation y analytics lifecycle. Diff de esos archivos y guardias vacío; cero offenders nuevos de esta entrega. No declarar guardias globales verdes.

QA no abrió env ni ejecutó DB/wrapper/browser/build/fullverify/M0/M1/PROD/push. No hay pruebas activas pendientes; el único cambio del WT es este informe QA antes de su commit, sin producto/tests/estados/índices modificados. Integración, aceptación factory y cleanup corresponden al coordinador.

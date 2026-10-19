# 0242 CP2c.4 — publisher interno opt-in V4

Base: `c031e0d1ee01084784d231c5cf6ff539bf38e830`. Ref/worktree: `sale-publisher-v4-0242`, `/private/tmp/checkpass-pos-0242/sale-publisher-v4-0242`. Candidato: SHA de esta entrega; evidencia externa identificada por SHA bajo `/private/tmp/checkpass-pos-0242/evidence-sale-publisher-v4/`.

## Contrato implementado

`publishMeasuredSaleClosed(tx, args)` es una entrada explícita separada. Requiere settlement financiero, captura de recursos de esa transacción, metadata de pagos efectivos, comisión explícita por línea y snapshots servidor confiables con ID/posición/producto/etiqueta/cantidad/tarifa/medida. No es un validador HTTP ni recupera autoridad desde entradas de cliente. La función pura `buildMeasuredSaleClosedPayload` permite verificar ensamblado sin DB; sólo el publisher y su tipo se exportan desde el índice.

Valida settlement completo y correspondencia biyectiva de IDs/posiciones únicas. Compara el bruto original racional por línea con `exactSnapshotLineGross`, que preserva extremos unit históricos y aplica límites mass estrictos. No compara sólo totales normalizados ni reconstruye tarifa desde neto. Cantidad/tarifa deben ser strings; cantidad original se conserva en wire y tarifa queda privada. Producto/etiqueta/comisión/medidas, dinero/originales/ajustes, pagos/originales y referencias se validan con el decoder medido antes de append.

`closedAt` sale exclusivamente de `capture.captured_at`. El append y las deliveries usan la misma transacción del caller y la elegibilidad explícita capturada. No se cambia `publishSaleClosed`, los aliases V1–V3, los callers actuales, close, consumers, esquema ni barreras.

## Replay y concurrencia

Un advisory transaction lock con clave negocio + sale.closed + sourceOrderId precede al lookup durable. En READ COMMITTED serializa publishers V4 cooperativos. La clave única durable sigue protegiendo carreras con legacy no cooperativo; en ese caso o bajo aislamiento de snapshot más fuerte puede producir error unique/serialización y el caller debe reintentar la transacción completa. No se promete éxito automático para esos casos, ni se modifica la política legacy.

Después del lock, un evento existente se devuelve con ID, payload y closedAt persistidos antes de validar inputs nuevos. No consulta punteros/activación ni llama append ni crea deliveries. Un evento legacy existente se devuelve en su versión original, sin promoverlo a V4. La captura explícita es responsabilidad del caller; debe evitar reobservar recursos para una recuperación ya conocida. El publisher no llama al capturador.

## Verificación y límites

Los logs completos del SHA congelado contienen comando, runtime/configuración, salida y exit, incluidos fallos y skips. Archivos previstos: `types-db.log`, `types-domain.log`, `types-merchant.log`, `lint.log`, `format.log`, `ui-guard.log`, `pure.log`, `guards.log`, `neon.log` y manifiesto con SHA/base/lockfile/env seleccionado. Consultar esos logs y el handoff del autor para resultados observados; este documento no declara PASS anticipado.

La selección pura cubre payload, fuentes originales distintas aunque normalicen igual en moneda minor0/2, extremos legacy y precisión mass, metadata incompleta y entradas inválidas, decoder medido y decoder legacy. La integración directa cubre fuente unit de orden POS abierta real, captura de revisión de composición real, deliveries habilitadas, replay tras cambiar puntero/activación con captura inválida, concurrencia cooperativa, rollback después del append, rechazo sin efectos y replay legacy. No ejecuta handlers de las deliveries.

Masa se prueba exclusivamente como publicación interna de payload exacto sin filas POS/core medidas. No equivale a cierre E2E, autorización HTTP de cierre, venta medida canónica ni activación de V4 en producción. No se amplían barriers ni se fabrican filas bloqueadas. Sin browser/build/fullverify/M0/M1/PROD/push. La DB CI permanece reservada exclusivamente hasta teardown y comprobación de negocio, membresías, owners/staff, sesiones, eventos y deliveries ausentes por IDs propios; no se crean staff ni consumidores en esta suite.

Cinco paths de ficha con extensión coordinada de ubicación de suite: `apps/merchant/src/modules/sale-publisher-v4.neon.integration.test.ts` sustituye al path original bajo POS para respetar las fronteras de módulos. Los otros paths son publisher nuevo, test puro, export mínimo del índice y este handoff. QA independiente e integración/factory quedan al coordinador. El autor conserva los fixes hasta aceptación.

## Revisión tras evidencia inicial

`6a1826b2bd62c748f1649a3ddadddfff8694c36b`: tipos3/lint/formato/UIguard/puros99 pasan. CI inicial: cinco casos pasan y uno falla (sin skips); teardown completo0. El caso de captura esperaba erróneamente composition.revisionId, cuando el recurso publicado referencia recipeSaleResolution.id. Se corrige al ID de resolución real y se comprueba su vínculo con la revisión. No se cambia el publisher.

La suite se mueve al ensamblado raíz por autorización del coordinador: imports de Recetas dentro del test POS infringían la guardia entre módulos. Se conservan imports/nombres reales; no se altera la guardia. El backlog de guardias previo incluye expenses immediate→stock/count y literales core en context controller/refresh/checklist, policy-simulation y analytics lifecycle. El candidato revisado debe eliminar sólo sus offenders nuevos; guardias completas permanecen FAIL por ese backlog. Los cinco casos CI no afectados mantienen evidencia compatible del candidato inicial, con mismos cuerpos, fixtures/DB y configuración, salvo ubicación/imports relativos. La revisión repite el caso de captura/replay afectado en SHA congelado; los otros cinco pueden aparecer filtrados, sin contarlos como PASS nuevo. Los logs conservan ambos candidatos.

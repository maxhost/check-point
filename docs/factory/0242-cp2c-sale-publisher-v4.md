# 0242 — CP2c.4 publicación opt-in de venta medida V4

Estado: preparada, sin autor/reserva. Requiere ensamblado HTTP CP2b.7 aceptado antes de asignar nuevo autor/contexto vacío. Coordinador fija base/factory; sin subdelegar. Entrega backend acotada, independiente del carrito UI. Leer protocolos, contrato0242 §4, decoder/eventos y publishers aceptados pertinentes; no historia completa.

## Resultado

Añadir publisher interno explícito de sale.closed eventVersion4 para el futuro cierre medido. Reutilizar appendModuleEvent, captura de resourceVersions/subscriber eligibility y FinancialSettlement/decoder medido existentes. No modificar ni activar los callers legacy publishSaleClosed (V1–V3), no ampliar su alias SaleClosedEvent para hacer pasar tipos, no conectar close ni retirar barreras. Esta entrega no significa venta por peso canónica ni cierre POS E2E.

Input del productor servidor contiene negocio/sourceOrderId/local/operador, snapshots originales quantity/unitPrice/measure y sourceLineId/producto/nombre, settlement autoritativo, metadata de pagos, comisión por línea y ResourceCapture explícita de la transacción. Proponer firma/reutilización antes de código. Validar correspondencia biyectiva de líneas/posiciones, originales racionales contra cantidad/tarifa/medida confiables y money congelado; no aceptar un total igual como prueba de fuentes iguales. Cantidad/precio strings, legacy unit confiable preservado, mass validada con helpers aceptados; sin Number para autoridad ni inferir precio desde neto redondeado.

Payload V4 conserva toda información V3 (etiqueta/comisión, dinero/originales/normalizationAdjustments, payments/paymentOriginals, referencias de recurso) y añade cantidad Decimal/measure explícita. unitPrice privado de validación no se agrega al contrato wire existente. closedAt usa captura autoritativa congelada y misma identidad de source/evento; no reloj reobservado al reintentar. Validar payload con decodeMeasuredSaleClosedEvent antes de persistir; no modificar decoder/validator para ocultar fallos. Core no importa ni nombra módulos opcionales.

Replay conserva evento/ID/payload completo, capturedAt/referencias/deliveries originales y no recaptura punteros actuales ni añade entregas. Verificar primero evento existente y devolver resultado congelado; no reemplazarlo por nueva observación. No ampliar silenciosamente la política de carreras/replay de legacy: describir qué lock/unique exige el caller y probar la garantía real. No publicar eventos con metadata de pago/línea incompleta ni efectos parciales. El append y sus deliveries siguen dentro de la transacción del caller; rollback revierte ambos.

## Paths autorizables

- apps/merchant/src/server/module-events/publish-measured.ts, nuevo
- apps/merchant/src/server/module-events/publish-measured.test.ts, nuevo si aporta señal pura
- apps/merchant/src/server/module-events/index.ts, export mínimo
- apps/merchant/src/modules/pos/server/sale-publisher-v4.neon.integration.test.ts, nuevo
- docs/factory/0242-cp2c-sale-publisher-v4-handoff.md

Sin publish legacy/close/grant-coupon/subscriptions/consumers/metrics/commission/recipes/schema/journal/UI/kit/guardias/tooling/deps/estados/índices. ResourceCapture ya existe y no depende de cantidad; reutilizarlo sin reescribirlo. Si se requiere helper común o ajuste de tipo fuera de paths, proponer extensión antes de editar.

## Gate

Node24, tipos3/lint/formato/UIguard/guardias pertinentes y puros de payload/autoridad/legacy. CI exclusivamente tools/neon-test.sh/env seleccionado y reserva exclusiva hasta teardown. Persistir V4 con settlement y referencias reales, deliveries no vacías a consumidores habilitados, decoder acepta y payload/metadata exactos; replay tras cambiar punteros/activación no cambia payload/time/deliveries ni IDs. Fallo transaccional posterior deja evento/deliveries0. Rechazar fuente original distinta aunque importe normalizado coincida, IDs duplicados/omitidos, pago sin metadata y medida inválida. Unit canónico puede tener orden real; mass en pruebas de payload sin filaPOS/core no es venta E2E, distinguirlo sin fabricar filas bloqueadas. Legacy publisher y consumidores no cambian; reusar evidencia compatible, ampliar solo por interacción concreta.

Logs completos fueraWT ligados SHA congelado/config/comando/exit/fallos/skips/límites. Cleanup por IDs propios incluye negocio/consumidores/membresías/owners/staff/sesiones y verifica ausencia; no borrar por prefijo. No browser/build/M0/M1/fullverify ni activation/cierreE2E afirmados. QA nuevo independiente; autor conserva fixes. Entrega limpia0procesos, factory/integración coordinador. Sin push/PROD/3201/túnel/M0/demos/artefactos ajenos.

Ampliación coordinador tras primera verificación: la suite usa referencias reales de Recetas y sus consumidores, por lo que pertenece a ensamblado en apps/merchant/src/modules/sale-publisher-v4.neon.integration.test.ts. Factory extend autoriza esa ubicación; trasladar solo test/imports, manteniendo nombres reales y sin editar guards ni producto. Pos no declara dependencia de Recetas. Primera CI6a1826b2:5PASS/1FAIL/0skip, oráculo esperaba revisionId como pointer pero publicación vigente captura recipeSaleResolution.id; corregir expectativa exacta verificando relación con la revisión, no relajar aserción. Repetir solo caso afectado con compatibilidad explícita de los cinco anteriores. Eliminar offenders nuevos de guardias por ubicación correcta y separar backlog conocido.

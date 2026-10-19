# 0242 — CP2c.6 cierre transaccional V2 interno

Estado: preparada, sin autor/reserva. Requiere CP2c.5 acreditación aceptada; autor NUEVO/contexto vacío, no reusar contexto de cupones. Coordinador fija base y recursos. Este bloque ensambla cierre interno con órdenes canónicas unit y componentes medidos aceptados; no activar mass/V4 por HTTP ni retirar legacy todavía. Leer protocolos, contrato0242 cierre y funciones existentes pertinentes.

## Resultado

closeMeasuredPosOrder(business,userId,id,raw,now?) retorna PosOrderV2 y conserva una sola transacción durable. El futuro handlerV2 lo llamará; closePosOrder legacy queda intacto. Proponer firma/parsing/locks/replay antes código. Reusar primitivas de métodos de pago, acreditación medida, captura, comisión, publisher medido y snapshots; no duplicar algoritmo financiero/cupons/ledger ni convertir tarifa/cantidad a Number.

Validar cuerpo estricto compatible PosCloseV2 (UUID/version/membership/coupon.targetSourceLineId/payments), rechazar cupón sin pase y claves inválidas sin efectos. Lock orden por negocio FOR UPDATE; replay de cerrada con MISMA clientRequestId devuelve DTO congelado antes de releer catálogo/medios/cupón/capture/módulos/comisión, aunque request de replay tenga referencias ahora retiradas; no reescribir filas, snapshots ni deliveries. Clave usada por otra venta =>409request_reused, no enlazar core.order. Cerrada con otra clave/voided =>not_open; abierta stale version =>409version_conflict con orden V2 después rollback. No catch23505 como éxito general.

Revalidar módulo/config/moneda según protocolo aceptado sin invertir locks de create/PUT: precisar orden módulo→business-config/business→pos_order si se requieren locks comunes, luego cupón campaign→coupon→customer y primitivas vigentes. No recapturar precios de producto ni exigir catálogo activo para cerrar snapshots históricos. Leer líneas en orden estable con fuente real/quantity string/tarifa/metadata de medida; preservar históricos altos unit. Local válido del snapshot requerido, misma semántica actual para histórico archivado. No fabricar identidad/tableLabel/saleType ni alterar historial.

Con pase llamar acreditación CP2c.5 UNA vez; su FinancialSettlement es la misma autoridad usada para pagos/evento/commission/freeze. Sin pase construir settlement desde snapshots exactos sin cupón. No reconstruir descuento desde monto normalizado ni repetir decisión fuera locks. Error monetario se traduce al error POS422/detalles vigente. Métodos de pago revalidados por provider/negocio/estado y metadata efectiva; net0 con líneas reales permite payments=[] y no inventa efectivo. Persistir snapshots financieros en pos_order_item, pagos originales/ajustes y settlement enriquecido como actual, mismo tx. Efectos core.order/accrual/coupon solo si pase, compras anónimas válidas.

Capturar recursos reales con captureSaleResources, preparar comisión, publicar publishMeasuredSaleClosed con settlement/capture/paymentsMetadata/commissionByLine explícitos y snapshots originales, freezeSaleCommission, y cambiar orden a closed con closeRequestId/orderId/closedAt/closedBy/settlement en el mismo commit. afterGrant solo si ESTA transacción creó compra, nunca en replay/rollback. Retry durable después commit mantiene presupuestos/eventTypes y no convierte venta confirmada en error si aceleración/after falla. No tocar deliveryconsumer global ni crear otro mecanismo de cola.

## Paths autorizables

- apps/merchant/src/modules/pos/server/measured-close.ts
- apps/merchant/src/modules/pos/server/measured-close-input.ts, si separación evita límite de tamaño
- apps/merchant/src/modules/pos/server/measured-close.test.ts
- apps/merchant/src/modules/pos/server/measured-close.neon.integration.test.ts
- docs/factory/0242-cp2c-measured-close-handoff.md

Sin rutas/close legacy/void/Counter legacy/contratos/schema/journal/publisher/accredit/commission/settlement/kit/UI/guardias/tooling/deps/estados/índices. Si necesita helper reutilizable común o ajuste de executor/error, pedir extensión concreta antes editar, no sortear autoridad con copia de implementación.

## Gate

Node24 tipos db/domain/merchant/lint/formato/UIguard/guardias pertinentes, puros parsing/snapshot y CI exclusiva wrapper seleccionado hasta teardown. Unit canónico real creado por comandoV2: anónimo/pase, pagos múltiples y metadata exacta, net0 con payments[], cupón y porcentaje padded; core.order/pagos/eventoV4/deliveries/capture/comisión/freeze ligados a order y líneas reales. Reintento/carrera mismo closeUUID único efecto, distinta clave/no-open/staleversion/order tenant/método ajeno o retirado sin efectos; key core.order de otra venta rechazada. Fallo SQL después de pagos/evento o primer efecto revierte TODO incluida redención/selección/balance/visita, luego mismo intento recuperable. Replay tras cambiar punteros/activación/métodos conserva payload/settlement/closedAt/eventID/deliveries sin efectos nuevos. aftercommit fallido no deshace cierre ni acredita de nuevo.

Recetas/Stock/commission/consumidores capturados con recursos reales unit cuando corresponda; no alegar aplicación downstream por solo pendingdelivery. No repetir toda matriz de acreditación ya certificada. Masa positiva sigue dormida por barreras, puede probarse puro/ensamblado sin afirmar fila canónica mass; gate real mass y consumidor completo es posterior a activación combinada. Suite de ensamblado cross-module que necesite importsRecipes debe reservarse en modules/ raíz ANTES editar, no generar offender POS→Recipes ni cambiar guardias.

SIN browser/build/fullverify/M0/M1 ni activación por HTTP/migración. Logs SHA/base/config/comandos/exits/fallos/skips fueraWT; teardown IDs propios incl owner/staff/consumidores/membresías/sesiones y0procesos. QA NUEVO independiente, fixes autor hasta aceptar; factory/integración coordinador. Sin push/PROD/3201/túnel/M0/demos/artefactos ajenos.

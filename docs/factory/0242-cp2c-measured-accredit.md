# 0242 — CP2c.5 acreditación transaccional medida y cupón

Estado: preparada, sin autor/reserva. Requiere publisher CP2c.4 aceptado antes de asignar autor nuevo/contexto vacío. Coordinador fija base/factory; sin subdelegar. Independiente del carrito UI. Leer protocolos, contrato0242 §cupones/cierre y primitivas existentes; no abrir todo el cierre POS en esta entrega.

## Resultado

Servicio interno POS que, dentro de la transacción del futuro cierre, decide settlement exacto y acredita con persistMeasuredGrant usando los locks/veredicto/extras/store de cupón existentes. No endpoint nuevo, no conectar close ni publicar sale.closed aquí. El caller sigue siendo dueño de lock/version de orden, validación de métodos/persistencia de pagos, recursos/comisión/evento/freeze y commit. La acreditación no crea otro ledger ni duplica compras.

Reutilizar accrualContext y reglas de membresía/programa vigentes; no inventar autorización desde DTO ni autoenrolar aquí. Con cupón mantener orden campaign→campaign_coupon→business_customer usando funciones existentes, lookup idempotente antes de redecidir, selección actual y assertCouponVerdict bajo esos locks. Metadata autoritativa del cupón bloqueado alimenta decideMeasuredBenefit aceptado; el producto propio del cupón prevalece sobre selección del operador y targetSourceLineId explícito debe pertenecer a esa fuente/producto. Gratis/2x1 mass rechaza409 antes de cualquier acreditación/redención/clearSelection; mezcla unit elegible y porcentajes/importes sobre peso conservados. No parsear rule ni cambiar elegibilidad.

Construir FinancialSettlement con el núcleo exacto y pagos del caller, calcular acumulación sobre collected neto y llamar persistMeasuredGrant con líneas originales/snapshots y gross asignado por línea. Después reutilizar grantCouponExtras, insertCounterRedemption y clearSelectionIf en el mismo orden vigente; guardar importes de redención normalizados del settlement y su origen, no reconstruir tarifa desde total ni perder originales. Cualquier fallo revierte saldo/core.order/visita/push/extras/redención/turno/selección. Sin cupón o exclusión local explícita no modificar selección global. Custom y extras conservan semántica vigente; no reactivar canje directo de premios. Retornar settlement autoritativo y GrantedOrder con resultado final de cupón/extras para que el futuro cierre no vuelva a decidir descuento.

No duplicar implementación de locks/verdict/store ni algoritmo monetario. Puede haber orquestador POS separado que llama esas primitivas, sin modificar el flujo legacy grantWithCouponInTx ni añadir callbacks globales innecesarios. Proponer diseño/firma/idempotencia antes de código. Serialización/carreras reales deben preservar garantía existente: no capturar cualquier23505 como éxito ni convertir requestId de otra venta en compra enlazada. El futuro close verificará pushQueueId/idempotencia como hoy.

Añadir variante pura computeAccrualFromMoney al dominio de fidelización para total monetario string normalizado: cociente exacto de centavos para floor(total/block)×grant (por ejemplo0.30/0.10), sin Number como autoridad. Mantener computeAccrual(number) legacy y cifras actuales de sus callers, no migración global. per_purchase y net0 siguen contrato vigente; validar enteros y rango real int32 de columnas antes de convertir resultado final a number. No rediseñar programa/recompensas ni cambiar límites DB. Este helper sirve para posterior preview sin importar DB.

## Paths autorizables

- apps/merchant/src/modules/pos/server/measured-accredit.ts
- apps/merchant/src/modules/pos/server/measured-accredit.test.ts, si aporta señal pura
- apps/merchant/src/modules/pos/server/measured-accredit.neon.integration.test.ts
- packages/domain/src/server/loyalty-program/accrual.ts, solo variante pura nueva
- packages/domain/src/server/loyalty-program/accrual-exact.test.ts
- docs/factory/0242-cp2c-measured-accredit-handoff.md

Sin close/routes/grant-coupon legacy/locks/store/extras/verdict/financial/publisher/schema/journal/UI/kit/guardias/tooling/deps/estados/índices. Si una primitiva necesita ajuste para executor o error real, pedir extensión concreta antes de editar; no duplicarla por falta de scope.

## Gate

Node24, tipos3/lint/formato/UIguard/guardias pertinentes y puros de acumulación/decisión. CI solo tools/neon-test.sh/env seleccionado/reserva exclusiva hasta teardown. Reales unit: compra sin cupón y con porcentaje/fijo/gratis/2x1/custom/extras, net0 y saldo/visita/push/redención/turno/selección exactos; rechazo de cupón ajeno/no seleccionado/expirado/límite actual sin efectos; excluir local no quita selección; target ajeno/insuficiente no consume; replay/carreras por mecanismos existentes con único efecto; fallo deliberado posterior al primer efecto revierte todo. mass negativa con fuente sintética puede probar decisión antes de storage sin insertarla; mass positiva/algebra y no terminante100% se verifican puros, NO se afirma orden canónica por ello. Barreras siguen activas, cierre E2E queda pendiente.

Conservar fallos/skips y evidencia compatible, logs completos SHA/config/comando/exit fueraWT, cleanup IDs propios incluye negocio/consumidores/membresías/owners/staff/sesiones y verifica ausencia. Sin browser/build/M0/M1/fullverify ni HTTP/cierre/pagos reales certificados. QA nuevo independiente, autor conserva fixes; entrega limpia0procesos y factory/integración coordinador. Sin push/PROD/3201/túnel/M0/demos/artefactos ajenos.

# 0242 — CP2c.3 descuento exacto compartido para líneas medidas

Estado: preparada, sin autor/reserva. Autor nuevo/contexto vacío después de aceptar contexto QR; coordinador fija base/factory antes de código. Entrega pura sin DB. Leer protocolos, contrato0242 §1/3/4, financial aceptado y selectProductCouponLine; no subdelegar ni abrir cierre completo.

## Problema concreto y resultado

El núcleo financial acepta ahora discount.amount decimal y conserva originales racionales. Una conversión mass no terminante puede producir bruto racional que no cabe como decimal; calcular un porcentaje desde el bruto monetario ya redondeado y restarlo del original puede exceder ese original (por ejemplo100% de bruto redondeado hacia arriba), o inventar precisión. Extender el MISMO núcleo con entrada interna V2 de descuento racional exacto y decisión pura compartida POS; no introducir otro cálculo monetario ni redondear temprano. Legacy conserva forma/semántica y cifras de sus callers actuales.

Proponer a root antes de código la unión tipada inequívoca amount decimal | original racional exacto para V2/snapshots, con origen existente; no aceptar ambos, escala/canonicalidad/límites/denominador inválidos ni exponer ese racional como bodyHTTP confiable. La entrada financiera legacy sigue compatible. Reutilizar rational/ExactAmount/assertMoneyRange/normalización/distribución/validadores existentes; no cambiar estrategia de reparto ni minorUnit. Los snapshots/eventos financieros mantienen la estructura actual de originales, sin schema ni productores V4 nuevos.

Helper puro compartido en modules/pos recibe snapshots confiables en orden estable y cupón autorizado para preview/cierre futuro. La validación de elegibilidad, selección actual, fechas/límites y consumo real sigue en servidor bajo locks, fuera de esta entrega. Reutilizar selectProductCouponLine: gratis/2x1 excluyen solo fuente mass; selección mass explícita409 coupon_measure_not_supported sin fallback; mezcla permite unidad elegible,2x1cantidad>=2, producto ausente conserva código. Bonificar una unidad discreta al precio exacto congelado de esa línea y apuntar origen a sourceLineId real; no bandera actual de catálogo, no fusionar producto ni repartir beneficio de otra fuente.

Porcentaje usa originales racionales del mismo núcleo y porcentaje válido entero1–100, fijo usa importe exacto con moneda vigente y clamp al bruto original, ambos permiten masa. Construir origen campaña/línea según contrato y metadata autorizada; no interpretar rule. Custom/extra_* no descuentan dinero; extras/programa se validarán en la acreditación posterior, sin grant aquí. Excluir beneficio de venta es ausencia local explícita, no quitar selección global ni sustituir cupón. Cantidades/tarifas legacy confiables se conservan con sus adaptadores; nuevas entradas siguen límites nuevos. No aceptar Number como autoridad ni comparar solo totales redondeados.

## Paths autorizables

- packages/domain/src/financial/types.ts
- packages/domain/src/financial/settlement.ts
- packages/domain/src/financial/settlement.test.ts, o prueba pura nueva measured-discount.test.ts en la misma carpeta
- apps/merchant/src/modules/pos/measured-benefit.ts
- apps/merchant/src/modules/pos/measured-benefit.test.ts
- docs/factory/0242-cp2c-exact-benefit-handoff.md

El coordinador reservará archivos exactos antes de código. Sin validate/schema/journal/close/grant-coupon/accrual/routes/UI/kit/guardias/tooling/deps/estados/índices. Si reexport público de financial o validador necesita cambio, pedir extensión concreta primero. No reescribir financial completo ni cambiar snapshots para acomodar fixture.

## Gate puro

Node24, tipos3/lint/formato/UIguard/guardias pertinentes y suite financial legacy+medida afectada. Decisivos: bruto mass no terminante con100% produce net0/pagos[] por núcleo vigente; porcentaje parcial y fijo mayor/menor que original sin netnegativo ni doble redondeo; COP0dec/USD2dec, umbrales half-up y tiny; mezcla unit/mass y source explícita/implícita/2x1cantidadinsuficiente; mismo producto dos snapshots; precio0, producto eliminado y límites trusted; entradas exactas malformadas/exponente/escala/denominador/rango/orígenes inconsistentes rechazadas. Conservar equivalencia de descuentos legacy sobre importes centavos exactos y validar settlement final con assertFinancialSettlement existente, sin modificar ese validador para esconder fallos.

SIN DB/env/wrapper/browser/build/M0/M1/fullverify; no afirmar API/consumo cupón/cierre real ni masa canónica. Logs completos fueraWT con SHA congelado/comando/exit/config/fallos/límites. QA nuevo independiente, autor conserva fixes; entrega limpia0procesos, factory/integración coordinador. Sinpush/PROD/3201/túnel/M0/demos/artefactosajenos.

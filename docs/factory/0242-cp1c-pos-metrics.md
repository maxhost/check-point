# 0242 — CP1c.6 traductor de ventas medidas a analytics

Estado: preparada, sin reserva/autor. Entrada: decoder medido y vocabulario/base financiera exacta aceptados. Coordinador fijará baseSHA/WT al asignar un nuevo implementador/contexto vacío. Bloque puro independiente del lector SQL y captura de Recetas; no subdelegar. Leer protocolos, contrato0242 §4, traductor actual y decoder/helpers pertinentes.

## Contrato

El traductor POS de `sale.closed` acepta1–4 mediante decoder medido, preserva payload original y resultados históricos1–3. V1 conserva ausencia de métricas monetarias como hoy. Versiones2/3 mantienen sourceKey/sourceRevision/conteos/cupones/importes y unidades discretas. V4 distingue cada línea: unit→units_sold con cantidad entera confiable; mass→mass_sold_g con gramos exactos derivados del capture quantity/quantityUnit. Usar helpers de medidas existentes; lb9dec puede dar gramos14dec, sin Number, toFixed, parser de captura sobre el derivado ni factores duplicados. priceUnit no cambia masa. Ninguna fila suma piezas y gramos.

Ingresos de orden/producto, originales/normalización, descuento de campaña y additionalSources siguen sus snapshots financieros actuales. No recalcular desde tarifa ni catálogo. count de product_revenue mantiene frecuencia de órdenes por producto, no gramos ni líneas duplicadas del mismo producto. Preservar agrupación por cupón y rechazo de origen de campaña inconsistente. Venta mixta y neto0 son válidos según settlement capturado. Origen inválido/medida desconocida/cantidad inconsistente no genera traducción parcial.

Conservar validación de versión externa frente a payload en las pruebas y al invocar el decoder si se dispone de ella; cualquier fixture previo que mienta sobre el envelope se identifica antes de corregir y requiere path autorizado, no se relaja el decoder. La comprobación genérica de locationId del envelope pertenece al bloque posterior de conexión runtime, no inventar metadatos ausentes en MetricEvent.

No cambiar productor, versionar eventos históricos, reemitir ventas, ampliar subscriptions o habilitar masa. El traductor preparado por sí solo no certifica cadenaV4: Recetas/eventos derivados/Stock/lector deben ser compatibles antes de que un productor publique4.

## Paths previstos

- `apps/merchant/src/modules/pos/server/metrics.ts`.
- `apps/merchant/src/modules/pos/server/metrics-measured.test.ts`, nuevo.
- `docs/factory/0242-cp1c-pos-metrics-handoff.md`.

Sin domain/decoder/DB/schema/journal/ingestion/core-translators, productor/eventos de comisión/cupones, Recetas/Stock/UI/ranking/auth/kit/tooling/deps/estados/índices. Si hace falta actualizar una expectativa/fixture ajena, enviar path/razón y reproducción al coordinador antes de editar.

## Gate

Equivalencia exacta del resultado legacy1–3; unit V4 equivalente a3 salvo contrato físico explícito. Masa kg/lb/g equivalente y lb9dec conserva14dec derivados. Venta mixta con dos líneas del mismo producto mantiene dinero/counts y filas físicas separadas. priceUnit distinto no altera gramos; neto0/cupones/moneda0y2dec válidos. Negativos medida/cantidad/envelope/origen de campaña sin traducción parcial. SourceKey/revision estables para replay de ingestion futuro; no afirmar idempotencia DB por prueba pura.

Node24, tests focales nuevos+decoder/medidas/translator legacy pertinentes, tipos merchant/domain y lint/formato/diff. Tres guardias de módulos con backlog conocido separado de nuevos offenders; nunca modificar guardias. Sin DB/Neon/build/browser/M0/M1. QA nuevo sobre candidato congelado con evidencia SHA/config/runtime/comandos/resultados/fallos/skips/límites, commit limpio y0procesos. Factory/aceptación/integración solo coordinador; sin push/PROD.

# 0242 — CP1c.4 base financiera con dimensiones físicas separadas

Estado: preparada, sin reserva/autor; coordinador fijará baseSHA y WT antes del código. Nuevo implementador/contexto vacío. Bloque puro de dominio, paralelo a adaptadores de Recetas si los paths están libres. No habilita productores ni métricas mass en DB. Leer protocolos, contrato0242 §4 y funciones pertinentes de analytics; sin históricos ni subdelegar.

## Invariante

La completitud financiera requiere cantidades vendidas/con costo iguales por separado para piezas y gramos exactos, en cada producto/día/local y moneda financiera propia. Gramos excedentes no compensan piezas faltantes ni otros productos/días/locales. Mantener ingresos/comisiones/costos capturados y sus conteos actuales, sin extrapolar desde una fracción conocida ni recalcular desde catálogo. Las cifras históricas unit siguen iguales.

Añadir al vocabulario puro `mass_sold_g`/`mass_with_cost_g` de tipo quantity/product, manteniendo `units_sold`/`units_with_cost` exclusivamente discretas. Añadir `AnalyticsMetric.quantityExact?:string`: cuando exista es la autoridad, incluida si contradice la proyección number. Fallback sin ese campo exclusivamente para fixtures/historia legacy con entero seguro; nunca reconstruir masa/fracciones desde Number. Las cantidades derivadas en gramos pueden tener14 decimales o superar límites de captura por agregación: no pasarlas por parsers de entrada9dec. Usar racional/decimal BigInt existente para sumar/comparar.

Adaptar `salesBasis` y segmentación de `monthly-finance.ts`: reconocer venta mass aun de ingreso0; exigir igualdad exacta por ambas dimensiones en cada segmento y en producto dentro del segmento. Mantener filtros monetarios/currency/minorUnit de `financialMetrics`; una dimensión física no autoriza mezclar dinero de otra moneda. Revisar `hasSales`, conjuntos de productos/filas relevantes y detección de filas no vacías para que proyección number0 no oculte cantidad exacta positiva. Cantidades invalidas/incompletas nunca producen `complete:true`; no sustituirlas silenciosamente por0. Elegir un fallo explícito o estado incompleto coherente con APIs existentes, documentando el resultado.

`unitCoverage` conserva significado discreto y compatibilidad pública; no crear un cociente de piezas+gramos ni cambiar contratos UI por iniciativa. Para una venta solo mass, la contribución puede estar completa aun con unitCoverage0. La completitud se decide mediante comparaciones exactas, nunca mediante esa proyección. Si se necesita ampliar contrato de cobertura pública, presentarlo antes al coordinador.

## Paths previstos

- `packages/domain/src/analytics/metrics.ts`.
- `packages/domain/src/analytics/types.ts`, solo campo quantityExact y comentario de proyección.
- `packages/domain/src/analytics/monthly-finance.ts`.
- `packages/domain/src/analytics/financial-metrics.ts`, solo si requiere reconocer nuevo vocabulario.
- `packages/domain/src/analytics/quantity.ts`, helper puro nuevo si evita duplicación.
- `packages/domain/src/analytics/monthly-finance.test.ts`.
- `packages/domain/src/analytics/quantity.test.ts`, si se añade helper.
- `docs/factory/0242-cp1c-analytics-basis-handoff.md`.

Sin DB/schema/journal/lectores merchant/SQL allowlists, traductores o eventos, UI/ranking, auth/kit/tooling/deps ni estados/índices. Reader exacto, persistencia de métricas y traductores serán otra entrega compatible antes de activar V4. No capturar una nueva API pública ni ampliar scope sin coordinación.

## Gate

Equivalencia de suites financieras históricas. Ventas unit/mass/mixtas completas dan contribución correcta; déficit en cada dimensión impide completo aunque otra exceda. Negativos compensación entre producto/día/local y moneda/minorUnit. Diferencias exactas por debajo de resolución Number y gramos derivados14dec no se pierden; campo exacto manda sobre number y masa sin exacto no se certifica. Unit sin campo con entero seguro conserva resultado; fracción/unsafe fallback no se certifica. Neto0 y costos0 válidos, ausencia de venta y métricas huérfanas conservan sus invariantes.

Node24, focales analytics monthly/dashboard financiero pertinentes, tipos domain/merchant, lint/formato/diff. Sin DB/browser/build/M0/M1. QA nuevo independiente sobre SHA congelado, evidencia reproducible con fallos/skips/límites. Autor commit limpio/handoff; factory e integración por coordinador. Sin push/PROD.

# 0242 — CP1c.5 lector analytics exacto y segmentación SQL

Estado: preparada, sin autor/reserva. Entrada: base financiera pura0242-cp1c-analytics-basis aceptada e integrada. Coordinador fijará baseSHA y WT. Nuevo implementador/contexto vacío; no continuar en el autor anterior. Leer protocolos, contrato0242 §4, ficha de base financiera y lector/query reales.

## Resultado

Conservar el texto exacto de quantity obtenido de PostgreSQL en `AnalyticsMetric.quantityExact` antes de cualquier proyección Number. `quantity` sigue como proyección compatible de presentación; decisiones de completitud usan el campo exacto de la entrega anterior. No pasar agregados/gramos14dec por parser de captura9dec. Un fixture/representación antigua que entregue number solo puede convertirse a exacto si es entero seguro: no fabricar decimales precisos desde Number fraccional ni de valor inseguro. Las representaciones actuales flat/grouped siguen aceptadas sin perder filas, orden o tuplas.

Actualizar allowlists de segmentación de `inputStatement` para que `mass_sold_g` y `mass_with_cost_g` conserven local junto a las métricas de cantidades y costos, en ventanas reference/extended pertinentes. Ninguna agregación cruza producto/día/local ni moneda/minorUnit de las filas monetarias. Mantener ventanas/SQL roundtrips/semántica de ranking discreto existentes; no extender same-weekday de unidades a sumar gramos como frecuencia. Verificar los límites de ventanas y evitar doble conteo por unions.

La DB analytics ya usa numeric sin escala para quantity. Este bloque no introduce migración, traductor ni productor de eventos; pruebas insertan métricas sintéticas autorizadas usando las tablas actuales. No afirmar V4 operativo ni crecimiento de rendimiento por inspección de SQL. Un futuro bloque conecta traductores y eventos derivados medidos.

## Paths previstos

- `apps/merchant/src/server/analytics/queries/index.ts`.
- `apps/merchant/src/server/analytics/queries/quantity-exact.test.ts`, nuevo si se necesita oráculo puro del decoder.
- `apps/merchant/src/server/analytics/queries/monthly-finance.neon.integration.test.ts`, extensión focal con limpieza completa.
- `apps/merchant/src/server/analytics/evaluation/snapshot-equivalence.test-support.ts`, únicamente proyección exacta/allowlists equivalentes al lector si su oráculo lo requiere; sin alterar criterio para ocultar divergencias.
- `docs/factory/0242-cp1c-analytics-reader-handoff.md`.

Si comprobaciones pertinentes revelan un fixture fijo que necesita actualizar shape por quantityExact, presentar path/motivo antes de tocarlo. Sin dominio financiero/contratos, schema/journal, ingestion, traductores, ranking/UI/auth/kit/tooling/deps/estados/índices.

## Gate

Reader real preserva cadenas14dec y cantidades que comparten proyección Number pero difieren exactamente; cantidad exacta manda en `salesBasis`/monthly finance. Fixture mass/unit mixto con costos completos produce contribución esperada; discrepancia diminuta y excedente en otra dimensión/producto/día/local no lo completan. Negativos monetarios de otra moneda/minorUnit no cubren ingresos/costos propios. Ejercitar local explícito y todos locales, ventanas reference y extended con una fila en cada borde relevante; no sumar dos veces. Histórico unit y decode de agrupaciones/representación flat conservan semántica y conteos.

Node24; CI protegida exclusiva con `tools/neon-test.sh --no-file-parallelism`, incluida limpieza de fixtures/owner. Reutilizar fixtures/teardown existentes si son completos; no añadir consumidor/evento operativo para probar un reader. Comprobaciones puras proporcionales y equivalencia de snapshots donde sea pertinente, tipos merchant/domain, lint/formato/diff y guardias de módulos distinguiendo backlog conocido. Sin build/browser/M0/M1 ni nuevas mediciones de latencia.

QA nuevo independiente sobre candidato congelado; registrar SHA/config/runtime/SQL/fixtures/comandos/resultados/fallos/skips/límites, cero procesos y teardown completo. Commit limpio/handoff; factory/aceptación/integración del coordinador. Sin push/PROD.

# 0237 — AN-2 entregada en dev

**QA independiente PASS sobre candidato `672e7e1c111bce92cd420605edb4752f8ccc00fa`.** Solo AN-2: eventos atómicos de compra/ajuste/cambio de costo, traductores puros, gauges exactos, tarjetas 5/8/9 e histórico de stock/subas. Suscriptor, resúmenes e inbox AN-1 reutilizados, sin rediseño ni AN-3. Los commits documentales de cierre no cambian este producto.

## Revisiones y evidencia

- Base inicial dev `0f543dd8fafeb9e6d9039d8db004a575b255f685`; contrato reservado `bc632860`. Correcciones owner: tarjeta 9 por ticket promedio local `2e0740e7`, contrato vigente/costos nullable `72958272`.
- A entrega `b3260d7e783d117a16b395b3e02fb05a4f225328`, producto `d6b7c8a21e879621c4dd1a6634f84b49f0845b2a`, fundamento `452fc655`. [Handoff de eventos](0237-an2-events.md): 5/5 Neon, 25/25 unitarios/fronteras, 3/3 navegador, tipos/lint/guard PASS.
- B entrega `8dfd0d43261a3c175a76f18b3a9d72f9f6b26e52`, producto `17507bb3`. [Handoff de producto](0237-an2-product.md): 36/36 unitarios, 19/19 fronteras, 3/3 Neon, 2/2 navegador, tipos/lint/guard PASS.
- [QA independiente](0237-an2-qa.md), informe `7e74c8213f054181067230faa9e7189e9fa15909`: entregas y combinación por separado PASS; 9/9 oráculos propios sobre blobs exactos del candidato. Reutiliza evidencia compatible, sin duplicar las baterías.
- Coordinador sobre `672e7e1c`: 39/39 unitarios/fronteras en 5 archivos, 0 skips, 3,50 s; Merchant typecheck EXIT0; diff--check y correspondencia exacta de paths contra ambas entregas PASS. Logs `/private/tmp/checkpass-an2/combination-{unit,types}.log`.

Node 24.20.0/pnpm 11.4.0. Solo pruebas focales, sin verify global ni mutaciones. Browser de componentes con APIs simuladas; no se presenta como smoke de app real. Neon por wrapper y configuración seleccionada `/private/tmp/checkpass-0237/migration.env`, con recurso serial y teardown completo.

## Contratos finales

Tarjeta 9: faltante al costo ≥ max(ticket promedio exacto de 28 días del local, 1% de venta de 7 días del local), sin FX; sin ventas en 28 días, cualquier faltante con costo conocido es elegible. COP y sin ventas probados. Conserva reglas comunes de peso/novedad/umbral/tope. Costos desconocidos = null, nunca cero: cambio de desconocido a conocido publica sin delta/product_unit_cost_change/tarjeta 5; ambos desconocidos no publican.

Gauge guarda costo decimal exacto en unidades menores y cantidad exacta; gana snapshot observado con desempate por evento. Consumo usa el cierre para sumar y la aplicación para observar existencia. El corte `sale.closed` de Stock queda intacto. Detalle de conteo real por ID/local, aun fuera de los últimos 200 movimientos. Core resuelve métricas/hechos/acciones genéricos; no importa módulos concretos ni lee tablas de origen para Analíticas.

**Una nueva migración 0098**, solo `analytics.daily_gauge`, schema/snapshot/journal coherentes; SQL SHA256 `e53e80ed3a89109dc8128a11ea0ca7bb17ca21a358ac7b213ffe47a67d611905`. 0097 idéntica. Aplicada únicamente por wrapper a DB aislada de pruebas; sin migración ni lectura PROD.

## Fallos y pendientes preservados

Fallos iniciales y correcciones detallados en autores/QA: SQL alias `day` (Neon 2 PASS/2 FAIL), medio centavo por suma flotante y delivery vieja entre días, sandbox Chromium y oráculos de formato español. Las corridas rojas se conservan; no se usan skips/retries como aceptación.

Siguen diferidos: rendimiento AN-1 (último frío 2082,39 ms, NO cumple ≤1000 ms), prueba real Visual Crossing para AN-3, CI compartida con 0097 original, invocación de ciudades existentes y cron remoto. No se reabren ni se operan. El histórico cuenta subas diarias observadas, sin inventar cantidad de compras intradiarias. Housekeeping de candidatas de hechos bajo 0,05 queda documentado: no aparecen pero pueden seguir copiándose; no se agregó optimización durante este cierre.

Dev conserva docs ajenos `e4ba665c` (prompt AN-3), `40f777f2` (estado Claude) y `2e0740e7` (decisión del owner). No se implementó AN-3 ni se editaron INDEX/TASKS/estado Claude por este equipo. Archivos ajenos sin seguimiento preservados. Main local permanece `0f543dd8`; origin/main referencia local `db3175d2`. Sin push, deploy ni operaciones PROD.

Las tres tareas factory quedan aceptadas; recursos liberados y sin procesos propios. Worktrees limpios conservados en `/private/tmp/checkpass-an2/`, porque las entregas solicitadas en dev no son ancestro de main local y no corresponde forzar cleanup.

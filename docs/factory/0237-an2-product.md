# 0237 — AN-2 producto (B)

Task `analytics-an2-product`, worktree `/private/tmp/checkpass-an2/analytics-an2-product`, rama homónima. Base inicial `bc63286051942bbc310cccb1fb3a247ba3c9fa58`; fundamento A incorporado por fast-forward y factory refresh a `452fc655`. Commits propios: `3008438a`, `6bcce4fc`, `ae39a851`, **fuente final congelada `17507bb3`**. La entrega documental posterior solo añade este handoff. QA independiente y combinación con el resto de A corresponden al coordinador; este informe no declara QA PASS por su cuenta.

## Alcance y contratos

Dominio y servidor de tarjetas 5/8/9, histórico stock/subas, acciones genéricas con detalle y UI en la pantalla existente. AN-1 conserva sus tarjetas y contratos HTTP; se extiende `AnalyticsInput` con gauges exactos, primer consumo por insumo/local y candidatas por hecho. Solo se leen resúmenes `analytics.*`, además de configuración/pertenencia del negocio/local. Ningún import o literal de un módulo nuevo en core. Sin kit, guardias, CSS, índices comunes ni estados de otros agentes.

A define `AnalyticsFact` y gauges en `metrics.ts`. B exporta `evaluateAnalyticsFacts(tx, { businessId, eventId, capturedAt, facts, now? })`; A lo llama dentro de ingestion después de una revisión nueva. Hechos genéricos: costo comparable por producto/insumo/local (`unit_cost_change`, costos mayores decimales exactos) y diferencia de conteo con costo conocido (`count_gap`, cantidad/monto negativos y URL capturada). No se examina el nombre del evento ni se consultan tablas de origen. El hook toma lock de evaluación del negocio/día y persiste las candidatas aun después de que la corrida diaria quedó lista. Una delivery tardía usa ventas anteriores al día del hecho, no posteriores.

- **5:** umbral inclusivo de aumento del costo promedio del insumo de 5%, comparado como racional; impacto unitario del producto por ventas de ese producto/local en 28 días / 4. Las cantidades de cada fila se suman como racionales antes del redondeo monetario final (incluye 0,1 + 0,7). Costos subcentavo se conservan y se muestran con precisión. Acción core `edit_product_price` con permiso de catálogo. El sujeto es local/insumo/producto. Se guarda `originDay` y `originObservedAt`; hechos viejos no reemplazan uno calificado más reciente ni siquiera entre días. Una compra posterior sin suba calificable no cancela el aviso anterior: conserva su decaimiento.
- **8:** por local/insumo, mínimo de 28 días desde su primer consumo observado, con p25/p75 de los 28 días calendario previos, incluidos ceros. Cuatro días o menos en el extremo corto dispara la candidata; urgencia `1 − días/5`. Sin importe cuantificado usa `fixedPlata=1`. No inventa equivalencias con platos/recetas: muestra cantidad y unidad capturadas. Si p25 es cero, declara que no puede acotar el extremo largo; nunca muestra una fecha infinita. Existencias negativas se presentan como cero disponible. Acción `record_purchase`.
- **9:** aplica la corrección expresa del owner comunicada por el coordinador en `2e0740e7`/`72958272`: **max(ticket promedio de 28 días del local, 1% de venta de 7 días del local)**; el promedio se compara sin redondeo prematuro. Esta regla reemplaza el mínimo anterior de 3 unidades mayores. Sin ventas, cualquier faltante con costo conocido es elegible, incluido importe redondeado cero: este último tiene peso cero y la selección común lo excluye del inbox. Sin FX. Sujeto independiente por conteo/insumo, acción `view_count_detail` con URL capturada del dueño del evento. No netea conteos diferentes del mismo día.

5 y 9 mantienen urgencia 1 y multiplicador `0,7^días`, evitando el piso 0,2 de urgencia común. Continuidad diaria desde candidatas guardadas, con novedad, estados aceptada/descartada, tope 5 y mínimo 0,05 existentes. El resolver permite detalles solo dentro del destino declarado por un manifiesto activo y autorizado; URLs externas, rutas hermanas y escapes normalizados vuelven al destino declarado. A aporta manifiestos y detalle real de conteo.

## Histórico y HTTP

`GET /api/analytics/history` conserva todos los campos AN-1 y agrega:

```
stock: {
  valueMinor: number | null,
  knownValueMinor: number,
  valuedItems: number,
  unvaluedItems: number,
  averageIncrease: number | null,
  increaseDays: number,
  averageDaysBetweenIncreases: number | null
}
```

`valueMinor` valora existencias al final del período con el último gauge de existencia y el último costo conocido del mismo insumo/local (pueden ser de días distintos y anteriores al inicio del período). Costos en unidades menores decimales y cantidades se multiplican como racionales; el total se redondea una sola vez. Si falta algún costo o no hay observaciones, total `null`; `knownValueMinor` y los contadores describen la parte conocida. La UI explica el faltante y no promete un total completo.

`averageIncrease` es la media simple del **cambio neto** último/primer costo comparable de cada insumo/local, usando como baseline el último anterior al inicio del período, o la primera observación interna si no existe baseline. Solo participan series con dos observaciones comparables. Así 100→110→100→110 da 10%, no 21%. Puede ser negativo. `increaseDays` cuenta días observados con costo mayor al anterior por serie; los resúmenes no inventan el número de compras dentro del día. La frecuencia es el promedio de intervalos medios por serie con al menos dos días de suba, solo dentro del período. Una única suba no inventa intervalo. El filtro de local se aplica a valor, variación y frecuencia. La UI habla de cambio entre costos conocidos y días entre subas, conserva los 5 períodos y usa el kit existente.

## Evidencia real

Node **24.20.0**, pnpm **11.4.0**; lockfile sin cambios. Comandos desde la raíz del worktree tras `source ~/.nvm/nvm.sh && nvm use`:

- `pnpm --filter @mi-pasaporte/merchant exec vitest run src/server/analytics/evaluation/stock-domain.test.ts src/server/analytics/actions/actions.test.ts src/server/analytics/evaluation/domain.test.ts`: **36/36 PASS**, cero skips; 11 casos AN-2, 3 acciones y 22 regresiones AN-1. Incluye mínimo local/insumo, p25 cero, límite 4 días, subcentavos, sumas fraccionarias, exactitud del ticket COP, sin ventas/cero conocido, decaimiento y neto del histórico.
- `pnpm --filter @mi-pasaporte/merchant typecheck`: **PASS** con fuente final y tests preparados; `pnpm exec eslint` de los archivos propios: **PASS**.
- `node tools/ui-guard.ts --base 452fc655`: **PASS**, un archivo UI sin aumentos. Detector impeccable del archivo final: `[]`. No se modificó kit ni guardias.
- `pnpm --filter @mi-pasaporte/merchant exec vitest run src/modules/modules-boundary.test.ts src/modules/modules-boundary-literals.test.ts`: **19/19 PASS**, cero skips, 2,79 s, sobre `17507bb3`.
- `pnpm exec playwright test --config tests/e2e/support/analytics-an2-fixture.ts`: **2/2 PASS**, cero retries, 2,4 s, desktop 1280 y móvil 390. Histórico con valor 24,20, faltante de costo, local Centro/Norte, período 6 meses y ausencia de overflow. Capturas finales inspeccionadas: `test-results/analytics-an2/stock-{1280,390}.png`. Harness con UI, CSS, kit y navegación reales y HTTP simulado; **no es smoke de app real**.
- Tras transferencia exclusiva del recurso DB desde A y GO del coordinador, fuente congelada **17507bb3**, checkout limpio:

```
NEON_TEST_ENV_FILE=/private/tmp/checkpass-0237/migration.env tools/neon-test.sh src/server/analytics/evaluation/stock-evaluation.neon.integration.test.ts --no-file-parallelism
```

**3/3 Neon PASS**, cero skips/retries, 16,52 s, log `/private/tmp/an2-product-neon-first.log`. Migrador del wrapper PASS; misma DB con replay válido asignada por el coordinador, sin lectura de credenciales en salida. Casos: preservación de localidad/primer consumo/gauge exacto; stock histórico total/parcial y HTTP 200/404 de local ajeno/401; rollback del hook; hechos después del run diario, repetición sin duplicar; compra vieja de ayer entregada mañana no reemplaza la nueva; continuidad y decaimiento de 0,7; descarte ajeno 404 y supresión al día posterior. Teardown completo, proceso terminado y DB liberada al coordinador. La prueba de cada evento real y su atomicidad/corte pertenece a A y se combina por QA; B no la presenta como prueba propia.

## Fallos y límites conservados

- El primer checkpoint B usaba `min(m.day)::text day`; A encontró SQL 42601 al ejecutar su suite real: 2 PASS/2 FAIL. Se corrigió a `AS day` en `6bcce4fc`. A confirmó luego sus eventos y el hook en Neon; B cerró su propio focal 3/3 de arriba. No se oculta aquella corrida roja ni se la llama PASS.
- QA reprodujo pérdida de medio centavo por sumar cantidades con `Number` y detectó entrega vieja cruzando días. Corregidos en `6bcce4fc`, con oráculo fraccionario propio y stale entre días en Neon. QA externo reportó 8/8 sobre ese checkpoint, pero la regla anterior de tarjeta 9 quedó reemplazada por `ae39a851`; se espera el dictamen independiente final.
- Primer browser: ambos casos murieron en 0 ms por sandbox Chromium/MachPort (Permission denied 1100). Se informó inmediatamente y la escalación técnica permitió ejecutarlos. La siguiente corrida falló por oráculo que esperaba `24.20` en lugar del formato es-EC `24,20`; se corrigió el oráculo y el singular de insumo. La corrida final documentada pasó ambos casos sin retries automáticos.
- El histórico cuenta observaciones diarias; no atribuye compras individuales que el resumen no distingue. Una existencia sin costo permanece sin valoración completa.
- Las candidatas antiguas de hechos pueden seguir copiándose con peso menor a 0,05; no se muestran. Se detectó como housekeeping durante el cierre y el coordinador indicó conservar la fuente ya probada y documentarlo, sin ampliar este encargo.
- Se preservan los pendientes AN-1: rendimiento frío **FAIL diferido** (último 2.082,39 ms, no PASS), prueba real Visual Crossing diferida a AN-3, CI compartida con hash 0097 original y tareas operativas de ciudades/cron. No se ejecutó benchmark, verify global, clima real ni mutaciones.

B no crea migración. A conserva la única nueva **0098**; B usó su fundamento de esquema, sin aplicar ni leer PROD. Sin push, deploy, main local, archivos INDEX/TASKS ni estado de Claude. No hay procesos propios de navegador/servidor/DB pendientes; se conserva el worktree para QA e integración y no se fuerza limpieza.

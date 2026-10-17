# 0237 — Contrato AN-2

Encargo del owner: SOLO AN-2 (§6 y comunes §1–§3, histórico §4), ADR0152/0153 y flujo ADR0144. Base dev `0f543dd8fafeb9e6d9039d8db004a575b255f685`. Dos implementadores en worktrees propios, coordinador único y QA independiente. Sin INDEX/TASKS/estado Claude. Sin push, deploy, PROD ni avance de main local: entrega pedida en dev. No verify global ni mutaciones. Node24; DB exclusivamente tools/neon-test.sh y configuración seleccionada privada. Pendientes AN-1 conservados: rendimiento diferido, prueba real clima en AN-3, CI compartida con0097 original, ciudades/cron operativos pendientes. No reabrirlos.

## A — analytics-an2-events

Worktree `/private/tmp/checkpass-an2/analytics-an2-events`. Writer de `packages/db` (UNA0098 si necesaria, no alterar0097); vocabulario `packages/domain/src/analytics/metrics.ts`; `server/analytics/ingestion`; `server/module-events` solo adaptación necesaria; módulos Stock y Recetas (productores, traductores puros, suscripción compra, manifiestos/registro propios). Tests focales nuevos de eventos/ingesta. Handoff `0237-an2-events.md`. Sin subdelegación.

Compras y ajustes atómicos, source movimiento, local y labels/costos/existencias autosuficientes; lote un evento por línea. Consumo suma stock_consumption y gauge. Compra dispara suscripción Recetas que captura costos por producto y publica derivado en su tx; causalidad AN-1 conservada. No cambiar corte. Gauge último valor observado con orden determinista y sin doble suma/revisión vieja; preservar precisión de costos de insumos de seis decimales, cantidades exactas y moneda canónica. Dinero agregado entero. Coordinar ANTES de código contrato de gauge y datos genéricos para tarjeta5 con B; core no nombra ni importa módulos.

Recurso DB serial asignable por coordinador: usar DB de replay válido `/private/tmp/checkpass-0237/migration.env`, exclusivamente mediante wrapper; no CI antigua/perf. No operar DB hasta GO. Un caso Neon por evento nuevo (3), rollback, local/día, idempotencia/gauge/corte; unidades traductores y fronteras pertinentes. Migración solo prueba CI aislada.

## B — analytics-an2-product

Worktree `/private/tmp/checkpass-an2/analytics-an2-product`. Writer dominio analytics salvo metrics.ts; servidor analytics `{evaluation,queries,actions,http}`; UI histórico `app/backoffice/analytics` y componentes propios usados por ella; tests focales dominio/UI/servidor, handoff `0237-an2-product.md`. Sin subdelegación. Coordinar contratos con A; A cablea hook genérico de evaluación por hecho desde ingestion. No rediseñar AN-1 ni cambiar sus tarjetas.

Tarjetas5/8/9 por §6:5 evaluada en delivery derivada, umbral5%, impacto semanal y decaimiento0,7;8 por local/insumo con mínimo mes y p25/p75 últimos28d/rango;9 faltante y umbral, detalle conteo y decaimiento. Novedad/tope/acciones comunes existentes. Histórico agrega valor stock y subas con períodos/local; lee solo resúmenes. HTTP conserva campos AN-1 y agrega bloque stock documentado en handoff. Kit/tuteo, sin kit/guardias/CSS. Si se requiere habilidad UI, leer impeccable pertinente.

Criterio vigente del owner (2026-10-17, spec en dev `2e0740e7`), que reemplaza la aclaración anterior de3 unidades: tarjeta9 aparece si el faltante al costo ≥ max(ticket promedio de los últimos28 días del local, 1% de la venta semanal del local). Sin FX. Sin ventas en esos28 días, cualquier faltante con costo es elegible. Pruebas obligatorias: COP y sin ventas, además de umbrales/decaimiento; comparar el promedio exactamente, sin redondearlo antes del umbral.

## QA — analytics-an2-qa

Worktree `/private/tmp/checkpass-an2/analytics-an2-qa`. Solo handoff `0237-an2-qa.md` y artefactos independientes acotados si necesarios, no producto certificado. Revisar entregas congeladas y combinación exacta en dev. Reutilizar evidencia compatible y reproducir señal decisiva; no repetir AN-1/perf/clima/global. Verificar atomicidad3eventos, traducción pura, localidad/corte/gauge fuera de orden, umbrales5/8/9/decaimiento, histórico y acciones/permisos/tenant afectados, core sin módulos. PASS no por skips/retries. QA de entrega y de combinación separados.

## Coordinación

Reservas factory y contratos por commit local antes de código; entregas limpias con SHAs/pruebas/fallos reales, integración serial conserva commits. Workers no escriben estados/índices comunes ni refs de otros checkouts. Cambios de scope vuelven al coordinador. Desajuste spec/código se informa al owner antes de resolver. Worktrees se conservan si main local no contiene entregas; no forzar cleanup. DB reservada durante test/teardown, nunca suites concurrentes. QA fresco trabaja cuando ambos implementadores entregan.

## Addendum de reservas y contratos

- AutoresA/B arrancan en `bc63286051942bbc310cccb1fb3a247ba3c9fa58`; QA en `1af00c97786e91d80dae55ee43980a43f344c760` (aclaración moneda). A amplía reserva a `apps/merchant/src/modules/server-registry.ts`, exclusivamente registro Stock/Recetas.
- A/B acuerdan hechos genéricos autocontenidos desde traducción para evaluación por delivery, sin core nombrar eventos ni módulos concretos; conteos conservan identidad/detalle, no se netean entre sí para la tarjeta9. El gauge conserva costo exacto y snapshot observado, con desempate estable; sumas monetarias siguen enteras.
- GO DB exclusivoA: `/private/tmp/checkpass-0237/migration.env`, rama efímera de replay válido AN-1. No se reconcilia CI compartida ni se toca perf.
- Inicio Node24.20.0/pnpm11.4.0, hooks `.githooks`; CI remoto main `db3175d` rojo por assertion previa en `stock-consumption.neon.integration.test.ts:315` (`count_changed` esperado). Se mantiene informado; solo regresión focal de corte en este encargo, sin batería publicación.

## Aclaraciones y dependencias posteriores del owner

- `recipes.product_cost.changed` conserva `unitCostBefore`/`unitCostAfter` nullable: null nunca es cero. No emitir para un producto si ambos son null; si no quedan productos elegibles, no emitir el evento. Delta, `product_unit_cost_change` y tarjeta5 únicamente con ambos conocidos. Caso exigido: desconocido→conocido emite sin delta ni tarjeta. Se comunicó el desajuste antes de cambiar el contrato.
- Dependencias compartidas por commits preservados: fundamentoA `452fc655` → checkpointB `3008438a` → correccionesB `6bcce4fc`. Factory refresh antes de restaurar cambios propios, sin copiar archivos de otro writer. QA reproduce oráculos por blobs congelados.
- Scope ampliadoA: `tests/e2e/support/catalog-harness-server.ts` (mock useSearchParams necesario para detalle), `tests/e2e/analytics-an2-stock.spec.ts`. Scope ampliadoB: `packages/domain/src/analytics/stock-history.ts`, `tests/e2e/analytics-an2.spec.ts`, `tests/e2e/support/analytics-an2-fixture.ts`. Sin modificación general de tooling/kit/guardias.

# 0239 — Refinamiento de layout de Analíticas

Encargo L1 del owner del 2026-10-18: adaptar `/backoffice/analytics` a las referencias de composición, conservando Tailwind/React Aria/kit y diferidos. Base `37c9862294cd72328c976508d330bededdf62a12`, tarea factory `analytics-layout-0239`. Sin nueva spec funcional: sólo presentación del contrato HTTP existente.

Lectura: ventas primero (tres indicadores); ganancia/gastos junto a equilibrio mensual; productos junto a stock; clientes junto a promos. Grid de doce columnas en escritorio, lectura DOM lineal en móvil/intermedio. Indicadores móviles con etiqueta/importe en una fila; filas de productos con importes alineados y nombres completos. Valores tabulares y resultado positivo/negativo con tokens semánticos. Se mantienen cero/null, cobertura, estimación, comparación anual, causalidad de promos, filtros, errores/reintento y día. No series, gráficos, indicadores calculados, peticiones o dependencias nuevas. Sin kit/guard/backend/DB.

Checks Node24.20/pnpm11.4: merchant `typecheck:ui`, ESLint focal, `ui-guard --base 37c98622` (un archivo sin aumentos), diff-check. Browser componentes con UI/CSS reales y API simulada, sin certificar auth/Next/DB: cinco casos sin retries/skips, a390/768/1440px, pérdidas/cero/nombres largos, estimado, pendientes, filtros/día y error/reintento. Prueba de alineación en paralelo desktop y orden lineal móvil, sin overflow. Capturas390/1440 abiertas en tanda; ajuste móvil y una confirmación final. Detector layout base sin hallazgos.

Comando focal reproducible: generar config temporal con `testDir` absoluto a `tests/e2e`, `testMatch: 'analytics-layout.spec.ts'`, `workers:1`, `retries:0`, `use:{browserName:'chromium',headless:true}` e invocar `pnpm exec playwright test --config <config>`. Config usada `test-results/analytics-layout/playwright.config.ts` (ignorada), preservada con capturas y fallos en `/private/tmp/checkpass-analytics-layout-evidence/`.

Fallos preservados: configuración inicial de analytics-fixture sólo incluía analytics.spec y no encontró pruebas; se usó config focal temporal. Chromium restringido por sandbox (MachPort permission denied), ejecución técnica autorizada fuera del sandbox. Primer oráculo nuevo esperaba decimal punto; producto usa correctamente coma española, corregido a `$0,00`, sin cambio de producto para esconder fallo.

No se ejecutó M1, campaña DB ni verify global. CI remoto continúa rojo histórico en90ebe18; QA manual owner y todos los diferidos del estado vigente se conservan. No push/PROD. El servidor3201/túnel se conserva.

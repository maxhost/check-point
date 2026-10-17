# 0237 — AN-1 producto (B), parada por rendimiento

Task `analytics-an1-product`, worktree `/private/tmp/checkpass-0237/analytics-an1-product`. Base reservada `c51e29179c713710b10668aff4201c04da3a9295` (fundamento A). Commits propios `79340f30` (dominio), `296d29b2` (correcciones QA temprano), `e9cba28c` (evaluación, HTTP y UI). **Entrega funcional incompleta; QA PASS no obtenido.** Parada de §Pruebas 9 comunicada inmediatamente al coordinador, sin repetir la medición ni alterar el límite.

## Implementado y contratos

Siete tarjetas 1/2/3/4/6/7/13, pesos/novedad/materialidad, tope5 y umbral0.05; meta y períodos; histórico/día/local. Evaluación diaria persistida y atómica, claim advisory + `SKIP LOCKED`, presupuesto20s/lote20, apertura con presupuesto3s y `after()`. Estado por sujeto/fingerprint, aceptación/descarte y reemplazo. Rutas de §3.5 con guard real `analytics`, tenant de sesión, ajenos/otro día404, cronBearer401; acciones mediante manifiesto encendido y permiso. Dashboard/inbox e histórico «Analíticas» con kit existente, navegación core y acceso del equipo autorizado.

Solo lecturas de resúmenes `analytics.*`, más configuración/pertenencia/nombres del comercio/local. Contexto externo invisible. No kit, guardias, CSS ni dependencias nuevas en B. Node24.20.0/pnpm11.4.0. Migración0097 pertenece a A; B no prepara otra. Sin push, deploy, PROD ni cambios a INDEX/TASKS/estado de Claude.

El addendum técnico `58e0042b` quedó aprobado después de congelar e9: `revenue_with_cost` y `payment_commission_with_cost` exactos por línea; `cost_of_goods.count` marca líneas costeadas y se exige igualdad de los tres counts para margen exacto. A lo implementó en `62966570`, todavía **no integrado en B**. B no debe conservar su prorrateo de ingresos/comisión de28d como implementación final. La referencia sin ventas quedó aclarada por owner:20 unidades mayores de la moneda del comercio, sin FX; e9 ya lo aplica.

## Evidencia focal real

- Dominio inicial79340:10unitPASS; QA encontró5defectos. Corregidos en296d29 y cubiertos: fórmula histórica parcial, últimos3meses efectivamente pagados para fijos, residuos0, invitación2 semanalglobal y mediana de todos los productos con costo.
- e9:21unitPASS (17dominio,2fallback3s/after,2acciones), typecheckmerchantPASS, eslintfocalPASS, ui-guard contra c51ePASS (6archivos sin aumentos), detectorImpeccable `[]`.
- e9:Chromium3/3PASS sin retries,3.6s, desktop1280/móvil390:5tarjetas,descartar/reemplazo,aceptar/navegar,día,5períodos/local ycomparativaanualincompletaoculta. Harness de componentes con CSS/kit/nav reales y HTTP simulado; **no es smoke de appreal**. Capturas conservadas en `test-results/analytics/history-{1280,390}.png` del worktree.
- Neon6/6PASS25.0s en rama efímera propia: guard real owner/equipo/401/403, aislamiento404 de tarjetas/locales/día, aceptación/descarte, idempotencia diaria y claim concurrente, apertura fallback. El SQL cambió después para acotar ventanas/compactar JSON; repetir focal tras fixes antes de atribuirPASS al candidato final.
- Fallos reales previos: fixture staff sin permiso/identidad→se completó con handle/PINreal; aliasSQLday sinAS→producto corregido; timeoutdefault5s en caso de~10roundtrips→30s proporcional, separado del requisito de1s; sandboxChromiumMachPort→escalación; fixturesbrowser duplicabanbody y omitían contenedor→montaje corregido. No se transformaron skips/retries enPASS.

Comandos focales, desde raíz con Node24:

```
pnpm --filter @mi-pasaporte/merchant exec vitest run src/server/analytics/evaluation/domain.test.ts src/server/analytics/http/fallback.test.ts src/server/analytics/actions/actions.test.ts
pnpm --filter @mi-pasaporte/merchant typecheck
node tools/ui-guard.ts --base c51e2917
pnpm exec playwright test --config tests/e2e/support/analytics-fixture.ts
NEON_TEST_ENV_FILE=/private/tmp/checkpass-0237/perf.env tools/neon-test.sh src/server/analytics/evaluation/evaluation.neon.integration.test.ts --no-file-parallelism
```

## Primera y única observación fría — FAIL

Rama propia `br-super-math-axhq8e58`, nombre `analytics-an1-perf-20261017`, proyectoowner `red-violet-38772073`; endpoint `ep-aged-mode-axjrknyi`,1CU. DB exclusivamente wrapper seleccionado; no secretos en este documento.

El owner ordenó parar carga y medir inmediatamente. Se terminaron solo los procesos propios identificados; la última tanda1000 ya había hecho commit: log de semilla acredita29.2Mfilas `product_revenue` (1000×730×40). No se esperó ni hizo COUNT/ANALYZE global. Preflight cancelables0, objetivo completado y writers activos0 por `pg_stat_activity`. La tabla con índices ocupaba11.228.487.680bytes. Objetivo:29.200filas por cada product_revenue/cost_of_goods/units_sold/units_with_cost,730revenue,730payment_commission; fechas2024-10-20→2026-10-19 y40labels. Menos métricas fuera objetivo que la representación normalizada totalmente densa116.8M; limitación declarada. El preflight ahora exige `ANALYTICS_PERF_PREPARE=1` para evitar ejecutarlo accidentalmente.

Coordinador suspendió compute por API: operación `800d24ef-5be7-4fee-b273-9112fc4dd31a`,FINISHED,failures0,duración709ms. Tras su GO se ejecutó una única vez:

```
ANALYTICS_PERF_MEASURE=1 NEON_TEST_ENV_FILE=/private/tmp/checkpass-0237/perf.env tools/neon-test.sh src/server/analytics/evaluation/performance.neon.integration.test.ts --no-file-parallelism
```

El migrador del wrapper despertó compute sin leer el objetivo. Producto exactamente e9, sin merge ni fixes; solo se corrigió la aserción a **elapsedTOTAL≤1000**, sin restar conexión. Resultado de evaluación `true`, corrida persistida; **testFAIL, EXIT1**:

| Medida | ms |
|---|---:|
| TOTAL evaluateBusiness, incluyendo conexiones y commit | **12767.59** |
| Reloj/primera conexiónHTTP |486.70|
| Conexión transacción |558.16|
| Claim |163.48|
| Lectura resúmenes |**11160.35**|
| Cálculo puro |48.68|
| Persistencia |237.52|
| Tramo tras conexiones, informativo sin cambiar criterio |11722.73|

Hashes SHA256 de fuente observada:

- evaluation/index.ts:`0a4a414f4b974c6a945a09ee9d96824b65101f439e75c9c9e318eb0cd3a492cd`
- queries/index.ts:`dc6c66fcf7088b421201e40845bcb752cb00f24f9c508909349a29a20289046a`
- domain/cards/index.ts:`cdffad5a973753d025b01a7c99afb83c18f7c2ba266f8bef3221b928c06bb3c1`
- testTOTAL:`a80ec3a2b5dbfd96f1eb4eb74bcb23151f7591489352c430e1131ed519376398`

Logs locales preservados: `/private/tmp/an1-product-perf-seed.log`, `/private/tmp/an1-product-cold-preflight.log`, `/private/tmp/an1-product-cold-observation.log`. Sin segundo intento, ninguna lectura DB posterior y ningún proceso B activo al comunicar la parada.

## Pendientes antes de candidato aceptable

1. Resolver rendimiento según indicación del owner/coordinador: cuello observado en lectura, no atribuirlo solo a conexión. No hay autorización implícita para repetir hastaPASS o bajar el límite.
2. Integrar el SHA exacto autorizado de A y refrescar basefactory; aplicar dominio exacto58e0042b, incluido card7 `product_revenue−revenue_with_cost`, comisiónNULL y legacy sin neto. Fixtures intradiarios y céntimos racionales de meta; auxiliar58.400filas objetivo solo si se autoriza continuar benchmark.
3. COP: usar `minorUnitForCurrency` canónico (COP0, Intl2 es incorrecto). Validar overflow al combinar importes enteros y al calcular meta/candidatas.
4. Vacío común sin«desdehoy» si hay histórico; reservar ese copy para ausencia de datos. Señales de existencia desde resúmenes para negocios inactivos y mes cerrado anterior a3meses. Reconocer ventas gratuitas por tickets>0 en primera venta/weekday/resumen/días restantes.
5. Focales afectados y appreal Dashboard/navegación/equipo; QA independiente sobre combinación congelada. Ninguna aceptación/factorydeliver final se afirma aquí.

## Checkpoint de optimización autorizado tras FAIL

El owner autorizó optimizar la consulta. Se preserva la primera observación fría como FAIL; no se ejecutó otra medición fría ni se borró su corrida. Este checkpoint sirve para integrar A+B antes de los ajustes de exactitud y una medición final coordinada.

`queries/index.ts` reemplaza el MIN que recorría resúmenes mediante accesos aleatorios por claves materializadas desde el índice único existente, obtiene importes históricos solo para revenue/fijos y reutiliza esa lectura para primera venta, weekdays y meses fijos pagados. Las ventanas de métricas usan UNION ALL acotado; incluyen el inicio del mes actual cuando cae fuera de28días y weekdays anteriores a56días. No hay índice ni migración nueva. `evaluation/index.ts` integra día/claim/snapshot en una llamada dentro de la misma transacción y persiste candidatas/READY en otra llamada. Mantiene advisory lock, SKIP LOCKED, timeout, idempotencia y commit atómico; el cronómetro sigue incluyendo toda la función.

Planes reales sobre la misma carga, por wrapper y EXPLAIN ANALYZE BUFFERS:

- Baseline e9:10445.189ms servidor; primera venta7331.5ms, OR1703.6ms y fijos1386ms. Log `/private/tmp/an1-product-explain-before.log`.
- Variante ORDER/LIMIT+UNION:38.397ms en caliente; aún hacía accesos inconvenientes para frío. Log `/private/tmp/an1-product-explain-union.log`.
- Consulta congelada con claves:189.303ms servidor,752 SharedReadBlocks; Index Only Scan118260claves,40heap fetches;730importes revenue,4724métricas útiles. Log `/private/tmp/an1-product-explain-keys.log`. Es evidencia de plan, **no PASS del requisito frío TOTAL≤1s**.

Validación del checkpoint: typecheck merchant PASS y lint focal PASS (logs `/private/tmp/an1-product-opt-types2.log`, `/private/tmp/an1-product-opt-lint.log`). Los seis casos Neon existentes pasaron con producción optimizada; la séptima regresión nueva falló inicialmente por estar montada fuera del describe y ejecutarse después del teardown (FK en fixture). Se corrigió el montaje y se ejecutó solo esa regresión:1PASS,6no seleccionadas, sin retry (`/private/tmp/an1-product-opt-neon.log`, `/private/tmp/an1-product-opt-window.log`). No se presenta esa ejecución como7/7PASS.

Paths relevantes para QA: `apps/merchant/src/server/analytics/queries/index.ts`, `apps/merchant/src/server/analytics/evaluation/index.ts`, `apps/merchant/src/server/analytics/evaluation/evaluation.neon.integration.test.ts`. Se añaden harness focales `performance-explain.neon.integration.test.ts` y `performance-reset.neon.integration.test.ts`; reset está preparado pero **no ejecutado**. Continúan pendientes la integración A, exactitud de margen/COP/overflow, señales históricas/vacío y QA de combinación descritos arriba. Ningún proceso DB B activo al congelar.

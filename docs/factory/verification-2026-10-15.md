# Verificación completa local — 2026-10-15

> Actualización posterior: la [investigación del fallo original de Stock](stock-cause-2026-10-15.md) reprodujo el error, capturó el timeout primario del COMMIT y aplicó una corrección real del backend. La modificación condicional del test mencionada en este informe histórico se revirtió; el test original quedó restaurado byte por byte. El informe nuevo contiene los SHAs y resultados posteriores. Los resultados originales de abajo se conservan.

Cierre local: controles amplios ejecutados, fallo original conservado y correcciones de pruebas comprobadas mediante focos e inspección independiente.

Solicitud del owner: ejecutar todas las suites como preparación de publicación, sin push ni operaciones de producción. Se usaron worktrees aislados, dependencias propias y recursos reservados con factory. No se editaron INDEX, TASKS ni archivos de estado.

## Identidad y entorno

- Fuente de la corrida amplia y las migraciones aisladas: `7531ae9d2f16cfbdb4894fa101ab5e6d7f83e118`.
- Corrección de capturas: `5a3095f1dad60e699768497003fd799485287541`; entrega aceptada `a050c25eae8aaecb58637efbc6725131c6cf0932`.
- Node `24.20.0`, pnpm `11.4.0`, macOS; Chromium de Playwright y servicios locales en 3100/3101/3102.
- SHA256 de `pnpm-lock.yaml`: `a63b2a852e32abcd70ae19f57c8784524f56037d91447a42ca71ba08b7f0cce0`.
- SHA256 de `playwright.config.ts`: `61d959704b18b0d28d8a46302d503d0ea9338420b3847eada96e9b311a7d026d`.
- SHA256 de `vitest.config.ts`: `a5ce128adf14f6a0953701dbec7b8eb00defbb361043fc99800fdf8ab57c28ea`.
- Browser/unitarias: variables seleccionadas con `parseEnv`, proveedores ficticios, DB local, sin variables Neon de integración heredadas; `WATCHPACK_POLLING=true` y `NODE_PATH` del worktree.
- Neon: solo `tools/neon-test.sh`, archivo CI seleccionado `/private/tmp/checkpass-recipes-margin/0234-ci.env`, interlock anti-PROD vigente. DB reservada también durante teardown; GitHub CI sin workflows activos al comenzar. Las migraciones de prueba corrieron separadas y sin paralelismo de archivos.

## Corrida amplia

Se ejecutaron explícitamente los gates equivalentes a `check-numbers` más `verify --full`, para reservar el turno exclusivo de Neon y prohibir reintentos de browser. No se ejecutó literalmente `pnpm verify --full`; no se declara ese comando como EXIT 0.

| Control/comando | Resultado observado |
| --- | --- |
| `node tools/check-numbers.ts` | EXIT 0, sin duplicados |
| `pnpm run typecheck` | EXIT 0, 6 tareas; 6 recuperadas de caché Turbo |
| `pnpm run lint` | EXIT 0 |
| `node tools/ui-guard.ts --base 54dbff34e53500ca4e37b0ed75575fce7411c8e9` | EXIT 0, 103 archivos sin aumentos |
| `pnpm run format:check` | EXIT 0 |
| `pnpm run test` | EXIT 0; 304 archivos aprobados/253 omitidos; 2.906 tests aprobados/1.310 omitidos |
| `pnpm run build` | EXIT 0, 4 tareas; 3 recuperadas de caché Turbo |
| `pnpm run test:e2e --retries=0 --workers=1 --reporter=line` | EXIT 0; 399 aprobados/62 omitidos, sin reintentos |
| `tools/neon-test.sh` | EXIT 1; fase regular: 505 archivos aprobados/1 fallido/41 omitidos, 3.940 tests aprobados/1 fallido/282 omitidos; no llegó a la tanda DDL |

El guard toma la base anterior a las features acumuladas, para cubrirlas aunque `origin/main` ya apunte a la fuente probada. Las omisiones son las informadas por los runners; no cuentan como cobertura aprobada.

Tras conservar el fallo regular, se ejecutaron los diez archivos `*migration*.neon.integration.test.ts` explícitamente mediante `tools/neon-test.sh <archivos relativos a apps/merchant> --no-file-parallelism`: **10 archivos y 30 tests aprobados, cero omisiones, EXIT 0**. No hubo otro writer local ni CI activo al comenzar esa tanda.

## Capturas portables en CI

El [run de GitHub de la fuente publicada](https://github.com/maxhost/check-point/actions/runs/38775662386) falló al guardar capturas fiscales en rutas absolutas `/private/tmp`, inexistentes en el runner Linux. Se cambió únicamente el destino a `testInfo.outputPath`, conservando fixtures, aserciones, presupuestos y configuración.

Sobre la entrega exacta `a050c25e`, el focal `pnpm exec playwright test tests/e2e/brand-fiscal.spec.ts --retries=0 --workers=1 --reporter=line` aprobó **4/4 casos, cero omisiones/reintentos, 10,0 s**. Se validaron ocho PNG frescos con firma/dimensiones/tamaño válidos dentro de `test-results`. QA independiente aceptó diff e identidad de fuentes. El worktree temporal se retiró tras integrar la entrega; se conserva su log de comprobación.

GitHub conserva el resultado del código publicado. No se volvió a ejecutar CI remota ni se publicó esta corrección.

## Costo promedio: contrato del intento acotado

La corrida amplia conservó un fallo en `stock-average.neon.integration.test.ts`, caso `drains pending before purchase and does not mix locals/tenants`: esperaba saldo `12.000`/costo `2.833333`, observó `15.000`/`2.666667`. La spec0228 exige un intento máximo de 2 segundos y permite continuar con pendientes. Los dos resultados corresponden a órdenes de aplicación distintos; la prueba original exigía éxito sin observar si se había aplicado el consumo.

Un observador temporal que delegaba al retry real, manteniendo expectativas y presupuesto, aprobó 10/10 casos: `claimed=1/applied=1`, delivery aplicada y ledger `10,-3,5`; midió 2.116 ms de tiempo total del intento. **No reprodujo el rojo ni demuestra su causa exacta.** No se atribuye el fallo original a latencia como hecho confirmado.

Corrección de prueba congelada: `4cb0dcc92cd1469c5e7a7c365fa9b2ccdb57bec4`, base `a050c25e`. No cambia código de producto ni tiempos, presupuestos, retries, schema o fixtures de datos. El spy llama al retry real y devuelve/rechaza lo mismo, se restaura en `finally` y exige una única llamada con comercio/local elegidos, `force=true` y `budgetMs=2000`.

- Si la delivery quedó aplicada, exige un único consumo `-3`, retry aplicado exactamente una vez y saldo/costo `12.000/2.833333`, lo que también prueba el orden previo a la compra.
- Si sigue pendiente, exige ausencia de consumo y saldo/costo `15.000/2.666667`; después exige recuperación real a `12.000/2.666667`, sin reponderar y con replay sin duplicados.
- El helper de recuperación se comparte con los negativos reales de fallo y timeout. Se conservan presupuesto, aislamiento entre locales, rechazo de otro tenant y entrada de varias líneas.

QA independiente aprobó estáticamente el SHA exacto. Sobre ese mismo commit, `tools/neon-test.sh src/modules/stock/stock-average.neon.integration.test.ts src/modules/stock/stock-average-rollback.neon.integration.test.ts src/modules/stock/stock-concurrency.neon.integration.test.ts --no-file-parallelism` aprobó **3 archivos y 12 tests, cero omisiones/reintentos, EXIT 0, 121,8 s**, incluidos fallo/timeout, rollback y concurrencia. El wrapper y su teardown finalizaron antes de liberar DB. El bloqueo inicial del worker fue resuelto por el coordinador aportando la autorización original del owner para la suite completa; no se omitieron protecciones anti-PROD.

Se conservan el fallo original y las limitaciones de reproducción. La evidencia se reutiliza según identidad: el producto, configuraciones, schema y dependencias de la corrida amplia siguen idénticos; las dos pruebas corregidas tienen sus propios focos sobre código congelado. No se declara una nueva corrida amplia íntegramente verde ni un `verify --full` EXIT 0.

## Artefactos locales

- `/private/tmp/checkpass-full-suite-20261015/results.json`: comandos, tiempos, identidad y EXIT de cada gate, incluido el fallo original.
- `/private/tmp/checkpass-full-suite-20261015/*.log`: logs saneados por gate.
- `/private/tmp/checkpass-full-suite-20261015/migrations-results.json`: identidad, selección explícita, tiempos y cierre de las diez suites DDL.
- `/private/tmp/checkpass-ci-capture-focal-20261015.log`: focal fiscal y comprobación de los ocho artefactos.
- `/private/tmp/checkpass-stock-average-fix-20261015/average-observer.log`: observación sin reproducción del fallo original.
- `/private/tmp/checkpass-full-suite-20261015/stock-average-results.json` y `stock-average-focal.log`: focal corregido sobre SHA congelado.

Los archivos temporales son locales y pueden retirarse posteriormente; este informe y los handoffs guardan los resultados y límites. No contienen credenciales.

La evidencia amplia corresponde a `7531ae9d`; las correcciones posteriores afectan solo pruebas y sus handoffs, con comprobaciones focales propias. No cambian el lockfile, configuraciones, schema ni código de producto. No se atribuye retrospectivamente la corrida amplia al nuevo SHA. Una futura publicación mantiene los hooks vigentes y requiere autorización explícita del owner.

# Release — fixtures E2E modulares vigentes

Tarea `release-browser-fixes-20261015`; base inicial `f8358c904809050624e831ed155ab33e91a13f46`, rama `factory-release-browser-fixes-20261015`. Entrega inicial: este handoff y `tests/e2e/modules-ui.spec.ts`, sin cambios de producto. La continuación Stock autorizada posteriormente se documenta abajo. Sin cambios de harness, configuración, esquema, kit, tooling, dependencias o publicación.

El dry run de release falló realmente: Stock390/1280 no encontraba la tabla de registros; las dos reejecuciones tampoco pasaron. La fixture anterior omitía `/stock/locations` y `movements.pending`. El componente vigente espera un local para cargar movimientos y recibe `{count,failed}`. Se agregó un local activo por defecto y ese contrato; se conserva la aserción del log `7,5 g · Total: 15 USD`. El campo vigente se llama «Precio total» y guardar compra envía `locationId`, ambos reflejados en la prueba. Se preservan decimales, guardado y lectura posterior, y se comprueba que los saldos permanecen ocultos aunque la fixture tenga cantidades/costos.

El otro caso fallido, «Recetas trasladadas conservan dictado, revisión y payload», ejercía rutas retiradas (`GET /recipes`, `PUT /recipes/pizza`, `POST /recipes/pizza/draft`) y un modal antiguo. `git show a1f0764d -- tests/e2e/support/modules-ui-harness.tsx` confirma que R1 eliminó el import de `RecipesConsole` y su rama `surface=recipes`; el harness actual no monta esa pantalla. Su timeout no certificaba el wizard nuevo. El encargo del owner para recuperarlo excluyó expresamente recuperar las e2e borradas y dejó la QA browser al owner. Por autorización concreta de esta corrección se retiró únicamente ese caso obsoleto (sus dos anchos) y la constante de producto que quedó sin uso. No se restableció el harness ni la API anterior.

Quedan intactas las pruebas de navegación por permisos/manifiestos (incluida ausencia de Recetas cuando staff solo tiene Stock), cambio de módulos y protección frente al GET iniciado antes de un evento. No se agregan skips, retries, relajaciones de aserciones ni nuevos timeouts. Quedan cinco casos aplicables: navegación390/1280, Stock390/1280 y carrera del GET.

## Verificación

- Node24.20.0 mediante `source ~/.nvm/nvm.sh && nvm use`.
- `pnpm exec eslint tests/e2e/modules-ui.spec.ts`: PASS, exit0.
- `git diff --check`: sin errores.
- Playwright focal, después de liberar los puertos: **PASS5/5**,7.1s, en `ed885c2db9ac5e1bfed0b20f64648452565b45ee`, con `pnpm exec playwright test tests/e2e/modules-ui.spec.ts --retries=0 --workers=1 --reporter=line`. Entorno seleccionado `verification.env`, `NODE_PATH` propio, `WATCHPACK_POLLING=true` y escalación técnica para Chromium. Log `/private/tmp/checkpass-release-browser-fixes-20261015/modules-ui-focus-escalated.log`.

Fallos de setup separados: primer intento de foco terminó en timeout webServer120s con EMFILE; segundo, con polling, produjo5fallos al arrancar Chromium por MachPort Permission denied, antes de assertions. El tercer intento ejecutó los5casos y pasó, sin cambiar tests ni SHA entre intentos. No se presenta ninguno de los fallos previos como PASS. Al finalizar, Playwright cerró servidores y `lsof` confirmó puertos3100/3101/3102 sin listeners.

## Continuación — fixtures de compras y lectura Stock

Base actualizada por coordinación: `c0d71c12a296f6b416681b94364b65b3a10af8b5`. Producto/pruebas de esta continuación: `63d0dab42c2ea4bc360a07130435f8311c0a44da`. Reserva ampliada expresamente a `stock-entries.neon.integration.test.ts`, `stock-concurrency.neon.integration.test.ts`, `stock-integration-support.ts` (sin cambio) y después `stock/server/routes.ts` + `stock/server/read-local.test.ts`.

El dry run global falló5/7casos de entradas: los negativos de unidad/nombre/tenant y la línea repetida omitían un precio ahora obligatorio en las rutas públicas. Se agregó `totalCost:0` válido a las fixtures que deben alcanzar otras validaciones; esas expectativas originales permanecen. El caso público sin precio ahora exige422`price_required` y prueba por SQL que saldo/costo no cambian, tanto en entrada como compra suelta; conserva una compra posterior válida y su costo por fecha. Los writers internos conservan compras históricas sin precio, fuera de esta corrección.

La concurrencia global pasó201/409 y `count_changed`, pero falló después en `.filter`: el GET de movimientos devolvió503sin `movements`. Se añadieron assertions explícitas HTTP200 y diagnóstico limitado a `error/code` antes de acceder a la lista; no se relajaron barrera, cantidades, deltas, serialización, retries de negocio esperados ni límites. La reproducción focal previa al cambio de producto pasó8/8, por lo que **no se demostró la causa exacta de aquel503**.

Inspección adicional identificó un defecto determinista: `readLocal` hacía fallar las tres lecturas GET si fallaba el intento de acelerar consumos. Según0227, una lectura puede mostrar pendientes reales; solo el conteo exige drenaje. Prueba unitaria nueva: fallar ese acelerador reproduce rojo en los3GET. Corrección mínima: capturar únicamente el rechazo de `retryModuleEvents` en `readLocal`; conservar su presupuesto1s. `resolveLocation`, `pendingSummary` y lectores de datos quedan fuera de ese catch. La respuesta conserva pendientes reales `{count:3,failed:1}`, no inventa cero; los errores de esos lectores siguen rechazando. Sin cambios al motor de retries, conteos o writes Stock.

### Evidencia y pendiente de combinación

- Unit nuevo `pnpm --filter @mi-pasaporte/merchant exec vitest run src/modules/stock/server/read-local.test.ts`: **rojo3fallidos/7PASS** antes del fix (`read-local-red.log`), después **PASS10/10** (`read-local-green.log`), sin skips/retries. Logs bajo `/private/tmp/checkpass-release-browser-fixes-20261015/`.
- Lint focal de los4archivos modificados y typecheck merchant: **PASS exit0** sobre el código de `63d0dab4`; diffcheck limpio. Typecheck: `stock-fixtures-typecheck.log`.
- Neon **antes del catch**: `NEON_TEST_ENV_FILE=/private/tmp/checkpass-recipes-margin/0234-ci.env tools/neon-test.sh src/modules/stock/stock-entries.neon.integration.test.ts src/modules/stock/stock-concurrency.neon.integration.test.ts --no-file-parallelism` → **PASS2archivos/8tests**,62.10s, sin skips; `stock-focus-ci.log`. CI reservada por coordinación, wrapper y teardown completos. Intento anterior abortó seguro antes de DB porque `verification.env` referencia al archivoCI pero no contiene sus claves; `stock-focus.log` registra ese setup, no un fallo de producto.
- **Pendiente:** repetir esos8tests Neon después del cambio `readLocal`, sobre el SHA congelado, cuando coordinación devuelva el turnoCI. El PASS previo al catch no se presenta como evidencia posterior. QA independiente pendiente del candidato concreto; coordinación puede registrar la evidencia posterior sin cambiar este candidato.

No se ejecutaron otras suites, DB por vías alternativas, migraciones propias ni operaciones PROD. ReservaCI devuelta tras la fase focal previa; no hay procesos propios activos. No push/merge ni edición de índices/estados por este worker.

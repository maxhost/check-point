# Release — fixtures E2E modulares vigentes

Tarea `release-browser-fixes-20261015`; base `f8358c904809050624e831ed155ab33e91a13f46`, rama `factory-release-browser-fixes-20261015`. Scope: este handoff y `tests/e2e/modules-ui.spec.ts`. Sin cambios de producto, harness, configuración, DB, kit, tooling, dependencias o publicación.

El dry run de release falló realmente: Stock390/1280 no encontraba la tabla de registros; las dos reejecuciones tampoco pasaron. La fixture anterior omitía `/stock/locations` y `movements.pending`. El componente vigente espera un local para cargar movimientos y recibe `{count,failed}`. Se agregó un local activo por defecto y ese contrato; se conserva la aserción del log `7,5 g · Total: 15 USD`. El campo vigente se llama «Precio total» y guardar compra envía `locationId`, ambos reflejados en la prueba. Se preservan decimales, guardado y lectura posterior, y se comprueba que los saldos permanecen ocultos aunque la fixture tenga cantidades/costos.

El otro caso fallido, «Recetas trasladadas conservan dictado, revisión y payload», ejercía rutas retiradas (`GET /recipes`, `PUT /recipes/pizza`, `POST /recipes/pizza/draft`) y un modal antiguo. `git show a1f0764d -- tests/e2e/support/modules-ui-harness.tsx` confirma que R1 eliminó el import de `RecipesConsole` y su rama `surface=recipes`; el harness actual no monta esa pantalla. Su timeout no certificaba el wizard nuevo. El encargo del owner para recuperarlo excluyó expresamente recuperar las e2e borradas y dejó la QA browser al owner. Por autorización concreta de esta corrección se retiró únicamente ese caso obsoleto (sus dos anchos) y la constante de producto que quedó sin uso. No se restableció el harness ni la API anterior.

Quedan intactas las pruebas de navegación por permisos/manifiestos (incluida ausencia de Recetas cuando staff solo tiene Stock), cambio de módulos y protección frente al GET iniciado antes de un evento. No se agregan skips, retries, relajaciones de aserciones ni nuevos timeouts. Quedan cinco casos aplicables: navegación390/1280, Stock390/1280 y carrera del GET.

## Verificación

- Node24.20.0 mediante `source ~/.nvm/nvm.sh && nvm use`.
- `pnpm exec eslint tests/e2e/modules-ui.spec.ts`: PASS, exit0.
- `git diff --check`: sin errores.
- Playwright **pendiente**, no ejecutado por este worker mientras los puertos3100/3101/3102 pertenecen a la corrida global del coordinador. Comando preparado: `pnpm exec playwright test tests/e2e/modules-ui.spec.ts --retries=0 --workers=1 --reporter=line`.

No se presenta el dry run previo, sus retries o esta revisión estática como PASS browser. Coordinador debe liberar los puertos o ejecutar el focal sobre el candidato antes de aceptar la entrega; QA independiente revisa el diff. Sin procesos propios pendientes ni cambios de refs/main/push por este worker. La corrección adapta contratos verificables del producto vigente; no modifica producto para esconder fallos.

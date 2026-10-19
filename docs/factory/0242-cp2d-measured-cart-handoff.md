# 0242 CP2d.1 — entrega de componentes de carrito medido

Base: `da3cfbc56a481c105d7251bc8bc7ce426c5102cd`. Código congelado: `ca94bed261a2c4495fefed19bcce18bfc6e40469`, rama/worktree `measured-cart-ui-0242` en `/private/tmp/checkpass-pos-0242/measured-cart-ui-0242`. El commit posterior agrega únicamente este handoff; no modifica la identidad del código comprobado.

## Alcance y contrato

Siete archivos de implementación/prueba de la ficha, más este documento: `measured-cart.tsx`, `measured-quantity-dialog.tsx`, `measured-cart-model.ts`, `measured-cart-model.test.ts` dentro de `apps/merchant/src/modules/pos/ui/`; `tests/e2e/pos-measured-cart.spec.ts` y `tests/e2e/support/pos-measured-cart-{harness.tsx,fixture.ts}`.

Componentes preparados y probados en harness; **no es el POS completo conectado**. No se sustituyó PosConsole ni se añadieron transporte, rutas, cobro, UUID de comandos, DB, entorno, dependencias, kit, guards o artefactos de diseño. Se aplicaron Impeccable harden/craft-floor usando el contexto ya cargado por el coordinador.

Cada fila mantiene snapshot confiable, origen existing/new y editor separado. Existing preserva `lineId`, `productId` incluso null, nombre, tarifa, medida/factor y financialSnapshot. Nuevas líneas preservan catalogRevision y serializan solo campos PosNewLineV2; existing solo PosExistingLineV2. Se conservan adiciones separadas, incluso del mismo producto; por ello no se invoca canCombinePosLines ni se implementa otra regla de fusión. Posición/cardinalidad e identidad no se agrupan.

Cambiar unidad muestra presentQuantity y aproximación visible, manteniendo quantity/quantityUnit fuente. Confirmar sin escribir conserva esa fuente. Escribir activa captura explícita: buffer vacío/parcial/erróneo se mantiene, bloquea confirmación y serializeMeasuredCart y no manda el valor anterior. Coma se normaliza solo en captura, con captureQuantity, sin Number como autoridad. El buffer manual se conserva literalmente (incluidos punto/coma y parciales); solo la vista sin edición se presenta con coma. La unidad se bloquea mientras hay edición numérica pendiente para no reinterpretar un buffer en otra unidad; confirmar o cancelar permite volver a cambiar presentación. Cancelar restaura la fila anterior. Unidad histórica retirada conserva la fuente; captura nueva en ella se rechaza. Cantidad legacy alta sin cambios usa el adaptador aceptado; nueva cantidad siempre usa límites v2. No existe 1kg implícito: mass comienza vacío; unit nuevo usa captura entera explícita del host.

Importes usan exactSnapshotLineGross, fromExact, add y normalizedGross comunes; serialize valida también overflow agregado. Tarifa exacta/unidad se muestran separadas del importe normalizado. Precio cero válido, precio null rechazado. No existe total/CTA de pago en el componente. El botón Revisar borrador pertenece solo al harness y expone los campos preparados.

## Evidencia final y reproducción

Entorno: macOS arm64, Node `v24.20.0`, pnpm `11.4.0`, Playwright `1.63.0`, Chromium headless-shell `1243`, Vitest `4.0.18`. Lockfile SHA1 `b75587deab2aae0cc688765d0cdc0acc59ecb250`. Todos los comandos desde el worktree, precedidos por `source ~/.nvm/nvm.sh && nvm use`.

Artefactos locales fuera del worktree en `/private/tmp/checkpass-pos-0242/`; prefijo final `cart-ca94bed2-` (salvo puros y estáticos de archivos sin cambios, reutilizados de `cart-3a52e1e7-`):

| Check / comando | Log | Resultado |
| --- | --- | --- |
| `pnpm --filter @mi-pasaporte/merchant typecheck` | `types.log` | exit 0 |
| `pnpm --filter @mi-pasaporte/merchant exec vitest run src/modules/pos/ui/measured-cart-model.test.ts` | `cart-3a52e1e7-unit.log` | exit 0; 17/17, sin skips/retries; modelo y prueba idénticos en ca94bed2 |
| `pnpm exec eslint` sobre los siete archivos listados en3a52 y los dos cambiados en ca94 | `lint.log` | exit 0 en ambas revisiones |
| `pnpm exec prettier --check` sobre los siete archivos listados en3a52 y los dos cambiados en ca94 | `format.log` | exit 0 en ambas revisiones |
| `node tools/ui-guard.ts --base da3cfbc56a481c105d7251bc8bc7ce426c5102cd` | `guard.log` | exit 0; tres archivos UI, sin aumentos |
| `pnpm exec playwright test --config /private/tmp/checkpass-pos-0242/cart-playwright.config.cjs --grep-invert 'inspección agrupada'` | `browser.log` | exit 0; 3/3 seleccionados, retries0, skips0; sin repetir inspección visual |

El config externo usa testDir absoluto de este checkout, testMatch `pos-measured-cart.spec.ts`, workers1, retries0, Chromium headless, outputDir `cart-browser-results` fueraWT, sin webServer Next. Config SHA1 `5d2b10f372535c77e91285073eed7e26fb0291f0`. Reutiliza startCatalogHarness con entry `tests/e2e/support/pos-measured-cart-harness.tsx`; servidor propio 127.0.0.1:puerto efímero, cerrado en afterAll con closeAllConnections/close. No dependió de 3201 ni de servicios ajenos.

Puros: fuente no terminante y edición explícita, equivalencia de vistas lb/g/kg, unidad retirada, buffers inválidos, escala9, coma, límites, unit entero/dimensión, null/0, legacy cantidad/tarifa amplia, overflow individual y agregado, exactamente200 y rechazo201, campos comando y filas separadas. Browser: mass vacío, inválidos y coma9, Enter con confirmación, doble clic sin duplicación, preservación de fuente al cambiar vista, serialización bloqueada durante buffer inválido y cancelación, captura posterior, unidad retirada, unit fraccionario rechazado, mismo producto con snapshots distintos, producto borrado, cero/null. Interacción real con kit y cálculo común.

Corrida ab23c57b completa 4/4 exit0 en `cart-ab23c57b-browser.log`. Después,3a52 reforzó la confirmación contra overflow del pedido completo y ca94 preservó el buffer manual literal; no alteran el layout. Los tres recorridos de comportamiento se repitieron después de cada fix sin producir otra ronda visual. Modelo/17puros sin cambios desde3a52; tipos/lint/formato/guard posteriores a ca94.

Capturas finales ligadas a ab23c57b: `cart-390.png`, `cart-1280.png`, `cart-dialog-390.png`, `cart-dialog-1280.png`. Las cuatro se abrieron e inspeccionaron juntas; cantidad/unidad/tarifa distinguibles, controles y mensajes legibles, nombres envuelven, sin overflow horizontal. Se hizo primera inspección y una única confirmación tras ajustar coma/plural y la vuelta a presentación después de capturar. No hubo bucle de pulido.

## Fallos y límites conservados

- Primer runner sandbox: cuatro fallos de lanzamiento Chromium MachPortRendezvous1100, antes de interacción; `cart-browser.log`. Se notificó al coordinador y se utilizó escalación acotada del runner autorizado.
- Primer runner escalado: 3/4 PASS; expectativa incorrecta de test para999999999lb a4.123456789/lb (importe válido, inferior al máximo). `cart-browser-escalated.log` conserva el fallo; se retiró esa expectativa errónea, manteniendo overflow real en puros. Corrida final independiente 4/4, sin retries configurados.
- Setup inicial: fixture root no resolvía alias workspace; se cambió a import relativo al módulo puro existente. Tipos iniciales y salida de suite fallida figuran en sesión; `cart-types.log` conserva el fallo de alias. Hubo también una invocación prettier con patrones de extensiones inexistentes (exit2); no modificó contenido indebido. La invocación final usa siete paths exactos y pasó.
- Warnings ambientales: MODULE_TYPELESS_PACKAGE_JSON en guard y NO_COLOR/FORCE_COLOR en Playwright; no se editaron tooling ni configuración para ocultarlos.
- No DB/env/wrapper, no pruebas Next→guard→DB, no venta canónica ni cobro real, no certificación de transporte/autorización. Browser es emulación de viewport Chromium en macOS; no dispositivo físico, otros motores ni auditoría completa de lector de pantalla/zoom. Gates de otros paquetes no se ejecutaron porque no se modifican ni sus contratos.
- El sandbox también bloqueó un git add con index.lock Operation not permitted; escalación de git sobre los dos archivos propios permitió el commit, exit0. Inspección de procesos mediante ps escalado solo devolvió el propio comando de auditoría y rg, sin runner ni servidor del harness.
- Runner y todos los checks finalizaron; ningún servidor persistente. Se preserva worktree para fixes de QA independiente. Factory/aceptación/integración/cleanup corresponden al coordinador. Sin push ni PROD.

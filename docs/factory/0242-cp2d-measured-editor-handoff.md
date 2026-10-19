# 0242 CP2d.4 — editor visual preparado

Entrega de `measured-editor-0242`, base `ba9f668438a9dc8261446d5a17344936252d4101`. Implementación aislada: no sustituye consola/rutas ni implementa checkout, QR, cupones, pagos o impresión. Reserva original del coordinador; extensión exclusiva de `measured-cart.tsx` autorizada/reservada antes de editar por ficha commit `9487b1c1`.

## API y ownership

`MeasuredEditorSession(context, cache, client, initialOrder?)` recibe el mismo `PosCache` y `PosClient` contractVersion2 del contenedor. El padre conserva esta instancia y su borrador único al renderizar/desmontar la vista. `MeasuredPosEditor` consume `session`, `onExit`, `onSaved(PosOrderV2)`, `onPrepare(PosOrderV2)` y `onAccessError?`. No crea otro manager ni retira la intención por desmontar. El callback de una vista desmontada o de identidad retirada no se completa.

Antes de cambiar selección/orden o salir, el padre debe consultar `session.requestExit()`; con cambios se ofrece seguir trabajando o `requestExit(true)` para autorizar descarte y liberar la sesión. Pending/uncertain bloquean ambas salidas. Nunca usar desmontar/recrear sesión para abandonar una creación incierta. Un cambio REAL de identidad llama `session.retireIdentity()` permanentemente, junto al retiro del contexto/cache del contenedor. No reutilizar la sesión retirada para otra identidad.

`session.commands` conserva captura/UUID/body y expone el estado aceptado de comandos; `save(false,true)` recupera explícitamente. La sesión aplica DTO canónico y líneas existentes, sin GET detalle/history adicional. Mostrador prepara POST internamente; solo llama `onPrepare` con DTO confirmado abierto y con líneas. DTO cerrado/anulado se informa por `onSaved`, sin preparar cobro. Cancelar el cobro futuro deja la orden guardada abierta.

Búsqueda/categorías/Frecuentes son filtros locales de catálogo V2 leído mediante la misma cache al elegir local. Cambiar local con líneas exige descarte explícito; alternar vistas conserva líneas/nota. Las líneas nuevas conservan revisión; las existentes conservan snapshot e identidad. Cambiar tipo conserva líneas y retira identificación anterior para revisarla. Conflictos conservan payload íntegro y borrador, muestran orden/productos actuales y requieren revisión explícita; no hay retry automático. Un cambio de medida vacía la captura y exige cantidad nueva.

`measuredEditorAmounts` usa `buildFinancialAmountsFromSnapshots` después de validar el carrito. Total y `lineAmounts` proceden del mismo kernel. `MeasuredCart.lineAmounts?` es opcional y mantiene el uso standalone anterior; primero valida cada buffer para evitar un importe distribuido viejo en una cantidad parcial. COP dos líneas0.49 muestran1+0=1, según distribución acumulativa aceptada. Hook de mesas solo añade `options.client?`; default legacy intacto.

## Evidencia del autor

Node24.20.0, pnpm11.4.0, Playwright1.63.0 Chromium headless, harness `startCatalogHarness`, transporte real `createPosClient→posRequest→panelRequest→fetch`, interceptado en boundary de fetch. Sin Next, auth nativa nueva, DB, env, wrappers, M0/M1, build ni fullverify. Config/runtime/logs/capturas fuera del WT en `/private/tmp/checkpass-pos-0242/editor-evidence` y `/private/tmp/checkpass-pos-0242/editor-{390,1280}.png`, `editor-cop-{390,1280}.png`. Chromium se ejecutó escalado desde inicio por el bloqueo MachPort conocido; no rechazo de auto-review.

- Tipos merchant `pnpm --filter @mi-pasaporte/merchant typecheck`: EXIT0.
- ESLint de los paths TS/TSX entregados: EXIT0.
- Prettier de los paths entregados: EXIT0.
- `node tools/ui-guard.ts --base ba9f668438a9dc8261446d5a17344936252d4101`: EXIT0.
- `pnpm exec vitest run apps/merchant/src/modules/pos/ui/measured-editor-model.test.ts`:4/4, sin skips/retries.
- `pnpm exec playwright test --config /private/tmp/checkpass-pos-0242/editor-evidence/playwright.config.ts`:10/10, retries0, un worker. Cuatro tipos/mesa/local, peso manual vacío,0/null, nota/vistas, snapshots separados, guardado canónico, Mostrador, remount+recovery mismo UUID/body/scope, conflictos explícitos, identidad/callback tardío, canónico cerrado y COP distribución/buffer parcial/Escape. Capturas390/1280 ABIERTAS en inspección agrupada y una confirmación final con textos largos/COP; sin overflow horizontal.

Fallos previos conservados: typecheck inicial detectó conversión-version numérica (corregida a constante); unit inicial importaba fixture con un nivel relativo extra (corregido). Primer browser7FAIL/1PASS por scope inválido del harness y nombre accesible del selector incompleto; corregidos, no fueron fallos de auth del producto. ESLint inicial detectó dos `any` en mock; sustituidos por contratos. Las fixtures finales calculan total y distribución por kernel, sin estados de medida/tarifa imposibles ni suma de redondeos independientes. Logs iniciales no sustituyen los checks finales. No hubo skips.

## Dependencia y QA pendiente

La base del autor trae el helper anterior. El coordinador aceptó después el fix `8fa28a66db233f93c4eec53218303c5ae51d25b4`, QA `2099e941` sobre `da0726a9`, que conserva estado uncertain de POST si recuperación recibe403/422/409. No se cambió ese helper ni se importó main en este WT. El PASS autor NO acredita esa interacción sobre la dependencia nueva; QA NUEVO debe ensamblar esta entrega con el fix aceptado y probar respuesta perdida→rechazo de recuperación→misma intención retenida. UI uncertain muestra el error íntegro y acción de recuperación sin habilitar salida/nueva creación.

No se declara QA independiente ni integración/publicación. El contenedor productivo futuro debe retener la sesión y cumplir `requestExit`/`retireIdentity` descritos. Handoff mantiene fixes para QA. Servidores del harness cerrados por afterAll; comprobar0procesos/puertos propios en evidencia de cierre. Sin push/PROD.

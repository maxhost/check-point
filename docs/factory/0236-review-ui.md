# 0236 — Revisión de Gastos simplificada

Task/rama `gastos-review-ui`; worktree `/private/tmp/checkpass-gastos-review/gastos-review-ui`. Base inicial `994ff28cfd138d2a16dc3d151f3a13312d3b695f`; el coordinador autorizó ff-only y refrescó factory a `063007ee779f85f04c28424b2237d41909805cd2`, con el DateField real de A. Se guardaron/restauraron solo cambios propios mediante stash nominal, ya retirado. Implementación **`0dda1f66de5d63fd60a968e480972b95700a00d9`**; el commit posterior de este handoff solo añade este documento.

Contrato: [0236-review-contract.md](0236-review-contract.md) y addendum SPEC0236. Cinco archivos UI reservados —campos, revisión de concepto/local, modelo y modal— más los tres archivos de pruebas de Gastos. Sin cambios backend, DB, HTTP, kit, CSS, tokens ni registros en el diff de B. DateField se importa del barrel del kit; sin stub.

## Resultado

Una introducción al revisar. «Qué pagaste» poblado por IA/reconocimiento; cambiar el texto de un concepto reconocido desasocia ese pago sin renombrar el concepto global. Categoría y asociación existente/nueva están bajo «Cambiar concepto»; categoría pendiente se muestra directamente. Seleccionar un concepto completa nombre y categoría. Un nombre de concepto vacío puede proponer el texto reconocido del pago, sin inventar categoría.

Detalle opcional bajo «Añadir detalle»/«Editar detalle»: conserva texto IA/histórico al corregir concepto y, si se vacía, confirma `name=conceptName`. Fuente reconocida secundaria dentro de ese detalle. Check fijo visible, sin explicación repetida.

Local válido resumido con «Cambiar local»; selección pendiente visible. `fromDraft` hereda selección válida del paso1 cuando la línea devuelve null, mantiene excepciones propias y admite global solo cuando se eligió `business` explícitamente. Calendario sin hora y segmentos escritos; meses pasados permitidos. Edición compartida conserva moneda/zona/revisión y locales archivados.

## Evidencia

Contenido exacto de `0dda1f66`, sobre DateField fuente `063007ee`. Node24.20.0, Playwright1.63.0, Chromium local; lockfile sin cambios, SHA256 `a63b2a852e32abcd70ae19f57c8784524f56037d91447a42ca71ba08b7f0cce0`. Antes de comandos Node: `source ~/.nvm/nvm.sh && nvm use`.

| Comprobación | Resultado |
| --- | --- |
| `pnpm exec playwright test --config tests/e2e/support/expenses-fixture.ts --output /private/tmp/checkpass-gastos-review/ui-results` | **12/12 PASS**,7,6s,0 retries,0 skips. Harness real de componentes/kit, HTTP interceptado, sin Next ni DB. |
| `pnpm --filter @mi-pasaporte/merchant typecheck` | EXIT0, con DateField real; sin dependencia pendiente. |
| `pnpm exec eslint` y `pnpm exec prettier --check` sobre los ocho archivos cambiados | EXIT0. |
| `node tools/ui-guard.ts --base 063007ee779f85f04c28424b2237d41909805cd2` | EXIT0,5 archivos, sin aumentos. |
| `impeccable detect --json` sobre los cuatro TSX UI cambiados | EXIT0, `[]`, una ejecución. |
| `git diff --check` | EXIT0. |

Se adaptaron los diez casos previos por la presentación aprobada, sin quitar oráculos de lote/retry, fotos y ACK, permisos, dinero exacto, fecha comercial, revisión/moneda conflictivas, histórico/archivado y baja. Dos casos adicionales prueban calendario pasado por clic real, herencia/excepción local, corrección de concepto sin perder detalle, detalle vacío y asociación existente con nombre/categoría completos. Teclado opera segmentos reales; no asigna inputs ocultos ni estado React.

Primera corrida funcional:8/10 PASS y2 fallos de selectores nuevos, corregidos conservando aserciones HTTP. El calendario tiene nombre accesible «Abrir calendario Fecha de pago» y resolver la categoría mediante concepto existente colapsa esa corrección. Última corrida completa12/12, sin force/retries/skips. Comandos browser y Git usaron escalación local autorizada para sandbox; sin operaciones externas.

Impeccable Operate/distill y craft-floor aplicados, conservando Merchant/Stock. Una inspección conjunta390/1280 tras análisis completo válido, con concepto/categoría/local heredados; no ronda adicional ni cambios visuales posteriores. Capturas revisadas en `/private/tmp/checkpass-gastos-review/ui-results/expenses-input-Inspección--3eb19-sición-foco-y-desborde-390-/expenses-390.png` y `/private/tmp/checkpass-gastos-review/ui-results/expenses-input-Inspección--2d837-ición-foco-y-desborde-1280-/expenses-1280.png`. El modal existente conserva scroll vertical cuando el contenido supera la altura disponible. Sin activos decorativos ni documentación global de diseño.

Pendiente QA independiente del candidato congelado y revisión del owner. El fixture no certifica guard HTTP autenticado, DB, IA real ni eventos, que no cambian en este ajuste. Sin procesos persistentes: harness cerrado en `afterAll` y entrada temporal eliminada. Sin DB, env PROD, push, estados/índices ni aceptación factory; integración y cleanup corresponden al coordinador.

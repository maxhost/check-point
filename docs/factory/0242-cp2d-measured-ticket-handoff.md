# 0242 — CP2d.6 resultado, ticket e impresión preparados

TaskID `measured-ticket-0242`. Base `49215e06734bb4ebdbd8587b495e0d1748e10d5e`; worktree `/private/tmp/checkpass-pos-0242/measured-ticket-0242`, ref local `measured-ticket-0242`. Fuente congelada `a95419e7ba9eea6e91a0a1ebcbcdd7cc2eae8ec3`; producto y browser corresponden a `bac6219e0c1b56c765d9441b033fcdbbe3eff048`. Entre ambos solo se añaden dos casos unitarios de ajuste monetario. Este handoff se añade después, sin cambiar producto.

## API y ownership

Diseño propuesto y aprobado antes del código. El padre conserva `PosOrderV2` canónica, `PosClient` V2 e identidad real de sesión; no se conecta consola, entry ni ruta en este bloque.

- `buildMeasuredTicket(order, settings, { now?, qr? }) → TicketDoc`: puro, exportado por `printing/index.ts`. Cantidad textual con unidad y tarifa original exacta; ninguna masa/tarifa pasa por `Number`. Abierta: kernel compartido `buildFinancialAmountsFromSnapshots`, moneda DTO y asignación acumulada única. Terminal: autoridad congelada de settlement/financialSnapshot/DTO; sin reconstrucción desde catálogo. Total cerrado prioriza settlement y respeta cero, moneda y precisión históricos.
- Extensión compatible `TicketLine.quantity: number | string`; `TicketDoc.metadata?` contiene tipo de documento/estado, tipo de venta, identificador y nota. HTML y ESC/POS consumen esos mismos campos. Builder legacy intacto. Transportes/dispositivo/papel intactos.
- `useMeasuredPrinting({ order, client, context, prepare, onError })`: `context` debe ser la identidad real del padre, no un label de local. `prepare=false` no lee ajustes; el padre lo activa después de tener lista usable o al abrir detalle/resultado. Ajustes y `doc` quedan listos antes del gesto. Devuelve ready/enabled/doc/settingsError, busy/issue/notice/browserDoc, print/retry/choose/retrySettings/dismiss. Compatible estructuralmente con `PosPrintFeedback`.
- Identidad de cliente/contexto/preparación + id/versión/estado retira callbacks y documento. Guarda de vida antes de tocar dispositivo y tras await, más retiro al desmontar. `choose` solo selecciona; éxito muestra «Impresora lista. Vuelve a imprimir el ticket.»; la impresión requiere otro gesto. Doble toque bloqueado mientras corre un intento. Fallback HTML se monta síncronamente antes de `window.print()` y se suprime si el intento quedó retirado.
- `MeasuredTicket({ order, printing })`: el padre entrega el hook de esa misma orden/contexto. Precuenta abierta, reimpresión cerrada y anulada identificadas; cerrada con pase muestra acreditación/saldo/cupón/extras del DTO; sin pase lo indica. Ningún comando monetario, autoprint ni dependencia del cobro. Fallar/reintentar impresión conserva el cierre conocido.

## Archivos reales

Los doce paths reservados de la ficha; sin extensión:

- `apps/merchant/src/modules/pos/ui/printing/ticket/build-measured.ts`
- `apps/merchant/src/modules/pos/ui/printing/ticket/build-measured.test.ts`
- `apps/merchant/src/modules/pos/ui/printing/ticket/types.ts`
- `apps/merchant/src/modules/pos/ui/printing/index.ts`
- `apps/merchant/src/modules/pos/ui/printing/escpos/layout.ts`
- `apps/merchant/src/modules/pos/ui/pos-print-ticket.tsx`
- `apps/merchant/src/modules/pos/ui/measured-ticket.tsx`
- `apps/merchant/src/modules/pos/ui/measured-printing.ts`
- `tests/e2e/pos-measured-ticket.spec.ts`
- `tests/e2e/support/pos-measured-ticket-harness.tsx`
- `tests/e2e/support/pos-measured-ticket-fixture.ts`
- Este handoff.

## Evidencia y comandos

Node `24.20.0`, pnpm `11.4.0`, lockfile SHA256 `4cfe18864f12af4fe3b0cd84ab477e936ecd52d96847579cc087e6e13b020821`. Logs externos `/private/tmp/measured-ticket-0242-evidence`, con `manifest.json` que fija revisiones, entorno, exits, fallos y límites. Fuente congelada antes de cada corrida; sin edición de runners vivos.

Sobre `bac6219e`:

- `pnpm --filter @mi-pasaporte/merchant typecheck`: EXIT0, `r2-types.log`.
- `pnpm exec eslint` de los siete paths de producto/printing y tres archivos de harness/spec: EXIT0, `r2-lint.log`.
- `node tools/ui-guard.ts --base 49215e06734bb4ebdbd8587b495e0d1748e10d5e`: EXIT0, siete archivos sin aumentos, `r2-guard.log`.
- `git diff --name-only BASE | xargs pnpm exec prettier --check`: EXIT0, `r2-format.log`.
- `pnpm exec vitest run apps/merchant/src/modules/pos/ui/printing`: EXIT0, 37/37, `r2-unit.log`.
- `pnpm exec playwright test --config /private/tmp/measured-ticket-0242.playwright.config.cjs --output /private/tmp/measured-ticket-0242-r2-browser`: EXIT0, 13/13, cero retries/skips, `r2-browser.log`. Config SHA256 `9965dbf69e6b9263d9d72081447e1c52c2aacf6c315a1fc3793bbd99622d3e99`, Chromium propio, un worker, sin webServer/Next/DB.

Sobre `a95419e7`, única modificación posterior: dos casos puros de ajuste COP positivo/negativo. `pnpm exec vitest run apps/merchant/src/modules/pos/ui/printing`: EXIT0, 39/39, `r3-unit.log`. ESLint y Prettier del único archivo cambiado: EXIT0, `r3-test-format.log`. La evidencia de producto/browser anterior conserva identidad de árbol en sus paths.

Casos observados: nueve decimales kg/lb/g y tarifa de distinta unidad; cantidad legacy2147483647 y tarifa legacy amplia; COP2×0.49→1+0=1; moneda histórica USD/COP/JPY, neto0, bruto/descuento y ajuste±1; terminal sin recálculo; metadatos y bytes58/80 dentro de columnas; precuenta/reimpresión/pase/sinpase/anulada; ceroGET antes de preparación; ajustes fallidos/retry/disabled; selección síncrona (pila `at choose` sin suspensión previa y activación real del navegador), impresión en gesto separado; doble toque; cancelled/write_failed/unsupported; retiro de callbacks por contexto/orden/versión/estado/unmount; selección tardía sin encadenar impresión y fallback tardío suprimido; soloGETticket al imprimir, cero comandos de venta.

Inspección Impeccable harden/craft-floor: contexto existente respetado, sin rerun/init/drift. Una inspección agrupada390/1280 y una confirmación tras acotar ancho de lectura. Capturas finales ABIERTAS `/private/tmp/measured-ticket-0242-evidence/ticket-390.png` y `ticket-1280.png`, fuera de carpetas autolimpiables del runner. Sin overflow horizontal; lectura y controles conservan espacio. No quedan más rondas visuales pendientes.

## Fallos iniciales y límites

Revisión inicial `8203ce48`: tipos EXIT2 por campo identity requerido por feedback legacy; puros EXIT1 (5 fallos por fixture cerrado que compartía objetos); browser EXIT1 (12/13, marcador microtask de gesto inválido entre captura/burbujeo DOM). Corregidos en `bac6219e`, sin relajar cobertura: fixture aislado por clone, identidad estructural y comprobación de pila síncrona/activación. Logs iniciales preservados. No se declara PASS sobre esa revisión.

Sandbox: git index.lock y ps dieron EPERM, avisados al coordinador y resueltos con escalación acotada propia. Chromium arrancó escalado desde el inicio. Sin bypass de hooks, push, PROD, DB/env/wrapper, Next build, fullverify, M0/M1, puerto3201, túnel ni artefactos ajenos. `ps/lsof` escalados de solo lectura confirmaron cero runners y `OWN_WORKTREE_CWD_PROCESSES=0`; registro `processes.log`.

Preparado para conexión posterior por otro incremento y QA NUEVO independiente. Harness usa kit/CSS/transportes reales con BLE/window.print simulados; no acredita papel físico ni BLE hardware. Un transporte ya invocado no se cancela desde este hook; se retiran sus efectos UI tardíos y nunca se inicia una nueva impresión desde una selección antigua. Sin pendientes de implementación; el autor conserva el worktree y fixes hasta aceptación, y el coordinador gestiona factory/refs/estados/integración.

## Corrección de QA del mismo bloque

QA independiente rechazó la entrega original: `choose → unsupported → finish` podía abrir `window.print()` desde el gesto de selección. Informe original commit `7bbb5697801f809ff85fd4506a0ca59200e158d7`; reproducción y FAIL EXIT1 preservados en `/private/tmp/measured-ticket-qa/choose-escalated.log`, con copia propia `qa-original-fail-choose.log` en el directorio de evidencia del autor. Los PASS anteriores no cubrían esa rama y no certifican la aceptación del bloque.

Fuente correctiva congelada `8136b5a0f955797c35976d4970838955496a0368`: solo hook y regresión propia. Los fallos de selección ahora liberan el lock y muestran su issue; no atraviesan `finish`, no montan fallback ni imprimen. `print/retry` conservan la ruta de impresión y requieren otro gesto. Tres casos añadidos: selección unsupported (repro exacto de QA), cancelled y write_failed, todos con cero escrituras/cero window.print antes del retry explícito y sin nuevos comandos de venta. El mismo QA debe revalidar; no hay aceptación aún.

Checks afectados sobre esa fuente, Node24.20.0 y configuración Chromium propia anterior, todos EXIT0:

- Tipos merchant: `pnpm --filter @mi-pasaporte/merchant typecheck`, log `qa-fix-types.log`.
- ESLint y Prettier del hook/spec; `node tools/ui-guard.ts --base ce76a92ffbf998fca44f56e13a955c28f4a660fd`: un archivo UI, sin aumentos; log `qa-fix-static.log`.
- Browser: mismo comando/config anterior, con `--grep-invert 'grouped ticket inspection' --output /private/tmp/measured-ticket-0242-qa-fix-browser`; 15/15 funcionales, cero retries/skips, log `qa-fix-browser.log`. Conserva selección exitosa/gesto, cancelación/fallo de impresión, fallback solo tras gesto print/retry y retiros tardíos de identidad/orden/unmount. La captura se excluyó expresamente de esta selección, no se ejecutó otra ronda visual.

Builder financiero, renderers, transportes, dispositivo, papel y copy genérica intactos. Evidencia previa financiera y capturas sigue aplicando a esos mismos paths; no se repite su matriz. `manifest.json` conserva los fallos y añade fuente, comandos, resultados y límites de la corrección. Solo se modifican hook, spec de regresión y este handoff; sin factory/refs/estados/push/PROD.

Auditoría final de la corrección con ps/lsof escalados de solo lectura: cero runners y `OWN_WORKTREE_CWD_PROCESSES=0`. Sin procesos que detener; worktree conservado para fixes hasta aceptación del mismo QA.

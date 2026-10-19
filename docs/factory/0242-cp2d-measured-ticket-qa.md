# 0242 — QA independiente CP2d.6 ticket e impresión preparados

**FAIL** sobre candidato congelado `73bda9975bf19210ef5f7c18d0866f93f0d68170`, base de integración `707bcdb4` (consola aceptada). QA en `/private/tmp/checkpass-pos-0242/pos-qa-0242`, sin cambios de producto, refs ni factory. Requiere corrección del autor y nueva revisión antes de aceptar este bloque.

## Hallazgo bloqueante: seleccionar puede iniciar impresión

`apps/merchant/src/modules/pos/ui/measured-printing.ts:174` deriva todos los fallos de `choose()` a `finish()`. La rama `unsupported` de `finish()` (líneas152–154) monta el documento y llama `window.print()`. Esto viola el contrato explícito de este incremento: elegir solo selecciona; imprimir requiere otro gesto separado, también cuando falla la selección.

Reproducción sobre el harness y transportes reales del candidato, BLE/window.print simulados:

1. Preparar ticket habilitado, sin impresora guardada y con BLE disponible.
2. Pulsar «Imprimir precuenta»; aparece `no_printer` y «Elegir impresora».
3. Retirar soporte BLE (`Object.defineProperty(navigator, 'bluetooth', {value: undefined, configurable: true})`), manteniendo Serial ausente.
4. Pulsar «Elegir impresora».

Esperado: cero invocaciones de impresión; selección fallida y posibilidad de un gesto explícito posterior. Observado: `window.ticketTest.browsers === 1`, invocado por la selección. No es un fallo monetario ni de hardware; es una ruta incorrecta en la API preparada. El caso fuerza el cambio de disponibilidad para alcanzar determinísticamente `choosePrinter → unsupported`; no acredita que un navegador concreto retire espontáneamente esa API.

Caso externo conservado: `/private/tmp/measured-ticket-qa/choose.spec.ts`; configuración `/private/tmp/measured-ticket-qa-config.cjs`, un worker, retries0, sin webServer/Next/DB. Comando desde el worktree QA, tras `source ~/.nvm/nvm.sh && nvm use`:

```sh
pnpm exec playwright test --config /private/tmp/measured-ticket-qa-config.cjs --output /private/tmp/measured-ticket-qa-output
```

Resultado real EXIT1, 0pass/1fail, 0skip/0retry; aserción esperado0/recibido1. Log `/private/tmp/measured-ticket-qa/choose-escalated.log`. El autor debe separar el manejo de fallo de selección del fallback de impresión y conservar cobertura de selección correcta, cancelación, fallo, retiro y retry explícito. QA no implementó el arreglo.

## Evidencia auditada y alcance

Node `24.20.0`, pnpm `11.4.0`. SHA256 real del lockfile `4cfe18864f12af4fe3b0cd84ab477e936ecd52d96847579cc087e6e13b020821`; configuración browser autor `9965dbf69e6b9263d9d72081447e1c52c2aacf6c315a1fc3793bbd99622d3e99`, ambos coinciden con manifest. Diff de los paths ticket: producto/browser sin cambios desde `bac6219e0c1b56c765d9441b033fcdbbe3eff048`; `a95419e7ba9eea6e91a0a1ebcbcdd7cc2eae8ec3` añade únicamente dos casos unitarios COP±1; `ce76a92ffbf998fca44f56e13a955c28f4a660fd` documenta handoff. Paths ticket idénticos entre `a95419e7` y candidato; los otros cambios corresponden a consola previamente aceptada y documentación, fuera de esta certificación.

Reutilización pertinente del autor, revisando manifest y logs externos `/private/tmp/measured-ticket-0242-evidence`: tipos/lint/formato/UIguard EXIT0, puros39/39 EXIT0 (`r3-unit.log`), browser13/13 EXIT0 (`r2-browser.log`), cero skips/retries. No se repitió la batería por ceremonia; estos resultados conservan identidad, pero no cubren el hallazgo nuevo y no convierten esta entrega en PASS.

Inspección de contrato, diff y fuentes: builder V2 produce el mismo TicketDoc para HTML/ESC-POS; cantidades/tarifas permanecen textuales, unidades y nueve decimales intactos; abierta usa kernel único y reparto COP; terminal prioriza settlement congelado incluido cero, moneda histórica y ajustes; legacy builder y transportes/dispositivo/papel intactos. Hook no GET con preparefalse, prepara doc antes del gesto y llama transportes antes del await; identidad de cliente/contexto/id/versión/estado y unmount retiran callbacks/efectos tardíos. Impresión no contiene comandos de venta. Resultado distingue pase, sinpase y anulada. El defecto señalado está en la separación entre selección fallida y fallback, no en la selección exitosa ya probada.

Correcciones iniciales `8203ce48 → bac6219e` auditadas: identity estructural para feedback, clone aislado del fixture y comprobación de pila síncrona/activación. No se eliminaron los casos ni se añadieron skips/retries para ocultar el rojo anterior; sus fallos quedan en manifest/logs. QA abrió las dos capturas conservadas `ticket-390.png`/`ticket-1280.png`: texto legible, importes y metadatos visibles, controles con espacio, sin desbordamiento observable. No hubo nueva ronda visual ni sobrescritura de capturas.

## Entorno, cierre y límites

Primer intento QA browser: fallo de setup antes del caso por sandbox MachPortRendezvous1100; log `/private/tmp/measured-ticket-qa/choose.log`. Avisado inmediatamente al coordinador, resuelto con escalación propia acotada autorizada. La segunda ejecución anterior es un caso nuevo completo, retries0; se conserva el fallo de setup y no se declara PASS por repetirlo. `ps` dio EPERM, avisado y escalado solo lectura junto a lsof: ningún runner ni servidor QA vivo; solo observadores Python/lsof durante auditoría, ya terminados al entregar.

Sin DB/env/wrapper, Next build, fullverify, M0/M1, puerto3201, túnel, demos, push ni PROD. Sin conexión nueva de tickets a consola; integración posterior requiere su propio incremento y QA de cableado. BLE/window.print simulados no acreditan papel físico, hardware ni E2E de venta por masa. Un transporte ya iniciado no se cancela desde el hook; se suprimen sus efectos UI tardíos. Único archivo versionado escrito por QA: este informe.

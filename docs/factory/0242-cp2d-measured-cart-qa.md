# 0242 — QA independiente CP2d.1 carrito medido

Resultado: **PASS focal de componentes/modelo**. No se encontraron defectos reproducibles pendientes en el alcance revisado. Este informe no certifica PosConsole, transporte HTTP, guard/DB, cierre/cobro ni venta por peso canónica conectados.

## Identidad y alcance

Base funcional aceptada `d6574cdb`; autor final de producto `ca94bed261a2c4495fefed19bcce18bfc6e40469`, incluidos el bloqueo de overflow agregado `3a52e1e710aebba40068cb5ba2f61b32cd41ce24` y la conservación literal de buffers editados. Reproducción QA en copia congelada `f57aefde91670f671265dbf5cef9f8293b1b07c0`; handoff final del autor `a4f80dc64fd2370c6aed01c8f1b1558d40c68820`, adjuntado en copia QA `ca370c5a8195169e3c9abc8eb5ac9e143c20d70f` (delta documental, sin cambio de producto). La base del autor es `da3cfbc56a481c105d7251bc8bc7ce426c5102cd`; `d6574cdb` es la base de integración aceptada. Solo este informe se modifica por QA.

Lectura de ficha, contrato0242, protocolos, COPY y skill Impeccable (harden/craft-floor). Contexto de diseño previamente cargado por coordinador, sin reinicio, drift ni cambios de diseño. Revisión del diff de los siete archivos de componentes/modelo/pruebas frente a la base.

## Aceptación observada

- Fuente exacta separada de la presentación: cambio kg/lb/g, aproximación visible y confirmación sin editar conservan quantity/quantityUnit de origen; captura explícita admite coma y nueve decimales. La vista no serializa el redondeo.
- Mass exige captura manual, sin 1kg implícito. Unit mantiene enteros y controles con nombres por línea. Buffers vacíos/parciales/erróneos permanecen visibles; confirmar y serializar quedan bloqueados. Fix final conserva el texto literal editado, incluido `1.` y `1,`.
- Unidad histórica deshabilitada y cantidad legacy alta se conservan sin cambio; nuevas capturas rechazan unidad retirada, exceso de escala/límite y dimensión incompatible. Tarifa histórica amplia se conserva mediante el núcleo compartido. Tarifa cero válida; precio null rechazado.
- Existentes preservan lineId, productId null, nombre, tarifa, priceUnit, conversionVersion y financialSnapshot por copia/spread. Nuevas serializan solo producto, revisión y cantidad/unidad; no generan UUID ni HTTP. Líneas del mismo producto conservan snapshots y posiciones separados; no se fusionan por productId. Límite 200 y duplicados validados.
- El núcleo financiero común calcula importes y valida el total exacto agregado. QA browser reprodujo dos adiciones mass de 500000000kg válidas, tercera bloqueada por importe combinado y edición de una a 700000000 bloqueada. Escape conservó el payload anterior.
- Etiquetas de diálogo/campo/unidad y acciones por línea están presentes. El recorrido comprobó foco inicial de cantidad y cancelación por Escape; la evidencia del autor cubre Enter y doble confirmación sin duplicar una adición mass. No equivale a auditoría completa de lector de pantalla o dispositivo físico.

## Evidencia y resultados

Reproducción propia: Node `v24.20.0`, pnpm `11.4.0`, macOS, harness esbuild/CSS real y Chromium headless Playwright `1.63.0`; sin DB/env/wrapper/Next/auth. Lockfile SHA1 `b75587deab2aae0cc688765d0cdc0acc59ecb250`; config QA SHA1 `31f91b82e2376db039f186fffd57df8d95b5b904`. Logs completos, comandos, SHA, hora y exit en `/private/tmp/checkpass-pos-0242/cart-qa/`:

| Check | Comando/configuración | Resultado |
|---|---|---|
| Modelo puro | Desde apps/merchant: `pnpm exec vitest run src/modules/pos/ui/measured-cart-model.test.ts` | 17/17, exit0, sin skips/retries |
| Tipos merchant | `pnpm --filter @mi-pasaporte/merchant typecheck` | exit0 |
| Browser QA decisivo | `pnpm exec playwright test --config /private/tmp/checkpass-pos-0242/cart-qa/playwright.config.cjs` | 1/1, exit0, retries0, sin skips; test externo `critical.spec.ts` |

Se reutiliza evidencia compatible del autor: modelo17 en `cart-3a52e1e7-unit.log`; tipos/lint/formato/UIguard y tres browsers funcionales finales en `cart-ca94bed2-*.log`. Guard informa tres archivos sin aumentos. Inspección agrupada anterior 4/4 browser en `cart-ab23c57b-browser.log`; los dos fixes posteriores no alteran layout. Sus cuatro capturas `cart-{390,1280}.png` y `cart-dialog-{390,1280}.png` fueron **abiertas e inspeccionadas** por QA: composición legible, botones y títulos sin recorte observado, nombres largos envueltos, cantidad/tarifa/unidad distinguibles y señal/explicación de aproximación presentes. No se inició una ronda de polish adicional.

La evidencia final reutilizada no declara PASS de los intentos anteriores fallidos: `cart-browser.log`, `cart-browser-escalated.log` y `cart-types.log` se conservan fueraWT. Intentos iniciales del autor: tipos exit2 por alias de fixture (corregido con import relativo); browser sandbox 4 fallos de lanzamiento; primer browser escalado 3/4 por expectativa errónea de overflow para un importe válido (corregida sin retirar cobertura de overflow real); prettier inicial exit2 por patrón inexistente. Se conservan también las limitaciones y warnings del handoff, sin computar esos intentos como PASS. El bloqueo Chromium MachPortRendezvous1100 conocido se evita en QA ejecutando desde el inicio el runner propio con escalación acotada autorizada; no es defecto de producto. `ps` denegado por sandbox en primera comprobación QA (EPERM) y recuperado con escalación acotada: exit0, cero procesos coincidentes del runner/WT. Sin fallos de producto, skips ni retries en las reproducciones QA. Warnings observados: NO_COLOR/FORCE_COLOR y MODULE_TYPELESS_PACKAGE_JSON, sin alterar configuración para ocultarlos.

## Límites y cierre

QA de entrega acotada, sin certificar combinación futura con contenedor operativo ni gates de publicación. No se ejecutaron DB, entorno productivo, servidor3201, túnel, M0 ni demos. Sin cambios en kit/guard, producto, pruebas, estados, índices o refs principales. Runner/harness externo cerrado; 0checks activos y WT limpio antes de adjuntar documentos. Sin push/PROD. Commit propio de este informe y aceptación/integración corresponden a los pasos de entrega del coordinador.

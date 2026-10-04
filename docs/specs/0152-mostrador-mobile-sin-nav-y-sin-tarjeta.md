---
spec: 0152
fecha: 2026-10-04
estado: cerrada
resumen: El flujo móvil de Mostrador oculta la navegación inferior, cierra con la X a Mostrador y aprovecha el ancho sin tarjeta interior; las acciones de venta detallada quedan visibles.
disjunta: si
archivos: apps/merchant/src/app/backoffice/counter/{counter-console,stages}.tsx, apps/merchant/src/app/globals.css, tests/e2e/**
---

# 0152 — Mostrador móvil sin navegación inferior ni tarjeta interior

## Problema

- `backoffice-navigation.tsx:286` pinta la navegación inferior durante todo el flujo; `globals.css:2498` la fija con `z-index: 50`, encima del footer de venta detallada (`globals.css:4852`, `z-index: 20`). Por eso tapa «Cancelar» y «Acreditar compra».
- `stages.tsx:50` envía la X a `/backoffice`, aunque el flujo nació en Mostrador.
- `globals.css:199,4419` suma el padding de `merchant-shell` a la tarjeta blanca de `counter-panel` dentro del lienzo verde, reduciendo el ancho útil en teléfonos.

## Alcance

**Entra:** ocultar la navegación inferior solo mientras el flujo de Mostrador está abierto (elección de local, escaneo, venta detallada, venta rápida, canje y resultado); X vuelve a la pantalla inicial de Mostrador; panel sin tarjeta blanca ni padding duplicado en móvil; footer de venta detallada con resumen y ambas acciones visibles y pulsables sobre el área segura.

**No entra:** cambios de API, cálculos de puntos/cupones, comportamiento del mostrador en escritorio ni rediseño de las tarjetas individuales del catálogo.

## Diseño

`CounterConsole` distingue `idle` del flujo abierto. `Console` recibe `onClose=reset`; X llama a ese callback. Una clase del shell identifica las etapas no `idle` y CSS oculta `.backoffice-mobile-nav` solo cuando el layout contiene esa clase y el viewport usa navegación móvil. La pantalla inicial conserva la navegación. Con la navegación oculta, el footer fijo queda por encima del contenido, con espacio de scroll reservado y `safe-area-inset-bottom`.

En móvil, el shell reduce los márgenes laterales y `.counter-panel` pierde fondo blanco, sombra, borde redondo y padding; los campos, botones y tarjetas de producto conservan sus propios estilos. En escritorio se conserva la tarjeta actual.

## Archivos

| Archivo | Acción |
|---|---|
| `apps/merchant/src/app/backoffice/counter/counter-console.tsx` | pasar `reset` como cierre del flujo |
| `apps/merchant/src/app/backoffice/counter/stages.tsx` | clase del flujo y X por callback |
| `apps/merchant/src/app/globals.css` | navegación, ancho móvil, panel y footer |
| `tests/e2e/**` | prueba móvil si el arnés permite montar el flujo sin datos de producción |

**Disjunta?** Sí; la 0151 de Claude no toca estos archivos.

## Definition of Done

- [x] En 390 px, `idle` muestra navegación; escaneo, venta detallada, rápida y canje la ocultan; X vuelve a `idle`.
- [x] En 390 px, el footer detallado muestra resumen, «Cancelar» y «Acreditar compra» sin solaparse con la navegación ni el área segura.
- [x] En 390 px, el panel del flujo no añade la tarjeta blanca y usa más ancho; en escritorio conserva su presentación.
- [x] Typecheck, lint y formato pasan; `pnpm verify` con Node 24 se ejecutó y su resultado rojo solo en build Turbopack quedó registrado en `docs/estado/gpt.md`.
- [x] `rg -n MUTATION apps/merchant/src/app/backoffice/counter apps/merchant/src/app/globals.css` → vacío.

## Mutaciones — presupuesto: 0

Se comprueba el flujo en viewport móvil y las regresiones con los gates del repositorio.

## Declarado AFUERA (sin oráculo, a propósito)

- Escaneo con cámara física y acreditación de una venta real.

## Handoff

UI publicada en `1927742`; el owner confirmó el deploy. QA en teléfono y revisor independiente quedan pendientes antes de marcar `implementada`.

## Abierto

Nada.

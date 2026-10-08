---
spec: 0176
fecha: 2026-10-08
estado: cerrada
resumen: Orden abierta sin tarjeta exterior, con contenedor de Mostrador y X para volver al listado POS.
disjunta: no
archivos: apps/merchant/src/app/backoffice/pos/pos-console.tsx, tests/e2e/pos.spec.ts
---

# 0176 — Orden abierta aprovecha la pantalla

L1, mini plan cerrado antes del código.

## Problema

`pos-console.tsx:463` envuelve el detalle de una orden en Card, con padding y fondo
que consumen espacio. Solo edición usa counter-flow. La X actual sale a /backoffice.

## Diseño

Detalle de orden abierta usa counter-shell/counter-flow de Mostrador: barra mobile
oculta y padding móvil existente. La tarjeta exterior se sustituye por contenedor
simple sin borde, fondo ni padding. Ancho disponible completo. Edición conserva
DetailedSale reutilizado. Navbar de escritorio conserva sidebar como Mostrador;
la barra mobile es la navegación que se oculta en el flujo.

X de detalle/edición vuelve al listado POS mediante back, sin navegar ni consultar
de nuevo cuando hay historial en caché. X del listado navega a /backoffice. El botón
de retorno del detalle mantiene comportamiento. X deshabilitada mientras escribe
o recupera. Cabecera usa module-topline existente para posición móvil como Mostrador.
Checkout y órdenes cerradas conservan su presentación y acciones actuales.

## Verificación

- Navegador móvil: abrir mesa oculta navbar; detalle sin Card exterior; X vuelve
  a Abiertas sin GET extra; edición usa el carrito existente y X vuelve al listado.
- Navbar vuelve al listado y X del listado apunta al inicio.
- Capturas móvil/escritorio vistas, sin desbordamiento; pruebas POS afectadas,
  typecheck, lint, formato, guardia y números verdes.

Sin CSS, kit, servidor, API, polling o cambios de importes. No disjunta con POS.
0 mutaciones; sin build/global verify sobre dev activo. Owner prueba pnpm dev:local;
commits locales dev, sin merge ni push. Sin decisiones abiertas.

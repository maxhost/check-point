---
spec: 0175
fecha: 2026-10-08
estado: cerrada
resumen: Filas compactas para órdenes abiertas con mesa, total y Abrir.
disjunta: no
archivos: apps/merchant/src/app/backoffice/pos/pos-console.tsx, tests/e2e/pos.spec.ts
---

# 0175 — Órdenes abiertas compactas

L1, mini plan cerrado (ADR 0129).

## Problema

`pos-console.tsx:365` muestra las abiertas en tarjetas con local, estado,
cantidad de productos y fecha. El owner señala demasiado scroll y pide solo
nombre de mesa, total y botón Abrir.

## Diseño y alcance

Solo Abiertas pasa a una lista vertical de filas compactas con mesa a la izquierda,
total y Abrir a la derecha. Nombre largo admite salto de línea; total y botón
conservan espacio. Usar contenedor con borde/superficie y utilidades Tailwind,
Heading/Text/Button del kit; sin nuevos nativos interactivos, CSS ni paleta.
Botón visible Abrir, nombre accesible Abrir seguido del nombre de la mesa para
distinguir filas. Mantener loading/disabled y el manejador openOrder existente.
No cambiar Cerradas hoy, importes, contratos ni caché.

## Verificación

- Navegador con tres abiertas: solo nombre, total y Abrir; abre el detalle correcto.
- Capturas móvil/escritorio vistas: filas compactas, sin scroll horizontal y X
  de 0174 arriba a la derecha con enlace a inicio.
- Pruebas POS existentes con aserción de resumen ajustada a total visible;
  typecheck, lint, formato, guardia UI y números verdes.
- Sin build, suite global ni mutaciones (L1). Owner prueba con pnpm dev:local.

No disjunta con consola/pruebas POS. Sin cambios de API, kit o servidor.
Sin decisiones pendientes. Commits locales dev; sin merge ni push.

## Evidencia

31 pruebas POS verdes (14,0 s), incluida lista móvil con tres mesas y nombre largo,
solo tres campos y apertura correcta; sin overflow horizontal. Typecheck, lint,
guardia UI y números verdes. Owner confirmó que probó las filas y funcionan.
Capturas móvil/escritorio vistas junto a 0176, /private/tmp/pos-0175-*.png.

---
spec: 0177
fecha: 2026-10-08
estado: cerrada
resumen: Orden abierta centrada en la mesa, con acciones jerarquizadas y cómodas en móvil.
disjunta: no
archivos: apps/merchant/src/app/backoffice/pos/pos-console.tsx, apps/merchant/src/app/backoffice/pos/pos-ticket.tsx, tests/e2e/pos.spec.ts
---

# 0177 — Jerarquía de la orden abierta

L1, mini plan cerrado antes del código.

## Problema y diseño

La cabecera en pos-console.tsx muestra POS y el ticket repite el comercio y la mesa.
Las acciones Imprimir/Editar/Anular/Cobrar comparten una fila que se corta en móvil.
El owner pide centrarse en la orden y jerarquía de acciones.

En el detalle abierto, cabecera con nombre de mesa, estado Orden abierta y local.
Ticket compacto en pantalla: productos, precios, total y metadata, sin repetir
comercio, local o mesa. La impresión conserva comercio/local/mesa completos con
utilidades print; compact es opcional y el resto de vistas conserva presentación.

Acciones abiertas reutilizan counter-detailed-footer: en móvil quedan al pie con
espacio reservado para no tapar contenido; desde md forman parte del documento.
Fila principal: Editar secundaria, Cobrar primaria, ambas amplias en dos columnas.
Fila secundaria: Imprimir y Anular discretas; Anular mantiene texto danger y
validación/confirmación existente. Kit, Tailwind, tokens; sin nueva paleta/CSS.
X y caché conservan comportamiento. Checkout/cerradas no cambian.

## Verificación

- Navegador móvil: nombre de mesa como título, POS/comercio ausentes del contenido,
  acciones principales de ancho igual, Cobrar primaria/Editar secundaria, imprimir
  y anular discretas; contenido no queda tapado.
- Impresión conserva nombre del comercio/local/mesa; captura móvil/escritorio vista.
- Pruebas POS existentes adaptadas al título único; typecheck, lint, formato,
  guardia UI, números y diff-check verdes.

Sin cambios de API, reglas de dinero, kit, CSS o servidor. No disjunta con POS.
Sin mutaciones nuevas ni build/global verify sobre dev activo. Owner prueba
pnpm dev:local; solo dev, sin merge ni push. Sin decisiones abiertas.

## Evidencia

33 pruebas POS pasan (14,3 s). Mesa como h1; POS/comercio ausentes del
contenido visible; Cobrar primaria y Editar secundaria con ancho igual y alto
48 px; Anular discreta danger. Total por encima del footer, sin overflow.
Impresión muestra comercio, local y Mesa · Precuenta. Capturas móvil 390 px y
escritorio 1100 px vistas en /private/tmp/pos-0177-*.png. Typecheck 6 paquetes,
ESLint, Prettier, guardia UI 22 archivos sin aumentos, números y diff-check verdes.
Sin build/global verify. Pendiente owner QA local antes de main.

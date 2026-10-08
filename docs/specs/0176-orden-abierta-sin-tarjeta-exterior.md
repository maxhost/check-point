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

## Evidencia

32 pruebas POS pasan (14,5 s). Nueva prueba: móvil 390 px, navbar oculta,
contenedor exterior con padding/borde cero y fondo transparente; main ancho
390 px; X vuelve a Abiertas sin GET adicional, navbar vuelve y edición conserva
retorno. Capturas móvil/escritorio vistas (390/1100 px) en /private/tmp/pos-0176-*.png.
Typecheck 6 paquetes, ESLint, formato, guardia sin aumentos y números verdes.
Se ajustó X a size-6 tras revisión visual y se repitió la prueba específica.
Owner confirmó QA de X (0174) y listado compacto (0175); falta QA de esta vista.

Revisión final: padding del botón eliminado con utilidad Tailwind; icono con ancho
real 24 px verificado por navegador, prueba puntual 1/1 (2,0 s), captura móvil vista.

## Ajuste solicitado por owner — cabecera y retorno

Cerrado antes del código: retirar Volver al historial solo de órdenes abiertas,
porque la X ya vuelve al listado. Quitar module-topline de la cabecera POS: esa
clase activa el fondo de canvas en counter-flow móvil y genera el bloque blanco.
X de POS conserva el aspecto de Marca (fondo suave, color primario, círculo), pero
fija ancho y alto iguales con utilidades del kit, sin copiar colores ni cambiar Marca.
Verificar en navegador fondo transparente, botón redundante ausente, ancho/alto
44 px, icono 24 px y retorno correcto. Adaptar las pruebas a la X.

Ajuste verificado: 32 pruebas POS pasan (14,8 s). X 44×44 e icono 24 px,
cabecera transparente y retorno inferior ausente en abiertas. Captura móvil vista.
Typecheck, ESLint, formato y guardia sin aumentos verdes.

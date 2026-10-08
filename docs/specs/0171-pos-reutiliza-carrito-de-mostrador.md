---
spec: 0171
fecha: 2026-10-08
estado: cerrada
resumen: POS reutiliza la venta detallada de Mostrador para catálogo, carrusel de categorías, búsqueda y cantidades en las tarjetas, conservando snapshots y contrato 0169.
disjunta: no
archivos: apps/merchant/src/app/backoffice/pos/pos-console.tsx, apps/merchant/src/app/backoffice/pos/pos-editor.tsx, apps/merchant/src/app/backoffice/pos/pos-cart.tsx, apps/merchant/src/app/backoffice/pos/pos-types.ts, apps/merchant/src/app/backoffice/counter/sale-forms.tsx, tests/e2e/pos.spec.ts
---

# 0171 — POS reutiliza el carrito de Mostrador

L2. Corrección de presentación solicitada por el owner tras probar la 0170 en dev.

## Problema

- `pos/pos-editor.tsx:137`: catálogo separado del carrito, búsqueda permanente y SelectField de categoría.
- `counter/sale-forms.tsx:181`: Mostrador tiene Buscar/Cancelar búsqueda, carrusel horizontal de categorías
  y +/− en las tarjetas; POS implementó otra interacción.
- Mostrador ordena alfabéticamente (`sale-forms.tsx:35`) y recibe habituales por cliente al resolver.
  `/api/pos/catalog` solo trae products/categories (0169), sin ranking de más vendidos del local.

## Alcance

Entra: reutilizar DetailedSale existente desde POS, mismo catálogo, categorías, búsqueda y cantidades;
resumen compacto expandible y acciones de guardar/cancelar; ancho/padding del shell igual a Mostrador durante edición; mantener mesa/local, snapshots por lineId,
precios tipeados, edición de productos borrados y máximos de 200 líneas. Deshabilitar el componente compartido
mientras guarda (opcional, default false para Mostrador). Sin cambio de CSS o kit.

Dependencia pendiente del encargo completo: ranking de más vendidos exige datos nuevos en el contrato HTTP.
No se inventa un ranking a partir del catálogo alfabético ni se consulta la API de counter desde POS.
Owner confirmó «más vendidos del local». Se entrega la paridad visual ahora y el consumo opcional
de `bestSellingProductIds: string[]` en `/api/pos/catalog?locationId=`. Claude debe calcularlo
y definir el período en el contrato; ventas cerradas con/sin pase, sin anuladas. Mientras el campo
no exista se conserva el orden alfabético, sin fingir un ranking.

No entra: servidor, API, kit, migraciones, premios, ranking sin datos, cambios de reglas del Mostrador.

## Diseño

POS adapta sus DraftLine al CartLine que consume DetailedSale, sumando cantidades por productId
únicamente para mostrar el control. El estado de escritura sigue separado por key/lineId: no se fusionan
snapshots de distintos precios. Agregar o + aumenta la última línea existente del producto y conserva
su precio; − disminuye esa línea y la elimina al llegar a cero. Si no existe ninguna, crea una nueva
línea con precio de catálogo; productos sin precio muestran el campo del componente existente.
El resumen expandible muestra cada snapshot con precio, total y controles por línea, incluidos productos
eliminados del catálogo. Usa Button/Text del kit y utilidades con tokens, sin nuevos nativos interactivos.
DetailedSale se importa y reutiliza, no se copia su markup ni su CSS. Se añade solo disabled opcional a
sus controles; defaults sin cambios para Mostrador. El componente acepta productOrder opcional: orden del servidor primero; productos sin ranking
al final por nombre. Mostrador conserva el default alfabético. POS consume el campo propuesto
bestSellingProductIds si existe; integración real queda pendiente de Claude.

Se conserva el contrato 0169 de crear/editar; el PUT manda lista completa con lineId. Errores y autorización
siguen siendo los de 0170. POS no llama /api/counter. Guardar sigue permitiendo mesas sin productos.

## Archivos

Rutas del frontmatter. No disjunta con edición simultánea de sale-forms o del editor POS.

## Definition of Done

- [x] e2e: categorías horizontales, Buscar/Cancelar, añadir y quitar en tarjeta hasta cero, precio escrito.
- [x] e2e: guardar conserva lineId y precios guardados; snapshots duplicados/borrados permanecen separados.
- [x] Los siete e2e POS y pruebas de Mostrador afectados pasan.
- [x] Typecheck, lint, formato, ui-guard y números pasan con Node 24.
- [x] Capturas móvil/escritorio vistas; sin desbordamiento de página.

## Mutaciones

0 nuevas (L2, ADR 0129). Regresión de snapshots cubierta por la prueba de escritura de 0170.

## Declarado AFUERA

Ranking comercial: falta dato del contrato HTTP. QA del owner con catálogo real y PASS independiente.
No se ejecuta build sobre el dev local activo para evitar repetir el incidente de caché de la 0170.

## Evidencia

Node 24.20.0: 14 e2e afectados pasan (9 POS y 5 Mostrador), en 16,1 s.
Capturas móvil 390 px y escritorio 1100 px vistas. Ranking probado con respuesta HTTP
simulada; no existe aún en API real. Typecheck, ESLint, Prettier, ui-guard y números verdes.

## Handoff

Estado y evidencia en docs/estado/gpt.md; commits locales en dev, sin merge ni push.

## Abierto

Ninguna decisión pendiente para la paridad visual. El ranking pertenece a la dependencia HTTP declarada.

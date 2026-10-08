---
spec: 0171
fecha: 2026-10-08
estado: cerrada
resumen: POS reutiliza la venta detallada de Mostrador para catálogo, carrusel de categorías, búsqueda y cantidades en las tarjetas, conservando snapshots y contrato 0169.
disjunta: no
archivos: apps/merchant/src/app/backoffice/pos/pos-editor.tsx, apps/merchant/src/app/backoffice/pos/pos-cart.tsx, apps/merchant/src/app/backoffice/counter/sale-forms.tsx, tests/e2e/pos.spec.ts
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
resumen compacto expandible y acciones de guardar/cancelar; mantener mesa/local, snapshots por lineId,
precios tipeados, edición de productos borrados y máximos de 200 líneas. Deshabilitar el componente compartido
mientras guarda (opcional, default false para Mostrador). Sin cambio de CSS o kit.

Dependencia pendiente del encargo completo: ranking de más vendidos exige datos nuevos en el contrato HTTP.
No se inventa un ranking a partir del catálogo alfabético ni se consulta la API de counter desde POS.
Se entrega la paridad visual ahora; el ranking se coordina con Claude por el owner al definir su ámbito.

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
sus controles; defaults sin cambios para Mostrador. No se modifica el orden actual sin contrato de ranking.

Se conserva el contrato 0169 de crear/editar; el PUT manda lista completa con lineId. Errores y autorización
siguen siendo los de 0170. POS no llama /api/counter. Pantallas de guardar siguen permitiendo mesa vacía.

## Archivos

Rutas del frontmatter. No disjunta con edición simultánea de sale-forms o del editor POS.

## Definition of Done

- [ ] e2e: categorías horizontales, Buscar/Cancelar, añadir y quitar en tarjeta hasta cero, precio escrito.
- [ ] e2e: guardar conserva lineId y precios guardados; snapshots duplicados/borrados permanecen separados.
- [ ] Los siete e2e POS y pruebas de Mostrador afectados pasan.
- [ ] Typecheck, lint, formato, ui-guard y números pasan con Node 24.
- [ ] Capturas móvil/escritorio vistas; sin desbordamiento de página.

## Mutaciones

0 nuevas (L2, ADR 0129). Regresión de snapshots cubierta por la prueba de escritura de 0170.

## Declarado AFUERA

Ranking comercial: falta dato del contrato HTTP. QA del owner con catálogo real y PASS independiente.
No se ejecuta build sobre el dev local activo para evitar repetir el incidente de caché de la 0170.

## Handoff

Estado y evidencia en docs/estado/gpt.md; commits locales en dev, sin merge ni push.

## Abierto

Ninguna decisión pendiente para la paridad visual. El ranking pertenece a la dependencia HTTP declarada.

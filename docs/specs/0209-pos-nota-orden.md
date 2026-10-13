---
spec: 0209
fecha: 2026-10-12
estado: implementada
resumen: Nota libre por orden POS mediante modal en los pasos 2 y 3.
disjunta: si
archivos: apps/merchant/src/app/backoffice/pos/**, tests/e2e/pos.spec.ts
---

# 0209 — Nota de la orden POS

## Problema

- `pos-types.ts` no incluye `PosOrder.note`, ya disponible en el contrato 0169.
- `pos-editor.tsx` no permite escribir una nota en los pasos de productos o revisión y su guardado no la envía.
- `pos-console.tsx` no muestra la nota al consultar una orden cerrada.

## Alcance

Entra: UI del POS en dev, nota única multilínea, botón circular con icono junto a Revisar pedido (paso 2) y Guardar pedido (paso 3), y edición de nota de orden abierta junto al cobro. Lectura en órdenes cerradas/anuladas.

No entra: servidor, kit, migraciones, nota por producto, impresión de datos personales, publicación ni merge.

## Diseño

Usar Button, Dialog, TextAreaField y Text existentes. Botón Nota de la orden, icono de documento de iconoir, tamaño y acabado del botón de impresora. El modal tiene Cancelar y Aplicar nota; Aplicar cambia el borrador y Guardar pedido/cambios persiste. Descripción explícita de este comportamiento. Abrir reinicia el texto del modal desde el borrador; cancelar o Escape no modifica la nota. Señalar Nota añadida en el botón cuando existe.

Incluir la nota normalizada en la firma de cambios; protegida por la confirmación de salida/descarte. POST incluye note o null. PUT solo incluye note si cambió respecto al snapshot: omitir conserva, null borra. Cambio de mesa conserva una nota pendiente sin enviarla accidentalmente. Respuestas actualizan el snapshot. Límite de 1000 caracteres tras trim con contador y error accesible; no cortar pegados silenciosamente. Saltos internos se conservan. Conflictos usan la revisión vigente del editor; busy/conflict bloquean edición. 422 invalid_input y 409 version_conflict/pos_order_not_open usan el manejo existente. Permisos y aislamiento permanecen a cargo del contrato actual.

Orden cerrada/anulada: mostrar nota como texto con saltos de línea, sin control editable y fuera del ticket impreso.

## Archivos

| Archivo | Acción |
| --- | --- |
| apps/merchant/src/app/backoffice/pos/pos-types.ts | Campo note obligatorio |
| apps/merchant/src/app/backoffice/pos/pos-editor.tsx | Modal, borrador, payload y guardado |
| apps/merchant/src/app/backoffice/pos/pos-console.tsx | Nota en lectura |
| apps/merchant/src/app/backoffice/pos/pos-payment-preview.test.ts | Fixture del DTO |
| tests/e2e/pos.spec.ts | Oráculos de nota y fixture |

Disjunta: sí, UI; servidor 0169 y kit intactos.

## Definition of Done

- [x] E2E: paso 2 → modal → paso 3 conserva texto; cancelar no cambia; crear manda texto con saltos; editar/borrar manda version y note; productos solos omiten note.
- [x] E2E: máximo 1000, whitespace borra, nota cerrada visible y sin edición; cambios de mesa conservan borrador y conflicto no lo sobrescribe.
- [x] Vista mobile y desktop del modal con controles accesibles, sin overflow.
- [x] pnpm verify ejecutado una vez con Node24; gates verdes salvo expectativa antigua del POST, corregida. Gate e2e repetido: 327 passed/62 skipped, salida0. Tabla original y cierre real en docs/qa/0209/README.md.
- [x] rg -n MUTATION apps tools vacío.

## Mutaciones — presupuesto: 0

No se muta: flujo UI reversible; oráculos de payload y estado en navegador.

## Declarado AFUERA

- Prueba con datos personales reales, base productiva y publicación.

## Handoff

Un implementador y revisión independiente al final conforme al skill Impeccable; registrar evidencia antes de marcar implementada.

## Abierto

Nada.

## Cierre ejecutado

UI `dbeb469`, ajuste de expectativa `ae9a5d1`. Revisor independiente: ship para esta extensión; documenter confirma kit conservado. Cinco pruebas nuevas verdes, capturas390/1280 vistas, gates cerrados con corrección del e2e anterior. Trabajo exclusivamente dev, sin merge/push.

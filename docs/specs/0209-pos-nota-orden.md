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

## Ajuste L0 del owner — padding inferior (cerrado, 2026-10-12)

Solicitud exacta: footer `counter-detailed-footer` con padding inferior18px, antes10px. Cambiar la declaración existente en `apps/merchant/src/app/globals.css` a `calc(18px + env(safe-area-inset-bottom))`; conservar padding superior10px/lateral16px, posición y clases responsive. Es una clase compartida con el mostrador y el cambio aplica a ambos usos. Sin nuevas reglas, tokens o piezas del kit. Validación acotada: formato, guardia y padding computado en navegador390/1280; sin nuevos tests para este cambio reversible de espaciado.

## Ajuste L0 del owner — nota junto a tabs (cerrado, 2026-10-12)

En orden ya creada, mover el único botón de nota del footer a la derecha de Editar/Pedido en la misma fila. Disponible en ambas pestañas incluso sin cambios pendientes; conservar modal, estados y bloqueo busy/conflict. El wizard mantiene el botón junto a sus CTAs. Solo pos-editor.tsx, sin kit/CSS/servidor. Owner solicita explícitamente no ejecutar tests por ser L0; verificar únicamente formato/diff.

## Ajuste L0 del owner — menú circular inferior (cerrado, 2026-10-12)

Concentrar Nota, Escanear QR, Imprimir pedido y Anular en el diálogo de acciones existente, accesible por botón circular48px MoreVert junto al CTA inferior. Quitar menú superior y nota junto a tabs. Nota presente: borde primary y distintivo pequeño de documento, sin mostrar texto de nota en pedido. Preservar todos los bloqueos busy/dirty/conflict/printing y modal de nota. Anular separado visualmente. Menú disponible en ambas pestañas de orden creada; Guardar cambios deshabilitado en Editar limpio. Wizard pasos2/3: mismo disparador junto al CTA, solo Nota disponible hasta crear la orden. X de volver al listado se conserva; se elimina el menú superior, no la navegación. Sin kit/CSS/servidor. Owner confirma L0 sin tests; formato/diff y revisión de código únicamente.

## Ajuste L0 del owner — nota directa durante creación (cerrado, 2026-10-12)

Wizard pasos2/3: restaurar botón circular Notes directo al modal de nota, junto a Revisar/Guardar pedido. Órdenes ya creadas conservan menú inferior MoreVert con todas sus acciones. Reutilizar estado/estilo del disparador, aria y distintivo según contexto. Solo pos-editor.tsx; sin tests por owner. Formato/diff únicamente.

## Ajuste L0 del owner — quitar distintivo superpuesto (cerrado, 2026-10-12)

Retirar únicamente el icono Notes superpuesto del botón circular MoreVert de orden creada. Conservar borde según nota, aria, menú y nota directa del wizard. Sin tests por owner; formato/diff únicamente.

## Ajuste L0 del owner — orden del menú (cerrado, 2026-10-12)

Ordenar acciones: Nota (Añadir/Editar), Escanear QR, Imprimir pedido y Anular. Conservar etiquetas funcionales, bloqueos y separación de Anular. Sin tests; formato/diff.

## Ajuste L0 del owner — toast al guardar nota (cerrado, 2026-10-12)

Tras PUT exitoso de orden abierta cuya nota cambió frente al snapshot, mostrar ConfirmationToast existente con «Nota actualizada» o «Nota eliminada» si quedó sin nota. Cambios sin edición de nota y cambio de mesa mantienen «Pedido actualizado». Aplicar nota al borrador no anuncia persistencia; fallo no muestra éxito. Solo pos-editor.tsx; sin tests por owner. Formato/diff.

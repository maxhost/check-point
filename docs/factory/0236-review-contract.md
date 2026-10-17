# 0236 — Simplificar revisión de Gastos

El owner autorizó «aplicamos los cambios que propones y reviso», después de conversar por qué el modal repite textos, exige fechas escritas y expone categoría/concepto/nombre/local. Ajuste de presentación sobre SPEC0236/ADR0151, sin modificar HTTP, esquema ni eventos. Fuente de trabajo dev8f3b38f9; dos implementadores y QA independiente, sin subdelegación. Sin DB, push ni PROD. Coordinador conserva docs/estado/refs e integración; no INDEX/TASKS/estadoClaude.

## Resultado acordado

- Una sola introducción al revisar; sin repetir «Revisa los pagos», explicaciones de lote o del check. Fijo/variable visible y corregible, con label breve.
- Calendario accesible de fecha sin hora, mismo kit React Aria/Tailwind/tokens; día YYYY-MM-DD sin conversión UTC y meses pasados permitidos. La entrada escrita sigue disponible.
- Campo principal «Qué pagaste» muestra el nombre del concepto. IA sigue proponiéndolo; si se cambia el nombre de un concepto reconocido se desasocia solo ese pago, sin renombrar el concepto global. «Cambiar concepto» despliega categoría y selector existente/nuevo; si falta categoría, esa corrección se muestra directamente. No perder reconocimiento/ID estable, ni fusionar por categoría.
- Detalle del pago opcional para el dueño, tras «Añadir detalle»/«Editar detalle». Se conserva la descripción propuesta o histórica; si queda vacía, la confirmación usa el nombre del concepto para cumplir name obligatorio del HTTP. No se elimina ningún dato ni campo de eventos.
- Local heredado del paso1, mostrado con «Cambiar local»; selector solo para corregir o resolver selección pendiente. Null se representa únicamente por elección explícita business; nunca convertir pendiente en null. Cada línea conserva excepciones locales del borrador.
- UI compartida de alta/edición coherente, sin cambiar autor, moneda/unidad/zona histórica, revisiones ni idempotencia. Fotos RAM y reanálisis se conservan. Fuente reconocida queda como detalle secundario, no texto permanente por pago.

## Asignaciones exclusivas

A `gastos-review-calendar`: asignación explícita de kit limitada a `apps/merchant/src/ui/date-time-field.tsx`, `date-field.tsx`, `index.ts` y documentación de entrega `docs/factory/0236-review-calendar.md`. Añadir DateField day-only reutilizando el DateTimeField/calendario actual; conservar compatibilidad del DateTimeField actual. No CSS/tokens/guardias ni dependencias. Export `DateField` con label/value/onChange/min/description/errorMessage/isDisabled/isRequired/name/className compatibles; value/min YYYY-MM-DD. Prueba focal de seleccionar día y camino datetime existente; puede preparar verificación efímera propia fuera del checkout. No DB.

B `gastos-review-ui`: `apps/merchant/src/modules/expenses/ui/expense-line-fields.tsx`, `expenses-model.ts`, `expenses-input-modal.tsx`; extraer componente bajo `expenses/ui/expense-review-*.tsx` si conviene, paths nominales reservados antes de escribir. Tests `tests/e2e/expenses.spec.ts`, `expenses-input.spec.ts`, `support/expenses-fixture.ts`; handoff `docs/factory/0236-review-ui.md`. No backend ni kit ni registros. Importar DateField de A; no stub de calendario/kit. Mantener confirmación completa y reanálisis/errores sin pérdida. Actualizar selectores de tests por cambio aprobado sin reducir oráculos.

QA `gastos-review-qa`: solo `docs/factory/0236-review-qa.md`; verifica candidato congelado y reutiliza evidencia compatible. Recorrido focal browser sin DB: análisis→revisión compacta→calendario pasado→confirmación HTTP completa, concepto reconocido/corregido, local heredado/global/null, detalle vacío y edición histórica. Verificación visual desktop/mobile en una tanda y una confirmación máxima de correcciones; no pulido adicional. Tipos Merchant/kit, lint/formato/guardia por paths cambiados, casos browser afectados; sin suites completas ni builds globales por ceremonia.

Workers en worktrees seleccionados, dependencias propias, Node24, sin env productivos. Reservas factory concretas antes de despachar. Entregas commits limpios y SHA exacto, QA de entrega/combinación, integración local y cleanup solo tras aceptación/ancestro main y sin procesos.

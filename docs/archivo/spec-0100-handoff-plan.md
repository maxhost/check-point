# Handoff de planificación — Spec 0100

Fecha: 2026-09-26. Estado: borrador listo para aprobación general; sin código.

Owner retomó los tours después de los ajustes 0098. Confirmó que Editar políticas
incluye términos y condiciones y Permitir canjes sin saldo suficiente.

Fuente de retorno: [spec 0100](../specs/0100-tours-de-onboarding-y-ayuda-de-loyalty.md)
y [ADR 0090](../adr/0090-los-tours-de-loyalty-acompanan-el-editor-existente.md).
Plan: cinco explicaciones generales y cuatro ayudas (crear, editar, programar cierre,
políticas). Ayuda junto a la cabecera; onboarding owner persiste sólo completed/skipped;
ayudas/repetición/staff no persisten. Controles normales operan; salir conserva borrador.
Políticas: Términos → regla de canje en Premios → Revisión → Guardar completo.

Se leyeron ProgramView/Editor/Closing, useLoyaltyProgram, pasos de términos/premios,
form-state, onboarding-view y motor/controller existentes. Copy, anchors y señales
nuevas, casos/oráculos y comandos están definidos en la spec. write actual resuelve
sin outcome: observar el resultado validado, no resolución de save como éxito.

Un implementador y un revisor independiente; máximo cuatro mutaciones/dos rondas,
una ronda de gates generales. Nada de backend/schema/datos de ejemplo ni guía extra
para cancelar cierre. Los anchors/señales nuevos aún no existen; no se afirma prueba
ni implementación de tours. Next-env externos de las tres apps se preservan.

Pendiente: aprobación general de esta versión. Después marcar spec cerrada/ADR aceptado
y actualizar este handoff/TASKS; owner hace clear. Retorno: «Implementar spec 0100».
No ejecutar implementación antes de ese retorno.

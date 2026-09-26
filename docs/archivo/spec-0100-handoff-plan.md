# Handoff de planificación — Spec 0100

Fecha: 2026-09-26. Estado: plan aprobado, spec cerrada / ADR aceptado; sin código.

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

Owner aprobó el plan el 2026-09-26 y pidió handoff + clear antes de implementar.
No quedan decisiones pendientes. Retorno: «Implementar spec 0100».

Orden de retorno:

1. Leer TASKS, spec0100 completa, ADR0090 y este handoff.
2. Confirmar árbol/diff: preservar los tres next-env.d.ts externos; no restaurarlos ni
   incluirlos en commits del tour. Última UI 0098: 2e58cf9; docs a5139e7; plan 4b60aef.
3. Encargar un implementador con archivos/contratos/DoD/budget de la spec cerrada.
4. Revisión independiente y mutaciones con bitácora/hash/copia/restauración. Gates una
   vez; no repetir los de 0098 como evidencia de 0100 ni inventar prueba de producción.
5. Actualizar docs tras PASS; commit/push según autorización vigente de la sesión.

El contexto no se ha limpiado desde herramientas: no hay operación disponible para
invocar /clear. El owner debe ejecutarlo o abrir una sesión nueva antes de regresar.
No ejecutar implementación antes de ese retorno.

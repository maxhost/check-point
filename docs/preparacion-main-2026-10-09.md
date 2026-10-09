# Preparación de dev para main — 2026-10-09

Owner autoriza guardar todos los cambios y llevar dev a main; live después.
ADR0128 exige verify verde antes del merge. Commit notas pendientes e1f685a.

Primera verificación: typecheck, lint, guard30archivos, unit2458 y build verdes.
Formato falla en14archivos Claude; autorización para aplicar formato consultada
por restricción explícita del encargo0184 sobre printing/API, pendiente.
E2e270verdes/18fallos:10guías (selector Ayuda ahora ambiguo por navegación) y
8referencias visuales de Dialog (fondo overlay ausente en referencia).

## Ajuste L1 de pruebas antes del merge

Acotar Ayuda a main en tres specs de guías, conservando sus aserciones y sin
cambiar producto. Comparadas capturas actual/expected390 y actual1280: contenido,
acciones y posición intactos; actual añade fondo bg-overlay definido en Dialog.
Actualizar exclusivamente8capturasDialog de Chromium/WebKit para reflejar el
overlay actual. No tocar kit ni bajar tolerancias. Ejecutar guías y kit completos
relacionados; repetir gates fallidos al final. Sin spec nueva para ajusteL1.

Neonfull en progreso sobre baseCI, nunca producción. Log completo:
/private/tmp/checkpass-2026-10-09-pre-main-verify.log. Entorno dev local detenido
temporalmente para gates; restaurar al terminar. Main no movido todavía.

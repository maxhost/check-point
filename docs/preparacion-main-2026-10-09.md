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

## Resultado de la verificación

Primera corrida completa terminada (Node24.20.0):

| Gate | Resultado | Segundos |
|---|---|---|
| typecheck | ok | 0.4 |
| lint | ok | 7.8 |
| ui-guard | ok,30archivos sin aumentos | 1.0 |
| format:check | ROJO,14archivosClaude | 7.9 |
| unit | ok,2458passed/1043skipped | 41.0 |
| build | ok | 26.7 |
| e2e inicial | ROJO,270passed/18failed | 81.4 |
| neonfull | ok,3256passed/282skipped | 420.5 |

Correcciones L1 en500f8fa: tres specs con Ayuda acotada a main y ocho capturas
Dialog. Imágenes light390/1280 y dark390/WebKitlight1280 revisadas; mantiene
contenido/foco/acciones y añade overlay. Sin kit/CSS/API ni tolerancias nuevas.
Regeneración8/8verde5.6s; gate e2e completo repetido SIN update:288passed/21skipped,
1.3m en /private/tmp/checkpass-pre-main-e2e-final.log. Dieciocho fallos resueltos.

Solo queda formato: permiso solicitado por restricción del encargo0184, sin
respuesta todavía. No se ha movido main ni publicado. Entorno dev local se
vuelve a levantar después de los gates. Migraciones0067/0068 de PROD siguen
pendientes de preparación/OK antes de publicar; CI sí tiene0068.

# 0237 — Entrega B HTTP/UI de ciclo de avisos

## Preparación test-only

Task `analytics-lifecycle-ui`, base `65b5152e`; worktree propio
`/private/tmp/checkpass-analytics-perf/analytics-lifecycle-ui`. Coordinador autorizó
preparar fixtures y oráculos antes del checkpoint A1. No incluye implementación de
UI, HTTP, servicios ni migración en esta primera pieza.

- Nuevos oráculos HTTP: autenticación, tenant/actor del guard, estructura/instantes,
  errores de dominio, cierre legacy sin efectos y cron autenticado.
- Fixture y browser lifecycle: categorías/capacidades, navegación sin cierre,
  versión obsoleta, recordatorio en zona del comercio con navegador en otra zona,
  límite de vigencia, refresco por fecha/foco y autoridad del ranking servidor.
- Adaptación aprobada de fixtures y pruebas anteriores: accept/dismiss ya no son
  decisiones de producto; usar Ignorar y enlaces sin POST. La tarjeta 11 está
  parqueada y no se expone; la navegación de campaña conserva cobertura. No se
  quitaron comprobaciones de histórico de AN-1, AN-2 o AN-3, ni se agregaron skips.

Validación de esta pieza: Node 24.20.0, formato focal y `git diff --check` sin errores.
No se ejecutaron suites contra el producto anterior: sus nuevos contratos aún no
existen. **No hay PASS funcional, de tipos, HTTP, browser o DB en esta entrega de
preparación.** Espera integración preservadora A1+B y GO de UI; servicios/rutas
siguen esperando A2. El harness es de componentes con HTTP simulado, no smoke de
una aplicación Next real.

## Pieza UI sobre A1

Base integrada `40f1cb68` (A1 `25b56583` más preparación B `636ddbe2`).
Vista `inbox.tsx` y hook `inbox-state.ts` (extensión autorizada por coordinador):
decisiones declaradas por el servidor, enlaces sin POST, versión e identificador
de operación estable ante retry, conflicto que recarga contexto, selección de
fecha/hora en zona del comercio y límite `expiresAt`. La zona se captura al abrir
el diálogo para no reinterpretar lo elegido si cambia mientras está abierto.

Los timers manejan esperas mayores a 2^31−1 ms reprogramándose sin requests
intermedios. El inbox abierto retira contenido justo después de su caducidad;
mantiene el límite exacto. Recordatorio/foco durante una lectura o mutación
pendiente encolan una sola actualización posterior. No hay polling permanente.
`refreshAfterMs` procede del futuro lector A2 y centraliza la espera de preparación;
la intersección opcional temporal de tipos se retirará al integrar A2.

Evidencia sobre el árbol de esta pieza (Node 24.20.0, lockfile sin cambios):

- Browser focal aislado, config externa
  `/private/tmp/analytics-lifecycle-browser.config.ts`, `webServer:[]`, un worker y
  retries 0: **19/19 PASS, 13,1 s**. Incluye los nueve casos lifecycle y diez casos
  compatibles AN-1/AN-2/AN-3 de inbox e histórico, a 390 y 1280 px. Zona del
  navegador Pacific/Honolulu distinta de America/Guayaquil del comercio.
- Types UI aislados: `pnpm exec tsc --noEmit -p
  /private/tmp/analytics-lifecycle-ui-types.json`, limitado a vista/hook y sus imports.
  No equivale a typecheck Merchant completo: los tests HTTP preparados esperan
  servicios/exportaciones A2 aún ausentes.
- Lint focal, ui-guard de los dos archivos y diff-check. Detector Impeccable: `[]`.
- Capturas inspeccionadas en `test-results/analytics-lifecycle`: inbox móvil y
  recordatorio desktop, sin desbordamiento y conservando componentes/tokens del kit.

Fallos anteriores conservados explícitamente: primer arranque Chromium falló antes
de ejecutar producto (MachPort del sandbox, ocho casos a 0 ms); mismo runner
autorizado fuera del sandbox. Primera corrida real tuvo cuatro fallos de oráculo:
selector «hora» ambiguo, salto de reloj del harness mayor al límite firmado y reloj
que seguía avanzando en el borde exacto. Se corrigieron selectores/clock, sin bajar
las expectativas. Después hubo una espera de lectura asíncrona que exigía
`expect.poll`; se conservó la expectativa de dos requests. Se obtuvo 18/18, luego
se agregó la carrera de lectura pendiente identificada al revisar el hook y se
comprobó 19/19. Ningún skip o retry automático se usó como aprobación.

El harness usa bind efímero 0 por patrón vigente y cierra conexiones/proceso en
afterAll. Esta pieza no arrancó Next, accedió a DB ni certificó HTTP/servicios A2;
su integración espera ese checkpoint y el QA independiente final.

### Corrección de concurrencia tras revisión temprana

Fuente previa de UI `cfe0c788`. Coordinador y QA detectaron que el finally de una
lectura obsoleta podía liberar el indicador de otra lectura nueva. La revisión de
contenido ya impedía aplicar el snapshot viejo, pero el foco podía emitir requests
adicionales. `loading` ahora pertenece al token de su request; solo ese dueño lo
libera. No se cambió política ni semántica de tarjetas.

Prueba focal autorizada (mismo harness/config, retries 0): **4/4 PASS, 2,9 s**:
recordatorio durante lectura pendiente, finally obsoleto con doble foco, retry de
transporte que conserva operationId/cuerpo, y recordatorio durante una mutación.
El resto conserva la evidencia 19/19 de `cfe0c788`, sin declarar que esos casos se
volvieron a ejecutar. Types UI aislados/lint focal/diff-check sin errores. Sin DB,
rutas nuevas ni certificación de servicios A2.

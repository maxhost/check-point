---
name: handoff
description: >
  Cierra la sesion por artefactos: actualiza docs/TASKS.md con el estado real, baja a disco lo
  aprendido (decision → ADR, hallazgo → spec, fila en INDEX), aplica mistake→rule y propone el
  commit. Usar al terminar una sesion, cuando el aviso de contexto pide handoff, o antes de
  cambiar de tarea. La sesion siguiente hereda los archivos, no el chat.
---

# Handoff — cerrar la sesion por artefactos

El objetivo: que una sesion fresca retome EXACTAMENTE donde quedo esta leyendo solo disco.
El punto de retorno es `docs/TASKS.md`, no este chat — el chat se compacta con perdida; el
disco se re-lee entero.

**EL HANDOFF NO LIBERA LA VENTANA DE CONTEXTO — solo baja el estado a disco. Para liberar
la ventana HAY QUE HACER `/clear` (o abrir una sesion nueva) DESPUES.** Handoff sin clear
no tiene sentido: se sigue en la misma conversacion y se colapsa la ventana igual. El orden
es sagrado — handoff PRIMERO (a disco), clear DESPUES; clarear sin handoff pierde lo que
vivia solo en el chat. Por eso, si el usuario pregunta "compact o clear": la respuesta es
**handoff y despues clear** (nunca compact — comprime con perdida). Y al cerrar el handoff
(paso 6), SIEMPRE recordarle explicitamente que ahora corresponde `/clear`.

1. **Gate primero** si hubo cambios de codigo: `npm run typecheck && npm run lint &&
   npm run test`. Reporta evidencia real (N tests, 0 errores), no "parece que anda".
   No se hace handoff de codigo roto sin decirlo explicitamente en TASKS.md
   ("gate rojo por X, retomar ahi").
2. **Actualiza `docs/TASKS.md`**: que quedo hecho (con verificacion real: comando + salida),
   que quedo a medias y EXACTAMENTE donde (archivo/funcion), que sigue, y cualquier gotcha
   descubierto. Los caminos descartados van a la tabla "Descartado" con su porque — sin
   registro se reintentan.
3. **Baja a disco lo aprendido que no este ya ahi**: decision de diseño → ADR en `docs/adr/`
   (frontmatter con `fecha` y `resumen`); que-construir → spec en `docs/specs/`. Todo ADR o
   spec nuevo lleva su fila en `docs/INDEX.md` en el mismo commit.
4. **Mistake→rule**: si en la sesion hubo un error del agente que una regla habria evitado,
   convertilo en fix estructural AHORA — un hook en `.claude/hooks/` si se chequea con un
   comando, una linea en `CLAUDE.md` si es advisory. Nunca la misma correccion dos veces a
   mano.
5. **Propone el commit**: lista los archivos tocados y el mensaje (convencion del repo).
   **No commitees sin confirmacion del usuario.**
6. Cerra con un resumen corto para el usuario: que quedo hecho, que sigue, y con que prompt
   retomar en la sesion nueva.
7. **Deci EXPLICITAMENTE: "ahora hace `/clear`".** El handoff bajo todo a disco; el `/clear`
   es lo que libera la ventana. Sin ese paso el handoff no sirvio de nada — la ventana se
   sigue llenando. Es el paso que hace que todo lo anterior valga.

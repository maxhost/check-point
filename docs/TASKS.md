# TASKS

**Estado actual del proyecto. Este es el punto de retorno.**

Si una sesion se cae, se cierra o se compacta, se vuelve aca — no al chat. Hay un hook `Stop` que
bloquea el fin del turno si se toco codigo y este archivo quedo viejo.

Regla: **marcar `hecho` solo con verificacion real** — tests que pasan, comando corrido, cosa vista
en pantalla. No "deberia andar". El auto-reporte no es evidencia.

**Este archivo contiene SOLO el arco en ejecucion** (regla instaurada por la spec 0066, ya cerrada).
Lo diferido, parado o pospuesto vive en **`docs/PARQUEADO.md`** (el unico lugar donde buscar
pendientes); el relato historico completo esta en **`docs/archivo/`** — `TASKS-historico-2026-09-16.md`
(7.185 lineas: todo lo anterior a la 0066) y `spec-0066-implementacion.md` (los tres pasos, la
bitacora de mutaciones y el PASS del revisor de esa spec).

Ultima actualizacion: 2026-09-16 — **spec 0066 CERRADA e implementada**, y arranca el **arco del
wizard de alta (ADR 0070)**. `main` en `8329342`, **verificado pusheado** (`git rev-parse HEAD` =
`git rev-parse origin/main`).

## ⇥ EN EJECUCION: EL ALTA DEL COMERCIO ES UN WIZARD (ADR 0070)

**Todavia no hay spec — es lo primero que hay que producir.** Regla del repo: ninguna tarea toca
codigo sin su spec cerrada, y esta spec depende de una conversacion de producto pendiente.

**Leer primero:** `docs/adr/0070-el-alta-del-comercio-es-un-wizard-de-tres-pantallas.md` (182
lineas, aceptado por el owner el 2026-09-16). Resumen de una linea en `docs/INDEX.md`, fila 0070.

**Lo que el ADR ya decidio (no repreguntar):** wizard de 3 pantallas (entrar · negocio+local ·
programa) que termina con el QR listo y el programa **ya activo**; sin eleccion de plan (todos
entran `free`); sin contraseña de owner (email + logueado al registrarse, verificacion de email
para el onboarding, link magico despues); staff sin email — `nombre@handle` + PIN de 6 digitos que
el owner genera/regenera; marca sin logo/colores por defecto + "marca avanzada" opcional + un sello
placeholder nuestro; categoria obligatoria como `gcid:` de Google; pais prellenado por
dispositivo/IP pero editable, sumando Mexico; entitlements de plan en una capa unica; la base se
borra entera y se arranca limpia. Google Business es una feature SEPARADA futura que reemplazaria
la pantalla 1 — el diseño de hoy tiene que poder recibir ese paquete sin reescribirse.

**Lo que el ADR deja abierto — son la conversacion pendiente con el owner, en este orden:**
1. Que bloquea la falta de verificacion del email (¿nada? ¿ciertas acciones?).
2. Las reglas del slug/handle del negocio (unicidad, caracteres, que pasa si choca).
3. La defensa del PIN de staff (intentos, bloqueo, quien lo puede ver/regenerar).
4. Que pasa con un pais fuera de la lista prellenada.

**Como arranca la proxima sesion:** leer el ADR completo, traer los 4 puntos al owner **antes** de
escribir una linea de spec, y recien con eso cerrado escribir la spec (proximo numero: **0067**,
salvo que se abra un ADR nuevo antes) con su DoD y plan de pruebas. La UI la trabaja el owner por
fuera (con ChatGPT); esta capa entrega los endpoints.

## ESTADO DEL ARBOL (bloque reescrito ENTERO el 2026-09-16)

- **Rama `main`, arbol limpio, pusheado y verificado** (`git rev-parse HEAD` = `git rev-parse
  origin/main` = `8329342`). `git log --oneline -4`: `8329342` (este handoff), `285be90` (PASS del
  revisor + spec 0066 `implementada`), `e54117f` (spec 0066: poda + agentes + worktrees), `c654f93`
  (ADRs 0069/0070 + spec 0066, sesion anterior).
- **No se toco una sola linea de `apps/` en toda la sesion de la 0066.** Sin mutaciones puestas.
  Sin migraciones pendientes.
- La spec 0065 (campaña de proximidad) sigue **cerrada** — implementada, revisada, corregida,
  pusheada, QA del owner en verde. Su deuda declarada esta en `docs/PARQUEADO.md`.
- La spec 0066 (reparacion del harness) esta **cerrada e implementada, con PASS**. Detalle completo
  en `docs/archivo/spec-0066-implementacion.md`.
- **Verificacion manual del owner, pendiente pero NO bloqueante:** correr `/context` en cualquier
  sesion y confirmar que `CLAUDE.md` pesa menos; algun dia despachar al agente `revisor` un encargo
  SIN presupuesto para ver el default (4 mutaciones, PLAUSIBLE) en accion.

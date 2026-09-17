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

Ultima actualizacion: 2026-09-16 — el owner cerro los 4 puntos abiertos del ADR 0070 (§11-14), dio tres
confirmaciones (§15), subio la restriccion de alcance a decision (§16), eligio **la salida A: la UI vieja
se BORRA** (§17) y **confirmo el corte del arco en 4 specs**. **La spec 0067 esta `cerrada`.**

**→ LO PROXIMO: despachar la spec 0067 a un `implementador`.** No hay nada mas que decidir.

## ⇥ EN EJECUCION: EL ALTA DEL COMERCIO ES UN WIZARD (ADR 0070)

**Leer primero:** `docs/adr/0070-el-alta-del-comercio-es-un-wizard-de-tres-pantallas.md` (321
lineas). Las secciones **11-17 son decisiones del owner del 2026-09-16**. **No repreguntar nada de
ahi.**

> **Las dos reglas que gobiernan TODO este arco:**
>
> **(§16) Se entrega API y endpoints, NO interfaz.** La UI la construye el owner por fuera, con
> ChatGPT. El entregable son **dos** piezas: los endpoints **y el contrato HTTP escrito**. El
> orquestador ya se salteo esto una vez (caso en `docs/LECCIONES.md`; regla en `CLAUDE.md`).
>
> **(§17) La UI vieja de lo que se refactoriza se BORRA** — «no dejar rastros viejos». Y la limpieza
> de enlaces muertos es **parte** del borrado: tres de las referencias que arrastra la 0067 son los
> `redirect` del guard de acceso, que apuntados a una ruta borrada dan **404 en vez de rebote**.
>
> **Costo aceptado por el owner mientras dure el arco: el producto no tiene entrada por navegador,
> asi que NO hay QA de pantalla.** La verificacion es por HTTP, con las respuestas transcriptas.
> Es la excepcion explicita a «gana la pantalla», y se declara en cada spec.

### Los 4 puntos, cerrados

1. **Verificacion de email** — no bloquea el alta; bloquea **todo lo posterior al wizard** y es el
   **primer paso del onboarding**. Motivo del owner, que es de negocio y no de seguridad: «hoy
   Staff es gratis, pero va a pasar a ser parte del plan de pago quizas».
2. **Slug** — no sigue al nombre. Se cambia por **accion explicita** con chequeo de disponibilidad.
3. **PIN** — hasheado; **5 fallos → 15 min, 3 mas → 1 h, el siguiente → 24 h**; el owner lo ve
   **una sola vez** al generarlo y despues **solo puede regenerarlo**.
4. **Pais** — prellenado pero el selector ofrece **siempre la lista completa** (VPN). No hay caso
   de pais no soportado: **por ahora solo LATAM**.

### El arco se corta en CUATRO specs (propuesta del orquestador, NO acordada con el owner)

El ADR 0070 no entra en una spec sola. Orden propuesto, por dependencia:

| Spec | Que | Estado |
|---|---|---|
| **0067** | **Identidad sin contraseña** — owner por email + link magico, staff por `handle@slug` + PIN, gate de email verificado, slug del negocio, borrado del arco de recuperacion y de la UI vieja, wipe de la base | **`cerrada` — lista para implementar** |
| 2ª | **El wizard de 3 pantallas + el QR** — logica de pantallas 2 y 3, categoria `gcid:`, paises + Mexico, sello placeholder, programa activo | no existe |
| 3ª | **Capa de entitlements** — `can()` / `limitOf()`, migrar los 3 call-sites que ya divergieron | no existe |
| 4ª | **Onboarding derivado** — checklist calculado de los hechos de la base, sin columna `onboarding_step` | no existe |

**Corte de 4 specs confirmado por el owner el 2026-09-16.** Se serializan en ese orden: la 2ª consume
`server/slug.ts` y la migracion del `slug` que deja lista la 0067.

**Por que 0067 va primera:** owner y staff comparten **hoy** la misma pantalla de login
(`login-form.tsx:49`) y el staff se crea con `signUpEmail` + contraseña (`staff.ts:119`). La
identidad es una sola rebanada vertical; partirla deja la app en un estado intermedio roto.

### Como se despacha la 0067

Protocolo de `docs/AGENT-WORKFLOW.md`: agente `implementador` primero, `revisor` independiente
despues **en contexto fresco y nunca en el mismo turno**. Solo un `PASS` verificable permite
marcarla `implementada`.

**El encargo tiene que llevar COPIADO el presupuesto de la spec: 6 mutaciones**, clase de error =
los plausibles, y la condicion de corte (si dos vueltas seguidas terminan en «el fix abrio la
siguiente», se corta). El agente `implementador` ya trae adentro el protocolo de mutaciones —
`shasum` antes de mutar, fila de bitacora antes de medir, etiqueta `MUTATION`, revertir con `diff`.

**Antes de despachar, re-medir el doc que se le pasa como insumo:** lo que se le da a un subagente
es una afirmacion propia.

**Ya confirmado por el owner, no repreguntar** (ADR §15-17): el escalado del PIN; que un email
existente no abre sesion y manda link magico; que el slug no se escribe en el alta y el staff se
crea escribiendo **solo el nombre**; y que **se ejecuta la salida A** — `/login`, `/onboarding` y
`/forgot-password` se borran enteras, con sus 10 referencias colgantes en 8 archivos.

**Cuando llegue el momento:** el **borrado de la base + la limpieza de Stripe** solo se ejecuta con
autorizacion explicita del owner **en el momento**, y **Stripe va primero** (una suscripcion viva
sigue facturando contra un negocio que ya no existe).

## ESTADO DEL ARBOL (bloque reescrito ENTERO el 2026-09-16, segunda vez en el dia)

- **Rama `main`.** Todo el trabajo de esta sesion —ADR 0070 §11-17, spec 0067, INDEX, LECCIONES,
  CLAUDE.md y este archivo— entra **en el commit que contiene esta linea**. El padre es `de001fd`.
- **NO PUSHEADO.** El owner autorizo el commit, no el push. **No afirmar que esta en `origin/main`
  sin correr `git rev-parse HEAD` y `git rev-parse origin/main` y ver que dan igual** — esta
  cabecera ya mintio dos veces por asumirlo (ver el commit `de001fd`).
- **No se toco una sola linea de `apps/` en esta sesion.** Sin mutaciones puestas. Sin migraciones
  pendientes. Todo lo de esta sesion es documentacion.
- Lo que se midio en el arbol y quedo escrito en el ADR (no hace falta re-medirlo): `email_verified`
  existe y **no se lee en produccion**; **no hay `slug`/`handle`** en el esquema;
  `business_membership` tiene **PK compuesta `(business_id, user_id)`** y **no existe
  `membership_id`**; la lista de paises esta duplicada en **dos** lugares (no tres) y
  `COUNTRY_CURRENCY` ya tiene MX; el rate limit del plugin `username` **no sirve** para el PIN
  (`(IP, path)`, `memory`, apagado en test).
- La spec 0065 (campaña de proximidad) sigue **cerrada** — QA del owner en verde. Deuda declarada
  en `docs/PARQUEADO.md`.
- La spec 0066 (reparacion del harness) sigue **cerrada e implementada, con PASS**. Detalle en
  `docs/archivo/spec-0066-implementacion.md`.
- **Verificacion manual del owner, pendiente pero NO bloqueante:** correr `/context` y confirmar que
  `CLAUDE.md` pesa menos; algun dia despachar al `revisor` un encargo SIN presupuesto para ver el
  default (4 mutaciones, PLAUSIBLE) en accion.

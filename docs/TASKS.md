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

**→ LA SPEC 0067 ESTA `implementada`** (2026-09-17): **cuatro pasos, cuatro `PASS`** de revisor
independiente, cada uno en contexto fresco. **Nada esta commiteado ni pusheado: eso lo autoriza el
owner.**

**COMMITEADA Y PUSHEADA el 2026-09-17** — commit `9086c9a`, autorizado por el owner. **Verificado
con `git rev-parse HEAD` y `git rev-parse origin/main` dando el MISMO sha**, no por asumirlo (esta
cabecera ya mintio dos veces en sesiones anteriores). 91 archivos, +24.149 / -2.747.

**→ LO PROXIMO:** la **2ª spec del arco** (el wizard de 3 pantallas + el QR), que consume
`server/slug.ts` y la migracion que la 0067 dejo lista. **Y antes de empezarla, decidir los puntos
abiertos de abajo** — sobre todo el gate de API y el `GET /api/staff`.

**CI VERDE, VERIFICADO CON EL ENDPOINT CORRECTO (2026-09-17).** `check-runs` del sha `9086c9a`:
`verify: completed -> success`, cero checks que no sean `success`. **Los pasos que importaban, leidos
uno por uno del job**: `lint` OK, `typecheck` OK, **«Migrar la rama Neon de CI» → success** (las tres
migraciones `0032`/`0033`/`0034` aplicadas limpias, incluida la que **dropea** la tabla del arco de
recuperacion), `Unit + integracion Neon` OK, e2e OK, `build` OK, `format:check` OK.

> **OJO, y ya esta corregido en `CLAUDE.md`: `gh api .../commits/<sha>/status` MIENTE en este repo.**
> Devolvio `success` con la CI **todavia corriendo**, porque agrega los *commit statuses* de la API
> vieja —donde el unico que publica es **Vercel**— y **Actions reporta como *check runs***, que es
> otro endpoint. El verde de CI se lee de `/check-runs`, nunca de `/status`. Caso completo en
> `LECCIONES.md`.

## ⇥ HANDOFF 2026-09-17 — LO QUE HACE LA SESION QUE VIENE, EN ORDEN

**La 0067 esta CERRADA del todo**: `implementada`, commit `9086c9a` pusheado, **CI verde verificado
con `/check-runs`** (el paso «Migrar la rama Neon de CI» incluido: las tres migraciones aplicaron
limpias). No hay nada a medias de ese arco.

**El owner dio estas tres instrucciones el 2026-09-17. Estan en orden y no hay que repreguntarlas:**

### 1. Armar una SPEC DE CIERRE chica — tres puntos, un solo dominio (la API de identidad)

No es el wizard todavia. Es cerrar la deuda que dejo la 0067, y el owner la aprobo agrupada asi:

- **(a) `GET /api/staff`** reusando `listStaff` (`server/staff.ts:100`, hoy **sin ningun consumidor de
  produccion**), **mas su fila en `docs/specs/0067-contratos-de-api.md`**, mas la fila que falta de
  `POST /api/staff/[userId]/status`. **Por que primero: sin esto la UI que el owner construye por
  fuera NO puede listar el equipo**, y `regenerate` y `status` son inalcanzables para cualquier
  integrante creado antes de la sesion actual (su `userId` solo sale del 201 del alta).
  **TRAMPA ESCRITA DE ANTEMANO:** `StaffDTO` lleva `email`, que es el sintetico `@staff.invalid`. Un
  `GET` que lo serialice le devuelve al navegador **el mismo contacto falso que motivo borrar la
  consola**. O se omite del DTO, o el contrato lo marca como no-contacto.
- **(b) Unificar el gate de email verificado en un `requireApiOwner`** que usen las **seis**
  superficies de API. Hoy lo tienen dos (`api/staff/*` y el `PATCH` del slug). **Medido:** no existe
  un cuello de botella unico para API — `requireOwner` de `server/auth-guards.ts` es guard de
  **paginas** y contesta con `redirect()`, que sobre un POST es un **307**; por eso `api/billing`,
  `api/locations`, `api/marketing` y `api/catalog` escribieron cada uno el suyo con `ownerContext`.
  **En el mundo del ADR 0070 el guard de paginas ya no es la puerta**, asi que hoy un owner sin
  verificar puede crear sucursales, subir marca, armar campañas y abrir un checkout de Stripe.
  **Falso consuelo a evitar:** `billing-routes-auth.neon` NO cubre esto — su seed pone
  `emailVerified: true`. **Incluir tambien**: mover `requireStaffOwner` ADENTRO del `try` en
  `api/staff/route.ts`, `.../pin/regenerate` y `.../business/slug`, que hoy queda afuera y hace que un
  fallo de base salga como **500 sin `code`** en vez del `503` que el contrato declara.
- **(c) Borrar `emailOTP` de `server/auth.ts`** — el owner pregunto y se le confirmo con medicion:
  **hay una sola instancia de better-auth en el repo** (el consumidor no tiene la suya) y `emailOTP`
  existe **solo** para el reset de contraseña (`sendVerificationOTP` → `passwordResetEmail`), que ya
  no existe. Se va tambien `passwordResetEmail` de `server/email/channel.ts`.
  **OJO:** al sacar el plugin, sus **9** rutas pasan a dar 404 por inexistentes en vez de estar
  bloqueadas por `disabledPaths`, asi que **`merchant-auth-disabled-paths.test.ts` tiene que reflejar
  eso** — ese test hoy pinnea la lista de 9.

**Antes de cerrar esa spec: correr CADA criterio de DoD que sea un comando contra el arbol.** La 0067
se cerro con **cuatro** criterios imposibles de cumplir y el caso ya esta en `LECCIONES.md`.

### 2. EJECUTAR el borrado de la base — el owner autorizo que lo haga el agente, via MCP

**Autorizacion explicita del owner (2026-09-17), con dos recortes que cambian el procedimiento:**

- **SOLO DATOS, NO SCHEMAS.** Truncar filas; **no** tocar tablas, tipos ni columnas.
- **STRIPE FUERA DE ALCANCE: «ya esta resuelto».** El **PASO 0** (exportar ids) y el **PASO 1**
  (checklist de Stripe) de `tools/wipe-database.sql` **NO se ejecutan**. Esto **anula** la regla de
  «Stripe va primero» para esta corrida — y la anula el owner, no el agente.
- Se ejecuta con **MCP de Neon** (`mcp__neon__run_sql`), no con `psql`.

**Lo que SI hay que hacer, y con cuidado:** el script vive en `tools/wipe-database.sql`; su **PASO 2**
arma la lista de tablas de `core.*` + `merchant_auth.*` y hace
`TRUNCATE … RESTART IDENTITY CASCADE` (linea 103), y el **PASO 3** verifica por SQL. **Confirmar
contra que proyecto y que rama se corre ANTES de ejecutar** (el proyecto es `mi-pasaporte`,
`red-violet-38772073`; **la rama de integracion `br-shy-king-axu5s3ze` NO es produccion**), contar
filas antes, ejecutar, y **transcribir los `select count(*)` en cero**. Es destructivo e irreversible:
la regla del harness pide preguntar antes de invocar un tool destructivo aunque haya autorizacion
previa — **confirmar el objetivo con el owner en el momento, no el permiso.**

### 3. Recien despues: la 2ª spec del arco (el wizard de 3 pantallas + el QR)

Consume `server/slug.ts` y la migracion del `slug` que la 0067 dejo lista.

### Sin commitear al cerrar esta sesion (3 archivos, todo documentacion)

`CLAUDE.md` (la correccion de `/status` → `/check-runs`), `docs/LECCIONES.md` (la leccion nueva) y
este `docs/TASKS.md`. **El owner no autorizo ese commit todavia** — se le propuso y quedo pendiente.

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
| **0067** | **Identidad sin contraseña** — owner por email + link magico, staff por `handle@slug` + PIN, gate de email verificado, slug del negocio, borrado del arco de recuperacion y de la UI vieja, wipe de la base | **`implementada` — 4 pasos, 4 `PASS`, commit `9086c9a` pusheado y CI verde (2026-09-17)** |
| 2ª | **El wizard de 3 pantallas + el QR** — logica de pantallas 2 y 3, categoria `gcid:`, paises + Mexico, sello placeholder, programa activo | no existe |
| 3ª | **Capa de entitlements** — `can()` / `limitOf()`, migrar los 3 call-sites que ya divergieron | no existe |
| 4ª | **Onboarding derivado** — checklist calculado de los hechos de la base, sin columna `onboarding_step` | no existe |

**Corte de 4 specs confirmado por el owner el 2026-09-16.** Se serializan en ese orden: la 2ª consume
`server/slug.ts` y la migracion del `slug` que deja lista la 0067.

**Por que 0067 va primera:** owner y staff comparten **hoy** la misma pantalla de login
(`login-form.tsx:49`) y el staff se crea con `signUpEmail` + contraseña (`staff.ts:119`). La
identidad es una sola rebanada vertical; partirla deja la app en un estado intermedio roto.

### HALLAZGO 8 — `start` tiene la MISMA preimagen y NO se toco

`POST /api/merchant/auth/start` con un email conocido `@staff.invalid` cae en la rama del link
magico, **emite token y gasta cupo igual**. El fix es **una linea** con el predicado que ya esta en
el arbol. No se aplico porque cambia una rama del contrato que el revisor ya valido y que es **el
oraculo de la mutacion #4**: es alcance que decide el owner. Se le pregunto al revisor si coincide o
si es el mismo bloqueante en otra puerta — **esa respuesta decide si el paso 3 es `PASS`.**

### DECISIONES DEL OWNER, no del orquestador (ninguna tomada)

1. **EL MAS IMPORTANTE — el gate de email verificado cubre 2 superficies de API de 6.** Medido:
   `rg 'emailVerified|email_not_verified' apps/merchant/src/app/api/` solo aparece en
   `api/staff/_auth.ts:50`. **No lo tienen** `api/billing/_auth.ts`, `api/locations/_auth.ts`,
   `api/marketing/_auth.ts`, `api/catalog/_auth.ts` ni `api/brand`: los cuatro resuelven owner con
   `ownerContext` y nada mas. **En el mundo del ADR 0070 —la UI la construye el owner por fuera y
   consume API— `requireBackofficeSession` deja de ser la puerta**, asi que un owner sin verificar
   puede crear sucursales, subir marca, armar campañas y abrir un checkout de Stripe: literalmente
   «todo lo posterior al wizard» que el ADR §11 manda bloquear. No es bloqueante porque el DoD pide
   «una ruta owner-only» (singular) y eso se cumple. **Ojo con el falso consuelo:**
   `billing-routes-auth.neon` NO falsifica esto — su seed pone `emailVerified: true`, asi que nunca
   ejercita el caso.
2. **El `503 staff_unavailable` no cubre la resolucion de sesion en 3 rutas** (`api/staff/route.ts`,
   `.../pin/regenerate`, `.../business/slug`): `requireStaffOwner` esta **fuera** del `try`.
   **El revisor aplico la CONDICION DE CORTE** —es la segunda vuelta de la misma clase de hallazgo,
   el paso 2 ya cazo lo mismo en las otras dos rutas— y por regla va al owner en vez de abrir otra
   ronda. Arreglo si se toma: mover `requireStaffOwner` adentro del `try` en las tres.
3. **`app/page.tsx` ya no rebota la sesion viva a `/backoffice`** (forzado por el bucle real).
4. **`emailOTP` quedo vivo y sin uso**: su superficie HTTP esta cerrada (los 9 paths en
   `disabledPaths`, medido contra la fuente), pero es configuracion muerta.
5. **Cambiar el slug cambia el identificador de login de todo el staff sin aviso.** El revisor midio
   que **no** hay cascada de bloqueos (el 401 sale antes de `registerPinAttempt`): es problema de
   comunicacion, no de disponibilidad.
6. **`staff-console.tsx`** sigue perdiendo la credencial del integrante en cada alta.
7. Los cupos del rate limit (20/IP/h, 5/email/h, 10/email/dia) **los eligio el implementador**.



Reproducido por el orquestador, no citado del agente: `typecheck` 3/3 **sin cache**, `lint` exit 0,
`format:check` OK, `test` **1013 passed / 343 skipped / 0 failed**, y **`build` 3/3 successful sin
cache** —lo que mas podia romperse al borrar pantallas—. `rg MUTATION` vacio. **Los dos barridos de
la §7-bis dan VACIO.**

**Las cuatro mutaciones (#3, #4, #5, #6) salieron ROJAS por la asercion correcta**, corridas al final
y de a una. **La #6 no quedo verde**, que era el riesgo declarado: el guard **si** tiene oraculo de
destino (`expected '/login' to be '/'`).

**El TERCER barrido mal escrito del DoD, y la spec ya quedo corregida.** Pedia que
`rg 'PASSWORD_RECOVERY_ENABLED|forgot-password|merchant-recovery'` diera cero, y es **imposible**:
devuelve exactamente `server/slug.ts:35` y `server/slug.test.ts:114`, que son la palabra **reservada**
que la §1 de la misma spec manda tener en `RESERVED_SLUGS` con piso aseverado. Quitarla violaria la §1
y liberaria un slug que tiene que seguir reservado. Van **tres** defectos de la misma familia
(§7-bis corrigio los dos primeros): **el patron es escribir un barrido `rg` como DoD sin correrlo
contra el arbol**. Candidato a `LECCIONES.md` cuando cierre el arco.

**Lo que el implementador resolvio y hay que mirar con cuidado** (esta en el encargo del revisor):

- **El gate no podia mandar a `/onboarding?v=1`** como decia la spec §3, porque esa ruta **se borra
  en este mismo paso**. Eligio `/?e=email_not_verified`, por el mismo canal `?e=` que ya usa
  `staff_disabled` y que ya esta en la tabla de codigos de rebote del contrato.
- **Habia un bucle de redireccion REAL y no lo abrio el gate**: `app/page.tsx` rebotaba la sesion
  viva a `/backoffice`, y con los tres `redirect` del guard yendo a `/`, el caso «sesion sin
  membresia» cerraba `/` → `/backoffice` → `/`. Lo resolvio **borrando** ese rebote. **Es un cambio
  de comportamiento que el owner no pidio** y va como hallazgo, no como aceptado.
- **Como sale el owner del rebote**: consumir el link magico **verifica el email** (medido en
  better-auth 1.6.26). **Si eso fuera falso, el producto queda cerrado con llave.** Es lo mas
  importante de la revision del paso 3.
- **`emailAndPassword: false` NO da 404**: better-auth sigue montando `/sign-in/email` y contesta
  **400**. Su primer test asertaba 404, salio rojo, y **corrigio el test contra la medicion, no al
  reves**.

### HALLAZGOS DEL PASO 2 — A DECIDIR POR EL OWNER, no estan tomados

1. **`app/backoffice/staff/staff-console.tsx` quedo obsoleta y el paso 2 NO la toco** (tenia
   prohibido tocar `app/` fuera de `api/`). Sigue pidiendo email + contraseña, el servidor
   los ignora, y **no muestra el PIN**, que se ve una sola vez: usada tal cual, da de alta al
   integrante y pierde su credencial. Es UI vieja de lo que se refactoriza, o sea candidata
   al borrado del ADR 0070 §17 en el paso 3.
2. **El cambio de PIN rechaza `newPin === currentPin` con 400 `pin_unchanged`.** Es lectura
   del «cambio obligatorio», no una regla que el owner haya escrito. Si prefiere permitirlo,
   es una linea.
3. **¿El PIN se evalua tambien cuando hay un bloqueo vivo?** Hoy si: el guard esta adentro
   del `UPDATE` atomico y consultarlo antes seria el read-then-write que la spec prohibe.
   Cuesta un hash por intento bloqueado y regala tiempo de respuesta constante. La spec §4
   escribe «sin evaluar el PIN»; el codigo cumple lo observable, no el orden.
4. **El `DEFAULT` volatil del slug sigue vivo** (hallazgo 1 del paso 1). El paso 2 no toca la
   ruta del alta del negocio, asi que la decision sigue abierta para el paso 3.

## HALLAZGOS DEL PASO 3 — A DECIDIR POR EL OWNER, no estan tomados

1. **El DoD de la spec pide un barrido que es IMPOSIBLE de dejar en cero, y esta vez es la §1 la que
   lo hace imposible.** `rg -n "PASSWORD_RECOVERY_ENABLED|forgot-password|merchant-recovery"
   apps/merchant/src` devuelve **exactamente dos lineas**: `server/slug.ts:35` y
   `server/slug.test.ts:114`, que son la palabra **reservada** `"forgot-password"` que la propia
   spec §1 manda tener en `RESERVED_SLUGS` (y que el test asevera con piso, por PASS del paso 1).
   No se toco: quitarla violaria la §1 y liberaria un slug. Los otros dos barridos —los que la
   §7-bis declara como los que corre el revisor— **dan VACIO**.
2. **`emailOTP` quedo vivo y ya no sirve para nada.** Su unico `type` configurado es
   `forget-password`, sus 9 paths siguen en `disabledPaths` y su unico consumidor server-side
   (`server/recovery/*`) se borro en este paso. Lo mismo `passwordResetEmail` en
   `server/email/channel.ts`. **No se toco porque la spec enumera exactamente que cambia en
   `auth.ts`** («sacar `emailAndPassword`, sumar `magicLink`, ampliar `disabledPaths`») y sacar un
   plugin es superficie de producto. Si el owner lo quiere fuera, son ~25 lineas y el guard de
   `disabledPaths` hay que reescribirlo (sin plugin, esos 9 paths dan 404 igual y el test dejaria
   de discriminar).
3. **Cambiar el slug cambia el identificador de login de TODO el staff** (`handle@slug`). Es
   inherente a que el ADR 0070 §5 los haga el mismo identificador. El `PATCH` no avisa, no pide
   confirmacion y no da periodo de gracia. Esta declarado en el contrato §8.
4. **`POST /api/merchant/auth/start` con el email SINTETICO de un integrante** (`@staff.invalid`)
   entra en la rama del email conocido e intenta mandarle un mail a un dominio que por RFC 2606
   nunca resuelve. No abre sesion (el invariante se sostiene) y el buzon no existe, pero segun el
   proveedor la respuesta puede ser un 503 en vez de un 200 — o sea un canal fino para distinguir
   un `user` de staff de uno de owner. No se filtro a proposito: filtrar seria agregar una regla
   que el owner no pidio.
5. **El `DEFAULT` volatil del `slug` sigue vivo** (hallazgo 1 del paso 1, ahora exigible). Ya hay
   una ruta que escribe el slug, asi que el `DEFAULT` cumplio su funcion; mientras viva, **una ruta
   que se olvide del slug no falla, se lleva un `b-…` de URL publica**. Quitarlo sigue costando los
   15 errores de tipo que midio el orquestador en el paso 1.
6. **Los cupos del rate limit de `start` (20/IP/h, 5/email/h, 10/email/dia) los eligio el
   implementador, no el owner.** La spec solo pide «rate limit por IP». Estan en el contrato §5 y
   pinneados por `auth-start.test.ts`; moverlos es una linea.
7. **`app/backoffice/staff/staff-console.tsx` sigue obsoleta** (hallazgo 1 del paso 2, sin cerrar):
   pide email + contraseña, el servidor los ignora y no muestra el PIN. El paso 3 **no** la borro:
   la spec enumera que pantallas se borran y esa no esta. Es candidata al §17 en la spec del wizard.

### Lo que el paso 3 declara AFUERA (sin oraculo, a proposito)

- **La entregabilidad del mail** del link magico: se verifica que se **encola** por el canal
  (`EMAIL_PROVIDER=console` en los tests), no que llegue a una bandeja. Ya lo declaraba la spec.
- **El QA de pantalla**: no existe, y a partir de este paso **tampoco existe la pantalla**. La
  verificacion por `curl` contra un preview **no se corrio**: exige un deploy y este trabajo no se
  commitea ni se pushea.
- **La carrera de dos `start` simultaneos con el mismo email desconocido**: el codigo la resuelve
  con el unico de `merchant_auth.user` (el perdedor cae en la rama del email conocido) pero
  **racearla de verdad no se hizo** — mismo criterio que la carrera del PIN.
- **El limite heredado de `merchant-session.ts`**: su `serializeCookie` no replica los fallbacks de
  `__Secure-`/`__Host-`. Hoy es inocuo y el paso 3 lo reusa tal cual, sin tocarlo.

## ESTADO DEL ARBOL (reescrito entero el 2026-09-17, al cerrar la 0067)

- **La 0067 esta COMMITEADA Y PUSHEADA**: commit `9086c9a`, 91 archivos, +24.149 / -2.747.
  **Verificado con `git rev-parse HEAD` y `git rev-parse origin/main` dando el mismo sha** — no por
  asumirlo: esta cabecera ya mintio dos veces en sesiones anteriores por dar el push por hecho.
- **CI VERDE, leido del endpoint correcto.** `/check-runs` del sha: `verify: completed -> success`,
  cero checks que no sean `success`. Pasos leidos uno por uno: `lint`, `typecheck`,
  **«Migrar la rama Neon de CI» → success** (las tres migraciones `0032`/`0033`/`0034` aplicadas
  limpias en CI, incluida la que **dropea** `merchant_auth.password_reset_attempt`),
  `Unit + integracion Neon`, e2e, `build`, `format:check`.
  **`/status` NO sirve para esto y ya esta corregido en `CLAUDE.md`**: devolvio `success` con la CI
  todavia corriendo porque ahi solo publica Vercel (caso en `LECCIONES.md`).
- **Sin commitear quedan 3 archivos, todos documentacion**: `CLAUDE.md` (la correccion de
  `/status` → `/check-runs`), `docs/LECCIONES.md` (la leccion nueva) y este `docs/TASKS.md`.
  **El owner no autorizo ese commit todavia.**
- **`rg -n MUTATION apps packages tools`: VACIO.** Las 6 mutaciones del presupuesto mas las 4 extra
  declaradas se corrieron de a una y se revirtieron con `diff` vacio contra copia limpia.
- **Las migraciones NO estan aplicadas en PRODUCCION**, solo en CI y en la rama de integracion
  (`br-shy-king-axu5s3ze`). Produccion se toca con el borrado de datos que el owner autorizo
  (seccion 2 del handoff), y ahi se **confirma el objetivo en el momento** antes de ejecutar.
- Gates de root con Node 24 (v24.20.0) sobre el arbol commiteado: `typecheck` 3/3 sin cache, `lint`
  exit 0, `test` **1017 passed / 344 skipped / 0 failed**, `format:check` OK, `build` 3/3 sin cache.
  Con el env de integracion: **182 archivos / 1349 passed / 0 failed**.
- **`drizzle-kit check` → `Everything's fine`; `generate` → `No schema changes`**: sin drift entre el
  esquema y los snapshots.
- La spec 0065 (campaña de proximidad) sigue **cerrada** — QA del owner en verde. La 0066
  (reparacion del harness), **implementada con PASS**. Deuda declarada en `docs/PARQUEADO.md`.

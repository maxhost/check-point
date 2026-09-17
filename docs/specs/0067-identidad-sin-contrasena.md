---
spec: 0067
fecha: 2026-09-16
estado: implementada
resumen: Primera tajada del ADR 0070. La identidad del merchant deja de tener contraseña: el owner entra escribiendo su email (link magico despues), el staff deja de tener email y entra con `nombre@slug` + PIN de 6 digitos hasheado con bloqueo escalado propio, el email verificado pasa a ser el PRIMER paso del onboarding y bloquea todo lo posterior al wizard, y se BORRA entero el arco de recuperacion de contraseña. Incluye el slug del negocio (unico, global, que NO sigue al nombre) y el borrado de la base. Entrega API + el contrato HTTP escrito que consume quien construya la UI por fuera, y **borra la UI de identidad vieja** (`/login`, `/onboarding`, `/forgot-password`) con sus 10 referencias colgantes: el producto queda sin entrada por navegador hasta que aterrice la UI nueva, y eso es costo aceptado por el owner.
disjunta: si
archivos: SOLO servidor y endpoints (la UI la construye el owner por fuera). apps/merchant/src/server/auth.ts · auth-guards.ts · staff.ts · staff-pin.ts (nuevo) · slug.ts (nuevo) · schema/business.ts · app/api/merchant/auth/* (nuevo) · app/api/staff/* · app/api/merchant/recovery/* (borrar) · app/forgot-password/* (borrar) · server/recovery/* (borrar) · middleware.ts · drizzle/ · docs/specs/0067-contratos-de-api.md (nuevo) · BORRA app/login/, app/onboarding/, app/forgot-password/ y limpia enlaces muertos en app/page.tsx, not-found.tsx, sign-out-button.tsx y 5 demo/
---

# 0067 — Identidad sin contraseña: el owner por email, el staff por handle + PIN

> **Nada de codigo empieza sin esta spec en `cerrada`.**

## Problema

Hoy la identidad del merchant es **email + contraseña para todos**, y eso choca de frente con
las decisiones 4 y 11-13 del ADR 0070:

- El alta pide elegir una contraseña de >=8 (`app/onboarding/page.tsx:83`,
  `merchantAuthClient.signUp.email`) — friccion en la pantalla que el ADR quiere sin espera.
- **El staff se crea con `signUpEmail` y una contraseña que elige el owner y le pasa por fuera**
  (`server/staff.ts:119`), o sea que cada integrante necesita un email que muchas veces no tiene.
- Existe todo un arco de recuperacion de contraseña —`/forgot-password`,
  `server/recovery/{internal,merchant-recovery}.ts`, `api/merchant/recovery/{request,reset}`, el
  flag `PASSWORD_RECOVERY_ENABLED` y el 503 del `middleware.ts`— que **sin contraseña no tiene
  nada que recuperar**.
- La columna `email_verified` **existe con default `false`** (`server/schema/auth.ts:10`) y **no se
  lee en una sola linea de produccion**: su unico uso hoy es soporte de tests
  (`counter-integration-support.ts:56,141`). O sea que la verificacion no bloquea nada.
- **No existe ninguna columna `slug` ni `handle`** de negocio en el esquema, y el login del staff
  (`nombre@lafarmacia`) y la URL publica futura (`checkpass.club/es/lafarmacia`) la necesitan.

## Alcance

**Entra:**

- El **slug del negocio**: columna nueva, unico global, generado al crear el negocio, que **no
  sigue al nombre** y se cambia solo por accion explicita con chequeo de disponibilidad (ADR 0070 §12).
- **Owner sin contraseña**: escribe su email en el alta y queda logueado; en los logins siguientes,
  **link magico**.
- **Email verificado como gate**: el wizard se completa sin verificar, pero **todo lo posterior al
  wizard queda bloqueado** hasta verificar, y verificar es el primer paso del onboarding (ADR 0070 §11).
- **Staff por `nombre@slug` + PIN de 6 digitos**, hasheado, con cambio obligatorio en el primer uso,
  regeneracion por el owner, y **bloqueo escalado persistido** (ADR 0070 §13).
- **Borrado** del arco de recuperacion completo.
- **Borrado de la UI de identidad vieja** —`/login`, `/onboarding`, `/forgot-password`— y limpieza
  de **todas** las referencias que quedan colgando (seccion 7).
- **Borrado de la base** y su contraparte de Stripe (ADR 0070 §10).

**No entra** (explicito):

- **La logica de las pantallas 2 y 3 del wizard, la categoria `gcid:`, la lista de paises + Mexico,
  el sello placeholder y la pantalla del QR** → spec siguiente del arco.
- **Construir interfaz.** No se escribe ni se rediseña ninguna pantalla: lo que entrega esta spec
  son los endpoints y su contrato escrito. **Borrar** pantallas y **quitar** enlaces muertos si
  entra —es lo que pidio el owner— pero no se agrega ni un control nuevo.
- **La capa de entitlements** → spec propia.
- **El checklist de onboarding derivado de los hechos de la base** → spec propia. Esta spec entrega
  el gate de verificacion, no el checklist.
- **La pagina publica por comercio** en `/es/<slug>`. Esta spec crea el slug y reserva las palabras;
  no sirve ninguna pagina.
- Migrar datos: no hay datos que migrar, la base se borra.

## Que entrega esta spec — y que NO

**Esta spec entrega API y endpoints. NO entrega interfaz.** Es la restriccion de arquitectura que
el owner puso en el ADR 0070 («la UI la va a trabajar por afuera», con ChatGPT) y por eso el
entregable tiene **dos** piezas, no una:

1. **Los endpoints**, con su logica, su autorizacion y sus tests.
2. **`docs/specs/0067-contratos-de-api.md`**: el contrato HTTP completo y normativo de cada uno
   —metodo, ruta, body de entrada, body de salida, **todos** los codigos de error con su `code`
   estable, y que cookie se setea o no—. Sigue la forma del anexo `0055-contratos-del-orquestador.md`,
   que ya es normativo para el implementador y oraculo para el revisor. **Este documento es lo que
   consume quien construya la UI por fuera**, asi que un endpoint sin su fila en el contrato **no
   esta terminado**.

**Y la contraparte, decidida por el owner el 2026-09-16 (salida A):** la UI vieja **se borra**, no se
recablea. Textual: *«quiero que vayas borrando la UI de lo que vamos refactorizando para justamente
no dejar rastros viejos de lo que se que ya no usaremos»*. Apagar `emailAndPassword` rompe
`app/login/login-form.tsx:49` (`signIn.email`) y `app/onboarding/page.tsx:83` (`signUp.email`), y en
vez de sostenerlas con andamiaje **se eliminan enteras**, junto con `/forgot-password`.

**Costo aceptado, escrito para que nadie se sorprenda:** al terminar esta spec el merchant **no
tiene ninguna forma de entrar al producto por navegador** hasta que aterrice la UI de afuera. El
backoffice sigue existiendo pero es inalcanzable, y **el QA de pantalla de esta spec no se puede
hacer**: la verificacion manual es por HTTP (ver «Plan de pruebas»). Es coherente con la regla del
repo «nada de andamiaje sin su tarea».

## Diseño

### Arquitectura de referencia

- **ADR 0070** §4 (identidad), §5 (el slug del staff y la URL publica son el mismo), §10 (base desde
  cero), §11 (gate de verificacion), §12 (slug), §13 (defensa del PIN).
- **ADR 0044** — el guard compartido `requireBackofficeSession` es el unico lugar de control de
  acceso de paginas; el gate de verificacion va **ahi adentro**, no repartido por pantalla.
- **ADR 0055** — el staff desactivado ya se revoca en el guard; el PIN no agrega un mecanismo de
  revocacion nuevo, reusa esa forma de `DELETE`.

### Especificación técnica

#### 1. El slug del negocio

Columna `slug` en `core.business`: `text NOT NULL`, **unique global**.

- **Forma:** `^[a-z0-9]([a-z0-9-]{1,28}[a-z0-9])$` — 3 a 30 caracteres, minusculas, digitos y
  guion medio, sin guion al principio ni al final.
- **Generacion:** se deriva del nombre (normalizacion Unicode NFD + descarte de diacriticos, luego
  no-alfanumerico → `-`, colapso de guiones repetidos, recorte a 30). `"La Farmacia"` → `lafarmacia`
  no es derivable con esa regla; la regla produce `la-farmacia`. **Se adopta `la-farmacia`**: el ADR
  escribe `@lafarmacia` como ilustracion, no como algoritmo, y quitar los separadores colapsa
  `el-arbol` y `elarbol` en el mismo handle.
- **Colision:** sufijo numerico incremental (`la-farmacia-2`) **solo como sugerencia**; el usuario
  la puede reemplazar. La unicidad se garantiza con el indice unico, no con el chequeo previo
  (TOCTOU): el `insert` que choca con el unico se traduce a un 409 con la sugerencia siguiente.
- **Reservadas:** lista versionada en el repo, con los segmentos de ruta que ya existen —
  `api`, `backoffice`, `login`, `onboarding`, `forgot-password`, `c`, `enroll`, `recover`,
  `wallet`, `_next`, `es`, `en`— mas `admin`, `app`, `www`, `static`, `public`, `health`.
- **NO se escribe en el alta.** Decision del owner (2026-09-16): *«el slug no puede escribirlo en el
  momento del alta»*. El wizard **no expone ningun campo de slug**: se genera del nombre y se
  devuelve ya resuelto. Es coherente con la friccion cero de la pantalla 2.
- **NO sigue al nombre:** `updateBusiness` con un `name` distinto deja el `slug` intacto. Cambiarlo
  es una ruta aparte y **posterior al alta** (`PATCH` con `{ slug }`) que valida forma, reservadas y
  disponibilidad — es el «cambio explicito» del ADR 0070 §12.
- **Consecuencia de que no sea editable en el alta:** la forma generada es la que el comerciante se
  lleva puesta, y **el guion queda** (`"La Farmacia"` → `la-farmacia`). El ADR escribe `@lafarmacia`
  como ilustracion; quitar separadores colapsa `el-arbol` y `elarbol` en el mismo handle. Se
  **declara** que si el owner prefiere sin guiones, es una linea de `slugify` y afecta solo a
  negocios nuevos.

Modulo nuevo `server/slug.ts` con `slugify(name)`, `isValidSlug(s)`, `RESERVED_SLUGS` y
`nextSuggestion(base, taken)`. Funciones **puras**, sin base: eso es lo que las hace testeables sin
Neon (protocolo §3: si la propiedad es de comportamiento, extraer la decision a una funcion pura).

#### 2. Owner sin contraseña

`emailAndPassword.enabled` pasa a `false` en `server/auth.ts`. Se agrega el plugin `magicLink`
(disponible en better-auth 1.6.26, verificado: `dist/plugins/magic-link/`).

- **`POST /api/merchant/auth/start` (ruta propia)** recibe `{ email }` y decide:
  - **email desconocido** → crea el `user` (sin `account` de password) y **abre sesion en el acto**.
    Es la pantalla 1 del wizard sin espera.
  - **email conocido** → **NO abre sesion**; manda link magico y responde el mismo cuerpo neutro
    que el caso anterior salvo el flag `{ sent: true }`.
- **Confirmado por el owner el 2026-09-16** (nacio como requisito tecnico del orquestador y el owner
  lo adopto): *«email existente: exacto no abre sesion en pantalla 1, manda magic link, sin
  contraseña»*. Sin esto, escribir el email de otro merchant en la pantalla 1 le entrega el negocio,
  porque no hay contraseña que lo impida.
- **Enumeracion:** la respuesta y el tiempo de las dos ramas no deben permitir distinguir si el
  email existe, **salvo por el flag `sent`, que la UI necesita para decir «te mandamos un link»**.
  Se declara: el endpoint **es** un oraculo de existencia de cuenta. Se acepta —el alta necesita
  saber si abrio sesion o no— y se compensa con rate limit por IP sobre `start`.
- **`disabledPaths`** suma **`/sign-in/magic-link`** y **`/magic-link/verify`** — los dos unicos
  endpoints que publica el plugin, medidos en `dist/plugins/magic-link/index.mjs` — por la misma
  razon que ya estan los de `emailOTP` (`auth.ts:65-83`): el catch-all los publicaria salteando
  nuestro gate, nuestro rate limit y nuestra auditoria. El consumo va por ruta propia via
  `auth.api.*`, que `disabledPaths` **no** afecta (`auth.ts:70-72`).

#### 3. El gate de email verificado

Va **dentro de `requireBackofficeSession`** (`server/auth-guards.ts:44`), que es el guard de las 8
paginas del backoffice **y del mostrador**, no repartido por pantalla.

- Se aplica **solo cuando `membership.role === 'owner'`**. El staff no tiene email por diseño: si
  el gate lo alcanzara, el mostrador quedaria inutilizable para siempre.
- Owner con `emailVerified === false` → **`redirect('/?e=email_not_verified')`**.
  **CORREGIDO el 2026-09-16 al implementar el paso 3, y es el CUARTO criterio imposible de esta
  spec** (los otros tres son barridos `rg`, corregidos en §7-bis y en el DoD): esta linea decia
  `/onboarding?v=1`, pero **la §7 de esta misma spec borra `/onboarding`**, asi que cumplirla al pie
  rompia el borrado y su barrido. El destino es `/`, la unica ruta de pantalla que sobrevive, con el
  motivo por el **mismo canal `?e=`** que ya usa `staff_disabled` — una sola allow-list para la UI de
  afuera, ya escrita en la tabla de codigos de rebote del contrato.
- **El bucle de redireccion era real y NO lo abria este gate:** `app/page.tsx` rebotaba la sesion
  viva a `/backoffice`, y con los tres `redirect` del guard yendo a `/`, el caso «sesion viva sin
  membresia» cerraba `/` → `/backoffice` → `/`. Se resolvio **borrando** ese rebote (solo lineas
  `-`). **Consecuencia no pedida por el owner, declarada:** un usuario logueado que pide `/` ve la
  landing en vez de ir al backoffice — irrelevante mientras no haya entrada por navegador, pero es
  un cambio de comportamiento. **Y la trampa para la spec que reponga logica de sesion ahi:** al
  sacar el rebote se fue tambien `force-dynamic` y `/` pasa a prerenderizarse estatica; si vuelve a
  leer `headers()` sin reponerlo, **rompe el build**.
- **Como SALE el owner del rebote** (verificado por el revisor leyendo `email_verified` por SQL, no
  el objeto de sesion): **consumir el link magico verifica el email** — better-auth 1.6.26 hace
  `revokeUnprovenAccountAccess` + `updateUser({emailVerified:true})` antes de crear la sesion. Hay
  **dos** salidas, las dos verdes: `POST /api/merchant/auth/verify-email` con la sesion viva, y
  volver a `POST /api/merchant/auth/start` con el mismo email (que ahora es «conocido»). **El
  producto no queda cerrado con llave.**
- Mismo gate en las rutas de API owner-only (`requireOwner`, `auth-guards.ts:98`), respondiendo
  **403 `email_not_verified`** en vez de redirigir.
- El envio y el consumo del mail de verificacion usan el canal que ya existe
  (`server/email/{channel,provider}.ts`).

#### 4. Staff: handle + PIN

Columnas nuevas en la membresia de staff (`core.business_membership`):

| Campo | Tipo | Nota |
|---|---|---|
| `handle` | `text NOT NULL` | parte local; unico **por negocio**, no global |
| `pin_hash` | `text NOT NULL` | hash, nunca el PIN |
| `pin_must_change` | `boolean NOT NULL default true` | el primer uso obliga a cambiarlo |
| `pin_updated_at` | `timestamptz` | |

Indice unico `(business_id, handle)`. El identificador de login es `handle@slug` y **se resuelve en
dos pasos**: `slug` → negocio, `(negocio, handle)` → membresia.

**El owner escribe SOLO el nombre.** Decision del owner (2026-09-16): *«el merchant crea el usuario,
se le adiciona el @ y el slug»*. O sea que `POST /api/staff` recibe `{ name }` —**nunca un slug ni un
identificador completo**— y el servidor deriva `handle` de ese nombre con el mismo `slugify`, toma el
`slug` del negocio **de la sesion** y devuelve el id armado. Que el slug **no viaje en el body** no es
cosmetico: si viajara, seria un parametro que un owner podria apuntar al negocio de otro. Las columnas van sobre
`business_membership`, que hoy tiene `role`/`status` con sus CHECK (`schema/business.ts:136-152`):
`handle` y `pin_hash` se agregan **nullable** con un CHECK que los exige presentes cuando
`role='staff'` — un owner no tiene handle ni PIN.

**El staff deja de tener fila en `merchant_auth.user` con email.** Su `user` se crea con un email
sintetico no entregable e `emailVerified=false`, o sin email si el esquema lo permite — el
implementador elige **una** de las dos y lo deja escrito; lo que la spec fija es que **ningun mail
sale hacia un staff** y que ese email jamas sirve para entrar.

**Hash del PIN:** se reusa el hasher de better-auth (`ctx.password.hash` / `verify`, defaults en
`context/create-context.mjs:182`), que es el mismo que ya protegia las contraseñas. No se introduce
un algoritmo nuevo.

**Bloqueo escalado (decision del owner, ADR 0070 §13; la lectura de la tabla de abajo la
confirmo el owner explicitamente el 2026-09-16).** Tabla nueva `core.staff_pin_lockout`,
keyeada por `(business_id, user_id)` — **no por IP**. Medido: `core.business_membership` tiene
**PK compuesta `(business_id, user_id)`** (`schema/business.ts:126-152`) y **no existe ninguna
columna `membership_id`**, asi que la FK del lockout es compuesta contra esas dos:

| Campo | Tipo |
|---|---|
| `business_id`, `user_id` | FK compuesta a `business_membership`; PK compuesta |
| `failed_count` | `int NOT NULL default 0` |
| `stage` | `int NOT NULL default 0` — 0, 1, 2, 3 |
| `locked_until` | `timestamptz` nullable |

Maquina de estados, con el umbral dependiente del `stage`:

| `stage` | Fallos que lo disparan | Bloqueo que aplica | `stage` resultante |
|---|---|---|---|
| 0 | 5 | 15 min | 1 |
| 1 | 3 | 1 h | 2 |
| 2 | 1 | 24 h | 3 |
| 3 | 1 | 24 h | 3 |

- Un **login exitoso resetea `failed_count`, `stage` y `locked_until` a cero/null.**
- Con `locked_until > now()` la ruta responde **429** sin evaluar el PIN — no consume intento ni
  filtra si el PIN era correcto.
- El incremento y la decision van en **un solo `UPDATE` atomico** con el guard adentro, patron
  `persistGrant` / `GREATEST(...)` que ya usa el repo, no un read-then-write.

**La verificacion del PIN NO pasa por el plugin `username`.** Medido en better-auth 1.6.26 y
documentado en el ADR 0070 §13: el plugin no trae reglas propias, la regla global de `/sign-in*`
(3 req / 10 s, `dist/api/rate-limiter/index.mjs:370-376`) esta keyeada por **`(IP, path)`**
(linea 287) —todo el staff de un local comparte bucket y un atacante que rota IPs no tiene limite
por cuenta—, el storage por defecto es **`memory`** (linea 174; en lambda se evapora, no hay donde
persistir 15 min/1 h/24 h) y **`enabled` = `isProduction`** (linea 171) la apaga en test. La ruta es
propia: `POST /api/merchant/auth/staff`.

**El PIN se ve una sola vez.** `createStaff` devuelve el PIN en claro **en esa unica respuesta**;
no se guarda en claro, no hay ninguna ruta que lo lea despues. El owner solo puede **regenerar**
(`POST /api/staff/[id]/pin/regenerate`), que rota el hash, pone `pin_must_change=true`, resetea el
lockout y **revoca las sesiones de ese staff** con el mismo `DELETE` de `auth-guards.ts:77`.

**Tamaño:** `server/staff.ts` ya tiene **260 lineas** y el limite del hook es 300. El PIN, el
lockout y la regeneracion van en **`server/staff-pin.ts` nuevo**, no extendiendo `staff.ts`.

#### 5. Borrado del arco de recuperacion

Se borran: `app/forgot-password/`, `app/api/merchant/recovery/{request,reset}/route.ts`,
`server/recovery/{internal,merchant-recovery}.ts`, sus tests
(`merchant-recovery*.test.ts`, `merchant-recovery.neon.integration.test.ts`) y el flag
`PASSWORD_RECOVERY_ENABLED` con su rama de 503 en `middleware.ts` (18 lineas hoy).
`revokeSessionsOnPasswordReset` desaparece junto con `emailAndPassword`.

**No se borran** las rutas de recuperacion del **consumidor** (`server/consumer/recovery/*`,
`(consumer)/recover/`): son otro actor y otro flujo, y no se tocan en esta spec.

#### 6. Borrado de la base

**Accion destructiva, fuera del codigo: no la ejecuta el implementador.** La spec entrega el
script y el checklist; la corrida contra produccion la autoriza el owner explicitamente, en su
momento, y se hace **despues** de que la migracion este lista.

Checklist, en este orden:

1. **Stripe primero**, porque no vive en la base: cancelar las suscripciones vivas y desconectar
   los customers. Una suscripcion viva sigue facturando y disparando webhooks contra un negocio
   que ya no existe (ADR 0070 §10).
2. Truncar `core.*` y `merchant_auth.*`.
3. Verificar por SQL —`select count(*)`— que las tablas quedaron en 0, y transcribir la salida.

#### 7. El borrado de la UI vieja y sus referencias colgantes

Decision del owner (salida A): las pantallas de identidad **se borran enteras**. Se eliminan
`app/login/`, `app/onboarding/` y `app/forgot-password/` con sus tests
(`login-form.test.ts`, `login-form-retry.test.ts`, `login-notice.test.ts`).

**Borrar una pantalla deja enlaces muertos, y un enlace a un 404 es exactamente el «rastro viejo»
que el owner pidio no dejar.** Medido en el arbol el 2026-09-16 — **10 referencias en 8 archivos**:

| Archivo | Referencia | Que se hace |
|---|---|---|
| `app/page.tsx:26` | `<Link href="/login">Acceder</Link>` | quitar el enlace |
| `app/page.tsx:30` | `<Link href="/onboarding">Crea tu negocio</Link>` | quitar el enlace |
| `app/not-found.tsx:6` | `<a href="/onboarding">` | quitar el enlace |
| `app/components/sign-out-button.tsx:11` | `window.location.assign("/login")` | pasa a `/` |
| `app/backoffice/demo/{,brand/,loyalty/,locations/,analytics/}page.tsx` | 5 CTA a `/onboarding` | quitar el enlace en las 5 |
| `server/auth-guards.ts:48` | `redirect("/login")` | ver abajo |
| `server/auth-guards.ts:65` | `redirect("/onboarding")` | ver abajo |
| `server/auth-guards.ts:78` | `redirect("/login?e=…")` | ver abajo |

**Los tres `redirect` del guard son el punto delicado**, porque es control de acceso y no
decoracion: si apuntan a una ruta borrada, un usuario sin sesion recibe un **404 en vez de un
rebote**, y el caso `staff_disabled` del ADR 0055 pierde el canal por el que decia **por que** lo
rechazaban. Los tres pasan a `redirect("/")` —la landing sobrevive— y el motivo viaja igual en el
query (`/?e=staff_disabled`), **conservando la constante `STAFF_DISABLED`** que vive en
`auth-guards.ts:13`.

**`login-notice.ts` se borra tambien, y su contenido no se pierde: se muda al contrato.** Es la
allow-list que traduce el `?e=` a texto (ADR 0055) y su unico consumidor es la pagina de login que
desaparece — dejarlo vivo seria andamiaje sin tarea, que el repo prohibe. Pero la **traduccion**
—que codigos existen y que significa cada uno— es informacion que la UI nueva necesita, asi que pasa
a ser una **tabla del contrato de API**: codigo estable, cuando lo emite el servidor, y el texto
sugerido. La copia la renderiza quien construya la UI; el servidor solo emite el codigo.

**Los docblocks tambien se actualizan, y no es cosmetica.** `auth-guards.ts:36-42` **describe** los
tres destinos («no session → `/login`», «→ `/onboarding`», «→ `/login?e=staff_disabled`») y
`auth-guards.ts:9-12` describe el codigo de rebote nombrando a `app/login/login-notice.ts`, que deja
de existir. El protocolo del repo es explicito: un docblock que afirma un invariante falso **induce a
escribir la sonda contra el lugar equivocado**. Se actualizan los dos, y lo mismo el comentario de
`api/counter/coupon-redeem/route.ts:13`, que documenta el `redirect("/login")` del guard.

**Consecuencia declarada:** `app/page.tsx` queda sin ninguna accion —texto y nada mas— y el
producto no tiene entrada por navegador. Es el costo aceptado de la salida A, no un descuido.

#### 7-bis. El censo re-medido antes de despachar (2026-09-16, orquestador)

La tabla de arriba decia «10 referencias en 8 archivos» y **se quedaba corta**. Re-medido sobre el
arbol con `rg -n '/login|/onboarding|/forgot-password' apps/merchant/src`: **20 archivos no-test**
mas **7 archivos de test**. Lo que la tabla NO listaba y sobrevive al borrado:

| Archivo | Referencia medida | Que se hace |
|---|---|---|
| `server/billing/view.ts:68` | docblock «Patron de `app/login/login-notice.ts` (ADR 0055)» | reapuntar la cita a la tabla de codigos del contrato; el patron sobrevive, el archivo no |
| `server/billing/view.ts:111` | idem | idem |
| `app/backoffice/subscription/page.tsx:233` | idem | idem (es un docblock: **no** agrega controles a la pantalla, sigue siendo un `M` de solo `-`/comentario) |

**Y el chequeo mecanico del DoD, tal como estaba escrito, es IMPOSIBLE de satisfacer.** Hay dos
coincidencias que **tienen que sobrevivir**:

1. `app/api/billing/_auth.ts:37` cita `api/onboarding/business/route.ts:89-99` — y esa ruta esta en
   la tabla de «Archivos» de esta spec como **editar** (es la que persiste el `slug`). El patron
   `/onboarding` la matchea siempre.
2. `server/recovery-routes.test.ts:56` dice `"verify keeps session/onboarding tokens HttpOnly…"` —
   es el arco de recuperacion del **consumidor**, que esta spec declara explicitamente fuera de
   alcance y **no se toca**.

El barrido correcto, que es el que corre el revisor:

```sh
rg -n '/login|/forgot-password' apps/merchant/src            # tiene que dar VACIO
rg -n '/onboarding' apps/merchant/src -g '!src/app/api/onboarding/**' \
  | grep -v 'session/onboarding'                             # tiene que dar VACIO
```

#### 7-ter. Los tests que la spec no nombraba (medidos, con su destino)

Cuatro archivos de test tocan lo que se borra y **ninguno estaba en la tabla de «Archivos»**. El
repo prohibe editar o borrar un test para que el gate pase, asi que cada uno lleva su destino
escrito **antes** de que el implementador lo encuentre:

| Test | Que lo ata | Destino |
|---|---|---|
| `server/auth-guards.test.ts` | importa `../app/login/login-notice` (`:4`) y asevera los tres destinos (`:78`, `:86`, `:95`) | **SE ACTUALIZA, NO SE BORRA.** Es el oraculo de la mutacion #6: los destinos pasan a `/` y `/?e=staff_disabled`. Borrarlo dejaria el guard sin oraculo y la #6 quedaria verde |
| `src/middleware.test.ts` | pinnea el 503 y el matcher `["/forgot-password"]` de la spec 0046 | se borra junto con `middleware.ts` (ver abajo) |
| `server/billing-click-probe.test.ts` | importa `../app/onboarding/page` (`:45`) y lo ejercita en `describe("el click del ALTA del onboarding")` (`:263`) | **se borra SOLO ese `describe` y el import**; los otros dos (`:203`, consola de suscripcion) quedan intactos. El archivo no se borra |
| `server/recovery-routes.test.ts` | es recuperacion del **consumidor** | **NO SE TOCA** |

**Oraculo que se pierde, declarado y no escondido:** el `describe` del alta es la sonda **R19** de la
spec 0063 —«`app/onboarding/page.tsx` mandando `from: "subscription"` quedaba 66/66 VERDE porque el
test transcribia el body a mano»—. Su sujeto es la pantalla que el owner mando borrar, asi que la
cobertura desaparece con ella: no es un test editado para poner verde un gate, es un test cuyo
objeto dejo de existir. **Cuando la UI de afuera reponga el alta, el cableado del `from:` vuelve a
quedar sin sonda** y hay que reponerla en la spec que la construya.

#### 7-quater. `middleware.ts` se BORRA entero, no se edita

La tabla de «Archivos» decia «editar — sacar la rama `PASSWORD_RECOVERY_ENABLED`». Medido: el
archivo **existe unicamente** para ese gate (14 lineas de cuerpo, un solo `if`), su
`config.matcher` es `["/forgot-password"]` y **nada en `src` lo importa**. Sacarle la rama deja un
middleware vacio corriendo sobre una ruta que ya no existe — andamiaje sin tarea, que el repo
prohibe. Se borran `src/middleware.ts` y `src/middleware.test.ts`.

**Lo que NO se borra en esta spec, y por que:** el backoffice, el mostrador y las paginas `demo`
siguen en pie. No son parte del refactor de identidad y sacarlos seria ampliar el alcance por
cuenta propia; se borraran cuando su propia spec del arco los reemplace.

#### 7-quinquies. La consola de staff se BORRA — decision del owner del 2026-09-17 (PASO 4)

**Los pasos 1, 2 y 3 estan implementados y tienen `PASS` de revisor independiente.** Esta seccion es
alcance **agregado despues**, por decision explicita del owner, y por eso la spec vuelve a `cerrada`:
tiene un paso 4 sin implementar.

**Que la motiva.** La §7 decia textual que el backoffice **no** se borra en esta spec. Eso se escribio
antes de saber lo que despues midio un revisor: `app/backoffice/staff/staff-console.tsx` postea
`{name, email, password}` a `/api/staff` —campos que el servidor ya ignora—, **nunca lee el `pin` de
la respuesta** y muestra el email sintetico `@staff.invalid` como si fuera un contacto. Como el PIN se
ve **una sola vez**, cada alta hecha por esa pantalla **tira a la basura la unica credencial del
integrante**, y la unica salida es regenerar.

**La decision del owner (2026-09-17), textual:** *«Si quiero que se vaya ahora, no quiero dejar
archivos sueltos porque luego acabaremos con archivos sin uso o "legacy" que ensucian todo.»*

**Alcance, medido antes de encargarlo — se va la SECCION entera, no solo el componente:**

| Archivo | Que se hace | Por que |
|---|---|---|
| `app/backoffice/staff/staff-console.tsx` | **borrar** | es la pantalla que pierde la credencial |
| `app/backoffice/staff/page.tsx` | **borrar** | **no tiene contenido propio**: son 11 lineas que hacen `requireOwner` + `listStaff` y renderizan la consola. Sin el componente queda un archivo huerfano, que es exactamente lo que el owner no quiere |
| `app/backoffice/page.tsx:41` | quitar la fila `["staff", "/backoffice/staff"]` de `realModules` | un enlace a una ruta borrada es un 404, y la limpieza de referencias es **parte** del borrado (ADR 0070 §17) |
| `server/locations-backoffice-pages.neon.integration.test.ts:122` | actualizar la asercion `href="/backoffice/staff"` | su sujeto deja de existir. **NO es editar un test para que un gate pase**: es un test cuyo objeto se borro, y se declara |

**Lo que NO se toca:** la API de staff (`/api/staff/*`, el PIN, la regeneracion) no se mueve. Esto
borra la **pantalla**, no la capacidad.

> **CORRECCION del orquestador (2026-09-17), medida por el revisor del paso 4 y reproducida:** el
> parrafo de arriba decia *«la API de staff **entera** sigue en pie — es lo que consume la UI
> nueva»*, y **eso es falso como estaba escrito**. Verificado: **no existe ningun `GET` bajo
> `app/api/staff/`**, y el unico llamador de `listStaff` (`server/staff.ts:100`) es su propio test.
> Consecuencia real, que es peor que «una funcion exportada sin usar»: **dos de las cuatro rutas de
> staff quedan inalcanzables para un integrante preexistente** —`POST /api/staff/[userId]/pin/regenerate`
> y `POST /api/staff/[userId]/status` exigen un `userId` que la UI de afuera **solo puede obtener del
> 201 del alta que acaba de hacer en esa misma sesion**—. **No es un defecto del borrado**: el agujero
> existia desde el paso 2 y la pantalla borrada lo tapaba.
>
> **NO se arregla reabriendo esta spec por cuarta vez**: es literalmente «el fix abrio la preimagen
> siguiente», y la condicion de corte manda cortar. Va a la spec siguiente del arco, con su fila en
> `docs/TASKS.md` para que `listStaff` no quede como andamiaje sin dueño. **Y el fix tiene una trampa
> escrita de antemano:** `StaffDTO` lleva `email`, que es el sintetico `@staff.invalid`; un `GET` que
> lo serialice le devuelve al navegador **el mismo contacto falso que motivo borrar la pantalla**. O
> se omite del DTO, o el contrato lo marca como no-contacto.

**Consecuencia declarada:** el modulo «staff» desaparece de la grilla del backoffice. Como el paso 3
ya dejo el producto **sin entrada por navegador**, nadie puede llegar ahi igual; el borrado quita el
archivo, no una funcion viva.

#### 8. El contrato de API es un entregable, no documentacion opcional

`docs/specs/0067-contratos-de-api.md` fija, para **cada** endpoint de esta spec: metodo y ruta,
schema de entrada, schema de salida, la lista completa de errores con su `code` estable y su status,
y si setea cookie de sesion o no. Es lo que consume quien construya la UI por fuera, y es el oraculo
del revisor: **un endpoint sin su fila en el contrato no esta terminado**. Mismo rol normativo que
`0055-contratos-del-orquestador.md`.

Endpoints que entran al contrato: `POST /api/merchant/auth/start`, el consumo del link magico,
`POST /api/merchant/auth/staff`, `POST /api/staff`, `POST /api/staff/[userId]/pin/regenerate`,
`POST /api/staff/[userId]/pin` (cambio obligatorio en el primer uso), `PATCH` del slug del negocio, y
el envio/consumo de la verificacion de email. **Mas una tabla de codigos de rebote** —hoy la
allow-list de `login-notice.ts`, empezando por `staff_disabled`— con su significado y su texto
sugerido, para que la UI nueva no tenga que re-derivarlos.

## Archivos

| Archivo | Accion |
|---|---|
| `apps/merchant/src/server/auth.ts` | editar — sacar `emailAndPassword`, sumar `magicLink`, ampliar `disabledPaths` |
| `apps/merchant/src/server/auth-guards.ts` | editar — gate de `emailVerified` para `role='owner'` |
| `apps/merchant/src/server/slug.ts` | crear — puro: `slugify`, `isValidSlug`, `RESERVED_SLUGS`, `nextSuggestion` |
| `apps/merchant/src/server/staff-pin.ts` | crear — PIN, hash, lockout escalado, regeneracion |
| `apps/merchant/src/server/staff.ts` | editar — `createStaff` sin email/contraseña, con `handle` + PIN |
| `apps/merchant/src/server/schema/business.ts` | editar — `slug` + columnas de staff + `staff_pin_lockout` |
| `apps/merchant/src/app/api/merchant/auth/start/route.ts` | crear |
| `apps/merchant/src/app/api/merchant/auth/staff/route.ts` | crear |
| `apps/merchant/src/app/api/staff/route.ts` | editar — `POST` recibe **solo `{ name }`**, devuelve el PIN una vez |
| `apps/merchant/src/app/api/staff/[userId]/pin/regenerate/route.ts` | crear — **`[userId]`**, no `[id]`: `api/staff/[userId]/status/` ya existe y Next.js no admite dos nombres de parametro en el mismo nivel |
| `apps/merchant/src/app/api/staff/[userId]/pin/route.ts` | crear — cambio obligatorio en el primer uso |
| `apps/merchant/src/app/api/onboarding/business/route.ts` | editar — genera y persiste el `slug` |
| `apps/merchant/src/app/api/merchant/business/slug/route.ts` | crear — `PATCH`, cambio explicito y **posterior** al alta |
| `docs/specs/0067-contratos-de-api.md` | crear — **contrato HTTP normativo; entregable, no anexo** |
| `apps/merchant/src/middleware.ts` | **borrar entero** — existe solo para el gate de `/forgot-password` y nada lo importa (§7-quater) |
| `apps/merchant/src/middleware.test.ts` | **borrar** — muere con el middleware |
| `apps/merchant/src/server/auth-guards.test.ts` | editar — **actualizar** los 3 destinos y sacar el import de `login-notice`; es el oraculo de la mutacion #6, NO se borra |
| `apps/merchant/src/server/billing-click-probe.test.ts` | editar — borrar SOLO el `describe` del alta y su import; los otros dos quedan (§7-ter) |
| `apps/merchant/src/server/billing/view.ts` | editar — reapuntar 2 docblocks que citan `login-notice.ts` |
| `apps/merchant/src/app/backoffice/subscription/page.tsx` | editar — reapuntar 1 docblock que cita `login-notice.ts` |
| `apps/merchant/src/app/forgot-password/` | **borrar** |
| `apps/merchant/src/app/login/` | **borrar entera**, `login-notice.ts` incluido — su allow-list pasa a ser una tabla del contrato |
| `apps/merchant/src/app/onboarding/` | **borrar** |
| `apps/merchant/src/app/login/*.test.ts` | **borrar** los 3 (`login-form`, `login-form-retry`, `login-notice`) |
| `apps/merchant/src/app/page.tsx` | editar — **quitar** los 2 enlaces muertos |
| `apps/merchant/src/app/not-found.tsx` | editar — **quitar** el enlace muerto |
| `apps/merchant/src/app/components/sign-out-button.tsx` | editar — `/login` → `/` |
| `apps/merchant/src/app/backoffice/demo/**/page.tsx` (5) | editar — **quitar** el CTA a `/onboarding` |
| `apps/merchant/src/app/api/merchant/recovery/` | **borrar** |
| `apps/merchant/src/server/recovery/` | **borrar** |
| `apps/merchant/src/server/merchant-recovery*.test.ts` | **borrar** |
| `apps/merchant/drizzle/` | crear — migracion |
| `tools/wipe-database.sql` | crear — no se ejecuta en esta spec |

### Disjunta?

**Si.** La unica spec abierta en el INDEX es la **0060** (`borrador`, portal del consumidor en
vivo), que toca `(consumer)/wallet/*` y `api/public/consumer/*`. **Cero archivos en comun** con
esta lista. Las otras tres specs del arco del wizard **no existen todavia**, asi que no hay
colision. Y al **no tocar ninguna pantalla**, esta spec ya no colisiona con la spec del wizard en
`app/onboarding/page.tsx`: lo unico que comparten es `server/slug.ts`, que esta spec deja listo
antes (ver «Archivos compartidos»).

### Archivos compartidos

| Que | Quien lo deja listo | Cuando |
|---|---|---|
| `server/slug.ts` (lo consume la spec del wizard, para la pantalla 2) | esta spec | antes de abrir la spec del wizard |
| La migracion de `core.business.slug` | esta spec | idem |

## Definition of Done

- [ ] `emailAndPassword` **no** figura en `server/auth.ts` y no queda ninguna llamada a
      `signUp.email` / `signIn.email` / `signUpEmail` en `apps/merchant/src` fuera de tests.
- [ ] **`docs/specs/0067-contratos-de-api.md` existe y cubre los 8 endpoints**, cada uno con
      entrada, salida, **todos** sus errores con `code` estable, y si setea cookie. El revisor
      verifica el contrato **contra el codigo**, no contra si mismo: un `code` que el contrato
      declara y la ruta no emite (o al reves) es un FAIL.
- [ ] **Ningun archivo de pantalla se crea, y ninguno gana controles.** Chequeo mecanico sobre
      `git diff --name-status`: fuera de `app/api/`, **todo lo que toque `app/` tiene que ser `D`
      (borrado) o un `M` cuyo diff sea solo lineas `-` o lineas de COMENTARIO**. La unica `+` de
      pantalla admitida es la del docblock de `subscription/page.tsx:233` que reapunta la cita a
      `login-notice.ts` (§7-bis). Un `A`, o un `M` con lineas `+` de JSX fuera de `api/`, es un
      FAIL: es la firma de haber construido UI.
- [ ] **El barrido de la §7-bis no devuelve NADA** — ni codigo ni comentarios:
      `rg -n '/login|/forgot-password' apps/merchant/src` vacio, y
      `rg -n '/onboarding' apps/merchant/src -g '!src/app/api/onboarding/**' | grep -v 'session/onboarding'`
      vacio. **Ojo: el barrido ingenuo de las tres rutas juntas es imposible de dejar en cero** —
      `api/onboarding/business/route.ts` sobrevive (es la que persiste el `slug`) y
      `recovery-routes.test.ts:56` es del consumidor; estan medidos en la §7-bis. Las referencias a
      limpiar son las de la §7 **mas las tres de la §7-bis**, y los docblocks
      (`auth-guards.ts:9-12` y `:36-42`, `api/counter/coupon-redeem/route.ts:13`,
      `billing/view.ts:68` y `:111`, `subscription/page.tsx:233`) cuentan como referencias: un
      docblock que afirma un destino o un archivo que ya no existe es el caso que el protocolo del
      repo señala como inductor de sondas mal apuntadas.
- [ ] Un usuario **sin sesion** que pide `/backoffice` termina en **`/`, no en un 404**; un staff
      `disabled` termina en **`/?e=staff_disabled`**, con el codigo `STAFF_DISABLED` intacto.
- [ ] `POST /api/merchant/auth/start` con un email **desconocido** devuelve 200 **y una cookie de
      sesion**; con un email **conocido** devuelve 200 **sin cookie de sesion** y con `sent: true`.
- [ ] Un owner con `email_verified = false` que pide `/backoffice` es redirigido a
      **`/?e=email_not_verified`** (NO a `/onboarding`, que esta spec borra — ver §3); con `true`,
      entra. Una ruta owner-only responde **403 `email_not_verified`**.
- [ ] Un **staff** con `email_verified = false` **entra al mostrador** (el gate no lo alcanza).
- [ ] `createStaff` no recibe email ni contraseña, devuelve el PIN en claro **una sola vez**, y
      `select pin_hash from ...` **no** contiene ese PIN.
- [ ] El escalado muerde con los numeros exactos del owner: 5 fallos → bloqueo, y el bloqueo dura
      15 min; tras liberarse, **3** fallos → 1 h; tras liberarse, **1** fallo → 24 h.
- [ ] Un login correcto resetea `failed_count`, `stage` y `locked_until`.
- [ ] Estando bloqueado, **un PIN correcto tambien devuelve 429** (el bloqueo no se salta con el
      PIN bueno).
- [ ] Regenerar el PIN pone `pin_must_change=true`, resetea el lockout y **borra las sesiones de
      ese staff** (verificado por `select count(*) from session where user_id = …` = 0).
- [ ] Renombrar el negocio **no cambia el `slug`** (leido por SQL antes y despues).
- [ ] Un `slug` reservado y uno con forma invalida son rechazados con 4xx; un `slug` duplicado
      devuelve 409 con sugerencia.
- [ ] `rg -n "PASSWORD_RECOVERY_ENABLED|merchant-recovery" apps/merchant/src` no devuelve **nada**,
      y el de `forgot-password` devuelve **exactamente dos lineas y ninguna mas**:
      `server/slug.ts` y `server/slug.test.ts`, que son la palabra **reservada** que la §1 de esta
      misma spec manda tener en `RESERVED_SLUGS` con piso aseverado. **El barrido original pedia
      cero y era imposible de cumplir** — el tercero de la misma familia, despues de los dos que
      corrigio la §7-bis: quitar esa entrada violaria la §1 y liberaria un slug que tiene que seguir
      reservado. Medido el 2026-09-16 al cerrar el paso 3.
- [ ] Gates de root en verde con Node 24: `typecheck`, `lint`, `test`, `format:check`, `build`.

## Plan de pruebas y verificación

### Presupuesto y condicion de corte (ADR 0062) — **parte del encargo**

- **6 mutaciones**, una por invariante nuevo y portante. Eran 5; la sexta se suma **explicitamente**
  porque el alcance crecio con el borrado de la UI (salida A), que mueve control de acceso. Ni una
  mas: si al cerrarlas aparece «una preimagen mas», **se declara, no se persigue**.
- **Clase de error a cazar: los PLAUSIBLES** — que un guard no se ejecute, que el escalado use el
  umbral equivocado, que el PIN quede en claro, que el slug se arrastre con el nombre.
- **Si dos vueltas seguidas terminan en «el fix abrio la siguiente», se corta** y lo que quede va
  al QA del owner.

| # | Mutacion | Invariante que ataca | Tiene que ponerse rojo |
|---|---|---|---|
| 1 | Cambiar el umbral del `stage` 1 de 3 a 5 | el escalado tiene los numeros del owner | el test de escalado, **por la asercion del umbral**, no por setup |
| 2 | Guardar el PIN en claro en vez del hash | el PIN nunca se persiste legible | el test que lee `pin_hash` por SQL |
| 3 | Sacar la condicion `role === 'owner'` del gate de verificacion | el staff no queda afuera del mostrador | el test de staff + mostrador |
| 4 | Hacer que el email conocido abra sesion en `auth/start` | un email ajeno no entrega el negocio | el test de «email conocido → sin cookie» |
| 5 | Hacer que el rename escriba tambien el `slug` | el slug no sigue al nombre | el test de rename |
| 6 | Dejar el `redirect("/login")` del guard apuntando a la ruta borrada | borrar la UI no convierte un rebote en un 404 | el test de «sin sesion → `/`»; si queda verde, el guard no tiene oraculo de destino |

Para cada una: `git status --short` y `shasum` limpio **antes**, fila de bitacora **antes de
medir**, etiqueta `MUTATION` en el codigo, resultado **ejecutado y transcripto**, y revert probado
con `diff` contra la copia limpia.

### Pruebas

- [ ] **Unitarias puras** (`slug.test.ts`, sin base): `slugify` con acentos (`"Café Olé"` →
      `cafe-ole`), con simbolos, con nombre de 1 caracter y de 60; `isValidSlug` rechaza guion
      inicial/final, mayusculas, `_` y longitud 2 y 31; `RESERVED_SLUGS` contiene los 9 segmentos
      de ruta que existen hoy —**con un piso aseverado de la lista**, para que borrar una entrada
      ponga el test rojo—; `nextSuggestion` ante colision.
- [ ] **Unitaria del escalado** (`staff-pin.test.ts`): la maquina de estados como **funcion pura**
      `nextLockout(state, ok, now)` — 4 filas de la tabla, el reset por exito, y que estando
      bloqueado no avance el contador.
- [ ] **Integración Neon** (`staff-pin.neon.integration.test.ts`): 5 fallos reales → 429 y
      `locked_until` a 15 min leido por SQL; **PIN correcto durante el bloqueo → 429**; tras mover
      el reloj, 3 fallos → 1 h; login correcto → contadores en cero.
- [ ] **Integración Neon** (`auth-start.neon.integration.test.ts`): email desconocido → fila `user`
      nueva + `session` nueva; email conocido → **ninguna** `session` nueva (contada por SQL).
- [ ] **Autorizacion/aislamiento**: un owner del negocio A **no** puede regenerar el PIN de un
      staff del negocio B (404, no 403 — no confirmar que existe). Reusa el guard que ya existe en
      `app/api/staff/_auth.ts`.
- [ ] **Regresion**: el staff `status='disabled'` sigue rebotando con `staff_disabled` (ADR 0055).
- [ ] **Barrido estatico** de que el arco de recuperacion no quedo: `rg` con **las dos
      ortografias** (`forgot-password` y `forgotPassword`), con **piso de archivos escaneados**
      aseverado, y verificado que **se pone rojo contra el arbol de hoy**.
- [ ] **Comandos exactos** (Node 24 + scripts de ROOT):
      `export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use` y despues
      `pnpm run typecheck && pnpm run lint && pnpm run test && pnpm run format:check`.
      Un archivo suelto: `pnpm --filter @mi-pasaporte/merchant exec vitest run <path>`.
- [ ] **Verificación manual — con el limite declarado.** La regla del repo dice que entre una
      evidencia mas y una pantalla que el owner pueda probar **gana la pantalla**, pero esta spec
      **no entrega pantalla a proposito**. Asi que la verificacion manual es **por HTTP**: la misma
      secuencia (alta con email nuevo → cookie de sesion; crear staff y ver el PIN una vez; entrar
      con `handle@slug`; equivocarse 5 veces y recibir 429) corrida con `curl` contra un deploy de
      preview, **con las respuestas transcriptas**. El QA de pantalla queda **pendiente hasta que
      aterrice la UI de afuera**, y se declara como tal: es cobertura que esta spec NO cierra.

### Lo que queda declarado AFUERA

- **La carrera real de dos intentos de PIN simultaneos.** El `UPDATE` atomico es el mecanismo;
  racear dos requests de verdad es un volado (ya declarado para el advisory lock de la 0065). Se
  cubre el `UPDATE`, no la carrera.
- **La entregabilidad del mail** de verificacion y del link magico: se verifica que se **encola**
  la llamada al canal, no que llegue a una bandeja.
- **La resistencia del hash del PIN a fuerza bruta offline**: se hereda la del hasher de
  better-auth, no se mide de nuevo.
- **La ejecucion del borrado de la base y de la limpieza de Stripe**: se entrega el script y el
  checklist; ejecutarlo contra produccion es una accion del owner, no de esta spec.

## Handoff requerido

Implementador y revisor segun `docs/AGENT-WORKFLOW.md`. El revisor corre **en contexto fresco y
nunca en el mismo turno** que escribio el codigo, con el presupuesto de arriba **copiado en el
encargo**. Sin `PASS` independiente esta spec no pasa a `implementada`.

## Abierto

- Los 4 puntos que el ADR 0070 dejaba abiertos estan **cerrados** por el owner (ADR §11-14), y las
  tres confirmaciones del 2026-09-16 tambien: el escalado del PIN tal como esta en la tabla de §4,
  que un email existente no abre sesion, y que el slug no se escribe en el alta.

- **CERRADO — la UI vieja se borra (salida A).** Decision del owner del 2026-09-16, contra la
  recomendacion del orquestador (que era recablear minimo, por la regla «gana la pantalla»). Su
  motivo: *«no dejar rastros viejos de lo que se que ya no usaremos»*, y que el contrato de API es
  precisamente lo que le entrega a ChatGPT para construir la UI nueva. **Se ejecuta la A.**

  **Lo que eso cuesta, aceptado y escrito:** al cerrar esta spec el producto **no tiene entrada por
  navegador**, asi que el QA de pantalla del owner **no existe** para esta spec ni para la siguiente
  hasta que aterrice la UI de afuera. La verificacion manual queda reducida a `curl` contra un
  preview, con las respuestas transcriptas. Es la primera spec del repo que se cierra **sin** el
  recurso que el propio repo declara superior a una evidencia mas — por eso se declara aca en vez de
  descubrirse al final.

- **Nada abierto. La spec esta `cerrada`.** El owner confirmo el corte del arco en 4 specs el
  2026-09-16 y con eso cayo el ultimo item. Puede despacharse a implementador segun
  `docs/AGENT-WORKFLOW.md`, con el presupuesto de **6 mutaciones** y su condicion de corte
  **copiados en el encargo** — no dependen de que el orquestador se acuerde.

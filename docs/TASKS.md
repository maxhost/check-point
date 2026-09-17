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

**→ LO PROXIMO, y es del owner:** decidir los puntos abiertos de abajo y autorizar el commit.
Despues, la **2ª spec del arco** (el wizard de 3 pantallas + el QR), que consume `server/slug.ts` y
la migracion que la 0067 dejo lista.

**→ ANTES DE PUSHEAR:** `ci.yml` corre `pnpm db:migrate` en **cada** corrida, asi que el primer push
aplica **tres** migraciones (`0032`, `0033`, `0034`) en la rama de CI, y **la `0033` dropea** la tabla
del arco de recuperacion. Las tres ya estan aplicadas en la rama de integracion y la suite pasa
entera ahi. Que el push sea una decision, no un efecto.

### FILA PENDIENTE PARA LA SPEC SIGUIENTE — no es opcional, `listStaff` queda sin dueño

**`GET /api/staff` no existe, y eso deja DOS de las cuatro rutas de staff inalcanzables.** Medido y
reproducido por el orquestador: no hay ningun `GET` bajo `app/api/staff/`, y el unico llamador de
`listStaff` (`server/staff.ts:100`) es su propio test.
`POST /api/staff/[userId]/pin/regenerate` y `POST /api/staff/[userId]/status` exigen un `userId` que
la UI de afuera **solo puede obtener del 201 del alta que acaba de hacer en esa misma sesion**: para
un integrante creado antes, no hay forma de enumerarlo. **El agujero es del paso 2 y la pantalla
borrada lo tapaba**; el paso 4 lo destapo.

**Cortado por condicion de corte** (seria la cuarta reapertura de la 0067: «el fix abrio la preimagen
siguiente»). Lo que hay que hacer en la spec siguiente: **`GET /api/staff` reusando `listStaff`, mas
su fila en el contrato, mas la fila que falta de `/api/staff/[userId]/status`.** **Trampa escrita de
antemano:** `StaffDTO` lleva `email`, que es el sintetico `@staff.invalid`; un `GET` que lo serialice
le devuelve al navegador **el mismo contacto falso que motivo borrar la pantalla**. O se omite del
DTO, o el contrato lo marca como no-contacto.

### PASO 4 cerrado con `PASS` — y el encargo del ORQUESTADOR estaba mal

El encargo decia «quitar la fila de `realModules`». **Al pie, eso no borraba la pantalla: la
REEMPLAZABA** — la grilla hace `href={realModules.get(slug) ?? '/backoffice/demo/' + slug}` y el mock
de la spec 0015 **tiene** `staff: "Merchant staff"`. Lo cazo el implementador. **Leccion: en una
grilla con fallback, borrar una entrada de UNA estructura no borra la pantalla.**

El revisor midio de mas y valio: sonda propia que renderiza la home real y asevera que el HTML **no
contiene `staff` en ninguna grafia** (8 hrefs, los 8 existentes en el `build`: cero enlaces muertos),
mas **CSS huerfano** —las 13 clases del componente borrado siguen con 2-23 consumidores— y
componentes huerfanos (`ConfirmDialog` 12, `ModuleHeader` 17, `Toast` 15). **Ningun `globals.css`
quedo con reglas muertas.**

### Por que el gate de email cubre 2 superficies de API de 6 — MEDIDO, es la respuesta al owner

**Hay DOS funciones distintas llamadas `requireOwner`, y la spec apunto a la que no era.**
`server/auth-guards.ts:138` es **guard de PAGINAS**: cuando rechaza contesta con `redirect()`. La §3
dijo «mismo gate en las rutas de API owner-only (`requireOwner`)» dando por sentado que era el cuello
de botella de la API. **No lo es: ninguna ruta de API la usa** (medido) — la usan las 12 paginas del
backoffice y nada mas.

El motivo esta escrito en el repo, en `app/api/marketing/_auth.ts:13`: *«NO es `requireOwner`: ese es
un guard de PAGINA y contesta con `redirect()`»*, y **un `redirect` sobre un POST es un 307**, no el
401/403 que una API tiene que devolver. Por eso cada superficie escribio **su propio** resolvedor:

| Superficie | Como resuelve al owner | ¿gate? |
|---|---|---|
| `api/staff/*` | `ownerContext` en su `_auth.ts` | **si** |
| `PATCH business/slug` | reusa el de staff | **si** |
| `api/billing` · `api/locations` · `api/marketing` | `ownerContext` propio en cada `_auth.ts` | no |
| `api/catalog` | **su propio `requireOwner(request)`**, homonimo del guard de paginas | no |

**No es que alguien se olvidara de cinco: nunca hubo un solo lugar donde ponerlo para API.** Mientras
la UI era el backoffice, el guard de paginas alcanzaba; con la UI afuera consumiendo API, ese guard
deja de ser la puerta. **Propuesta del orquestador (NO acordada): cerrarlo con un `requireApiOwner`
unico en la 3ª spec del arco** (entitlements), que ya iba a tocar esos call-sites.

**→ LO PROXIMO, y es del owner, no del orquestador:** decidir los **siete puntos abiertos** de mas
abajo —el primero es el que mas pesa— y autorizar el commit. Despues de eso, la **2ª spec del arco**
(el wizard de 3 pantallas + el QR), que consume `server/slug.ts` y la migracion que la 0067 dejo
lista.

**→ ANTES DE PUSHEAR, una cosa que no es opcional:** `ci.yml` corre `pnpm db:migrate` en **cada**
corrida, asi que el primer push aplica las migraciones `0032`, `0033` y `0034` en la rama de CI. Las
tres ya estan aplicadas en la rama de integracion y la suite pasa entera ahi (**1349 tests con el env
cargado**), pero el push lleva **tres** migraciones juntas y una de ellas **dropea** la tabla del arco
de recuperacion.

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

### Lo que la re-medicion encontro (2026-09-16, antes de despachar)

La regla del repo —«lo que le pasas a un subagente como insumo es una afirmacion tuya: re-medilo
antes de despacharlo»— mordio. Tres hallazgos, ya escritos en la spec como §7-bis, §7-ter y
§7-quater:

1. **El censo de la §7 decia «10 referencias en 8 archivos» y estaba corto.** Medido con `rg` sobre
   el arbol: **20 archivos no-test + 7 de test**. Faltaban tres docblocks que citan
   `app/login/login-notice.ts` como patron y **sobreviven** al borrado (`server/billing/view.ts:68`
   y `:111`, `app/backoffice/subscription/page.tsx:233`).
2. **El chequeo mecanico del DoD era IMPOSIBLE de satisfacer.** Pedia que
   `rg '/login|/onboarding|/forgot-password' apps/merchant/src` diera vacio, pero hay dos
   coincidencias que **tienen que seguir vivas**: `api/billing/_auth.ts:37` cita
   `api/onboarding/business/route.ts` —la ruta que la propia spec manda **editar** para persistir el
   `slug`— y `recovery-routes.test.ts:56` dice «session/onboarding tokens», que es el arco del
   **consumidor**, declarado fuera de alcance. El DoD ahora lleva el barrido correcto escrito.
3. **Cuatro tests que la spec no nombraba.** `auth-guards.test.ts` **se actualiza, no se borra** (es
   el oraculo de la mutacion #6); `middleware.test.ts` muere con `middleware.ts`, que **se borra
   entero** —existe solo para el gate de `/forgot-password` y nada lo importa, sacarle la rama
   dejaria andamiaje—; de `billing-click-probe.test.ts` se borra **solo** el `describe` del alta;
   `recovery-routes.test.ts` **no se toca**.

**→ HALLAZGO A DECIDIR POR EL OWNER (no es decision suya todavia):** borrar `app/onboarding/page.tsx`
se lleva puesta la sonda **R19** de la spec 0063 —la que caza que el alta mande `from:
"subscription"`—. Su sujeto desaparece, asi que no es «editar un test para poner verde un gate»,
pero **es cobertura que se pierde**: cuando la UI de afuera reponga el alta, ese cableado vuelve a
quedar sin oraculo y hay que reponerlo en la spec que la construya. Queda declarado en la spec
§7-ter.

### El corte en tres pasos (propuesta del orquestador, NO acordada con el owner)

La 0067 no entra en un solo encargo. El corte respeta que **los gates de root queden verdes al final
de cada paso**, que es lo que fuerza que el borrado de la UI vaya junto con el apagado de
`emailAndPassword` (hoy `login-form.tsx:49` y `onboarding/page.tsx:83` compilan contra el).

| Paso | Que | Mutaciones del presupuesto | Estado |
|---|---|---|---|
| **1** | Migracion (`slug`, `handle`, `pin_*`, `staff_pin_lockout`) + `server/slug.ts` puro + `nextLockout` puro + tests sin Neon + `tools/wipe-database.sql` (escrito, NO ejecutado) | **#1** (umbral del stage 1) | **HECHO — `PASS` del revisor independiente (2026-09-16)** |
| **2** | Staff por `handle@slug` + PIN: hash, lockout persistido, rutas de staff, `createStaff` sin email ni contraseña + su parte del contrato | **#2** (el PIN en claro) | **implementado, SIN commitear — falta el `revisor` independiente** |
| **3** | Owner sin contraseña (`auth.ts` sin `emailAndPassword`, `magicLink`, `/api/merchant/auth/start`, gate de `emailVerified`, `PATCH` del slug) **+ el borrado entero de la UI vieja y del arco de recuperacion** + el resto del contrato | **#3, #4, #5, #6** — las cuatro corridas, **las cuatro rojas por la asercion correcta**, las cuatro revertidas | **implementado, SIN commitear — falta el `revisor` independiente** |

**Estado del paso 1: implementado, con el `revisor` independiente corriendo.** El implementador se
corto una vez antes del handoff, fue retomado y cerro. **Lo de abajo lo re-midio el orquestador, no
es auto-reporte del agente:**

- Gates de root con Node 24 (v24.20.0), corridos sobre el arbol final: `typecheck` 3/3 **sin cache**
  (`--force`), `lint` exit 0, `test` **1012 passed / 312 skipped / 0 failed**, `format:check` OK.
- `rg MUTATION` sobre `apps`, `packages` y `tools`: **vacio**. No quedo ninguna mutacion puesta.
- `wc -l schema/business.ts` → **299**, contra el limite de 300 del hook `file-size`. Eso es lo que
  justifica `schema/staff-pin.ts` como archivo aparte (estaba fuera de los archivos permitidos del
  encargo: desviacion aceptada, con su medicion).
- La rama Neon de integracion (`br-shy-king-axu5s3ze`, proyecto `red-violet-38772073`) tiene
  **83 negocios, 8 filas `role='staff'`, NINGUNA columna `slug` y NINGUNA tabla
  `staff_pin_lockout`** — o sea que la sonda del implementador hizo `ROLLBACK` de verdad y los
  numeros de su bitacora son reales.
- **Sonda de costo propia del orquestador:** quitar el `.default(SLUG_PLACEHOLDER)` rompe
  **15 errores de tipo en 14 archivos** (`api/onboarding/business/route.ts`,
  `counter-integration-support.ts` y 12 `.neon.integration.test.ts`). Revertida, `diff` vacio,
  `shasum` de vuelta en `11c27a78…`.

### Paso 2 — que quedo hecho (2026-09-16, SIN commitear, SIN revisor todavia)

**El staff entra con `handle@slug` + PIN.** API y endpoints; **cero pantallas** (ADR 0070 §16).

- `server/staff-pin.ts` — sobre la `nextLockout` pura del paso 1: `generatePin` (CSPRNG),
  `hashPin`/`verifyPin` **reusando el hasher de better-auth** (`ctx.password.hash/verify`,
  ningun algoritmo nuevo) y `registerPinAttempt`, que persiste el intento en **UN solo
  `insert … on conflict do update`** con el guard del bloqueo adentro (nunca read-then-write).
  Los umbrales del SQL se **generan** de la misma tabla `ESCALATION` que usa `nextLockout`,
  asi que los numeros del owner siguen en un solo lugar.
- `server/staff-create.ts` (**archivo nuevo, ver «desviaciones»**) — `createStaff` recibe
  **solo `{ name }`**, deriva el handle (`slugify` → `nextSuggestion`, o sea que una
  reservada o un `"000"` no colisionan), toma el `slug` de la SESION y devuelve el PIN en
  claro **una sola vez**. El `user` se inserta directo, **sin fila en `account`** y con un
  email **sintetico `@staff.invalid`** (RFC 2606): se eligio esa salida de las dos que la
  spec ofrecia porque `merchant_auth.user.email` es `NOT NULL` + unico y `schema/auth.ts`
  esta fuera de alcance. Ya no pasa por `signUpEmail`, que el paso 3 va a apagar.
- `server/merchant-session.ts` (**archivo nuevo**) — abre una sesion de better-auth para un
  `user_id` que el servidor ya autentico. El paso 3 lo necesita igual para el link magico.
- 4 rutas: `POST /api/merchant/auth/staff` (login), `POST /api/staff` (alta),
  `POST /api/staff/[userId]/pin` (cambio obligatorio) y `.../pin/regenerate`.
- **`docs/specs/0067-contratos-de-api.md`** con los 4 endpoints: entrada, salida, **todos**
  los `code` estables con su status, y si setean cookie.

**La `0032` quedo APLICADA en la rama de integracion** (`br-shy-king-axu5s3ze`), como
autorizaba el encargo. **Nada contra produccion.**

**Gates de root con Node 24 (v24.20.0):** `typecheck` 3/3, `lint` exit 0, `test`
**1019 passed / 327 skipped / 0 failed**, `format:check` OK. Y **con el env de integracion
cargado, la suite `.neon` entera: 69 archivos / 327 tests, 0 failed** — los tres rojos que
el encargo daba por esperados (`staff.neon`, `billing-routes-auth.neon`,
`counter-redeem-guards.neon`) quedaron verdes.

**Desviaciones de la lista de archivos permitidos, con su medicion:**

1. **`server/staff-create.ts` y `server/merchant-session.ts` son archivos nuevos que el
   encargo no listaba.** Con el alta adentro, `staff.ts` daba **338 lineas** contra el
   limite de 300 del hook `file-size` (medido con el hook, no con `wc`): dividir, no
   extender. `merchant-session.ts` no entraba en `staff-pin.ts` (262 lineas) y es el
   archivo mas delicado del paso —firma la cookie a mano—, asi que tiene oraculo propio: el
   ida y vuelta completo contra Neon (`getSession` tiene que devolver al usuario).
2. **Tests existentes tocados**, todos por el cambio de firma de `createStaff` que la spec
   ordena: `staff.neon`, `billing-routes-auth.neon` (su `signIn` por `signInEmail` ya no es
   posible sin contraseña: ahora usa `openMerchantSession`), `counter-integration-support.ts`
   (el CHECK nuevo exige `handle`/`pin_hash` en toda membresia `role='staff'`, y el seed
   ahora escribe un `slug` propio) y `staff.test.ts` (la parte del alta se mudo a
   `staff-create.test.ts`, **ampliada**; nada se borro para poner verde un gate).

### PASO 3 — `FAIL` del revisor por UN hallazgo; el arreglo esta despachado (2026-09-16)

**El arco NO cierra todavia. La spec 0067 sigue `cerrada`, no `implementada`.** Falta el arreglo de
H1 y que el revisor confirme el cierre, igual que se hizo en el paso 2.

**H1 (BLOQUEANTE) — `verify-email` no distingue una sesion de STAFF. Reproducido por el
orquestador, no citado:**

1. `node -e '/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test("staff-abc123@staff.invalid")'` → **`true`**: el
   email sintetico **pasa** el filtro de forma de `server/auth-start.ts:57`.
2. `docs/specs/0067-contratos-de-api.md:318` declara `400 invalid_email` **exactamente para ese
   caso**.
3. `app/api/merchant/auth/verify-email/route.ts` **no chequea el rol** en ninguna linea.

Efecto real medido por el revisor contra Neon: **200** en vez de 400, **se emite un token de link
magico real**, **se consume cupo** del rate limit —el mismo cupo por IP que comparte con `start`, o
sea que un staff se come el que los owners necesitan desde la misma IP/NAT— y se le pide al
proveedor que entregue a un TLD que **RFC 2606 reserva para no resolver**. Con `EMAIL_PROVIDER=console`
no se nota; con uno real es un **hard bounce**, y la reputacion del remitente es el activo del que
depende un producto cuyo login entero son links magicos.

**Lo que el revisor midio VERDE**, con 4 mutaciones re-medidas por el (las 8 corridas del arco
—implementador + revisor— rojas por la asercion correcta), gates completos incluido `build`, y los
46 tests `.neon` de la 0067 + staff/billing.

**LA PREGUNTA MAS IMPORTANTE DEL ARCO, CERRADA: el owner SI puede salir del rebote.** Medido en la
fuente (`magic-link/index.mjs:169-171`: `revokeUnprovenAccountAccess` + `updateUser({emailVerified:
true})`) y cerrado por un test que lee **la columna `email_verified` por SQL**, no el objeto de
sesion. **Dos** salidas verdes: `verify-email` con la sesion viva, y volver a `start` con el mismo
email. **El producto no queda cerrado con llave.**

### H1 ARREGLADO — esperando la confirmacion del revisor (2026-09-16)

Gates re-corridos **por el orquestador**: `typecheck` 3/3 sin cache, `lint` exit 0, `format:check`
OK, `test` **1017 passed / 344 skipped / 0 failed**, **`build` 3/3 sin cache**, `rg MUTATION` vacio.
Verificado ademas que `verify-email/route.ts:46` **corta** y que `start/route.ts` **no** importa el
predicado (eso ultimo es el hallazgo 8, abajo).

**Corto por DOMINIO y no por `role`, con un motivo que no es el ahorro de una consulta:** un owner
recien creado por `start` **todavia no tiene membresia** —la crea `api/onboarding/business`—, asi que
la regla por rol tendria que ser «no es una membresia de staff» y dejar pasar el caso sin fila. El
dominio no depende de un estado que el wizard todavia no escribio. Y cerro la debilidad de cortar por
string: **`staff-create.ts` importa la constante** en vez de repetir el literal.

**El oraculo necesito TRES mutaciones, no una, y el motivo vale como leccion:** el encargo pedia un
test con 400 + `code` + **cero tokens** + **cero cupo**, y **`expect` corta en la primera asercion que
falla**, asi que la mutacion obvia deja sin ejercitar justo las dos que importan. MX1 (sacar el corte)
salio **roja pero INSUFICIENTE**; MX2 (corte al final: contesta 400 pero ya emitio token) mordio **por
la asercion del TOKEN**; MX3 (corte entre contar el intento y emitir) mordio **por la del CUPO**.
Las tres revertidas con `diff` vacio. **Extra fuera del presupuesto de 6**, mismo criterio que la
extra del paso 2, declaradas.

### HALLAZGO 8 — `start` tiene la MISMA preimagen y NO se toco

`POST /api/merchant/auth/start` con un email conocido `@staff.invalid` cae en la rama del link
magico, **emite token y gasta cupo igual**. El fix es **una linea** con el predicado que ya esta en
el arbol. No se aplico porque cambia una rama del contrato que el revisor ya valido y que es **el
oraculo de la mutacion #4**: es alcance que decide el owner. Se le pregunto al revisor si coincide o
si es el mismo bloqueante en otra puerta — **esa respuesta decide si el paso 3 es `PASS`.**

### El CUARTO criterio imposible de la spec, ya corregido

La §3 y su DoD decian que el owner sin verificar va a **`/onboarding`** — una ruta que **la §7 de la
misma spec manda borrar**. Corregido a `/?e=email_not_verified`. **Van CUATRO de la misma familia**
(tres barridos `rg` + este). **El patron: escribir un criterio de DoD sin correrlo contra el arbol.**
→ va a `LECCIONES.md` al cerrar el arco.

Y una trampa que nadie habia declarado, ahora escrita en la §3: al borrar el rebote de `app/page.tsx`
**se fue tambien `force-dynamic`**, asi que `/` se prerenderiza estatica. La spec que reponga logica
de sesion ahi y lea `headers()` sin reponerlo **rompe el build**.

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

### Paso 2 — vuelta corta despues del FAIL del revisor (2026-09-16)

**→ PASO 2 CERRADO CON `PASS` (2026-09-16).** El revisor confirmo el cierre del FAIL y verifico lo
que mas podia romperse del arreglo: que **ninguna llamada a base quedo fuera del `try`** y que las
dos rutas usan **`return await`** —sin el `await`, el rechazo escapa del `try` y el `catch` seria
decorativo—. Su corrida independiente de la suite completa del merchant con el env de integracion:
**184 archivos / 1336 tests, 0 failed**, contra 183/1334 del arbol previo: el delta es exactamente
el probe nuevo, o sea que **el refactor no movio nada**. Gates re-corridos por el orquestador: `typecheck` 3/3 sin cache, `lint` exit 0,
`format:check` OK, `test` **1021 passed / 0 failed** (eran 1019: +2 del probe nuevo), los dos
`.neon` del PIN **15/15**, `rg MUTATION` vacio.

**El implementador declaro que NO habia medido si su oraculo nuevo muerde. Lo midio el
orquestador** y es **la unica mutacion gastada fuera de las 6 del presupuesto**, declarada en
`docs/archivo/spec-0067-implementacion.md`: sacarle el `try/catch` a
`api/merchant/auth/staff/route.ts` (`shasum 7bdca3d3…`) pone el probe **rojo solo en esa ruta** y
por el motivo correcto (`Error: la base se cayó` escapando del handler). Revert con `diff` vacio.
Criterio: **un oraculo cuya mordida no se probo no es un oraculo**, y el presupuesto de 6 cubre los
invariantes de la spec, no los oraculos que nacen de un FAIL.

**Hallazgo NUEVO del revisor, ruteado al paso 3 por el orquestador:** `staffError`
(`api/staff/_auth.ts:43-54`) traduce **cualquier** `throw` a `503 staff_unavailable` **sin loguear
nada** — verificado en el arbol —, asi que un `TypeError` propio se presenta como «base caida» a la
UI y a los logs. El paso 3 suma el link magico por el mismo camino, asi que entra como una linea de
`console.error`.

**Hallazgos que siguen ABIERTOS y son del owner, no del orquestador:**
`staff-console.tsx` (pierde la credencial del integrante en cada alta; el paso 3 la deja
**inalcanzable** al borrar `/login`, pero el archivo sigue ahi y la spec §7 dice explicitamente que
el backoffice no se borra en esta spec), el `400` sin `code` de `/api/staff/[userId]/status`, el
`pin_unchanged` y el `DEFAULT` volatil del slug.


El revisor independiente devolvio **FAIL por un solo criterio**; los tres arreglos estan
hechos y **no hizo falta re-correr la mutacion #2** (no tocan el hasheo):

1. **BLOQUEANTE, arreglado — el contrato declaraba un `code` que dos rutas no emitian.**
   El login del staff y el cambio de PIN tenian su unico `try` alrededor de
   `request.json()`, asi que un fallo de base escapaba y Next contestaba **500 sin `code`**
   en vez del `503 staff_unavailable` del contrato. Las dos rutas ahora envuelven **todo**
   lo que toca la base (incluida la resolucion de la sesion, que tambien consulta) y
   traducen con `staffError`. **Oraculo nuevo: `server/staff-routes-unavailable.test.ts`**
   (2 tests) hace fallar la base de verdad y asevera `503` + `staff_unavailable`.
2. **Docblock corregido, comportamiento intacto.** La spec §4 dice «429 **sin evaluar el
   PIN**» y las rutas evaluan siempre. Lo observable se cumple (el intento no consume nada
   y el 429 no filtra si el PIN era bueno) y evaluar siempre da tiempo constante. Se
   corrigieron los docblocks de las dos rutas y las dos filas del contrato para que digan
   lo que el codigo hace. **La decision de fondo —pagar el hash siempre vs. cortar antes—
   queda para el owner, no la tomo el implementador.**
3. **El cambio de PIN ya no resuelve la membresia sin acotar.** `limit(1)` sobre
   `(user_id, role='staff')` elegia a dedo el negocio del lockout y del `UPDATE` si un
   usuario llegara a tener dos membresias de staff (la PK es `(business_id, user_id)`).
   Ahora pide dos filas y **exige exactamente una**: la ambiguedad se rechaza con 404.

**Gates tras los arreglos:** `typecheck` 3/3 **sin cache**, `lint` exit 0, `test`
**1021 passed / 327 skipped / 0 failed**, `format:check` OK, `rg MUTATION` vacio. Los dos
`.neon` del PIN con el env de integracion: **15 passed / 0 failed**.

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

### Lo que el paso 2 declara AFUERA (sin oraculo, a proposito)

- **La carrera real de dos intentos de PIN simultaneos**: se cubre el `UPDATE` atomico, no la
  carrera (ya declarado por la spec).
- **La resistencia del hash a fuerza bruta offline**: se hereda del hasher de better-auth.
- **El QA de pantalla**: no existe para este arco (costo aceptado, ADR 0070 §17). La
  verificacion por `curl` contra un preview **no se corrio**: requiere un deploy, y el paso 2
  no se commitea ni se pushea.

### Paso 2 — bitacora de la mutacion #2 (fila abierta ANTES de medir)

| id | archivo | shasum limpio | invariante que ataca | resultado EJECUTADO |
|---|---|---|---|---|
| M2 | `apps/merchant/src/server/staff-create.ts` | `0e7ed478aa7f9d8116d8777270afbf7ac130cce1` | el PIN nunca se persiste legible: `pin_hash` guarda el hash, no el PIN | **ROJO por la asercion correcta** (ver abajo) |

**Mutacion:** `const pinHash = await hashPin(pin)` → `const pinHash = pin`.
**Alcance medido:** los 4 archivos que pueden verla, corridos juntos CON el env de
integracion — `staff-create.test.ts`, `staff-pin.neon`, `staff-pin-change.neon`,
`staff.neon`. Resultado: **8 failed / 26 passed**. El oraculo que la spec pedia:

```
FAIL staff-pin.neon.integration.test.ts > el PIN nunca queda legible: `pin_hash` no lo contiene
  AssertionError: expected '880200' not to contain '880200'
FAIL staff-create.test.ts > persiste el hash del PIN y `pin_must_change`, nunca el PIN
  AssertionError: expected '227084' to be 'hashed:227084'
```

Las **otras 6 son COLATERALES** y estan declaradas como tales: con el PIN guardado en
claro, verificarlo hace que better-auth tire `Invalid password hash`, `verifyPin` devuelve
`false` y **todo login deja de andar** (`expected 401 to be 200`, `expected 429 to be 200`,
`expected 401 to be 403`). No son oraculos del invariante del PIN legible.
**`staff.neon.integration.test.ts` quedo VERDE bajo la mutacion: no mira el PIN.**

**Revertida.** El archivo estaba `??` (untracked), asi que `git checkout` NO lo restauraba:
el punto de retorno fue la copia limpia `/tmp/staff-create.clean.ts`. `diff` contra ella:
vacio; `shasum` de vuelta en `0e7ed478aa7f9d8116d8777270afbf7ac130cce1`; `rg MUTATION` sobre
`apps/*/src`, `packages` y `tools`: vacio; los 4 archivos de vuelta en **34 passed / 0 failed**.

```sh
# restauracion, si hiciera falta
cp /tmp/staff-create.clean.ts apps/merchant/src/server/staff-create.ts
shasum apps/merchant/src/server/staff-create.ts   # 0e7ed478aa7f9d8116d8777270afbf7ac130cce1
```

### Paso 3 — EN CURSO (2026-09-16, sin commitear, SIN revisor todavia)

**El owner deja de tener contraseña y la UI vieja de identidad se BORRA.** API y endpoints; fuera
de `app/api/` el diff es solo `D` (borrados) y `M` con lineas `-` o de comentario.

#### Vuelta corta despues del FAIL del revisor (2026-09-16) — y la mutacion EXTRA que costo

**FAIL por un solo hallazgo, reproducido por el orquestador y despues por mi contra la funcion real
(no contra el regex transcripto):** `normalizeEmail("staff-abc123@staff.invalid")` **devuelve el
email**, no tira — `staff` `.` `invalid` es forma valida. O sea que `verify-email` con una sesion de
INTEGRANTE contestaba **200**, emitia un token de link magico de verdad, **consumia cupo del balde
por IP que comparte con `start`** —el mismo que los owners necesitan para entrar desde esa IP— y le
pedia al proveedor una entrega a un TLD que RFC 2606 reserva para que no resuelva. Con
`EMAIL_PROVIDER=console` no se ve; con un proveedor real es un hard bounce, y la reputacion del
remitente es el activo del que depende un login que **entero** son links magicos.

**Arreglo:** `isUndeliverableEmail` en `server/auth-start.ts`, aplicado en `verify-email` **ANTES**
de `assertStartWithinLimits`/`recordStartAttempt`. Se corta por el DOMINIO y no por el `role` de la
membresia: no agrega consulta y no tiene el caso borde del owner recien creado por `start`, que
**todavia no tiene membresia**. Para que los dos literales no se separen, `staff-create.ts` ahora
**importa** `UNDELIVERABLE_EMAIL_DOMAIN` en vez de repetir la cadena.

#### Bitacora — mutacion EXTRA (fuera de las 6 del presupuesto), fila abierta ANTES de medir

Mismo criterio que la unica extra del paso 2: **el presupuesto de 6 cubre los invariantes de la
spec, no los oraculos que nacen de un FAIL** — y un oraculo cuya mordida no se probo no es un
oraculo.

```sh
cp /tmp/verify-email.clean.ts apps/merchant/src/app/api/merchant/auth/verify-email/route.ts
shasum apps/merchant/src/app/api/merchant/auth/verify-email/route.ts  # 1ea93b7bafc58b37616d93c273a9343f33b1f53e
```

| id | archivo | shasum limpio | invariante que ataca | resultado EJECUTADO |
|---|---|---|---|---|
| MX1 | `apps/merchant/src/app/api/merchant/auth/verify-email/route.ts` (`??` — `git checkout` NO lo restaura) | `1ea93b7bafc58b37616d93c273a9343f33b1f53e` | a un buzon no entregable no se le manda nada: se SACA el corte y la ruta vuelve al comportamiento que el revisor cazo | **ROJA — pero INSUFICIENTE**: muere en `expected 200 to be 400` (linea 244) y deja las dos aserciones de «cero» SIN medir |
| MX2 | idem | `1ea93b7bafc58b37616d93c273a9343f33b1f53e` | …**ni se le gasta cupo**: el corte se MUEVE al final, asi que la ruta sigue contestando 400 `invalid_email` pero ya emitio el token y ya conto el intento. **Existe porque MX1 no alcanza**: muere en la primera asercion (el status) y deja sin medir las dos de «cero», que son las que el encargo pide probar | **ROJA por la asercion del TOKEN**: `expected 1 to be +0` en la **linea 247**, con status y `code` en verde |
| MX3 | idem | `1ea93b7bafc58b37616d93c273a9343f33b1f53e` | **la asercion del CUPO por separado**: el corte se pone entre `recordStartAttempt` y `signInMagicLink`, asi que no se emite token pero el intento YA se conto. **Existe porque MX2 tampoco alcanza**: muere en la asercion del token (linea 247) y deja la del cupo (249) sin medir | **ROJA por la asercion del CUPO**: `expected 1 to be +0` en la **linea 249**, con status, `code` y «cero tokens» en verde |

**Por que hicieron falta TRES y no una.** El encargo pedia un oraculo con cuatro aserciones —400,
`code`, cero tokens, cero cupo— y advertia que **sin las dos ultimas el test no prueba lo que
importa**. Una sola mutacion no puede demostrarlo: `expect` corta en la primera que falla, asi que
MX1 (sacar el corte) mata el test en el status y deja las dos de «cero» sin ejercitar — se veria
identico si esas dos lineas no existieran. MX2 y MX3 existen para **aislar cada una**, poniendo el
corte en un lugar donde todo lo anterior sigue verde. Las tres revertidas con `diff` vacio contra
`/tmp/verify-email.clean.ts` y el `shasum` de vuelta en `1ea93b7b…`.

**Lo que NO se toco, y por que:** `POST /api/merchant/auth/start` tiene la MISMA preimagen (un
email conocido `@staff.invalid` cae en la rama del link magico y gasta cupo igual), y el arreglo es
**una linea** — `if (isUndeliverableEmail(email)) throw …` despues del `normalizeEmail` de esa ruta.
No se aplico porque cambia una rama del contrato que el revisor ya valido y que es el oraculo de la
mutacion #4: **es alcance que decide el owner, no el implementador.** Queda como hallazgo 8, ahora
con el fix escrito y el predicado ya en el arbol.

#### Que quedo hecho

- **`server/auth.ts`**: `emailAndPassword` **fuera** (con el `revokeSessionsOnPasswordReset` que
  colgaba de el), plugin **`magicLink`** adentro (15 min, `disableSignUp: true`, el mail por el
  canal que ya existia) y `disabledPaths` **+2**: `/sign-in/magic-link` y `/magic-link/verify`, los
  dos unicos que publica el plugin (re-medidos en `dist/plugins/magic-link/index.mjs`).
- **4 endpoints nuevos**, todos con su fila en el contrato: `POST /api/merchant/auth/start`,
  `GET /api/merchant/auth/magic-link` (el consumo, por ruta propia),
  `POST /api/merchant/auth/verify-email` y `PATCH /api/merchant/business/slug`.
- **El gate de email verificado** dentro de `requireBackofficeSession`, **solo para
  `role='owner'`**, y su gemelo de API (403 `email_not_verified`) en `app/api/staff/_auth.ts`.
- **`api/onboarding/business/route.ts` genera y persiste el `slug`**, cableado por
  `slugForNewBusiness` (`slugify` → `nextSuggestion` contra tomados + reservadas), que es lo que
  impide que un negocio llamado «Admin» se lleve `/es/admin` y que dos nombres en japones colisionen
  en `000`.
- **El borrado**: `app/login/` entera, `app/onboarding/`, `app/forgot-password/`,
  `api/merchant/recovery/`, `server/recovery/`, sus 3 tests, `src/middleware.ts` +
  `src/middleware.test.ts`, y el flag `PASSWORD_RECOVERY_ENABLED` con el.
- **La limpieza de referencias**: las 10 de §7 + las 3 de §7-bis + los docblocks. Los tres
  `redirect` del guard pasan a `/` conservando `STAFF_DISABLED`.
- **El contrato** (`docs/specs/0067-contratos-de-api.md`) pasa de 4 a **8 endpoints** y suma la
  **tabla de codigos de rebote**, que es adonde se mudo la allow-list de la pantalla borrada.

#### Dos hallazgos que salieron de medir, no de suponer

1. **`app/page.tsx` ya no rebota una sesion viva a `/backoffice`.** No estaba en el encargo y es una
   consecuencia FORZADA de la §7: con los tres `redirect` del guard apuntando a `/`, ese rebote
   cerraba un **bucle de redireccion infinito** (sesion sin membresia → `/` → `/backoffice` → `/`…).
   El bucle existia con o sin el gate de email nuevo. Se resolvio **borrando** lineas (el diff de esa
   pantalla no agrega una sola linea que no sea comentario).
2. **Con `emailAndPassword.enabled: false`, better-auth 1.6.26 SIGUE montando `/sign-in/email`** y
   contesta **400 «Email and password is not enabled»**, no 404. Medido, no supuesto:
   `merchant-auth-disabled-paths.test.ts` lo pinnea asi, y pinnea que no setea cookie.

#### Bitacora de mutaciones del paso 3 — filas ABIERTAS ANTES DE MEDIR

**Punto de retorno** (copias limpias en `/tmp`, hechas antes de tocar nada):

```sh
cp /tmp/auth-guards.clean.ts  apps/merchant/src/server/auth-guards.ts                 # ec8e3421911a3abf5651a834d48b28cbb1f275f4
cp /tmp/start-route.clean.ts  apps/merchant/src/app/api/merchant/auth/start/route.ts  # de5f70a68b5efde9f430e9d79b75485410b2022e
cp /tmp/brand.clean.ts        apps/merchant/src/server/brand.ts                       # 06385261f7010cc8370200c9cc7187028bd58df2
```

| id | archivo | shasum limpio | invariante que ataca | resultado EJECUTADO |
|---|---|---|---|---|
| M3 | `apps/merchant/src/server/auth-guards.ts` | `ec8e3421911a3abf5651a834d48b28cbb1f275f4` | el gate de email verificado **no alcanza al staff**: sin la condicion `role === 'owner'` el mostrador queda muerto para siempre | **ROJO por la asercion correcta** — 1 failed / 1343 passed |
| M4 | `apps/merchant/src/app/api/merchant/auth/start/route.ts` (`??` — `git checkout` NO lo restaura) | `de5f70a68b5efde9f430e9d79b75485410b2022e` | un email CONOCIDO no abre sesion: escribir el email de otro merchant no le entrega el negocio | **ROJO por la asercion correcta** — 5 failed / 1339 passed (2 oraculos + 3 colaterales) |
| M5 | `apps/merchant/src/server/brand.ts` | `06385261f7010cc8370200c9cc7187028bd58df2` | el slug **no sigue al nombre**: renombrar el negocio no mueve el login del staff ni la URL publica | **ROJO por la asercion correcta** — 2 failed / 1342 passed (1 oraculo + 1 colateral) |
| M6 | `apps/merchant/src/server/auth-guards.ts` | `ec8e3421911a3abf5651a834d48b28cbb1f275f4` | borrar la UI no convierte un rebote en un 404: el destino del guard es parte de su contrato | **ROJO por la asercion correcta** — 1 failed / 1343 passed |

**Alcance de las cuatro:** la suite ENTERA con el env de integracion cargado (`npx vitest run
--testTimeout=60000`, 182 archivos / 1344 tests), no el archivo del oraculo. Baseline sin mutacion:
**1344 passed / 0 failed**.

**M3** — se saca `row.role === "owner" &&` del gate.

```
FAIL src/server/auth-guards.test.ts > staff con email SIN verificar entra igual al mostrador
  Error: redirect:/?e=email_not_verified
    ❯ Module.requireBackofficeSession src/server/auth-guards.ts:120:5
```

El rojo sale **de la llamada al guard**, no del setup: el integrante con `emailVerified: false`
—que es como nacen todos— quedaba rebotado del mostrador.

**M4** — el email conocido abre sesion ademas de mandar el link.

```
FAIL src/server/auth-start.neon.integration.test.ts > email CONOCIDO: NO abre sesión, no devuelve cookie…
  AssertionError: expected 'better-auth.session_token=wxsnSmepzMu…' to be null
FAIL src/server/magic-link.neon.integration.test.ts > start → token → consumo…
  (misma asercion: `started.headers.get("set-cookie")` deja de ser null)
```

**Dos** archivos pinnean el invariante. Las **3 restantes son COLATERALES** y estan declaradas como
tales: la mutacion deja sesiones abiertas para el email conocido, asi que los conteos de sesion del
test de rate limit y el estado encadenado de los dos casos siguientes de `magic-link` se corren. No
son oraculos del invariante.

**M5** — `saveBrand` escribe `slug: slugify(input.name)` junto al `name`.

```
FAIL src/server/business-slug.neon.integration.test.ts > renombrar el negocio NO cambia el slug
  AssertionError: expected 'un-nombre-completamente-distin' to be 'slugtest-a339337f-d3e'
```

Leido por SQL crudo sobre `core.business`, no por el DTO que devuelve `saveBrand`. El segundo rojo
del mismo archivo es **COLATERAL**: corre despues y encuentra el slug ya movido por la mutacion.

**M6** — el destino sin sesion vuelve a la ruta borrada.

```
FAIL src/server/auth-guards.test.ts > no session → /
  AssertionError: expected '/login' to be '/'
```

**Las cuatro revertidas**, con `diff` vacio contra la copia limpia y el `shasum` de vuelta en su
valor de la tabla. `rg -n MUTATION apps packages tools`: **vacio**. `git status --short
apps/merchant/src/server/brand.ts`: **vacio** (volvio a HEAD).


Se corren **al final, de a una**, revirtiendo cada una antes de poner la siguiente (regla que ya se
pago cuatro veces: si la sesion se corta con la mutacion puesta, el arbol queda con el agujero
disfrazado de codigo normal — M3 es *desactivar un gate de autorizacion*).

### El paso 1 esta HECHO: `PASS` del revisor independiente (2026-09-16)

**La spec 0067 sigue `cerrada`, NO pasa a `implementada`:** le faltan los pasos 2 y 3. Lo que tiene
`PASS` es el paso 1.

**Las bitacoras de mutaciones, la evidencia ejecutada y el veredicto completo estan en
`docs/archivo/spec-0067-implementacion.md`.** Lo que hay que saber sin abrirlo:

- El revisor corrio **3 mutaciones** y **declaro que una (R3) se le fue del presupuesto** en vez de
  esconderla. R1 (el umbral del escalado) y R2 (el piso de `RESERVED_SLUGS`) salieron **rojas por la
  asercion correcta**; R3 salio **verde, que es el hallazgo 2 de abajo**.
- **Reproducido por el orquestador, no citado:** el `pin_hash` centinela del backfill **no puede
  autenticar** —contra `better-auth/crypto`, todo PIN tira `Error: Invalid password hash`, con
  control de que un hash real si verifica: **fail-closed**—; `slugify` colapsa alfabetos no latinos
  a `"000"` y devuelve reservadas (`"Admin"` → `"admin"`); y el `DEFAULT` del slug no tiene ningun
  oraculo sin base.
- Gates de root re-corridos por el orquestador: `typecheck` 3/3 sin cache, `lint` exit 0, `test`
  **1012 passed / 0 failed**, `format:check` OK, `rg MUTATION` vacio.

### Estado del paso 2 (medido en el arbol y en la base, 2026-09-16)

**La sesion que hospeda a los agentes se cerro TRES veces con un subagente en vuelo** (implementador
del paso 1, revisor del paso 1, implementador del paso 2). Las transcripciones sobreviven y los
agentes se retoman con `SendMessage`; **la causa no se pudo determinar desde adentro y no se supone.**
**Regla que salio de ahi y que ya va en los encargos: la mutacion se corre AL FINAL**, despues de que
el trabajo este escrito y los gates verdes — si el corte llega con la mutacion puesta, el arbol queda
con el agujero disfrazado de codigo normal (la #2 es *guardar el PIN en claro*).

Lo que hay del paso 2, sin commitear:

- `server/staff.ts` modificado: `createStaff` recibe **solo `{ name }`**, `ownerContext` trae el
  `slug`, el DTO expone `identifier` (`handle@slug`).
- **`server/merchant-session.ts` NUEVO y fuera de la lista de archivos permitidos** — abre sesion de
  `merchant_auth` para un `user_id` ya autenticado por el servidor, **serializando y firmando la
  cookie a mano** (better-auth solo expone `setSessionCookie` con un contexto de endpoint que una
  ruta de Next no tiene). **Es el archivo mas delicado del arco**: lo sostiene todo login de staff, y
  su propio docblock dice que el oraculo es una ida y vuelta contra Neon que **todavia no existe**.
  Escribir ese test esta encargado.
- **Falta**: las 3 rutas nuevas, los tests, y `docs/specs/0067-contratos-de-api.md`.
- `rg MUTATION` **vacio**: no quedo ninguna mutacion puesta.

**La `0032` YA ESTA APLICADA en la rama de integracion** (autorizado en el encargo; NO en produccion).
Verificado por el orquestador: existe la columna `slug`, existe `staff_pin_lockout`, y **las 8 filas
`role='staff'` tienen las 8 el `pin_hash='legacy-sin-pin'`** — el escenario del centinela es
reproducible ahi con datos reales.

**El paso 2 esta IMPLEMENTADO y en revision independiente (2026-09-16). La revision se corto una
vez y fue retomada** — es la **cuarta** vez que la sesion que hospeda a los agentes se cierra con uno
en vuelo. Al heredar, lo primero: **ninguna mutacion puesta**, verificado por contenido y no solo por
la etiqueta (`staff-create.ts:99` = `const pinHash = await hashPin(pin)`, y `shasum`
`0e7ed478aa7f9d8116d8777270afbf7ac130cce1`, el limpio del implementador). Reproducido por el
orquestador, no citado del agente:

- Gates de root Node 24: `typecheck` 3/3 **sin cache**, `lint` exit 0, `format:check` OK, `test`
  **1019 passed / 327 skipped / 0 failed**. `rg MUTATION` vacio.
- **Integracion Neon corrida por el orquestador contra la base real** (`set -a; . ./.env.integration.local; set +a`):
  `staff-pin.neon` **8/8** y `staff-pin-change.neon` **7/7**. Entre los 15, los dos invariantes que
  el orquestador habia exigido agregar al encargo: **«el `pin_hash` centinela contesta 401, NUNCA
  500»** y **«NO deja fijar un PIN nuevo sin el PIN actual correcto»** (el que evitaba la toma de
  cuenta del staff heredado).
- **La cobertura de secretos que se habia perdido REAPARECIO**, adaptada al secreto nuevo: en
  `staff-create.test.ts`, «devuelve un PIN de 6 digitos que NO aparece en el DTO» y «persiste el
  hash del PIN, nunca el PIN». El barrido de abajo queda cerrado.
- El cableado que el orquestador pidio funciona: `"Admin"` → `admin-2@la-farmacia` (no se queda con
  la reservada) y dos nombres que colapsan a `"000"` → `000-2@la-farmacia`.

Archivos nuevos del paso 2: `server/staff-create.ts`, `server/merchant-session.ts`, las 3 rutas
(`api/merchant/auth/staff`, `api/staff/[userId]/pin`, `.../pin/regenerate`), 3 tests y
**`docs/specs/0067-contratos-de-api.md`** (217 lineas, los 4 endpoints con sus `code`).

**`server/merchant-session.ts` es lo que el revisor tiene que mirar primero:** abre sesion
**firmando la cookie a mano** porque el `setSessionCookie` de better-auth exige un contexto de
endpoint que una ruta de Next no tiene. **El paso 3 lo va a reusar para el link magico del owner**,
asi que un error ahi escala a toda la identidad del producto.

Van **tres** archivos nuevos fuera de la lista de permitidos, los tres con motivo escrito y los tres
a verificar por el revisor: `merchant-session.ts` (firma la cookie de sesion a mano),
`staff-create.ts` (el alta salio de `staff.ts`, que con ella adentro llegaba a **338** lineas contra
el limite de 300) y la carpeta `app/api/merchant/auth/`.

### Lo que se le encargo al paso 2 ADEMAS de la spec (y por que)

Tres cosas que no estaban en la spec y entran al encargo con su motivo:

1. **La ruta del PIN tiene que atrapar el `throw` del centinela y responder 401/429, NO un 500.**
   Sale de la revision del paso 1: el `pin_hash = 'legacy-sin-pin'` del backfill hace **tirar** al
   verificador de better-auth (fail-closed, medido).
2. **El endpoint de «cambio obligatorio en el primer uso» NO puede fijar un PIN nuevo sin verificar
   el actual.** Si lo permitiera, `pin_must_change=true` sobre las filas centinela seria una **toma
   de cuenta** del staff heredado. Es el invariante mas peligroso del paso 2.
3. **El cableado de `slugify` para el `handle`**: pasar por `nextSuggestion` contra los handles ya
   tomados y que un handle derivado **nunca** sea una reservada. **`slugify` NO se toca** (su forma
   la fija la spec §1); se resuelve afuera.

**Supuesto del orquestador, NO confirmado por el owner:** que la respuesta al hallazgo 4/5 del paso
1 es cablear en la ruta y dejar `slugify` como esta. Si el owner prefiere cambiar la funcion, se
corrige antes del paso 3.

**Autorizacion acotada que lleva el encargo:** aplicar la `0032` **en la rama de integracion**
(es lo mismo que CI hace en cada corrida), **terminantemente NO contra produccion**.

### Los cuatro hallazgos del paso 1### Los cuatro hallazgos del paso 1 — SON DECISIONES DEL OWNER, NO ESTAN TOMADAS

1. **El `DEFAULT` del `slug` es andamiaje con fecha de vencimiento.** Existe porque el paso 1 tenia
   prohibido tocar la ruta del alta, y sin el la columna `NOT NULL` rompe los 15 call-sites de
   arriba. **Cuando el paso 2 escriba `slugify(name)` en el alta hay que decidir si se dropea:**
   mientras viva, una ruta que se olvide del slug no falla, se lleva un `b-…` de URL publica.
2. **Aplicar la `0032` ANTES del paso 2 rompe la creacion de staff.** Verificado en el arbol:
   `staff.ts` inserta `role:"staff"` sin `handle` ni `pin_hash`, y el CHECK nuevo los exige → `23514`.
   Y **`ci.yml` corre `pnpm db:migrate` en cada corrida**, asi que **el primer push que lleve la
   `0032` la aplica sola en la rama de CI** y deja rojos `staff.neon`, `billing-routes-auth.neon` y
   `counter-redeem-guards.neon` hasta que aterrice el paso 2. Es orden del arco, no bug — pero **se
   decide antes de pushear**, no despues.
3. **Con el env de integracion cargado, la suite `.neon` ya esta rota hoy** (el esquema declara
   `slug`, la rama no lo tiene). Los gates de root estan verdes porque sin ese env los 67 archivos
   `.neon` se auto-skipean.
4. **`slugify` colapsa a `"000"` todo nombre sin caracteres latinos** —reproducido por el
   orquestador: `"日本語"` → `"000"`, `"Мир"` → `"000"`, `"   "` → `"000"`, y `"A"` → `"a00"`—. Dos
   consecuencias: ese comercio se lleva `checkpass.club/es/000`, y como **el mismo `slugify` deriva
   el `handle` del staff** (spec §4), dos integrantes con nombre en japones o cirilico colisionan
   contra el unico `(business_id, handle)`. La funcion cumple lo que promete (siempre devuelve forma
   valida); es **forma que se le traslada al comerciante y la decidio el implementador solo**.
5. **`slugify` puede devolver una palabra reservada y hoy nada lo impide.** Reproducido:
   `"Admin"` → `"admin"`, `"Wallet"` → `"wallet"`, `"Login"` → `"login"`, las tres en
   `RESERVED_SLUGS`. El modulo es correcto segun §1 (no mira reservadas a proposito) y
   `nextSuggestion` resuelve, **pero el cableado que las conecta lo escribe el paso 2**: si la ruta
   del alta llama `slugify` a secas, un negocio llamado «Admin» se queda con `/es/admin`.

**El paso 1 no toca `app/` ni `auth*.ts` ni `staff.ts` ni `middleware.ts`**, y tiene prohibido
aplicar la migracion contra produccion y ejecutar el wipe.

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

## ESTADO DEL ARBOL (bloque reescrito ENTERO el 2026-09-16, tercera vez en el dia)

- **Nada commiteado y nada pusheado.** Todo el trabajo de los pasos 1, 2 y 3 de la spec 0067 esta
  en el working tree. **El commit lo autoriza el owner.**
- **`rg -n MUTATION apps packages tools`: VACIO.** Las cuatro mutaciones del paso 3 se corrieron de
  a una, al final, y se revirtieron con `diff` vacio contra copia limpia (bitacora arriba).
- **HAY DOS MIGRACIONES NUEVAS SIN APLICAR EN PRODUCCION**, ademas de la `0032` del paso 1:
  `0033_borra_el_arco_de_recuperacion` (dropea `merchant_auth.password_reset_attempt`, que se queda
  sin lector) y `0034_rate_limit_del_auth_start` (crea `merchant_auth.auth_start_attempt`, la fuente
  del rate limit por IP de `start`). **Las tres estan aplicadas SOLO en la rama de integracion**
  (`br-shy-king-axu5s3ze`), verificado por SQL: `merchant_auth` tiene `account, auth_start_attempt,
  session, user, verification`. **`ci.yml` corre `db:migrate` en cada corrida**, asi que el primer
  push las aplica solas en la rama de CI: se decide ANTES de pushear, no despues.
- **Gates de root con Node 24 (v24.20.0), sobre el arbol final ya revertido, DESPUES del arreglo
  del FAIL:** `typecheck` 3/3 **sin cache** (`--force`), `lint` exit 0, `test` **1017 passed / 344
  skipped / 0 failed**, `format:check` OK, `build --force` **3/3, 0 cached**. Con el env de
  integracion: **182 archivos / 1349 passed / 0 failed**; los 6 `.neon` de la 0067, **42/42**.
- **`drizzle-kit check` → `Everything's fine`; `drizzle-kit generate` → `No schema changes,
  nothing to migrate`** con `diff -rq` sobre `drizzle/` sin archivos nuevos: **no hay drift** entre
  el esquema y los snapshots despues de borrar `schema/merchant-recovery.ts`.
- La spec 0065 sigue **cerrada** — QA del owner en verde. Deuda en `docs/PARQUEADO.md`.
- La spec 0066 sigue **cerrada e implementada, con PASS**. Detalle en
  `docs/archivo/spec-0066-implementacion.md`.
- **Verificacion manual del owner, pendiente pero NO bloqueante** (viene del cierre de la 0066):
  correr `/context` y confirmar que `CLAUDE.md` pesa menos; algun dia despachar al `revisor` un
  encargo SIN presupuesto para ver el default (4 mutaciones, PLAUSIBLE) en accion.

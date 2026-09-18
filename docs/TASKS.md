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

**Ultima actualizacion: 2026-09-18 — HANDOFF. El arco 2 cerrado, CI verde verificada y en
produccion. **El owner se fue a construir la UI con ChatGPT**; la proxima tanda son las CINCO
APIs que dejo pedidas. Ver «ARRANCA ACA LA SESION QUE SIGUE».**

**ESTADO REAL, en una pantalla — todo verificado, nada asumido:**

| Que | Donde esta |
|---|---|
| Ultimo commit de CODIGO | **`0507cf5`** (la spec 0072). Afirmacion ESTABLE: no la invalida un commit de docs posterior |
| Sincronizacion local/remoto | **En sintonia**: `git rev-parse --short HEAD` y `git ls-remote origin main` dan los dos **`78d1f3a`** (el commit de docs que sigue a la 0072), leidos el 2026-09-18 |
| CI para `0507cf5` | **✅ VERDE, LEIDA DE `/check-runs` EL 2026-09-18.** `verify: completed -> success`, y los **18 pasos del job en `success`** (contados por API: 18 totales, **0 no-`success`**), incluidos `Migrar la rama Neon de CI`, `Unit + integracion Neon`, `test:e2e`, `build` y `format:check`. **Nunca `/status`, que en este repo miente** (agrega commit statuses viejos donde solo publica Vercel; GitHub Actions es `/check-runs`, otro endpoint) |
| CI para `78d1f3a` (el commit de docs, HEAD de `origin/main`) | **✅ VERDE**, leida de `/check-runs` el 2026-09-18: `verify: completed -> success`, **18 pasos, 0 no-`success`**. **Los DOS commits del arbol estan verificados**, no solo el de codigo |
| Ultimo commit EN PRODUCCION | **`78d1f3a`** — Vercel desplego `0507cf5` (`dpl_4ncoWc…`) **y** `78d1f3a` (`dpl_6sGHYf…`), los dos `state: READY`, `target: production`, leidos de la API de Vercel el 2026-09-18. **La 0072 esta LIVE** |
| Migraciones que pide `0507cf5` | **NINGUNA** — la 0072 no tiene migracion, asi que el deploy no tiene la ventana de riesgo de la 0069/0035 |
| Specs del arco | **0067, 0068, 0069 y 0072 `implementadas`**. La 0069 y la 0072 con **PASS de revisor independiente** |
| Suite | **203 archivos / 1590 passed / 0 failed** con Neon, medido LOCAL sobre `0507cf5` antes del push |
| Produccion (datos) | **0 negocios, 0 usuarios merchant, 0 suscripciones** (ultima lectura, `08227ed`) |

**→ LO PROXIMO, literal:** los puntos (1) y (2) de este bloque —CI verde y Vercel `success`—
**estan HECHOS y verificados el 2026-09-18** (ver la tabla de arriba). **La 3ª spec del arco queda
CERRADA con esto y el arco 2 entero esta en produccion.**

**EL OWNER YA ELIGIO que sigue, el 2026-09-18, y NO es la 4ª spec del ADR 0070:** se fue a construir
la UI del wizard con ChatGPT y dejo pedidas **cinco APIs** para cuando vuelva. Estan en
«ARRANCA ACA LA SESION QUE SIGUE», con lo medido de cada una. **La 4ª spec (onboarding derivado)
queda diferida sin fecha** —no cancelada— junto con las filas **54** y **49** de `PARQUEADO.md`;
sus seis decisiones abiertas y el agujero de los colores (que NO son derivables: nacen con default)
quedan escritos en la §«la 4ª spec» de mas abajo para no re-medirlos.

## ⇥ DECISIONES DEL OWNER SOBRE LA UI (2026-09-18)

**La UI la construye el owner por fuera con ChatGPT** (ADR 0070 §16), consumiendo los contratos
`0067`/`0069`/`0072`. Lo que decidio el 2026-09-18, textual: **«el wizard como es para dar de alta
a un merchant deberia vivir en la app del merchant»**.

**Medido, y la decision coincide con el estado de hecho:** las rutas vivas del consumidor
(`/enroll/[programId]`, `/wallet`, `/recover`) **ya viven en `apps/merchant`** bajo el grupo
`(consumer)`, y `apps/merchant` es la **unica app desplegada** (un solo proyecto en Vercel). Asi
que el wizard y el `/login` de tres perfiles no cruzan ningun limite de app.

**Mapa de superficies que el owner dicto** (ninguna existe todavia como pantalla):

| URL | Que es | Estado medido el 2026-09-18 |
|---|---|---|
| `checkpass.club` | landing publica | la raiz responde 200; el apex hace **308 a `www`** |
| `checkpass.club/login` | login UNICO de merchant, staff y consumidor, que redirige segun el caso. **Decision del owner del 2026-09-18, que CORRIGIO al orquestador: NO vive en la app del merchant sino en la PUBLICA** — «puede acabar en merchant o consumer luego» | **no existe** — la 0067 borro `/login` |
| `checkpass.club/es/business/dashboard` | pantalla principal del comercio | **no existe**; hoy es `/backoffice/*`, que es la UI vieja a borrar (ADR 0070 §17) |
| `bo.checkpass.club` | panel del dueño de CheckPass, con **login propio y sin web publica** | **no resuelve DNS**. Su esqueleto es `apps/platform`, que hoy tiene una sola ruta (`/api/health`) |

**⚠️ RESTRICCION MEDIDA que condiciona donde puede vivir `/login`:** la cookie de sesion la
setean rutas de **`apps/merchant`** (`openMerchantSession` en `api/merchant/auth/staff/route.ts:135`,
y el catch-all `/api/auth/*`), sobre el origen `checkpass.club`. **La superficie publica tiene que
servirse en el MISMO origen** o el `Set-Cookie` no pega. Y hoy la raiz `checkpass.club` **la sirve
`apps/merchant`** (`src/app/page.tsx` existe). O sea que «la app publica» es hoy un **grupo de rutas
dentro de `apps/merchant`** que se extrae despues, o un deployable nuevo que pasa a ser dueño de la
raiz. **El owner no eligio entre esas dos y no se elige por el.** Mitigacion ya puesta en el encargo
a ChatGPT: `/login` se construye **sin una sola dependencia del merchant**, para que mudarlo no sea
reescribirlo.

**HALLAZGO A DECIDIR, no decision del owner:** `apps/consumer` es **andamiaje sin tarea** — solo
`/qa`, `/check-in/demo-bar`, `/wallet/demo` y `/api/health`, y no esta desplegada. Por la regla del
repo le toca una fila en `TASKS.md` con quien la va a consumir, o el borrado.

**PIEZA 0 PROPUESTA para la proxima tanda, a confirmar: `GET /api/merchant/session`.** Medido: el
unico lector de sesion publicado hoy es `GET /api/auth/get-session` de better-auth (verificado
contra `www.checkpass.club`: **200 con cuerpo `null`** sin sesion, y los controles —un path de
`disabledPaths` y uno inventado— dan **404**, o sea que la sonda discrimina). **No hay fuga**: la
tabla `user` tiene `id`, `name`, `email`, `emailVerified`, `image` y las fechas, nada sensible.
**El problema es que es insuficiente**: no dice rol, negocio, `slug`, `status` ni plan, asi que la
UI tendria que inferirlos de los 403. Un DTO propio seria ademas **el consumidor que espera el
andamiaje de `requireBackofficeSession`** (`status`/`suspensionReason`, §ANDAMIAJE de mas arriba).

**⚠️ DEUDA DE MEDICION, declarada y NO perseguida:** los `duration_ms`/`tool_uses`/`subagent_tokens`
de los subagentes de la **0072** —que el owner pidio anotar para la re-medicion del ADR 0071— **se
perdieron**. Vivian en las notificaciones de subagente de la sesion anterior y el `/clear` se las
llevo; **no estan en disco** (verificado: el ADR 0071 tiene la re-medicion contra la 0069 y cero
menciones de la 0072). No se reconstruyen sin inventarlas. **La 4ª spec es la proxima oportunidad
de medirlo**, y hay que anotarlo A MEDIDA que llega cada notificacion, no al final.

**EL ARCO 2 ESTA CERRADO Y EN PRODUCCION.** La **3ª spec** del arco esta **`cerrada`**:
**`docs/specs/0072-entitlements-y-estado-del-negocio.md`**, con su ADR **0073** y sus dos filas
de `INDEX`. **Las decisiones del owner estan las cuatro tomadas** y el implementador salio.

**→ PARA RETOMAR, LEER EN ESTE ORDEN:** esta cabecera · la seccion «LA 3ª SPEC» de aca abajo ·
la spec **0072** y el ADR **0073** · `docs/PARQUEADO.md` filas **56** y **57** (las dos las
absorbe la 0072) · el ADR **0070** (el arco) y el **0071** (el proceso).

## ⇥ ARRANCA ACA LA SESION QUE SIGUE (handoff del 2026-09-18)

**EL OWNER SE FUE A CONSTRUIR LA UI CON CHATGPT.** El arco 2 esta cerrado, verificado y en
produccion (ver la tabla de ESTADO REAL de arriba). **No hay codigo pendiente.** Lo que sigue
depende de que el owner vuelva con la UI del wizard construida.

**LO QUE PIDIO PARA CUANDO VUELVA, en su orden y textual** (2026-09-18) — **son cinco APIs, y las
decisiones de contenido NO estan tomadas todavia**:

1. **API de verificacion de email** (para el onboarding). **⚠️ MEDIDO: YA EXISTE ENTERA.**
   `POST /api/merchant/auth/verify-email` emite (contrato 0067 §7, toma el email de la SESION, no
   del body) y `GET /api/merchant/auth/magic-link` consume **y es lo que pone `emailVerified: true`**.
   El gate ya corre en las 10 superficies desde la 0072. **Lo que queda no es construirlo sino una
   decision del owner:** si le sirve que la verificacion ocurra como efecto de consumir un link de
   login, o quiere un link SOLO de verificacion, separado del de entrada. **Preguntarselo antes de
   escribir una linea.**
2. **API de marca** — editar todo lo de la marca de un merchant: imagenes, colores, nombre.
3. **API de locales** — alta, baja, modificacion, **y limites segun el plan**.
4. **API de staff** — alta, baja, modificacion, **y limites segun el plan**. **Medido: las 4 rutas
   de CRUD YA EXISTEN** (contrato 0067); lo que falta son los limites por plan, porque la 0072
   midio que **staff no tiene tope por plan hoy**.
5. **API de catalogo de productos (mini-POS)** — alta, baja, modificacion de productos y categorias,
   **con una capa de IA AGNOSTICA del modelo**: se le manda una foto y devuelve JSON para generar el
   catalogo. **Medido: hay 6 rutas de catalogo vivas** pero **ninguna pasa por el catalogo de
   entitlements**, y productos tampoco tiene tope por plan.

**PIEZA 0 PROPUESTA, a confirmar con el owner antes de empezar: `GET /api/merchant/session`** (ver
la seccion de decisiones de UI). Las cinco pantallas de arriba la van a necesitar.

**LO PRIMERO AL RETOMAR, antes de cualquier spec:** el owner vuelve con `docs/api-faltante.md`
escrito por ChatGPT — el encargo se lo pide explicitamente. **Esa lista es el insumo real del
alcance**, y hay que leerla ANTES de elegir por donde empezar: puede reordenar las cinco.

**Y la regla que aplica a esa lista:** un endpoint que ChatGPT diga que falta es **una afirmacion
suya, no una verificacion**. Se reproduce contra el arbol antes de que entre a una spec — igual que
se hizo con los cinco puntos de arriba, donde medir corrigio dos (el 1 ya existe, el 4 esta a
medias).

## ⇥ LA 4ª SPEC (onboarding derivado) — DIFERIDA, con lo medido el 2026-09-18

**No existe el archivo de spec.** Lo unico escrito son ~8 lineas del ADR 0070 **§9** (el checklist
derivado de los hechos) y **§11** (verificar el email es su primer paso). Eso es el QUE, no un plan.

**Medido en el arbol el 2026-09-18, para no re-medirlo:**
- **No existe columna `onboarding_step`** (bien: el ADR la prohibe). Los dos hits de «onboarding»
  en el esquema son `onboarding_token_hash`, del arco de recuperacion del **consumidor**: vivo y
  otro dominio.
- **Cero codigo de checklist** en `apps/merchant/src`. Greenfield.
- La superficie `onboarding` de hoy es **solo el wizard**: `prefill`, `business`, `program`.

**Los 8 items del §9 contra los hechos que existen — y DOS NO CIERRAN:**

| Item | Hecho | ¿Deriva? |
|---|---|---|
| Logo | `business.logo_object_key` (nullable) | si |
| **Colores** | `brand_primary/complementary/accent_color` | **NO — `notNull` con DEFAULT** |
| Sello propio | `loyalty_program.stamp_image_object_key` (nullable) | si |
| Catalogo | filas en `product` | si |
| Costos | `product.unit_cost` (nullable) | si, pero sin criterio definido |
| Staff | `business_membership` con rol staff | si |
| Mas locales | `location` > 1 | si |
| **Wallet** | `wallet_pass` | es un hecho **del consumidor**, no del comercio |

**EL AGUJERO CENTRAL: los colores NO son derivables.** Nacen con valor (`#176548`, `#2D8B68`,
`#E78132`), asi que **no hay forma de distinguir «el owner eligio su marca» de «nunca la toco»**.
El unico proxy es `brand_revision` (default `1`) o `logo_version` (default `0`) — inferir por un
contador de revision, que es justo la clase de cosa que el ADR quiso evitar. **Rompe la premisa del
§9 y no se arregla escribiendo codigo**: o se acepta el proxy, o sale el item, o entra una columna
(y ahi la spec deja de ser sin-migraciones).

**LAS SEIS DECISIONES DEL OWNER QUE LA DESTRABAN** (ADR 0071 §2: se piden ANTES de la prosa):
1. **Colores**: ¿proxy por `brand_revision`, se saca del checklist, o una columna?
2. **Wallet**: ¿cual es el hecho? ¿Sigue siendo un item si depende de un tercero?
3. **Costos**: ¿alcanza UN producto con `unit_cost`, o todos?
4. **Que significa «completo»** en los otros cinco (¿un local mas o dos? ¿un integrante, o uno que
   ya entro?).
5. **¿Bloquea o solo ordena?** El §11 dice «sin eso no avanza el resto», pero **el gate de email ya
   esta implementado** (la 0072, en `requireApiOwner`, 10 superficies). O sea que la 4ª spec seria
   solo el **LECTOR**, no el gate. Confirmarlo.
6. **Es API, no pantalla** (ADR 0070 §16), aunque el §9 diga «checklist en el backoffice»: entrega
   un `GET` del estado derivado + su contrato.

**Plantilla: `TEMPLATE.md`, NO la chica.** Falla dos de las tres condiciones del ADR 0071 —varios
dominios (marca, catalogo, staff, locales, loyalty, wallet) y decisiones de producto abiertas—; si
los colores terminan pidiendo columna, falla las tres.

## ⇥ BITACORA DE MUTACIONES — spec 0072 (implementador, 2026-09-17)

**Presupuesto: 7 mutaciones** (M1-M7 de la §Plan de pruebas de la spec). Las filas se abren
ANTES de medir. **Restauracion de emergencia:** los archivos nuevos (`??`) tienen copia limpia
en `/tmp/spec0072-clean/`; los modificados (` M`) se restauran con `git checkout --` SOLO si no
hay otro trabajo sin commitear en ellos (hoy SI lo hay: el paso 1 de la spec).

| id | archivo | shasum limpio | invariante que ataca | alcance medido | resultado EJECUTADO |
|---|---|---|---|---|---|
| M1 | `server/api-owner.ts` | `ba2daa879915e807077311ac7b3b189f9b3c446d` | el eje `status` se lee en `requireApiOwner`: una API del owner frena en un negocio `suspended`/`closed` | suite entera (203 archivos, con Neon) | **ROJO 38 tests / 1 archivo** (`api-owner-surfaces.test.ts`): los 3 casos de estado × las 12 entradas HTTP. Aserciones: `AssertionError: expected 400 to be 403`, `expected 503 to be 403`, `expected 422 to be 403` — sin el paso 4 el request sigue de largo hasta el dominio. Revertida desde `/tmp/spec0072-clean/api-owner.ts`, `diff` limpio, shasum `ba2daa87…` |
| M4 | `app/api/merchant/auth/magic-link/route.ts` | `6b10503a827f29f413f4b175b8e1be3783291ad2` | el corte de `closed` en el CONSUMO del link magico: el owner de un negocio cerrado no obtiene sesion | suite entera (203 archivos, con Neon) | **ROJO 2 tests / 1 archivo** (`magic-link-business-closed.neon.integration.test.ts`). Asercion: `AssertionError: expected '/backoffice' to be '/?e=business_closed' // Object.is equality`; el 2.º caso cae con `expected 2 to be 1` porque la sesion creada tampoco se revoco. Revertida, `diff` limpio, shasum OK |
| M5 | `app/api/counter/_auth.ts` | `229cc5532a75d0db579dd2cc72fa0914f288af39` | el guard va en CADA superficie y no solo en la puerta: una sesion de staff YA VIVA no acredita en un negocio suspendido (el hueco de los 7 dias) | suite entera (203 archivos, con Neon), medida DOS veces | **ROJO 2 tests / 1 archivo** (`business-status.neon.integration.test.ts`). Asercion (2.ª medicion, con la etiqueta puesta): `AssertionError: el mostrador dejó pasar una sesión de staff YA VIVA en un negocio SUSPENDIDO: expected false to be true // Object.is equality` y su gemela `… en un negocio CERRADO`. Revertida, `diff` limpio, shasum OK |
| M2 | `server/api-owner.ts` | `ba2daa879915e807077311ac7b3b189f9b3c446d` | el gate de email verificado corre en las 10 superficies, incluida billing (que hoy no lo tiene) | suite entera (201 archivos) | **ROJO 28 tests / 4 archivos**: `api-owner-surfaces.test.ts` (las 12 entradas, incluida `billing/checkout`), `staff-gate.test.ts`, `staff-list.neon`, `business-slug.neon`. Asercion sobre billing: `AssertionError: expected 400 to be 403 // Object.is equality`. Revertida, `diff` limpio, shasum OK |
| M3 | `server/api-owner.ts` | `ba2daa879915e807077311ac7b3b189f9b3c446d` | el ORDEN de §D1: el email se evalua DESPUES de resolver owner, o un integrante recibe `email_not_verified` en vez de `not_owner` | suite entera (201 archivos) | **ROJO 18 tests / 5 archivos**: `api-owner-surfaces.test.ts` (las 12), `staff-gate.test.ts`, `staff-list.neon`, `staff-pin-change.neon`, `business-slug.neon`, `billing-routes-auth.neon`. Asercion: `AssertionError: expected 'email_not_verified' to be 'not_owner' // Object.is equality`. Revertida, `diff` limpio, shasum OK |
| M6 | `server/entitlements/catalog.ts` | `e592b5aa51d7553a720585bfdb3a61dbf552f785` | `campaigns.enabled` exige suscripcion VIVA: un `plus` forma A1 (sin `stripe_subscription_id`) no activa campañas | suite entera (200 archivos) | **ROJO 4 tests / 2 archivos.** `marketing/plan-gate.test.ts` (A1, `canceled`, `incomplete_expired`) + `entitlements-catalog.test.ts`. Asercion: `AssertionError: expected true to be false // Object.is equality`. Revertida, `diff` limpio, shasum OK |
| M7 | `server/entitlements/catalog.ts` | `e592b5aa51d7553a720585bfdb3a61dbf552f785` | el catalogo es la FUENTE del tope de locales, no una copia muerta | suite entera (200 archivos) | **ROJO 22 tests / 9 archivos**, unit + Neon: `locations.test.ts` `AssertionError: expected 2 to be 1`, `locations-plan-cap.test.ts` `expected { limit: 2, pendingDowngrade: true } to deeply equal { limit: 1, pendingDowngrade: true }`, `locations-limits.neon` `promise resolved "{ …(4) }" instead of rejecting`, `billing-plan-change.test.ts` `expected [ { input: { …(8) }, …(2) }, …(1943) ] to deeply equal []`. Revertida, `diff` limpio, shasum OK |

## ⇥ LA 3ª SPEC DEL ARCO: la 0072 esta `cerrada` y en implementacion (2026-09-17)

### ⇥ LA 0072 ESTA `implementada` — PASS de revisor independiente (2026-09-17)

**PASS.** Un solo ciclo: el revisor no abrio FAIL. Gasto sus **4 mutaciones** y la condicion de
corte no se aplico. **SIN COMMITEAR** — 58 archivos en el diff, `HEAD` en `5f89d18`.

**Gates al momento del PASS** —corridos por el orquestador DESPUES de sus propios cambios, porque
el PASS del revisor no cubria lo que el orquestador toco despues—: `typecheck --force` **3/3 sin
cache** · `lint` exit 0 · `format:check` OK · **`test` con Neon: 203 archivos / 1584 passed / 0
failed** · `build --force` **3/3 sin cache** · `rg MUTATION apps` **vacio**. El **`build` era la
unica señal del DoD que nadie habia observado**: el revisor lo declaro afuera.

**⚠️ ESE `1584` ES HISTORICO, NO LA CIFRA FINAL.** Despues del PASS vinieron dos cierres pedidos
por el owner —F1 y el landing del enroll—, cada uno con sus tests, y **los gates se re-corrieron
enteros despues de cada uno**. La cifra vigente es **1590** (§«F1 CERRADO» y §«CERRADO — el landing
publico»). Los `1584` de este archivo son el estado de una corrida anterior y se dejan con su
fecha: un numero viejo etiquetado es historia; reescrito, es una mentira sobre cuando se midio.

#### ✅ F1 CERRADO — decision del owner del 2026-09-17 («cerralo ahora»)

**El agujero:** `POST /api/onboarding/program` llamaba a **`saveProgram`** (`route.ts:53`), **el
MISMO writer** que la ruta gateada `PUT /api/loyalty-program` (`route.ts:60`), con solo
`getSession`. Con el negocio en `suspended` respondia **200 con `created: false`** —o sea UPDATE—
mientras la gateada contestaba **403**. Lo cazo el revisor y lo reprodujo el orquestador.

**Y NO era una decision de producto abierta, que es como el orquestador lo habia planteado mal:**
la regla textual del owner para `suspended` ya decia «no pueden … **cambios en programa**». Era
un **incumplimiento**, no una pregunta.

**Medicion que ACOTO el hallazgo de tres rutas a UNA** (el revisor decia «lo mismo aplica a
`business` y `prefill`; verificado y es falso):
- **`onboarding/prefill`: no lee una sola fila del negocio.** Devuelve paises, categorias y el
  sesgo geografico de los headers. No hay estado que gatear.
- **`onboarding/business`: solo CREA.** Si ya existe **cualquier** membresia contesta **409**
  antes de escribir (`route.ts:110`). Un owner con negocio `suspended` ya tiene membresia, asi
  que **nunca llega a un write**. Inalcanzable, no arreglable.
- **`onboarding/program` era el unico agujero real.**

**EL GATE VIVE EN EL WRITER, NO EN LA RUTA.** `saveProgram` (`server/loyalty-program.ts`) es un
writer con **dos puertas**; una defensa en el borde deja la otra abierta, que es exactamente como
nacio el agujero. Ventaja extra: el guard lee el `status` de **la misma fila** que el write va a
tocar, asi que no le afecta la divergencia `asc`/`desc` de §D3. **La ruta NO lleva el gate de
email, a proposito**: el wizard corre antes de la verificacion (ADR 0070 §11) y son dos ejes
distintos (ADR 0073).

**`businessStatusFailure` se MUDO a una HOJA sin un solo import (`server/business-status.ts`),
y es la leccion del paso 1 aplicada de nuevo.** Vivia en `api-owner.ts`, que importa
`next/server` y better-auth; importarla desde `loyalty-program.ts` habria arrastrado el runtime
HTTP y de auth a un modulo de dominio — la misma forma del ciclo que costo 8 suites. `api-owner.ts`
la re-exporta, asi que **sus 12 consumidores no cambian una linea**. Verificado: la hoja tiene
**0 imports** y ni ella ni `api-owner` importan loyalty.

**`LoyaltyError` gano un `code` opcional.** Sin el, el mapeo por STATUS de la ruta
(`codeForStatus`) traducia **todo 403 a `not_owner`**, o sea que un rechazo por negocio suspendido
habria salido con el `code` de «no sos owner»: mentirle al cliente sobre por que lo frenaron.

**El oraculo, y una MUTACION que prueba que muerde** (shasum limpio
`a83c94ae1e7ba5ef2ad7b431afba340fc7b5e71f`): removido el guard, **2 rojos** con
`AssertionError: expected 200 to be 403`, y **el control positivo quedo VERDE** — o sea que el
oraculo discrimina en vez de tirar todo al piso. Revertida con `diff` **vacio** y shasum
coincidente. Los tests nuevos viven en `onboarding-program.neon.integration.test.ts` y **no
aseveran solo el status**: pinnean el `updatedAt` del programa antes y despues, porque un fix que
devolviera 403 **despues** de escribir pasaria en verde con solo mirar el codigo HTTP.

**LIMITE MEDIDO, declarado en el propio test:** el caso de un `status` DESCONOCIDO **no es
alcanzable contra base**. Se intento: el `CHECK` de la migracion `0036` lo rechaza **incluso por
SQL crudo** (`23514 business_status_check`). La polaridad fail-closed se mide donde si se puede,
sobre la funcion pura, en `api-owner-surfaces.test.ts` (12 × 7 estados, `frozen` incluido).

**GATES FINALES, despues del cierre de F1:** `typecheck --force` **3/3 sin cache** · `lint` exit 0
· `format:check` OK · **`test` con Neon: 203 archivos / 1590 passed / 0 failed** (baseline de la spec 1479; +3 del
cierre de F1 y +3 del landing) · `build --force` **3/3 sin cache** · `rg MUTATION apps` **vacio**.

#### Lo que el revisor cazo y el ORQUESTADOR ARREGLO

- **Un `limit(1)` SIN `orderBy` en el corte del link magico** (`magic-link/route.ts`,
  `businessIsClosed`). Su docblock afirmaba «la membresia mas vieja, mismo criterio que
  `requireBackofficeSession`» y **la consulta no ordenaba**: un `limit(1)` sin orden es **no
  determinista**, asi que con dos membresias este guard abriria o cerraria la sesion al azar.
  Se corrigio **el codigo** (se agrego `orderBy(asc(businesses.createdAt))`), no solo el
  comentario — misma regla que la 0069 con el `density` del QR. La divergencia que QUEDA
  —aca se filtra `memberships.status='active'` y `requireBackofficeSession` no— esta declarada
  en el docblock.
- **Una afirmacion de mas de la propia spec.** §D3 decia que se cerraba la divergencia
  `asc`/`desc`. **Falso, reproducido:** quedan cuatro `asc` (`staff.ts:88`,
  `catalog/core.ts:81`, `brand.ts:51`, `auth-guards.ts:106`) contra **un `desc`**
  (`loyalty-program.ts:66`), y `api/loyalty-program` + `/qr` llegan a ese resolvedor `desc`
  **despues** de que el gate resolvio con `asc`. Inalcanzable hoy (`onboarding/business:110`
  contesta 409 si ya hay membresia: un negocio por usuario) y **declarado, no perseguido** —
  cerrarlo toca un archivo que no esta en la tabla de la spec.
- **El contrato afirmaba ser el unico resolvedor de owner.** Corregido, con la fila de exclusion
  de `api/onboarding/*` y su riesgo medido.

#### Hallazgos del revisor que NO son defectos (verificados)

- **La ruta del PIN sin gate esta bien.** `pin/route.ts:73`: `userId !== session.user.id` → `404
  staff_not_found`. Gatearla dejaria a **todo** el staff sin poder cambiar su PIN.
- **`suspensionReason` camelCase** es la convencion del API y esta declarado en el contrato.
- **`api-owner-surfaces.test.ts` tiene PISO DE BARRIDO** (`expect(SURFACES.length).toBe(12)`),
  que es lo que evita que un `it.each` vacio pase en verde. Lo verifico el revisor.
- **El fail-closed asimetrico esta acotado:** `rg "use server"` → **0 matches**, no hay server
  actions, asi que el backoffice no escribe nada por fuera del API. Con un `status` desconocido
  se entra a LEER, pero toda escritura esta fail-closed (medido).
- **Cero fuga de claves de R2:** `brandResponse` sigue destructurando `logoObjectKey` afuera.

#### ANDAMIAJE CON SU TAREA: `status`/`suspensionReason` del guard del backoffice

**NO es un hallazgo a decidir, y el orquestador lo habia clasificado mal.** Es cierto que hoy
ninguna pantalla lo consume (verificado: el unico hit en `.tsx` es `backoffice/page.tsx:90` y es
el `status` de la SUSCRIPCION, otro eje). **Pero su consumidor ya esta decidido por el owner**, en
su dictado textual de `suspended` del 2026-09-17: «el owner puede loguearse y **ver un mensaje de
cuenta suspendida con su razon y boton de contacto**».

**Esta es la fila que lo autoriza** (regla de «nada de andamiaje sin su tarea»):

| Que | Quien lo va a consumir | Estado |
|---|---|---|
| `ctx.business.status` y `ctx.business.suspensionReason` de `requireBackofficeSession` (`auth-guards.ts:160-163`), con el motivo **solo** para `role='owner'` | **La pantalla de cuenta suspendida que construye el OWNER por fuera** (ADR 0070 §16: el arco entrega API, no interfaz). Su contrato es `0072-contratos-de-api.md` §6 | esperando la UI |

**Si esa pantalla no se construye, el campo se borra con ella** — igual que la columna
`core.business.status` respecto de su propia fila.
- **✅ CERRADO — el landing publico del enroll.** Lo observo el revisor como UX y el owner lo
  resolvio el 2026-09-17: «si la persona llegara a escanear el QR para sumarse al programa, la
  landing diria **"Este Programa ya no esta disponible"**». Y acoto el criterio para el futuro:
  **eso se toca al editar la pantalla, SALVO que sea una propiedad de API.** Medido: **lo es**.
  `getEnrollLanding` vive en `server/consumer/enrollment.ts:254` —el servidor, y el archivo ya
  estaba en la tabla de la spec— y la pagina solo renderiza lo que devuelve.
  **Y el mensaje que pidio YA EXISTE:** la rama `!landing` de
  `app/(consumer)/enroll/[programId]/page.tsx:32` dice exactamente «Este programa no esta
  disponible». Asi que devolver `null` lo alcanza: se agrego `eq(businesses.status, "active")` al
  `where` que ya hacia `innerJoin(businesses)`, **cero `.tsx`** (ADR 0070 §16). Fail-CLOSED
  (`= 'active'`, no `in ('suspended','closed')`), misma polaridad que `businessStatusFailure`.
  **Oraculo con mutacion (L1)**, shasum limpio `05af3cf10d69ba62de111576b8b5cb661b558344`:
  removido el guard, **2 rojos** con `AssertionError: expected { …(9) } to be null` y el
  **control positivo VERDE** —que no es decorativo: un `null` puede venir de cualquiera de las 4
  condiciones del `where`, asi que sin el, un gate que anulara TODO pasaria en verde—. Revertida
  con `diff` vacio y shasum coincidente.

#### Correccion del revisor a una premisa del ENCARGO del orquestador

El encargo decia que el consumo del link magico estaba **sin mutar**. **Falso:** la bitacora
muestra que el implementador ya lo habia cubierto con su M4. **2 de las 4 mutaciones del revisor
(RM2 link magico, RM4 catalogo) re-probaron trabajo ya medido** — valen como medicion
independiente con shasum identico, pero se pagaron del presupuesto. La unica superficie del eje
`status` que estaba de verdad sin mutar era el **enroll publico** (RM1), y **RM3 fue original y
es la mejor de las cuatro**: cambio `ownerContext` para leer el `status` de la MEMBRESIA en vez
del NEGOCIO, y descubrio que `api-owner-surfaces.test.ts` **queda verde (88 passed)** porque el
unit dobla `ownerContext` — esa clase de error **solo la caza la integracion**.

### ✅ VERIFICADO POR EL ORQUESTADOR — y un barrido del implementador que era DEBIL

Todo lo de abajo lo escribio el implementador. Esto es lo que el **orquestador reprodujo por su
cuenta** (regla de la señal decisiva: se reproduce lo decisivo, no todas sus mediciones):

- **Suite completa CON NEON reproducida: 203 archivos / 1584 passed / 0 failed.** Mas
  `typecheck` 3/3, `lint` exit 0, `format:check` OK, `rg MUTATION apps` **vacio**.
- **El barrido del implementador para «ningun test ablandado» NO alcanzaba.** El suyo miraba las
  lineas borradas que contuvieran `expect(`; **eso no caza que a un `toEqual` le saquen una
  clave**, que es justo la forma barata de ablandar una asercion sin borrarla. El orquestador lo
  rehizo sobre **TODAS** las lineas borradas de los `.test.ts` y los `*support*.ts`: las 12
  distintas son andamiaje (dobles de `ownerContext`, dobles de sesion, un seed, un import y un
  comentario). **Cero `expect(...)` eliminados**, y los dos cambios de asercion son **aditivos**
  (`toEqual({error})` → `toEqual({error, code:"not_owner"})`). La conclusion del implementador
  era correcta; su prueba no.
- **DoD reproducido:** `rg PLAN_LOCATION_LIMITS|PLAN_WITH_CAMPAIGNS` vacio · `rg ownerBusiness`
  en `app/api` vacio · **0 `.tsx`** · **0 archivos de wallet/tarjeta** en el diff — o sea que lo
  YA EMITIDO no se toco, que es la decision del owner.
- **La M1 la midio el ORQUESTADOR**, no el implementador: un hook `no-mutations-left.sh` bloqueo
  un turno con la mutacion puesta, asi que se midio ahi (**36 rojos**, asercion
  `expect(response.status).toBe(403)` + `code === "business_suspended"`) y se revirtio (**85/85
  verde**). El implementador la re-midio independiente y le dio **38**. Su copia limpia y la
  reconstruccion del orquestador diferian **solo en el nombre de una variable local**.
- **La ruta del PIN sin gate se verifico leyendola:** contesta **404 `staff_not_found`** si
  `userId !== session.user.id`, o sea que esta auto-acotada. No gatearla es correcto.

**🔵 REVISOR INDEPENDIENTE EN VUELO**, contexto fresco, **presupuesto 4 mutaciones** y condicion
de corte escritos en el encargo. Se le pidio concentrarlo donde el riesgo NO es el rojo sino el
**verde sin oraculo**: las superficies del eje `status` que el implementador NO muto (enroll
publico y consumo del link magico), el contrato contra la realidad (en la 0067 hubo un FAIL por
un `code` declarado que dos rutas no emitian), y los 4 hallazgos de abajo. **La spec NO esta
marcada `implementada`: eso lo decide su PASS.**

### ⚠️ 4 HALLAZGOS: son decisiones del IMPLEMENTADOR, NO del owner

1. **`POST /api/staff/[userId]/pin` sin `requireApiOwner`** — correcto y verificado (ver arriba).
   Consecuencia declarada: un integrante con sesion viva rota su PIN en un negocio `suspended`.
   No acredita, no entra al mostrador y no obtiene sesion nueva.
2. **El motivo viaja como `suspensionReason` (camelCase)**, no `suspension_reason` como lo nombra
   la spec — que es el nombre de la COLUMNA, no el del campo. Declarado en el contrato.
3. **`requireBackofficeSession` devuelve `status`/`suspensionReason` que HOY NO CONSUME NINGUNA
   PANTALLA.** Es andamiaje: o le entra su fila en `TASKS.md`, o se borra. **A DECIDIR.**
4. **Fail-closed ASIMETRICO:** API, mostrador, login y enroll tratan un `status` desconocido como
   `suspended`; el backoffice solo rebota con `closed` exacto, porque es la unica superficie
   donde el owner puede LEER el motivo. **A DECIDIR.**


### ESTADO EN VIVO — LOS 3 PASOS ESCRITOS, GATES VERDES, CERO MUTACIONES VIVAS (2026-09-17)

- `HEAD` = **`5f89d18`**, **nada commiteado**, **ninguna migracion aplicada** (la 0072 no tiene).
- **`rg MUTATION apps` → VACIO.** Las **7 mutaciones del presupuesto estan corridas y
  revertidas**, con shasum limpio, etiqueta, texto de la asercion roja y `diff` de reversion:
  ver la bitacora de mas arriba.
- **Gates completos, Node 24.20.0, con `.env.integration.local` de la RAIZ:**
  `typecheck` **3/3** · `lint` exit 0 · `format:check` OK ·
  `test` **203 archivos / 1584 passed / 0 failed** (baseline al empezar: 199 / 1479) ·
  `build` **3/3**.
- **La matriz `{active, suspended, closed}` SI se ejercito contra base**, en
  `business-status.neon.integration.test.ts` (el `status` se escribe con un `UPDATE`, que es el
  unico mecanismo que hay hoy) y en `magic-link-business-closed.neon.integration.test.ts`.
- **Los 3 pasos internos estan escritos:** la capa de entitlements con sus 3 call-sites
  migrados; `server/api-owner.ts` con sus 4 pasos y sus 12 consumidores; y el eje `status` en
  las 7 superficies de §D4.
- **El ciclo de imports del paso 1 quedo arreglado en su raiz:**
  `server/entitlements/live-subscription.ts` saca `hasLiveSubscription` de `billing/plan-change`,
  asi que la pieza de mas abajo del stack ya no importa un modulo de dominio. `plan-change.ts` lo
  re-exporta, asi que `applicability`, `reconcile`, `view` y `billing/index` no cambian.
- **Entregable de contrato escrito:** `docs/specs/0072-contratos-de-api.md`.
- **22 archivos de test preexistentes modificados, auditados uno por uno.** El barrido decisivo:
  `git diff -U0 -- <los 22> | grep "^-"` **no borra ni una sola linea `expect(...)`** — todo lo
  eliminado son dobles de sesion, dobles de `ownerContext`, declaraciones de tipo y un
  comentario. Las **unicas dos aserciones que cambiaron** son los `toEqual` del cuerpo del 403
  de billing, que pasaron de `{ error }` a `{ error, code: "not_owner" }`: **mas estrictas**, y
  cambian porque el contrato cambio por decision del owner («si a los `code`»).
- **DOS HALLAZGOS A DECIDIR, no decisiones del owner** (detalle en el handoff y en el contrato):
  (1) `POST /api/staff/[userId]/pin` esta en las 33 rutas del DoD pero **no es una superficie
  del owner** —es el integrante cambiando su propio PIN— y gatearla romperia la spec 0067 §4;
  (2) la clave del motivo en el cuerpo viaja como `suspensionReason` (camelCase) y la spec la
  nombra por su columna, `suspension_reason`.
- **Falta el PASS de un revisor independiente.** La spec NO esta marcada `implementada`.

**Las decisiones del owner se pidieron ANTES de la prosa** (ADR 0071 §2) y las contesto el
2026-09-17. **Textual, para que no se reinterprete:**

1. **El lado del CONSUMIDOR de un negocio `closed`: no se apaga nada.** «No necesitas cerrar
   pase ni nada que siga habilitado, nadie podra escanearlo. Y si alguien lo escanea no podra
   dar puntos ni nada porque no sera un scan del local que pueda luego asignar nada al
   programa.» → **pases de Wallet, sellos y tarjeta quedan INTACTOS**; no se contesta `410` en
   el web service de passkit. Eso hace la spec **chica del lado del consumidor**.
2. **No entran limites nuevos al catalogo** («no de momento»), **pero agregar uno tiene que ser
   simple y claro** — requisito suyo, y por eso el catalogo declarativo de §D2.3 con el test
   que pone la suite en rojo si un plan no declara sus limites.
3. **`status` y `plan` NO son el mismo eje** — corrigio la premisa del orquestador: «si yo
   suspendo un comercio no es cambiar de plan es deja de acceder a las funciones, si lo cierro
   no hay ni siquiera login». Y **el caso "bajamos un limite y alguien ya lo excedia" queda
   DIFERIDO** por el: «todavia no esta resuelto esto, cuando lleguemos alli trabajaremos en
   ello». Es el ADR **0073**.

4. **El ALTA NUEVA se corta en los dos estados.** El orquestador le llevo que
   `POST /api/public/enroll/[programId]` no tiene sesion de comercio —es publico, rate limit por
   telefono— asi que el QR pegado en la pared seguia dando de alta gente en un negocio cerrado.
   **Textual: «el alta nueva tambien queda suspendida si el negocio esta suspendido, si esta
   cerrado queda cerrado para altas nuevas».** Con eso **la spec quedo `cerrada`**.

**LA LINEA QUE SEPARA LO QUE ENTRA DE LO QUE NO ES «YA EMITIDO» VS «ALTA NUEVA»**, y NO
«comercio» vs «consumidor». El orquestador la habia trazado mal —de ahi la pregunta de mas— y
queda escrita aca para que la proxima sesion no la vuelva a trazar: pase de Wallet, sellos y
tarjeta son **ya emitido** y no se tocan; el enrolamiento es un **alta nueva** y se corta.

### Lo que se MIDIO al escribirla, y corrige documentos ya escritos

Regla: lo que se le pasa a un subagente como insumo es una afirmacion propia.

- **`billing/plan-change.ts` NO es un call-site divergido.** `TASKS` decia «los 3 call-sites
  viven en `billing/`, `marketing/` y `locations/`»: **importa** `locationLimitForPlan` de
  locations, no lo recopia. El tercer lugar real es `billing/derive-rules.ts:42` (`PAID_PLANS`).
- **Staff y catalogo de productos NO tienen tope por plan** (`rg` sobre `server/staff.ts` y
  `server/catalog/*.ts`: 0 matches). No hay nada que unificar ahi.
- **Las superficies de API sin gate de email son 10, no 9.** La fila 56 de `PARQUEADO` se
  escribio antes de la 0069 y le falta **`api/loyalty-program/qr`**.
- **El refactor es MAS BARATO de lo que decia la fila 56:** `ownerContext` (`server/staff.ts:56`)
  ya es el mismo `innerJoin(businesses)` que comparten 4 de los 6 resolvedores, asi que leer
  `status` es **una columna mas en un join que ya existe**.
- **Cerrar el login NO expulsa a quien ya entro.** `auth.ts` no pisa `session.expiresIn`, asi
  que rige el default de better-auth 1.6.26: **7 dias** (`3600*24*7`, leido en
  `dist/context/create-context.mjs:147` y `dist/db/internal-adapter.mjs:24`). Un staff con la
  sesion viva **acredita hasta una semana** despues del cierre, porque `requireOperator`
  (`api/counter/_auth.ts:14`) no lee `business.status`. Por eso el guard va en CADA superficie.

**Los barridos del DoD se corrieron contra el arbol ANTES de proponer el cierre** (leccion de la
0067). **Uno nacio imposible y se corrigio:** `rg PLAN_LOCATION_LIMITS` no podia dar vacio —
faltaba el barrel `locations/index.ts:12` en la tabla de archivos, y hay un **comentario** en
`billing-plan-change.test.ts:53` que nombra la constante (ese test transcribe el tope a mano a
proposito, `FREE_LIMIT = 1`). Las **33 rutas** del segundo barrido estan contadas, no estimadas.

**→ LO PROXIMO, EN ORDEN:** (1) **implementador despachado** (ADR 0071: UNO para toda la spec,
en los 3 pasos internos de §Handoff). Al volver: **reproducir la señal decisiva** de su informe,
no todas sus mediciones · (2) **UN** revisor independiente en contexto fresco, con el
presupuesto de **7 mutaciones** y la condicion de corte escritos EN EL ENCARGO · (3) solo un
`PASS` verificable permite marcarla `implementada` · (4) anotar `duration_ms`, `tool_uses` y
`subagent_tokens` de cada notificacion para la re-medicion del ADR 0071.

## ⇥ HECHO ESTA SESION — spec 0069, el wizard de alta es API (2026-09-17)

**`docs/specs/0069-el-wizard-de-alta-es-api.md`, estado `cerrada`**, con su fila en `INDEX.md`.
Es la **2a tajada del ADR 0070**. Entrega API y contrato, **cero pantallas** (§16).

**Plantilla elegida MIDIENDO, no por costumbre (ADR 0071):** `TEMPLATE.md`, la larga. Las tres
condiciones de la chica fallan dos: toca **varios dominios** (onboarding, loyalty, imagenes,
brand-kit, location-providers) y **si lleva migracion** (`0035`, la columna de categoria).

**Las tres decisiones de producto las contesto el owner el 2026-09-17, ANTES de escribir la
prosa** (que es justo lo que el ADR 0071 vino a ordenar):

1. **Las 15 categorias `gcid:`** propuestas, tal cual.
2. **Sello placeholder generado por codigo (opcion A):** SVG con la inicial del negocio en
   **negro no puro (`#1A1A1A`)** — textual del owner: «el cuadrado donde se sella siempre es
   blanco, entonces asi sera visible».
3. **QR pelado, no el poster** —en el wizard todavia no hay color ni logo, eso es la parte
   «avanzada» del onboarding— **pero con descarga como imagen**, para que el comerciante lo
   guarde en el telefono hasta imprimirlo o armar el poster despues.

**Tres cosas se MIDIERON y corrigen documentos que ya estaban escritos** (regla: lo que se le
pasa a un subagente como insumo es una afirmacion propia):

- **El ADR 0070 se equivoca con el placeholder.** Dice que alcanza con implementarlo dentro de la
  ruta publica «y lo reciben todos los consumidores sin tocar ninguno». **Falso:**
  `client-view.ts:81-83` devuelve `stampImagePath: null` sin sello, o sea **la URL nunca se
  construye y la ruta nunca se llama**. Escrito solo ahi seria codigo muerto.
- **El ADR 0070 §14 dice que Mexico toca dos listas. Toca UNA:** la segunda
  (`app/onboarding/page.tsx:18`) la **borro la 0067**.
- **`counter/core.ts` NO se toca, y la primera version de la spec lo afirmaba mal.** Su docblock
  dice que `programDTO` expone «only the public stamp path» y **ese campo no existe** en lo que
  devuelve. Queda como hallazgo, no como trabajo.

**Verificado ejecutandolo, no asumido:** `sharp` 0.35.3 (ya es dependencia) rasteriza el SVG del
QR — Node 24.20.0, vips 8.18.3, un SVG de 2.421 bytes → **PNG 1024×1024 de 50.316 bytes**. La
descarga no cuesta una dependencia nueva.

**Los barridos del DoD se corrieron contra el arbol ANTES de cerrar** (leccion de la 0067, que
cerro con cuatro criterios imposibles). **Dos criterios nacieron mal y se corrigieron:** el
conteo de categorias por `rg 'gcid:'` (que tambien cuenta comentarios y el default `gcid:store`,
asi que no puede dar el numero exacto → pasa a ser una asercion del unit), y la afirmacion de que
la 0069 era «la unica spec abierta del INDEX», que es **falsa**: hay tres borradores viejos
(0003, 0007, 0009). Sigue siendo disjunta, pero por el motivo medido — los `archivos` de la 0003
son `packages/**` y **`packages/` no existe** (el workspace es `apps/*`), y la 0007 y la 0009
declaran «rutas concretas por definir». La 0009 ademas es **otro QR**: el fijo por local.

**→ LO PROXIMO, EN ORDEN:**

1. **Esperar al implementador** (despachado en background). Al volver: **reproducir la señal
   decisiva** de su informe, no todas sus mediciones.
2. **UN revisor independiente en contexto fresco**, con presupuesto y condicion de corte escritos.
   Solo un `PASS` verificable permite marcar la spec `implementada`.
3. **Cerrar la re-medicion del ADR 0071** con los numeros reales.

**RE-MEDICION DEL ADR 0071 — en curso.** Baseline a batir, de la spec 0068: implementador paso 1
**18 min / 71 tools / 179k** · revisor **9 / 40 / 106k** · implementador cerrando el FAIL **8 / 18
/ 208k** · paso 2 reanudado **6,8 / 17 / 238k** · revision final **4,4 / 17 / 137k** = **~46 min y
868k tokens** de subagentes. Se anota el `duration_ms`, el `tool_uses` y el `subagent_tokens` de
**cada** notificacion, y **el numero real vuelve al ADR 0071 aunque contradiga la promesa** de
~60 → ~25 min. No cuenta como mejora bajar el tiempo salteando mutaciones o la revision.

### Numeros de la re-medicion, a medida que llegan (2026-09-17)

| Etapa | Tiempo | Tools | Tokens |
|---|---|---|---|
| **Implementador 0069** (toda la spec, un solo agente) | **29,1 min** | **141** | **316k** |
| **Revisor 0069** (PASS de primera, sin ciclo de FAIL) | **11,2 min** | **59** | **183k** |
| **TOTAL 0069** | **40,3 min** | **200** | **498k** |

**Contra el baseline de la 0068** (que fueron CINCO despachos: implementador, revisor,
implementador cerrando el FAIL, implementador reanudado, revision final): **~46 min y 868k**.
El implementador solo de la 0069 hizo **toda** la spec —15 archivos, migracion, 5 mutaciones
ejecutadas y el contrato— en **29,1 min y 316k**, o sea **~64% de los tokens del arco 0068
completo en UN despacho**. El numero final se escribe cuando cierre el revisor, y **va al ADR
0071 aunque contradiga la promesa**.

**Gates REPRODUCIDOS por el orquestador** (no citados del agente, regla de la señal decisiva):
`typecheck --force` 3/3 sin cache · `lint` exit 0 · `format:check` OK · `test` **1088 passed / 0
failed** · `test` con `.env.integration.local` (esta en la RAIZ del repo) **199 files, 1478
passed / 0 failed** en 174 s · `build --force` 3/3 sin cache · `rg MUTATION` **vacio** · **cero
`.tsx` tocados**.

**Los dos tests preexistentes que el implementador modifico fueron auditados por el orquestador
y son legitimos:** pinneaban exactamente lo que la §D5 cambia a proposito, y las aserciones
nuevas son **mas fuertes** —`loyalty-program.test.ts` pasa de `null` a la ruta exacta y conserva
el `not.toHaveProperty('stampImageObjectKey')`; el `.neon` **agrega** la asercion de que una
version que no matchea sigue dando `null`—. No es un test ablandado para que pase un gate.

## ⇥ ANDAMIAJE CON SU TAREA: `core.business.status` migrado SOLO (2026-09-17)

**La columna esta en produccion. La feature NO existe.** Esta fila es la que la va a consumir, y
es lo que autoriza que el esquema se haya aplicado sin su spec (regla de «nada de andamiaje sin su
tarea»): **si esta fila se borra sin implementarse, la columna se borra con ella.**

**Los tres estados los dicto el owner el 2026-09-17, textual:**

- `active` — opera normal.
- **`suspended`** — «el staff no puede loguearse, el owner puede loguearse y ver un mensaje de
  cuenta suspendida con su razon y boton de contacto. Es decir que toda la plataforma quedara
  inusable, no pueden escanear, no pueden asignar puntos, sellos, cambios en programa, marca, etc.
  Nada».
- **`closed`** — «ni staff ni owner puede hacer nada, el negocio queda cerrado, **ni siquiera
  admite login**».

**Migracion `0036` aplicada a produccion y VERIFICADA POR SQL** (36 → 37): `status` `NOT NULL
DEFAULT 'active'`, `suspension_reason` y `status_changed_at` nullables, y
`CHECK (status IN ('active','suspended','closed'))`. Semillas de terminos intactas.
**La rama de integracion tambien quedo migrada** — sin eso la suite tira **123 fallos** que son un
`42703 column "status" of relation "business" does not exist`, o sea algo que **parece un bug de
codigo y es una migracion pendiente**. Con la rama migrada: **1479 passed / 0 failed**.

**⚠️ LO QUE FALTA, Y ES TODO EL TRABAJO — NINGUN GUARD LEE ESA COLUMNA.** Hoy un negocio
`suspended` esta suspendido en la base y **plenamente operativo en la app**. Para volverlo real
hay que gatear:

1. **El login**, que es lo que el owner puso primero: el estado se lee en `auth/start`, en el
   consumo del link magico y en el PIN del staff. **Eso toca superficie de la spec 0067, ya
   implementada** — no es terreno virgen.
2. **Las 11 superficies de API del owner** (las mismas de `PARQUEADO` fila 56: conviene hacerlas
   juntas, es el mismo `requireApiOwner`).
3. **El mostrador** (`api/counter/{grant,redeem,coupon-redeem,resolve}`).

**Quien ESCRIBE el estado: diferido por el owner** a «las API de admin de CheckPass.club», que no
existen (`apps/platform` tiene una sola ruta, `/api/health`). Por ahora, `UPDATE` a mano.

**Lo que el owner NO dijo y por lo tanto NO es decision suya:** que pasa del lado del **CONSUMIDOR**
de un negocio `closed` —los pases de Wallet ya emitidos, los sellos acumulados, el QR de
enrolamiento que sigue circulando—. Se le pregunto y su respuesta describio la superficie del
**comercio**. Es la decision que abre la 3ª spec.

## ⇥ EN PRODUCCION (2026-09-17) — commits `fde3757` + `34cb98b`

**Autorizado por el owner.** Estado verificado, no asumido:

- **Commit `fde3757`** (la 0069, 36 archivos) y **`34cb98b`** (el fix del fixture de marketing),
  los dos **pusheados**: `git rev-parse HEAD` == `origin/main`.
- **MIGRACION 0035 APLICADA A PRODUCCION.** Proyecto `mi-pasaporte`, rama **`main` =
  `br-curly-silence-ax8acywm`** (la `default`, **confirmada por API antes de tocar nada**).
  **Verificado por SQL, no por el mensaje de `drizzle-kit`:** migraciones **35 → 36**,
  `core.business.category_gcid` existe como `text NOT NULL DEFAULT 'gcid:store'`, y las **3
  semillas** de `core.terms_template` intactas (son las que el wizard usa como terminos).
  La `0035` es **un solo `ALTER TABLE ADD COLUMN`**: no crea ni borra tablas.
- **Se migro ANTES de pushear, a proposito.** Vercel despliega con el push y el codigo nuevo lee
  esa columna; al reves habria una ventana con produccion tirando `42703`.
- **Vercel: `success`** para `fde3757`.
- **Las rutas nuevas responden en produccion**, probadas por HTTP contra `www.` (el apex hace
  308): `/api/onboarding/prefill` → **401 `{"code":"unauthorized"}`**, `/api/loyalty-program/qr`
  → **401 `{"code":"unauthorized"}`**, `/api/onboarding/program` → **405** en GET (es POST-only).
  Los tres codigos son **los que declara el contrato**.

**El contrato para la UI esta pusheado: `docs/specs/0069-contratos-de-api.md`.**

**CI VERDE, LEIDA DE `/check-runs` PARA EL SHA EXACTO `34cb98b`** (nunca `/status`, que aca
miente): `verify: completed -> success`, `total: 1`, **`no-success: 0`**. Los **18 pasos** en
`success`, leidos uno por uno — incluidos **«Migrar la rama Neon de CI»** (la `0035` aplica
limpia) y **«Unit + integracion Neon»**.

**Eso cierra el unico riesgo que quedaba declarado de la 0069:** el test del glifo del sello
placeholder mide pixeles opacos y se escribio en macOS; se declaro «pendiente de la primera
corrida de CI» por si en Linux faltaban fuentes. **Corrio en Linux y paso.**

### La CI se puso ROJA y NO era la 0069 — era una bomba de tiempo

7 archivos `.neon` de **marketing** rojos en un commit que no toca marketing. **No era una
regresion.** `createCampaign` (`marketing-integration-support.ts:78`) defaulteaba `startsAt` a
`Date.now() - 24 h` —**reloj real**— mientras esos tests corren el tick con un `NOW` **fijado** en
`2026-09-16T12:00:00Z`. Pasadas 24 h del `NOW` fijado, la campaña «todavia no empezo» y el tick
devuelve `{campaigns: 0, enqueued: 0}`. **Detono a las 12:00 UTC del 2026-09-17 y habria puesto
roja la CI de cualquier commit.**

**La prueba decisiva:** `marketing-tick.neon` **paso** en local a las 08:17 UTC y **fallo** en
local a las 14:18 UTC del mismo dia, **sobre el mismo arbol, sin un cambio de codigo**. La
variable era el reloj. El re-run del job fallo **identico** (determinista, no flake), y `rg` no
encuentra **un solo import** de lo que toco la 0069 dentro de `marketing/`.

**Arreglado en `34cb98b`**: el default pasa a un instante fijo anterior a cualquier `NOW` de la
suite. Verificado **26 h despues del `NOW` fijado** —la condicion exacta que los rompia—: los 7
archivos **7/7 y 31 tests**, la suite completa **1479 passed / 0 failed**, typecheck/lint/format/
build verdes sin cache. **El caso completo esta en `docs/LECCIONES.md`.**

## ⇥ LA SPEC 0069 ESTA `implementada` — PASS de revisor independiente (2026-09-17)

**PASS**, con 3 hallazgos declarados y **ninguno bloqueante**. Un solo ciclo: el revisor no
abrio FAIL. La condicion de corte no se aplico (ninguna vuelta termino en «el fix abrio la
siguiente»).

**Gates finales, corridos por el orquestador DESPUES de sus propios cambios** (el PASS del
revisor no cubria lo que el orquestador toco despues): `typecheck --force` 3/3 sin cache ·
`lint` exit 0 · `format:check` OK · **`test` con Neon: 199 files, 1479 passed / 0 failed** ·
`build --force` 3/3 sin cache · `rg MUTATION` **vacio** · **cero `.tsx`**.

### Lo que el revisor cazo y el orquestador ARREGLO (con su mutacion propia)

**El filtro por `(businessId, programId)` de la ruta publica del sello NO tenia oraculo.** El
revisor quito ese `eq()` y **23 tests pasaron igual**: un negocio podia leer el sello de otro y
la suite no lo veia. El orquestador agrego el test de aislamiento en
`loyalty-stamp-placeholder.neon.integration.test.ts` y **probo que muerde** con la mutacion
**O1** (`stamp.ts`, shasum limpio `37379485f888a7943003b390b0a964e5d9de5fd0`): rojo
**`AssertionError: expected { kind: 'stamp', …(1) } to be null`**, y **un solo test rojo**, lo
que confirma que nada mas lo cubria. Revertida con `diff` vacio y shasum coincidente.

**El docblock de `brand-kit/qr.ts` afirmaba lo contrario de lo medido, y se corrigio el CODIGO,
no solo el comentario.** Decia que el `density: 600` «evita el borde dentado». **Medido por el
orquestador** sobre el SVG de un enroll real (`viewBox 0 0 47 47`): `sharp` rasteriza el vector
**directo al tamaño del `resize`**, asi que fijarle `density` lo obliga a rasterizar a 392×392 y
despues **agrandar**, que es lo que introduce el dentado. **Sin `density`: 0 pixeles intermedios
en 24.407 bytes. Con `density: 600`: 38.273 pixeles intermedios en 42.557 bytes.** Se quito la
opcion: el QR que el comerciante imprime sale mas nitido y **~40% mas liviano**.

### DECIDIDOS POR EL OWNER el 2026-09-17 — ya no son hallazgos

1. **El `accrual` del wizard queda en `{ per_purchase, grant: 1 }`** («un sello por visita»).
   **Decision del owner, textual: «accrual lo dejamos como esta».** Lo habia elegido el
   implementador y se le llevo como hallazgo; ahora es decision suya. Sigue siendo **editable**
   desde el editor de programa de siempre (`saveProgram` reescribe la mecanica en cada guardado),
   asi que el wizard fija un punto de partida, no algo permanente.
2. **El sello placeholder queda como se implemento**, y eso incluye que se vea en **TRES**
   pantallas, una de ellas **del consumidor**: con `stampImagePath` siempre no nulo,
   `card-preview.tsx:46` renderiza la inicial donde antes el slot quedaba vacio, y eso alcanza
   `steps/step-review.tsx`, `steps/step-card-design.tsx` y **`app/(consumer)/wallet/
   program-card.tsx:39`, la tarjeta del cliente final**. Se le mostro al owner la tercera —que la
   lista del implementador omitia y cazo el revisor— y respondio: **«sello placeholder dejalo
   como lo implementaste»**. Decision suya, con el efecto en la tarjeta del consumidor a la
   vista.
3. **`POST /api/onboarding/business` responde sin `code`**, contra la convencion del contrato
   0067 («todo error responde `{error, code}`»). Se dejo como estaba; el contrato lo **declara
   como estado actual**. Candidato a `PARQUEADO` fila 56.
4. **Esa misma ruta con cuerpo no-JSON revienta en 500 sin `code`** (el `request.json()` esta
   fuera del `try`). Hay un test que lo pinnea **como limite** para que el dia que se arregle se
   ponga rojo. **Matiz del revisor:** ese test usa `rejects.toThrow()` sin matcher, asi que
   tambien pasaria si rechazara por otro motivo.
5. **`counter/core.ts:167-169` sigue mintiendo:** su docblock dice que `programDTO` expone «only
   the public stamp path» y ese campo **no existe** en lo que devuelve. Declarado fuera de
   alcance en la spec.
6. **El split de `schema/billing.ts`** (el hook `file-size` corta en 300 y `business.ts` llegaba
   a 308) **no estaba en la tabla de archivos de la spec**. El revisor verifico por `diff` que
   es un **movimiento puro**, sin cambio semantico, y que el barrel re-exporta.

### Declarado y NO perseguido (intentado antes de declararse)

- **`?v=00` es alias de `?v=0`** (el guard es `/^[0-9]+$/` + `Number()`): mismo contenido bajo
  claves de cache distintas. No es fuga ni 404 indebido — desperdicio de cache.
- **`403 not_owner` / `503 qr_unavailable` y los 403/409/503 del programa no tienen test.**
  Verificados leyendo los sitios de `throw` alcanzables y el mapeo de `codeForStatus`;
  ejercitarlos pedia un owner sin negocio y una inyeccion de falla de base — fuera del
  presupuesto de 4 mutaciones.
- **La precedencia del 400 de categoria** que afirma el contrato §2 es cierta en el codigo pero
  no tiene oraculo.
- **El rasterizado del glifo del placeholder** se midio en macOS; el test asevera un piso de 1%
  y un techo de 50% de pixeles opacos, asi que **si en CI (Linux) faltaran fuentes ese test es
  ROJO y no un falso verde**. Pendiente de la primera corrida de CI, no declarado imposible.

### Lo que FALTA y es paso del orquestador, no del agente

- **La migracion `0035` esta aplicada SOLO en la rama de integracion** (`br-shy-king-axu5s3ze`).
  **Produccion NO se toco.** Aplicarla es paso posterior al commit, y se confirma con el owner.
- **Verificar la CI con `/check-runs`** —nunca con `/status`, que en este repo miente— para el
  sha exacto, despues del push.

~~**SIN COMMITEAR**~~ → **TODO COMMITEADO Y PUSHEADO** (2026-09-17, autorizado por el owner).
Los 36 archivos de la 0069 entraron en **`fde3757`**; despues vinieron `34cb98b` (el fix de la
bomba de tiempo), `785605f` (docs), `cd952d1` (decisiones del owner) y `08227ed` (la migracion
`0036`). **`git status --short | wc -l` → 0** y `HEAD` == `origin/main` en **`08227ed`**.

---

**Lo anterior al arco 2 esta detallado abajo, en «ARRANCA ACA LA SESION QUE SIGUE».**

**→ LA SPEC 0067 ESTA `implementada`** (2026-09-17): **cuatro pasos, cuatro `PASS`** de revisor
independiente, cada uno en contexto fresco. **Nada esta commiteado ni pusheado: eso lo autoriza el
owner.**

**COMMITEADA Y PUSHEADA el 2026-09-17** — commit `9086c9a`, autorizado por el owner. **Verificado
con `git rev-parse HEAD` y `git rev-parse origin/main` dando el MISMO sha**, no por asumirlo (esta
cabecera ya mintio dos veces en sesiones anteriores). 91 archivos, +24.149 / -2.747.

**→ EL PROCESO CAMBIO: ADR 0071, aceptado por el owner el 2026-09-17.** Spec chica
(`docs/specs/TEMPLATE-CHICA.md`, nuevo) para cambios de **un dominio, sin migraciones y sin
decision de producto abierta**; decisiones del owner **antes** de la prosa; **UN implementador y
UN revisor por spec**, no por paso; filas de `INDEX` de **3 lineas**; **gates completos una vez
por spec**. `CLAUDE.md` puntos 2, 4 y 7 actualizados. **No se toco el protocolo de mutaciones ni
la revision independiente**: en esta misma spec el revisor cazo un oraculo inexistente y la fuga
sobrevivia a 1027 tests. El ADR lleva los numeros medidos y **se re-mide contra la proxima spec
chica**.

**El paso 2 NO lleva spec nueva**: ya es el §4 de la 0068, `cerrada`. Escribir otra seria la
duplicacion que el 0071 vino a cortar. La plantilla chica estrena en el proximo trabajo nuevo.

**→ LA SPEC 0068 ESTA `implementada` (2026-09-17), con `PASS` de revisor independiente sobre la
spec ENTERA.** Entregado: `GET /api/staff`, `email` fuera del `StaffDTO`, `requireStaffOwner`
adentro del `try` en 4 rutas, el borrado de `emailOTP`, y en el contrato `§2-bis`, `§4-bis` y los
oraculos por superficie. **Nada commiteado: eso lo autoriza el owner.**

**Gates corridos por el ORQUESTADOR sobre el estado final** (cadena con `&&`, o sea exit 0 en cada
paso): `typecheck --force` · `lint` · `format:check` · `test` **1018 passed / 355 skipped / 0
failed** · `build --force` · `rg -n MUTATION apps tools` **vacio**. Los dos barridos del DoD, exit
1. Integracion del revisor: **8 archivos / 53 tests / 0 failed**, incluidos `magic-link.neon` y
`auth-start.neon` (sacar `emailOTP` no toco el link magico).

**14 mutaciones en total, ninguna sobrevivio sin explicacion**: 6 del implementador, 5 del revisor,
3 del orquestador. Las dos que valieron el ciclo:

- **El `FAIL`**: el DoD pedia un oraculo contra la fuga del email sintetico y **no existia** para
  `…/pin/regenerate` ni `…/status`. La fuga escrita **por fuera** de `toStaffDTO`
  (`{...toStaffDTO(…), email}`) pasaba `typecheck`, **1027 tests** y los 4 `.neon` — TypeScript
  rechaza el exceso de propiedades pero **no** el spread. Cerrado con
  `staff-status.neon.integration.test.ts` (nuevo) y +5 lineas en `staff-pin-change.neon`.
- **El oraculo que iba a quedar VACUO**: sin el plugin, los 9 paths de `emailOTP` dan 404 **por
  inexistentes**, asi que el test viejo seguia verde sin probar nada. Se mudo a
  `Object.keys(auth.api)`; reponer el plugin lo pone rojo **por la clave**
  (`to not include 'signInEmailOTP'`), y el revisor probo ademas que los 2 `disabledPaths` que
  quedan son guard vivo (sin la entrada, el path da **500**, no 404).

**PRIMERA MEDICION DEL ADR 0071:** paso 1 **18 min** (implementador fresco) → paso 2 **6,8 min**
(mismo implementador **reanudado**, sin re-leer el repo) → revision final **4,4 min**. La palanca
grande es el contexto, no los comandos.

**COMMITEADA Y PUSHEADA el 2026-09-17** — commit **`a0f66ea`**, autorizado por el owner. 26
archivos, +1.528 / −190. **Verificado con `git rev-parse HEAD` y `git rev-parse origin/main` dando
el MISMO sha**, no por asumirlo.

**CI VERDE, VERIFICADA CON `/check-runs` (2026-09-17).** Sha `a0f66ea`: **`verify: completed ->
success`**, `total checks: 1`, **`no-success: 0`**. Pasos leidos uno por uno del job
`105111713508`: `lint`, `typecheck`, **«La integracion Neon tiene que correr, no skipearse»**,
**«Migrar la rama Neon de CI»**, `Unit + integracion Neon`, `playwright install`, `test:e2e`,
`build`, `format:check` — **los 18 en `success`**. Nunca se uso `/status`, que aca miente.

**→ PRODUCCION LIMPIADA Y MIGRADA (2026-09-17), ejecutado por el agente via MCP de Neon.**

**Objetivo confirmado con el owner en el momento, no solo el permiso:** proyecto `mi-pasaporte`
(`red-violet-38772073`), rama **`main` = `br-curly-silence-ax8acywm`**, la `default`/`primary`.
**NO** se toco ninguna rama de integracion.

**Dos hallazgos que se midieron ANTES de truncar, y que el owner decidio:**

1. **Habia 4 suscripciones de Stripe VIVAS** en la base (`plan: plus`, `status: active`, con
   `customer` y `subscription` id): A1, A3 Test ×2 y Negocio B. **El owner dijo «elimina, no te
   preocupes por Stripe»** — asi que los ids se perdieron con el truncate. Si alguna seguia viva
   del lado de Stripe, sus webhooks llegan sin fila que matchee. **CERRADO por el owner el
   2026-09-17: «olvidate de las suscripciones, es sandbox».** No es deuda y no vuelve a listarse
   — no hay facturacion real que perseguir.
2. **`core.terms_template` no es dato de prueba: es SEMILLA**, insertada por la migracion
   `0004_polite_turbo.sql:97`. Truncarla la borraba **para siempre** (esa migracion ya figura
   aplicada, `db:migrate` no la re-ejecuta) y `GET /api/loyalty-terms/templates` habria quedado
   devolviendo `[]`. **El owner eligio EXCLUIRLA del truncate.** Verificado antes de ejecutar que
   la exclusion es efectiva: **`terms_template` no tiene NINGUNA FK** —ni entrante ni saliente—,
   asi que el `CASCADE` no podia alcanzarla.

**Ejecutado:** `TRUNCATE` de `core.*` + `merchant_auth.*` menos `core.terms_template`, con
`RESTART IDENTITY CASCADE`. **Verificado por SQL:** las 2 tablas de `merchant_auth` y las 28 de
`core` en **0 filas**; `core.terms_template` con sus **3** semillas.

**Migraciones aplicadas a PRODUCCION con `drizzle-kit migrate`** (no con SQL crudo, para que el
journal no quede mintiendo): **32 → 35**. Verificado por SQL, no por el mensaje de la herramienta:
`merchant_auth.password_reset_attempt` **ya no existe** (0033), `merchant_auth.auth_start_attempt`
**existe** (0034), `core.business.slug` **existe** y `core.business_membership.pin_hash`
**existe** (0032).

**`consumer.*` TAMBIEN TRUNCADO, por decision del owner (2026-09-17).** El script acordado
alcanzaba solo `core.*` + `merchant_auth.*`, y 7 tablas de `consumer` habian quedado con filas
porque **no tienen FK a lo truncado** (el `CASCADE` no las alcanzaba): eran identidades de
consumidor y pases de Wallet apuntando a programas ya inexistentes. Se verifico antes de ejecutar,
con la misma diligencia que cazo `terms_template`, que **ninguna migracion siembra datos en
`consumer.*`** (`rg 'INSERT INTO "consumer"' drizzle/*.sql` → vacio), asi que no habia semillas que
perder.

**ESTADO FINAL DE PRODUCCION, verificado por SQL:** de las 43 tablas de `core`, `merchant_auth` y
`consumer`, **la unica con filas es `core.terms_template` (3 semillas)**. Todo lo demas en **0**.

**LAS RAMAS DE NEON: NINGUNA ESTA SIN USO, asi que no se borro ninguna.** Medido: `ci-integration`
(`br-icy-hat-axsfqc8k`) es la que uso la CI verde de `a0f66ea` hace minutos, y
`spec-0065-marketing` (`br-shy-king-axu5s3ze`) es a la que apunta `.env.integration.local`, o sea
**toda la suite `.neon` local**. Borrar cualquiera rompe CI o los tests de integracion. La segunda
tiene TTL hasta **2026-10-15**.

## ⇥ ARRANCA ACA LA SESION QUE SIGUE (handoff del 2026-09-17, post-`/clear`)

**Todo lo anterior esta CERRADO y verificado.** Commit `a0f66ea` pusheado (HEAD == origin/main),
**CI verde leida de `/check-runs`** (`verify: completed -> success`, 18 pasos en `success`),
**produccion limpia y migrada a 35**. Lo unico sin commitear es este `docs/TASKS.md`.

### Lo que hay que hacer: el ARCO 2 (2ª spec del ADR 0070)

**ES API, NO PANTALLA. Confirmado con el owner el 2026-09-17** y es textual del ADR 0070 §16: «la
UI la construye el owner por fuera, con ChatGPT, asi que lo que se construye aca es la capa de
logica y los endpoints». El nombre del ADR —«el wizard de 3 pantallas»— engaña: lo que se entrega
son **los endpoints que esas 3 pantallas consumen** mas **el contrato HTTP escrito** (forma de
`0067-contratos-de-api.md`). Una spec de este arco que liste un archivo de pantalla como «crear»
esta mal alcanzada.

**Contenido segun el corte de 4 specs ya confirmado:** logica de pantallas 2 y 3, categoria
`gcid:`, paises + Mexico, sello placeholder, programa activo, y **el QR**. Consume `server/slug.ts`
y la migracion del `slug`, **ya aplicadas en produccion**.

**Plantilla:** evaluar contra las tres condiciones del ADR 0071 (un dominio, sin migraciones, sin
decision de producto abierta). **Probablemente NO califique** —toca varios dominios y puede pedir
esquema—, o sea `TEMPLATE.md`. **Decidirlo midiendo, no por costumbre.**

### Y LA RE-MEDICION DEL ADR 0071 — el owner la pidio explicitamente contra ESTE arco

El ADR 0071 promete **de ~60 min a ~25** y se cerro con la condicion escrita de re-medirse. **Como
se mide, para que la comparacion sea honesta:**

**Baseline de la spec 0068** (lo que hay que batir): implementador paso 1 **18 min / 71 tools /
179k tokens** · revisor **9 min / 40 / 106k** · implementador cerrando el FAIL **8 min / 18 /
208k** · paso 2 con el implementador **reanudado** **6,8 min / 17 / 238k** · revision final **4,4
min / 17 / 137k**. **Total subagentes ~46 min y 868k tokens**, mas la orquestacion.

**Que anotar en el arco 2:** el `duration_ms`, el `tool_uses` y el `subagent_tokens` que devuelve
**cada** notificacion de subagente, y cuantos ciclos hubo. **Comparar contra el baseline de arriba
y escribir el numero REAL en el ADR 0071**, aunque contradiga la promesa. Si no bajo, el ADR se
corrige con lo medido — un ADR que promete y no se re-mide es exactamente la clase de afirmacion
sin verificar que este repo persigue.

**Lo que NO cuenta como mejora:** bajar el tiempo salteando mutaciones o la revision independiente.
En la 0068 el revisor cazo un oraculo que no existia y la fuga sobrevivia a 1027 tests; ese ciclo
**se paga**.

### Deuda viva, por si aparece en el camino

- **`PARQUEADO.md` fila 56** — el gate de email verificado cubre **2 superficies de API de 11**.
  Mientras viva, un owner sin verificar crea sucursales, sube marca, arma campañas y **abre un
  checkout de Stripe**. Las decisiones de contenido ya estan tomadas; falta el cuando.
- **`PARQUEADO.md` fila 57** — `core.business.status` no existe; pedido del owner para la 3ª spec.
- ~~**Stripe**~~ — **CERRADO el 2026-09-17, no es deuda.** El owner: «olvidate de las
  suscripciones, es sandbox». Las 4 suscripciones truncadas eran de prueba: no hay facturacion
  real. **No re-listar.**
- **Las ramas de Neon no se borraron porque ninguna esta sin uso** (ver arriba). Lo que tiene
  sentido es **renombrar** `spec-0065-marketing`, no borrarla.

## ⇥ HANDOFF 2026-09-17 — LO QUE HACE LA SESION QUE VIENE, EN ORDEN

**La 0067 esta CERRADA del todo**: `implementada`, commit `9086c9a` pusheado, **CI verde verificado
con `/check-runs`** (el paso «Migrar la rama Neon de CI» incluido: las tres migraciones aplicaron
limpias). No hay nada a medias de ese arco.

**El owner dio estas tres instrucciones el 2026-09-17. Estan en orden y no hay que repreguntarlas:**

### 1. HECHO — la spec 0068 esta `cerrada` (2026-09-17)

`docs/specs/0068-cierre-de-la-api-de-identidad.md`, con su fila en `docs/INDEX.md`. **Nada de
codigo escrito todavia**: lo que hay es la spec.

**Las cuatro decisiones que la bloqueaban las contesto el owner el 2026-09-17:**

1. **Alcance recortado a staff.** Palabras del owner: «como estamos en proceso de reconversion
   todo a API diferentes, mas seguras, yo tocaria solo lo que faltaba de staff para completar lo
   que faltaba del arco 1». → **el gate de email en las otras 9 superficies SALE de la spec** y
   vive en `docs/PARQUEADO.md` **fila 56**, con sus dos decisiones de contenido **ya tomadas**
   (si al `status='active'`, si a los `code` en 401/403): lo unico que falta es cuando.
2. **`email` sale del `StaffDTO`.** Confirmado.
3. **Negocio con `status` + suscripcion `free` de base.** Medido, y son dos cosas distintas: la
   **suscripcion free YA existe** en toda alta (`api/onboarding/business/route.ts:155` inserta
   `plan:'free'`, `status:'active'`), y **`core.business.status` NO existe** — los `status` del
   esquema son los de `business_membership`, `location` y `subscription`. Es esquema nuevo, la
   0068 no toca esquema → `PARQUEADO.md` **fila 57**, para la **3ª spec** (entitlements).
4. **`code` en los 401/403.** Confirmado; aplica a las superficies parqueadas en la fila 56.

**Lo que la re-medicion corrigio de lo que decia este archivo** (regla: lo que se le pasa a un
subagente como insumo es una afirmacion propia, y se re-mide antes de despachar):

- **Las superficies de API del owner son 11, no 6.** Las 6 del encargo eran `api/staff/*`, el
  `PATCH` del slug, `api/billing`, `api/locations`, `api/marketing` y `api/catalog`. **Las 5 que
  faltaban**: `api/brand`, `api/brand/logo-upload` (que **ni siquiera resuelve owner**: solo
  sesion), `api/loyalty-program`, `api/loyalty-program/stamp-upload` y `api/loyalty-terms/templates`.
- **Hallazgo nuevo, no estaba en ningun doc:** los tres `ownerBusiness` (`brand.ts:32`,
  `catalog/core.ts:73`, `loyalty-program.ts:51`) **no filtran `memberships.status='active'`**, que
  `ownerContext` si filtra, y loyalty ordena `desc` donde los otros ordenan `asc`. Es la deriva
  que el docblock de `locations/_auth.ts:8` decia estar evitando.
- **El contrato ya MIENTE hoy**: sus «Convenciones» declaran que las cuatro rutas de staff
  envuelven «todo lo que toca la base, incluida la resolucion de la sesion», y en **4** de ellas
  el guard esta fuera del `try`. Arreglarlo es lo que vuelve cierto al documento.

**Sondas ejecutadas** (archivo temporal de vitest, **borrado**, `git status` limpio):
`Object.keys(auth.api)` da **44** endpoints con `emailOTP` puesto, incluidos `signInEmailOTP` y
`sendVerificationOTP` — por eso el oraculo del punto (4) se asevera sobre la instancia en vez de
sobre un 404 que quedaria vacuo. Y los **endpoints core de password** de better-auth siguen
montados: `request-password-reset` → **400 `RESET_PASSWORD_DISABLED`**, `reset-password` y
`change-password` → 400 de validacion, `set-password` → 404. Ninguno autentica: **declarado
afuera de alcance**.

**Los barridos del DoD se corrieron contra el arbol ANTES de cerrar** (leccion de la 0067, que
cerro con cuatro criterios imposibles): dos nacieron mal y se corrigieron — el conteo de archivos
de un barrido, y un `rg` sobre el contrato que **no puede dar cero** porque la palabra `email`
tambien esta en el cuerpo de `auth/start`.

### 1-bis. El encargo original del owner, para referencia — tres puntos, un solo dominio

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

### ~~Sin commitear al cerrar esta sesion~~ → YA COMMITEADO (`b2fef3d`, 2026-09-17)

Los 3 archivos de documentacion (`CLAUDE.md` con la correccion de `/status` → `/check-runs`,
`docs/LECCIONES.md` y `docs/TASKS.md`) entraron en el commit **`b2fef3d`**, que **esta pusheado**:
`git rev-parse HEAD` y `git rev-parse origin/main` dan el mismo sha (verificado el 2026-09-17, no
asumido).

**Lo que hay sin commitear AHORA (2026-09-17, sesion de la 0068) son 4 archivos, todo
documentacion:** `docs/specs/0068-cierre-de-la-api-de-identidad.md` (nuevo), `docs/INDEX.md` (su
fila), `docs/PARQUEADO.md` (filas 56 y 57) y este `docs/TASKS.md`. **El owner no autorizo ese
commit todavia.**

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
| **0069** | **El wizard de 3 pantallas + el QR** — logica de pantallas 2 y 3, categoria `gcid:`, paises + Mexico, sello placeholder, programa activo | **`implementada`, PASS de revisor, EN PRODUCCION** (2026-09-17) |
| **0072** | **Capa de entitlements** — `can()` / `limitOf()`, migrar los 3 call-sites que ya divergieron | **`implementada`, PASS de revisor, EN PRODUCCION** (`0507cf5`, CI verde 2026-09-18) |
| 4ª | **Onboarding derivado** — checklist calculado de los hechos de la base, sin columna `onboarding_step` | **no existe. DIFERIDA sin fecha** el 2026-09-18 — ver §«LA 4ª SPEC» |

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
- **Aquellos 3 archivos de documentacion YA se commitearon** en `b2fef3d`, pusheado (HEAD ==
  origin/main, verificado). **Lo que queda sin commitear hoy** son 4, todos documentacion: la spec
  0068, su fila en `docs/INDEX.md`, las filas 56 y 57 de `docs/PARQUEADO.md` y este
  `docs/TASKS.md` — **el owner no autorizo ese commit todavia**.
- **El arbol de codigo esta LIMPIO**: la sesion de la 0068 **no toco una sola linea de
  `apps/`**. La unica sonda que se corrio (`Object.keys(auth.api)` y los 4 endpoints core de
  password) vivio en un archivo temporal que **se borro**, verificado con `git status` vacio.
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

## ⇥ BITACORA DE MUTACIONES — SPEC 0069 (abierta 2026-09-17, ANTES de medir)

**Punto de retorno.** Copia limpia de cada archivo en `/tmp/clean-*.ts`. Si una mutacion queda
viva: `cp /tmp/clean-<x>.ts <archivo>` y verificar el `shasum` de abajo. **`qr/route.ts` es `??`
(sin commitear): `git checkout` NO lo salva, solo la copia de `/tmp`.**

| # | Archivo | `shasum` limpio | Invariante que ataca | Alcance de la medicion | Resultado EJECUTADO |
|---|---|---|---|---|---|
| 1 | `apps/merchant/src/app/api/onboarding/business/route.ts` | `95637e027dc54283f3feaa6a40980370bb01fb80` | la categoria del alta se valida contra la lista curada (`isBusinessCategory`) | `onboarding-business.neon.integration.test.ts` | **ROJO** — «una categoria fuera de la lista ("gcid:inventado") responde 400 y no escribe nada»: `AssertionError: expected 201 to be 400`. Verificado ademas por SQL: la corrida mutada dejo una fila `core.business` con `category_gcid = 'gcid:inventado'` (huerfana, borrada despues). 10 failed / 1 passed — las otras 9 son COLATERAL del «un negocio por owner» (409) y no se arreglaron |
| 2 | `apps/merchant/src/server/loyalty-program/client-view.ts` | `d23d6846c78b421e104f87b7dcc4bb8b4afe0161` | `stampImagePath` se emite SIEMPRE, con sello o sin el (si no, el placeholder es codigo muerto) | `loyalty-client-view.test.ts`, `loyalty-program.test.ts`, `loyalty-stamp-placeholder.neon` | **ROJO 5 tests / 18 passed**: «un programa SIN sello expone un path NO nulo» y «un sello REMOVIDO … usa su version» (`expected null to be '/api/public/loyalty/…'`), «el consumidor hereda el path del sello» (idem — o sea que la propagacion a `consumer/programs.ts` esta cubierta), `loyalty-program.test.ts > never serializes the internal stamp key` y el `.neon` «el programa SIN sello expone un stampImagePath no nulo» |
| 3 | `apps/merchant/src/server/loyalty-program/stamp.ts` | `37379485f888a7943003b390b0a964e5d9de5fd0` | una version que NO matchea es 404, nunca placeholder (un sello real no puede verse tapado por la letra) | `loyalty-stamp-placeholder.neon`, `loyalty-stamp.neon` | **ROJO 3 tests / 5 passed**: «con un sello puesto > una version VIEJA sigue siendo 404, NO el placeholder» (`expected { kind: 'placeholder', …(1) } to be null`), «sin sello, una version que no es la vigente ya es 404» (`expected 200 to be 404` — el status de la RUTA) y el `loyalty-stamp.neon` heredado |
| 4 | `apps/merchant/src/app/api/public/loyalty/[businessId]/[programId]/stamp/route.ts` | `c47740a9513fe2e628c86426efb204274aef1ea9` | la ruta publica NUNCA serializa `stampImageObjectKey` (ni en cuerpo ni en header) | `loyalty-stamp-route.test.ts` | **ROJO 1 test / 6 passed** — «NUNCA serializa la clave interna de R2: ni en el cuerpo ni en un header»: `expected 'cache-control: …' not to contain 'loyalty/biz-1/prog-1/8f3c2a'`, con el `+ x-stamp-object-key: loyalty/biz-1/prog-1/8f3c2a` en el diff. La fuga se escribio por un HEADER, que es el canal que un oraculo que solo mira el cuerpo no ve |
| 5 | `apps/merchant/src/app/api/loyalty-program/qr/route.ts` | `a645e440ef491dedcbb656805454ec7a6baabbea` | el `programId` sale de la SESION, nunca del query (aislamiento entre negocios) | `loyalty-qr.neon.integration.test.ts` | **ROJO 1 test / 6 passed** — «el programId del QUERY se ignora: A no alcanza el programa de B»: `Expected "…/enroll/f7a630fa-…" / Received "…/enroll/8ef1d3eb-…"`, o sea el QR del negocio B. El oraculo DECODIFICA el QR (sharp + jsqr), no mira «vino un SVG» |


**Las 5 se corrieron de a una, se revirtieron con `cp` desde la copia limpia de `/tmp` y el `diff`
contra esa copia dio VACIO; el `shasum` posterior coincide con el de la tabla en los 5 casos.**
`rg -n MUTATION apps tools` → **vacio** (exit 1).

**Condicion de corte (ADR 0062): NO se aplico** — ninguna vuelta termino en «el fix abrio la
siguiente». Las 5 salieron rojas a la primera y por la asercion correcta.
### Nota sobre los `shasum` de la tabla de arriba

Los `shasum` de la bitacora son el **punto de retorno DURANTE la ronda de mutaciones** y siguen
siendo validos como tales (las 5 se revirtieron y el `shasum` posterior coincidio en los 5 casos).
**Despues** de la ronda, tres archivos cambiaron por el gate de `lint`/`typecheck` —ninguno por
una mutacion— y su `shasum` actual es otro:

- `apps/merchant/src/server/loyalty-program/client-view.ts` → `68817d52870852f41f912a5813a25b0a1ad46faf`
  (`void stampImageObjectKey;` para el `no-unused-vars`, idiom de `wallet/push-transports.ts:46`)
- `apps/merchant/src/server/onboarding/program-defaults.test.ts` → `fb8d67e23c27c9a89a1912c85c334800d46d5e6c`
- `apps/merchant/src/server/loyalty-qr.neon.integration.test.ts` → `03d6aff8e46d6608aeb2804f1efb288fd58b0b89`

## ⇥ ESTADO DE LA SPEC 0069 (implementador, 2026-09-17) — FALTA LA REVISION INDEPENDIENTE

**La spec 0069 esta IMPLEMENTADA por el implementador y NO marcada como `implementada`: eso lo
decide un revisor independiente con un `PASS` verificable (ADR 0071 §3).** El `estado` de su fila
en `docs/INDEX.md` sigue en `cerrada` a proposito.

**Entregado** (18 archivos de `apps/` + 1 doc nuevo; **cero `.tsx`**, barrido con
`git status --short | grep -c '\.tsx'` → **0**):

- Migracion **`0035_categoria_del_negocio.sql`** (generada con `drizzle-kit generate`, con su
  snapshot y su fila de journal) + `category_gcid` en `schema/business.ts`.
  **Aplicada a la rama de INTEGRACION** (`br-shy-king-axu5s3ze`) con `db:migrate` y verificada por
  SQL (`information_schema.columns` → `text`, `NOT NULL`, default `'gcid:store'::text`).
  **NO aplicada a produccion**: eso es paso del orquestador DESPUES del PASS.
- `lib/business-categories.ts` (las 15 `gcid:` + `isBusinessCategory`), Mexico en
  `SUPPORTED_COUNTRIES` (9 paises, **una** lista), `GET /api/onboarding/prefill`,
  `POST /api/onboarding/program` + `server/onboarding/program-defaults.ts`,
  `server/loyalty-program/stamp-placeholder.ts`, el path del sello **siempre** en `client-view.ts`,
  `stampForPublicProgram` distinguiendo los dos `null`, la ruta publica sirviendo el placeholder, y
  `GET /api/loyalty-program/qr` (SVG/PNG 1024²/descarga) con `renderEnrollQrPng`.
- **`docs/specs/0069-contratos-de-api.md`** — el contrato HTTP normativo, 5 endpoints con todos sus
  `code`, mas la declaracion de estado actual de las 4 rutas de `/api/loyalty-program` sin `code`.

**Split obligado por el hook `file-size`:** `schema/business.ts` llegaba a **308** lineas al sumarle
la columna, asi que `subscription` y `stripe_webhook_event` se mudaron a
**`schema/billing.ts`** (nuevo) y el barrel `server/schema.ts` lo reexporta. Mismo motivo por el que
`staff-pin.ts` ya vivia aparte. Verificado sin drift: `drizzle-kit check` → «Everything's fine» y
`drizzle-kit generate` → «No schema changes».

**Gates corridos una sola vez al final** (Node **v24.20.0**, scripts de root):
`typecheck --force` **3/3 sin cache** · `lint` **exit 0** · `format:check` **OK** ·
`test` **122 files / 1088 passed / 390 skipped / 0 failed** · `test` **con el env de integracion**
**199 files / 1478 passed / 0 failed** · `build --force` **3/3 sin cache** (las 3 rutas nuevas
aparecen en el manifiesto) · `rg -n MUTATION apps tools` **vacio**.

**Dos tests preexistentes se CORRIGIERON contra el contrato nuevo (no se borraron), y hay que
mirarlo en la revision:** `loyalty-program.test.ts` («never serializes the internal stamp key»)
aseveraba `stampImagePath: null` sin sello, y `loyalty-stamp.neon.integration.test.ts` aseveraba
`stampForPublicProgram(...) === null` sin sello. Las dos pinneaban **justo lo que la §D5 cambia**.


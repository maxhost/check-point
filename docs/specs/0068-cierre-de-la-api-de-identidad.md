---
spec: 0068
fecha: 2026-09-17
estado: implementada
resumen: Cierra la deuda de staff que dejo la 0067, y NADA MAS — el owner recorto el alcance el 2026-09-17: «estamos en proceso de reconversion a APIs diferentes, mas seguras, tocaria solo lo que faltaba de staff». Cuatro piezas: (1) `GET /api/staff` reusando `listStaff`, que hoy no tiene un solo consumidor y sin el `regenerate` y `status` son inalcanzables para cualquier integrante preexistente; (2) `email` SALE del `StaffDTO` porque es el sintetico `@staff.invalid` y serializarlo devuelve el mismo contacto falso que motivo borrar la consola; (3) `requireStaffOwner` ADENTRO del `try` en las rutas donde un fallo de base sale 500 sin `code` y el contrato ya declara lo contrario; (4) borrar el plugin `emailOTP`, que quedo sin consumidor al borrarse el arco de recuperacion, con el test de superficie HTTP reescrito para que no quede vacuo. El gate de email en las otras 9 superficies de API quedo FUERA por decision del owner y vive en `PARQUEADO.md` con sus dos decisiones ya tomadas. Sin UI (ADR 0070 §16) y sin migraciones.
disjunta: si
archivos: apps/merchant/src/app/api/staff/route.ts · app/api/staff/[userId]/status/route.ts · app/api/staff/[userId]/pin/regenerate/route.ts · app/api/merchant/business/slug/route.ts · server/staff.ts · server/auth.ts · server/email/channel.ts · server/email/console.ts · server/email-provider.test.ts · server/merchant-auth-disabled-paths.test.ts · server/staff-create.test.ts · server/staff-routes-unavailable.test.ts · server/staff-list.neon.integration.test.ts (nuevo) · docs/specs/0067-contratos-de-api.md
---

# 0068 — Cierre de la API de staff: el listado, el DTO sin email sintetico y el plugin muerto

> **Nada de codigo empieza sin esta spec en `cerrada`.**
>
> La subespecificacion es el gatillo medido del exito fingido: en tareas resolubles y bien
> definidas el reward hacking cae a 0%; en tareas vagas, ~50%.

## Problema

La spec 0067 (identidad sin contraseña) cerro con `PASS` en sus cuatro pasos y dejo deuda **del
mismo dominio**, cortada por condicion de corte y no por olvido. Todo lo de abajo esta **medido
contra el arbol del commit `9086c9a`**.

### 1. No existe `GET /api/staff`, y sin el la UI del owner no puede listar al equipo

`listStaff` (`server/staff.ts:100`) **no tiene un solo consumidor de produccion**: su unico
llamador es su propio test (`server/staff.neon.integration.test.ts:18,154`).

La consecuencia no es cosmetica: **`POST /api/staff/[userId]/pin/regenerate` y
`POST /api/staff/[userId]/status` son inalcanzables** para cualquier integrante creado antes de
la sesion actual, porque su `userId` sale **solo** del 201 del alta y no hay otra ruta que lo
devuelva. Y viola la regla de `CLAUDE.md`: andamiaje sin su tarea que lo consuma.

**La trampa, escrita de antemano.** `StaffDTO` lleva `email` (`server/staff.ts:32`): el
**sintetico** `staff-<uuid>@staff.invalid` que el alta genera porque `merchant_auth.user.email`
es `NOT NULL` con unico. Un `GET` que lo serialice le devuelve al navegador **el mismo contacto
falso que motivo borrar la consola de staff** en el paso 4 de la 0067.

### 2. El `503` del contrato no cubre la resolucion de sesion, y el contrato dice que si

En `api/staff/route.ts:15`, `api/staff/[userId]/status/route.ts:12`,
`api/staff/[userId]/pin/regenerate/route.ts:38` y `api/merchant/business/slug/route.ts:21` el
`await requireStaffOwner(request)` esta **fuera** del `try`. Un fallo de base durante la
resolucion de la sesion —que **tambien consulta**— sale como **500 sin `code`**.

**El contrato ya declara lo contrario** (`0067-contratos-de-api.md`, «Convenciones»: «las cuatro
envuelven **todo** lo que toca la base —incluida la resolucion de la sesion»), o sea que **hoy el
documento miente**. Un `code` declarado y no emitido es FAIL de revision por el DoD de la 0067.
Un revisor independiente ya cazo esta misma clase de error en otras dos rutas de staff.

### 3. `emailOTP` es configuracion muerta

El plugin existe **solo** para el reset de contraseña: su unico `type` atendido es
`forget-password` (`server/auth.ts:52`) y su unico efecto es mandar `passwordResetEmail`
(`server/email/channel.ts:34`). El arco de recuperacion se borro entero en la 0067, y **hay una
sola instancia de better-auth en el repo** (medido: `rg -n "betterAuth\(" apps` fuera de tests
devuelve `server/auth.ts:25` y nada mas — el consumidor no tiene la suya).

**Medido con sonda ejecutada** (`Object.keys(getMerchantAuth().api)`, vitest sobre el arbol
actual, archivo borrado despues): la instancia monta **44** endpoints. **De esos, 11 los aporta
este plugin** —`signInEmailOTP`, `sendVerificationOTP`, `forgetPasswordEmailOTP` y 8 mas— y quedan
**33** al sacarlo; los otros 5 que matchean «password» son **core** de better-auth y no se tocan
(ver «No entra»). *(Corregido el 2026-09-17: la primera redaccion decia «16 de OTP/password»,
que mezclaba los del plugin con los core.)* Sus **9** paths HTTP
estan cerrados por `disabledPaths` (`auth.ts:95-103`) y pinneados en
`merchant-auth-disabled-paths.test.ts:23-31`.

**OJO — ese test se vuelve VACUO si no se toca.** Sin el plugin esos 9 paths dan 404 **por
inexistentes**, no por bloqueados, y el test seguiria verde sin probar nada. Un path mal escrito
da 404 igual: por eso ese archivo ya tiene un «control del 404».

## Alcance

**Entra:**

- `GET /api/staff` reusando `listStaff` tal cual, con su fila en el contrato.
- `email` fuera del `StaffDTO` (el sintetico se persiste, no se serializa nunca).
- La fila que falta de `POST /api/staff/[userId]/status` en el contrato.
- `requireStaffOwner` adentro del `try` en las **4** rutas donde hoy queda afuera.
- Borrado de `emailOTP`, de `passwordResetEmail` y de los 9 paths de `disabledPaths`, con el
  test de superficie HTTP **reescrito para que siga mordiendo**.

**No entra:**

- **EL GATE DE EMAIL VERIFICADO EN LAS OTRAS 9 SUPERFICIES DE API.** Lo saco el owner el
  2026-09-17, con su motivo: «como estamos en proceso de reconversion todo a API diferentes, mas
  seguras, yo tocaria solo lo que faltaba de staff para completar lo que faltaba del arco 1».
  **El agujero medido sigue abierto y esta registrado con sus dos decisiones ya tomadas en
  `docs/PARQUEADO.md`** — no se pierde, se reengancha cuando esas APIs se reconviertan.
- **Nada de UI.** ADR 0070 §16: se entregan endpoints **y** el contrato HTTP escrito; la
  pantalla la construye el owner por fuera. Un archivo bajo `app/` que no este bajo `app/api/`
  en el diff es un incumplimiento, y el DoD lo chequea mecanicamente.
- **El wizard de 3 pantallas y el QR** — es la 2ª spec del arco.
- **`core.business.status`**: el owner pidio el 2026-09-17 que un negocio tenga status. **Medido:
  esa columna NO existe** (`server/schema/business.ts`: el `status` que existe es el de
  `business_membership`, el de `location` y el de `subscription`). Es esquema nuevo y **esta spec
  no toca el esquema**: va a `PARQUEADO.md` como requisito del owner, y su lugar natural es la
  **3ª spec del arco** (entitlements). *(La otra mitad de esa frase ya esta hecha: **toda alta
  inserta su suscripcion `free`/`active`** — `api/onboarding/business/route.ts:155`.)*
- **Los endpoints core de password de better-auth**, que **no** los publica `emailOTP`. Medido
  con sonda ejecutada: `POST /api/auth/request-password-reset` → **400** `RESET_PASSWORD_DISABLED`;
  `/reset-password` y `/change-password` → **400** de validacion; `/set-password` → **404**.
  Ninguno autentica ni resetea nada sin `emailAndPassword`, que esta apagado. **Se declara como
  limite conocido y no se toca.**
- **Migraciones**: ninguna. Esta spec no toca el esquema.
- **El `DEFAULT` volatil del `slug`** y los cupos del rate limit de `start`: siguen abiertos, son
  de otro dominio.

## Diseño

### §1 — `GET /api/staff`

Se agrega el `export async function GET` a `app/api/staff/route.ts` (que ya tiene el `POST`).

- **Requiere sesion de owner** por `requireStaffOwner` — el guard que ya trae los tres chequeos
  en el orden correcto (sesion → owner → email verificado). **No se crea un guard nuevo**: el
  dominio de staff ya tiene el suyo y esta spec no unifica nada fuera de staff.
- Reusa `listStaff(business.id)` **sin tocarla**: role `staff`, del negocio de la **sesion**
  (nunca del cuerpo ni de la query), mas viejo primero.
- **Salida 200:** `{ "staff": [ /* StaffDTO[] */ ] }`. Sin integrantes → `{ "staff": [] }`, 200.
- **No setea cookie. No devuelve PIN ni hash** — no existe ruta que lea un PIN.
- Errores: `401 unauthorized`, `403 not_owner`, `403 email_not_verified`, `503 staff_unavailable`.

### §2 — `email` sale del `StaffDTO`

`StaffDTO` pasa a tener **6** claves: `userId`, `name`, `identifier`, `role`, `status`,
`createdAt`. `toStaffDTO` deja de recibir `email`, y los dos `select` de perfil que hoy lo leen
**solo** para el DTO (`staff.ts:184` en `setStaffStatus`, `pin/regenerate/route.ts:82`) pasan a
seleccionar `name` nada mas.

**El sintetico se sigue persistiendo** (`merchant_auth.user.email` es `NOT NULL` con unico): lo
que cambia es que **no se serializa nunca**. Es la misma regla que ya aplican `toClientProgram` y
`brandResponse` con las claves de R2 (`CLAUDE.md`, «Codigo»): la ruta devuelve un DTO que omite
lo interno.

El contrato (`0067-contratos-de-api.md`, «`StaffDTO` — forma canonica») se corrige: sale la clave
del ejemplo, y el parrafo pasa a decir que el email sintetico **existe en la base y no se
expone** —en vez del actual «la UI no deberia mostrarlo», que es una recomendacion y no un
contrato—.

### §3 — `requireStaffOwner` adentro del `try`

En `app/api/staff/route.ts` (`POST` y el `GET` nuevo), `app/api/staff/[userId]/status/route.ts`,
`app/api/staff/[userId]/pin/regenerate/route.ts` y `app/api/merchant/business/slug/route.ts`, el
`await requireStaffOwner(request)` pasa **dentro** del `try` que traduce con `staffError` (y con
el `catch` equivalente del slug), de modo que un fallo de base durante la resolucion de sesion
salga **503 con `code`** y no 500 pelado.

El `return auth.response` sigue siendo un **return temprano**: un 401/403 no es una excepcion y
no pasa por el `catch`. El `request.json()` conserva su propio `try` con `invalid_body`.

### §4 — Borrado de `emailOTP`

- `server/auth.ts`: se va el import, el bloque `emailOTP({...})` entero y **los 9 paths de
  `emailOTP` en `disabledPaths`**. Quedan los **2** de `magicLink` (`/sign-in/magic-link`,
  `/magic-link/verify`), que **si** siguen montados y **si** tienen que estar cerrados.
- `server/email/channel.ts`: se va `passwordResetEmail` y el comentario de la linea 4.
- `server/email/console.ts:14`: el docblock deja de citar `sendVerificationOTP`.
- `server/email-provider.test.ts`: se va el `describe("passwordResetEmail")` y su import.
- `server/merchant-auth-disabled-paths.test.ts`: `BLOCKED` baja a los **2** de `magicLink`, y
  **se agrega el oraculo que reemplaza al que se volveria vacuo**: que el plugin no este montado
  se asevera **sobre la instancia**, no sobre un 404.

```ts
it("el plugin de OTP por email ya no esta montado", () => {
  const keys = Object.keys(getMerchantAuth().api);
  expect(keys).not.toContain("signInEmailOTP");
  expect(keys).not.toContain("forgetPasswordEmailOTP");
  // El control: la instancia SIGUE teniendo endpoints (si no, los `not.toContain` pasarian
  // con un objeto vacio y no probarian nada).
  expect(keys).toContain("signInMagicLink");
});
```

> **Corregido el 2026-09-17, y el caso quedo en `LECCIONES.md` (quinto de la familia).** La
> primera redaccion de este snippet usaba `sendVerificationOTP` y nombraba el `it` con la palabra
> `emailOTP`: **las dos cadenas matchean el barrido `rg` que el DoD de esta misma spec exige en
> vacio**, o sea que el test que la spec mandaba escribir era exactamente lo que su DoD prohibia.
> `forgetPasswordEmailOTP` es otra clave que **solo** aporta este plugin —verificada presente bajo
> la mutacion #5— y no matchea el barrido, que es sensible a mayusculas. El oraculo no se
> debilito: sigue aseverando dos claves que existen con el plugin puesto.

**Esa asercion muerde, y esta medida sobre el arbol de hoy:** con el plugin puesto,
`Object.keys(getMerchantAuth().api)` **contiene** `signInEmailOTP` y `sendVerificationOTP` (44
claves). Si alguien vuelve a agregar el plugin, el test se pone rojo.

### Arquitectura de referencia

- **ADR 0070** — el alta del comercio es un wizard: §11 (el email verificado bloquea lo posterior
  al wizard), §16 (API y contrato, no interfaz), §17 (la UI vieja se borra).
- **ADR 0044** — staff owner-only y scoping por negocio. **ADR 0055** — revocacion de sesiones.
- **Spec 0067** y su anexo `0067-contratos-de-api.md`, que este trabajo extiende.

## Archivos

| Archivo | Accion |
|---|---|
| `app/api/staff/route.ts` | editar — **`GET` nuevo** + guard adentro del `try` en `POST` |
| `app/api/staff/[userId]/status/route.ts` | editar — guard adentro del `try` |
| `app/api/staff/[userId]/pin/regenerate/route.ts` | editar — guard adentro del `try`, `select` de perfil sin `email` |
| `app/api/merchant/business/slug/route.ts` | editar — guard adentro del `try` |
| `server/staff.ts` | editar — `StaffDTO` sin `email`; `toStaffDTO`, `listStaff` y `setStaffStatus` |
| `server/staff-create.ts` | editar — deja de pasarle `email` al DTO (lo **sigue insertando**). *Fila agregada por el orquestador el 2026-09-17: es consecuencia mecanica del §2, no alcance nuevo* |
| `server/auth.ts` | editar — sin `emailOTP` y sin sus 9 `disabledPaths` |
| `server/email/channel.ts` | editar — se va `passwordResetEmail` |
| `server/email/console.ts` | editar — docblock |
| `server/email-provider.test.ts` | editar — se va su `describe` |
| `server/merchant-auth-disabled-paths.test.ts` | editar — `BLOCKED` a 2 + el oraculo nuevo |
| `server/staff-create.test.ts` | editar — allow-list de claves y el test del sintetico |
| `server/staff-routes-unavailable.test.ts` | editar — suma las 4 rutas de owner |
| `server/staff-gate.test.ts` | **crear** — el oraculo de la **mutacion #4**, que el plan de pruebas ya exigia y esta tabla no listaba. *Fila agregada por el orquestador el 2026-09-17, con el motivo medido y verificado por el revisor contra la base real: `merchant_auth.user.email_verified` es `boolean NOT NULL DEFAULT false`, asi que una sesion real **nunca** trae `undefined` y el caso que separa `!== true` de `=== false` es **inalcanzable desde integracion**. Es el espejo de API de la propiedad que `auth-guards.test.ts` ya pinnea para el guard de pantalla* |
| `server/staff-list.neon.integration.test.ts` | **crear** — el `GET` con base real |
| `server/staff-status.neon.integration.test.ts` | **crear** — el oraculo del cuerpo de `POST …/status`, que cierra el **H1** del revisor: la fuga escrita **por fuera** de `toStaffDTO` (`{...toStaffDTO(…), email}`) sobrevivia a `typecheck`, a 1027 tests y a los 4 `.neon`. *Fila agregada por el orquestador el 2026-09-17, por hallazgo del revisor* |
| `docs/specs/0067-contratos-de-api.md` | editar — `GET /api/staff`, `POST …/status`, `StaffDTO` |
| `docs/INDEX.md` · `docs/TASKS.md` | editar — fila y estado, mismo commit |

### Disjunta?

**Si.** Es la unica spec abierta del INDEX. La 2ª del arco (wizard) consumira `server/slug.ts` y
`api/onboarding/business`, que esta spec **no toca**. Se serializa igual por orden del owner:
primero este cierre, despues el borrado de la base, despues el wizard.

### Archivos compartidos

Ninguno: no se crea ninguna pieza compartida nueva. **`requireStaffOwner` ya existe** y es el
guard del dominio; crear un `requireApiOwner` sin mas consumidores que staff seria andamiaje sin
su tarea (`CLAUDE.md`, «Codigo»).

## Definition of Done

**Los barridos de abajo se corrieron contra el arbol antes de cerrar esta spec** (leccion de la
0067, que cerro con cuatro criterios imposibles de cumplir).

- [ ] `GET /api/staff` devuelve `{ staff: StaffDTO[] }` 200 a un owner verificado, con los
      integrantes del negocio **de la sesion** y mas viejo primero.
- [ ] `GET /api/staff` de un owner del negocio A **no** devuelve integrantes del negocio B.
- [ ] Un owner **sin** email verificado recibe **403 `email_not_verified`** en el `GET`; un
      **integrante activo** recibe **403 `not_owner`**, nunca `email_not_verified`; sin sesion,
      **401 `unauthorized`**.
- [ ] `JSON.stringify` de la respuesta de las **5** rutas de staff no contiene la subcadena
      `staff.invalid` ni la clave `email`. Aseverado en tests, **no** por un barrido `rg`: el
      contrato tiene que poder seguir NOMBRANDO el sintetico para explicar que existe en la base
      y no se expone.
- [ ] `Object.keys(dto).sort()` del alta es exactamente
      `["createdAt","identifier","name","role","status","userId"]`.
- [ ] Un fallo de base **en la resolucion de sesion** sale **503 con `code`** en las 4 rutas de
      staff de owner y en el `PATCH` del slug. **Ningun 500 sin `code`.**
- [ ] `rg -n "emailOTP|passwordResetEmail|sendVerificationOTP" apps/merchant/src` → **vacio**.
      *(Hoy: **12 lineas en 4 archivos**, los cuatro en la tabla de Archivos.)*
- [ ] `rg -n "email-otp" apps/merchant/src` → **vacio**.
      *(Hoy: **19 lineas en 2 archivos**, los dos en la tabla.)*
- [ ] `merchant-auth-disabled-paths.test.ts` conserva un **control** que contesta algo distinto
      de 404, y su asercion nueva **muerde** si vuelve `emailOTP` (mutacion #5).
- [ ] **Ningun archivo bajo `app/` fuera de `app/api/` aparece en el diff**:
      `git diff --name-only <base> | rg '^apps/merchant/src/app/' | rg -v '^apps/merchant/src/app/api/'`
      → vacio.
- [ ] El contrato tiene fila para **`GET /api/staff`** y para **`POST /api/staff/[userId]/status`**,
      con todos sus `code`. Un `code` declarado y no emitido (o al reves) es **FAIL**.
- [ ] `rg -n MUTATION apps` → **vacio** al cerrar.
- [ ] Gates de root con Node 24: `typecheck`, `lint`, `test`, `format:check`, `build` — los cinco
      en verde y **sin cache**.

## Plan de pruebas y verificación

**Presupuesto: 5 mutaciones.** Clase de error a cazar: **los plausibles** — un DTO que filtra, un
`GET` que se escapa del negocio, un `try` que no cubre, un gate que no discrimina, un test que
quedo vacuo. **Condicion de corte:** si dos vueltas seguidas terminan en «el fix abrio la
siguiente», se corta y va al owner en vez de abrir otra ronda.

| # | Mutacion | Oraculo que tiene que ponerse ROJO |
|---|---|---|
| 1 | `toStaffDTO` vuelve a devolver `email` | la allow-list de claves de `staff-create.test.ts` + el barrido de `staff.invalid` sobre el cuerpo del `GET` |
| 2 | El `GET` llama a `listStaff` con un `businessId` que no es el de la sesion | el aislamiento A/B de `staff-list.neon` |
| 3 | Sacar `requireStaffOwner` del `try` en una de las 4 rutas | `staff-routes-unavailable.test.ts` ve un **500 sin `code`** |
| 4 | En `staff/_auth.ts`, `emailVerified !== true` → `=== false` | el owner con `emailVerified: undefined` entra al `GET` (fail-closed) |
| 5 | Volver a agregar el plugin `emailOTP` | la asercion nueva sobre `Object.keys(auth.api)` |

**Protocolo (skill `protocolo-de-verificacion`):** `shasum` limpio **antes** de mutar, fila de
bitacora **antes** de medir, etiqueta `MUTATION` en el codigo mutado, revertir con `diff` contra
la copia limpia. Se corren **de a una** y al final.

- [ ] **Integracion (Neon)** — `server/staff-list.neon.integration.test.ts`: dos negocios
      sembrados; aislamiento (A no ve a B), orden por `createdAt`, lista vacia → `[]`, y el
      cuerpo serializado sin `staff.invalid` ni `"email"`. Sesiones **reales**
      (`openMerchantSession`, como `billing-routes-auth.neon`), y los **4 actores** del DoD.
      **El seed NO puede poner `emailVerified: true` por default en el caso del gate**: ese es el
      falso consuelo que dejo el agujero de `billing-routes-auth.neon` vivo en la 0067.
- [ ] **Regresion** — `server/staff-routes-unavailable.test.ts` extendido a `POST /api/staff`,
      `GET /api/staff`, `…/pin/regenerate`, `…/status` y el `PATCH` del slug. La sonda hace fallar
      **la base** (el modo de fallo real), y su mock de sesion tiene que devolver
      `emailVerified: true`, o el gate contesta 403 antes de llegar a la base y el test pasaria
      **por el motivo equivocado**.
- [ ] **Unitaria** — `staff-create.test.ts`: allow-list de 6 claves; el sintetico se **persiste**
      (aseverado sobre los valores del insert) y **no** se serializa.
- [ ] **Superficie HTTP** — `merchant-auth-disabled-paths.test.ts`: 2 paths bloqueados + control
      vivo + la asercion sobre `Object.keys(auth.api)`.
- [ ] **Comandos exactos:**
      `export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use`, y desde **root**
      `pnpm run typecheck && pnpm run lint && pnpm run test && pnpm run format:check && pnpm run build`.
      Los `.neon.integration` piden el env de integracion.
- [ ] **Verificacion manual:** **NO HAY QA DE PANTALLA, y se declara.** ADR 0070: mientras dure el
      arco el producto no tiene entrada por navegador. La verificacion es por HTTP con las
      respuestas **transcriptas** (status + cuerpo) para: el `GET` con un integrante dado de alta
      en la misma corrida, el `403 email_not_verified` y el `403 not_owner` sobre ese mismo `GET`.

### Lo que esta spec declara AFUERA (sin oraculo, a proposito)

- **El gate de email en las otras 9 superficies de API** — recorte del owner, en `PARQUEADO.md`.
- **Los endpoints core de password de better-auth** (§ «No entra»), medidos: 400/404.
- **La entregabilidad de mails**: se verifica que se **encolen** (`EMAIL_PROVIDER=console`).
- **La carrera** entre un cambio de `emailVerified` y un request en vuelo: la sesion ya resuelta
  vale hasta el proximo request. Mismo modelo que la 0067.

## Handoff requerido

**Dos pasos**, cada uno con los gates verdes al terminar y **revisor independiente en contexto
fresco** (`docs/AGENT-WORKFLOW.md`), nunca en el mismo turno que escribio el codigo:

1. **`GET /api/staff` + `StaffDTO` sin `email` + el `try`** (§1, §2, §3) + las dos filas del
   contrato.
2. **El borrado de `emailOTP`** (§4) + el test de superficie reescrito.

El encargo de cada paso lleva **adentro** el presupuesto (5 mutaciones, repartidas 4 + 1) y la
condicion de corte. El revisor produce un `PASS` **con evidencia ejecutada** antes de marcar la
spec `implementada`.

## Abierto

**Nada que bloquee.** Las cuatro decisiones que tenia esta spec las contesto el owner el
2026-09-17:

1. **Alcance recortado a staff** — «estamos en proceso de reconversion todo a API diferentes, mas
   seguras». Las otras 9 superficies salen a `PARQUEADO.md`.
2. **`email` sale del `StaffDTO`.** Confirmado.
3. **Membresia y negocio con `status`, y suscripcion `free` de base.** El filtro
   `status='active'` queda **aprobado** para cuando se toquen esas APIs (parqueado); la
   **suscripcion free ya existe en toda alta** (medido); **`core.business.status` no existe** y va
   a `PARQUEADO.md` como requisito nuevo del owner, para la 3ª spec del arco.
4. **Se agregan `code` a los 401/403.** Confirmado, y aplica a las superficies parqueadas.

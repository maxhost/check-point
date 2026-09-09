---
spec: 0057
fecha: 2026-09-08
estado: implementada
resumen: Un staff desactivado que se loguea con credenciales validas hoy rebota al login en silencio y ademas deja una sesion viva; pasa a ver «Miembro del staff desactivado» y su sesion se revoca en el mismo paso. Implementa el ADR 0055.
disjunta: si
archivos: `src/server/auth-guards.ts`, `src/app/login/page.tsx`, `src/app/login/login-form.tsx` (nuevo), `src/app/globals.css`
---

# 0057 — El login dice por que rechaza a un staff desactivado

> **Cerrada el 2026-09-08.** Sale del QA del owner (item C8 de la spec 0055): verifico que el
> staff desactivado **no puede entrar** —correcto— y pidio el mensaje que falta, con sus
> palabras: *«deberiamos poner un toast que diga "Miembro del staff desactivado" por que hoy no
> muestra nada»*. Implementa el **ADR 0055**.

## Problema

**El rechazo funciona y es mudo.** Verificado en el codigo, no de palabra:

- `LoginPage` (`app/login/page.tsx`) llama a `signIn.email`. **better-auth autentica contra
  `merchant_auth` y no sabe nada de `core.business_membership`**: el staff desactivado con la
  contraseña correcta **se loguea con exito y se le crea una sesion nueva**.
- `requireBackofficeSession` (`auth-guards.ts:57`) ve `status !== "active"` y hace
  `redirect("/login")` — **sin parametro y sin motivo**.
- El usuario ve el formulario vacio otra vez. Indistinguible de «contraseña mal» o «el login
  esta roto».

**Y hay un segundo efecto que el QA no vio:** ese login **deja una sesion viva de un miembro
desactivado**. No otorga nada (el guard la frena en cada render del backoffice, y
`operatorBusiness` filtra `status = 'active'` desde la spec 0055), pero **contradice a
`setStaffStatus`**, que al desactivar borra explicitamente todas las sesiones del usuario
(`staff.ts:242-244`). Esa limpieza queda inutil si el siguiente login las vuelve a crear.

**No es una regresion de la spec 0055.** El filtro `status = 'active'` que esa spec agrego a
`operatorBusiness` es lo que hace que el mostrador este cerrado; el silencio del login es
anterior y quedo al descubierto justo porque ahora el rechazo ocurre de verdad.

## Decisiones cerradas (owner, 2026-09-08)

1. **El mensaje es «Miembro del staff desactivado»** — palabras textuales del owner en el QA.

## Alcance

**Entra:**

- El guard redirige con un motivo (`/login?e=staff_disabled`) en vez de `/login` pelado.
- El login muestra ese motivo. Requiere partir la pagina en **servidor** (lee el
  `searchParams`) + **formulario cliente**, porque hoy es `"use client"` entero y un componente
  cliente no recibe `searchParams`.
- **El guard revoca la sesion** del miembro desactivado antes de redirigir (ADR 0055 §3).

**No entra (explicito):**

- **Bloquear el sign-in dentro de better-auth.** Descartado en el ADR 0055: acopla `core` al
  ciclo de vida de `merchant_auth` y el mensaje habria que resolverlo igual.
- **Cambiar el mensaje de credenciales invalidas.** Sigue siendo el generico de better-auth.
- **Avisarle al staff por email que fue desactivado.** No lo pidio el owner.
- **El hueco de `api/billing/checkout`** (ver «Abierto»): es de la misma familia pero **el
  owner no lo decidio**, asi que no se toca en esta spec.

## Diseño

### Especificación técnica

**`auth-guards.ts`.** Se agrega una constante exportada con el codigo del motivo y el guard
pasa de `redirect("/login")` a revocar + redirigir con motivo:

```ts
export const STAFF_DISABLED = "staff_disabled";
// …
if (row.status !== "active") {
  await revokeSessions(session.user.id);        // ADR 0055 §3
  redirect(`/login?e=${STAFF_DISABLED}`);
}
```

**Por que revocar con un `DELETE` sobre `sessions` y no con `auth.api.signOut`.** Es
exactamente lo que ya hace `setStaffStatus` (`staff.ts:243`) al desactivar: una sola forma de
matar sesiones en el producto, no dos. Un segundo mecanismo es como dos validadores del mismo
dato — divergen.

**Ojo con el orden: revocar ANTES de `redirect()`.** `redirect()` de Next funciona lanzando una
excepcion (`NEXT_REDIRECT`); cualquier cosa escrita despues no corre. El `await` va antes, y el
test lo pinnea.

**Escribir en un guard de render es deliberado y tiene precedente** en este repo:
`programForOwner` (`loyalty-program.ts:75-81`) hace un «self-heal expiry on read» por la misma
razon — es la unica ruta por la que pasa el caso.

**`app/login/page.tsx`** pasa a ser **server component**: lee `searchParams.e`, lo traduce a
copy y se lo pasa al formulario. **Traduce por allow-list, nunca renderiza el valor crudo del
query param** — un `?e=<lo que sea>` no puede terminar en pantalla. Es el mismo criterio de
allow-list que el resto del proyecto aplica a los DTO.

**`app/login/login-form.tsx`** (nuevo) es el `"use client"` de hoy, recibiendo
`initialError?: string`. El error de credenciales que ya maneja **pisa** al inicial cuando el
usuario reintenta: si escribe mal la contraseña, tiene que ver ese error y no el cartel viejo
de staff desactivado.

### Arquitectura de referencia

- **ADR 0044** — roles `owner`/`staff` y el significado de `status`.
- **ADR 0055** — esta decision: decirlo en voz alta y no dejar sesion viva.
- **spec 0055** — el QA que lo encontro; ya cerro el mismo hueco en `operatorBusiness`.

## Archivos

Tabla actualizada al implementar (2026-09-08): tres filas divergieron de lo planeado y se
corrigen acá en vez de dejarlas viejas.

| Archivo | Acción |
|---|---|
| `src/server/auth-guards.ts` | editar — motivo en el redirect + revocacion |
| `src/app/login/page.tsx` | reescribir — server component que lee `searchParams` |
| `src/app/login/login-form.tsx` | crear — el formulario cliente actual |
| `src/app/login/login-notice.ts` | **crear (no estaba en el plan)** — la allow-list como funcion pura |
| `src/server/auth-guards.test.ts` | editar — casos nuevos |
| `src/app/login/login-notice.test.ts` | crear — tabla de casos del mapeo + cableado de la pagina |
| `src/app/login/login-form.test.ts` | crear — render del aviso con `react-dom/server` |
| `src/app/login/login-form-retry.test.ts` | crear — probe de la interaccion (proxy declarado) |
| `vitest.config.ts` (merchant) | **editar (no estaba en el plan)** — `esbuild.jsx: "automatic"` |
| ~~`src/app/globals.css`~~ | **NO se toco** — `.form-error` ya existia y sirve |

**Por que `login-notice.ts` y no la funcion adentro de `page.tsx`:** `page.tsx` importa el
`"use client"`, asi que un test del mapeo arrastraria el cliente de better-auth. Es ademas lo
que pide `CLAUDE.md` («extrae la decision a una funcion pura y testeala»).

**Por que `vitest.config.ts`:** `tsconfig.base.json` fija `jsx: "preserve"`, asi que esbuild cae
al transform clasico y **cualquier** test que importe un `.tsx` muere con
`ReferenceError: React is not defined` (visto en rojo). Ningun test del repo importaba un `.tsx`
hasta esta spec. Es config **solo de tests** — no toca el build de Next.

**Por que no hizo falta `globals.css`:** el aviso reusa `.form-error` en el **mismo slot** que el
error de credenciales, que es justamente lo que hace que el reintento lo pise. Queda dicho que el
owner pidio «un toast» y esto es un mensaje dentro del formulario, entre la contraseña y el boton:
si quiere banner arriba del panel, es CSS + mover el `<p>`, y hay que redecidir el «pisa».

## Definition of Done

- [x] Un staff `disabled` que se loguea con credenciales **validas** ve
      **«Miembro del staff desactivado»** en el login. — decision: `login-notice.test.ts`;
      cableado: idem (props de la pagina); **render: `login-form.test.ts`**.
- [x] Ese login **no deja sesion viva**: la fila de `session` del usuario queda borrada. —
      `auth-guards.test.ts`, `DELETE` aseverado por tabla y por `where` serializado.
- [x] Un staff **activo** entra normal, sin ver ningun aviso. — `deletes` vacio + sin redirect.
- [x] Un **owner** entra normal (no se puede desactivar a un owner — `staff.ts` lo impide).
- [x] Credenciales **invalidas** siguen mostrando el error generico de better-auth, y ese
      error **pisa** al aviso de staff desactivado al reintentar. — `login-form-retry.test.ts`
      (proxy declarado); mutacion (h) lo pone rojo con **los 5 gates verdes**.
- [x] `/login?e=` con un valor **desconocido o inventado** no renderiza nada (allow-list); el
      valor crudo del query param **nunca** llega al DOM. — 10 casos + mutaciones (d1)/(d2)/(e)/(f).
- [x] La revocacion ocurre **antes** del `redirect` (que lanza excepcion). — mutacion (c);
      el oraculo real es `typecheck` (`TS18047`), no vitest.
- [x] Ningun archivo cruza `file-size` (300). — maximo tocado: 132 lineas.
- [x] Gates verdes (typecheck, lint, test, format:check, build).

## Plan de pruebas y verificación

> **Resultados REALES transcritos de la ejecucion del 2026-09-08**, no la prediccion que
> tenia esta seccion. La prediccion original decia «(a) rojo el test del motivo, (b) rojo el
> test de no deja sesion viva» — **son el mismo `it`**, y esos dos tests separados **nunca
> existieron**. Se deja escrito porque es exactamente el error que la spec 0055 dejo
> documentado en `CLAUDE.md`.

- [x] **Unit `auth-guards`** (`src/server/auth-guards.test.ts`): `status='disabled'` revoca y
      redirige a `/login?e=staff_disabled` en un solo `it`
      («disabled membership → /login with the reason, and revokes the session first»); el
      `DELETE` se asevera por identidad de tabla (`=== sessions`) y serializando el `where` con
      `PgDialect` → `"user_id" = $1`, `params: ["u1"]`. `status='active'` (staff y owner) no
      registra ningun `DELETE`.
- [x] **Unit del mapeo de motivo** (`src/app/login/login-notice.test.ts`): 10 casos —
      `staff_disabled` → el texto; `undefined`, `""`, inventado, `"staff_disabled "` (con
      espacio), array `["staff_disabled"]`, `<script>alert(1)</script>`, `__proto__`,
      `constructor`, y la copy misma → `null`.
- [x] **Unit del render** (`src/app/login/login-form.test.ts`): `renderToStaticMarkup` del
      formulario — con `initialError` el HTML contiene la copy y `role="alert"`; **sin el, en
      sus dos formas** (`null` explicito y prop ausente — `initialError ?? null` cubre las dos)
      no hay `role="alert"` (y se asevera que el form igual renderizo, para que el verde no sea
      vacuo). Corre bajo el `environment: "node"` actual, sin jsdom ni dependencias nuevas.
- [x] **Probe de la interaccion** (`src/app/login/login-form-retry.test.ts`, **PROXY declarado
      en el propio archivo**): stubea `useState`, invoca `LoginForm(props)` como funcion, camina
      el arbol hasta el `<button>`, dispara su `onClick` con `signIn.email` devolviendo
      `{error:{message:"Invalid email or password"}}` y re-renderiza. El aviso de staff
      desactivado queda **pisado** por el error de credenciales. Cero paquetes nuevos, cero
      refactor de produccion, `environment: "node"`.
- [x] **Mutaciones EJECUTADAS.** `shasum` de ida y vuelta en los 4 archivos de produccion;
      `grep -rn MUTATION apps/merchant/src/` vacio al cerrar.

  | # | Mutacion | vitest | typecheck |
  |---|---|---|---|
  | (a) | `redirect("/login")` pelado | rojo **1**: `disabled membership → …` — `expected '/login' to be '/login?e=staff_disabled'` | verde (3/3) |
  | (b) | sacar la revocacion | rojo **1**: `disabled membership → …` — `expected [] to have a length of 1 but got +0` | **verde (3/3)** |
  | (c) | revocacion DESPUES del `redirect` | rojo **1**: el MISMO `it`, el MISMO mensaje que (b) | **ROJO — `src/server/auth-guards.ts(77,62): error TS18047: 'session' is possibly 'null'`, exit 2** |
  | (d1) | `loginNotice` devuelve el param crudo (`LOGIN_NOTICES[reason] ?? reason`) | rojo **8**: 7 casos de la tabla + `never lets the raw query param reach the form` | verde |
  | (d2) | la **pagina** puentea la allow-list (`initialError={typeof e === "string" ? e : null}`) | rojo **2**: `translates the reason…` y `never lets the raw query param…` | verde |
  | (e) | `reason in LOGIN_NOTICES` en vez de `Object.hasOwn` | rojo **2**: `__proto__` (devuelve `{…(12)}`) y `constructor` (devuelve `[Function Object]`) | verde |
  | (f) | sacar el guard `typeof reason !== "string"` (`String(reason)`) | rojo **1**: `a repeated param (array)` — `expected 'Miembro del staff desactivado' to be null` | verde |
  | (g) | el form ignora `initialError` (`useState(null)`) | rojo **1**: `shows the copy, announced to assistive tech`; **el test del cableado queda VERDE** | verde — pero **lint muerde** (`'initialError' is defined but never used`), asi que (g) no prueba «los 5 gates pasaban» |
  | (g2) | usa la variable y **igual** oculta el aviso (`useState(initialError === "" ? initialError : null)`) | rojo **2 archivos**: `login-form.test.ts` (`expected '<main class="merchant-shell"…' to contain 'Miembro del staff desactivado'`) y `login-form-retry.test.ts` (`expected null to be 'Miembro del staff desactivado'`, su precondicion) | **typecheck 3/3, lint LIMPIO, format verde** |
  | (h) | el aviso viejo gana el reintento (`setError(initialError ?? result.error.message ?? …)`) | rojo **1, y solo uno en todo el repo**: `the credential error takes the slot the notice was seeded into` — `expected 'Miembro del staff desactivado' to be 'Invalid email or password'` | **typecheck 3/3 · lint limpio · format verde · build 3/3** |
  | (i) | el aviso se borra **desde un efecto** (`useEffect(() => setError(null), [])`) | `login-form.test.ts` **VERDE 3/3** (SSR saltea efectos por diseño); rojo **1**: `login-form-retry.test.ts`, ahora con mensaje propio — `Error: hook no modelado por el stub: useEffect(). … si borra o pisa el aviso (p.ej. un useEffect que resetea el error), es el bug de la tarea 38 y el rojo es correcto` | typecheck 3/3 · lint limpio |

  **Lo que la ejecucion enseño y el plan no decia:**
  1. **(b) y (c) son indistinguibles para vitest** —mismo `it`, mismo mensaje— pero **NO para
     los gates**: `tsc` marca la linea muerta despues del `redirect()` (que devuelve `never`)
     con `TS18047`. El oraculo del *orden* existe, y es `typecheck`, no un test.
  2. **(d) hubo que partirla en (d1)/(d2).** Con (d1) sola —mutar solo la funcion pura— (d2)
     habria pasado **en verde**: extraer la decision a una funcion pura deja el **cableado**
     sin oraculo (leccion de la tarea 38). Por eso `login-notice.test.ts` importa `page.tsx`
     con el form mockeado y asevera los props que baja.
  3. **(g)/(g2) prueban que el test de render no es decorativo** y que cubre algo que el del
     cableado no ve: el cableado sigue **verde** mientras el usuario **no ve nada**. (g) sola no
     alcanzaba porque el rojo lo daba el **lint**, no un test; **(g2) usa la variable, deja
     typecheck y lint limpios, y el unico rojo son los tests nuevos.**
  4. **(h) es la fila que justifica que `login-form-retry.test.ts` exista: con la mutacion
     puesta, los CINCO gates quedan verdes** (typecheck 3/3, lint limpio, format, build 3/3) y
     el unico rojo del repo es ese archivo. Sin el, se podia romper el DoD #5 exacto —el aviso
     viejo pisando al error de credenciales— y todo el harness aplaudia.
  5. **El `Object.hasOwn` es load-bearing** ((e)): sin el, `?e=__proto__` devuelve un objeto y
     `?e=constructor` una funcion.
  6. **Un rojo de lint durante (h) resulto ser un defecto del test nuevo, no de la mutacion**
     (`'signInResult' is never reassigned`). Se corrigio y **se volvio a correr (h) entero**
     para que la fila de arriba no mezcle las dos causas.
  7. **(i) es la forma exacta del bug de la tarea 38 —volver a romperlo DESDE UN EFECTO— y el
     test de SSR no lo ve.** `renderToStaticMarkup` no corre efectos por diseño. Lo caza el
     probe, pero originalmente **por crash** (`TypeError: Cannot read properties of null
     (reading 'useEffect')`), que se lee como «el test esta roto» y manda a debuggear el
     arnes. Se arreglo: el stub reemplaza **todo** hook que no sea `useState` por uno que
     falla **con nombre propio** y explica las dos causas posibles (hook legitimo sin modelar
     vs. el bug de la tarea 38). Verificado corriendo (i) despues del cambio.
- [x] **Comandos** (Node v24.20.0, scripts de ROOT), todos verdes en el arbol final:
      `pnpm run typecheck` (3/3) · `pnpm run lint` (sin salida) · `pnpm run test`
      (**63 archivos / 471 tests passed**, 28 archivos / 137 tests skipped = integraciones Neon)
      · `pnpm run format:check` (All matched files use Prettier code style!) · `pnpm run build`
      (3/3; `/login` pasa de `○` estatico a `ƒ` dinamico).
- [ ] **Manual (owner)**: reintentar el login del staff desactivado del QA y ver el cartel.
      **Pendiente** — y antes hay que verificar que prod tenga EL COMMIT (regla de `CLAUDE.md`).

### Lo que NO queda pinneado (declarado, no tapado)

> **Este parrafo se reescribio CUATRO veces y las tres primeras eran falsas.** (1) «el DoD #1 no
> es testeable en `node`» — lo era, con `renderToStaticMarkup`. (2) «la interaccion no es
> testeable sin jsdom» — tambien lo era, ~45 lineas, cero paquetes. (3) «nada del navegador de
> verdad», metiendo `window.location.assign` en la misma bolsa que el lector de pantalla — el
> `assign` **si** se pinnea, con `vi.stubGlobal`, sobre este mismo andamiaje. Las tres veces el
> limite se escribio **sin intentarlo** y las tres las desarmo el revisor intentandolo. Por eso
> lo que sigue separa **dos categorias que no son lo mismo**: *alcanzable pero fuera del DoD* e
> *inalcanzable con este andamiaje*.

**Alcanzable, pero fuera del alcance de esta spec (no es imposible — es que no se pidio):**

- **`window.location.assign("/backoffice")` del camino feliz.** Se pinnea con
  `vi.stubGlobal("window", { location: { assign } })` sobre el andamiaje de
  `login-form-retry.test.ts` — el revisor lo demostro, 1/1 verde, cero paquetes. No es item del
  DoD de esta spec (la navegacion post-login es anterior al ADR 0055 y no la toca), asi que no
  se escribio. **Si alguien la toca, el test es barato: no hay excusa de infraestructura.**

**Inalcanzable con este andamiaje (aca si hace falta otra herramienta):**

- **Los efectos: NINGUN test de esta spec los corre.** `renderToStaticMarkup` los saltea por
  diseño (SSR) y el proxy no puede ejecutarlos, porque invoca el componente como funcion. Es
  justo la forma del bug de la tarea 38 —el aviso borrado desde un `useEffect`— asi que el stub
  del proxy **falla con nombre propio** ante cualquier hook no modelado en vez de tirar un
  `TypeError` sobre `null`: ver la mutacion (i). Lo que queda cubierto es *que el rojo aparece y
  se entiende*, **no** que el efecto se haya ejecutado.
- **El re-render real de React y su batching.** `login-form-retry.test.ts` es un **proxy
  declarado como tal en su encabezado**: stubea `useState` con una celda propia, invoca
  `LoginForm(props)` como funcion y dispara el `onClick` a mano. Pinnea la propiedad que el DoD
  #5 enuncia —**el handler escribe en el mismo slot que siembra `initialError`**— y no pinnea el
  ciclo de render de React, el batching ni el orden de hooks bajo Strict Mode. Su parte
  load-bearing la prueba la mutacion (h); su parte decorativa es el modelo de `useState`.
- **Updates funcionales del setter.** El stub no modela `setError(prev => …)`: guardaria la
  funcion y las aserciones compararian una funcion contra un string. Hoy nadie usa esa forma;
  el modo de falla es **ruidoso, no silencioso**, y esta anotado en el propio archivo.
- **El foco y que un lector de pantalla anuncie el `role="alert"`.** Eso pide un navegador de
  verdad: QA manual del owner y, si algun dia importa, un e2e de Playwright.
- **`(b)` vs `(c)` dentro de vitest**: ver arriba. Los separa `typecheck`, no un test.

## Handoff requerido

Implementador + revisor independiente (`docs/AGENT-WORKFLOW.md`). **Sin migracion** y sin
secreto nuevo: el deploy es el fix.

## Consecuencias asumidas (halladas al implementar, ninguna requiere trabajo)

- **Si el `DELETE` falla, falla CERRADO.** La excepcion sube, Next devuelve 500 y el `return`
  con la sesion valida es inalcanzable: un miembro desactivado no entra ni por error de DB.
  El costo: un error transitorio de Postgres convierte el rebote-con-mensaje en un 500 opaco.
  Se prefiere asi — el modo de falla seguro es el que niega.
- **El `DELETE` es por `user_id`, sin `business_id`**, mientras el guard resuelve el negocio con
  `.limit(1)`. Hoy es inalcanzable (un usuario pertenece a un solo negocio) y es **identico al
  de `setStaffStatus`**, que tiene la misma forma. Si algun dia hay multi-membresia, desactivar
  a alguien en el negocio A le va a matar la sesion del negocio B: hay que revisar los dos
  `DELETE` juntos, no uno solo.
- **`/login` paso de estatico (`○`) a dinamico (`ƒ`)** en el output de `next build`, porque
  `await searchParams` es una Request-time API. Es la consecuencia inevitable de leer el motivo
  de la URL (ADR 0055) y no estaba escrita en ningun lado.
- **La cookie del navegador sobrevive a la revocacion** (se borra la fila de `session`, no la
  cookie). Verificado que `auth.ts` **no** configura `session.cookieCache`, asi que better-auth
  valida contra la DB en cada request y la sesion queda muerta de inmediato. **Si alguien
  enciende `cookieCache`, se abre una ventana** en la que la cookie revocada sigue valiendo.

## Abierto

**HALLAZGO NO DECIDIDO POR EL OWNER — `api/billing/checkout` no filtra por `status`.** Al
auditar que rutas quedan expuestas a la sesion que hoy se crea, aparecio esto: esa ruta resuelve
la membresia por `businessId` + `userId` y **no mira `status`**, asi que un staff desactivado con
sesion fresca puede iniciar un checkout de Stripe del negocio del que lo sacaron. Es **la misma
familia** de hueco que la spec 0055 cerro en `operatorBusiness`, y el fix es una linea. **No se
toca en esta spec porque el owner no lo decidio** (regla de `CLAUDE.md`: lo que el owner no dijo
no se escribe como decision suya). Queda como item propio para que lo decida.

*Nota de alcance evaluada y descartada como hueco:* el resto de las rutas de backoffice resuelve
el negocio con `ownerBusiness`/`programForOwner`, que filtran `role = 'owner'`; como
`setStaffStatus` **prohibe desactivar a un owner**, hoy ningun miembro desactivado las alcanza.
Es correcto por composicion, no por diseño explicito — si algun dia se permite desactivar
owners, esas rutas se vuelven un hueco. Se declara para que quede escrito.

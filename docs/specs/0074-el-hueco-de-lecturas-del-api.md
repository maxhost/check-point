---
spec: 0074
fecha: 2026-09-18
estado: implementada
resumen: Las tres LECTURAS que la UI externa necesita y el API no publica, porque el backoffice de hoy son server components que consultan drizzle en proceso — `GET /api/merchant/session` (rol, negocio, slug, estado), `GET /api/billing/state` (plan y suscripcion, hoy POST-only) y `GET /api/onboarding/state` (retomar el wizard a mitad). Ninguna migracion, ninguna pantalla. El cuarto hueco —metricas del dashboard— queda DECLARADO y AFUERA: es una decision de producto que el owner no tomo.
disjunta: si
archivos: apps/merchant/src/app/api/merchant/session/route.ts, apps/merchant/src/app/api/billing/state/route.ts, apps/merchant/src/app/api/onboarding/state/route.ts, apps/merchant/src/server/session-view.ts, docs/specs/0074-contratos-de-api.md
---

# 0074 — El hueco de lecturas del API

> **Nada de codigo empieza sin esta spec en `cerrada`.**
>
> En tareas mal especificadas los modelos frontier fingen exito **~50% de las veces**. En
> tareas resolubles y bien definidas el reward hacking bajo a **0%**. Cerrar la spec saca
> al agente del regimen donde miente.

## Problema

El ADR 0070 §16 decidio que **el arco entrega API y la UI la construye el owner por fuera**.
Las specs 0067, 0069 y 0072 cumplieron esa decision **para las escrituras**: cada `POST`,
`PUT`, `PATCH` y `DELETE` tiene su contrato HTTP escrito, porque ahi es donde viven los
guards (`requireApiOwner`, el catalogo de entitlements, el eje `core.business.status`).

**Las lecturas nunca necesitaron HTTP, y por eso no existen.** El backoffice de hoy son
*server components* que consultan drizzle **en proceso**. Medido el 2026-09-18:

```
$ grep -rln 'server/db\|drizzle' apps/merchant/src/app/backoffice --include=*.tsx
apps/merchant/src/app/backoffice/page.tsx
apps/merchant/src/app/backoffice/locations/page.tsx
apps/merchant/src/app/backoffice/subscription/page.tsx
apps/merchant/src/app/backoffice/counter/page.tsx
apps/merchant/src/app/backoffice/marketing/new/page.tsx
apps/merchant/src/app/backoffice/marketing/[id]/page.tsx
apps/merchant/src/app/backoffice/marketing/[id]/edit/page.tsx
```

Siete paginas, incluida la principal, que lee `core.subscription` con un `select` directo
(`backoffice/page.tsx:15-19`).

**En el momento en que la UI se va afuera y habla por HTTP —que es exactamente lo que el
ADR 0070 §16 ordena— cada lectura que era in-process se convierte en un endpoint
faltante.** Por eso los cuatro huecos de abajo son **todos de lectura** y ninguno de
escritura: no es un olvido, es la consecuencia mecanica de haber contratado un solo lado.

**Los cuatro huecos, medidos contra el arbol el 2026-09-18:**

| # | Hueco | Evidencia | A quien frena |
|---|---|---|---|
| **A** | **Contexto de sesion.** No hay forma de saber rol, negocio, `slug`, ni `status` | El unico lector publicado es `GET /api/auth/get-session` de better-auth, que devuelve `user` pelado (`id`, `name`, `email`, `emailVerified`, `image` y fechas). Verificado contra `www.checkpass.club`: **200 con cuerpo `null`** sin sesion | `/login` no sabe a donde redirigir; el dashboard no sabe que renderizar; la pantalla de cuenta suspendida no tiene de donde leer su motivo |
| **B** | **Estado de la suscripcion.** No se puede leer el plan | `api/billing/*` es **POST-only**: `cancel`, `checkout`, `interval`, `settle-free`. **Cero `GET`** (verificado por `grep -oE 'export (async )?function (GET\|POST\|…)'` sobre las 4 rutas) | El dashboard no puede decir que plan tenes, en que estado, ni si hay una baja programada |
| **C** | **Estado del wizard.** No se puede retomar un alta a mitad | `onboarding/business` y `onboarding/program` son **POST-only**; `onboarding/prefill` es el unico `GET` y **no lee una sola fila del negocio** (devuelve paises, categorias y el sesgo geografico de los headers) | El wizard de 3 pasos. Si la persona cierra la pestaña en el paso 2, la UI no tiene con que volver |
| **D** | **Metricas del dashboard** | Cero rutas de analitica. Lo unico agregado es `marketing/campaigns/[id]/results`, por campaña. `/backoffice/demo/analytics` es un **mock de `sessionStorage`** (spec 0015) | El dashboard, para cualquier numero |

## Alcance

**Entra: A, B y C.** Los tres son **exponer por HTTP lo que el servidor ya lee**, con el DTO
que ya existe. Ninguno inventa un dato, ninguno toca el esquema.

- `GET /api/merchant/session`
- `GET /api/billing/state`
- `GET /api/onboarding/state`
- El anexo normativo `docs/specs/0074-contratos-de-api.md`, que es **el entregable que
  consume quien construye la UI** — misma forma y mismo rol que `0067`, `0069` y `0072`.

**No entra** (explicito — es lo que evita el scope creep del agente):

- **D, las metricas.** No es un endpoint que falta: es una **pantalla que nadie diseño**.
  «Que numeros muestra el dashboard» es una decision de producto que **el owner no tomo**,
  y esta spec no la toma por el. Queda en §Abierto como *hallazgo a decidir*, no como
  decision aceptada.
- **Ninguna pantalla.** Cero archivos `.tsx` en el diff. ADR 0070 §16.
- **Ningun borrado de `/backoffice/*`.** Lo pide el ADR 0070 §17 pero **depende de que la UI
  nueva exista**; borrarlo ahora deja al owner sin producto. Va cuando la UI aterrice.
- **Ninguna migracion.** Los tres endpoints leen columnas que ya estan en produccion.
- **Ningun endpoint de admin de plataforma** (`bo.checkpass.club`). No existe su API y esta
  spec no la inventa.
- **Ningun cambio a `requireApiOwner`, al catalogo de entitlements ni a los guards.** Esta
  spec **consume** el gate de la 0072; no lo modifica.

## Diseño

### D0 — La regla que gobierna las tres

**Un endpoint de lectura reusa el DTO que ya existe; no escribe un segundo camino de
lectura.** Es la leccion de la 0072 §P1 aplicada de nuevo: el conocimiento de plan vivia en
tres lugares y **ya divergio una vez**. Un `GET` que arme su propio objeto a mano es el
cuarto lugar. Concretamente: **B no compone nada**, delega en `billingStateResponse`, que ya
existe (`api/billing/_auth.ts:240`).

**Y su corolario, que es contrato: ninguna de las tres serializa una clave interna.** Ni
`*ObjectKey` de R2, ni `stripeCustomerId`/`stripeSubscriptionId`, ni
`downgradeRequestedAt`. La regla esta en `CLAUDE.md` y un revisor independiente ya cazo esta
clase de fuga en marca (spec 0025). Las allow-lists positivas que la garantizan **ya
existen** (`toSubscriptionView`, `brandResponse`, `toClientProgram`) y se reusan.

### D1 — `GET /api/merchant/session`

**Es un REPORTERO de estado, no un guard. Esa es la decision central de esta spec y de ella
se derivan las otras cuatro.**

**No pasa por `requireApiOwner` y NO emite los cinco `code` de la 0072.** Si contestara
`403 business_suspended`, **la UI no podria nunca renderizar la pantalla de cuenta
suspendida** — la que el owner pidio textualmente el 2026-09-17 («ver un mensaje de cuenta
suspendida con su razon y boton de contacto»). Un endpoint que reporta el estado no puede
estar gateado por el estado que reporta.

**Contesta SIEMPRE `200`.** Sin sesion devuelve `{ "authenticated": false }`, no un `401`.
Dos motivos: (1) `/login` y la landing lo consultan en cada carga, y «no hay sesion» es el
caso **normal** de esas pantallas, no un error; (2) es la misma forma que ya tiene
`GET /api/auth/get-session` de better-auth (200 con cuerpo `null`), asi que la UI mantiene
un solo modelo mental.

**Que negocio devuelve cuando hay varias membresias:** `orderBy(asc(businesses.createdAt))`
+ `limit(1)`, **exactamente el mismo criterio que `requireBackofficeSession`**
(`auth-guards.ts:106`). Tiene que ser el mismo o la UI y el guard hablan de negocios
distintos. **Un `limit(1)` sin `orderBy` es no determinista** — el revisor de la 0072 cazo
justamente eso en el corte del link magico. La divergencia `asc`/`desc` que la 0072 dejo
declarada (`loyalty-program.ts:66`) **sigue abierta y sigue inalcanzable** (un negocio por
usuario: `onboarding/business:110` contesta 409 si ya hay membresia); esta spec la hereda
declarada, no la cierra.

**Membresia no `active` → `business: null` y `membership: null`, sin revocar nada.**
`requireBackofficeSession` en ese caso **borra las sesiones del usuario** y rebota. Esta ruta
**no puede hacerlo: es un `GET`** y un `GET` con efecto lateral es una trampa (un prefetch
del navegador desloguearia a la persona). Devolver `business: null` logra lo mismo que
importa —**un integrante dado de baja no lee ni un dato del negocio**— sin efecto lateral.
La revocacion sigue ocurriendo donde ya ocurre, en la primera pagina o API que toque.

**`suspensionReason` solo para `role === 'owner'`**, identico a `auth-guards.ts:160-163`: un
integrante no tiene por que leer la nota interna de por que se suspendio la cuenta del
negocio donde trabaja.

**NO devuelve el plan.** Es deliberado y es lo que justifica que B sea un endpoint aparte:
`billingStateResponse` toma un **lock de fila** (`lockBusiness`) y cuenta locales y campañas
activas. Meter eso en la sonda de sesion pondria un lock en cada carga de cada pantalla,
incluida la landing publica. La UI pide el plan **cuando lo necesita**, que es el dashboard.

**Forma de la respuesta** — la normativa esta en el anexo; aca va para cerrar el diseño:

```jsonc
// sin sesion
{ "authenticated": false }

// con sesion, sin negocio todavia (se registro, no hizo el wizard)
{ "authenticated": true,
  "user": { "id": "…", "name": "…", "email": "…", "emailVerified": false },
  "business": null, "membership": null }

// con sesion y negocio
{ "authenticated": true,
  "user": { "id": "…", "name": "…", "email": "…", "emailVerified": true },
  "business": { "id": "…", "name": "…", "slug": "…", "status": "suspended",
                "suspensionReason": "…", "currencyCode": "USD", "timezone": "…" },
  "membership": { "role": "owner", "status": "active" } }
```

`business: null` con `authenticated: true` **es el dato que manda al wizard**. Es tambien la
unica forma de distinguir «tiene que dar de alta» de «tiene que verificar el email», que hoy
la UI solo podria inferir de un 403.

**El DTO vive en una HOJA sin imports: `server/session-view.ts`.** Es la leccion del paso 1
de la 0072 aplicada de nuevo (`server/business-status.ts`): si la forma se define dentro de
`auth-guards.ts` —que importa `next/navigation` y llama a `redirect()`— cualquier consumidor
se arrastra el runtime de ruteo. `auth-guards.ts` **no se modifica**: la ruta compone su
propia consulta con el mismo `orderBy`, y el test de §P3 asevera que las dos coinciden.

### D2 — `GET /api/billing/state`

**Diez lineas.** `requireApiOwner` + `billingStateResponse(auth.business.id)`, la funcion que
ya existe y que **ya es la respuesta de las cuatro rutas POST de billing**. Cuerpo:

```jsonc
{ "subscription": { "plan": "plus", "status": "active", "interval": "month",
                    "pendingPlan": null, "pendingPlanAt": null },
  "activeLocations": 2, "canCancel": true }
```

**SI pasa por `requireApiOwner`** —al reves que D1— y emite los cinco `code` de la 0072 en su
orden. Es dato del owner: un integrante no lee el plan.

**El lock se hereda a proposito.** `billingStateResponse` abre transaccion y toma
`lockBusiness` antes de leer, porque su contrato pide que la lectura y la decision de
`canCancel` ocurran **en la misma transaccion lockeada**. Escribir un camino de lectura sin
lock para ahorrarselo produciria un `canCancel` que puede mentir, y seria el segundo lugar
donde vive la regla. **Costo declarado, no perseguido.**

### D3 — `GET /api/onboarding/state`

**Devuelve HECHOS, nunca un numero de paso.** El ADR 0070 prohibe explicitamente una columna
`onboarding_step`, y un `"step": 2` en la respuesta es esa columna disfrazada de JSON: el dia
que el wizard tenga 4 pantallas, el numero miente. La UI deriva el paso de los hechos.

```jsonc
{ "authenticated": true,
  "business": null | { "id": "…", "name": "…", "slug": "…" },
  "program": null | { "id": "…", "kind": "stamps" },
  "stampImage": false }
```

**NO lleva el gate de email, a proposito, y esto es precedente ya establecido:** el wizard
corre **antes** de la verificacion (ADR 0070 §11), que es exactamente por lo que
`POST /api/onboarding/program` tampoco lo lleva (0072, cierre de F1). Un gate de email aca
haria irretomable el unico flujo que ocurre antes de verificar. **Si lleva sesion**: sin
sesion contesta `{ "authenticated": false }`, igual que D1.

**Alcance minimo a proposito:** es «que falta para terminar el alta», **no** el checklist
derivado de la 4ª spec del ADR 0070 §9 (logo, colores, costos, staff, wallet…), que esta
**diferido con seis decisiones del owner abiertas** y un agujero medido (los colores nacen
con default, asi que no son derivables). Los tres hechos de arriba **si** son derivables sin
ambiguedad y sin migracion. Esta spec no se come a la 4ª.

### Arquitectura de referencia

- **ADR 0070 §16** — el arco entrega API, no interfaz. Es lo que hace de esta spec un
  requisito y no una mejora.
- **ADR 0070 §11** — el wizard corre antes de la verificacion de email. Fija D3.
- **ADR 0073 §1** — `core.business.status` y el plan son dos ejes que no se mezclan, y el
  orden de evaluacion es contrato. Fija D2 y explica por que D1 no puede estar gateado.
- **ADR 0055 §3** — better-auth autentica contra `merchant_auth` y no sabe nada de
  `core.business_membership`. Es la razon de que el contexto de negocio tenga que salir de
  una consulta nuestra y no de la sesion.
- **`CLAUDE.md`** — una ruta que devuelve una entidad al navegador nunca serializa claves
  internas; blindar con un test por entidad.

## Archivos

| Archivo | Accion |
|---|---|
| `apps/merchant/src/server/session-view.ts` | crear (hoja, 0 imports) |
| `apps/merchant/src/app/api/merchant/session/route.ts` | crear |
| `apps/merchant/src/app/api/billing/state/route.ts` | crear |
| `apps/merchant/src/app/api/onboarding/state/route.ts` | crear |
| `apps/merchant/src/app/api/merchant/session/session.neon.integration.test.ts` | crear |
| `apps/merchant/src/app/api/billing/state/billing-state.neon.integration.test.ts` | crear |
| `apps/merchant/src/app/api/onboarding/state/onboarding-state.neon.integration.test.ts` | crear |
| `apps/merchant/src/server/read-surfaces-leak.test.ts` | crear |
| `docs/specs/0074-contratos-de-api.md` | crear (anexo normativo) |
| `apps/merchant/src/server/billing-routes.test.ts` | **editar — CORRECCION del 2026-09-18, ver abajo** |
| `docs/INDEX.md` | editar (fila de 3 lineas) |
| `docs/TASKS.md` | editar |

**CORRECCION DE ESTA TABLA, 2026-09-18, durante la implementacion.** La tabla original **no
listaba `billing-routes.test.ts`, y la afirmacion de «diff aditivo puro» era falsa para B.** Ese
archivo tiene un barrido que lee el filesystem bajo `api/billing/**`, extrae los handlers
exportados y exige **igualdad EXACTA** contra su lista `HANDLERS`; crear `GET /api/billing/state`
lo pone en rojo por construccion:

```
FAIL src/server/billing-routes.test.ts > every handler under api/billing/** is covered by HANDLERS
AssertionError: expected [ 'POST /api/billing/cancel', …(3) ] to deeply equal [ 'GET /api/billing/state', …(4) ]
```

**El barrido esta funcionando como debe** —esa es su razon de ser— y lo que fallo es esta spec, que
subespecifico su propio alcance. La ampliacion la autorizo el orquestador **acotada a ese unico
archivo y a AGREGAR la fila**: el `toEqual` y el piso del barrido **no se tocan**, y si el piso
queda corto **sube**, nunca baja. Queda anotado aca porque una spec que no dice que archivos toca
es exactamente lo que el ADR 0071 vino a evitar.

### Disjunta?

**Si.** No hay otra spec abierta en el INDEX. Los cuatro archivos de codigo son **todos
nuevos**; no se edita una sola linea de `auth-guards.ts`, `api-owner.ts`,
`billing/_auth.ts`, `billing/view.ts` ni de ninguna ruta existente. El diff es **aditivo
puro**, que es lo que hace que la unica forma de romper algo sea que la suite entera lo
cace.

### Archivos compartidos

Ninguno. Los tres endpoints consumen helpers que **ya estan en `main`**
(`requireApiOwner`, `billingStateResponse`, `toSubscriptionView`).

## Definition of Done

- [ ] Las tres rutas existen y responden el cuerpo **literal** del anexo
      `0074-contratos-de-api.md`, campo por campo.
- [ ] `GET /api/merchant/session` responde **200** en los cuatro casos: sin sesion, con
      sesion sin negocio, con sesion y negocio `active`, con sesion y negocio `suspended`.
      **Ningun caso responde 401 ni 403.**
- [ ] Con negocio `suspended`, la respuesta de `/api/merchant/session` **incluye
      `suspensionReason`** para `role='owner'` y lo trae **`null`** para `role='staff'`.
- [ ] Una membresia no `active` produce `business: null` **y ninguna sesion borrada**
      (aseverado contando filas de `session` antes y despues).
- [ ] `GET /api/billing/state` emite los cinco `code` de la 0072 en su orden, verificado
      caso por caso.
- [ ] **Cero fuga:** ninguna de las tres respuestas contiene `stripeCustomerId`,
      `stripeSubscriptionId`, `downgradeRequestedAt` ni ninguna clave que matchee
      `/ObjectKey$/`. Aseverado sobre el **conjunto exacto de claves**, no por ausencia.
- [ ] `GET /api/onboarding/state` responde **sin email verificado** (no lleva ese gate).
- [ ] El anexo `0074-contratos-de-api.md` existe y **cada ruta tiene su fila**. Una ruta sin
      fila no esta terminada; un `code` que el contrato declara y la ruta no emite es FAIL.
- [ ] **Cero archivos `.tsx` en el diff** (`git diff --name-only | grep '\.tsx$'` vacio).
- [ ] **Cero migraciones** en el diff.
- [ ] Gates de root sobre Node 24: `typecheck --force`, `lint`, `format:check`, `test` con
      Neon, `build --force`. `rg MUTATION apps` **vacio**.

## Plan de pruebas y verificación

**Presupuesto: 5 mutaciones. Condicion de corte (ADR 0062): si dos vueltas seguidas
terminan en «el fix abrio la siguiente», se corta y se declara.** Lo que quede afuera se
**declara**, no se persigue.

Las clases de error que tienen que cazar son **las plausibles**, no las exoticas:

| id | Mutacion | Invariante que ataca | Rojo esperado |
|---|---|---|---|
| **M1** | Hacer que `/api/merchant/session` conteste `401` sin sesion | El caso «no logueado» es normal, no un error; `/login` lo consulta en cada carga | el caso «sin sesion» de `session.neon` |
| **M2** | Quitar el `orderBy(asc(createdAt))` de la consulta de `/api/merchant/session` | La UI y `requireBackofficeSession` resuelven **el mismo** negocio. Un `limit(1)` sin orden es no determinista | el test de §P3, con dos membresias sembradas |
| **M3** | Devolver `suspensionReason` tambien para `role='staff'` | Un integrante no lee la nota interna del negocio | el caso staff de `session.neon` |
| **M4** | Sustituir `toSubscriptionView(row)` por `row` en `billing/state` | La allow-list positiva es lo unico entre Stripe y el navegador | `read-surfaces-leak.test.ts` |
| **M5** | Agregar el gate de email a `/api/onboarding/state` | El wizard corre antes de verificar; el gate lo volveria irretomable | el caso «email sin verificar» de `onboarding-state.neon` |

**Cada mutacion sigue el protocolo del repo**, sin excepcion: etiqueta `MUTATION`, `shasum`
de la copia limpia registrado **ANTES** de mutar, fila de bitacora abierta **ANTES** de
medir, y reversion verificada con `diff` contra la copia limpia + `shasum` coincidente.

**Y el control que las hace valer:** cada mutacion tiene que dejar rojo **el test que le
corresponde y por la asercion correcta** — se pega la asercion literal en la bitacora, no
«fallo». Una mutacion que tira la suite entera al piso no probo que el oraculo discrimina.

- [ ] Integracion (Neon), `session.neon`: los cuatro casos del DoD + el de membresia no
      `active`, **contando filas de `session` antes y despues** (M1, M3).
- [ ] Integracion (Neon), `session.neon`: dos membresias del mismo usuario con `created_at`
      distintos → la ruta devuelve **la mas vieja**, la misma que `requireBackofficeSession`
      (M2). **Es el unico test que necesita sembrar dos negocios.**
- [ ] Integracion (Neon), `billing-state.neon`: los cinco `code` de la 0072 (`unauthorized`,
      `not_owner`, `email_not_verified`, `business_suspended`, `business_closed`) **en su
      orden**, mas el camino feliz.
- [ ] Integracion (Neon), `onboarding-state.neon`: sin negocio, con negocio sin programa, con
      los dos; y el caso **email sin verificar responde 200** (M5).
- [ ] Unitaria, `read-surfaces-leak.test.ts`: **el conjunto EXACTO de claves** de las tres
      respuestas, con el estilo de `expectCrossesExactly` (no `not.toHaveProperty`, que pasa
      en verde si el objeto cambia de forma) (M4).
- [ ] **Piso de barrido**: `expect(SURFACES.length).toBe(3)` en el test de fuga, para que un
      `it.each` vacio no pase en verde. Es lo que el revisor de la 0072 verifico.
- [ ] Comandos exactos, con **Node 24 y scripts de ROOT**:
      `export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use` y despues
      `pnpm run typecheck --force`, `pnpm run lint`, `pnpm run format:check`,
      `pnpm run test`, `pnpm run build --force`, `rg MUTATION apps`.
- [ ] Verificacion manual: `curl -s https://www.checkpass.club/api/merchant/session` sin
      cookie devuelve **`{"authenticated":false}`** con status **200**. **Contra `www`, no
      contra el apex**, que responde 308.

**Limite que se DECLARA y no se persigue:** el caso de un `business.status` **desconocido**
no es alcanzable contra base — el `CHECK` de la migracion `0036` lo rechaza incluso por SQL
crudo (`23514 business_status_check`), medido en la 0072. La polaridad se mide donde si se
puede: sobre la funcion pura.

## Handoff requerido

**UN implementador para toda la spec y UN revisor independiente al final** (ADR 0071), no un
ciclo por paso. Los gates completos se corren **una vez por spec**. Solo un `PASS`
verificable permite marcar la spec como `implementada`.

**Lo que NO se recorta:** el protocolo de mutaciones y la revision independiente. En la 0068
el revisor cazo un oraculo que no existia y la fuga sobrevivia a 1027 tests.

## Abierto

**Nada de esto bloquea A, B ni C. La spec esta `cerrada` para los tres.**

1. **HALLAZGO A DECIDIR, no decision del owner — las metricas del dashboard (hueco D).**
   No hay una sola ruta de analitica y `/backoffice/demo/analytics` es un mock de
   `sessionStorage` (spec 0015). **Que numeros muestra el dashboard es producto y el owner no
   lo dijo**, asi que no se escribe como decision suya. Lo que hay que preguntarle, concreto:
   ¿que tres numeros quiere ver al abrir el dashboard, y con que ventana de tiempo? Sin esa
   respuesta el endpoint no se puede especificar sin inventarlo.
2. **Heredada y sigue abierta:** la divergencia `asc`/`desc` de la 0072 §D3 —cuatro `asc`
   contra un `desc` en `loyalty-program.ts:66`—. **Inalcanzable hoy** (un negocio por usuario)
   y declarada alli. Esta spec adopta el `asc` y **no la cierra**: cerrarla toca archivos que
   no estan en su tabla.
3. **Heredada:** que pasa del lado del CONSUMIDOR de un negocio `closed` (pases ya emitidos,
   sellos acumulados, QR circulando). El owner describio la superficie del comercio, no esta.
   No la toca esta spec.

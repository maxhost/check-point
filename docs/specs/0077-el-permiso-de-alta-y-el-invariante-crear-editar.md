---
spec: 0077
fecha: 2026-09-18
estado: implementada
resumen: Cierra el bypass del gate de email, reproducido contra Neon (la misma sesion sin verificar reescribe el programa por `POST /api/onboarding/program` con 200 y come 403 por `PUT /api/loyalty-program`). El invariante baja al WRITER —`saveProgram` aprende que crear no es editar— y en la puerta lo reemplaza un PERMISO DE ALTA que el servidor escribe en la fila de la SESION al crear la cuenta: no viaja en ningun request, `input: false` lo hace no-seteable desde la API, y caduca con lo que pase primero (email verificado · 5 min tras el alta completa · 60 min desde la creacion de la cuenta). La puerta del staff NUNCA lo recibe.
disjunta: no
archivos: apps/merchant/drizzle/0037_onboarding_grant.sql, apps/merchant/src/server/schema/auth.ts, apps/merchant/src/server/auth.ts, apps/merchant/src/server/merchant-session.ts, apps/merchant/src/server/onboarding-grant.ts, apps/merchant/src/server/loyalty-program.ts, apps/merchant/src/app/api/merchant/auth/start/route.ts, apps/merchant/src/app/api/onboarding/program/route.ts, apps/merchant/src/app/api/loyalty-program/route.ts
---

# 0077 — El permiso de alta y el invariante crear/editar (spec B del ADR 0076)

> **Nada de codigo empieza sin esta spec en `cerrada`.**
>
> No es ceremonia. En tareas **imposibles o mal especificadas** los modelos frontier
> fingen exito **~50% de las veces**. La subespecificacion es el gatillo medido.

## Problema

**El gate de email es evadible hoy, y esta reproducido contra Neon** (2026-09-18, sonda
temporal ya borrada). **Un solo usuario con `emailVerified: false`, una sola sesion:**

| Llamada | Resultado medido |
|---|---|
| `POST /api/onboarding/program` (2da vez, programa existente) | **200** `{"created":false}`, y la base quedo `{"target":50,"unitName":"sello"}` — **reescrito** desde `target: 8` |
| `PUT /api/loyalty-program`, **misma cookie** | **403** `{"code":"email_not_verified"}` |

La causa: `saveProgram` es **un writer con dos puertas** y el gate vive en **una** de ellas.
La puerta del wizard no solo crea — **edita**, porque `saveProgram` hace
`const id = program ? program.id : randomUUID()` (`loyalty-program.ts:148`).

**Es la SEGUNDA vez que se abre la misma grieta.** El comentario de
`loyalty-program.ts:109-116` documenta que la spec 0072 encontro lo mismo con el eje
`status` y lo arreglo **bajando el invariante al writer**. El del email quedo afuera.

## Alcance

**Entra:**

- La columna del permiso en `merchant_auth.session` y su migracion.
- `session.additionalFields` en `auth.ts` con **`input: false`**.
- La emision del permiso en `POST /api/merchant/auth/start`, **solo** en la rama del email
  desconocido (la que crea la cuenta).
- El modulo hoja `onboarding-grant.ts`: la decision pura + la lectura.
- El invariante **crear ≠ editar** en `saveProgram`, y el acortado a 5 minutos cuando el
  alta se completa.
- Las dos rutas que llaman a `saveProgram` pasan la decision ya resuelta.

**No entra** (explicito):

- **Unificar las dos rutas en una.** Es la spec C del ADR 0076. Esta spec deja las dos
  puertas y las hace **seguras**; la C las fusiona. El orden importa: fusionar antes de
  tener el invariante en el writer seria mover el bug, no arreglarlo.
- **`GET /api/loyalty-program/qr`.** Conserva el guard de la spec 0075 tal cual (ADR 0076
  §3). El permiso gobierna **escrituras**; el QR es lectura.
- **`POST /api/onboarding/business`.** Medido: es **create-only** — devuelve 409 si ya hay
  membresia (`business/route.ts:105-113`), asi que no tiene camino de edicion que cerrar.
- **Las otras 11 entradas del ADR 0073 §1.** Conservan `requireApiOwner` entero.
- **Cualquier `.tsx`.** La UI la construye el owner por fuera (ADR 0070 §16).
- **Puntos / `kind` / TOS por pais.** Specs C y A.

## Diseño

### Especificación técnica

#### 1. Modelo de datos

Una columna nueva, **nullable**, en `merchant_auth.session`:

```sql
ALTER TABLE "merchant_auth"."session"
  ADD COLUMN "onboarding_grant_until" timestamptz;
```

**Por que un INSTANTE y no un booleano:** un `timestamptz` codifica los dos topes de tiempo
en un solo campo y hace que «caducado» no necesite que nadie escriba nada. Un booleano
obligaria a un job o a un writer por cada corte.

En `schema/auth.ts`, dentro de `sessions`:

```ts
onboardingGrantUntil: timestamp("onboarding_grant_until", { withTimezone: true }),
```

**Invariante del dato:** la columna es **monotona hacia abajo**. Se escribe una vez al
crear la sesion y despues **solo puede adelantarse** (nunca posponerse). El acortado de §4
usa `least(...)`, no una asignacion.

#### 2. Configuración de better-auth

En `betterAuth({...})` de `auth.ts`:

```ts
session: {
  additionalFields: {
    onboardingGrantUntil: { type: "date", required: false, input: false },
  },
},
```

**`input: false` es la linea critica de seguridad de esta spec.** Es lo que hace que el
campo **no sea seteable desde ninguna entrada de la API**. Sin ella, el permiso pasaria a
ser exactamente lo que el ADR 0076 descarta: un claim aceptado desde el cliente.

**No se agrega ningun PLUGIN.** `additionalFields` es config del core y **no publica
endpoints**; un plugin si lo haria por el catch-all `api/auth/[...all]` — la leccion de la
spec 0046 que vive en la skill `gotchas-del-repo`.

#### 3. Emisión del permiso

`openMerchantSession` gana un segundo parametro **explicito y opcional**:

```ts
export async function openMerchantSession(
  userId: string,
  options: { onboardingGrantUntil?: Date } = {},
): Promise<string>
```

Internamente, la firma real es `createSession(userId, dontRememberMe, override, overrideAll)`
(`better-auth/dist/db/internal-adapter.mjs:176-206`): el `override` se mergea en la fila
(linea 193) y `defaultAdditionalFields` se aplica despues (linea 204), con `overrideAll`
re-aplicando el `override` al final (linea 205).

> **CORREGIDO el 2026-09-18.** Esta seccion decia que `defaultAdditionalFields` **pisa** al
> `override` y que **«por eso»** hace falta `overrideAll: true`. **Es FALSO**, y lo cazo el
> revisor: `getSessionDefaultFields` (`better-auth/dist/db/schema.mjs:141-146`) hace
> `for (const key in fields) if (fields[key].defaultValue !== void 0)` — **solo emite campos
> con `defaultValue`**, y `onboardingGrantUntil` no tiene ninguno, asi que
> `defaultAdditionalFields` sale `{}` y no pisa nada. Reproducido por el orquestador en la
> fuente, y por la mutacion R4 del revisor (con `overrideAll: false` **no se cae ningun
> test**). **`overrideAll: true` es INOCUO pero REDUNDANTE hoy**; se conserva como defensa
> por si alguien le pone un `defaultValue` al campo, y **el docblock del codigo tiene que
> decir eso y no la causa falsa**. Error del orquestador al escribir la spec, no del
> implementador.

La llamada va:

```ts
ctx.internalAdapter.createSession(
  userId,
  false,
  options.onboardingGrantUntil ? { onboardingGrantUntil: options.onboardingGrantUntil } : {},
  true,
);
```

**QUIEN LO PASA, Y QUIEN NO — es el invariante de autorizacion de esta spec:**

| Llamador | Permiso |
|---|---|
| `api/merchant/auth/start` — **rama del email DESCONOCIDO** (crea la cuenta) | **SI**: `now() + 60 min` |
| `api/merchant/auth/start` — rama del email conocido (`sendMagicLink`) | **NO abre sesion**, asi que no aplica |
| `api/merchant/auth/staff` — login de staff por PIN | **NUNCA** |

El tope de 60 minutos vive en una constante exportada del modulo hoja
(`ONBOARDING_GRANT_MINUTES = 60`), no como literal en la ruta.

#### 4. Lectura, decisión y caducidad

Modulo hoja nuevo, `server/onboarding-grant.ts`. **Hoja a proposito**: la decision tiene que
ser importable desde `loyalty-program.ts` sin arrastrar `next/server` ni better-auth — es la
misma razon por la que `business-status.ts` existe separado de `api-owner.ts`.

```ts
export const ONBOARDING_GRANT_MINUTES = 60;
export const ONBOARDING_GRANT_AFTER_COMPLETION_MINUTES = 5;

/** PURA. El permiso corre si la sesion lo tiene vigente Y el email NO esta verificado. */
export function onboardingGrantActive(input: {
  onboardingGrantUntil: Date | null | undefined;
  emailVerified: boolean;
  now?: Date;
}): boolean;
```

**Las tres condiciones de cierre del ADR 0076 §4, y como las implementa esta funcion:**

| Corte | Como se aplica |
|---|---|
| **Email verificado** | `emailVerified === true` → `false`. **Sin escribir nada**: se evalua en la lectura. |
| **60 min desde la cuenta** | el valor que `auth/start` escribio ya venció. |
| **5 min tras el alta completa** | el acortado de §5 ya adelanto la columna. |

**Fail-closed:** `onboardingGrantUntil` ausente, `null` o invalido → `false`.
`emailVerified` que no sea exactamente `true` cuenta como **no verificado** (que es lo que
**habilita** el permiso), pero eso nunca abre nada por si solo: sin instante vigente el
permiso no corre. El `!== true` de `requireApiOwner` (paso 3) **no se toca**.

#### 5. El invariante en el writer

`saveProgram` recibe un tercer argumento **obligatorio** — obligatorio para que el typecheck
obligue a cada puerta presente y futura a declarar con que autorizacion escribe:

```ts
export async function saveProgram(
  userId: string,
  rawInput: unknown,
  caller: { emailVerified: boolean; onboardingGrantActive: boolean },
)
```

**La regla, y va DESPUES de resolver el owner y el eje `status`** (mismo orden que el ADR
0073 §1: quien no es owner tiene que recibir `not_owner`, no una pista sobre el email):

```
si (program existe)            → es EDICION
   y NO (emailVerified || onboardingGrantActive)
   → 403 LoyaltyError, code `email_not_verified`
si (program NO existe)         → es CREACION → permitida siempre
```

**Crear siempre se permite** — es la decision del owner del ADR 0070 §11 («para el alta no
pedimos verificacion») y no depende del permiso: una cuenta sin verificar con el permiso ya
caducado todavia puede crear su primer programa.

**El acortado de los 5 minutos** ocurre **en la misma transaccion que crea el programa**,
cuando `created === true` y el caller traia el permiso activo:

```sql
UPDATE merchant_auth.session
   SET onboarding_grant_until = least(
         onboarding_grant_until,
         now() + interval '5 minutes')
 WHERE user_id = $1
   AND onboarding_grant_until IS NOT NULL
```

**`least(...)` y no asignacion**: preserva la monotonia de §1. Si al usuario le quedaban 2
minutos del tope de 60, el alta completa **no se los extiende a 5**.

Se acortan **todas** las sesiones del usuario, no solo la que escribio: el permiso es del
alta, no del navegador, y dejar viva la de otra pestaña reabriria la ventana.

#### 6. Las dos puertas

Ninguna de las dos decide: **resuelven** y pasan.

- `POST /api/onboarding/program`: ya tiene `session` de `getSession`. Calcula
  `onboardingGrantActive({...})` y lo pasa. **Su `code` de fallo es `email_not_verified`**,
  el mismo de la puerta gateada — el `LoyaltyError` ya viaja con `code` por el
  `error.code ?? codeForStatus(...)` que la 0072 dejo puesto (`program/route.ts:66`).
- `PUT /api/loyalty-program`: pasa por `requireApiOwner`, que **ya corto** a los no
  verificados en su paso 3. Le pasa `{ emailVerified: true, onboardingGrantActive: false }`.
  **No se le afloja el gate a esta puerta**: la spec no la toca mas que para el argumento.

### Arquitectura de referencia

- **ADR 0076** — este trabajo es su spec B. Las siete decisiones y sus alternativas
  descartadas (usuario de sistema, flag en el request, token firmado del cliente).
- **ADR 0073 §1** — el orden de evaluacion del gate es la regla, no una optimizacion.
- **ADR 0070 §11** — el motivo del gate es de negocio; §9 — el progreso se DERIVA de hechos.
- **Spec 0075** — el QR y su guard propio, que esta spec no toca.
- **Spec 0046 / skill `gotchas-del-repo`** — un plugin de better-auth publica endpoints;
  `additionalFields` no.

## Archivos

| Archivo | Accion |
|---|---|
| `apps/merchant/drizzle/<NNNN>_onboarding_grant.sql` | crear (via `drizzle-kit generate`) |
| `apps/merchant/src/server/schema/auth.ts` | editar — la columna |
| `apps/merchant/src/server/auth.ts` | editar — `session.additionalFields` |
| `apps/merchant/src/server/merchant-session.ts` | editar — 2o parametro |
| `apps/merchant/src/server/onboarding-grant.ts` | **crear** — hoja pura + constantes |
| `apps/merchant/src/server/onboarding-grant.test.ts` | **crear** — tabla de casos |
| `apps/merchant/src/server/loyalty-program.ts` | editar — 3er argumento + invariante + acortado |
| `apps/merchant/src/app/api/merchant/auth/start/route.ts` | editar — emite el permiso |
| `apps/merchant/src/app/api/onboarding/program/route.ts` | editar — resuelve y pasa |
| `apps/merchant/src/app/api/loyalty-program/route.ts` | editar — pasa el argumento |
| `apps/merchant/src/server/onboarding-grant.neon.integration.test.ts` | **crear** |
| `apps/merchant/src/server/onboarding-program.neon.integration.test.ts` | editar — casos nuevos |

### Disjunta?

**Si.** Las specs A (TOS por pais) y C (una ruta + `kind`) del ADR 0076 **no estan escritas
todavia**, asi que no hay colision viva. Cuando se escriban:

- **Contra A:** A toca `onboarding/program-defaults.ts`, `loyalty-program/terms.ts` y
  semillas. **Cero solape.**
- **Contra C:** C toca `loyalty-program.ts` y las dos rutas de programa. **COLISIONA.** Por
  eso C va **despues** de esta, serializada — y ademas depende de que el invariante ya este
  en el writer.

## Definition of Done

- [ ] `pnpm typecheck`, `pnpm run lint`, `pnpm run format:check`, `pnpm run build` y
      `pnpm run test` **con el env de integracion Neon cargado** (`set -a; . ./.env.integration.local; set +a`), los cinco verdes, **0 failed y 0 skipped** en los archivos Neon.
- [ ] **`pnpm test:e2e` NO aplica**: esta spec no toca ningun `.tsx` ni CSS global. Se
      declara y no se corre.
- [ ] La migracion aplicada a la rama de integracion y **verificada por SQL**: la columna
      existe, es nullable y es `timestamptz`.
- [ ] **EL BYPASS ESTA CERRADO**, con el mismo montaje que lo encontro: sesion
      `emailVerified:false`, primer POST **201**, segundo POST **403 `email_not_verified`**,
      y la fila en la base **sin cambiar** (`target` sigue en el valor original).
- [ ] **El alta sigue funcionando**: con el permiso vigente, crear el primer programa da
      **201** sin verificar el email.
- [ ] **La puerta del staff NUNCA recibe el permiso**: sesion abierta por
      `api/merchant/auth/staff` tiene `onboarding_grant_until` **NULL**.
- [ ] **`input: false` muerde**: el campo no se puede setear desde una entrada de la API.
- [ ] **Los tres cortes**, cada uno con su caso.
- [ ] **Monotonia**: completar el alta con 2 minutos restantes **no** los extiende a 5.
- [ ] `rg 'SinGateDeEmail' apps` sigue devolviendo **exactamente una** ruta (la del QR): esta
      spec **no** agrega excepciones al gate.
- [ ] `requireApiOwner` queda **byte por byte igual** — verificado por `shasum` de su cuerpo
      contra `git show HEAD:`.

## Plan de pruebas y verificación

### Presupuesto y condición de corte (ADR 0062)

**5 mutaciones, y la clase de error que tienen que cazar es una sola: que el permiso abra
mas de lo que debe, o que el gate siga sin cerrar la edicion.** Si dos vueltas seguidas
terminan en «el fix abrio la siguiente», se corta y se reporta.

| # | Mutacion | Oraculo que DEBE ponerse rojo |
|---|---|---|
| M1 | `onboardingGrantActive` devuelve `true` cuando el instante ya vencio | el caso del tope de 60 min |
| M2 | Quitar `input: false` de `additionalFields` | el test que prueba que el campo no es seteable |
| M3 | `auth/staff` pasa el permiso | el test de la puerta del staff |
| M4 | El invariante trata la EDICION como creacion (`if (false)`) | el test del bypass (2do POST) |
| M5 | El acortado usa asignacion en vez de `least(...)` | el test de monotonia |

Cada una: `shasum` limpio **antes**, etiqueta `MUTATION`, revertir con `diff` contra la copia
limpia. Protocolo completo en la skill `protocolo-de-verificacion`.

### Pruebas

- [ ] **Unitaria pura** (`onboarding-grant.test.ts`): tabla de casos de
      `onboardingGrantActive` — vigente+no verificado → `true`; vigente+verificado →
      `false`; vencido → `false`; `null`/`undefined`/fecha invalida → `false`.
- [ ] **Integracion Neon — el bypass** (el caso que origino la spec): `emailVerified:false`,
      POST #1 → 201; POST #2 → **403 `email_not_verified`**; y un `select` que prueba que la
      `configuration` **no cambio**. *La asercion de la base es la que importa: un 403 con la
      fila reescrita seria un falso verde.*
- [ ] **Integracion Neon — el alta no se rompe**: con permiso vigente, POST #1 → **201**.
- [ ] **Integracion Neon — corte por email**: se verifica el email → **el PERMISO se apaga**
      (`onboardingGrantActive` pasa a `false`) **sin que nadie toque la columna**, y la edicion
      sigue dando **200** porque ahora la habilita el email.
      > **CORREGIDO el 2026-09-18.** Esta linea decia «la edicion pasa a **403**» y era
      > **incoherente con el §5 de esta misma spec**: la regla es
      > `emailVerified || onboardingGrantActive`, asi que verificar el email **abre** la edicion.
      > Lo cazo el implementador y el orquestador lo reprodujo contra Neon (200, no 403). No es
      > un cambio de alcance: es un oraculo mal escrito que se arregla, no se cumple.
- [ ] **Integracion Neon — corte por 60 min**: sesion con la columna en el pasado → 403.
- [ ] **Integracion Neon — corte por alta completa**: tras el 201, la columna del usuario
      quedo `<= now() + 5 min`, y **todas** sus sesiones acortadas, no solo una.
- [ ] **Integracion Neon — monotonia**: columna a `now()+2min`, se completa el alta, la
      columna **sigue** en `now()+2min`.
- [ ] **Integracion Neon — aislamiento del staff**: login por PIN → `onboarding_grant_until`
      **NULL**.
- [ ] **Autorizacion**: el permiso **no** habilita ninguna de las otras 11 entradas del ADR
      0073 §1. Reusar el barrido de `api-owner-surfaces.test.ts`: con una sesion con permiso
      vigente, las 11 siguen devolviendo `email_not_verified`.
- [ ] **Regresion**: `PUT /api/loyalty-program` sigue dando 403 a los no verificados.
- [ ] Comandos exactos:
      `export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use` ·
      `set -a; . ./.env.integration.local; set +a` ·
      `pnpm --filter @mi-pasaporte/merchant db:migrate` ·
      `pnpm run typecheck && pnpm run lint && pnpm run format:check && pnpm run build && pnpm run test`
- [ ] **Verificacion manual**: NO la hace el implementador. Es el QA del owner, y va junto
      con las specs A y C (pedido del owner: probar todo de una sola vez).

## Handoff requerido

Formato de `docs/AGENT-WORKFLOW.md`. **UN implementador para toda la spec y UN revisor
independiente al final** (ADR 0071). El revisor produce un `PASS` con evidencia ejecutada
antes de que esta spec pase a `implementada`.

## Abierto

Nada que bloquee.

**Declarado y fuera de alcance, no olvidado:** el permiso acota las escrituras del alta,
pero **no cambia que una cuenta sin verificar pueda crear un negocio con un email que no le
pertenece** — eso es consecuencia directa de «para el alta no pedimos verificacion» (ADR
0070 §11) y de que un email desconocido abra sesion (`auth/start`). Esta spec no lo empeora
ni lo arregla; se nombra para que no se confunda con un hallazgo nuevo.

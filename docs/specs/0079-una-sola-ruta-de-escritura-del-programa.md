---
spec: 0079
fecha: 2026-09-18
estado: cerrada
resumen: Las DOS puertas HTTP que escriben el programa se funden en UNA —decision textual del owner: «una sola ruta de api si hacen lo mismo»— y esa ruta acepta `kind`, porque la API no niega una modalidad que el dominio soporta solo porque la pantalla no exista (ADR 0076 §6). `POST /api/onboarding/program` se BORRA; queda `PUT /api/loyalty-program` con un cuerpo donde todo lo que el servidor puede completar con seguridad es opcional y lo que NO puede —el bloque de dinero de Puntos— es obligatorio. Va TERCERA y serializada: fundir las puertas antes de que el invariante viva en el writer (spec 0077) seria mover el bug en vez de arreglarlo.
disjunta: no
archivos: apps/merchant/src/app/api/loyalty-program/route.ts, apps/merchant/src/app/api/onboarding/program/route.ts, apps/merchant/src/server/onboarding/program-defaults.ts, apps/merchant/src/server/loyalty-program/validation.ts, apps/merchant/src/server/api-owner-surfaces.test.ts, apps/merchant/src/app/[locale]/(merchant)/business/onboarding/_lib/onboarding-api.ts, docs/specs/0079-contratos-de-api.md
---

# 0079 — Una sola ruta de escritura del programa, y acepta `kind` (spec C del ADR 0076)

> **Nada de codigo empieza sin esta spec en `cerrada`.**

## Problema

**Dos endpoints escriben el mismo programa y llaman al mismo writer:**

| Ruta | Cuerpo | Guard | Emite `code`? |
|---|---|---|---|
| `POST /api/onboarding/program` | corto: `{target, reward}` | `getSession` a mano | si |
| `PUT /api/loyalty-program` | `ProgramInput` completo | `requireApiOwner` | **no** |

Los dos terminan en `saveProgram`. **Dos puertas sobre un writer es exactamente lo que
produjo el bypass de la spec 0077, y antes el del eje `status` en la 0072** — la misma
grieta, dos veces, porque un invariante puesto en una puerta no esta en la otra.

**Y la puerta corta niega `points`** aunque el dominio lo soporte: `composeWizardProgramInput`
fija `kind: "stamps"` a mano (`program-defaults.ts:119-131`) y el cuerpo ni lee el campo,
mientras `validation.ts:11-12` habilita `points` **y** `stamps`.

## Alcance

**Entra:**

- **Borrar** `POST /api/onboarding/program`.
- `PUT /api/loyalty-program` pasa a ser **la unica** ruta de escritura, con el compositor
  adentro: cuerpo corto o completo.
- Aceptar `kind: "points" | "stamps"`, con los campos que cada modalidad exige.
- `code` estables en los errores de esa ruta.
- Apuntar el adaptador del wizard (`onboarding-api.ts`) a la ruta unica.
- El contrato escrito (`0079-contratos-de-api.md`).

**No entra** (explicito):

- **`cashback` y `tiers`.** Estan en el CHECK del esquema pero **no** en `enabledKinds`
  (`validation.ts:11-12`): habilitarlas es trabajo de DOMINIO, no de contrato (ADR 0076 §6).
  Siguen dando 422 «Esta modalidad todavía no está disponible».
- **`GET` / `DELETE` / `PATCH` de `/api/loyalty-program`.** Solo la escritura se unifica.
  Darles `code` a esos tres queda **declarado y afuera**.
- **Ninguna pantalla.** Se toca **un** archivo de cliente y es el adaptador HTTP
  (`onboarding-api.ts`), no un `.tsx`. El paso 3 del wizard lo diseña el owner.
- **El QR.** Conserva el guard de la 0075.

## Diseño

### Especificación técnica

#### 1. La ruta unica y su guard

`PUT /api/loyalty-program` es la unica escritura. **Su guard pasa a ser
`requireApiOwnerSinGateDeEmail`** — pasos 1, 2 y 4, sin el 3.

**ESTO NO AFLOJA NADA, Y ES EL PUNTO ENTERO DEL ADR 0076:** despues de la spec 0077 el paso
3 **ya no vive en la puerta**, vive en `saveProgram`, que distingue crear de editar y exige
`emailVerified || onboardingGrantActive` para editar. Mover el gate a la puerta de nuevo
seria reintroducir la grieta.

**CONSECUENCIA QUE ROMPE UN DoD ANTERIOR, declarada y no silenciosa:** la spec 0075 exige
que `rg 'SinGateDeEmail' apps` devuelva **exactamente una** ruta. Con esta spec son **dos**
(el QR y esta). `api-owner-surfaces.test.ts` se actualiza para aseverar **el conjunto exacto
de dos**, con el motivo escrito en el test. **No se relaja a «al menos una»**: el valor del
oraculo es que sea un conjunto cerrado.

#### 2. El cuerpo: lo que el servidor puede completar es opcional

**El principio del contrato, y es lo unico que hay que recordar: todo lo que el servidor
puede completar con seguridad es OPCIONAL; lo que no puede —el dinero— es OBLIGATORIO.**

| Campo | Sellos | Puntos |
|---|---|---|
| `kind` | **obligatorio** | **obligatorio** |
| `configuration.target` | **obligatorio**, entero 2..50 | no aplica |
| `configuration.unitName` / `unitPlural` | opcional → `"sello"` / `"sellos"` | no aplica |
| `configuration.unitSingular` / `unitPlural` | no aplica | **obligatorios** |
| `rewards` | **obligatorio**, exactamente 1 | **obligatorio**, 1..N, cada uno con `pointsCost` > 0 |
| `accrual` | opcional → `{per_purchase, grant:1, blockAmount:null}` | **OBLIGATORIO** |
| `clauses` | opcional → semillas del pais (spec 0078) | idem |
| `stampAction` | opcional → `"keep"` | opcional → `"keep"` |

**Por que `accrual` es obligatorio en Puntos y opcional en Sellos:** `validateAccrual`
fuerza `per_amount` para Puntos (`accrual.ts:22-27`), que exige un `blockAmount > 0` — un
**monto de dinero**. «Un sello por compra» es el unico significado posible de la pregunta
del wizard; «X puntos por cada $Y» no tiene default seguro y el servidor **no lo inventa**.
Faltando, **422 `invalid_program`**.

**Compatibilidad hacia atras:** un cuerpo completo de hoy sigue siendo valido — todos los
campos opcionales nuevos ya venian puestos.

#### 3. Donde vive el compositor

`onboarding/program-defaults.ts` deja de ser «los defaults del wizard» y pasa a ser **los
defaults del programa**, con una funcion por modalidad. Se mantiene el archivo (no se mueve)
para que el diff sea legible, pero:

- `composeWizardProgramInput` → `composeProgramInput(kind, partial, clauseTemplateIds)`.
- `WizardProgramInput` deja de tener `kind: "stamps"` literal.
- `validateWizardRequest` se reemplaza por la validacion del cuerpo parcial, que **delega**
  en `validateProgramInput` para todo lo que ya valida. **No se duplica ni una regla**: el
  compositor completa y `validateProgramInput` sigue siendo el unico que dice si es valido.

#### 4. Los `code`

`PUT /api/loyalty-program` pasa a emitir `code` en todos sus fallos, con la **misma tabla**
que emitia la ruta borrada (`program/route.ts:19-24` + el `error.code ??` de la 0072):

| Status | `code` | Cuando |
|---|---|---|
| 400 | `invalid_body` | el cuerpo no es JSON parseable |
| 401 | `unauthorized` | sin sesion |
| 403 | `not_owner` | la sesion no es owner activo |
| 403 | `email_not_verified` | **edicion** sin email verificado ni permiso de alta (spec 0077) |
| 403 | `business_suspended` / `business_closed` | el eje `status` |
| 409 | `program_exists` | programa en cierre, o cambio de modalidad sin cerrar |
| 422 | `invalid_program` | cualquier fallo de validacion |
| 503 | `program_unavailable` | base caida o semillas de terminos ausentes |

`suspensionReason` viaja donde `apiOwnerFailureResponse` ya lo pone.

#### 5. El borrado de la ruta vieja

Se borra `app/api/onboarding/program/route.ts` **y** su archivo de test de integracion se
reapunta a la ruta nueva (no se borra: sus casos son el oraculo del comportamiento que
tiene que sobrevivir).

**GOTCHA OBLIGATORIO (skill `gotchas-del-repo`):** al borrar una ruta, `pnpm typecheck` puede
fallar con `.next/types/validator.ts(...): Cannot find module '.../route.js'` — es un tipo
**generado** que quedo viejo, no un error del codigo. Fix:
`rm -f apps/merchant/.next/types/validator.ts`. **No editar el archivo generado.**

#### 6. El adaptador del cliente

`onboarding-api.ts` es el **unico** archivo de cliente que se toca. `createProgram` pasa a
`PUT /api/loyalty-program` con `{kind:"stamps", configuration:{target}, rewards:[...]}`.
**Sigue sin mandar ids**: el negocio lo resuelve el servidor desde la sesion.

### Arquitectura de referencia

- **ADR 0076 §5 y §6** — una sola ruta (textual del owner) y la API acepta `kind`.
- **Spec 0077** — el invariante en el writer. **Esta spec DEPENDE de que ya este.**
- **Spec 0078** — las semillas por pais que el compositor usa por defecto.
- **Spec 0075** — el DoD que esta spec modifica a proposito (§1).
- **ADR 0070 §15.3** — ningun id del cliente.

## Archivos

| Archivo | Accion |
|---|---|
| `apps/merchant/src/app/api/loyalty-program/route.ts` | editar — guard, compositor, `code` |
| `apps/merchant/src/app/api/onboarding/program/route.ts` | **BORRAR** |
| `apps/merchant/src/server/onboarding/program-defaults.ts` | editar — compositor por modalidad |
| `apps/merchant/src/server/loyalty-program/validation.ts` | editar — lo que el compositor necesite |
| `apps/merchant/src/server/api-owner-surfaces.test.ts` | editar — el conjunto de DOS (§1) |
| `apps/merchant/src/server/onboarding-program.neon.integration.test.ts` | editar — reapuntar |
| `apps/merchant/src/app/[locale]/(merchant)/business/onboarding/_lib/onboarding-api.ts` | editar — la URL |
| `apps/merchant/src/app/[locale]/(merchant)/business/onboarding/_lib/onboarding-api.test.ts` | editar |
| `docs/specs/0079-contratos-de-api.md` | **crear** |

### Disjunta?

**NO.** Colisiona con las dos:

| Con | Archivos en comun | Resolucion |
|---|---|---|
| **0077** | `loyalty-program/route.ts`, `onboarding/program/route.ts`, `onboarding-program.neon.integration.test.ts` | **serializar**: 0079 arranca **despues del PASS de la 0077**. Y ademas **depende** de ella: sin el invariante en el writer, mover el guard es reintroducir el bypass. |
| **0078** | `onboarding/program-defaults.ts`, `loyalty-program/validation.ts`, el test de integracion | **serializar**: despues del PASS de la 0078. El compositor necesita la seleccion por pais ya puesta. |

**Orden obligatorio: 0077 → 0078 → 0079.** Las dos primeras si son disjuntas entre si y
pueden ir en paralelo.

## Definition of Done

- [ ] `pnpm typecheck` · `lint` · `format:check` · `build` · `test` con env Neon: los cinco
      verdes, 0 failed y 0 skipped en los Neon.
- [ ] **`pnpm test:e2e` SI SE CORRE.** Se toca un archivo de cliente del wizard, y el gate
      de e2e es el unico que puede tumbar `main` despues de un push verde (CLAUDE.md).
      `pnpm exec playwright install chromium` antes. **Si falla por
      `tests/e2e/loyalty.spec.ts:27` (la UI vieja de `/backoffice/demo`), es el rojo
      PREEXISTENTE de `main`, ajeno a esta spec**: se declara con su salida, no se arregla
      ni se silencia acá.
- [ ] **`app/api/onboarding/program/route.ts` NO existe** y nada lo referencia
      (`rg 'onboarding/program' apps` limpio salvo comentarios historicos).
- [ ] **Un cuerpo corto de Sellos crea el programa** (`{kind, configuration:{target}, rewards:[1]}`) → 201.
- [ ] **Un cuerpo de Puntos crea el programa**: `unitSingular`+`unitPlural`, `accrual`
      `per_amount` con `blockAmount`, un premio con `pointsCost` → **201**, y la fila queda
      `kind='points'`.
- [ ] **Puntos SIN `accrual` → 422 `invalid_program`** (el servidor no inventa el dinero).
- [ ] **`cashback` → 422**, con el mensaje de modalidad no disponible.
- [ ] **Un cuerpo completo de hoy sigue dando el mismo resultado** que antes de la spec.
- [ ] **El bypass de la 0077 sigue cerrado por la ruta nueva**: sesion sin verificar, crear
      → 201; editar → 403 `email_not_verified` y la fila **sin cambiar**.
- [ ] **Los 8 `code` de §4 se emiten**, cada uno con un caso.
- [ ] `rg 'SinGateDeEmail' apps` devuelve **exactamente dos** rutas, y el test asevera ese
      conjunto **exacto**.
- [ ] El contrato `0079-contratos-de-api.md` existe y declara entrada, salida, defaults por
      modalidad y los 8 `code`.

## Plan de pruebas y verificación

### Presupuesto y condición de corte (ADR 0062)

**5 mutaciones.** Clase de error a cazar: **que unificar las puertas afloje un invariante
que alguna de las dos tenia.** Si dos vueltas seguidas terminan en «el fix abrio la
siguiente», se corta.

| # | Mutacion | Oraculo que DEBE ponerse rojo |
|---|---|---|
| M1 | La ruta unica usa `requireApiOwner` (con paso 3) | el caso «crear sin verificar → 201» |
| M2 | El compositor default-ea `accrual` en Puntos con `blockAmount: 1` | el 422 de Puntos sin `accrual` |
| M3 | El compositor pisa un `accrual` explicito con el default | el cuerpo completo de hoy |
| M4 | `enabledKinds` acepta `cashback` | el 422 de cashback |
| M5 | Los `code` caen a `codeForStatus` ignorando `error.code` | el caso `business_suspended` |

Protocolo por mutacion: `shasum` limpio ANTES, etiqueta `MUTATION`, revertir con `diff`,
cero `MUTATION` en el arbol.

### Pruebas

- [ ] **Unitaria** — el compositor: tabla de casos de entrada parcial → `ProgramInput`
      completo, por modalidad; y que **un campo explicito nunca se pisa** con su default.
- [ ] **Integracion Neon** — los seis casos del DoD (corto Sellos, Puntos completo, Puntos
      sin `accrual`, `cashback`, cuerpo completo de hoy, bypass cerrado).
- [ ] **Integracion Neon — cambio de modalidad**: con un programa de Sellos activo, mandar
      `kind:"points"` → **409**, con el mensaje de cerrar el programa primero.
- [ ] **Autorizacion** — `api-owner-surfaces.test.ts` con el conjunto exacto de dos rutas
      sin paso 3; las otras 10 lo conservan.
- [ ] **Regresion** — el adaptador del cliente: `onboarding-api.test.ts` asevera la URL y el
      cuerpo nuevos, con `fetch` mockeado.
- [ ] Comandos exactos: los de la 0077, **mas** `pnpm exec playwright install chromium` y
      `pnpm test:e2e`.
- [ ] **Verificacion manual:** NO la hace el implementador. Es el QA del owner, y es el
      momento en que prueba las tres specs de una sola vez.

## Handoff requerido

Formato de `docs/AGENT-WORKFLOW.md`. UN implementador, UN revisor independiente con `PASS`.
**El orquestador NO despacha esta spec hasta tener el PASS de la 0077 y el de la 0078.**

## Abierto

Nada que bloquee.

**Declarado y afuera:** `GET`/`DELETE`/`PATCH` de `/api/loyalty-program` siguen sin `code`.
Es el estado que el contrato 0069 ya declara; darles `code` es una spec chica aparte y nadie
lo pidio todavia.

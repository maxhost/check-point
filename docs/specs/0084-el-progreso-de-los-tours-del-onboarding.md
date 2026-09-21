---
spec: 0084
fecha: 2026-09-20
estado: cerrada
resumen: La PERSISTENCIA y la ESCRITURA del progreso de los tours del onboarding (ADR 0078 §2-3). Tabla nueva `core.business_onboarding_tour` con PK `(business_id, tour_id)` —el progreso es POR NEGOCIO, decision del owner— y `POST /api/onboarding/tours/{tourId}` con `status: "completed" | "skipped"`. Es la PRIMERA escritura del onboarding: hasta hoy el checklist era lectura pura, porque «vi un tour» no es un hecho derivable de ninguna tabla de dominio. Los dos estados se PERSISTEN distintos aunque los dos proyecten `done: true`, y `completed` NUNCA se degrada a `skipped` (el upsert solo pisa hacia arriba). A diferencia del checklist, esta ruta SI lleva el gate de email —el inventario de exenciones sigue en 3— porque `verify-email` es `blocking: true` y esta es la primera vez que ese bloqueo se HACE CUMPLIR en vez de solo reportarse.
disjunta: no
archivos: apps/merchant/drizzle/0040_progreso_de_tours_del_onboarding.sql, apps/merchant/drizzle/meta/_journal.json, apps/merchant/src/server/schema/onboarding-tour.ts, apps/merchant/src/server/schema.ts, apps/merchant/src/server/onboarding/tours.ts, apps/merchant/src/app/api/onboarding/tours/[tourId]/route.ts, apps/merchant/src/server/api-owner-surfaces-support.ts, apps/merchant/src/server/api-owner-surfaces.test.ts, apps/merchant/src/server/onboarding/tours.test.ts, apps/merchant/src/server/onboarding-tours.neon.integration.test.ts, docs/specs/0084-contratos-de-api.md
---

# 0084 — El progreso de los tours del onboarding

## Problema

El ADR 0078 redefinio el onboarding: **cinco items, y cuatro son tours** cuyo `done` es
«completo **o salteo** este tour». Ese hecho **no existe en ninguna parte**, y no se puede
derivar:

- **No hay una sola columna de «visto» en el schema.** Barrido sobre `server/schema/` por
  `tour`, `dismissed`, `seen_at`, `visto` y `onboarding`: lo unico que aparece es
  `web_push.last_seen_at` (otra cosa) y las columnas del *grant* del alta
  (`auth.ts:45 onboarding_grant_until`, `otp.ts:35 onboarding_token_hash`).
- **Derivarlo de un hecho de dominio fracasa, medido.** El caso mas tentador es el programa:
  `loyalty_program.updated_at` es `defaultNow()` **sin `$onUpdate`** (`schema/loyalty.ts:72`),
  asi que «el merchant reviso su programa y no cambio nada» **no deja rastro**. Y «hay >= 1
  producto» mide otra cosa: que cargo catalogo, no que vio el tour.
- **`GET /api/onboarding/checklist` es lectura pura hoy** (`app/api/onboarding/checklist/route.ts`):
  no hay ninguna superficie por la que el progreso de un tour pueda entrar.

## Alcance

**Entra:**
- La tabla `core.business_onboarding_tour` y su migracion.
- El catalogo de ids de tour validos (`ONBOARDING_TOURS`), que es **la fuente de verdad** de
  que ids acepta la escritura y que la spec 0085 va a consumir.
- `POST /api/onboarding/tours/{tourId}` con su guard, su validacion y todos sus `code`.
- Su fila en el inventario `SURFACES` (**del lado CON gate de email**).
- El contrato normativo `docs/specs/0084-contratos-de-api.md` (ADR 0070 §16).

**No entra:**
- **Los items del checklist.** El catalogo sigue con un solo item (`verify-email`) al terminar
  esta spec. Los cinco items son la **spec 0085**.
- **La LECTURA del progreso.** No se escribe ningun `tourProgress()` ni se toca
  `checklist-facts.ts`: sin items de tour no tendria consumidor, y la regla de `CLAUDE.md` es
  que nada de andamiaje entra sin su tarea. Su tarea es la 0085.
- **Cualquier `.tsx`.** El arco entrega API y contrato; la UI la construye el owner por fuera
  (ADR 0070 §16-17). **la libreria de tours (`driver.js`, ADR 0078 §5) no se instala en esta spec** — es una
  dependencia de la UI, no del servidor. **Esta spec es agnostica de la libreria**: guarda estado,
  no pasos.
- **`GET /api/onboarding/guide/{item}`**, que el ADR 0078 §4 mato.

## Diseño

### Especificación técnica

#### Modelo de datos

Tabla nueva `core.business_onboarding_tour`, en archivo propio
`server/schema/onboarding-tour.ts` (**no** dentro de `schema/business.ts`, que esta en 281
lineas y el hook `file-size` corta en 300: la regla es dividir, no extender), mas su linea en
el barrel `server/schema.ts`.

| Columna | Tipo | Notas |
|---|---|---|
| `business_id` | `uuid NOT NULL` | `references(businesses.id, { onDelete: "cascade" })` |
| `tour_id` | `text NOT NULL` | La clave estable del tour (`"staff"`, `"catalog"`, …) |
| `status` | `text NOT NULL` | `CHECK in ('completed','skipped')` |
| `updated_at` | `timestamptz NOT NULL` | `defaultNow()` |

- **PK compuesta `(business_id, tour_id)`.** Es lo que hace la escritura idempotente y lo que
  materializa la decision del owner: **el progreso es POR NEGOCIO, no por usuario** (ADR 0078
  §3). No hay `user_id` **a proposito**; agregarlo despues seria una migracion, y se decidio
  con la alternativa a la vista.
- **`status` como texto con `CHECK`**, igual que `memberships.status` y `businesses.status`:
  es la convencion del repo, no hay enums de PG en `core`.
- **No hay `created_at`.** Una fila se crea una vez y se pisa como mucho una vez (`skipped` →
  `completed`); `updated_at` alcanza. Nada de andamiaje sin su tarea.
- **No hay indice extra:** la unica consulta es por `business_id` (la 0085) o por la PK
  completa (el upsert), y el **prefijo de la PK ya sirve para las dos**.

**Migracion `0040_progreso_de_tours_del_onboarding.sql`** + su entrada en
`drizzle/meta/_journal.json` (`idx: 40`, `tag: "0040_progreso_de_tours_del_onboarding"`,
`version: "7"`, `breakpoints: true`), siguiendo la forma de la `0039`. La migracion es
`CREATE TABLE IF NOT EXISTS` y no siembra datos.

#### El catalogo de tours: `server/onboarding/tours.ts`

```ts
export const ONBOARDING_TOURS = ["staff", "catalog", "program", "brand"] as const;
export type OnboardingTourId = (typeof ONBOARDING_TOURS)[number];
export const TOUR_STATUSES = ["completed", "skipped"] as const;
export type TourStatus = (typeof TOUR_STATUSES)[number];
```

**Por que los cuatro ids entran ACA y no en la 0085:** la escritura es fail-closed y tiene que
rechazar un `tourId` desconocido; para rechazarlo necesita la lista. Que la 0085 derive sus
items de esta constante —y no al reves— es lo que evita dos listas que se desincronizan.

**Que los cuatro existan no implica que sus pantallas existan**, y no hay que esperarlas
(ADR 0078 §6): un tour sin pantalla simplemente nunca recibe un `POST`, su `done` queda en
`false` y no traba a nadie porque ningun tour es `blocking`.

#### La escritura

```
POST /api/onboarding/tours/{tourId}
body: { "status": "completed" | "skipped" }
```

**El guard es `requireApiOwner` — CON el paso 3, el gate de email.** Es lo contrario del
checklist, y la asimetria es la decision:

- `GET /api/onboarding/checklist` **se exime** porque se gatearia a si mismo: es el endpoint
  que viene a decir «verifica tu email» (ADR 0077 §6).
- Esta ruta **no tiene ese problema**: `verify-email` es `blocking: true`, o sea que **mientras
  el email no este verificado los items de `position` mayor no se pueden hacer**. Poner el gate
  aca es **hacer cumplir** ese bloqueo en vez de solo reportarlo. Hasta hoy el contrato
  `0083-contratos-de-api.md` §1 declaraba esa decision como no tomada, *«se toma cuando haya un
  segundo item»*: **se toma aca, y es que si**.

**Consecuencia medida, y es parte del punto:** el inventario cerrado de exenciones sigue en
**3**. `rg -n 'SinGateDeEmail' apps/merchant/src/app` tiene que seguir dando **3 rutas** despues
de esta spec. La fila nueva va del lado `SURFACES_CON_GATE_DE_EMAIL`, que pasa de 11 a **12**, y
`SURFACES` de 14 a **15**.

**El upsert, y su invariante:**

```sql
insert into core.business_onboarding_tour (business_id, tour_id, status)
values ($1, $2, $3)
on conflict (business_id, tour_id) do update
  set status = excluded.status, updated_at = now()
  where core.business_onboarding_tour.status <> 'completed';
```

**`completed` NUNCA se degrada a `skipped`.** Un merchant que termina el tour y despues lo
reabre y lo cierra no debe perder el `completed`: los dos proyectan `done: true` por HTTP, asi
que el efecto visible es nulo, pero el dato que el owner pidio conservar —cuantos saltearon— se
destruiria. El `where` del `do update` es lo unico que sostiene ese invariante.

**El `on conflict` apunta a la PK y la PK NO es un indice parcial**, asi que no lleva `where` en
el *conflict target*. Es el gotcha de los unicos parciales del repo: no aplica aca, y no hay que
"arreglarlo".

#### Autorizacion, entradas y errores

| Status | `code` | Cuando |
|---|---|---|
| **200** | — | `{ "tourId": "...", "status": "completed" \| "skipped" }` |
| **400** | `invalid_body` | El cuerpo no es JSON, o `status` no es uno de los dos valores exactos |
| **401** | `unauthorized` | No hay sesion |
| **403** | `not_owner` | Hay sesion pero no es owner con membresia `active` |
| **403** | `email_not_verified` | **El bloqueo de `verify-email`, aplicado** |
| **403** | `business_suspended` / `business_closed` | Con `suspensionReason` en camelCase cuando hay motivo |
| **404** | `unknown_tour` | El `tourId` de la ruta no esta en `ONBOARDING_TOURS` |
| **503** | `onboarding_unavailable` | Fallo de base |

- **El `businessId` sale del guard, NUNCA del cuerpo ni de la query** (ADR 0070 §15.3). Si
  viajara, seria el parametro con el que un owner escribiria el progreso de otro negocio.
- **El orden importa y es el del guard:** primero owner, despues email. Un INTEGRANTE tiene que
  recibir `not_owner` y **no** `email_not_verified` — es el bug que ya cazo un test de la 0067 y
  que `requireApiOwner` resuelve por construccion.
- **`unknown_tour` se evalua DESPUES del guard.** Al reves, un desconocido podria sondear que
  ids de tour existen sin estar autenticado.
- **El `request.json()` lleva su propio `try`**, como en `api/staff/route.ts`: un cuerpo
  ilegible es `400 invalid_body`, no un `503` de base caida.
- **El `catch` de ultima linea emite solo `error.name`**, nunca el mensaje: un mensaje de
  excepcion puede arrastrar datos de la fila que lo produjo.

### Arquitectura de referencia

- **ADR 0078** §2 (el skip se guarda aparte), §3 (por negocio), §6 (un tour puede existir antes
  que su pantalla) — es el ADR que esta spec implementa.
- **ADR 0077** §2 (`required` y `blocking` son dos ejes), §6 (por que el checklist se exime).
- **ADR 0073** §1 (la escalera de cuatro decisiones de `requireApiOwner`).
- **ADR 0070** §15.3 (ningun identificador de negocio viaja en el cuerpo), §16 (el contrato HTTP
  es un entregable).
- **Spec 0075** §D1 — las exenciones del gate se marcan **con un nombre**, no con un flag, para
  que `rg` las cuente. Esta spec **no agrega ninguna**.

## Archivos

| Archivo | Accion |
|---|---|
| `apps/merchant/drizzle/0040_progreso_de_tours_del_onboarding.sql` | crear |
| `apps/merchant/drizzle/meta/_journal.json` | editar (entrada `idx: 40`) |
| `apps/merchant/src/server/schema/onboarding-tour.ts` | crear |
| `apps/merchant/src/server/schema.ts` | editar (una linea en el barrel) |
| `apps/merchant/src/server/onboarding/tours.ts` | crear (catalogo + `recordTourProgress`) |
| `apps/merchant/src/app/api/onboarding/tours/[tourId]/route.ts` | crear |
| `apps/merchant/src/server/api-owner-surfaces-support.ts` | editar (15ª fila, **con** gate) |
| `apps/merchant/src/server/api-owner-surfaces.test.ts` | editar (los dos conteos: 12 y 15) |
| `apps/merchant/src/server/onboarding/tours.test.ts` | crear (unit) |
| `apps/merchant/src/server/onboarding-tours.neon.integration.test.ts` | crear |
| `docs/specs/0084-contratos-de-api.md` | crear |

### Disjunta?

**No.** Colisiona **con la 0085** en `api-owner-surfaces.test.ts`, y la 0085 ademas **depende**
de esta: consume `ONBOARDING_TOURS` y la tabla. **Se serializan, la 0084 primero**; la 0085 no
puede empezar hasta que esta este `implementada`. Con ninguna otra spec del INDEX colisiona.

**Ojo con `api-owner-surfaces.test.ts`: esta en 299 lineas y el hook corta en 300.** Medido: la
fila nueva es **con** gate, y ese lado del test corre por `it.each(SURFACES_CON_GATE_DE_EMAIL)`,
asi que **no agrega lineas al test** — solo cambia dos numeros (`11` → `12`, y el total). Las 4
lineas de la fila van a `api-owner-surfaces-support.ts`, que esta en 120. **Si al implementar el
test se pasa de 300, hay que DIVIDIR el archivo, no borrar asercion.**

### Archivos compartidos

| Que | Quien lo deja listo | Cuando |
|---|---|---|
| `ONBOARDING_TOURS` en `server/onboarding/tours.ts` | esta spec | lo consume la 0085 |

## Definition of Done

- [ ] `core.business_onboarding_tour` existe en la base de integracion con PK
      `(business_id, tour_id)` y el `CHECK` de `status` — verificado por SQL contra
      `information_schema`, no por leer el `.sql`.
- [ ] La migracion **aplicada**: un `INSERT` con `status = 'invalid'` es rechazado por el
      `CHECK`, ejecutado.
- [ ] `rg -n 'SinGateDeEmail' apps/merchant/src/app` → **exactamente 3 rutas** (sin cambios).
- [ ] `rg -n 'user_id|userId' apps/merchant/src/server/schema/onboarding-tour.ts` → **vacio**
      (el progreso es por negocio; que no se cuele una columna por usuario). **La alternacion va
      SIN barra invertida:** `rg` es regex por defecto y `\|` es la barra LITERAL, asi que
      `'user_id\|userId'` no matchea nunca y el criterio pasaria vacuo. Verificado contra el
      arbol antes de cerrar esta spec.
- [ ] `SURFACES.length === 15` y `SURFACES_CON_GATE_DE_EMAIL.length === 12`, aseverado.
- [ ] Los cinco `code` de fallo emitidos y aseverados uno por uno.
- [ ] `apps/merchant/src/server/api-owner-surfaces.test.ts` **≤ 300 lineas** (`wc -l`).
- [ ] Gates de root con Node 24, **una sola vez al final**: `typecheck`, `lint`, `test`,
      `format:check`, `build`. **`test:e2e` NO aplica y se DECLARA** con
      `git status --porcelain | grep -c '\.tsx$'` → `0`.
- [ ] `rg -n MUTATION apps tools` → vacio.

## Plan de pruebas y verificación

- [ ] **Unit** (`onboarding/tours.ts`): `ONBOARDING_TOURS` tiene los cuatro ids exactos; un id
      desconocido no valida; `status` fuera de los dos valores no valida.
- [ ] **Integracion Neon** (`onboarding-tours.neon.integration.test.ts`), con actor y
      precondicion explicitos:
  - owner con email verificado + `POST {status:"skipped"}` → **200**, y **la fila esta en la
    base con `status='skipped'`**, leida por SQL.
  - **Idempotencia:** el mismo `POST` dos veces → 200 las dos, y `count(*)::int` sobre la tabla
    para ese negocio → **1** (`::int`, que el driver devuelve `bigint` como string).
  - **El invariante del no-degradado:** `completed` y despues `skipped` → la fila queda en
    **`completed`**. Es el oraculo de la mutacion M4.
  - `skipped` y despues `completed` → la fila queda en **`completed`** (el upgrade SI pisa).
  - **Aislamiento:** el owner de otro negocio no ve ni pisa la fila; `business_id` sale del
    guard. Dos negocios con el mismo `tour_id` conviven (lo permite la PK compuesta).
  - **`404 unknown_tour`** con un `tourId` inventado, **por un owner autenticado** (o el test no
    distingue el 404 del 403).
- [ ] **Autorizacion**, en la bateria compartida `api-owner-surfaces.test.ts`: sin sesion → 401
      `unauthorized`; integrante → 403 `not_owner`; **owner con `emailVerified: false` → 403
      `email_not_verified`** (esta es la fila nueva y es el punto de la spec); `suspended` y
      `closed` con sus `code`.
- [ ] **Comandos exactos:**
      `export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use` y despues
      `pnpm --filter @mi-pasaporte/merchant exec vitest run src/server/onboarding-tours.neon.integration.test.ts src/server/onboarding/tours.test.ts src/server/api-owner-surfaces.test.ts`.
      Los gates completos son de **root** (`pnpm run <script>`) y van **una sola vez al final**.
- [ ] **Verificacion manual:** no hay pantalla. Se declara y se reemplaza por las respuestas
      HTTP transcriptas (ADR 0070 §17 lo acepta explicitamente mientras dure el arco).

### Mutaciones — presupuesto: 5. Clase: los plausibles

| # | Mutacion | Oraculo que tiene que ponerse ROJO |
|---|---|---|
| **M1** | En la ruta, `requireApiOwner` → `requireApiOwnerSinGateDeEmail` | `api-owner-surfaces.test.ts`: *owner con `emailVerified: false` → 403 `email_not_verified`* recibe 200. **Y el caso del INTEGRANTE tiene que quedar VERDE** — si tambien se pone rojo, el rojo es del setup y no de la propiedad |
| **M2** | Sacar el `where … status <> 'completed'` del `do update` | El caso `completed` → `skipped` deja la fila en `skipped`. **Es el invariante del ADR 0078 §2** |
| **M3** | Tomar el `businessId` del cuerpo en vez del guard | El caso de aislamiento: el owner de A escribe la fila de B |
| **M4** | Aceptar cualquier `tourId` (saltear la validacion contra `ONBOARDING_TOURS`) | El caso `404 unknown_tour` recibe 200 **y** queda una fila basura en la base |
| **M5** | Evaluar `unknown_tour` ANTES del guard | El `404` le llega a un caller **sin sesion**, que tiene que recibir `401 unauthorized` |

**Protocolo:** `shasum` limpio **antes** de mutar → fila de bitacora en `TASKS.md` **antes** de
medir → etiqueta `MUTATION` → medir y **transcribir la salida ejecutada** → revertir con `diff`
contra la copia limpia. De a una. **Leer la asercion del rojo**, no solo el conteo.

**Condicion de corte:** si dos vueltas seguidas terminan en «el fix abrio la siguiente», se corta
y va al owner. Lo que quede afuera se **declara**.

## Declarado AFUERA (sin oraculo, a proposito)

- **El `503 onboarding_unavailable`.** Misma situacion que en la 0083, donde quedo declarado y
  **el owner todavia no decidio** si se cierra con un test que doble la capa de datos. Riesgo
  bajo y acotado: es un `catch` de ultima linea, su `code` esta en el contrato y no filtra nada.
  **Si el owner decide cerrarlo, se cierra para las dos rutas de una vez.**
- **Concurrencia real** (dos `POST` simultaneos sobre la misma fila). El `on conflict` lo
  resuelve a nivel de PG y no hay un oraculo barato para una carrera de verdad; el caso de
  idempotencia secuencial si esta cubierto.

## Handoff requerido

**UN implementador para toda la spec, UN revisor independiente al final** (ADR 0071). El revisor
produce un `PASS` con evidencia **ejecutada** antes de que la spec pase a `implementada`.

**Al revisor, en el encargo:** presupuesto **5 mutaciones**, clase de error a cazar **«que la
ruta deje escribir a quien no debe, que escriba en el negocio equivocado, o que el `completed` se
degrade»**. Lo que quede afuera se **declara**, no se persigue.

## Abierto

Nada que bloquee.

**Anotado, no bloqueante:** la spec **0085** decide `required` y `blocking` de los cuatro tours.
Esta spec no los necesita —no los lee ni los escribe— y su DoD no depende de ellos.

---
spec: 0075
fecha: 2026-09-18
estado: implementada
resumen: El QR del programa deja de exigir email verificado. La pantalla del QR es la CUARTA del wizard (ADR 0070 §1) y el owner ya habia dictado que la verificacion bloquea «todo lo que venga DESPUES del wizard» (ADR 0070 §11); la 0072 la barrio adentro de las 10 superficies gateadas y volvio inalcanzable el resultado del propio alta. La ruta conserva los otros tres pasos del gate —sesion, owner activo y el eje `status`— y pierde SOLO el paso 3.
disjunta: si
archivos: apps/merchant/src/server/api-owner.ts, apps/merchant/src/app/api/loyalty-program/qr/route.ts, apps/merchant/src/server/api-owner-surfaces.test.ts, apps/merchant/src/server/loyalty-qr.neon.integration.test.ts, docs/specs/0069-contratos-de-api.md, docs/specs/0072-contratos-de-api.md
---

# 0075 — El QR del wizard no lleva el gate de email

> **Plantilla CHICA (ADR 0071).** Las tres condiciones valen: **un solo dominio** (el gate del
> owner sobre una ruta), **sin migraciones**, y **sin decision de producto abierta** — el owner
> la tomo el 2026-09-18, textual: *«El QR cuando nace en el onboarding no debe requerir email
> verification»*.

## Problema

**El wizard termina en una pantalla que la API hace inalcanzable.**

1. `apps/merchant/src/app/api/loyalty-program/qr/route.ts:38` llama a `requireApiOwner`, cuyo
   **paso 3** (`server/api-owner.ts:105`) responde `403 email_not_verified` si
   `session.user.emailVerified !== true`.
2. Una cuenta nueva llega a esa pantalla **con el email sin verificar por construccion**:
   `POST /api/merchant/auth/start` abre sesion para un email nuevo
   (`auth/start/route.ts:55`, `openMerchantSession`) y `email_verified` nace `false`.
3. Los otros dos pasos del wizard **no** llevan el gate: `onboarding/business/route.ts:48` y
   `onboarding/program/route.ts` resuelven la sesion con `getMerchantAuth()` directo. O sea que
   el negocio y el programa **se crean**, y lo unico que no se puede ver es el resultado.
4. **La pantalla del QR ES parte del wizard**, no lo que viene despues: el ADR 0070 §1 la lista
   como la cuarta fila de la tabla del wizard (`→ | Tu QR | nada: es la recompensa | ya
   generado`), y el §11 dice que la verificacion bloquea *«todo lo que venga DESPUES del
   wizard»*.

**Esto no es una decision abierta: es un incumplimiento de una decision ya tomada.** La 0072
unifico el gate sobre 10 superficies —lo correcto— y arrastro una superficie del wizard adentro
del barrido. El docblock de la propia ruta lo deja ver: *«esta ruta nacio con la 0069, DESPUES
de que se censaran las superficies sin gate de email»*.

**Y el precedente ya esta establecido dos veces:** el cierre de F1 de la 0072 dejo
`POST /api/onboarding/program` **sin** el gate, y el contrato `0074-contratos-de-api.md` §3 deja
`GET /api/onboarding/state` sin el gate, los dos citando el ADR 0070 §11.

### Por que NO se puede gatear «solo durante el onboarding»

La lectura literal del pedido —«cuando nace en el onboarding»— sugiere distinguir la llamada del
wizard de la del backoffice. **No es implementable sin inventar el estado que el ADR 0070
prohibe**, y esto es un hallazgo medido, no una preferencia:

- **No existe columna `onboarding_step`** y el ADR 0070 la prohibe explicitamente. Los dos hits
  de «onboarding» en el esquema son `onboarding_token_hash`, del arco del **consumidor**.
- El unico otro proxy server-side seria `emailVerified === false`, que es **circular**: «si no
  verifico, dejalo pasar» **es** quitar el gate, escrito al reves.
- Un parametro o header que diga «vengo del wizard» lo falsifica el cliente, y el repo ya tiene
  la regla de que los parametros de rebote son falsificables.

**Conclusion, y es lo que fija el alcance:** la ruta pierde el paso 3 **siempre**. El costo real
de eso es acotado y se declara abajo.

## Alcance

**Entra:**

- `GET /api/loyalty-program/qr` deja de emitir `email_not_verified`. **Conserva los otros tres
  pasos**: `401 unauthorized`, `403 not_owner`, y el eje `status`
  (`business_suspended` / `business_closed`, incluido el fail-closed del estado desconocido).
- Un resolvedor hermano y **explicito** en `server/api-owner.ts` para esa unica ruta.
- Los dos oraculos que ya cubren la ruta, actualizados para **aseverar la excepcion**, no para
  perderla de vista.
- Las dos filas de contrato: `0069-contratos-de-api.md` §5 y `0072-contratos-de-api.md:87`.

**No entra** *(explicito — es lo que evita el scope creep del agente)*:

- **Ninguna otra de las 10 superficies.** Las 11 entradas HTTP restantes conservan el gate
  entero. Esta spec no reabre la 0072.
- **Ningun cambio a `requireApiOwner`**: la funcion de siempre queda **byte por byte igual**.
  Se agrega una hermana, no se le pone un flag — un parametro que apaga un gate de seguridad es
  un footgun que el proximo dominio copia sin leer el docblock.
- **Ninguna pantalla** (ADR 0070 §16). Cero `.tsx` en el diff.
- **Ninguna migracion.**
- **El resto del arco del programa de fidelizacion** (elegir tipo de programa, editar, cerrar,
  premio del catalogo, renombrar la unidad). Es un arco aparte que el owner abrio el 2026-09-18
  y todavia no tiene ni ADR ni medicion.

## Diseño

### D1 — `requireApiOwnerSinGateDeEmail`, en `server/api-owner.ts`

Una funcion hermana exportada del mismo modulo, con **el mismo contrato de retorno**
(`ApiOwnerResult`) y **los mismos pasos 1, 2 y 4**. Lo unico que no corre es el paso 3.

Por que una hermana y no `requireApiOwner(request, { emailGate: false })`:

- **Es greppable.** `rg 'requireApiOwnerSinGateDeEmail' apps` tiene que devolver **exactamente
  una** ruta, y eso es un criterio del DoD. Un flag booleano no se puede contar asi.
- **No se copia por accidente.** Un `{ emailGate: false }` viaja en un copy-paste entre rutas
  del mismo dominio; un nombre que dice lo que hace obliga a justificarlo.
- `requireApiOwner` **no se modifica**, asi que las 11 entradas restantes no pueden regresionar
  por este cambio: no hay una linea suya en el diff.

Las dos comparten los pasos para no duplicar la regla: el cuerpo comun resuelve sesion → owner
activo → `businessStatusFailure`, y **el paso 3 es lo unico condicional**. El docblock de la
hermana declara, con su cita del ADR 0070 §11, por que existe y que **no** se extiende a otra
ruta sin volver a discutirlo.

### D2 — La ruta del QR

`qr/route.ts` cambia **una llamada**: `requireApiOwner` → `requireApiOwnerSinGateDeEmail`. El
mensaje `emailNotVerified` de sus `messages` se cae con ella (ya no hay a que darle copia). Todo
lo demas de la ruta —`programForOwner`, el `no_program`, los headers, el `content-disposition`,
el `qr_unavailable`— queda intacto.

### D3 — El barrido de superficies **asevera la excepcion**, no la borra

`server/api-owner-surfaces.test.ts` tiene hoy una tabla `SURFACES` de **12 entradas** con un
piso (`expect(SURFACES.length).toBe(12)`) y seis `it.each` sobre ella. Borrar la fila del QR
seria hacer pasar el gate sin verificar el cambio. En su lugar:

- `SURFACES` **sigue teniendo las 12** y las conserva para los casos de `unauthorized`,
  `not_owner`, `business_suspended`, `business_closed` y `status` desconocido. **El QR sigue
  cubierto por los cinco.**
- Se parte **solo** el caso del email en dos tablas con su propio piso:
  `SURFACES_CON_GATE_DE_EMAIL` (**11**) y `SURFACES_SIN_GATE_DE_EMAIL` (**1**, el QR).
- Se asevera `SURFACES_CON_GATE.length + SURFACES_SIN_GATE.length === SURFACES.length`, para
  que nadie pueda mover una fila de una tabla a la otra sin que se note.
- La tabla sin gate asevera **polaridad positiva**: owner con `emailVerified: false` sobre un
  negocio `active` **NO** recibe 403 `email_not_verified`. Un `not.toBe` solo no alcanza: se
  asevera que el `code` del cuerpo **no es** `email_not_verified` **y** que el status **no es**
  403 por esa causa, con el doble del `emailVerified` ausente incluido (el caso fail-closed de
  hoy).

### D4 — Los contratos

- `0069-contratos-de-api.md` §5: la tabla de errores del QR **hoy no lista
  `email_not_verified`** (es anterior a la 0072). Se le agrega una linea que **declara la
  excepcion**: la ruta no emite ese `code`, con el motivo y la cita del ADR 0070 §11. Sin eso, la
  UI no tiene como saber si la ausencia es contrato o descuido.
- `0072-contratos-de-api.md:87`: la fila `api/loyalty-program | /, stamp-upload, qr (3) |
  requireApiOwner directo` deja de ser cierta. Pasa a decir **2 con `requireApiOwner` + 1 sin el
  paso de email**, con el puntero a esta spec.

## Archivos

| Archivo | Accion |
|---|---|
| `apps/merchant/src/server/api-owner.ts` | editar (agregar la hermana; **no tocar `requireApiOwner`**) |
| `apps/merchant/src/app/api/loyalty-program/qr/route.ts` | editar (una llamada) |
| `apps/merchant/src/server/api-owner-surfaces.test.ts` | editar (partir el caso del email en dos tablas con piso) |
| `apps/merchant/src/server/loyalty-qr.neon.integration.test.ts` | editar (agregar el caso del owner sin verificar) |
| `docs/specs/0069-contratos-de-api.md` | editar (§5, declarar la excepcion) |
| `docs/specs/0072-contratos-de-api.md` | editar (fila 87) |
| `docs/INDEX.md` | editar (fila de 3 lineas) |
| `docs/TASKS.md` | editar |

**Disjunta?** **Si.** La spec **0074** esta en implementacion en paralelo y su diff es
**aditivo puro** (cuatro archivos nuevos: `session-view.ts` y tres rutas `state`/`session`).
**Cero interseccion** con los seis archivos de esta tabla. Tampoco colisiona con el trabajo de UI
sin commitear, que vive en `src/ui/`, `src/app/[locale]/` e `src/i18n/`.

## Definition of Done

- [ ] `GET /api/loyalty-program/qr` con owner de negocio `active` y `emailVerified: false`
      devuelve **200** y `content-type: image/svg+xml` (y `image/png` con `?format=png`).
- [ ] La misma ruta sigue devolviendo **401 `unauthorized`** sin sesion, **403 `not_owner`** para
      quien no es owner activo, **403 `business_suspended`** con su `suspensionReason`,
      **403 `business_closed`** sin motivo, y **403** ante un `status` desconocido.
- [ ] La ruta **no emite `email_not_verified` en ningun camino**:
      `rg -n 'emailNotVerified' apps/merchant/src/app/api/loyalty-program/qr/` → **vacio**.
      **El barrido va sobre `emailNotVerified` (camelCase) a proposito, y esto se midio contra el
      arbol el 2026-09-18:** la ruta **nunca** contuvo la cadena `email_not_verified` —el `code`
      lo emite `api-owner.ts`, no ella—, asi que el barrido obvio da **vacio hoy, sin trabajo
      hecho**, y habria cerrado la spec con un criterio que no puede fallar. Lo que la ruta si
      tiene hoy es `emailNotVerified:` en su objeto de `messages`
      (`qr/route.ts:40`), y eso es lo que tiene que desaparecer.
- [ ] `rg -n 'requireApiOwnerSinGateDeEmail' apps/merchant/src --include='*.ts'` devuelve
      **exactamente** su definicion en `api-owner.ts`, su export, y **una sola** ruta: la del QR.
      Ninguna otra.
- [ ] `git diff apps/merchant/src/server/api-owner.ts` **no muestra ni una linea modificada
      dentro de `requireApiOwner`** (solo agregados fuera de su cuerpo).
- [ ] Las 11 entradas restantes siguen emitiendo `email_not_verified` — aseverado por el
      `it.each` sobre `SURFACES_CON_GATE_DE_EMAIL` con su piso en **11**.
- [ ] `SURFACES.length === 12` sigue en pie, y
      `SURFACES_CON_GATE.length + SURFACES_SIN_GATE.length === SURFACES.length`.
- [ ] Las dos filas de contrato actualizadas (`0069` §5 y `0072:87`). **Un `code` que el contrato
      declara y la ruta no emite —o al reves— es FAIL de revision.**
- [ ] **Cero `.tsx` en el diff**: `git diff --name-only | grep '\.tsx$'` vacio.
- [ ] **Cero migraciones** en el diff.
- [ ] Gates de root con Node 24, **una sola vez al final**:
      `export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use` y despues
      `pnpm run typecheck --force`, `pnpm run lint`, `pnpm run format:check`, `pnpm run test`,
      `pnpm run build --force`.
- [ ] `rg -n MUTATION apps tools` → vacio.

## Mutaciones — presupuesto: 3. Clase: los plausibles

El riesgo real de esta spec **no** es que el QR siga gateado: es que al sacarle el paso 3 se le
caiga tambien alguno de los otros tres. Las tres mutaciones atacan exactamente eso.

| # | Mutacion | Oraculo que tiene que ponerse ROJO |
|---|---|---|
| **M1** | Volver a poner `requireApiOwner` en `qr/route.ts` | el caso nuevo de `loyalty-qr.neon` (owner sin verificar → 200) **y** el `it.each` de `SURFACES_SIN_GATE_DE_EMAIL` |
| **M2** | En la hermana, saltear el **paso 2** (owner activo): devolver el contexto sin chequear `ownerContext` | `%s: un INTEGRANTE … → 403 not_owner` de `SURFACES`, **en la fila del QR** |
| **M3** | En la hermana, saltear el **paso 4** (`businessStatusFailure`) | `business_suspended` y `business_closed` de `SURFACES`, **en la fila del QR** |

**Protocolo:** `shasum` limpio antes de mutar → fila de bitacora **antes** de medir → etiqueta
`MUTATION` → medir y **transcribir la salida ejecutada** → revertir con `diff` contra copia
limpia + `shasum` coincidente. De a una. **Leer la asercion del rojo**: un rojo por el setup no
prueba nada, y una mutacion que tira la suite entera al piso no probo que el oraculo discrimina —
se pega la asercion literal, no «fallo».

**Condicion de corte (ADR 0062):** si dos vueltas seguidas terminan en «el fix abrio la
siguiente», se corta y va al owner. Lo que queda afuera se **declara**.

## Declarado AFUERA (sin oraculo, a proposito)

- **La consecuencia que el owner acepta al sacar el gate «siempre» y no «solo en el wizard»:**
  un owner que **nunca** verifique su email puede seguir pidiendo el QR de su propio programa
  desde cualquier pantalla, para siempre. **Es acotado y se declara, no se mitiga:** el QR
  codifica una URL **publica** (`<origin>/enroll/<programId>`), el `programId` lo resuelve el
  servidor desde la sesion (nunca el query), y el programa que ese QR representa **ya se pudo
  crear sin verificar** porque `POST /api/onboarding/program` tampoco lleva el gate. O sea que la
  ruta no entrega nada que la cuenta sin verificar no pudiera obtener ya. Lo que el ADR 0070 §11
  protege —*«no puede quedar habilitada a consumir lo que mañana se cobra»*— son staff, locales,
  campañas y catalogo, **las 11 entradas que conservan el gate entero**.
- **El camino end-to-end por pantalla.** El wizard vive en la UI sin commitear que el owner
  construyo por fuera; esta spec entrega **API** (ADR 0070 §16) y su oraculo es HTTP. Que la
  pantalla final muestre el QR se verifica en el QA del owner, no aca.
- **La divergencia `asc`/`desc` de `loyalty-program.ts:66`**, heredada y declarada por la 0072 y
  la 0074. Inalcanzable hoy (un negocio por usuario) y fuera de esta tabla de archivos.

## Handoff

**UN implementador para toda la spec, UN revisor independiente al final** (ADR 0071). El revisor
produce un `PASS` con evidencia ejecutada antes de marcar `implementada`.

**Lo que NO se recorta:** el protocolo de mutaciones y la revision independiente.

## Abierto

**Nada bloquea. La spec esta `cerrada`.**

**Una sola nota de proceso, que NO es una decision de producto y no frena la implementacion:**
esta spec **enmienda el conteo del ADR 0073** («las 10 superficies», 12 entradas HTTP, todas con
el paso 3). No se escribe un ADR nuevo porque **la decision de fondo ya es del owner y ya esta en
un ADR**: la 0070 §11 (*«bloquea todo lo que venga DESPUES del wizard»*), reafirmada textualmente
el 2026-09-18. Lo que esta spec corrige es un **alcance mal barrido**, no una decision. Si el
owner prefiere el ADR formal igual, se agrega despues sin tocar el codigo.

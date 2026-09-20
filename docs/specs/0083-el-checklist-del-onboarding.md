---
spec: 0083
fecha: 2026-09-20
estado: cerrada
resumen: `GET /api/onboarding/checklist` — el checklist del onboarding del ADR 0070 §9, que estaba diferido desde la 0074. Arranca con UN item (`verify-email`), cuyo hecho ya viaja en la sesion y cuya accion ya existe. La API dicta `position`, `required` y `blocking` —dos ejes SEPARADOS por decision del owner— la UI no tiene lista propia, y el texto viaja en la respuesta con `locale: "es"` fijo y declarado. NO lleva gate de email —un endpoint que dice «verifica tu email» no puede estar bloqueado por no haberlo verificado— y por eso no usa `requireApiOwner` sino su hermana **`requireApiOwnerSinGateDeEmail`**, que ya existe y ya hace los pasos 1, 2 y 4. Pasa a ser la TERCERA ruta exenta, y el inventario cerrado de exenciones (`NOMBRES_SIN_GATE_DE_EMAIL`, aseverado en 2) se amplia a 3 — decision del owner del 2026-09-20. Sin migracion: el catalogo de items es codigo tipado, como `ENTITLEMENTS`.
disjunta: si
archivos: apps/merchant/src/server/onboarding/checklist.ts, apps/merchant/src/app/api/onboarding/checklist/route.ts, apps/merchant/src/server/onboarding/checklist.test.ts, apps/merchant/src/server/onboarding-checklist.neon.integration.test.ts, apps/merchant/src/server/api-owner-surfaces-support.ts, apps/merchant/src/server/api-owner-surfaces.test.ts
---

# 0083 — El checklist del onboarding

> **Plantilla CHICA (ADR 0071).** Las tres condiciones valen: **un solo dominio**
> (onboarding), **sin migraciones** (el catalogo de items es codigo) y **sin decision de
> producto abierta** (las seis se cerraron en el ADR 0077, 2026-09-20).
>
> **Arquitectura de referencia: ADR 0077**, que decide todo lo que esta spec implementa. Si
> algo de aca contradice al 0077, manda el 0077.

## ENMIENDA DEL 2026-09-20 — leer antes que nada

**Esta spec se corrigio DESPUES de una primera implementacion, y el defecto era de la spec.**

El §D3 original decia «no se usa `requireApiOwner` … y tampoco se escribe un resolvedor nuevo:
se llaman las piezas por separado». **Era una medicion a medias:** el orquestador leyo
`requireApiOwner` hasta la linea 90 y **`requireApiOwnerSinGateDeEmail` esta en la 174**. Esa
hermana ya existe, ya hace **pasos 1, 2 y 4 sin el 3**, y ya la usan dos rutas.

El implementador obedecio la spec y escribio la escalera a mano. El resultado era correcto y
seguro, pero creaba **una ruta exenta del gate de email invisible al control que el repo monto
para contarlas** (`rg 'SinGateDeEmail' apps` + el inventario `NOMBRES_SIN_GATE_DE_EMAIL`).

**Decision del owner, 2026-09-20: opcion A** — usar la hermana existente y **ampliar el
inventario de 2 a 3**. No es «editar un test para que pase un gate» (el test no estaba rojo):
es actualizar un inventario declarado porque el inventario cambio. La pregunta que el freno del
docblock queria forzar —*¿esta bien que esta ruta se exima?*— se discutio y la respuesta es si,
por el auto-gateo.

**La spec se mantiene `cerrada`** en vez de volver a `borrador` y cerrarse en el mismo turno:
el cambio de alcance queda registrado aca, que es lo que la regla de AGENT-WORKFLOW persigue.

## Problema

- **El checklist del ADR 0070 §9 no existe.** Esta declarado como diferido en
  `docs/specs/0074-contratos-de-api.md` §3: *«El checklist derivado del ADR 0070 §9 (logo,
  colores, costos, staff, wallet) no existe y esta diferido, con seis decisiones del owner
  abiertas»*. Las seis se cerraron en el ADR 0077.
- **`GET /api/onboarding/state` no puede hacer de checklist y lo dice en su propio docblock**
  (`app/api/onboarding/state/route.ts:26-31`): su alcance es «que falta para terminar el
  alta», corre **antes** de la verificacion de email y **no lleva gate a proposito** (ADR 0070
  §11). Es del wizard, no de despues del wizard.
- **El primer paso del onboarding no tiene superficie que lo reporte.** El ADR 0070 §11 dice
  que *«el primer paso del onboarding es verificar el email, y sin eso no avanza el resto»*,
  y la accion existe (`POST /api/merchant/auth/verify-email`), pero **ninguna ruta le dice a
  la UI que ese paso esta pendiente**. La spec 0082 saco el rebote de la puerta justamente
  para que el owner pudiera ver ese paso desde adentro; falta lo que se lo muestre.

## Alcance

**Entra:**

- `GET /api/onboarding/checklist`, con **un** item: `verify-email`.
- El catalogo de items como **constante tipada en codigo** (ADR 0077 §4).
- El guard del ADR 0077 §6: escalera del ADR 0073 §1 **salteando solo el paso 3**.
- El contrato HTTP escrito: `docs/specs/0083-contratos-de-api.md` (ADR 0070 §16).

**No entra:**

- **Ninguna pantalla.** Esta spec no toca un solo `.tsx` (ADR 0070 §16: el arco entrega API,
  la UI la construye el owner por fuera).
- **El recurso de tutorial** (`/api/onboarding/guide/{item}`). No existe y se diseña cuando
  exista el primer tutorial real (ADR 0077 §5).
- **Los items 2 a 5** (catalogo, staff, programa, marca). Cada uno con la spec de su feature.
- **Tabla de configuracion, migracion o superficie de escritura.** ADR 0077 §4.
- **Eleccion de idioma.** `locale: "es"` fijo y declarado (ADR 0077 §3).
- **Tocar `GET /api/onboarding/state`**, que sigue como esta.

## Diseño

### D1 — El catalogo de items, en codigo

`apps/merchant/src/server/onboarding/checklist.ts`, con la forma de `ENTITLEMENTS`
(`entitlements/catalog.ts`): objeto `as const satisfies Record<string, ChecklistItemDef>`, de
modo que **una entrada mal formada no compila**.

```ts
type ChecklistFacts = { emailVerified: boolean };

type ChecklistItemDef = {
  position: number;
  /** DOS EJES SEPARADOS (ADR 0077 §2), no uno. `required` = hay que hacerlo.
   *  `blocking` = mientras no este `done`, los de `position` mayor no se pueden hacer.
   *  Un item puede ser obligatorio sin frenar al resto, y frenar al resto sin ser
   *  obligatorio. Con UN item los dos valen `true` y no se distinguen: por eso el
   *  oraculo que prueba que no son alias vive en la funcion pura (D2), no en el catalogo. */
  required: boolean;
  blocking: boolean;
  /** Clave ESTABLE que la UI mapea a un elemento. NUNCA un selector ni una coordenada
   *  (ADR 0077 §3): si la API guardara coordenadas, cada rediseño de UI romperia el tour
   *  en produccion sin poner rojo a nadie. */
  anchor: string;
  title: string;
  body: string;
  /** El «¿esta hecho?». Es una funcion y no un dato porque cada item lo deriva de un hecho
   *  distinto — por eso agregar un item va a exigir deploy aunque el catalogo mude a tabla
   *  algun dia (ADR 0077 §4). */
  done: (facts: ChecklistFacts) => boolean;
};
```

Una sola entrada:

| id | position | required | blocking | anchor | done |
|---|---|---|---|---|---|
| `verify-email` | `1` | `true` | `true` | `"verify-email"` | `(f) => f.emailVerified` |

El `title` y el `body` son copia en español y **no son contrato** — lo que la UI puede dar por
estable es el `id` y el `anchor`.

**`required` y `blocking` son dos campos y dos preguntas distintas** (ADR 0077 §2, decision
textual del owner del 2026-09-20). `verify-email` los tiene los dos en `true` porque es la
regla que el owner dicto para el email; **que hoy coincidan no los hace el mismo campo**, y el
implementador **no** debe derivar uno del otro — ni siquiera «porque hoy da igual». Ese atajo
es exactamente lo que ataca la mutacion **M5** (era la M6 antes de que la enmienda del
2026-09-20 rehiciera la tabla; la M6 de hoy es la del inventario).

### D2 — La funcion pura que arma la vista

```ts
export function toChecklistView(
  facts: ChecklistFacts,
  items: Record<string, ChecklistItemDef> = CHECKLIST_ITEMS,
): ChecklistView
```

**El segundo parametro tiene default y existe por dos oraculos concretos**, no por gusto de
inyectar: es la unica forma de alimentar entradas **sinteticas** —desordenadas, o con
`required` y `blocking` divergentes— que el catalogo real de un solo item no puede producir.
La ruta lo llama **sin** el segundo argumento.

Devuelve `{ locale: "es", items: [...] }` con los items **ordenados por `position` ascendente**
y cada uno con su `done` ya resuelto. Es pura: no toca base ni sesion, asi que su test no
necesita Neon. El `sort` por `position` **se hace en la funcion y no se asume del orden de
declaracion** del objeto — el dia que el catalogo mude a tabla, el orden de las filas no esta
garantizado, y un `sort` que ya esta ahi es lo que evita que ese dia el bug sea silencioso.

### D3 — La ruta y su guard

`apps/merchant/src/app/api/onboarding/checklist/route.ts`, `export const dynamic = "force-dynamic"`.

**La escalera, y el salteo es el punto de la spec** (ADR 0077 §6 / ADR 0073 §1):

**EL GUARD ES UNA LINEA, Y ES LA PIEZA QUE YA EXISTE:**

```ts
const auth = await requireApiOwnerSinGateDeEmail(request, {
  notOwner: "Solo el owner puede ver el checklist del onboarding.",
});
if ("failure" in auth) return apiOwnerFailureResponse(auth.failure);
```

`requireApiOwnerSinGateDeEmail` (`api-owner.ts:174`) hace **pasos 1, 2 y 4 — sin el 3**, que es
exactamente lo que esta ruta necesita:

| Paso | Chequeo | Respuesta |
|---|---|---|
| 1 | ¿hay sesion? | **401** `unauthorized` |
| 2 | ¿owner con membresia `active`? | **403** `not_owner` |
| 3 | ¿email verificado? | **NO CORRE** — es la razon de ser de esa funcion |
| 4 | ¿el negocio opera? | **403** `business_suspended` \| `business_closed` |
| — | todo bien | **200** con `toChecklistView` |

**Por que no `requireApiOwner` a secas:** su escalera evalua el email en el paso 3 **siempre** y
no admite saltarlo (verificado). Usarlo devolveria 403 `email_not_verified` justo al owner que
viene a que le digan que verifique el email.

**Y POR QUE NO SE ARMA LA ESCALERA A MANO —aunque llame a las mismas piezas compartidas—:**
porque el repo eligio (spec 0075 §D1) marcar las exenciones **con un nombre distintivo y no con
un flag**, para que `rg 'SinGateDeEmail' apps` pueda contarlas. Una escalera escrita a mano es
una exencion que **ni el `rg` ni el inventario ven**. Es el mecanismo de control, no estetica.

**El paso 4 NO se saltea**, a proposito: saltear el 3 tiene una razon (auto-gateo), saltear el
4 no tendria ninguna.

**El `code` es el contrato, el `error` es copia** (convencion de los contratos 0072/0074/
0078/0079/0081). Los cuatro `code` de fallo salen de `API_OWNER_CODES`, sin inventar ninguno,
**menos `email_not_verified`, que esta ruta NO puede emitir nunca.**

Fallo de base → **503** `onboarding_unavailable`.

### D4 — Costo de la lectura

**CORREGIDO EL 2026-09-20, y el error lo produjo la propia enmienda.** La version original
decia «cero consultas extra … total: una consulta». **Era cierta cuando la ruta armaba la
escalera a mano y resolvia la sesion UNA vez**; al pasar a `requireApiOwnerSinGateDeEmail` dejo
de serlo, porque el contrato de retorno de esa funcion —el mismo de `requireApiOwner`— son
`business` y `userId`, **no la sesion**. Lo reprodujo el orquestador sobre `ApiOwnerResult`.

El costo real, entonces: **una consulta del guard (`ownerContext`) + una SEGUNDA lectura de la
sesion** para obtener `emailVerified`. Es exactamente el mismo costo que ya paga y documenta
`callerOf` en `app/api/loyalty-program/route.ts`, por el mismo motivo.

**Donde vive esa lectura:** en `server/onboarding/checklist-facts.ts`, **no en el archivo de la
ruta**. No es capricho — sacarla de adentro del guard obligaria a tocar **el cuerpo** de las dos
funciones, que la spec 0075 exige byte por byte iguales; y dejarla en la ruta contradiria el
criterio del DoD que mantiene a ese archivo sin escalera propia.

**Lo que NO se hizo y se declara:** no se configuro `cookieCache` de better-auth para ahorrar
esa segunda lectura. Seria un cambio de configuracion de auth que afecta a **todas** las
superficies, muy fuera del alcance de una spec chica de un endpoint de lectura.

### D5 — El inventario de exenciones pasa de 2 a 3

Esta ruta es la **tercera** exenta del gate de email, y eso se **declara**, no se deja implicito:

| Archivo | Que cambia |
|---|---|
| `api-owner-surfaces-support.ts` | la fila del checklist entra a `SURFACES`, y `"onboarding/checklist"` se suma a `NOMBRES_SIN_GATE_DE_EMAIL` |
| `api-owner-surfaces.test.ts` | una entrada en `DESENLACE_SIN_GATE` (el desenlace del camino feliz: **200** y cuerpo con `items[0].id === "verify-email"`), la lista de nombres aseverada, y **`.toBe(2)` → `.toBe(3)`** |

**Las dos tablas salen de `SURFACES` por filtro** —no son listas paralelas—, asi que agregar la
fila en un solo lugar mueve los dos pisos.

**Esto NO es «editar un test para que pase un gate»:** el test **no esta rojo**. Es un
inventario declarado que cambia porque el owner decidio sumar una exencion. Si hay 3 y el
inventario dice 2, **el que miente es el inventario**.

**Ganancia colateral, y no es menor:** al entrar a `SURFACES`, la ruta queda cubierta por la
bateria que ya corre **los cinco estados del caller** sobre cada superficie — cobertura que con
la escalera a mano no tenia.

**El docblock de `requireApiOwnerSinGateDeEmail` hay que ACTUALIZARLO:** hoy dice «exactamente
esas dos rutas». Pasa a tres, nombrando a esta y su motivo.

## Archivos

| Archivo | Accion |
|---|---|
| `apps/merchant/src/server/onboarding/checklist.ts` | crear |
| `apps/merchant/src/server/onboarding/checklist-facts.ts` | crear — la segunda lectura de sesion (D4). **Se agrego en la enmienda**: no estaba en la tabla original porque la version original de D4 creia que no hacia falta |
| `apps/merchant/src/app/api/onboarding/checklist/route.ts` | crear |
| `apps/merchant/src/server/onboarding/checklist.test.ts` | crear |
| `apps/merchant/src/server/onboarding-checklist.neon.integration.test.ts` | crear |
| `apps/merchant/src/server/api-owner-surfaces-support.ts` | **editar** — la fila y el nombre en el inventario (D5) |
| `apps/merchant/src/server/api-owner-surfaces.test.ts` | **editar** — desenlace, lista y el conteo 2 → 3 (D5) |
| `apps/merchant/src/server/api-owner.ts` | **editar SOLO el docblock** de `requireApiOwnerSinGateDeEmail`: «dos rutas» → tres. **Ni una linea de codigo** |
| `docs/specs/0083-contratos-de-api.md` | ya escrito (anexo de esta spec) |

**Disjunta?** **Si.** No hay otra spec en ejecucion. **Pero ya NO es cierto que «ninguna ruta
existente se edita»:** la enmienda toca tres archivos existentes, los tres del inventario de
exenciones. El cuerpo de `requireApiOwner` y el de su hermana **quedan byte por byte iguales** —
eso es invariante de la spec 0075 y esta spec no lo afloja.

## Definition of Done

- [ ] **Un owner SIN el email verificado recibe 200**, con `items[0].id === "verify-email"`,
      `done: false`, `required: true`, `position: 1`. **Este es el caso central de la spec:**
      es la prueba de que la ruta no se gatea a si misma.
- [ ] **Un owner CON el email verificado recibe 200** con el mismo item y `done: true`.
- [ ] **`required` y `blocking` viajan como campos SEPARADOS** y el item de `verify-email` trae
      los dos en `true`.
- [ ] **`blocking` NO es un alias de `required`:** `toChecklistView` con una entrada sintetica
      `{ required: true, blocking: false }` devuelve **exactamente eso** (y el caso espejo
      `{ required: false, blocking: true }`). Sin Neon, sobre la funcion pura.
- [ ] **Sin sesion → 401** con `code: "unauthorized"`.
- [ ] **Un integrante (`role='staff'`) → 403** con `code: "not_owner"`, y **no** con
      `email_not_verified`.
- [ ] **Un negocio `closed` → 403** `business_closed`; **`suspended` → 403**
      `business_suspended`.
- [ ] **La ruta no emite `email_not_verified` en ningun camino:**
      `rg -n 'email_not_verified' apps/merchant/src/app/api/onboarding/checklist/` → **vacio**.
- [ ] **La ruta usa la pieza existente:**
      `rg -n 'requireApiOwnerSinGateDeEmail' apps/merchant/src/app/api/onboarding/checklist/route.ts`
      → presente; y `rg -n 'ownerContext|businessStatusFailure|getSession|innerJoin|getDb' .../route.ts`
      → **vacio** (la ruta no arma la escalera ni consulta por su cuenta).
- [ ] **El inventario de exenciones dice TRES:** `rg -l 'SinGateDeEmail' apps/merchant/src/app`
      → **exactamente 3 rutas** (`loyalty-program`, `loyalty-program/qr`, `onboarding/checklist`);
      `NOMBRES_SIN_GATE_DE_EMAIL` contiene `"onboarding/checklist"`; y la asercion de conteo
      del test dice **3**, no 2.
- [ ] **El CUERPO de los dos guards queda intacto** (invariante de la 0075, que esta spec no
      afloja): en el diff de `api-owner.ts` **solo hay lineas de docblock** — ni una linea
      dentro de `requireApiOwner` ni de `requireApiOwnerSinGateDeEmail`.
- [ ] **`toChecklistView` ordena por `position`** aunque las entradas lleguen desordenadas
      (test de la funcion pura, sin Neon).
- [ ] **Ningun `.tsx` tocado:** `git status --porcelain | grep -c '\.tsx$'` → **0**.
- [ ] Gates de root con Node 24, **una sola vez al final**: `typecheck`, `lint`, `test`,
      `format:check`, `build`.
- [ ] **`test:e2e` NO aplica y se DECLARA** con el barrido de `.tsx` de arriba (esta spec no
      toca UI, ni CSS global, ni pantalla de `/backoffice`).
- [ ] `rg -n MUTATION apps tools` → vacio.

## Mutaciones — presupuesto: 6. Clase: los plausibles

La clase de error a cazar es **que el guard deje pasar a quien no debe, o bloquee a quien la
ruta existe para servir**, y **que `done` no sea vacuo**.

| # | Mutacion | Archivo | Oraculo que tiene que ponerse ROJO |
|---|---|---|---|
| 1 | `requireApiOwnerSinGateDeEmail` → `requireApiOwner` (o sea, poner el paso 3) | `route.ts` | El caso «owner SIN verificar recibe 200 con su item» → debe dar 403 `email_not_verified`. **Es la mutacion que prueba que el invariante central tiene oraculo.** Confirmar que el rojo es el caso del **owner**: el del integrante tiene que quedar VERDE (sigue dando `not_owner`) |
| 2 | Sacar el guard entero y resolver la sesion a mano, sin owner ni `status` | `route.ts` | El caso del **integrante** (403 `not_owner` → 200) **y** los de `closed`/`suspended`. Es el error catastrofico plausible: «total, es una lectura» |
| 3 | `done: () => true` en la entrada | `checklist.ts` | El caso «owner sin verificar» → `done` debe quedar en `true` y romper la asercion |
| 4 | `done: () => false` en la entrada | `checklist.ts` | El caso «owner verificado» → `done` debe quedar en `false`. **La 3 y la 4 juntas** prueban que `done` lee el hecho y no devuelve una constante |
| 5 | En `toChecklistView`, emitir `blocking: def.required` | `checklist.ts` | El caso sintetico `{ required: true, blocking: false }` → debe recibir `blocking: true`. **El catalogo real NO puede cazarla** (con un item los dos valen `true`): su oraculo son entradas sinteticas por el segundo parametro |
| 6 | Sacar `"onboarding/checklist"` de `NOMBRES_SIN_GATE_DE_EMAIL` **dejando la fila en `SURFACES`** | `api-owner-surfaces-support.ts` | La bateria de superficies: la ruta cae a `SURFACES_CON_GATE_DE_EMAIL`, que le va a exigir **403 `email_not_verified`** y va a recibir **200**. **Prueba que el inventario GOBIERNA y no es decorativo** — sin esta mutacion, ampliarlo a 3 seria un numero escrito a mano sin oraculo |

**Cambio respecto de la tabla original** (enmienda del 2026-09-20): las viejas M2 y M5 atacaban
los pasos 2 y 4 **dentro de la ruta**. Con la opcion A esos pasos ya no viven ahi: viven en
`requireApiOwnerSinGateDeEmail`, que **ya esta pinneada** por `api-owner-surfaces.test.ts` sobre
las tres filas. Mutarla seria medir de nuevo lo que otra spec ya mide, con un rojo ancho y poca
informacion. En su lugar entran la M2 nueva (sacar el guard entero, que es el error plausible de
verdad) y la M6 (el inventario), que **no tenian oraculo antes**.

**Protocolo:** `shasum` limpio antes de mutar → fila de bitacora **antes** de medir → etiqueta
`MUTATION` → medir y **transcribir la salida ejecutada** → revertir con `diff` contra copia
limpia. De a una. **Leer la asercion del rojo**: un rojo por el setup no prueba nada.

**Ojo con la M1 y la M2:** las dos pueden dar rojo «por el motivo equivocado» si el test de
staff y el de owner-sin-verificar comparten seed. Verificar que el rojo de la M1 es el caso
del **owner** y el de la M2 es el del **integrante**, leyendo el nombre del test, no el conteo.

**Condicion de corte:** si dos vueltas seguidas terminan en «el fix abrio la siguiente», se
corta y va al owner. Lo que queda afuera se **declara**.

## Declarado AFUERA (sin oraculo, a proposito)

- **Los pasos 1, 2 y 4 en si mismos.** Ya no son codigo de esta spec: viven en
  `requireApiOwnerSinGateDeEmail` y los pinnea `api-owner-surfaces.test.ts` corriendo los cinco
  estados del caller sobre las tres filas. Esta spec prueba que **usa** esa pieza (M1, M2) y que
  **esta declarada en el inventario** (M6), no vuelve a probar la pieza.
- **El idioma.** `locale: "es"` es una constante; no hay caso que lo mueva porque no hay
  columna de idioma del merchant en ninguna tabla (medido). No se testea la eleccion de
  idioma porque no hay eleccion.
- **Que la UI respete `position` y `required`.** Es comportamiento de la UI, que esta spec no
  construye. El contrato lo dice; el oraculo lo tendra el QA de pantalla del owner.
- **El texto (`title`, `body`).** Es copia, no contrato. Un test que lo asevere se rompe con
  cada ajuste de redaccion sin que nada este mal.
- **El comportamiento con dos o mas items** (orden entre items, bloqueo en cadena). **Hoy hay
  un item y no se puede falsificar con uno solo.** Los dos pedazos que SI se cubren, ambos con
  entradas sinteticas sobre la funcion pura: el `sort` por `position`, y la independencia de
  `required` y `blocking`.
- **Que la UI aplique `blocking` de verdad** (deshabilitar los de `position` mayor). La API
  **reporta** los dos ejes; **no los hace cumplir**, porque con un solo item no hay un
  «siguiente» que bloquear y porque el bloqueo es comportamiento de pantalla. El dia que haya
  un segundo item hay que decidir si la API ademas **rechaza** acciones de un item bloqueado —
  esa decision **no esta tomada** y no se da por tomada aca.

## Hallazgo medido que queda ABIERTO (no lo decidio el owner)

**`api-owner-surfaces.test.ts` quedo en 299 lineas y el hook `file-size` corta en 300.** Entro
por un pelo, y para entrar hubo que compactar dos docblocks que la enmienda ya tenia que
reescribir. **La proxima superficie que se sume al inventario —exenta o no— no entra**, y ahi
aplica la regla de `CLAUDE.md`: *dividir, no extender*. No se divide en esta spec porque seria
un refactor de un archivo ajeno sin su tarea; queda anotado para que el dia que pase no se
descubra como sorpresa en mitad de otra spec.

## Handoff

**UN implementador para toda la spec, UN revisor independiente al final** (ADR 0071). El
revisor produce un `PASS` con evidencia ejecutada antes de marcar `implementada`.

**Para el revisor, el foco:** que la M1 este realmente medida y que su rojo sea el caso del
owner sin verificar. Toda la spec existe para esa propiedad; si esa mutacion no muerde, el
resto no importa.

## Abierto

**Nada.** Las seis decisiones que estaban abiertas desde la 0074 se cerraron en el **ADR 0077**
el 2026-09-20, y el owner cerro la spec ese mismo dia tras pedir el unico arreglo que faltaba:
**separar `required` de `blocking`** (*«Si necesitamos determinar si es o no obligatoria, no
solo que se bloquee la siguiente mayor»*), que es lo que quedo en D1, en la **M5** y en el §1 del
contrato.

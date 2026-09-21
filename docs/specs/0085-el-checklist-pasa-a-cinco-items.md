---
spec: 0085
fecha: 2026-09-20
estado: cerrada
resumen: El checklist del onboarding pasa de UNO a CINCO items (ADR 0078 §1) y pierde un campo. Los cuatro nuevos son TOURS —staff, catalogo, programa, marca— y su `done` sale de `core.business_onboarding_tour` (spec 0084): `completed` Y `skipped` cuentan los dos como `done: true`. Y `blocking` SE BORRA del tipo, del JSON y del contrato: el owner pregunto por que habia dos campos y la respuesta medida es que no hay dos — su definicion de `required` («sin eso no se puede hacer nada mas») ES la de `blocking`, y con los cinco items reales los dos ejes nunca divergen. `verify-email` queda como el UNICO `required: true`. Corrige ademas el contrato 0083, que todavia le anuncia a quien construya la UI un `GET /api/onboarding/guide/{item}` que el ADR 0078 §4 mato.
disjunta: no
archivos: apps/merchant/src/server/onboarding/checklist.ts, apps/merchant/src/server/onboarding/checklist.test.ts, apps/merchant/src/server/onboarding/checklist-facts.ts, apps/merchant/src/app/api/onboarding/checklist/route.ts, apps/merchant/src/server/onboarding-checklist.neon.integration.test.ts, apps/merchant/src/server/api-owner-surfaces.test.ts, docs/specs/0083-contratos-de-api.md
---

# 0085 — El checklist pasa a cinco items, y pierde un campo

> **Plantilla CHICA (ADR 0071).** Las tres condiciones valen: **un solo dominio** (onboarding),
> **sin migraciones** (la tabla la crea la 0084) y **sin decision de producto abierta** — las dos
> que faltaban las cerro el owner el 2026-09-20.

## Problema

- **El catalogo tiene UN item** (`checklist.ts:92`, `verify-email`) y el ADR 0078 §1 definio
  cinco. Los cuatro que faltan son tours y **su hecho ya tiene donde vivir** desde la spec 0084.
- **`blocking` no tiene ni una instancia real y arrastra codigo.** Medido con
  `rg -c blocking`: **8 lineas en `onboarding/checklist.ts` y 14 en `checklist.test.ts`**, donde
  hay un bloque de oraculo entero —con entradas **sinteticas** y sus dos espejos— cuyo unico
  proposito es probar que no es alias de `required`. Con los cinco items reales **los dos campos valen lo mismo en los cinco casos**.
- **El contrato miente hacia adelante.** `0083-contratos-de-api.md` §5 le dice a quien construya
  la UI que va a haber un `GET /api/onboarding/guide/{itemId}`. **Ese endpoint no existe y no va a
  existir** (ADR 0078 §4): el contenido del tour lo define la UI con `driver.js`.

## Alcance

**Entra:**
- Los cuatro items de tour en `CHECKLIST_ITEMS`, con `position` 2 a 5.
- El borrado de `blocking` del tipo, del catalogo, de la vista y del JSON.
- La lectura del progreso de tours en `checklist-facts.ts` y su costo declarado.
- La enmienda del contrato `0083-contratos-de-api.md` (§1 y §5).

**No entra:**
- **La tabla y la escritura.** Son de la 0084, que va antes.
- **Cualquier `.tsx`** y **la libreria de tours**: la UI la construye el owner por fuera
  (ADR 0070 §16-17). Esta spec no instala `driver.js`.
- **Cambiar el guard de la ruta.** Sigue con `requireApiOwnerSinGateDeEmail` y el inventario de
  exenciones sigue en 3.

## Diseño

### 1. El campo que se borra, y la semantica que queda

**Decision del owner del 2026-09-20, textual:** *«Required es importante porque sin eso no se
puede hacer nada mas, ejemplo verficar email. de echo ser ala unica. Blocking no se porque tenemos
blockint»*, y el cierre: *«colapsa a un campo»*.

**`required` queda con LA SEMANTICA QUE LE DIO EL OWNER**, que es la que el ADR 0077 §2 le habia
puesto a `blocking`:

> **`required: true`** → hay que hacerlo, y **mientras no este `done` los items de `position`
> mayor estan bloqueados**.

**`verify-email` es el unico `required: true`.** Los cuatro tours son `required: false`.

**Por que ahora y no despues:** el endpoint ya esta implementado y pusheado, pero **ninguna UI lo
consume** — no existe pantalla de onboarding en el backoffice. Sacar un campo del JSON cuesta cero
hoy y sube el dia que exista el primer lector.

**Lo que se borra con el:** el bloque de oraculo de `checklist.test.ts` que prueba la
independencia de los dos ejes, **y solo ese**. El segundo parametro de `toChecklistView` **SE
QUEDA**: su otro oraculo —el `sort` por `position` con entradas desordenadas— sigue vivo y ahora
vale mas, porque hay cinco items en vez de uno.

### 2. Los cinco items

| `position` | `id` = `anchor` | `required` | De donde sale su `done` |
|---|---|---|---|
| 1 | `verify-email` | **`true`** | la sesion (`emailVerified === true`) — **no cambia** |
| 2 | `staff` | `false` | `core.business_onboarding_tour` |
| 3 | `catalog` | `false` | idem |
| 4 | `program` | `false` | idem |
| 5 | `brand` | `false` | idem |

El orden es el que dicto el owner (*«2.2 Staff, 2.3 Catalogo, 2.4 Programa, 2.5 marca»*).
`title` y `body` son **copia, no contrato**: ningun test asevera su texto.

**Los cuatro ids salen de `ONBOARDING_TOURS`** (`server/onboarding/tours.ts`, que crea la 0084).
**No se escribe una segunda lista**: dos listas de ids se desincronizan y el `POST` aceptaria un
tour que el checklist no muestra, o al reves.

**Que la pantalla de un tour no exista todavia NO bloquea** (ADR 0078 §6): su `done` queda en
`false`, nadie recibe un `POST` para el, y como ningun tour es `required` no traba a los que
siguen. Hoy `/backoffice/staff` no existe (`backoffice-navigation.tsx:37`, `href: null`).

### 3. El `done` de un tour: `completed` **y** `skipped` cuentan igual

`ChecklistFacts` gana el progreso:

```ts
export type ChecklistFacts = {
  emailVerified: boolean;
  /** Los `tour_id` con fila en `core.business_onboarding_tour`, sea `completed` o `skipped`. */
  toursHechos: ReadonlySet<string>;
};
```

**La consulta es UNA sola por request** —todas las filas del negocio— y **no cinco**: se lee la
tabla entera para ese `business_id` (son 4 filas como mucho) y cada item pregunta por su id.

**`skipped` cuenta como `done`** — ADR 0078 §2, decision del owner: *«si, un merchant puede
completar el onboarding con skip de todo»*. **El JSON NO dice cual de los dos fue**: el contrato
de la UI es `done: boolean`. La distincion se persiste (0084) pero no se serializa.

**Fail-closed:** un negocio sin filas tiene los cuatro tours en `false`. **Nunca al reves** — un
error de lectura no puede dar un item por hecho. Misma regla que el `=== true` del email.

### 4. El costo, declarado (y el precedente que obliga a declararlo)

**`checklistFacts` pasa a recibir el `businessId`** —`checklistFacts(request, businessId)`— y la
ruta se lo pasa desde `auth.business.id`, **nunca del cuerpo ni de la query**.

**Cada pedido de checklist suma UNA consulta** a `core.business_onboarding_tour`, encima de la
segunda lectura de sesion que ya documenta `checklist-facts.ts`. **Se declara aca y se escribe en
el docblock.** Es el precedente exacto de la 0083, cuyo §D4 decia «cero consultas extra» y quedo
falso al enmendarse: un docblock que miente sobre el costo es un defecto activo en este repo.

### 5. La enmienda del contrato `0083-contratos-de-api.md`

Es **entregable, no documentacion opcional** (ADR 0070 §16): es el insumo de quien construye la UI.

- **§1** — sale la fila de `blocking` de las dos tablas; `required` se redefine con las palabras
  del owner; el ejemplo de `items` pasa a mostrar **cinco**; se saca la frase *«Hoy los dos valen
  `true` en el unico item»* y la de *«no leer uno por el otro»*.
- **§1, el parrafo del «hace cumplir»** (hoy: *«Si la API ademas debe **rechazar** acciones de un
  item bloqueado es una decision que **no esta tomada**, y se toma cuando haya un segundo item»*).
  **La decision YA se tomo, y la tomo la spec 0084: es que SI.** `POST /api/onboarding/tours/
  {tourId}` lleva el gate de email —`requireApiOwner` con su paso 3— y ese 403
  `email_not_verified` es el bloqueo de `verify-email` HECHO CUMPLIR, no reportado. El parrafo se
  reescribe con esa decision tomada; su condicion (*«cuando haya un segundo item»*) la cumple esta
  misma spec, que lleva el catalogo a cinco.
- **§4** — la fila «Mas de un item» deja de decir que el catalogo tiene una entrada.
- **§5** — **se reescribe entero.** Deja de anunciar `GET /api/onboarding/guide/{itemId}` y pasa a
  decir lo que es cierto: **el tutorial NO es un endpoint**, los pasos los define la UI con su
  libreria de tours, y **lo unico que viaja por HTTP es el ESTADO** — `done` en este `GET`, y la
  escritura en `POST /api/onboarding/tours/{tourId}` (contrato en `0084-contratos-de-api.md`).
- Se agrega la nota de que `completed` y `skipped` **proyectan los dos `done: true`** y que la UI
  no puede distinguirlos.

## Archivos

| Archivo | Accion |
|---|---|
| `apps/merchant/src/server/onboarding/checklist.ts` | editar (4 items, borrar `blocking`) |
| `apps/merchant/src/server/onboarding/checklist.test.ts` | editar |
| `apps/merchant/src/server/onboarding/checklist-facts.ts` | editar (firma + consulta) |
| `apps/merchant/src/app/api/onboarding/checklist/route.ts` | editar (pasa el `businessId`) |
| `apps/merchant/src/server/onboarding-checklist.neon.integration.test.ts` | editar |
| `apps/merchant/src/server/api-owner-surfaces.test.ts` | editar — **ver abajo, es una trampa** |
| `docs/specs/0083-contratos-de-api.md` | editar (enmienda) |

**LA TRAMPA DE `api-owner-surfaces.test.ts`, MEDIDA y no supuesta.** Sus dos aserciones sobre el
checklist **sobreviven** (`items[0].id === "verify-email"` y `done === false`: con el `sort` por
`position`, el item 1 sigue siendo el primero). **Pero el archivo dobla `./db` con una cadena
FIJA** (`api-owner-surfaces.test.ts:74-83`):

```js
getDb: () => ({ select: () => ({ from: () => ({ where: () => ({ limit: async () => [...] }) }) }) })
```

La consulta de tours es `select().from().where(...)` **sin `.limit()`**, y en drizzle eso se
espera directamente. Contra este doble, `await` sobre `where()` devuelve **el objeto `{limit}`**,
no un array: el `.map`/iteracion revienta, el `catch` de la ruta lo convierte en **503** y
**todos** los casos del checklist de la bateria se caen. Hay que **extender el doble** para que
`where()` sea a la vez `await`-able (array) y tenga `.limit()`.

**Y el presupuesto de lineas:** el archivo esta en **299** y el hook `file-size` corta en **300**.
Extender el doble **no entra**. Hay que **DIVIDIR el archivo** (regla de `CLAUDE.md`: dividir, no
extender) — el camino natural es mover los dobles a `api-owner-surfaces-support.ts`, que esta en
120 lineas y ya existe para exactamente esto. **No borrar asercion para hacer lugar.**

**Disjunta?** **No.** Colisiona con la **0084** en `api-owner-surfaces.test.ts`, y ademas **depende**
de ella: consume `ONBOARDING_TOURS` y la tabla. **La 0084 va primero y tiene que estar
`implementada`.**

## Definition of Done

- [ ] `rg -n 'blocking' apps/merchant/src/server/onboarding apps/merchant/src/app/api/onboarding`
      → **vacio**. *(Barrido corrido contra el arbol al cerrar esta spec: hoy da **8** lineas
      en `checklist.ts` y **14** en `checklist.test.ts`, asi que NO pasa vacuo.)*
- [ ] `rg -n 'guide' docs/specs/0083-contratos-de-api.md` → **vacio**. *(Hoy da matches: el
      criterio muerde.)*
- [ ] El `200` trae **5 items**, con `position` 1..5 y los ids exactos de la tabla del §2,
      aseverado contra el orden.
- [ ] `Object.keys(items[0]).sort()` **no contiene `blocking`**, aseverado.
- [ ] Un item de tour con fila `completed` → `done: true`; con fila **`skipped`** → `done: true`;
      **sin fila** → `done: false`. Los tres, ejecutados contra Neon.
- [ ] Los ids de los items de tour **salen de `ONBOARDING_TOURS`**, no de un literal:
      `rg -n 'ONBOARDING_TOURS' apps/merchant/src/server/onboarding/checklist.ts` → **no vacio**.
- [ ] `apps/merchant/src/server/api-owner-surfaces.test.ts` **≤ 300 lineas** (`wc -l`) con el doble
      ya extendido.
- [ ] Gates de root con Node 24, **una sola vez al final**: `typecheck`, `lint`, `test`,
      `format:check`, `build`. **`test:e2e` NO aplica y se DECLARA** con
      `git status --porcelain | grep -c '\.tsx$'` → `0`.
- [ ] `rg -n MUTATION apps tools` → vacio.

## Mutaciones — presupuesto: 5. Clase: los plausibles

| # | Mutacion | Oraculo que tiene que ponerse ROJO |
|---|---|---|
| **M1** | En el `done` de los tours, contar **solo** `completed` (excluir `skipped`) | El caso `skipped → done: true`. **Es la decision textual del owner** y el unico oraculo que la sostiene |
| **M2** | `done` de los tours → `() => true` constante | El caso «sin fila → `done: false`» |
| **M3** | La consulta de tours ignora el `businessId` (lee la tabla entera) | El caso de aislamiento: un negocio ve el progreso de otro |
| **M4** | Poner `required: true` en un tour | El item de tour serializa `required: false` — **el owner dijo que el email sea el UNICO** |
| **M5** | Sacar el `sort` por `position` de `toChecklistView` | El unit con entradas **desordenadas** (el oraculo que sobrevive al borrado de `blocking`) y el orden de los 5 ids en integracion |

**Protocolo:** `shasum` limpio **antes** de mutar → fila de bitacora en `TASKS.md` **antes** de
medir → etiqueta `MUTATION` → medir y **transcribir la salida ejecutada** → revertir con `diff`
contra la copia limpia. De a una. **Leer la asercion del rojo**, no el conteo.

**Condicion de corte:** si dos vueltas seguidas terminan en «el fix abrio la siguiente», se corta
y va al owner. Lo que quede afuera se **declara**.

## Declarado AFUERA (sin oraculo, a proposito)

- **El `503 onboarding_unavailable`**, igual que en la 0083 y la 0084. **Sigue pendiente de
  decision del owner**, a quien se le ofrecio cerrarlo; si dice que si, se cierra para las tres
  rutas de una vez.
- **Que el JSON no distinga `completed` de `skipped`** no tiene oraculo propio mas alla de que los
  dos den `done: true` (M1). Aseverar que la clave NO existe seria aseverar una ausencia que ya
  cubre el chequeo de `Object.keys`.

## Handoff

**UN implementador para toda la spec, UN revisor independiente al final** (ADR 0071). El revisor
produce un `PASS` con evidencia **ejecutada** antes de marcar `implementada`.

**Al revisor, en el encargo:** presupuesto **5 mutaciones**, clase de error a cazar **«que un item
se de por hecho sin serlo, que el `skipped` deje de contar, o que un negocio vea el progreso de
otro»**. Lo que quede afuera se **declara**, no se persigue.

## Abierto

Nada que bloquee.

---
spec: 0080
fecha: 2026-09-19
estado: implementada
resumen: Los pendientes que dejo anotados el cierre del ADR 0076, pedidos por el owner textual («completa las que quedan en tasks.md»). Son tres arreglos de ORACULO y un flake ajeno con mecanismo medido — cero cambios de comportamiento en produccion: un invariante del contrato 0079 que hoy no tiene test y que un solo caracter puede romper sin poner nada rojo, un docblock que afirma lo que su caso no mide, y un test de otro dominio que lee `.at(-1)` de un `select` sin `ORDER BY`. Va ANTES de la spec del TOS porque las dos tocan el dominio de `program-defaults`.
disjunta: no
archivos: apps/merchant/src/server/onboarding/program-defaults-clauses.test.ts, docs/specs/0079-una-sola-ruta-de-escritura-del-programa.md, apps/merchant/src/server/onboarding-grant.neon.integration.test.ts, apps/merchant/src/server/consumer-recovery.neon.integration.test.ts
---

# 0080 — Los pendientes del cierre del ADR 0076

> **Plantilla CHICA (ADR 0071).** Las tres condiciones valen: **un solo dominio** (tests del
> merchant), **sin migraciones**, **sin decision de producto abierta** — el owner ya dijo
> «completa las que quedan en tasks.md».

## Problema

Los tres los dejo el revisor de la 0079 y **ninguno es un bug de produccion**: los tres son
defectos de ORACULO, que es justo la clase de defecto que este repo decidio no dejar pasar.

1. **Un invariante del contrato 0079 SIN ORACULO.** `docs/specs/0079-contratos-de-api.md`
   declara que `clauses: []` **no** es lo mismo que omitir `clauses`: el primero tiene que dar
   422 y el segundo trae las semillas del pais. Hoy eso lo sostiene **un solo caracter**:
   `if (partial.clauses !== undefined)` en `onboarding/program-defaults.ts:177`. Cambiarlo a
   truthy (`if (partial.clauses)`) cambia el comportamiento, y **ningun test del repo se pone
   rojo**.

   **⚠️ CORRECCION MEDIDA POR EL IMPLEMENTADOR (2026-09-19): el ejemplo con el que esta spec y el
   revisor de la 0079 describian el invariante era FALSO. `[]` es TRUTHY** (`Boolean([])` →
   `true`, verificado por el orquestador con `node -e`), asi que `if (partial.clauses)` y
   `if (partial.clauses !== undefined)` **deciden lo MISMO para `clauses: []`**. Con la mutacion
   M1 viva y solo los casos que esta spec pedia, todo quedaba **VERDE (21/21)**.

   **Lo que ese caracter sostiene de verdad es un `clauses` FALSY PERO PRESENTE** — `null`, `""`,
   `0`, `false`: con truthy, un `clauses: null` **recibe las semillas y CREA el programa** en vez
   de irse al 422. Ese es el invariante real y es el que hay que pinnear. La afirmacion «el
   revisor lo verifico con una sonda ejecutada» sobre `clauses: []` **no es reproducible**.

   **⚠️ DONDE VIVE EL INVARIANTE, medido por el orquestador y NO por lectura de un handoff:** el
   `if` esta en **`programInput` (`program-defaults.ts:177`)**, la funcion `async` que consume la
   ruta, **no** en `composeProgramInput` (que es puro y recibe los ids ya resueltos). Eso decide
   la forma del test: **`composeProgramInput` NO puede pinnear este invariante** — cuando se lo
   llama, la decision de sembrar ya fue tomada.

2. **Un docblock que afirma lo que su caso NO mide.** En
   `onboarding-grant.neon.integration.test.ts`, el caso que la 0079 dio vuelta se titula «es lo
   UNICO que el permiso habilita» pero mide una **creacion**, y `programEditDenied`
   (`server/onboarding-grant.ts:73`) abre con `if (!input.isEdit) return null;` — o sea que ese
   201 sale **igual sin permiso**, y el propio `onboarding-program-bypass.neon` lo prueba. El
   comentario induce a error sobre que es lo que protege el permiso.

3. **Un test ajeno que falla de manera no determinista, con el mecanismo MEDIDO.**
   `consumer-recovery.neon.integration.test.ts:363-367` hace
   `select ... where(eq(otpDeliveries.phoneE164, phones[4]))` **SIN `ORDER BY`** y lee
   `.at(-1)`. `phones[4]` se usa en **DOS** tests del archivo (~269 y ~350): el primero deja una
   entrega `accepted` y el segundo una `failed`. El orden de filas en Postgres es indefinido, asi
   que `.at(-1)` levanta cualquiera de las dos. **Reproducido por el orquestador el 2026-09-19**:
   `expected 'accepted' to be 'failed'`, tanto en la suite entera como corriendo el archivo solo,
   sobre el MISMO arbol en el que el implementador y el revisor lo vieron verde.

   **⚠️ Y LO QUE NO ES:** los handoffs viejos decian que era una colision de `phone_e164` UNIQUE.
   **Eso es FALSO** y se propago sin medir. No se vuelve a escribir.

## Alcance

**Entra:** los tres arreglos de arriba, y nada mas.

**No entra** (explicito):

- **El costo de los 5 round-trips por `PUT`** que midio el revisor de la 0079. Es **costo, no
  correccion**, la alternativa toca `api-owner.ts` —que la 0075 pidio dejar intacto— y **el
  owner no lo decidio**. Queda como hallazgo abierto en `TASKS.md`.
- **La divergencia `asc`/`desc` entre `ownerContext` y `ownerBusiness`** (el guard y el writer
  pueden resolver negocios distintos con 2+ negocios por owner). Es **PREEXISTENTE**, la 0072
  §D3 ya la declara abierta, y cerrarla cuesta un seed nuevo. No entra.
- **Cualquier cambio de comportamiento de produccion.** Los tres arreglos son un test nuevo, un
  rename y un `ORDER BY` en un test. Si el implementador necesita tocar un archivo de `src/` que
  no sea un `.test.ts`, es un bloqueo que reporta, no algo que resuelve.

## Diseño

### 1. El test que le falta al invariante de `clauses`

El caso va sobre **`programInput(raw, userId)`**, que es donde vive la decision
(`program-defaults.ts:177`), y **no necesita Neon**: se mockean sus dos dependencias de base con
`vi.mock` —`ownerBusiness` y `wizardClauseTemplateIds`— igual que hizo la 0078 con el 503.

Tres aserciones, y la tercera es la que le da valor:

- **`clauses: []` explicito** → el resultado conserva **`clauses: []`**, NO las semillas. **Este
  caso NO distingue truthy de `!== undefined`** (ver la correccion del Problema), pero se escribe
  igual: es el que documenta el contrato 0079.
- **`clauses: null`** → viaja **intacto** al 422. **ES EL CASO QUE PINNEA EL INVARIANTE**, y el
  unico que la mutacion M1 puede ver.
- **Sin la clave `clauses`** → el resultado trae las clausulas con sus `templateId`. Control
  positivo: sin el, el caso de arriba pasa con un compositor que nunca siembra nada.
- **Con `clauses: []`, NO hay NI UNA consulta**: se espia **`getDb`** (y `ownerBusiness`), no
  `wizardClauseTemplateIds`. Es la asercion fuerte: prueba que el corto-circuito de la linea 177
  existe, no solo que la salida coincide. **Y ademas es la unica cosa del repo que pinnea el
  ahorro de round-trips que promete el contrato 0079.**

  **⚠️ POR QUE `getDb` Y NO `wizardClauseTemplateIds` — un `vi.mock` ahi seria un ORACULO MUERTO.**
  `programInput` llama a `wizardClauseTemplateIds` por **binding local del mismo modulo**
  (`program-defaults.ts:114`), asi que el doble **no intercepta**: corre la funcion real y el
  espia queda en cero llamadas **siempre**, pase lo que pase. Un `not.toHaveBeenCalled()` sobre el
  **no puede fallar nunca**. Medido con sonda ejecutada por el implementador **y** por el revisor
  de forma independiente — el stack del rojo muestra el `Proxy` del modulo delegando en la real.
  Espiar `getDb` es ademas **mas fuerte**: hace correr `resolveWizardClauseIds` de verdad en vez
  de stubbearlo.

**La firma real de `composeProgramInput` es de DOS argumentos** —`(partial, clauseTemplateIds)`—,
medido en `program-defaults.ts:129-132`. La spec 0079 §3 la anunciaba con tres
(`composeProgramInput(kind, partial, clauseTemplateIds)`): **la spec estaba mal, el codigo esta
bien**, y el `kind` sale de `partial.kind`. Se corrige la 0079 §3 en el mismo commit.

### 2. El rename del caso de `onboarding-grant.neon`

El caso pasa a decir lo que mide. Titulo nuevo, con su motivo:

> `CREAR sigue dando 201 con una sesion sin verificar: la 0079 saco el paso 3 de esta puerta y
> el invariante vive en saveProgram. OJO: este 201 NO prueba el permiso — programEditDenied
> abre con if (!input.isEdit) return null, asi que crear sale igual SIN permiso. El control
> positivo del permiso (editar CON permiso vigente → 200) vive en onboarding-program-bypass.neon.`

**Las aserciones no se tocan**: el caso mide bien, lo que miente es como se llama. Cambiar una
asercion aca seria ablandar un test, que es justo lo que el repo prohibe.

### 3. El `ORDER BY` del test de `consumer-recovery`

La lectura de `consumer-recovery.neon.integration.test.ts:363-367` pasa a ser determinista.
**El arreglo correcto es el que no depende del orden**: filtrar por la fila que el caso
realmente quiere en vez de adivinar con `.at(-1)`.

Dos caminos, y el implementador elige **con el criterio escrito**:

- **(a)** agregar `.orderBy(asc(otpDeliveries.createdAt))` y seguir con `.at(-1)`. **Riesgo
  medido:** si las dos filas comparten `createdAt` (se crean en el mismo test, pueden caer en el
  mismo milisegundo), sigue siendo indefinido. **Hay que verificarlo, no suponerlo.**
- **(b)** aseverar sobre el **conjunto**: que exista **alguna** fila `failed` para ese telefono
  (`.some(row => row.status === "failed")`). No depende de ningun orden.

**Preferido: (b)**, salvo que el implementador mida que (a) es estable. **Lo que NO se hace es
darle a `phones[4]` un telefono propio por test**: eso cambia el setup de un archivo ajeno y
puede mover otros casos.

## Archivos

| Archivo | Accion |
|---|---|
| `apps/merchant/src/server/onboarding/program-defaults-clauses.test.ts` | **crear** — los 4 casos de `clauses` sobre `programInput`. **Archivo aparte y NO ampliacion de `program-defaults.test.ts`**: ese esta en 285 lineas y el hook `file-size` corta en 300 (`LIMIT=300`, `.claude/hooks/file-size.sh:16`). CLAUDE.md ordena «dividir, no extender». Rebote util: el archivo que toca la 0081 queda **sin diff** |
| `apps/merchant/src/server/onboarding-grant.neon.integration.test.ts` | editar — SOLO el titulo y su docblock |
| `apps/merchant/src/server/consumer-recovery.neon.integration.test.ts` | editar — SOLO la lectura de 363-367 |

**Disjunta?** **No.** Colisiona con la **spec del TOS** en el dominio de `program-defaults` (aunque el archivo nuevo va aparte y `program-defaults.test.ts` queda sin diff). **Se
serializa: esta va PRIMERO**, es chica y deja el archivo estable.

## Definition of Done

- [ ] **El invariante de `clauses` MUERDE**: con `if (partial.clauses !== undefined)`
      (`program-defaults.ts:177`) cambiado a `if (partial.clauses)`, el caso de **`clauses: null`**
      se pone **ROJO**. Es la mutacion 1 y es el punto entero de la spec. **Un caso de `[]` NO
      alcanza**: `[]` es truthy.
- [ ] El caso renombrado de `onboarding-grant.neon` **conserva sus aserciones** — se verifica con
      `git diff`: en ese archivo no cambia ni una linea de `expect`.
- [ ] `consumer-recovery.neon.integration.test.ts` corrido **tres veces seguidas**, verde las
      tres. Antes del arreglo fallaba de manera no determinista; una sola corrida verde no
      distingue un arreglo de la suerte.
- [ ] Gates de root con Node 24, una sola vez al final: `typecheck`, `lint`, `test`,
      `format:check`, `build`. **`test:e2e` NO hace falta**: no se toca ni un `.tsx`.
- [ ] `rg -n MUTATION apps tools` → vacio.

## Mutaciones — presupuesto: 2. Clase: los plausibles

| # | Mutacion | Oraculo que tiene que ponerse ROJO |
|---|---|---|
| 1 | `program-defaults.ts:177`: `if (partial.clauses !== undefined)` → `if (partial.clauses)` | **el caso de `clauses: null`** — y SOLO ese: `[]` es truthy y no la distingue |
| 2 | `program-defaults.ts:177`: borrar el `if` entero (sembrar siempre) | los tres casos nuevos, positivo y negativos |

**Protocolo:** `shasum` limpio antes de mutar → fila de bitacora **antes** de medir → etiqueta
`MUTATION` → medir y **transcribir la salida ejecutada** → revertir con `diff` contra la copia
limpia. De a una. **Leer la asercion del rojo**: un rojo por el setup no prueba nada.

**Condicion de corte:** si dos vueltas terminan en «el fix abrio la siguiente», se corta.

## Declarado AFUERA (sin oraculo, a proposito)

- **El flake de `consumer-recovery` no recibe un test que pruebe que ya no flakea.** No existe
  un oraculo barato para «esto es determinista»; lo que hay es la corrida triple del DoD.
- **El costo de los 5 round-trips** y **la divergencia `asc`/`desc`**: fuera de alcance, con su
  motivo arriba y su fila en `TASKS.md`.

## Handoff

UN implementador para toda la spec, UN revisor independiente al final (ADR 0071). El revisor
produce un `PASS` con evidencia ejecutada antes de marcar `implementada`.

## Abierto

Nada que bloquee.

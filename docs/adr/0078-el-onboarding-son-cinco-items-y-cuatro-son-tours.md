---
adr: 0078
fecha: 2026-09-20
estado: aceptada
resumen: El onboarding posterior al wizard son CINCO items y solo UNO deriva de un hecho de dominio (verificar el email, ya implementado). Los otros cuatro son TOURS de pantalla — staff, catalogo, programa, marca— y los cuatro comparten el mismo `done`: «completo o SALTEO este tour». Eso cambia dos cosas del ADR 0077. Primero, MATA el segundo recurso (`GET /api/onboarding/guide/{item}`): el contenido del tour son componentes de una libreria en el cliente (`driver.js`), no JSON del servidor, asi que la API no sirve pasos — solo ESTADO. Segundo, ese estado no es derivable de ningun hecho del negocio, asi que el checklist deja de ser lectura pura y gana su primera escritura y su primera tabla. El progreso se guarda POR NEGOCIO (decision del owner), y `completed` y `skipped` se guardan como valores DISTINTOS aunque los dos cuenten como `done`. Consecuencia aceptada explicitamente por el owner: un merchant puede terminar el onboarding entero salteando los cuatro tours, o sea que el checklist mide «¿le mostramos la app?», no «¿esta listo para operar?».
---

# 0078 — El onboarding son cinco items, y cuatro son tours

## Contexto

El ADR 0077 partio el onboarding en dos recursos —el **checklist** (estado, derivado de hechos
de la base) y el **tutorial** de cada item (contenido, la descripcion de una pantalla)— y
**difirio deliberadamente el segundo** hasta que existiera un caso real (§5). La spec 0083
implemento el primero con **un** item, `verify-email`.

Este ADR se escribe porque el caso real llego, y al llegar mostro que la forma del segundo
recurso estaba mal supuesta.

Arranco con el orquestador proponiendo **staff como segundo item del checklist** (con su `done`
en «¿hay >= 1 integrante?»). El owner corrigio el encuadre, y la correccion es el contenido de
este ADR. Textual:

> *«Las acciones del onboarding la unica obligatoria es verificar el email. […] lo que busco no
> es que añada staff, que modifique su empresa, etc. En realidad lo que busco alli es el tour, el
> merchant entra por primera vez a "staff" y el tour lo guia paso a paso para que pueda añadir su
> staff»*

Y despues, la forma completa:

> *«1 El merchant llega a su panel luego del wizard. 2 Ve el Onboarding — 2.1 Verifica tu email:
> Done cuando el email es verificado. 2.2 Tour por Staff: Done completa el tour o skipe. 2.3 Tour
> por Catalogo: Done completa el tour o skipe. 2.4 Tour por Programa: Done completa el tour o
> skipe. 2.5 Tour por marca: Done completa el tour o skipe»*

## Lo que se midio antes de decidir (2026-09-20)

- **Se midieron TRES librerias de tour sobre nuestro Next 16.3.0** —`@tour-kit/react@3.0.0`,
  `driver.js@1.8.0` y `react-joyride@3.2.0`— en worktree descartable, con build de produccion y
  Playwright emulando un iPhone 13. **Las tres compilan, las tres mantienen el tooltip dentro de
  la pantalla y ninguna tira un error de consola.** Lo que las separa esta en §5.
- **No hay ninguna columna de «visto» en el schema.** Barrido por `tour`, `dismissed`, `seen_at`,
  `visto` y `onboarding` sobre `server/schema/`: lo unico que aparece es `web_push.last_seen_at`
  (otra cosa) y las columnas del *grant* de alta (`onboarding_grant_until`,
  `onboarding_token_hash`). **El estado del tour no tiene donde vivir.**
- **`loyalty_program.updated_at` es `defaultNow()` sin `$onUpdate`** (`schema/loyalty.ts:72`), o
  sea que «el merchant reviso su programa y no toco nada» **no deja rastro**. Cualquier intento
  de derivar el progreso de estos items de un hecho de dominio fracasa por ahi.
- **`GET /api/onboarding/state` sigue siendo otra cosa** y no se toca: su alcance es «que falta
  para terminar el ALTA» y corre antes de verificar el email (ADR 0070 §11).
- **De los cuatro tours, tres apuntan a pantallas que existen** (`/backoffice/catalog`,
  `/backoffice/loyalty`, `/backoffice/brand`) y **el de staff a una que no**
  (`backoffice-navigation.tsx:37`: `href: null`, `soon: true`).

## Decisiones

### 1. Son cinco items, y solo uno deriva de un hecho de dominio

`verify-email` se queda **exactamente como esta** (spec 0083, implementada con PASS): su `done`
sale de la sesion y su accion ya existe. Los otros cuatro son tours.

**La consecuencia de forma:** el catalogo de items deja de ser homogeneo. Un item lee la sesion;
cuatro leen una tabla. El `done` sigue siendo **una funcion por item** —que es lo que el ADR 0077
§4 ya habia dicho— y eso no cambia.

### 2. El `done` de un tour es «completo **o salteo**», y el skip se guarda aparte

Textual del owner, sobre el costo que se le planteo: *«si, un merchant puede completar el
onboarding con skip de todo»*.

**Se le planteo explicitamente lo que eso implica** —que el checklist pasa a medir *«¿le mostramos
la app?»* y no *«¿esta listo para operar?»*, y que un merchant puede terminarlo sin un producto
cargado ni un integrante dado de alta— **y lo acepto**. Queda escrito aca para que ninguna spec
posterior lo redescubra y lo trate como un bug.

**Pero `completed` y `skipped` se PERSISTEN como valores distintos**, aunque los dos proyecten
`done: true` por HTTP. Es la propuesta del orquestador que el owner acepto, y cuesta cero: con un
booleano, «cuantos merchants saltearon todo» es una pregunta que ya no se puede hacer. El JSON del
checklist **no** expone cual de los dos fue: el contrato de la UI sigue siendo `done: boolean`.

### 3. El progreso del tour se guarda POR NEGOCIO

Decision del owner, textual: *«el tour se guarda por negocio»*.

Se le ofrecio la alternativa (por usuario) con su motivo: hoy no se distinguen porque el checklist
es owner-only y hay un owner por negocio, **pero la tabla se diseña una sola vez**. Eligio negocio.

**Lo que eso significa, escrito para que no sorprenda:** si mañana un negocio tuviera dos owners,
el tour que completa el primero aparece completo para el segundo. Es coherente con el resto del
onboarding —el checklist describe el estado **del negocio**, no el aprendizaje de una persona— y
es la lectura que hace que `verify-email` (que **si** es por usuario, via la sesion) sea la
excepcion y no la regla.

### 4. MUERE `GET /api/onboarding/guide/{item}`. La API sirve ESTADO, no contenido

El ADR 0077 §1 declaro dos recursos y §5 difirio el segundo *«hasta que exista el primero»*. El
primero existe, y **no tiene la forma que se supuso**: el contenido de un tour son **pasos**
que la UI define con su libreria de tours (§5), no JSON que baje del servidor.

**Entonces el segundo endpoint no se construye nunca.** Lo que queda del lado de la API es el
**estado**: una tabla y una escritura.

**El §1 del 0077 NO se revierte, se confirma:** su argumento era que el item sobrevive a un
rediseño y el tutorial *es* el rediseño, y por eso no se sirven juntos. Eso sigue siendo cierto —
tanto, que el lado volatil directamente **salio de la API**. Y el `anchor` del §3 («clave estable,
nunca un selector ni una coordenada») **vale mas que antes**: los selectores los necesita la
libreria y viven en la UI; nuestra API sigue mandando solo la clave.

**Accion obligatoria:** `specs/0083-contratos-de-api.md` §5 anuncia hoy ese endpoint a quien
construya la UI. Hay que corregirlo o produce exactamente el error que el 0077 §5 queria evitar,
con el signo invertido.

### 5. La libreria de tours es `driver.js`

> **ENMIENDA DEL 2026-09-20.** La primera version de este §5 decia `@tour-kit/react`, que era la
> eleccion inicial del owner. Despues de medir tres candidatas en movil el owner cambio, textual:
> *«perfecto hacemos el cambio a driver.js definitivamente mejor»*. El §5 original y la trampa de
> `tour-kit` quedan abajo, porque **el motivo de la eleccion es parte de la decision**.

**`driver.js@1.8.0`, MIT, sin costo.** Medido el 2026-09-20 en worktree descartable con build de
produccion de Next 16 y Playwright emulando un iPhone 13 (390×844, touch), contra la misma
pantalla que las otras dos —header arriba y el CTA `position: fixed` abajo, que es el caso que
rompe a los tours en pantallas chicas—.

**Las tres candidatas compilaban en Next 16, mantenian el tooltip dentro de la pantalla y no
tiraban un solo error de consola.** Lo que decidio fueron dos cosas:

1. **`driver.js` no declara NI UN `peer` ni una dependencia.** Por construccion **no puede
   acoplarse a una version de Next**, asi que la clase de problema que se encontro con `tour-kit`
   —abajo— no puede volver a pasar. Es la unica diferencia **estructural** entre las tres.
2. **Fue la que mejor recorto el spotlight sobre el CTA fijo:** el boton queda entero e iluminado.
   `tour-kit` lo dejo **oscurecido** con su config por default (declarado como caveat: puede ser
   una perilla que no se puso, no se investigo) y `react-joyride` lo resolvio bien pero con la
   estetica por default mas pobre de las tres.

**Lo que se resigna, y por que no importa:** `driver.js` es vanilla —sin bindings de React y sin
multi-ruta—. Ninguno de los dos hace falta: los cuatro tours son de **una pantalla cada uno**, y
**el estado lo guarda nuestra API** (spec 0084), no la libreria. Esa separacion es justamente lo
que hace que la eleccion de libreria sea reversible: **la 0084 no cambia una linea por esto.**

#### Lo que se descarto, y la trampa que lo descarto — se conserva a proposito

**`@tour-kit/react@3.0.0`** (`usertourkit.com`) fue la eleccion inicial. Al medirla aparecio que
**`useNextAppRouter()` ROMPE EL BUILD** con *«dynamic usage of require is not supported»*: resuelve
`next/navigation` con un `require` dinamico que **Turbopack** (bundler por defecto de Next 16) no
soporta. `createNextAppRouterAdapter(usePathname, useRouter)` si funciona.

**Eso NO es lo que la descarto** — se arregla con una linea y quedo probado end-to-end. Lo que la
descarto es lo que la trampa **revela**: la libreria se acopla a `next`, declara un peer
(`^13 || ^14 || ^15`) que **miente contra nuestro 16.3.0**, y esa es una deuda que vuelve en cada
major de Next.

**Lo caro de esa trampa, y es una leccion que sobrevive a la eleccion:** el `typecheck` **no
distingue** las dos variantes —tipan igual— y el Stop hook corre typecheck+lint+test, **no
`build`**. Un error asi **no aparece nunca en el escritorio**: aparece en CI o en Vercel. Queda en
la skill `gotchas-del-repo`.

Tambien se descartaron **`shepherd.js`** (AGPL-3.0, incompatible con un producto comercial cerrado
sin licencia comercial), **`onborda`** (ultima publicacion 2024-12-22) y **`@reactour/tour`**
(2025-05-07), por licencia y por abandono.

### 6. El orden de construccion lo dicta la pantalla, no este ADR

Textual del owner: *«creare cada tour cuando este completa la pantalla, las api en esa pantalla,
etc. No es problema ahora»*.

Es el ADR 0077 §2 pagando por segunda vez: **`position` lo dicta la API**, asi que el orden de
construccion quedo desacoplado del de presentacion y el tour de staff puede entrar ultimo sin que
la UI cambie de forma. **Un item de tour puede existir en el catalogo antes que su pantalla**: su
`done` arranca en `false` y nadie se traba, porque ningun tour es `blocking`.

## Consecuencias

- **El checklist deja de ser lectura pura.** Gana su primera escritura y su primera tabla. Es lo
  que el ADR 0070 §9 no previo, y no lo contradice: ese §9 dice que **el progreso** se deriva de
  hechos de la base en vez de un contador, y «vi un tour» **no es un hecho del negocio** que se
  pueda derivar de nada. No es un `onboarding_step` disfrazado: no hay un numero de paso, hay una
  fila por tour.
- **La decision de almacenamiento del catalogo que el 0077 §4 difirio hasta el segundo item se
  toma aca: SIGUE EN CODIGO.** Con cinco items el `done` sigue siendo una funcion distinta por
  item, asi que **agregar un item exige deploy igual**; una tabla solo compraria reordenar,
  alternar obligatoriedad y editar texto sin deploy, y nada de eso esta pedido.
- **Aparece el primer oraculo real de que `required` y `blocking` no son alias**, si los tours no
  son `true`/`true` como el email. Hoy eso solo lo prueban entradas sinteticas (mutacion M5 de la
  spec 0083).
- **Se implementa en DOS specs** (decision del owner: *«dos spec»*): la **0084** pone la tabla y
  la escritura; la **0085** lleva el checklist de uno a cinco items y corrige el contrato.

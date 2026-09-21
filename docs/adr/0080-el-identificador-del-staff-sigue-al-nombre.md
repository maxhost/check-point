---
adr: 0080
fecha: 2026-09-21
resumen: El `identifier` del integrante (`handle@slug`) SIGUE AL NOMBRE — renombrar re-deriva el handle y por lo tanto CAMBIA con que string entra esa persona, a cambio de que la etiqueta nunca quede desincronizada del nombre. No rompe un solo dato (nada interno referencia el handle: las FK, la auditoria y la sesion activa van por `userId`), y entregar un identificador nuevo no es una operacion nueva para el merchant: ya lo hace cada vez que regenera un PIN. Y la edicion del integrante va en DOS rutas SEPARADAS y nunca en una sola con campos opcionales: el nombre y los permisos tienen politicas de autorizacion DISTINTAS —al nombre se lo edita uno mismo, a los permisos no— y fusionarlas pone las dos en un mismo camino de codigo donde un refactor futuro convierte la de abajo en escalada de privilegios. La ruta del nombre RECHAZA con 400 un cuerpo que traiga `permissions`, en vez de ignorarlo: el descarte silencioso es la version peligrosa del mismo bug.
---

# ADR 0080 — El identificador del staff sigue al nombre, y editar va en dos rutas separadas

**Fecha:** 2026-09-21 · **Estado:** aceptado · **Decide:** el owner, en conversacion

## Contexto

La spec 0086 dejo al staff con permisos por objeto, pero **no hay forma de editar a un
integrante**: no existe `PATCH /api/staff/{userId}`. Lo unico editable hoy son los permisos
(`PATCH …/permissions`), el estado (`POST …/status`) y el PIN (`POST …/pin/regenerate`).

Dos hechos **medidos sobre el arbol** ordenan la decision:

1. **El `handle` es una columna GUARDADA, no una etiqueta calculada.** Se deriva **una sola
   vez** en el alta con `freeHandle(business.id, input.name)` (`staff-create.ts:121`), que es
   `slugify(nombre)` pasado por `nextSuggestion`. O sea que hoy, si el nombre cambiara, el
   identificador **no se actualizaria solo** y quedaria «Juan Marcos» con `marcos@slug`.
2. **El `handle` es el INPUT DEL LOGIN, no solo una etiqueta.**
   `api/merchant/auth/staff/route.ts` recibe `identifier`, lo parte por el ultimo `@` y resuelve
   la membresia con `eq(memberships.handle, handle)` (linea 194). Si el handle cambia, el string
   viejo **deja de resolver**.

Lo que **no** cambia al cambiar el handle, tambien medido: nada interno lo referencia. Las FK
(`order.created_by_user_id`), la auditoria y la **sesion activa** van por `userId`, asi que la
sesion abierta del integrante **sobrevive** — el handle nuevo solo se usa en el proximo login.

## Decision

### 1. El identificador SIGUE AL NOMBRE

Renombrar **re-deriva** el handle. El identificador nunca queda desincronizado del nombre.

**El costo, que se acepta explicitamente:** **cada** renombre cambia con que string entra esa
persona — incluso uno inocente, como «Carla» → «Carla Gómez», que lleva `carla` a `carla-gomez`.

**Por que se acepta:** entregarle un identificador nuevo **no es una operacion nueva** para el
merchant. Ya tiene que hacerlo cada vez que regenera un PIN, y es la misma conversacion.

**La condicion que lo vuelve sano, y es parte de la decision:** la respuesta **siempre devuelve
el `identifier` nuevo**, y el contrato dice fuerte que renombrar cambia el login. Sin eso, esta
decision es una trampa silenciosa: el merchant renombra creyendo que toco una etiqueta y deja a
alguien afuera.

**Lo que se descarto:** que el handle quede quieto. Evita el problema del login pero deja la
etiqueta divergiendo del nombre para siempre, y como **no hay `DELETE /api/staff`**, un nombre
mal escrito en el alta quedaria fosilizado en el identificador sin salida.

### 2. Editar va en DOS rutas separadas, y la del nombre RECHAZA los permisos

`PATCH /api/staff/{userId}` edita **solo el nombre**. `PATCH /api/staff/{userId}/permissions`
—que ya existe— sigue **intacta**. **No** se fusionan en una sola ruta con campos opcionales.

**El motivo es de autorizacion, no de estilo: las politicas de los dos campos son DISTINTAS.**

| Campo | Quien puede |
|---|---|
| `name` | cualquiera con acceso a staff, **incluido uno mismo** |
| `permissions` | acceso a staff, **NO uno mismo** (R3), no la membresia del owner (R4), y `staff` **solo el owner** (R1) |

En una ruta fusionada esas dos politicas conviven en un mismo camino de codigo, y cualquier
handler que autorice **una vez por request** en vez de **una vez por campo** es una escalada de
privilegios esperando un refactor. Separadas, el error **no se puede cometer**: es defensa por
construccion, no por disciplina.

**Y la ruta del nombre RECHAZA con `400 permissions_not_here` un cuerpo que traiga
`permissions`**, en vez de ignorarlo. El descarte silencioso es la version peligrosa del mismo
bug: la UI creeria haber guardado permisos que nadie guardo.

**Precedente propio, no teoria:** en la 0086 `requireStaffOwner` era compartida entre
`/api/staff/*` y `PATCH /api/merchant/business/slug`, y cambiarla en el lugar habria **delegado
el slug publico del negocio con el permiso `staff` sin que una linea de esa ruta cambiara**. Lo
cazo el implementador de casualidad. Es exactamente esta familia.

### 3. Uno mismo SI edita su propio nombre

R3 (**nadie edita sus propios permisos**) **no** se extiende al nombre: corregirse el nombre es
inofensivo y no mueve ninguna capacidad. La regla deja de ser uniforme a proposito, y por eso
vive en dos rutas distintas en vez de en un `if` adentro de una.

**Corolario que se sigue de la decision 1 y hay que decir en voz alta:** como el identificador
sigue al nombre, **un integrante que se renombra a si mismo se cambia su propio login**. No es
escalada —los handles son unicos dentro del negocio y las reservadas siguen bloqueadas—, pero la
UI tiene que avisarselo con el identificador nuevo en la mano.

## Consecuencias

- **No hay migracion.** La columna `handle` ya existe y ya es unica por negocio
  (`core_business_membership_handle_unique`).
- **Re-derivar tiene una trampa que la spec debe cerrar:** `freeHandle` lee **todos** los handles
  del negocio, **incluido el del propio target**. Reusado tal cual, renombrar «Carla» a «Carla»
  veria `carla` como ocupado y devolveria `carla-2`, bumpeando el sufijo en **cada** renombre. La
  re-derivacion tiene que **excluir el handle actual del target**.
- **Las reservadas y la colision siguen cubiertas gratis** si la re-derivacion pasa por
  `nextSuggestion` (`slug.ts:87`), que trata `RESERVED` como ocupadas (`slug.ts:91`). Escribir el
  handle a mano habria obligado a reconstruir las dos cosas: es la razon tecnica por la que la
  correccion **no** es un campo libre.
- **Queda abierto, y no entra:** cambiar el identificador **sin** cambiar el nombre. Hoy no se
  puede y no se pidio.
- **Sigue sin haber `DELETE /api/staff`.** Dar de baja es `POST …/status`.

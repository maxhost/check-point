---
adr: 0079
fecha: 2026-09-20
estado: aceptada
resumen: El staff deja de ser un rol con una sola capacidad y pasa a tener PERMISOS POR OBJETO — staff, locales, fidelizacion, marketing, catalogo, marca, mostrador— con un toggle por objeto y NUNCA una matriz CRUD (decision textual del owner). Un permiso autoriza leer, crear y editar; lo IRREVERSIBLE (cerrar el programa, archivar o terminar una campaña, borrar del catalogo) no se delega nunca, y DESACTIVAR no cuenta como destructivo porque es reversible y preserva auditoria (ADR 0044 §2). El permiso `staff` NO es un toggle mas: es el perfil ADMINISTRADOR y el owner lo otorga a mano, porque el alta devuelve el PIN en claro y por lo tanto crear a un tercero con permiso X equivale a tener X — el owner acepto esa escalada residual por escrito y a cambio de que un admin pueda dar de alta a quien necesite. Los permisos viven en `business_membership.permissions text[]` (el guard ya lee esa fila: cero consultas nuevas), viajan en `GET /api/merchant/session` y se evaluan en UN solo guard que conserva el orden del ADR 0073 — el eje PLAN sigue en el writer y el eje ESTADO sigue en la escalera, asi que un staff hereda los topes del plan y los 403 de `suspended`/`closed` por construccion. Y toda accion de CONFIGURACION —tambien las del owner— escribe una fila en `core.activity_log` en la MISMA transaccion que la muta, con los nombres en TEXTO PLANO para que renombrar o borrar algo no corrompa el pasado. El mostrador queda AFUERA de ese log: ya tiene el suyo.
---

# 0079 — Los permisos del staff son alcances por objeto, y toda accion de configuracion deja rastro

## Contexto

Hoy **el rol es el permiso**. `business_membership.role ∈ ('owner','staff')` (ADR 0044) y no
hay nada entre medio. Medido sobre el arbol el 2026-09-20: un integrante llega a **una sola
superficie**, `/api/counter/*` —cuyo guard `requireOperator` acepta cualquier membresia del
negocio— y las **once restantes** pasan por `requireApiOwner`, que le contesta `403 not_owner`
antes de mirar nada mas. No existe un estado intermedio ni una columna donde escribirlo.

Eso fue deliberado: el ADR 0044 colapso staff a «solo mostrador» para el MVP. Pero los ADR
**0008** («solo el owner crea, edita, asigna, desactiva y cambia permisos de su merchant
staff») y **0010** («un merchant staff ve el mismo backoffice con los limites de sus
permisos») ya asumian permisos por integrante. Este ADR escribe lo que esos dos dieron por
sentado y el 0044 difirio.

El owner lo pidio el 2026-09-20 con su lista de siete objetos y con el criterio explicito:
*«no quiero que el merchant tenga una granularidad a nivel de CRUD por cada objeto»* y
*«queremos un toggle por cada objeto, no uno por cada CRUD de objeto»*.

## Decisiones

### 1. El permiso es un ALCANCE POR OBJETO, y son siete

`staff` · `locations` · `loyalty` · `marketing` · `catalog` · `brand` · `counter`.

**Un permiso autoriza LEER, CREAR y EDITAR su objeto.** No hay `catalog.read` ni
`catalog.write`: la unidad es el objeto, y el motivo es de producto, no tecnico — el merchant
que arma su equipo piensa en «esta persona se encarga del catalogo», no en cuatro casillas por
entidad. La granularidad CRUD queda **descartada explicitamente**, no diferida.

El mapeo contra las rutas que existen hoy, verificado archivo por archivo:

| Permiso | Abre |
|---|---|
| `staff` | `/api/staff/*` |
| `locations` | `/api/locations/*` |
| `loyalty` | `GET/PUT /api/loyalty-program`, `stamp-upload`, `qr`, `loyalty-terms/templates` |
| `marketing` | `/api/marketing/*` |
| `catalog` | `/api/catalog/*` |
| `brand` | `GET/PUT /api/brand`, `brand/logo-upload` |
| `counter` | `/api/counter/*` |

**`counter` es un toggle como los otros**, decision del owner: *«puede que el merchant quiera
que un solo staff se encargue de eso»*. Consecuencia, y es un cambio de comportamiento sobre
lo que hay hoy: **un integrante sin ese permiso deja de poder acreditar**, cuando hasta ahora
alcanzaba con ser miembro.

### 2. Lo IRREVERSIBLE no se delega. Y «destructivo» es una lista, no una intuicion

El criterio lo fijo el owner y es el que gobierna: **desactivar no es destructivo**, porque es
reversible y porque preserva identidad y auditoria — que es exactamente el motivo por el que
el ADR 0044 §2 eligio desactivar en vez de borrar.

**Owner y nadie mas**, porque no tienen vuelta atras:

| Endpoint | Que hace |
|---|---|
| `DELETE /api/loyalty-program` | cierra el programa de fidelizacion |
| `PATCH /api/loyalty-program` (`cancel-close`) | cancela ese cierre |
| `POST /api/marketing/campaigns/:id/archive` y `/end` | archivan o terminan una campaña |
| `DELETE /api/catalog/product/:id` y `/category/:id` | **borrado DURO** — ver §9 |

**Delegable, porque se deshace:** `POST /api/staff/:id/status` (decision textual del owner:
*«deberia poder desactivar tambien porque esto no es destructivo»*),
`POST /api/locations/:id/status` y el par `pause`/`activate` de campañas. Los dos ultimos se
le preguntaron aparte —el criterio los alcanzaba pero el owner habia hablado del staff— y
contesto *«van»* (2026-09-20). **Son decision suya, no derivacion nuestra.**

### 3. El permiso `staff` es el perfil ADMINISTRADOR, y se dice con todas las letras

**El alta devuelve el PIN en claro** (`POST /api/staff` → `{staff, pin}`, y ademas existe
`pin/regenerate`). De ahi sale la propiedad que decide todo este apartado: **crear a un
tercero con el permiso X es, en los hechos, tener el permiso X** — quien lo crea se queda con
la credencial y entra como el.

Se le planteo al owner la disyuntiva con esa consecuencia escrita, y **eligio conservar el
perfil** (2026-09-20). Las cuatro reglas que lo acotan:

1. **Solo el OWNER otorga `staff`.** Un administrador no fabrica otro administrador.
2. **Un no-owner SI otorga permisos que el no tiene.** Es la regla que el owner rechazo, con
   su caso: *«si creo un admin para staff, y el necesita crear un usuario para marketing, no
   podria… eso si es ridiculo»*.
3. **Nadie edita sus propios permisos**, tampoco el owner sobre su propia membresia.
4. **La membresia del owner no se toca desde ninguna superficie de staff**: ni permisos, ni
   estado, ni PIN. Es un guard del servidor, no una omision de la UI.

**LA ESCALADA RESIDUAL, ACEPTADA EXPLICITAMENTE:** por (2), un administrador puede obtener
los **seis permisos no-`staff`** creando una cuenta interpuesta. Queda acotada a esos seis
—lo del §8 no se alcanza por ningun camino— y **queda registrada**: el alta y el otorgamiento
son acciones de configuracion y por lo tanto escriben en el log del §7, con quien las hizo.

**Diferido, y es lo que cerraria la brecha:** hacerle llegar el PIN al integrante por un canal
que el administrador no ve (SMS u otro), de modo que crear no sea equivalente a poseer.
Decision del owner: *«a futuro pensare como hacemos llegar ese pin al staff sin que el
administrador lo pueda ver»*. Fila en `PARQUEADO.md`.

### 4. Los permisos viven en la fila de la membresia, no en una tabla aparte

`business_membership.permissions text[] NOT NULL DEFAULT '{}'`, con un `CHECK` de contencion
contra el conjunto de los siete valores.

**El motivo es medido:** el guard ya lee esa fila. `ownerContext` (`server/staff.ts`) resuelve
la membresia con un `innerJoin(businesses)` que existe desde siempre, y agregar permisos es
**una columna mas en una consulta que ya se hace** — cero consultas nuevas en el camino
caliente. Es el mismo argumento con el que la spec 0072 sumo `status` y la 0081 sumo
`countryCode`. Una tabla `membership_permission` costaria un join por request para ganar un
historial que el log del §7 ya lleva mejor.

**El owner ignora la columna**: es owner, tiene todo. Nunca se le escriben permisos, asi no
existe el estado «owner sin permiso de marca».

**El alta exige al menos un permiso** (decision del owner: sin eso «no tiene sentido»): un
cuerpo con la lista vacia es `400`, no un integrante que entra y no ve nada.

### 5. UN guard, y el orden de la escalera no se mueve

Los seis `_auth.ts` de dominio (`catalog`, `locations`, `marketing`, `billing`, `staff`,
`brand`) son hoy envoltorios de `requireApiOwner`. Pasan a serlo de `requireApiPermission`:

```
1. ¿hay sesion?                   → 401 unauthorized
2. ¿membresia ACTIVA del negocio? → 403 not_member
3. ¿owner, o staff con el scope?  → 403 missing_permission   ← el paso nuevo
4. ¿email verificado?             → 403 email_not_verified   ← SOLO si es owner
5. ¿el negocio OPERA?             → 403 business_suspended | business_closed
```

**El paso 4 saltea al staff a proposito, y tiene precedente medido**: `api/counter/_auth.ts`
ya lo hace, porque el integrante tiene un email sintetico `@staff.invalid` que nunca se
entrega y **ninguna accion con la que verificar nada** — un gate que lo alcanzara dejaria su
superficie muerta para siempre.

**El eje PLAN no entra en esta escalera** (ADR 0073 §1): sigue viviendo en la transaccion que
escribe, via `can()` / `limitOf()`. **Y eso ya resuelve lo que el owner pidio**: verificado, el
`EntitlementContext` (`server/entitlements/index.ts:47`) es `{plan, pendingPlan, status,
stripeSubscriptionId}` y **no tiene nocion de usuario** — sale de la suscripcion del NEGOCIO.
Un staff con permiso de `locations` choca contra el mismo tope que el owner **por
construccion**, sin una linea nueva. El invariante que hay que defender es el inverso: el
guard nuevo **no puede volverse un segundo camino que saltee al writer**.

**El eje ESTADO alcanza al staff por el paso 5**, y en las dos puertas que ya existen tambien:
el login por PIN corta con `businessStatusFailure` (`api/merchant/auth/staff/route.ts`) y el
mostrador tambien. Suspendido el negocio, el staff no opera — igual que el owner; cerrado, no
entra nadie.

### 6. Los permisos viajan en `GET /api/merchant/session`

Esa ruta ya devuelve `membership: {role, status}` y es **siempre 200** por diseño (spec 0074).
Gana `permissions: string[]`. Es lo que le permite a quien construye la UI pintar la
navegacion sin adivinar ni sondear endpoints a ver cual contesta 403.

### 7. El log de auditoria es TEXTO PLANO, y se escribe en la misma transaccion

Tabla `core.activity_log`, **append-only**: sin `UPDATE` y sin `DELETE` por fila.

1. **Nada se lee por clave foranea.** Cada fila guarda **snapshots en texto** —nombre del
   actor, su rol, la etiqueta del objeto afectado— porque, como dicto el owner, *«si mañana
   cambiamos el nombre del staff, o de algo, el log no se corrompe»*. Es ademas lo que el
   **ADR 0007** ya habia decidido: «cada registro debe ser interpretable por si mismo».
   Los `id` quedan, pero **solo para filtrar**, nunca para poder leer la fila.
2. **La retencion es la vida del negocio** (decision del owner). Se implementa en el esquema,
   no en un cron: `business_id` con `ON DELETE CASCADE` —se va el negocio, se va su log— y
   `actor_user_id` con `ON DELETE SET NULL` —se va un usuario, **queda su rastro** con el
   nombre en texto—. La diferencia entre esas dos clausulas es literalmente la decision.
3. **Se escribe en la MISMA transaccion que la mutacion.** Fuera de ella existe el camino «la
   accion ocurrio, la fila no», y un log con agujeros silenciosos es peor que no tenerlo,
   porque se le cree.
4. **Se loguea a todos, tambien al owner** (decision del owner). Un log con un hueco justo
   donde esta quien mas poder tiene no sirve para investigar, y cuesta lo mismo.
5. **El MOSTRADOR queda afuera.** Decision del owner: *«el log de auditoria es para otra cosa,
   el log de mostrador es para otra cosa»*. Es ademas el camino de escritura mas caliente del
   sistema y **ya tiene su atribucion**: `order.created_by_user_id` y
   `reward_redemption.created_by_user_id` existen hoy. Este log cubre **configuracion**: los
   seis permisos administrativos.
6. **`GET /api/activity`**, con filtros por actor, fecha y objeto, y paginacion por cursor.
   **Lo lee el OWNER y nadie mas** (decision del owner: *«solo owner»*). El perfil
   administrador del §3 **no** lo lee, y el motivo es el que vuelve util al log: existe
   justamente para el caso en que el administrador es el problema. `staff` no abre esta ruta.

### 8. Lo que NO tiene toggle, y no lo va a tener

`/api/billing/*` (plan y dinero) · `POST /api/merchant/business/slug` (es la URL publica y el
login de todo el equipo a la vez) · `/api/onboarding/*` · el estado del negocio. No son
operacion: son la cuenta. Ninguna es delegable, tampoco al perfil administrador del §3.

### 9. El catalogo no tiene archivado, asi que «archivar si, borrar no» todavia no es opcion

Verificado: `schema/catalog.ts` no tiene `archived_at` ni `deleted_at` — el `DELETE` de
producto y categoria es **borrado duro**. El owner pidio archivado con borrado reservado al
merchant; eso exige migracion y filtros de lectura en el catalogo publico y en el backoffice,
o sea **una spec propia**. Hasta que exista: el staff con `catalog` **no borra**, y limpiar es
del owner.

## Los dos puntos que este ADR dejo abiertos, y como se cerraron

Este archivo se escribio con dos hallazgos marcados **a decidir**, no como decision del owner.
Se los pregunto ese mismo dia, antes de commitearlo, y los cerro: los dos endpoints
reversibles del §2 **van** con el permiso, y `GET /api/activity` es **solo del owner** (§7.6).
Quedan integrados arriba, en su seccion. **No hay ninguna decision revertida** — no habia
ninguna tomada.

## Alternativas descartadas

- **Matriz CRUD por objeto** — rechazada por el owner en sus palabras. Multiplica por cuatro
  la superficie de decision del merchant para un caso de uso que nadie pidio.
- **Tabla `membership_permission`** — un join por request en el camino caliente, para ganar un
  historial que el §7 lleva mejor y con snapshots.
- **«Un no-owner nunca otorga un permiso que el no tiene»** — acota la escalada del §3, y se
  descarto igual: rompe el caso real del administrador que necesita dar de alta a alguien de
  marketing. El costo esta escrito en el §3 y aceptado.
- **Escribir el log fuera de la transaccion** (cola, `after()`, trigger) — abre el camino de
  la accion sin su fila.
- **Loguear tambien el mostrador** — duplica el log mas caliente del sistema sin agregar un
  dato que no este ya en `order` y `reward_redemption`.

## Consecuencias

- Los **seis `_auth.ts`** migran de `requireApiOwner` a `requireApiPermission`. Es la segunda
  vuelta de la consolidacion que hizo la spec 0072; el orden del ADR 0073 se conserva entero.
- **Migracion aditiva**: una columna con su `CHECK`, mas la tabla del log.
- **Hueco conocido en el guard de PAGINAS**: `auth-guards.ts` rebota solo con `closed`;
  `suspended` pasa a proposito para que el owner lea el motivo. Hoy no filtra nada porque las
  paginas son owner-only, pero **cuando el staff tenga pantallas, una cuenta suspendida se las
  va a renderizar**. La API igual contesta 403, asi que no hay dato en riesgo. Entra al DoD.
- **El tour `staff` del onboarding se vuelve construible**: hoy no tiene pantalla
  (`backoffice-navigation.tsx:37`, `href: null`) y por eso el checklist lo muestra
  «Proximamente» (ADR 0078 §6).
- Se implementa en **tres specs**: **A** los permisos y el guard, **B** el log de auditoria,
  **C** el archivado del catalogo. La UI la construye el owner por fuera (ADR 0070 §16-17):
  lo que estas specs entregan es API **y su contrato HTTP escrito**.

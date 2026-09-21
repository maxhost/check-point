---
spec: 0087
fecha: 2026-09-21
estado: anexo
resumen: Contrato normativo de la edicion del integrante para quien construya la UI por fuera. Nace `PATCH /api/staff/{userId}` y edita SOLO el nombre. **Renombrar CAMBIA el identificador, o sea con que string entra esa persona**: el `identifier` re-derivado viaja en cada respuesta y la UI tiene que mostrarselo al merchant, porque nadie le notifica nada al integrante. La ruta RECHAZA con `400 permissions_not_here` un cuerpo que traiga `permissions` —se chequea la PRESENCIA de la clave, no su valor— y `PATCH /api/staff/{userId}/permissions` queda intacta: son dos rutas separadas a proposito, porque sus politicas de autorizacion son distintas. Al nombre se lo edita uno mismo; a los permisos, no. La membresia del owner no se toca por ninguna de las dos.
---

# 0087 — Contrato de API: editar al integrante

> **Este documento es un entregable, no documentacion opcional** (ADR 0070 §16). La UI la
> construye el owner por fuera y este archivo es su insumo. La spec 0087 **no toca un solo
> `.tsx`**.
>
> La decision de producto que gobierna esto es el **ADR 0080**. Complementa al contrato
> `0086-contratos-de-api.md`, que no se reemplaza.

## Convenciones

Las mismas de `0072-`, `0074-`, `0083-`, `0084-` y `0086-contratos-de-api.md`: base
`https://www.checkpass.club`, `content-type: application/json`, cookie de sesion de better-auth,
**ningun identificador de negocio viaja en el cuerpo** (ADR 0070 §15.3), y todo fallo responde
`{ "error": "<español>", "code": "<estable>" }` donde **el `code` es el contrato** y el `error`
es copia que se puede reescribir.

---

## 1. Lo que hay que entender ANTES de dibujar la pantalla

**Renombrar a un integrante le cambia con que string entra.**

El `identifier` que ves (`carla@la-farmacia`) se compone del **handle** —derivado del nombre— y
el **slug** del negocio. Al renombrar, el handle se **re-deriva**: «Carla» → «Carla Gómez**»**
convierte `carla@la-farmacia` en `carla-gomez@la-farmacia`, y **`carla@la-farmacia` deja de
funcionar**.

**Lo que NO pasa**, para que nadie lo tema de mas:

- **No se rompe ningun dato.** Nada interno referencia el handle: los pedidos, los canjes y la
  auditoria van por el id interno del usuario, que **no cambia nunca**.
- **No se lo desconecta.** Si el integrante tiene la sesion abierta, **sigue adentro**. El handle
  nuevo se usa recien en el **proximo** login.

**Lo que la UI TIENE que hacer, y no es cosmetica:**

1. **Avisar antes de guardar** que cambiar el nombre cambia el identificador.
2. **Mostrar el `identifier` nuevo despues de guardar**, para que el merchant se lo pase. La API
   lo devuelve en cada respuesta.
3. **Entender que al integrante NO se le notifica nada.** No hay mail, no hay push: su email es
   sintetico y no entregable. Si nadie le dice el nuevo, **se queda afuera en el proximo login**.

Es la misma conversacion que el merchant ya tiene cuando regenera un PIN.

---

## 2. `PATCH /api/staff/{userId}` — el renombre

```jsonc
// cuerpo
{ "name": "Carla Gómez" }
```

`name` es **el unico campo aceptado**. `trim()`, entre **1 y 80** caracteres.

### Respuesta `200`

```jsonc
{
  "staff": {
    "userId": "…",
    "name": "Carla Gómez",
    "identifier": "carla-gomez@la-farmacia",
    "role": "staff",
    "status": "active",
    "permissions": ["catalog", "counter"],
    "createdAt": "2026-09-20T…Z"
  }
}
```

El `StaffDTO` completo, **la misma forma** que devuelven el alta y `…/permissions`, y **sin
`pin`** — el PIN viaja una sola vez, en el alta, y despues solo por
`POST /api/staff/{userId}/pin/regenerate`.

**El `identifier` viaja SIEMPRE, aunque no haya cambiado.** No lo recalcules en el cliente: el
sufijo de colision y las palabras reservadas los decide el servidor.

### Los rechazos

| `code` | Status | Cuando |
|---|---|---|
| `invalid_body` | 400 | el cuerpo no es un objeto JSON |
| `name_required` | 400 | `name` ausente, vacio o solo espacios |
| `name_too_long` | 400 | `name` de mas de 80 caracteres |
| **`permissions_not_here`** | **400** | **el cuerpo trae la clave `permissions`** — ver §3 |
| `target_is_owner` | 409 | el `userId` es la membresia del **owner**. Ninguna superficie de staff la toca |
| `handle_taken` | 409 | carrera perdida contra otro renombre simultaneo. **Reintentar es seguro** |
| `staff_not_found` | 404 | no existe, **o es de otro negocio** — la misma respuesta para los dos, a proposito: no se confirma que un id exista |

**`self` NO esta en esta tabla, y es a proposito: un integrante SI puede renombrarse a si
mismo.** La regla «nadie se edita a si mismo» (`self_permission_edit`) existe **solo para los
permisos**. Corolario para la UI: **quien se renombra a si mismo se cambia su propio login**, asi
que ahi el aviso del §1 importa todavia mas.

---

## 3. Por que `permissions` se RECHAZA aca y no se ignora

**Mandar `permissions` a esta ruta es `400 permissions_not_here`, siempre.** Incluso si mandas
**los permisos que el integrante ya tiene**, incluso `[]`, incluso `null`. **Se mira si la clave
esta, no que valor trae.**

**No es burocracia: es la defensa.** El nombre y los permisos tienen politicas de autorizacion
**distintas**:

| Campo | Quien puede | Ruta |
|---|---|---|
| `name` | cualquiera con acceso a staff, **incluido uno mismo** | `PATCH /api/staff/{userId}` |
| `permissions` | acceso a staff, **NO uno mismo**, no la membresia del owner, y `staff` **solo el owner** | `PATCH /api/staff/{userId}/permissions` |

Si las dos viajaran en un mismo cuerpo, esas dos politicas convivirian en un mismo camino de
codigo — y un handler que autorice una vez por *request* en vez de una vez por *campo* es una
escalada de privilegios esperando un refactor. Separadas, **el error no se puede cometer**.

**Se rechaza en vez de ignorarse** porque el descarte silencioso es la version peligrosa del
mismo bug: la UI creeria haber guardado permisos que nadie guardo.

### Que hace la UI con esto

**Dos requests, un solo boton.** Si el merchant cambio el nombre **y** los permisos, la pantalla
manda `PATCH /api/staff/{userId}` y `PATCH /api/staff/{userId}/permissions` por separado.

**No son una transaccion**, asi que puede pasar que una funcione y la otra no —por ejemplo, el
nombre se guarda y los permisos dan `403 permission_not_grantable` porque un admin intento
otorgar `staff`—. La UI tiene que **mostrar los dos resultados por separado** y no un
«guardado» unico que mienta.

---

## 4. Lo que esta ruta NO hace

- **No cambia el identificador sin cambiar el nombre.** No hay forma de pedir un handle
  especifico: la derivacion la hace el servidor, y por eso las palabras reservadas (`admin`,
  etc.) no se pueden tomar.
- **No da de baja.** Eso es `POST /api/staff/{userId}/status`, que es **reversible**.
- **No borra.** **No existe `DELETE /api/staff/{userId}`**: un integrante con historial no se
  puede borrar sin romper la auditoria, que es una propiedad buscada (ADR 0007).
- **No toca el PIN.** Eso es `POST /api/staff/{userId}/pin/regenerate`, y es la otra ocasion en
  la que el merchant tiene que pasarle una credencial nueva a la persona.

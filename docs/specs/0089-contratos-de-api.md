---
spec: 0089
fecha: 2026-09-21
estado: cerrada
resumen: Contrato normativo de LOCALES para quien construya la pantalla por fuera. Cuatro rutas —listar, crear, editar, archivar/reactivar— abiertas al owner SIEMPRE y al integrante con el permiso `locations`. La entidad que cruza al navegador tiene CUATRO claves y ninguna es interna. El tope de locales activos lo decide el servidor bajo el lock del negocio, nunca el boton; archivar el ultimo local activo es 409; reactivar consume cupo. El checklist del onboarding pasa a SEIS items y el sexto es el tour de locales.
disjunta: no
archivos: apps/merchant/src/app/api/locations, apps/merchant/src/server/locations
---

# 0089 — Contrato de API: Locales

**Para quien construye la pantalla.** Nada de acá se deduce del código: si una respuesta no está
descrita, no la inventes — preguntá. Las cuatro rutas **ya existen y están en producción**; esta
spec no las crea, las **documenta** y abre la pantalla al permiso.

## 0. Quién puede

Las cuatro rutas pasan por el mismo guard (`api/locations/_auth.ts`):

- **El owner, siempre.** No se le mira la columna de permisos: es owner, puede todo.
- **El integrante con el permiso `locations`.** Los permisos llegan en
  `GET /api/merchant/session` → `permissions: string[]` (para un owner vienen los **siete**).
- Cualquier otro: **403**.

La escalera de rechazos, en orden, con su `code` estable:

| | Situación | HTTP | `code` |
|---|---|---|---|
| 1 | sin sesión | 401 | `unauthorized` |
| 2 | sesión sin membresía activa del negocio | 403 | `not_member` |
| 3 | membresía sin el permiso `locations` | 403 | `missing_permission` |
| 4 | **owner** con email sin verificar (al integrante **no** se le aplica) | 403 | `email_not_verified` |
| 5 | negocio suspendido / cerrado | 403 | `business_suspended` / `business_closed` |

**La pantalla se gatea igual:** `/backoffice/locations` deja entrar al owner y al integrante con
`locations`; a cualquier otro lo rebota a `/backoffice`.

## 1. La entidad, y es lo ÚNICO que cruza al navegador

```json
{ "id": "uuid", "name": "Sucursal Centro", "addressLabel": "Av. Amazonas 123, Quito", "status": "active" }
```

**Cuatro claves, y la lista es cerrada.** No viajan —ni van a viajar— las coordenadas, el
proveedor de geocodificación, el `place_id`, los snapshots crudos ni el id de verificación: la
procedencia de una dirección es **auditoría interna** (decisión 5 de la spec 0061) y hay un test
que se pone rojo si alguien agrega una clave. `status` es `"active" | "archived"` y nada más.

## 2. `GET /api/locations` — listar

**200** → `{ "locations": Local[] }`. Orden: **activos primero**, y dentro de cada grupo los más
viejos primero. Devuelve también los archivados: la pantalla decide si los agrupa o los esconde.

## 3. `POST /api/locations` — crear

Cuerpo:

```json
{ "name": "Sucursal Centro", "address": { … } }
```

`address` admite **dos formas, y la diferencia importa**:

- **Sugerencia elegida de Geoapify** — `{ "provider": "geoapify", "featureId": "…", "label": "…", "longitude": -78.48, "latitude": -0.18 }`. El servidor **la re-verifica con su propia key**: las coordenadas del navegador son una afirmación, no un hecho.
- **Texto tipeado** — `{ "label": "Av. Amazonas 123" }`. Se guarda **sin coordenadas**. El servidor **no geocodifica** el texto: un punto inventado sería indistinguible de uno verificado.

Cualquier cuerpo que no sea una selección completa (proveedor **y** las dos coordenadas) se trata
como texto tipeado. No hay forma de fabricar una georreferencia desde el cliente.

**201** → `{ "location": Local }` (nace `active`).

| HTTP | `code` | Cuándo |
|---|---|---|
| 422 | `invalid_input` | cuerpo no-objeto, `name` vacío o >120, `address` ausente o `label` vacío o >240 |
| 422 | `unsupported_country` | el país del negocio no está soportado |
| 409 | `location_limit` | el plan no permite otro local **activo** |
| 503 | `address_unverified` | Geoapify no confirmó la sugerencia |
| 503 | — | fallo de base |

**El tope es del servidor, no del botón.** Se evalúa **bajo el lock del negocio**, así que dos
altas simultáneas no lo esquivan. Esconder el botón es cortesía; el `409` es la regla. El mensaje
del `409` **cambia si hay una baja de plan programada** («tu suscripción baja a Free…»), porque
mandar a mejorar el plan cuando lo que hay que hacer es cancelar la baja es mandar a la acción
contraria. **Mostrá el `error` que viene en la respuesta**, no uno propio.

## 4. `PATCH /api/locations/{locationId}` — editar

Cuerpo: `{ "name"?: string, "address"?: { … } }` — **al menos uno**. Las dos cosas viajan en una
sola transacción: un pedido que cambia ambas nunca queda a medias.

**200** → `{ "location": Local }`.

| HTTP | `code` | Cuándo |
|---|---|---|
| 422 | `invalid_input` | ni `name` ni `address`; o alguno inválido (mismos límites que el alta); o `locationId` no es un uuid |
| 404 | `unknown_location` | no existe **o es de otro negocio** — nunca se confirma que un id ajeno exista |
| 503 | `address_unverified` | ídem alta |

Mudar la dirección **no borra la anterior**: la verificación vieja queda marcada como superada y
nace una nueva. Un cambio de **solo nombre** no toca nada de la dirección.

## 5. `POST /api/locations/{locationId}/status` — archivar y reactivar

Cuerpo: `{ "status": "archived" }` o `{ "status": "active" }`. **No hay `DELETE`: archivar ES la
baja**, y es reversible.

**200** → `{ "location": Local }`. Mandar el estado que ya tiene es un **no-op con 200**, no un error.

| HTTP | `code` | Cuándo |
|---|---|---|
| 422 | `invalid_input` | `status` distinto de los dos, o `locationId` inválido |
| 404 | `unknown_location` | no existe o es de otro negocio |
| 409 | `last_active_location` | es el **último local activo** |
| 409 | `location_limit` | **al REACTIVAR**, si el plan ya está lleno |

**Las dos reglas que sorprenden si no se leen:** un negocio no puede quedarse sin ningún local
activo (sin local no hay mostrador ni atribución de ventas), y **reactivar consume cupo** — si no,
«archivar → crear → reactivar» dejaría a un plan Free con dos locales activos.

## 6. El sexto item del checklist

`GET /api/onboarding/checklist` pasa a devolver **seis** items; el nuevo es `locations`, en
`position: 2`, con `required: false` como los otros tours. Su `done` sale de
`POST /api/onboarding/tours/locations` con `{"status": "completed" | "skipped"}` — **los dos
cuentan como hecho**, y `completed` nunca se degrada a `skipped`.

**Mientras la pantalla no tenga tour, ese item nunca se marca hecho, y no traba nada:** ningún tour
es obligatorio. El único obligatorio del checklist sigue siendo `verify-email`.

## 7. Lo que esta spec NO decide

- **El diseño de la pantalla.** Se construye por fuera (ADR 0070): acá va el contrato, no la UI.
- **El tour de `driver.js` de Locales.** Va después, con la pantalla, siguiendo la forma de la 0088.
- **Mostrar la clase de dirección** (verificada vs. tipeada). Sigue siendo auditoría interna
  (decisión 5 de la 0061) y cambiarlo es decisión de producto, no de esta spec.

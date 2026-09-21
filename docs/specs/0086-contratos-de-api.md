---
spec: 0086
fecha: 2026-09-20
estado: anexo
resumen: Contrato normativo de los permisos del staff para quien construya la UI por fuera. Siete permisos por OBJETO y nunca por CRUD; `POST /api/staff` pasa a exigir `permissions` con al menos uno; nace `PATCH /api/staff/{userId}/permissions`, que es un REEMPLAZO TOTAL del conjunto y no un delta; y `GET /api/merchant/session` devuelve `permissions` — que para un owner son los SIETE aunque su fila los tenga vacios. No hay backfill: la migracion BORRA las membresias de staff existentes y el owner las recrea. Dos `code` nuevos, `not_member` y `missing_permission`, **reemplazan a `not_owner` en las diez superficies delegables**: es un cambio de contrato y esta declarado. Lo irreversible (cerrar el programa, archivar o terminar una campaña, borrar del catalogo) responde `403` a cualquier staff, siempre, sin toggle que lo habilite; y las cuatro superficies de la CUENTA —billing, el slug del negocio, el onboarding y el estado— conservan `not_owner` porque ahi sigue siendo cierto. El permiso `staff` es el perfil ADMINISTRADOR y solo el owner lo otorga.
---

# 0086 — Contrato de API: los permisos del staff

> **Este documento es un entregable, no documentacion opcional** (ADR 0070 §16). Lo que estas
> specs entregan es API **y su contrato escrito**; la UI la construye el owner por fuera y
> este archivo es su insumo. La spec 0086 **no toca un solo `.tsx`**.
>
> La decision de producto que gobierna todo esto es el **ADR 0079**. Cuando algo de aca sea un
> limite de hoy y no una decision, se dice.

## Convenciones

Las mismas de `0072-`, `0074-`, `0083-` y `0084-contratos-de-api.md`: base
`https://www.checkpass.club`, `content-type: application/json`, cookie de sesion de
better-auth, **ningun identificador de negocio viaja en el cuerpo** (ADR 0070 §15.3), y todo
fallo responde `{ "error": "<español>", "code": "<estable>" }` donde **el `code` es el
contrato** y el `error` es copia que se puede reescribir.

---

## 1. Los siete permisos

| Valor | Etiqueta | Que abre |
|---|---|---|
| `staff` | Administrar Staff | `/api/staff/*` |
| `locations` | Administrar Locales | `/api/locations/*` |
| `loyalty` | Administrar Programa de Fidelizacion | `GET/PUT /api/loyalty-program`, `…/qr`, `…/stamp-upload`, `/api/loyalty-terms/templates` |
| `marketing` | Administrar campañas de marketing | `/api/marketing/*` |
| `catalog` | Administrar catalogo | `/api/catalog/*` |
| `brand` | Administrar Marca | `GET/PUT /api/brand`, `/api/brand/logo-upload` |
| `counter` | Mostrador | `/api/counter/*` |

**El catalogo es CERRADO.** Cualquier otro valor es `400 unknown_permission`.

**Un permiso autoriza LEER, CREAR y EDITAR su objeto. No hay variantes por verbo**: no existe
`catalog.read` ni `catalog.write`, y no se van a agregar — es la decision central del ADR 0079
§1, no una simplificacion de esta vuelta.

**⚠️ `counter` es un cambio de comportamiento.** Hasta esta spec, **cualquier** integrante
operaba el mostrador por el solo hecho de ser miembro. Ahora hace falta el permiso, y **un
integrante sin ese toggle no acredita**.

**No hay backfill: la migracion BORRA las membresias de staff que existan** (decision del
owner — el proyecto esta en prueba y las recrea a mano). Quien integre contra esta API despues
de la migracion parte de **cero integrantes**, no de integrantes con permisos por defecto.

---

## 2. Lo que NINGUN permiso abre

### 2.1 Lo irreversible — `403` para todo staff, siempre

| Endpoint | Que hace |
|---|---|
| `DELETE /api/loyalty-program` | cierra el programa de fidelizacion |
| `PATCH /api/loyalty-program` (`{"action":"cancel-close"}`) | cancela ese cierre |
| `POST /api/marketing/campaigns/{id}/archive` | archiva una campaña |
| `POST /api/marketing/campaigns/{id}/end` | termina una campaña |
| `DELETE /api/catalog/product/{id}` · `DELETE /api/catalog/category/{id}` | **borrado duro** |

**No hay toggle que los habilite**: un staff con `loyalty` **edita** el programa y **no puede
cerrarlo**; uno con `catalog` **carga y corrige** productos y **no puede borrarlos**. La UI
tiene que ocultar o deshabilitar esas acciones para un caller no-owner — el servidor las
rechaza igual, pero un boton que siempre falla es un bug de interfaz.

**Lo REVERSIBLE si va con su permiso** (decision del owner, 2026-09-20):
`POST /api/staff/{userId}/status`, `POST /api/locations/{locationId}/status`,
`POST /api/marketing/campaigns/{id}/pause` y `…/activate`.

### 2.2 Las cuatro superficies de la CUENTA — `403 not_owner`

`/api/billing/*` · `POST /api/merchant/business/slug` · `/api/onboarding/*` · el estado del
negocio. **No son operacion: son la cuenta**, y no son delegables ni al perfil administrador.
Conservan el `code` **`not_owner`**, que ahi sigue siendo literal.

---

## 3. El perfil ADMINISTRADOR (`staff`)

**El permiso `staff` no es un toggle mas.** Quien lo tiene da de alta integrantes y les elige
los permisos — **incluso permisos que el mismo no tiene** (decision explicita del owner: un
admin de staff tiene que poder crear a alguien de marketing).

**Solo el OWNER puede otorgarlo o quitarlo, y son DOS disparadores del mismo `403
permission_not_grantable`** (enmienda del 2026-09-21; hasta entonces el servidor cumplia solo
el primero y la UI era la unica barrera del segundo):

| | Cuando | Que mira |
|---|---|---|
| **R1a** | un caller no-owner manda `"staff"` en la lista | la lista **nueva** del cuerpo |
| **R1b** | un caller no-owner apunta a un target que **HOY** tiene `staff` | la fila **actual** del target |

R1b **se evalua DESPUES** de resolver al target, asi que un `userId` inexistente o de otro
negocio sigue contestando `404 staff_not_found` y el 403 nunca confirma que un id exista.

Un administrador **no fabrica otro administrador** y **tampoco desarma al que el owner creo**.

> **⚠️ Lo que la UI tiene que decirle al merchant, y no es cosmetica.** El alta devuelve el PIN
> **en claro**, asi que **crear a un tercero con el permiso X equivale a tener X**: quien lo
> crea se queda con la credencial. Un administrador puede, por cuenta interpuesta, quedarse
> con los seis permisos no-`staff`. Esta **aceptado a conciencia** (ADR 0079 §3) y acotado
> —nada del §2 se alcanza asi—, y lo cierra a futuro hacerle llegar el PIN al integrante por
> un canal que el administrador no vea (`PARQUEADO` fila 60). Mientras tanto, este toggle se
> presenta como lo que es: **acceso total a la configuracion**, no una casilla mas de la
> lista.

---

## 4. `POST /api/staff` — el alta

```jsonc
// cuerpo
{ "name": "Carla", "permissions": ["counter", "catalog"] }
```

`permissions` es **obligatorio y con al menos un elemento**: dar de alta a alguien que no
puede hacer nada no tiene sentido, y para eso existe desactivarlo.

### Respuesta `201`

```jsonc
{
  "staff": {
    "userId": "…",
    "name": "Carla",
    "identifier": "carla@la-farmacia",
    "role": "staff",
    "status": "active",
    "permissions": ["catalog", "counter"],
    "createdAt": "2026-09-20T…Z"
  },
  "pin": "482913"
}
```

**`permissions` vuelve NORMALIZADO** —deduplicado y ordenado—, no como se mando. **`pin` viaja
UNA sola vez, aca**; ninguna otra respuesta lo devuelve, y la unica forma de obtener otro es
`POST /api/staff/{userId}/pin/regenerate`.

**No se serializa el email del integrante** (es un sintetico `@staff.invalid`, spec 0068 §2) ni
`pin_hash`. Lo que el owner reparte es `identifier`.

---

## 5. `PATCH /api/staff/{userId}/permissions`

```jsonc
// cuerpo
{ "permissions": ["counter"] }
```

**Es un REEMPLAZO TOTAL del conjunto, no un delta.** Se manda el conjunto de toggles que quedo
prendido; lo que no viaja, se quita. No existe `add`/`remove`.

### Respuesta `200`

```jsonc
{ "staff": { "userId": "…", "permissions": ["counter"], "…": "…" } }
```

El `StaffDTO` completo, igual que el del alta y sin el `pin`.

### Los rechazos propios de esta ruta

| `code` | Status | Cuando |
|---|---|---|
| `permissions_required` | 400 | lista vacia. **Quitarle todo a alguien es desactivarlo**, y eso es `POST /api/staff/{userId}/status` |
| `unknown_permission` | 400 | un valor fuera de los siete del §1 |
| `permission_not_grantable` | 403 | un caller no-owner mandando `"staff"` |
| `self_permission_edit` | 403 | el caller es el `userId` del path. **Nadie se edita sus propios permisos, tampoco el owner** |
| `target_is_owner` | 409 | el `userId` es la membresia del owner. **Ninguna superficie de staff la toca** |
| `staff_not_found` | 404 | no existe, o es de otro negocio — **la misma respuesta para los dos**, a proposito: no se confirma que un id exista |

---

## 6. `GET /api/merchant/session` — la lectura que necesita la UI

`membership` gana `permissions`:

```jsonc
{
  "authenticated": true,
  "user": { "…": "…" },
  "business": { "…": "…" },
  "membership": { "role": "staff", "status": "active", "permissions": ["catalog", "counter"] }
}
```

**Para `role: "owner"` devuelve los SIETE permisos**, aunque su fila en la base los tenga
vacios: el owner puede todo por definicion y la UI pinta lo que el caller puede hacer. La API
no expone la columna, expone la capacidad — no son lo mismo y aca la diferencia importa.

**Esta ruta es SIEMPRE `200`** (spec 0074) y eso no cambia. La regla de membresia no-`active` →
`business: null, membership: null` tampoco.

**Es la unica forma correcta de decidir que renderizar.** No sondear endpoints a ver cual
contesta `403`: eso convierte cada repintado de la navegacion en una rafaga de requests y hace
depender la UI de codigos de error en vez de una capacidad declarada.

---

## 7. Los `code` de autorizacion, y el cambio de contrato

La escalera de las diez superficies delegables, en orden:

| Paso | `code` | Status | Cuando |
|---|---|---|---|
| 1 | `unauthorized` | 401 | sin sesion |
| 2 | `not_member` | 403 | **nuevo** — con sesion, sin membresia activa en ningun negocio |
| 3 | `missing_permission` | 403 | **nuevo** — es staff y le falta el permiso de esa superficie |
| 4 | `email_not_verified` | 403 | **solo si es owner** — ver abajo |
| 5 | `business_suspended` · `business_closed` | 403 | el negocio no opera |

> ### ⚠️ CAMBIO DE CONTRATO: `not_owner` desaparece de las diez superficies delegables
>
> Hoy los tres casos —sin membresia, integrante, owner de otro negocio— colapsan en
> `403 not_owner`. Pasan a ser `not_member` y `missing_permission`. **Un cliente que ramifique
> sobre `not_owner` en `catalog`, `locations`, `marketing`, `brand`, `loyalty`, `staff` o
> `counter` deja de entrar por esa rama.**
>
> `not_owner` **sobrevive intacto** en las cuatro superficies del §2.2, donde sigue siendo
> literalmente lo que pasa.

**El paso 4 no alcanza al staff, y es a proposito.** El integrante tiene un email sintetico que
nunca se entrega y **ninguna accion con la que verificar nada**: un gate que lo alcanzara
dejaria su superficie muerta para siempre. Solo el owner puede recibir `email_not_verified`.

**El orden es contrato, no detalle de implementacion.** Un no-miembro recibe `not_member` y
**nunca** `business_suspended`: el estado de un negocio ajeno no se le reporta a un tercero.

---

## 8. Lo que el plan y el estado del negocio le hacen al staff

**Identico a lo que le hacen al owner.** No es una promesa: es como esta construido.

- **Plan.** Los topes se evaluan en la transaccion que escribe, con un contexto que sale de la
  **suscripcion del negocio** y que **no tiene nocion de usuario**. Un staff con `locations`
  choca contra el mismo tope de locales que el owner y recibe el mismo error de plan.
- **`suspended`.** Nadie opera: ni el owner ni el staff. El owner conserva una pantalla donde
  lee el motivo; **el integrante no lo lee** — `suspensionReason` se serializa solo para el
  owner.
- **`closed`.** No entra nadie. El login por PIN ya lo corta antes de abrir sesion.

**Un limite honesto:** una sesion ya abierta vive lo que dure la cookie (7 dias por el default
de better-auth). Lo que impide operar no es que la sesion muera, sino que **cada request pasa
por el paso 5**. Cerrar la puerta no expulsa a quien ya entro; que no pueda hacer nada, si.

---

## 9. Lo que esta API todavia NO hace

- **No hay log de auditoria.** Es la **spec B** del ADR 0079: `core.activity_log` y
  `GET /api/activity`, que lee **solo el owner**. Hasta que exista, quien tenga un permiso
  actua **sin rastro** mas alla de lo que ya guardan `order` y `reward_redemption` para el
  mostrador. Es el motivo por el que la spec B va inmediatamente despues de esta.
- **No hay archivado en el catalogo.** Es la **spec C**. Hoy el `DELETE` es **duro** y por eso
  es owner-only: no existe un «archivar» que darle al staff en su lugar.
- **No existe `PATCH /api/staff/{userId}`** (editar nombre o handle). Solo estado, PIN y
  permisos.

---
spec: 0084
fecha: 2026-09-20
estado: anexo
resumen: Contrato normativo de `POST /api/onboarding/tours/{tourId}` para quien construya la UI del onboarding por fuera. La PRIMERA escritura del onboarding: registra que un tour se completo o se salteo. El `tourId` sale de un catalogo CERRADO de cuatro (`staff`, `catalog`, `program`, `brand`) y uno desconocido es `404 unknown_tour`; el `status` son dos valores EXACTOS (`completed` | `skipped`) y cualquier otra cosa es `400 invalid_body`. Es IDEMPOTENTE —reintentar no duplica— y **`completed` nunca se degrada a `skipped`**: por HTTP el efecto es nulo (los dos proyectan `done: true`) pero el dato se conserva. **A diferencia del checklist, esta ruta SI lleva el gate de email y devuelve `403 email_not_verified`** — es el bloqueo de `verify-email` aplicado, no solo reportado, y cierra la decision que el contrato 0083 §1 habia dejado abierta. El progreso es POR NEGOCIO: ningun identificador de negocio viaja en el cuerpo y el del cuerpo se IGNORA.
---

# 0084 — Contrato de API: el progreso de los tours del onboarding

> **Este documento es un entregable, no documentacion opcional** (ADR 0070 §16). El arco del
> alta entrega API y endpoints, **no interfaz**: la UI la construye el owner por fuera y este
> archivo es su insumo. La spec 0084 **no toca un solo `.tsx`** y **no instala `driver.js`** —
> la libreria de tours es una dependencia de la UI, y esta API es agnostica de ella: guarda
> **estado**, no pasos.
>
> Todo lo que dice esta **medido contra el codigo y contra la base el 2026-09-20**, no
> inferido. Donde un comportamiento sea un limite de hoy y no una decision, se dice.

## Convenciones

Las mismas de `0072-`, `0074-`, `0078-`, `0079-`, `0081-` y `0083-contratos-de-api.md`: base
`https://www.checkpass.club` (el apex hace **308**), `content-type: application/json`, cookie
de sesion de better-auth, **ningun identificador de negocio viaja en el cuerpo** (ADR 0070
§15.3) y todo fallo responde `{ "error": "<español>", "code": "<estable>" }` donde **el `code`
es el contrato** y el `error` es copia.

---

## 1. El endpoint

```
POST /api/onboarding/tours/{tourId}
```

```jsonc
// cuerpo
{ "status": "completed" }   // o "skipped"
```

### Respuesta `200`

```jsonc
{ "tourId": "staff", "status": "completed" }
```

Es un **eco del estado guardado**, no un recibo de la fila: no trae `businessId`, no trae
`updatedAt` y no trae `id`. La UI no necesita ninguno de los tres.

**⚠️ El `status` del `200` es el que se MANDO, no necesariamente el que quedo en la base.** Ver
§3: si el tour ya estaba en `completed` y se manda `skipped`, la respuesta es
`{"status":"skipped"}` y la fila **sigue en `completed`**. Es deliberado y no cambia nada para
la UI —los dos proyectan `done: true`—, pero **no leer esta respuesta como «asi quedo el
registro»**.

---

## 2. Los `tourId`, y son CUATRO

| `tourId` | Tour |
|---|---|
| `staff` | Tour por Staff |
| `catalog` | Tour por Catalogo |
| `program` | Tour por Programa |
| `brand` | Tour por Marca |

**Es un catalogo CERRADO.** Cualquier otro id —incluido uno que difiera en mayusculas
(`Staff`), en espacios (`"staff "`) o en idioma (`catalogo`, `programa`)— responde
`404 unknown_tour`. **Las comparaciones son exactas**; no hay normalizacion.

**Que los cuatro existan no implica que sus cuatro pantallas existan** (ADR 0078 §6). Hoy el
tour de staff apunta a una pantalla que todavia no esta. No hay que esperarla: un tour que
nunca recibe un `POST` simplemente no tiene fila, su `done` queda en `false` y **no traba a
nadie**, porque ningun tour es `blocking`.

**El orden de construccion lo dicta la pantalla, no la API** (decision textual del owner). Cada
tour se crea cuando su pantalla este lista.

---

## 3. LOS DOS ESTADOS, Y EL INVARIANTE QUE NO SE VE POR HTTP

`status` es **uno de dos valores EXACTOS**: `"completed"` o `"skipped"`. No hay un tercero, no
hay `true`, no hay `"done"` ni `"skip"`.

**Los dos cuentan como `done: true`** en el checklist (ADR 0078 §2, decision textual del owner:
*«si, un merchant puede completar el onboarding con skip de todo»*). Se guardan distintos igual,
porque con un booleano *«cuantos merchants saltearon todo»* seria una pregunta que ya no se
puede hacer.

### `completed` NUNCA se degrada a `skipped`

| Se manda… | …sobre una fila en | Queda |
|---|---|---|
| `skipped` | (no hay fila) | `skipped` |
| `completed` | (no hay fila) | `completed` |
| `completed` | `skipped` | **`completed`** — el upgrade SI pisa |
| `skipped` | `completed` | **`completed`** — el downgrade NO pisa |

Un merchant que termina el tour y despues lo reabre y lo cierra **no pierde su `completed`**.
Para la UI **esto es invisible y no hay que compensarlo**: los cuatro casos contestan `200` y
los cuatro proyectan `done: true`.

### Es IDEMPOTENTE

El mismo `POST` repetido N veces deja **una sola fila** y contesta `200` las N veces. Un
reintento por timeout de red es seguro; no hace falta clave de idempotencia en el cuerpo.

---

## 4. EL GATE DE EMAIL: ESTA RUTA SI LO LLEVA, Y ES LO CONTRARIO DEL CHECKLIST

**`POST /api/onboarding/tours/{tourId}` devuelve `403 email_not_verified` a un owner que no
verifico su email, y no escribe nada.**

La asimetria con `GET /api/onboarding/checklist` —que **nunca** emite ese codigo— es la
decision, no una inconsistencia:

- El **checklist** se exime porque **se gatearia a si mismo**: es el endpoint que viene a decir
  «verifica tu email» (ADR 0077 §6).
- Esta ruta **no tiene ese problema**, y ademas `verify-email` es `blocking: true`, o sea que
  *mientras el email no este verificado, los items de `position` mayor no se pueden hacer*.
  Poner el gate aca es **HACER CUMPLIR** ese bloqueo en vez de solo reportarlo.

> **Esto CIERRA una decision que `0083-contratos-de-api.md` §1 dejo abierta.** Ahi se lee: *«Si
> la API ademas debe **rechazar** acciones de un item bloqueado es una decision que no esta
> tomada, y se toma cuando haya un segundo item»*. **Se toma aca, y es que si.** Ese parrafo
> del contrato 0083 queda superado por este §4.

**Que significa para la UI:** un owner recien salido del wizard **ve** los cinco items del
checklist (porque el checklist no se gatea) pero **no puede registrar el progreso de ningun
tour** hasta verificar. Un `403 email_not_verified` sobre esta ruta **no es un error a
reintentar**: es «anda a hacer el item 1 primero».

**El inventario de exenciones al gate sigue en TRES rutas** (`PUT /api/loyalty-program`,
`GET /api/loyalty-program/qr`, `GET /api/onboarding/checklist`). Esta spec **no agrega
ninguna**.

---

## 5. Autorizacion, entradas y errores

| Status | `code` | Cuando |
|---|---|---|
| **200** | — | `{ "tourId": "…", "status": "completed" \| "skipped" }` |
| **400** | `invalid_body` | El cuerpo no es JSON, falta, o `status` no es uno de los dos valores exactos |
| **401** | `unauthorized` | No hay sesion |
| **403** | `not_owner` | Hay sesion pero no es owner con membresia `active` (p. ej. un integrante) |
| **403** | `email_not_verified` | **El bloqueo de `verify-email`, aplicado** — ver §4 |
| **403** | `business_suspended` | El negocio esta suspendido. Trae ademas **`suspensionReason`** (camelCase) cuando hay motivo |
| **403** | `business_closed` | El negocio esta cerrado. **NO** trae `suspensionReason` |
| **404** | `unknown_tour` | El `tourId` de la ruta no esta en el catalogo de §2 |
| **503** | `onboarding_unavailable` | Fallo de base |

Los cinco primeros `code` de fallo salen de `API_OWNER_CODES`, los mismos que ya usan las otras
14 superficies de owner: **no hay `code` nuevo que aprender**, salvo `unknown_tour`.

### El ORDEN de evaluacion, y por que la UI lo puede dar por estable

```
1. ¿hay sesion?          → 401 unauthorized
2. ¿es owner activo?     → 403 not_owner
3. ¿email verificado?    → 403 email_not_verified
4. ¿el negocio OPERA?    → 403 business_suspended | business_closed
5. ¿el tourId existe?    → 404 unknown_tour
6. ¿el cuerpo es valido? → 400 invalid_body
```

- **Un INTEGRANTE recibe `not_owner`, NUNCA `email_not_verified`.** Su email es sintetico
  (`@staff.invalid`) y no se verifica jamas: el codigo del email le pediria hacer algo que no
  puede hacer. El paso 2 va antes del 3 por eso (ADR 0073 §1).
- **`unknown_tour` se evalua DESPUES del guard, y es una decision de seguridad.** Al reves, un
  desconocido sin sesion podria sondear que ids de tour existen —`404` para los inventados,
  `401` para los reales—. **Sin sesion, la respuesta es `401` SIEMPRE**, tambien para un
  `tourId` inventado.
- **Un cuerpo ilegible es `400`, no `503`.** El `request.json()` tiene su propio `try`.

---

## 6. EL `businessId` NO VIAJA, Y SI VIAJA SE IGNORA

El negocio sale de la **sesion** (ADR 0070 §15.3). **No hay forma de escribir el progreso de
otro negocio**: no se lee del cuerpo, no se lee de la query.

**Un `businessId` en el cuerpo no es un error y no es un parametro: es ruido que se descarta.**
Esta aseverado con un caso contra la base —owner de A manda `{"businessId": "<B>"}`, la fila
queda en A y B sigue sin fila—.

**El progreso es POR NEGOCIO, no por usuario** (ADR 0078 §3, decision textual del owner: *«el
tour se guarda por negocio»*). La tabla **no tiene columna de usuario**, a proposito. Si mañana
un negocio tuviera dos owners, el tour que completa el primero aparece completo para el
segundo. Es coherente con que el checklist describa el estado **del negocio**; `verify-email`
—que si es por usuario, via la sesion— es la excepcion, no la regla.

---

## 7. Limites de HOY, declarados

**Estado actual medido el 2026-09-20, no decisiones.**

| Lo que no hay | Evidencia | Que hacer mientras tanto |
|---|---|---|
| **LECTURA del progreso** | Esta spec entrega **solo la escritura**. `GET /api/onboarding/checklist` sigue con **un** item (`verify-email`) y no proyecta ningun tour | La llega la **spec 0085**, que lleva el checklist a cinco items derivando los cuatro tours de este mismo catalogo. Hasta entonces, un `POST` exitoso **no cambia lo que devuelve el checklist** |
| **Borrar / resetear el progreso** | No hay `DELETE` ni forma de volver a `false` | No modelar un boton de «rehacer el tour» que espere que la API lo olvide. Un tour se puede volver a MOSTRAR desde la UI; su registro no se borra |
| **Saber CUAL de los dos estados quedo** | El `200` ecoa lo que se mando (§1) y el checklist solo va a exponer `done: boolean` | No construir UI sobre la diferencia `completed`/`skipped`: ese dato existe para el negocio, no para la pantalla |
| **`503 onboarding_unavailable` sin oraculo** | Es un `catch` de ultima linea. Declarado afuera en la spec, igual que en la 0083 | Tratarlo como un fallo transitorio: reintentar es seguro (§3, es idempotente) |

---

## 8. Tabla de bolsillo

| Ruta | Metodo | Gate | Status posibles | ¿Emite `email_not_verified`? |
|---|---|---|---|---|
| `/api/onboarding/tours/{tourId}` | `POST` | sesion + owner activo + **EMAIL** + negocio operativo | 200 · 400 · 401 · 403 · 404 · 503 | **SI, y es el punto** |

Para comparar con las vecinas de la misma familia:

| Ruta | Para que | ¿Gate de email? |
|---|---|---|
| `/api/merchant/session` | Quien soy y en que negocio | No — **200 siempre** |
| `/api/onboarding/state` | Que falta para terminar **el wizard** | No — corre antes de verificar |
| `/api/onboarding/checklist` | Que falta **despues** del wizard | **No** — se gatearia a si mismo |
| `/api/onboarding/tours/{tourId}` | Registrar que un tour se completo o se salteo | **Si** — §4 |

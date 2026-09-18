---
spec: 0074
fecha: 2026-09-18
estado: anexo
resumen: Contrato HTTP normativo de la spec 0074 — las tres LECTURAS que la UI externa necesita: `GET /api/merchant/session` (reportero de estado, siempre 200, nunca gateado), `GET /api/billing/state` (plan y suscripcion, detras de los cinco `code` de la 0072) y `GET /api/onboarding/state` (hechos del wizard, sin gate de email). Declara ademas, como ESTADO ACTUAL y no como decision, que NO existe endpoint de metricas y por que.
---

# 0074 — Contrato de API: las lecturas

> **Este documento es un entregable, no documentacion opcional** (ADR 0070 §16). Un
> endpoint sin su fila aca **no esta terminado**, y un `code` que el contrato declara y la
> ruta no emite —o al reves— es un FAIL de revision. Mismo rol normativo que
> `0067-contratos-de-api.md`, `0069-contratos-de-api.md` y `0072-contratos-de-api.md`.
>
> **El arco entrega API, NO interfaz.** La UI la construye el owner por fuera; este archivo
> es su insumo. **No hay ninguna pantalla en la spec 0074** y el diff no toca un solo `.tsx`.

## Convenciones

Las mismas de `0072-contratos-de-api.md`, y se repiten aca porque son las que mas se
olvidan:

- **Base URL: `https://www.checkpass.club`.** El apex `checkpass.club` responde **308** hacia
  `www`. Pegarle al apex desde el cliente rompe requests con cuerpo.
- `content-type: application/json` en entrada y salida.
- La autenticacion es la **cookie de sesion de better-auth** (`better-auth.session_token`,
  `HttpOnly`). **Ninguna ruta acepta un token por header.** Desde el navegador: `fetch` con
  `credentials: 'include'` si el origen no es el mismo; mismo origen, nada especial.
- **Ningun identificador de negocio viaja en el cuerpo ni en el query de una ruta
  autenticada**: siempre sale de la sesion (ADR 0070 §15.3).
- Todo fallo del gate del owner responde
  `{ "error": "<texto en español>", "code": "<codigo estable>" }`. **El `code` es el
  contrato; el `error` es copia y la UI puede reescribirlo.**

---

## 1. `GET /api/merchant/session` — el contexto de sesion

**Es un REPORTERO de estado, no un guard.** Es la unica ruta autenticada del API que **no**
pasa por `requireApiOwner` y **no emite ninguno de los cinco `code` de la 0072**.

**Motivo, y es contrato:** si contestara `403 business_suspended`, la UI **nunca** podria
renderizar la pantalla de cuenta suspendida. Un endpoint que reporta el estado no puede
estar gateado por el estado que reporta.

### Respuestas

**SIEMPRE `200`.** No existe un camino que devuelva 401 ni 403.

| Caso | Cuerpo |
|---|---|
| Sin sesion | `{ "authenticated": false }` |
| Sesion sin negocio | `{ "authenticated": true, "user": {…}, "business": null, "membership": null }` |
| Sesion con negocio | `{ "authenticated": true, "user": {…}, "business": {…}, "membership": {…} }` |
| Sesion, membresia **no `active`** | igual que «sesion sin negocio»: `business: null`, `membership: null` |

```jsonc
{
  "authenticated": true,
  "user": {
    "id": "uuid",
    "name": "string",
    "email": "string",
    "emailVerified": true            // boolean, nunca undefined
  },
  "business": {
    "id": "uuid",
    "name": "string",
    "slug": "string",                // unico GLOBAL; es el login del staff y la URL publica
    "status": "active",              // 'active' | 'suspended' | 'closed'
    "suspensionReason": null,        // string solo para role='owner'; ver la nota 2
    "currencyCode": "USD",           // ISO 4217
    "timezone": "America/Guayaquil"
  },
  "membership": {
    "role": "owner",                 // 'owner' | 'staff'
    "status": "active"
  }
}
```

### Lo que la UI tiene que saber, y es contrato

1. **`authenticated: true` + `business: null` es el dato que manda al wizard.** Es la unica
   forma de distinguir «tiene que dar de alta su negocio» de «tiene que verificar el email»,
   que si no habria que inferir de un 403.
2. **`suspensionReason` llega `null` para el staff, siempre.** Un integrante no lee la nota
   interna de por que se suspendio el negocio donde trabaja. No es un bug: es la misma regla
   de `requireBackofficeSession`.

   **La condicion es SOLO el rol, no el `status`** — corregido el 2026-09-18, porque este anexo
   se contradecia a si mismo: el comentario del JSON decia «SOLO si `status='suspended'` Y
   `role='owner'`» y esta nota decia «la misma regla de `requireBackofficeSession`», que
   condiciona **solo por rol** (`auth-guards.ts:163`). Gana la nota: dos de las tres afirmaciones
   del contrato ya decian rol, y la ruta tiene que resolver **igual** que el guard.

   **Y de ahi sale un invariante que la UI tiene que respetar, porque el estado es alcanzable:**
   `suspension_reason` **no tiene ningun CHECK que la ate al `status`** (migracion `0036`), asi
   que un negocio reactivado puede quedar `status='active'` **con el motivo viejo todavia
   escrito**. **La UI decide por `status`, NUNCA por la presencia de `suspensionReason`**: si
   pinta «cuenta suspendida» porque el campo no es `null`, le va a mostrar una suspension que ya
   no existe.
3. **`status: "suspended"` NO es un problema de plan.** No mostrar «mejora tu plan»: son dos
   ejes ortogonales (ADR 0073). El owner suspendido entra, ve el motivo y un boton de
   contacto, y nada mas. **No lo resuelve el owner**: es una decision de la plataforma.
4. **`status: "closed"` no admite login de nadie**, ni owner ni staff. Si esta ruta lo
   devuelve, la UI desloguea y manda a la landing.
5. **Una membresia no `active` se ve igual que no tener negocio.** Es a proposito: un
   integrante dado de baja no lee un dato del negocio. Su sesion se revoca en la primera
   pagina o API que toque, **no aca** — esto es un `GET` y un `GET` con efecto lateral se
   dispararia con un prefetch del navegador.
6. **NO devuelve el plan.** Para eso esta §2. Mezclarlos pondria un lock de fila en cada
   carga de cada pantalla, incluida la landing publica.
7. **Cuando hay varias membresias devuelve la del negocio mas VIEJO**
   (`order by business.created_at asc limit 1`), el mismo criterio que el guard del
   backoffice. Hoy es inalcanzable —`POST /api/onboarding/business` contesta **409** si ya
   hay cualquier membresia, o sea **un negocio por usuario**— pero esta fijado para que la UI
   y el guard nunca hablen de negocios distintos.

### Relacion con `GET /api/auth/get-session`

El endpoint de better-auth **sigue existiendo y no se toca**: devuelve `200` con cuerpo
`null` sin sesion, o `{user, session}` con ella. **Esta ruta lo reemplaza para la UI**: trae
todo lo que aquel trae y ademas rol, negocio, `slug` y `status`. Usar `/api/merchant/session`.

---

## 2. `GET /api/billing/state` — el plan y la suscripcion

**Es una superficie del OWNER.** Pasa por `requireApiOwner` y emite **los cinco `code` de la
0072 en su orden exacto**. Un integrante recibe `not_owner`.

### Camino feliz — `200`

```jsonc
{
  "subscription": {
    "plan": "plus",                  // 'free' | 'plus' | 'none'
    "status": "active",
    "interval": "month",             // 'month' | 'year' | null
    "pendingPlan": null,             // 'free' si hay una baja programada
    "pendingPlanAt": null            // string ISO-8601, o null
  },
  "activeLocations": 2,
  "canCancel": true
}
```

**Estas cinco claves de `subscription` y ninguna mas.** Es una **allow-list positiva**, no un
filtro: `stripeCustomerId`, `stripeSubscriptionId` y `downgradeRequestedAt` **nunca** cruzan
al navegador. Si aparecen, es un FAIL de revision.

### Errores — el gate del owner de la 0072, en su orden

| # | Pregunta | Status | `code` | ¿lleva `suspensionReason`? |
|---|---|---|---|---|
| 1 | ¿hay sesion? | **401** | `unauthorized` | no |
| 2 | ¿es owner con membresia `active`? | **403** | `not_owner` | no |
| 3 | ¿tiene el email verificado? | **403** | `email_not_verified` | no |
| 4 | ¿el negocio opera? (`suspended`) | **403** | `business_suspended` | **SI** (si la columna no es NULL) |
| 4 | ¿el negocio opera? (`closed`) | **403** | `business_closed` | no |

**El orden es contrato, no una optimizacion.** Un integrante recibe **siempre** `not_owner`,
aunque su email no este verificado y aunque el negocio este suspendido.

**Y DOS ESTADOS MAS QUE NO SON DEL GATE: los 503.** La ruta reusa `billingStateResponse` y su
`billingErrorResponse`, o sea que hereda los mismos dos `code` que ya emiten las cuatro rutas
POST de billing. Se declaran porque el preambulo de este anexo dice que un `code` que la ruta
emite y el contrato no declara es un **FAIL de revision**, y porque es la convencion del repo
(el 0067 tabula `auth_unavailable`, el 0069 `qr_unavailable`).

| Cuando | Status | `code` |
|---|---|---|
| El negocio no tiene fila en `core.subscription` (no se pudo leer la suscripcion) | **503** | `subscription_unavailable` |
| Cualquier otro fallo de base o excepcion no tipada | **503** | `unavailable` |

**Un 503 NO es «no tenes plan»**: es «no lo pudimos leer». La UI reintenta o muestra un error
de servicio — **nunca** degrada a mostrar el plan `free`, que seria inventarle al comercio un
estado de su plata.

### Lo que la UI tiene que saber

- **`pendingPlan: "free"` + `pendingPlanAt` = baja programada.** Mostrar la fecha, no un
  «cancelado»: hasta esa fecha el plan vigente **sigue siendo el de arriba** y conserva sus
  topes.
- **`canCancel: false` no es un error**: significa que la baja esta bloqueada por una guarda
  (mas locales o campañas activas de las que el plan destino admite). El texto del motivo lo
  devuelve el **409 de `POST /api/billing/cancel`**, que es literalmente el mismo.
- **`activeLocations` viene de aca y no se cuenta en el cliente.** El tope por plan sale del
  catalogo de entitlements (`free`: 1 · `plus`: 3 · `none`: 1).

---

## 3. `GET /api/onboarding/state` — retomar el wizard

**Lleva sesion pero NO lleva el gate de email**, a proposito: el wizard corre **antes** de la
verificacion (ADR 0070 §11). Es el mismo criterio que `POST /api/onboarding/program`. Un gate
de email aca volveria irretomable el unico flujo que ocurre antes de verificar.

### Respuestas — siempre `200`

```jsonc
{
  "authenticated": true,
  "business": null,                  // o { "id": "uuid", "name": "…", "slug": "…" }
  "program": null,                   // o { "id": "uuid", "kind": "stamps" }
  "stampImage": false                // boolean
}
```

Sin sesion: `{ "authenticated": false }`.

### Lo que la UI tiene que saber, y es contrato

1. **Devuelve HECHOS, nunca un numero de paso.** No hay `"step": 2` y no lo va a haber: el
   ADR 0070 prohibe la columna `onboarding_step`, y un numero de paso en el JSON es esa
   columna disfrazada. **El paso lo deriva la UI**: `business === null` → paso 1;
   `business !== null && program === null` → paso 2; los dos presentes → pantalla final.
2. **`business !== null` significa que el paso 1 es irrepetible.**
   `POST /api/onboarding/business` contesta **409** si ya existe cualquier membresia. No
   ofrecer «volver atras» a crear el negocio: ofrecer editarlo, que es `PUT /api/brand`.
3. **Es «que falta para terminar el alta», NO el checklist del negocio.** El checklist
   derivado del ADR 0070 §9 (logo, colores, costos, staff, wallet) **no existe y esta
   diferido**, con seis decisiones del owner abiertas.

---

## 4. Lo que NO existe — declarado, para que no se invente

**Esto es ESTADO ACTUAL medido el 2026-09-18, no una decision.**

| Lo que no hay | Evidencia | Que hacer mientras tanto |
|---|---|---|
| **Cualquier endpoint de metricas o analitica** | Cero rutas. Lo unico agregado es `GET /api/marketing/campaigns/[id]/results`, por campaña. `/backoffice/demo/analytics` es un **mock de `sessionStorage`** (spec 0015) | **No inventar uno.** Un dashboard sin numeros es una pantalla incompleta; un dashboard con numeros inventados es una pantalla que hay que tirar. Anotarlo y seguir |
| **API de admin de plataforma** (`bo.checkpass.club`) | `apps/platform` tiene **una sola ruta**: `/api/health` | Entregar el esqueleto del subdominio, sin pantallas que dependan de endpoints que no existen |
| **Tope por plan de staff y de productos** | El catalogo de entitlements tiene **exactamente dos entradas**: `locations.max` y `campaigns.enabled` | No mostrar un contador «3 de 5 integrantes»: hoy no hay tope. Solo locales lo tiene |
| **Un endpoint para editar el `slug`** que no sea `PATCH` | `PATCH /api/merchant/business/slug` existe; el `slug` **no sigue al nombre** (ADR 0070 §12) | Cambiar el nombre **no** cambia el `slug`. Son dos acciones distintas y la UI tiene que decirlo |

---

## 5. Tabla de bolsillo — las tres rutas

| Ruta | Metodo | Gate | Status posibles | Emite los 5 `code`? |
|---|---|---|---|---|
| `/api/merchant/session` | `GET` | ninguno | **200 siempre** | **NO** |
| `/api/billing/state` | `GET` | `requireApiOwner` | 200, 401, 403, **503** | **SI**, en orden |
| `/api/onboarding/state` | `GET` | sesion, **sin email** | **200 siempre** | **NO** |

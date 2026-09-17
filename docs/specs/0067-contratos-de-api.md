---
spec: 0067
fecha: 2026-09-16
estado: anexo
resumen: Contrato HTTP normativo de la spec 0067 — metodo, ruta, entrada, salida, TODOS los codigos de error con su status, y si setea cookie de sesion. Es lo que consume quien construye la UI por fuera (ADR 0070 §16) y es el oraculo del revisor. Cubre los 8 endpoints de la spec: los 4 del staff (paso 2) mas `auth/start`, el consumo del link magico, el envio de la verificacion de email y el `PATCH` del slug del negocio (paso 3), y la tabla de CODIGOS DE REBOTE que reemplaza a la allow-list de la pantalla de login borrada.
---

# 0067 — Contrato de API: identidad sin contraseña

> **Este documento es un entregable, no documentacion opcional** (spec 0067 §8). Un
> endpoint sin su fila aca **no esta terminado**, y un `code` que el contrato declara y la
> ruta no emite —o al reves— es un FAIL de revision. Mismo rol normativo que
> `0055-contratos-del-orquestador.md`.

## Convenciones

- Salvo donde diga otra cosa, las rutas son `POST` con `content-type: application/json`.
  Las dos excepciones estan marcadas en su seccion: el `PATCH` del slug (§8) y el **GET** del
  link magico (§6), que es un GET porque el destino lo escribe un mail.
- **Todo error responde `{ "error": "<texto en español>", "code": "<codigo estable>" }`.**
  El `code` es el contrato; el `error` es copia y la UI puede reescribirlo.
- La autenticacion del owner y del staff es la **cookie de sesion de better-auth**
  (`better-auth.session_token`, `HttpOnly`). Ninguna ruta acepta un token por header.
- `503` sale con `code: "staff_unavailable"` cuando el fallo no es de dominio (base caida,
  por ejemplo). Aplica a **las cuatro rutas de staff** (§1-§4) y no esta repetido en cada
  tabla: las cuatro
  envuelven **todo** lo que toca la base —incluida la resolucion de la sesion, que tambien
  consulta— y traducen con `staffError`. Un 500 sin `code` **es un incumplimiento del
  contrato**, no un detalle: lo cazo un revisor independiente cuando dos de las rutas
  tenian su unico `try` alrededor del `request.json()`. Sonda:
  `server/staff-routes-unavailable.test.ts`.
- **El PIN en claro aparece exactamente en dos respuestas** —el alta y la regeneracion— y
  en ninguna otra. No hay ninguna ruta que lo lea.

### `StaffDTO` — forma canonica

```jsonc
{
  "userId": "b0e498d9-…",          // merchant_auth.user.id
  "name": "Lucas Pérez",
  "email": "staff-b0e498d9-…@staff.invalid", // SINTETICO: no es un canal, ver abajo
  "identifier": "lucas-perez@la-farmacia",   // handle@slug: esto es lo que se reparte
  "role": "staff",
  "status": "active",              // 'active' | 'disabled'
  "createdAt": "2026-09-16T12:00:00.000Z"
}
```

**`email` es sintetico y no entregable, a proposito.** `merchant_auth.user.email` es
`NOT NULL` con indice unico, asi que el staff necesita *algo* ahi; el dominio `.invalid`
esta reservado por RFC 2606 §2 para que nunca resuelva. **Ningun mail sale hacia un staff**
y ese email **no sirve para entrar**: el usuario se crea sin fila en `merchant_auth.account`,
o sea sin credencial. La UI no deberia mostrarlo — lo que el owner le pasa al integrante es
`identifier` + el PIN.

---

## 1. `POST /api/merchant/auth/staff` — login del integrante

Ruta propia, **no** el plugin `username` de better-auth (spec §4: su rate limit esta
keyeado por `(IP, path)`, vive en memoria y se apaga fuera de produccion).

**Entrada**

```jsonc
{ "identifier": "lucas-perez@la-farmacia", "pin": "482913" }
```

- `identifier`: `handle@slug`, se corta por el **ultimo** `@`. Se normaliza a minusculas.
- `pin`: exactamente 6 digitos (`^[0-9]{6}$`).

**Salida 200** — **SI setea cookie de sesion** (`set-cookie`, `HttpOnly`).

```jsonc
{
  "staff": {
    "userId": "…",
    "name": "Lucas Pérez",
    "identifier": "lucas-perez@la-farmacia",
    "mustChangePin": true
  }
}
```

`mustChangePin: true` significa que el integrante **tiene que pasar por §3 antes de operar**.
La sesion se abre igual: el cambio se hace ya logueado.

**Errores**

| Status | `code` | Cuando |
|---|---|---|
| 400 | `invalid_body` | cuerpo que no es JSON, `identifier` vacio, o `pin` que no son 6 digitos |
| 401 | `invalid_credentials` | el identificador no resuelve **o** el PIN es incorrecto — **el mismo cuerpo para los dos**: la ruta no dice si ese integrante existe |
| 429 | `pin_locked` | hay un bloqueo vivo, **o** este intento acaba de dispararlo. Suma `"retryAfterSeconds": <int>` y el header `retry-after`. **El PIN se evalua igual** (el guard vive adentro del `UPDATE` atomico): el intento no consume nada y la respuesta es identica con PIN bueno o malo, asi que el 429 no filtra cual era |
| 403 | `staff_disabled` | el PIN era correcto pero la membresia esta `disabled` (ADR 0055). Se contesta **despues** de verificar el PIN, para no publicar quien trabaja ahi |

**Invariantes que el revisor puede ejercitar** (`staff-pin.neon.integration.test.ts`):

- **5 fallos → 429 y `locked_until` a 15 min**; liberado, **3** fallos → 1 h; despues, 1 → 24 h.
  Los numeros son decision del owner (ADR 0070 §13).
- **Estando bloqueado, el PIN correcto tambien devuelve 429** y no levanta ni alarga el candado.
- Un login correcto **resetea** `failed_count`, `stage` y `locked_until`.
- Una membresia con el `pin_hash` centinela del backfill de la 0032 (`'legacy-sin-pin'`, que
  **no es un hash**) responde **401, nunca 500**: verificar contra ese valor hace que
  better-auth tire `Invalid password hash`, y la ruta lo trata como PIN incorrecto
  (fail-closed).

---

## 2. `POST /api/staff` — el owner da de alta un integrante

**Requiere sesion de owner.** El negocio sale de la sesion.

**Entrada**

```jsonc
{ "name": "Lucas Pérez" }
```

**`name` es el UNICO campo.** Cualquier otra clave se ignora — en particular `slug`: que el
slug no viaje en el cuerpo es lo que impide que un owner apunte al negocio de otro. El
`handle` lo deriva el servidor (`slugify` + sufijo ante colision o palabra reservada), asi
que **dos integrantes con el mismo nombre conviven**: `lucas@…` y `lucas-2@…`.

**Salida 201** — **NO setea cookie.**

```jsonc
{ "staff": { /* StaffDTO */ }, "pin": "482913" }
```

**`pin` se ve una sola vez.** No se guarda en claro y no hay ruta que lo lea; si se pierde,
el owner usa §4.

**Errores**

| Status | `code` | Cuando |
|---|---|---|
| 400 | `invalid_body` | el cuerpo no es un objeto JSON |
| 400 | `name_required` | `name` ausente o solo espacios |
| 400 | `name_too_long` | `name` de mas de 80 caracteres |
| 401 | `unauthorized` | sin sesion |
| 403 | `not_owner` | la sesion no es owner de ningun negocio activo. **Se evalua ANTES que el gate de email**: la spec §3 aplica ese gate solo a `role='owner'`, asi que un integrante nunca recibe `email_not_verified` — seria pedirle algo que no puede hacer |
| 403 | `email_not_verified` | el owner **todavia no verifico su email** (spec §3 / ADR 0070 §11). Se sale de ahi con §7 + §6 |
| 409 | `handle_taken` | dos altas simultaneas ganaron el mismo handle; decide el indice unico, no la lectura previa |
| 503 | `staff_create_failed` | fallo al persistir; el `user` recien creado se revierte |

---

## 3. `POST /api/staff/[userId]/pin` — el integrante cambia SU PIN

Es el **cambio obligatorio del primer uso**. **Requiere la sesion del propio integrante**
(no la del owner).

`[userId]` y no `[id]`: `api/staff/[userId]/status/` ya existe y Next.js no admite dos
nombres de parametro en el mismo nivel.

**Entrada**

```jsonc
{ "currentPin": "482913", "newPin": "112233" }
```

**Salida 200** — **NO setea cookie** (la sesion que ya tenia sigue valiendo).

```jsonc
{ "ok": true, "mustChangePin": false }
```

**Errores**

| Status | `code` | Cuando |
|---|---|---|
| 400 | `invalid_body` | cuerpo que no es JSON |
| 400 | `invalid_pin_format` | `currentPin` o `newPin` que no son 6 digitos |
| 400 | `pin_unchanged` | `newPin` igual a `currentPin` |
| 401 | `unauthorized` | sin sesion |
| 401 | `invalid_credentials` | **el PIN actual no es correcto** |
| 403 | `staff_disabled` | membresia `disabled` |
| 404 | `staff_not_found` | `userId` no es el de la sesion, no es un staff, **o resuelve a mas de una membresia de staff** (la PK de `business_membership` es `(business_id, user_id)` y la sesion no trae negocio: la ambiguedad se rechaza en vez de elegir un negocio a dedo; hoy es inalcanzable). **404 y no 403**: no se confirma que ese id exista |
| 429 | `pin_locked` | mismo bloqueo escalado que el login —este endpoint **no** es un camino barato para adivinar el PIN— y con la misma nota: el PIN se evalua igual, el intento no consume nada y el 429 no dice si era correcto |

> **El invariante mas peligroso del paso esta aca: no se puede fijar un PIN nuevo sin
> verificar el actual.** Si se pudiera, `pin_must_change = true` sobre las membresias
> heredadas de la 0032 seria una toma de cuenta de todo el staff viejo. Un intento fallido
> deja el `pin_hash` **exactamente como estaba** — verificado por SQL en
> `staff-pin-change.neon.integration.test.ts`.

---

## 4. `POST /api/staff/[userId]/pin/regenerate` — el owner rota el PIN

**Requiere sesion de owner.** El cuerpo se ignora (puede ir vacio).

**Salida 200** — **NO setea cookie** (pero **borra las del integrante**, ver abajo).

```jsonc
{ "staff": { /* StaffDTO */ }, "pin": "907461" }
```

Hace **cuatro** cosas, y las cuatro son parte del contrato:

1. rota el `pin_hash` y devuelve el PIN nuevo **una sola vez**;
2. deja `pin_must_change = true` — el integrante vuelve a pasar por §3;
3. **resetea el bloqueo escalado** (borra la fila de `core.staff_pin_lockout`): un PIN nuevo
   con el candado puesto no serviria de nada;
4. **revoca todas las sesiones de ese integrante** (`delete from merchant_auth.session where
   user_id = …`), el mismo `DELETE` que ya usan `setStaffStatus` y el guard del backoffice.
   No se agrega ningun mecanismo de revocacion nuevo (ADR 0055).

**Errores**

| Status | `code` | Cuando |
|---|---|---|
| 401 | `unauthorized` | sin sesion |
| 403 | `not_owner` | la sesion no es owner (un integrante pidiendo esto recibe 403). Se evalua antes que el gate de email, ver §2 |
| 403 | `email_not_verified` | el owner todavia no verifico su email (ver §2) |
| 404 | `staff_not_found` | ese `userId` no es staff **de este negocio**. **404 y no 403** — un owner del negocio A pidiendo un staff de B no puede distinguir «no existe» de «no es tuyo» |

---

---

## 5. `POST /api/merchant/auth/start` — la PANTALLA 1 del wizard

**No requiere sesion.** Es la unica puerta de ALTA de cuentas del merchant.

**Entrada**

```jsonc
{ "email": "ana@lafarmacia.com" }
```

Se normaliza a minusculas y se recorta. No hay contraseña: `emailAndPassword` esta apagado
en `server/auth.ts` y better-auth ya no monta `/sign-in/email` ni `/sign-up/email`.

**Salida 200 — dos ramas, y la diferencia es el contrato entero de esta ruta:**

| Rama | Cuerpo | Cookie de sesion |
|---|---|---|
| email **desconocido** | `{ "sent": false }` | **SI** (`set-cookie`, `HttpOnly`) — queda logueado en el acto, sin espera |
| email **conocido** | `{ "sent": true }` | **NO** — se le manda un link magico al buzon |

**Que un email conocido NO abra sesion es un requisito de seguridad, no una preferencia.**
Sin contraseña, escribir el email de otro merchant le entregaria el negocio. Confirmado por
el owner el 2026-09-16. La UI usa `sent` para decidir entre «entraste» y «te mandamos un
link»; el oraculo esta en `auth-start.neon.integration.test.ts` (mutacion #4 del
presupuesto).

**Enumeracion, declarada y aceptada:** `sent` **es** un oraculo de existencia de cuenta. La
spec §2 lo acepta a cambio del rate limit por IP de abajo, porque el alta necesita saber si
abrio sesion o no.

**Rate limit** — contado desde `merchant_auth.auth_start_attempt`, o sea desde la BASE y no
desde memoria (el default de better-auth vive en un `Map` del proceso y en Vercel se evapora;
ADR 0070 §13). Las dos ramas consumen cupo por igual:

| Cupo | Valor |
|---|---|
| por IP, ventana de 1 h | 20 |
| por email, ventana de 1 h | 5 |
| por email, ventana de 24 h | 10 |

**Errores**

| Status | `code` | Cuando |
|---|---|---|
| 400 | `invalid_body` | el cuerpo no es JSON |
| 400 | `invalid_email` | `email` ausente, de mas de 254 caracteres o con forma invalida |
| 429 | `rate_limited` | alguno de los tres cupos esta lleno |
| 503 | `auth_unavailable` | fallo no de dominio (base caida, proveedor de mail sin configurar). Se loguea el `name` del error, nunca su mensaje |

---

## 6. `GET /api/merchant/auth/magic-link?token=…` — el consumo del link

**Es el destino que viaja en el mail de §5 y de §7**, y por eso es un `GET`: lo abre el
navegador desde el correo. Ruta propia — los dos endpoints que publica el plugin
(`/sign-in/magic-link` y `/magic-link/verify`) estan en `disabledPaths`.

**Salida: siempre un `303`**, nunca un cuerpo JSON.

| Caso | `location` | Cookie de sesion |
|---|---|---|
| token valido | `/backoffice` | **SI** |
| token ausente, invalido, vencido o ya usado | `/?e=magic_link_invalid` | NO |

**El consumo tambien VERIFICA el email.** better-auth 1.6.26 pone `emailVerified: true` al
consumir el token, y antes llama `revokeUnprovenAccountAccess`, que borra credenciales y
sesiones que la cuenta hubiera acumulado **sin** haber probado el buzon. O sea: **este
enlace es el primer paso del onboarding del ADR 0070 §11** y es lo que abre el gate de §3 de
la spec. No hay un segundo tipo de token de verificacion.

**Limite declarado:** el token vale **una sola vez** y 15 minutos. Un escaner de correo que
siga el enlace lo consume y el owner recibe el rebote — es inherente a los links magicos.

---

## 7. `POST /api/merchant/auth/verify-email` — pedir el enlace de verificacion

**Requiere sesion de OWNER.** **No recibe email**: la direccion sale de la SESION, igual que el
`slug` en el alta de staff. Si viajara en el cuerpo, seria un parametro con el que
cualquiera dispararia mails hacia una direccion ajena. El cuerpo se ignora.

**Una sesion de integrante recibe 400 `invalid_email` sin que se emita nada ni se consuma cupo**
(ver la tabla de errores). No se chequea el `role` sino el DOMINIO del email: no agrega una
consulta y no tiene el caso borde del owner recien creado por §5, que **todavia no tiene
membresia** y con un chequeo de rol habria que dejar pasar igual.

**Salida 200** — **NO setea cookie.**

| Cuerpo | Cuando |
|---|---|
| `{ "sent": true, "verified": false }` | se encolo el mail con el enlace de §6 |
| `{ "sent": false, "verified": true }` | el email ya estaba verificado; no se manda nada |

Consume el **mismo** cupo que §5 (misma tabla, mismos numeros).

**Errores**

| Status | `code` | Cuando |
|---|---|---|
| 401 | `unauthorized` | sin sesion |
| 400 | `invalid_email` | **la cuenta no tiene un buzon al que se le pueda escribir.** Hoy son dos casos: una direccion sin forma valida, y —el caso real— una sesion de **INTEGRANTE**, cuyo email es el sintetico `@staff.invalid` que `staff-create.ts` acuña. **El sintetico PASA el chequeo de forma** (`staff` `.` `invalid` es forma valida), asi que se corta aparte, por dominio, **antes de emitir el token y antes de contar el intento** — o sea que este 400 **no consume cupo**. Un integrante no verifica email: entra con `handle@slug` + PIN (§1) |
| 429 | `rate_limited` | cupo lleno |
| 503 | `auth_unavailable` | fallo no de dominio |

---

## 8. `PATCH /api/merchant/business/slug` — cambiar el identificador del negocio

**Requiere sesion de owner CON email verificado.** El negocio sale de la sesion: no hay
`businessId` en el cuerpo. Es el «cambio explicito» del ADR 0070 §12 y es **posterior al
alta** — el wizard no expone ningun campo de slug.

**Entrada**

```jsonc
{ "slug": "la-farmacia" }
```

Forma normativa: `^[a-z0-9]([a-z0-9-]{1,28}[a-z0-9])$` — 3 a 30 caracteres, minusculas,
digitos y guion medio, sin guion al principio ni al final. Se normaliza a minusculas.

**Salida 200** — **NO setea cookie.**

```jsonc
{ "slug": "la-farmacia" }
```

**Errores**

| Status | `code` | Cuando |
|---|---|---|
| 400 | `invalid_body` | el cuerpo no es JSON |
| 400 | `invalid_slug` | `slug` ausente o con forma invalida |
| 400 | `reserved_slug` | el valor esta en `RESERVED_SLUGS` (`server/slug.ts`): segmentos de ruta que ya existen mas los genericos |
| 401 | `unauthorized` | sin sesion |
| 403 | `not_owner` | la sesion no es owner de ningun negocio activo. Se evalua antes que el gate de email, ver §2 |
| 403 | `email_not_verified` | owner sin email verificado |
| 404 | `business_not_found` | el `update` no matcheo ninguna fila. **Hoy es inalcanzable**: el `businessId` sale de la sesion y `requireStaffOwner` ya probo que existe; esta declarado porque la ruta lo puede emitir y el contrato no puede tener codigos ocultos |
| 409 | `slug_taken` | **ya esta tomado**. Suma `"suggestion": "la-farmacia-2"` — la siguiente forma libre, que la UI puede ofrecer. El 409 sale del choque del indice unico, **no** de un chequeo previo (entre leer y escribir cabe otra alta: TOCTOU) |
| 503 | `slug_unavailable` | fallo no de dominio |

**Lo que NO hace, y es la decision del owner:** el slug **no sigue al nombre**. Renombrar el
negocio (`PUT /api/brand`) lo deja intacto, porque el slug es a la vez el login del staff
(`handle@slug`) y la URL publica. Oraculo:
`business-slug.neon.integration.test.ts` (mutacion #5 del presupuesto).

**Consecuencia declarada:** cambiar el slug **cambia el identificador de login de todo el
staff** del negocio. Es inherente a que sean el mismo identificador (ADR 0070 §5); esta spec
no entrega ningun aviso previo ni periodo de gracia.

---

## Códigos de rebote

Reemplaza a la allow-list que vivia en `app/login/login-notice.ts` (ADR 0055), borrada con
esa pantalla por la spec 0067 §7. **El servidor solo emite el codigo**; la copia la renderiza
quien construye la UI.

El codigo viaja en el query de una redireccion (`/?e=<codigo>`). **Viene de la URL, o sea
que es falsificable**: cualquiera puede escribir `/?e=staff_disabled` y ver el aviso. Eso no
es un problema —el aviso no habilita nada, el control de acceso real vive en
`requireBackofficeSession`—, pero **la UI tiene que traducirlo por allow-list y nunca
imprimir el parametro crudo**: un codigo desconocido no renderiza nada.

| `code` | Quien lo emite | Que significa | Texto sugerido |
|---|---|---|---|
| `staff_disabled` | `requireBackofficeSession` (`server/auth-guards.ts`, constante `STAFF_DISABLED`) | la membresia del integrante esta `disabled`; el guard ademas **revoco su sesion** antes de rebotarlo (ADR 0055) | «Miembro del staff desactivado» |
| `email_not_verified` | `requireBackofficeSession` (constante `EMAIL_NOT_VERIFIED`), solo para `role='owner'` | el owner todavia no probo el control de su buzon; todo lo posterior al wizard esta bloqueado (ADR 0070 §11). La sesion **sigue viva**: se sale de ahi con §7 + §6 | «Verificá tu email para continuar» |
| `magic_link_invalid` | `GET /api/merchant/auth/magic-link` (§6) | el enlace no traia token, o el token era invalido, estaba vencido o ya se habia usado | «Ese enlace ya no sirve. Pedí uno nuevo.» |

**Gemelo de API:** en las rutas owner-only el mismo motivo no rebota, responde **403 con
`code: "email_not_verified"`** (§2, §4 y §8) — un `redirect()` sobre un `POST` es un 307 y no
el 403 que la UI necesita.

**Pinneado:** `server/auth-guards.test.ts` lee este archivo y exige que cada codigo que el
guard emite tenga su fila aca. Un codigo nuevo sin fila pone ese test rojo.

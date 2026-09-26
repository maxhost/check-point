---
spec: 0099
fecha: 2026-09-26
estado: anexo
resumen: Contrato VIGENTE consolidado de las 4 rutas de `/api/loyalty-program` (`GET`,
  `PUT`, `DELETE`, `PATCH`), mas `/qr`, `/stamp-upload` y `/api/loyalty-terms/templates`
  por remision. Corrige el `403` que el anexo 0079 §4 dejo desactualizado tras la 0086:
  `GET`/`PUT` ya no emiten `not_owner`, emiten `not_member` / `missing_permission`. El
  cuerpo de `PUT` no cambia una coma (remite integro a 0079 §2-3); lo que cambia es solo
  el codigo de guard. Consolida, no reemplaza, a `0069/0072/0078/0079/0081/0084/0086-contratos-de-api.md`.
---

# 0099 — Contrato de API: `/api/loyalty-program`, el vigente

> **Este documento es un entregable, no documentacion opcional** (ADR 0070 §16). El arco
> del alta entrega API y endpoints, **no interfaz**: la UI la construye el owner por
> fuera y este archivo es su insumo. La spec 0099 **no toca un solo `.tsx`**.
>
> Todo lo que dice esta medido contra el codigo el 2026-09-26: `server/api-permission.ts`,
> `server/api-owner.ts`, `app/api/loyalty-program/route.ts` y
> `server/loyalty-program/client-view.ts`.

## Convenciones

Las mismas de `0069-`, `0072-`, `0078-`, `0079-`, `0081-`, `0084-` y
`0086-contratos-de-api.md`: base `https://www.checkpass.club` (el apex hace **308**),
`content-type: application/json`, cookie de sesion de better-auth
(`better-auth.session_token`, `HttpOnly`; ninguna ruta acepta un token por header),
**ningun identificador de negocio ni de programa viaja en el cuerpo ni en el query**
(ADR 0070 §15.3, sale siempre de la sesion), y todo fallo responde
`{ "error": "<español>", "code": "<estable>" }` donde **el `code` es el contrato** y el
`error` es copia.

---

## 1. Los 4 verbos, tabla verbo → guard → `code` en cada paso

```
GET  /api/loyalty-program     — leer el programa activo/en cierre del negocio
PUT  /api/loyalty-program     — la UNICA escritura (crear o editar), spec 0079
DELETE /api/loyalty-program   — cerrar el programa
PATCH /api/loyalty-program    — { "action": "cancel-close" }, cancela ese cierre
```

**`GET` y `PUT` son DELEGABLES** con el alcance `loyalty` (spec 0086 §1: un integrante con
ese permiso puede leer y escribir el programa) y pasan por la escalera de PERMISOS,
`requireApiPermission` (`GET`) / `requireApiPermissionSinGateDeEmail` (`PUT`) —
`server/api-permission.ts:91-146`, resolviendo con `resolveMembership`
(`server/api-permission.ts:150-219`) y cerrando con `statusStep`
(`server/api-permission.ts:226-244`):

| Paso | Pregunta | `code` | Status | `GET` | `PUT` |
|---|---|---|---|---|---|
| 1 | ¿hay sesion? | `unauthorized` | 401 | si | si |
| 2 | ¿membresia ACTIVA del negocio? | `not_member` | 403 | si | si |
| 3 | ¿owner, o staff con el scope `loyalty`? | `missing_permission` | 403 | si | si |
| 4 | ¿email verificado? — **SOLO si `role === "owner"`** | `email_not_verified` | 403 | si | **NO corre** (spec 0086 / 0079: el gate de email de la escritura vive en `saveProgram`, que distingue crear de editar) |
| 5 | ¿el negocio OPERA? | `business_suspended` \| `business_closed` | 403 | si | si |

`PUT` usa `requireApiPermissionSinGateDeEmail` (`server/api-permission.ts:133-146`),
**la misma escalera sin el paso 4**: por eso una cuenta nueva, con `email_verified: false`
por construccion, puede crear su primer programa (paso 3 del alta, ADR 0070 §11), y
`saveProgram` es quien exige el email verificado (o el permiso de alta vigente) recien al
**editar** uno existente — el 403 `email_not_verified` que `PUT` SI puede emitir en ese
caso sale del **writer**, no de la puerta (ver §2).

**`DELETE` y `PATCH` son IRREVERSIBLES y por eso NO son delegables** (spec 0086 §2.1):
conservan `requireApiOwner` (`server/api-owner.ts:75-126`) entero, con su `403 not_owner`
**literal**:

| Paso | Pregunta | `code` | Status |
|---|---|---|---|
| 1 | ¿hay sesion? | `unauthorized` | 401 |
| 2 | ¿es owner ACTIVO del negocio? | `not_owner` | 403 |
| 3 | ¿email verificado? | `email_not_verified` | 403 |
| 4 | ¿el negocio OPERA? | `business_suspended` \| `business_closed` | 403 |

**El cambio de contrato frente al 0079 original es exactamente este:** hasta la spec 0086,
los tres casos —sin membresia, integrante, owner de otro negocio— colapsaban en
`403 not_owner` para las diez superficies delegables, `GET`/`PUT` de este dominio
incluidas. Ahora son `not_member` y `missing_permission`. **`not_owner` sobrevive intacto
solo en `DELETE` y `PATCH`**, que nunca migraron de guard por ser irreversibles (spec 0086
§2.1). Un cliente que ramifique sobre `not_owner` para `GET`/`PUT` deja de entrar por esa
rama — es el hallazgo que motivo esta spec (ver Problema, `0099-el-dto-del-programa-y-el-contrato-vigente.md`).

`suspensionReason` viaja SOLO en `business_suspended`, y solo si el rol resuelto es
`owner` (`statusStep`, `server/api-permission.ts:226-244`, y `businessStatusFailure` en
`server/business-status.ts`); un integrante recibe `business_suspended` mudo.

## 2. El cuerpo de `PUT`: remite integro a `0079-contratos-de-api.md` §2-3

**El cuerpo de escritura NO cambia una coma.** Cuerpo corto o completo, los campos
obligatorios/opcionales por `kind`, el par `unitName`/`unitPlural`, la compatibilidad hacia
atras y la salida (`{ "programId": "<uuid>", "created": true|false }` con 201/200) son
integros los de `0079-contratos-de-api.md` §2-3 — no se reescriben aca para no duplicar una
tabla que sigue exacta.

**Lo UNICO que cambio es el `code` del 403 de guard**, y solo para el CASO de guard (pasos
2, 3 y 5 de la tabla de arriba). La tabla completa de los `code` de `PUT`, vigente:

| Status | `code` | De donde sale | Cambio vs. 0079 §4 |
|---|---|---|---|
| 400 | `invalid_body` | ruta (`route.ts`) | igual |
| 401 | `unauthorized` | guard, paso 1 | igual |
| 403 | `not_member` | guard, paso 2 | **nuevo** — reemplaza a `not_owner` para "sin membresia" |
| 403 | `missing_permission` | guard, paso 3 | **nuevo** — reemplaza a `not_owner` para "sin el scope `loyalty`" |
| 403 | `email_not_verified` | **writer** (`saveProgram`), no la puerta — solo al EDITAR sin verificar ni permiso de alta vigente | igual (spec 0077); sigue llegando por el `error.code ??` de `codeForStatus` (`route.ts:66-71`) |
| 403 | `business_suspended` \| `business_closed` | guard, paso 5 | igual |
| 409 | `program_exists` | dominio (`LoyaltyError`) | igual |
| 422 | `invalid_program` | dominio (`LoyaltyError`) | igual |
| 503 | `program_unavailable` | dominio o guard caido | igual |

`not_owner` **ya no aparece nunca** en la respuesta de `PUT` — es la correccion puntual de
esta spec sobre `0079-contratos-de-api.md` §4.

## 3. La salida de `GET`: la forma del DTO post-0099

`GET` responde `{ business, program }`. `program` es el resultado de `toClientProgram`
(`server/loyalty-program/client-view.ts`), que **desde esta spec construye el objeto campo
por campo** — sin `...rest` ni spread de la fila de `loyalty_program` — y por eso **nunca
sirve** `businessId`, `createdBy`, `schemaVersion`, `termsHash`, `termsUpdatedAt` ni el
`stampImageObjectKey` interno de R2:

```jsonc
{
  "business": {
    "name": "La Farmacia",
    "countryCode": "AR",
    "currencyCode": "ARS",
    "timezone": "America/Argentina/Buenos_Aires",
    "brandPrimaryColor": "#176548",
    "brandComplementaryColor": "#2D8B68",
    "brandAccentColor": "#E78132"
  },
  "program": {
    "id": "77777777-7777-4777-8777-777777777777",
    "kind": "stamps",
    "configuration": { "target": 8, "unitName": "sello", "unitPlural": "sellos" },
    "status": "active",
    "activatedAt": "2026-09-01T00:00:00.000Z",
    "earningEndsAt": null,
    "redemptionEndsAt": null,
    "termsMarkdown": "Programa de fidelización...",
    "cardBackgroundColor": null,
    "cardBackgroundColor2": null,
    "cardBackgroundGradientAngle": null,
    "cardBorderColor": null,
    "redeemAllowInsufficient": false,
    "stampImagePath": "/api/public/loyalty/biz-9/77777777-7777-4777-8777-777777777777/stamp?v=0",
    "accrual": { "mode": "per_purchase", "grant": 1, "blockAmount": null },
    "rewards": [
      {
        "id": "22222222-2222-4222-8222-222222222222",
        "type": "custom",
        "label": "Café gratis",
        "productId": null,
        "discountPercent": null,
        "pointsCost": null,
        "position": 0,
        "imagePath": null
      }
    ]
  }
}
```

`program` es `null` si el negocio no tiene un programa `active`/`closing`.

**Lo que NUNCA viaja, ni con `null` ni de ninguna otra forma:** `stampImageObjectKey` (la
clave interna de R2 — spec 0025), `stampImageVersion` crudo (redundante: ya viaja
codificado en el `?v=` de `stampImagePath`), `businessId`, `createdBy` (un `userId`),
`schemaVersion`, `termsHash` y `termsUpdatedAt`. Ninguna de esas 6 columnas la lee hoy
ninguna pantalla del backoffice (medido con `rg` sobre `app/backoffice/loyalty`), y
`redeemAllowInsufficient` (spec 0055 §5, `loyalty-types.ts:35`) SI viaja siempre, como
booleano.

## 4. `DELETE` y `PATCH`: sin cambios de comportamiento

Remiten a `0079-contratos-de-api.md` §0 (por que son las unicas dos superficies que
conservaron `requireApiOwner` completo) y al codigo actual, `route.ts:204-252`. Ninguna de
las dos emite `code` en su cuerpo de error — es el estado que el contrato 0069 ya declaraba
y sigue igual; darselos es una spec chica aparte que nadie pidio.

- **`DELETE /api/loyalty-program`** — cierra el programa (`closeProgram`). Cuerpo
  `{ earningEndsAt?, redemptionEndsAt? }`. `200 { "ok": true }`, o `{ "error": "<español>" }`
  con el status que trae el `LoyaltyError` del dominio (o `503` si no es uno).
- **`PATCH /api/loyalty-program`** — solo `{ "action": "cancel-close" }` (otro valor,
  `422`). `200 { "ok": true }`, o `{ "error": "<español>" }` igual que arriba.

Las dos usan `OWNER_MESSAGES` (`route.ts:55-58`): `notOwner: "Solo el owner puede cerrar o
reabrir el programa."`, `emailNotVerified: "Verificá tu email para gestionar el
programa."`.

**Por remision, las otras superficies del dominio `loyalty` que comparten el mismo
alcance de permiso** (spec 0086 §1: `loyalty` abre las 4 rutas de aca mas estas 3),
todas migradas a la escalera de PERMISOS del §1 de esta tabla (con o sin el paso 4 segun
corresponda):

| Ruta | Guard | Nota |
|---|---|---|
| `GET /api/loyalty-program/qr` | `requireApiPermissionSinGateDeEmail`, alcance `loyalty` | sin paso 4 (spec 0075/0086); contrato completo (formatos, `content-disposition`, `no_program`/`qr_unavailable`) en `0069-contratos-de-api.md` §5 |
| `POST /api/loyalty-program/stamp-upload` | `requireApiPermission`, alcance `loyalty` | con paso 4 |
| `GET /api/loyalty-terms/templates` | `requireApiPermission`, alcance `loyalty` | con paso 4; contrato completo en `0081-contratos-de-api.md` §7 |

## 5. Procedencia: que consolida esta spec y por que manda

Este anexo **consolida y corrige** —no reemplaza como documento historico— el contrato del
dominio `loyalty` repartido hasta ahora en 7 anexos:

- `0069-contratos-de-api.md` — el wizard de alta; declaraba que las 4 rutas respondian
  SIN `code` (ya no es cierto para `GET`/`PUT` desde la 0079/0086).
- `0072-contratos-de-api.md` — los 5 `code` del gate del owner y su orden (base de
  `requireApiOwner`, que `DELETE`/`PATCH` siguen usando entero).
- `0078-contratos-de-api.md` — la forma de una clausula de terminos (no cambia).
- `0079-contratos-de-api.md` — el cuerpo de `PUT` (§2-3, VIGENTE, remitido en §2 de aca) y
  la tabla de 8 `code` de `PUT` (§4, **desactualizada** en su 403: decia `not_owner`,
  corregido en §2 de aca a `not_member`/`missing_permission` para el guard).
- `0081-contratos-de-api.md` — el bloque `accrual` y las plantillas de terminos (no
  cambia).
- `0084-contratos-de-api.md` — tours de onboarding, sin relacion directa con este dominio
  mas alla de compartir convenciones.
- `0086-contratos-de-api.md` — el cambio de contrato que este anexo aplica: `not_owner`
  desaparece de las diez superficies delegables (§7), `GET`/`PUT` de este dominio entre
  ellas.

**Ante una discrepancia futura entre este anexo y cualquiera de los 7 de arriba, este es
el vigente por fecha (2026-09-26).** Los 7 quedan como registro historico de la decision
que tomaron en su momento — no se editan.

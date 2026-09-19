---
spec: 0079
fecha: 2026-09-19
estado: anexo
resumen: Contrato normativo de la UNICA ruta de escritura del programa despues de la spec 0079 — `PUT /api/loyalty-program`, que acepta `kind: points | stamps`, cuerpo corto o completo (todo lo que el servidor puede completar con seguridad es opcional; el bloque de dinero de Puntos es obligatorio) y emite los 8 `code` estables. Declara tambien lo que se BORRO (`POST /api/onboarding/program`) y lo que queda afuera (`cashback`/`tiers`, y el `GET`/`DELETE`/`PATCH` sin `code`). Es el insumo de quien construye la UI del panel y la pantalla 3 del alta: el arco entrega API, no pantallas.
---

# 0079 — Contrato de API: la única ruta de escritura del programa

> **Este documento es un entregable, no documentacion opcional** (ADR 0070 §16). El arco
> del alta entrega API y endpoints, **no interfaz**: la UI la construye el owner por fuera
> y este archivo es su insumo. La spec 0079 **no toca un solo `.tsx`**.
>
> Todo lo que dice esta **medido contra el codigo y contra la rama Neon de integracion el
> 2026-09-19**, no inferido. Donde un comportamiento sea un limite de hoy y no una
> decision, se dice.

## Convenciones

Las mismas de `0072-`, `0074-` y `0078-contratos-de-api.md`: base
`https://www.checkpass.club` (el apex hace **308**), `content-type: application/json`,
cookie de sesion de better-auth, **ningun identificador de negocio viaja en el cuerpo**
(ADR 0070 §15.3) y todo fallo responde `{ "error": "<español>", "code": "<estable>" }`
donde **el `code` es el contrato** y el `error` es copia.

---

## 0. Lo que se BORRO

**`POST /api/onboarding/program` ya no existe.** Escribia el mismo programa con el mismo
writer (`saveProgram`) que `PUT /api/loyalty-program`, y **dos puertas sobre un writer es
exactamente lo que produjo el bypass de la spec 0077 y, antes, el del eje `status` en la
0072**: un invariante puesto en una puerta no esta en la otra.

Quien le pegaba a esa ruta con `{ target, reward }` ahora manda el **cuerpo corto** de §2 a
`PUT /api/loyalty-program`. La equivalencia, lado a lado:

```jsonc
// ANTES — POST /api/onboarding/program
{ "target": 8, "reward": { "type": "custom", "label": "Café gratis" } }

// AHORA — PUT /api/loyalty-program
{
  "kind": "stamps",
  "configuration": { "target": 8 },
  "rewards": [{ "type": "custom", "label": "Café gratis" }]
}
```

Los `code` y los status son los mismos, y la respuesta tambien:
`{ "programId": "<uuid>", "created": true|false }`, con **201** si creo y **200** si
edito.

## 1. La ruta y su guard

```
PUT /api/loyalty-program
```

Es la **unica** escritura del programa. Su guard es `requireApiOwnerSinGateDeEmail`:
**pasos 1, 2 y 4 del ADR 0073 §1 —sesion, owner activo y el eje `status`— sin el paso 3**,
el del email verificado.

**ESO NO AFLOJA NADA, y es el punto entero del ADR 0076.** Desde la spec 0077 el gate del
email **no vive en la puerta**, vive en `saveProgram`, que distingue:

| Situacion | Resultado |
|---|---|
| **CREAR** el primer programa, sin email verificado | **permitido** — es el paso 3 del alta, y una cuenta nueva llega ahi con `email_verified = false` por construccion (ADR 0070 §11) |
| **EDITAR** uno existente, sin email verificado y sin permiso de alta vigente | **403 `email_not_verified`**, y la fila **no se toca** |
| **EDITAR** con email verificado **o** con el permiso de alta vigente | permitido |

Poner el paso 3 en esta puerta volveria inalcanzable el alta; sacarlo del writer reabriria
el bypass. Con esta spec, **las rutas sin paso 3 son exactamente DOS** —esta y
`GET /api/loyalty-program/qr` (spec 0075)—, y el conjunto esta aseverado como **cerrado**
en `api-owner-surfaces.test.ts`.

**`GET`, `DELETE` y `PATCH` de esta misma ruta NO cambian:** conservan `requireApiOwner`
con el gate de email entero, y **siguen sin emitir `code`** (declarado y afuera, §5).

## 2. El cuerpo: lo que el servidor puede completar es opcional

**El principio del contrato, y es lo unico que hay que recordar: todo lo que el servidor
puede completar con seguridad es OPCIONAL; lo que no puede —el dinero— es OBLIGATORIO.**

| Campo | Sellos (`kind: "stamps"`) | Puntos (`kind: "points"`) |
|---|---|---|
| `kind` | **obligatorio** | **obligatorio** |
| `configuration.target` | **obligatorio**, entero 2..50 | no aplica |
| `configuration.unitName` / `unitPlural` | opcional → `"sello"` / `"sellos"` (**ver el par, abajo**) | no aplica |
| `configuration.unitSingular` / `unitPlural` | no aplica | **obligatorios**, string no vacio |
| `rewards` | **obligatorio**, exactamente **1**, sin `pointsCost` | **obligatorio**, 1..20, cada uno con `pointsCost` entero > 0 |
| `accrual` | opcional → `{ "mode": "per_purchase", "grant": 1, "blockAmount": null }` | **OBLIGATORIO** |
| `clauses` | opcional → las semillas del pais del negocio (spec 0078) | idem |
| `stampAction` | opcional → `"keep"` | opcional → `"keep"` (otro valor es 422) |
| `cardDesign` | opcional | **prohibido** (422) |
| `redeemAllowInsufficient` | opcional, boolean estricto → `false` | idem |

### Por que `accrual` es obligatorio en Puntos

`validateAccrual` fuerza `per_amount` para Puntos (`loyalty-program/accrual.ts:22-27`), y
`per_amount` exige un `blockAmount > 0`: **un monto de dinero**. «Un sello por compra» es
la unica lectura posible de la pregunta del alta; **«X puntos por cada $Y» no tiene default
seguro y el servidor no lo inventa**. Faltando, **422 `invalid_program`** y **cero
escrituras**.

### El par de la unidad de Sellos se completa JUNTO

`unitName` y `unitPlural` son **un** default, no dos. Si el cuerpo trae `unitName`, la
`configuration` viaja tal cual: un cuerpo que nombra su unidad («visita») y omite el plural
conserva el comportamiento anterior a la 0079 —`renderedTerms` cae al singular— en vez de
recibir «sellos», que seria el plural de **otra** unidad en el texto legal que ve el
consumidor.

### Compatibilidad hacia atras

**Un cuerpo completo de hoy sigue siendo valido y da el mismo resultado**: todos los campos
opcionales nuevos ya venian puestos, y el compositor **solo rellena huecos** — no pisa ni
un campo explicito.

### `clauses: []` no es lo mismo que omitir `clauses`

Omitirlo pide las semillas del pais. Mandarlo **vacio** es un pedido explicito de un
programa sin terminos, y responde **422** «Añade al menos una cláusula de términos.».

### Ejemplos

```jsonc
// Sellos, cuerpo CORTO (lo que manda el alta)
{
  "kind": "stamps",
  "configuration": { "target": 8 },
  "rewards": [{ "type": "custom", "label": "Café gratis" }]
}

// Puntos, minimo viable: los dos nombres, el dinero y un premio con su costo
{
  "kind": "points",
  "configuration": { "unitSingular": "punto", "unitPlural": "puntos" },
  "accrual": { "mode": "per_amount", "grant": 10, "blockAmount": 5 },
  "rewards": [{ "type": "custom", "label": "Café gratis", "pointsCost": 100 }]
}
```

La forma de una **clausula** (`templateId` **o** `text`), las 5 variables que interpola el
renderizador y el limite del texto libre estan en `0078-contratos-de-api.md` §2 y §3, y
**no cambian**.

## 3. Salida

| Caso | Status | Cuerpo |
|---|---|---|
| Creo el programa | **201** | `{ "programId": "<uuid>", "created": true }` |
| Edito el existente | **200** | `{ "programId": "<uuid>", "created": false }` |

## 4. Los 8 `code`

| Status | `code` | Cuando |
|---|---|---|
| 400 | `invalid_body` | el cuerpo no es JSON parseable |
| 401 | `unauthorized` | sin sesion |
| 403 | `not_owner` | la sesion no es owner **activo** del negocio |
| 403 | `email_not_verified` | **edicion** sin email verificado ni permiso de alta vigente (spec 0077) |
| 403 | `business_suspended` / `business_closed` | el eje `status` del negocio (spec 0072) |
| 409 | `program_exists` | programa en cierre, o cambio de modalidad sin cerrar el actual |
| 422 | `invalid_program` | cualquier fallo de validacion, incluida una modalidad no habilitada |
| 503 | `program_unavailable` | base caida, o **semillas de terminos ausentes** (no se escribe nada) |

`suspensionReason` viaja en los 403 del eje `status`, donde `apiOwnerFailureResponse` ya lo
pone (`0072-contratos-de-api.md`).

**Detalle del mecanismo, medido, por si alguien lo apoya en el futuro:** los tres primeros
403 no salen todos del mismo lugar. `not_owner`, `business_suspended` y `business_closed`
los emite el **guard** (paso 2 y paso 4) via `apiOwnerFailureResponse`; `email_not_verified`
lo emite el **writer** y llega a la respuesta por el `error.code ??` de la 0072. Sin ese
`??`, el mapeo por status traduciria ese 403 a `not_owner` y le mentiria al cliente sobre
por que lo frenaron.

## 5. Lo que NO entra, declarado

- **`cashback` y `tiers`.** Estan en el CHECK del esquema pero **no** en `enabledKinds`
  (`loyalty-program/validation.ts:11-12`): habilitarlas es trabajo de **dominio**, no de
  contrato (ADR 0076 §6). Responden **422** con el mensaje «Esta modalidad todavía no está
  disponible.». *(El `code` es `invalid_program`, igual que cualquier otro 422: quien
  quiera distinguir esta causa tiene que mirar el `error`. Es un limite de hoy.)*
- **`GET` / `DELETE` / `PATCH` de `/api/loyalty-program` siguen sin `code`.** Es el estado
  que el contrato 0069 ya declara; darselos es una spec chica aparte y nadie lo pidio.
- **El QR** (`GET /api/loyalty-program/qr`) conserva el guard de la 0075, sin cambios.
- **Ninguna pantalla.** La pantalla 3 del alta y el panel avanzado los construye el owner
  con este contrato.

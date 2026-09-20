---
spec: 0081
fecha: 2026-09-19
estado: anexo
resumen: Contrato normativo de «un sello (o N puntos) cada $X» y del TOS que lo nombra, para quien construya la pantalla 3 por fuera. El monto por unidad NO estrena endpoint: viaja en el `accrual` del `PUT /api/loyalty-program` que ya existe (spec 0079), se guarda en `accrual_mode`/`accrual_grant`/`accrual_block_amount`, y el texto legal cambia con el modo elegido porque el TOS resuelve una SEGUNDA plantilla de acumulacion (`earning_per_amount`). Omitir `accrual` sigue dando «un sello por compra», asi que la pantalla puede no preguntar nada. Declara ademas el DTO nuevo de `GET /api/loyalty-terms/templates` (trae `jurisdictionScope` y solo los scopes del pais del negocio), las doce variables que el TOS interpola, y los limites de hoy.
---

# 0081 — Contrato de API: el monto por unidad y las variables del TOS

> **Este documento es un entregable, no documentacion opcional** (ADR 0070 §16). El arco del
> alta entrega API y endpoints, **no interfaz**: la UI la construye el owner por fuera y este
> archivo es su insumo. La spec 0081 **no toca un solo `.tsx`**.
>
> **Decision textual del owner (2026-09-19):** *«el API en la pantalla 3 puede pasar el valor
> para que lo uses en el TOS y ademas queda guardado. TU NO TOCAS UI, dejas documentada el api
> para que sepa ChatGPT que puede enviar y como enviarlo para que luego GPT decida si vamos a
> armar una pantalla o no»*.
>
> Todo lo que dice esta **medido contra el codigo y contra la rama Neon de integracion el
> 2026-09-19**, no inferido. Donde un comportamiento sea un limite de hoy y no una decision,
> se dice.

## Convenciones

Las mismas de `0072-`, `0074-`, `0078-` y `0079-contratos-de-api.md`: base
`https://www.checkpass.club` (el apex hace **308**), `content-type: application/json`, cookie
de sesion de better-auth, **ningun identificador de negocio viaja en el cuerpo** (ADR 0070
§15.3) y todo fallo responde `{ "error": "<español>", "code": "<estable>" }` donde **el `code`
es el contrato** y el `error` es copia.

---

## 1. NO HAY ENDPOINT NUEVO

**«Un sello cada $X» se manda por la ruta que ya existe:**

```
PUT /api/loyalty-program
```

Es la **unica** escritura del programa desde la spec 0079, y su contrato completo —guard,
cuerpo corto vs completo, los 8 `code`, la salida— esta en
**`docs/specs/0079-contratos-de-api.md`**. Este documento agrega **un solo bloque del cuerpo**
(`accrual`) y describe su efecto en el texto legal.

Lo que **no** hace falta: ni una ruta nueva, ni una migracion de esquema, ni un campo nuevo.
Las columnas `accrual_mode` / `accrual_grant` / `accrual_block_amount` existen desde la spec
0036 y el validador ya acepta los dos modos en Sellos.

## 2. El bloque `accrual`

```jsonc
"accrual": {
  "mode": "per_amount" | "per_purchase",
  "grant": 1,                 // entero > 0
  "blockAmount": "5.00"       // solo en per_amount
}
```

| Campo | Tipo | Reglas |
|---|---|---|
| `mode` | string | `"per_amount"` («N unidades cada $X») o `"per_purchase"` («N unidades por compra»). **Puntos SOLO acepta `per_amount`**; Sellos acepta los dos |
| `grant` | entero | **`> 0`**. Cuantas unidades se otorgan por bloque |
| `blockAmount` | string o numero | **obligatorio y `> 0` en `per_amount`**; **prohibido en `per_purchase`** (se acepta `null`, ausente o `""`). Es un `numeric(12,2)`: maximo **`9999999999.99`**, y se **normaliza a dos decimales** (`20` → `"20.00"`). Se puede mandar como numero (`5`) o como string (`"5.00"`): las dos formas terminan en el mismo valor |

**LA MONEDA NO VIAJA EN EL CUERPO.** Sale de `core.business.currency_code` (ISO-4217, `NOT
NULL`, default `USD`), que se fija al crear el negocio. Mandar una moneda en el cuerpo **no
tiene efecto**: es la misma regla que el pais (spec 0078).

### El cuerpo completo de «un sello cada $5»

```json
{
  "kind": "stamps",
  "configuration": { "target": 10 },
  "rewards": [{ "type": "custom", "label": "Café gratis" }],
  "accrual": { "mode": "per_amount", "grant": 1, "blockAmount": "5.00" }
}
```

→ **201** (o **200** si ya habia programa) con `{ "programId": "<uuid>", "created": true|false }`.

### «X puntos cada $Y» (Puntos)

```json
{
  "kind": "points",
  "configuration": { "unitSingular": "punto", "unitPlural": "puntos" },
  "rewards": [{ "type": "custom", "label": "Café gratis", "pointsCost": 100 }],
  "accrual": { "mode": "per_amount", "grant": 10, "blockAmount": "1.00" }
}
```

En Puntos el bloque **es obligatorio**: el servidor no inventa dinero (spec 0079 §2).

### OMITIR `accrual` SIGUE ANDANDO — y es lo que hace la pantalla de hoy

```json
{
  "kind": "stamps",
  "configuration": { "target": 8 },
  "rewards": [{ "type": "custom", "label": "Café gratis" }]
}
```

El servidor completa `{ "mode": "per_purchase", "grant": 1, "blockAmount": null }`: **«un
sello por compra»**. O sea que **la pantalla 3 puede no preguntar nada y nada se rompe** — es
la compatibilidad hacia atras de la 0079, y esta pinneada por un test.

**En Puntos NO se completa nunca:** un cuerpo de Puntos sin `accrual` da **422
`invalid_program`** y **no escribe una sola fila**.

## 3. Lo que queda GUARDADO

| Columna de `core.loyalty_program` | De donde |
|---|---|
| `accrual_mode` | `accrual.mode` |
| `accrual_grant` | `accrual.grant` |
| `accrual_block_amount` | `accrual.blockAmount`, `numeric(12,2)` (`null` en `per_purchase`) |
| `terms_markdown` / `terms_hash` | el TOS ya renderizado, con el monto y la moneda adentro |

`GET /api/loyalty-program` devuelve el `accrual` guardado. El `terms_markdown` es una
**columna del programa**, no un join: una vez emitido, **ningun cambio de plantilla lo
reescribe**.

## 4. Los `code` del rechazo, y sus mensajes exactos

**Todo fallo de mecanica es 422 `invalid_program`** — es el limite que declaro la 0079: quien
quiera distinguir la causa tiene que leer el `error`. Los mensajes literales de
`validateAccrual`:

| Caso | `error` |
|---|---|
| `accrual` ausente, no objeto, o un array | `Define la mecánica de acumulación.` |
| `mode` distinto de los dos validos | `El modo de acumulación no es válido.` |
| Puntos con `per_purchase` | `Los Puntos se acumulan siempre por monto de compra.` |
| `grant` no entero o `<= 0` | `La cantidad otorgada debe ser un entero mayor que 0.` |
| `per_purchase` **con** `blockAmount` | `El modo por compra no lleva monto por bloque.` |
| `per_amount` con `blockAmount` no numerico o `<= 0` | `El monto por bloque debe ser un número mayor que 0.` |
| `blockAmount` mayor que `9999999999.99` | `El monto por bloque es demasiado grande.` |

Los demas `code` de la ruta (401, 403, 409, 503) **no cambian**: `0079-contratos-de-api.md` §4.

## 5. EL EFECTO EN EL TEXTO LEGAL, por modo

El TOS del programa **cambia con el modo que elija el comerciante**, y eso es lo que la
pantalla tiene que saber: no es una preferencia de calculo, es el documento que firma el
consumidor.

| `accrual.mode` | Clausula de acumulacion que se resuelve | Lo que dice |
|---|---|---|
| `per_purchase` | `earning` | «Los **sellos** se acumulan únicamente conforme a las acciones elegibles comunicadas por **<negocio>**…» — **sin monto** |
| `per_amount` | **`earning_per_amount`** | «Se otorgan **<grant> <plural>** por cada **<monto> <moneda>** de compra registrada en **<negocio>**…» |

La segunda clausula del TOS del alta es siempre `redemption`. La eleccion es **automatica**:
la pantalla no manda ningun `templateId` y no elige plantilla.

**Por que son dos plantillas y no una con un hueco:** el renderer tira **422** cuando el valor
de una variable es **vacio**, no solo cuando no esta permitida. Una `earning` unica que
nombrara el monto **romperia todo programa `per_purchase`** — que es el que crea el cuerpo
corto. Es un limite del renderer, medido, no una preferencia de estilo.

## 6. Las doce variables que el TOS interpola

Quien escriba una plantilla (o la revise) puede contar con estas y solo con estas. Nombre en
minusculas con `_`, entre `{{ }}`:

| Variable | Valor | Siempre presente? |
|---|---|---|
| `business_legal_name` | el nombre del negocio | si |
| `business_locations` | los nombres de los locales `active`, `", "` | **NO**: ausente sin locales `active` |
| `business_address` | las direcciones de los locales `active`, `", "` | **NO**: idem |
| `country_code` | el ISO-2 del negocio | si |
| `currency_code` | el ISO-4217 del negocio | si |
| `program_kind` | el literal crudo `stamps` / `points` | si |
| `program_kind_label` | **`Sellos` / `Puntos`**, en castellano | si |
| `program_name` | Sellos: el singular; Puntos: el plural (compatibilidad) | si |
| `program_unit_singular` | «sello» / «punto» | si |
| `program_unit_plural` | «sellos» / «puntos» | si |
| `program_accrual_grant` | `accrual.grant` | si |
| `program_accrual_block_amount` | `accrual.blockAmount` | **NO**: ausente en `per_purchase` |

**LAS TRES ADVERTENCIAS QUE IMPORTAN, todas medidas:**

1. **Una variable cuyo valor es vacio —o que no se emite— es un 422 que IMPIDE GUARDAR el
   programa**, no un hueco en el texto. Ausente y vacia son **indistinguibles** para el
   renderer. Por eso **ninguna plantilla del alta nombra las variables de local**: un negocio
   sin sucursales cargadas no podria crear su programa.
2. **El allowlist esta EN LA FILA de la plantilla** (`variables_allowlist`). Una variable que
   el texto usa pero el allowlist no permite es 422, con el mensaje
   `La variable {{x}} no está permitida.`
3. **Una clausula de TEXTO LIBRE no admite variables**: su allowlist es vacio, asi que
   cualquier `{{x}}` en un TOS personalizado es 422. Limite declarado desde la 0078.

## 7. `GET /api/loyalty-terms/templates` — el DTO cambio

```
GET /api/loyalty-terms/templates
→ 200 { "templates": [ { id, title, category, jurisdictionScope, templateMarkdown, version } ] }
```

Dos cambios, los dos para que un panel pueda elegir sin adivinar:

- **`jurisdictionScope` entra al DTO.** Antes los titulos se repetian («Cómo se acumula» ×3) y
  **no habia forma de distinguir las filas** salvo comparando markdown.
- **Solo devuelve los scopes candidatos del negocio de la sesion** (`<PAIS>` y `default`). Un
  negocio EC ve las de `EC` + `default`; uno MX ve **solo** `default`.

**Y el scope `global-draft` ya no existe como opcion:** sus 3 filas quedaron `archived` en la
migracion `0039`, asi que ni se listan ni se pueden usar. Era el camino directo al texto
deprecado «Los sello se acumulan…».

Su guard y sus `code` **no cambian** (declarado afuera, igual que la 0079 con
`GET`/`DELETE`/`PATCH` del programa).

## 8. Lo que NO entra, declarado

- **Ninguna pantalla.** Este contrato existe para que la UI se construya por fuera.
- **`business_legal_name` lleva el nombre COMERCIAL, no la razon social.** No hay columna de
  razon social en `core.business`. Para un TOS eso puede no alcanzar: es **decision del
  owner** y cuesta una migracion que no pidio.
- **La direccion de la EMPRESA no existe:** `business_address` son las direcciones de sus
  **locales**. Si un negocio no cargo locales, no hay direccion que poner.
- **`renderedTerms` no valida que el `templateId` pertenezca al scope del negocio.** Archivar
  `global-draft` cierra el caso reportado, no la clase entera: un panel que mande el
  `templateId` de una plantilla publicada de **otro pais** sigue siendo aceptado.
- **Ningun `code` propio para «modalidad no disponible»** ni para las causas de mecanica:
  todas son `invalid_program` (limite de la 0079).

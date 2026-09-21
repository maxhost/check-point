---
spec: 0083
fecha: 2026-09-20
estado: anexo
resumen: Contrato normativo de `GET /api/onboarding/checklist` para quien construya la UI del onboarding por fuera. Un endpoint de LECTURA con CINCO items (ADR 0078 §1): `verify-email` y los cuatro TOURS —staff, catalogo, programa, marca—. La API dicta `position`, `required` y `done`, y la UI no tiene lista propia de pasos. **`required` es UN SOLO eje** (enmienda de la spec 0085, decision del owner): «hay que hacerlo, y mientras no este `done` los de `position` mayor estan bloqueados», y `verify-email` es el unico. NO emite `email_not_verified` en ningun camino —se gatearia a si mismo— y ese es el punto del endpoint; el bloqueo SI se hace cumplir, pero en la ruta de escritura de los tours. El texto viaja con `locale: "es"` fijo y declarado, y el `anchor` es una CLAVE estable que la UI mapea a un elemento, nunca un selector ni una coordenada. **El tutorial NO es un endpoint** (ADR 0078 §4): sus pasos los define la UI con su libreria de tours y por HTTP viaja solo el ESTADO.
---

# 0083 — Contrato de API: el checklist del onboarding

> **Este documento es un entregable, no documentacion opcional** (ADR 0070 §16). El arco del
> alta entrega API y endpoints, **no interfaz**: la UI la construye el owner por fuera y este
> archivo es su insumo. La spec 0083 **no toca un solo `.tsx`**.
>
> **Decision textual del owner (2026-09-20):** *«no son la misma api o endpoint a pesar de que
> son de la misma familia onboarding, pero uno es el checklist es decir lo que hay que hacer y
> en que estado esta y el otro es un tutorial»*.
>
> Todo lo que dice esta **medido contra el codigo el 2026-09-20**, no inferido. Donde un
> comportamiento sea un limite de hoy y no una decision, se dice.

## Convenciones

Las mismas de `0072-`, `0074-`, `0078-`, `0079-` y `0081-contratos-de-api.md`: base
`https://www.checkpass.club` (el apex hace **308**), `content-type: application/json`, cookie
de sesion de better-auth, **ningun identificador de negocio viaja en el cuerpo** (ADR 0070
§15.3) y todo fallo responde `{ "error": "<español>", "code": "<estable>" }` donde **el `code`
es el contrato** y el `error` es copia.

---

## 1. El endpoint

```
GET /api/onboarding/checklist
```

Lectura pura. No recibe cuerpo, no recibe query params, no escribe nada.

### Respuesta `200`

```jsonc
{
  "locale": "es",
  "items": [
    {
      "id": "verify-email",        // ESTABLE. Es la clave del contrato.
      "position": 1,               // Orden. Lo dicta la API, no la UI.
      "required": true,            // HAY QUE HACERLO, y bloquea a los de position mayor.
      "done": false,               // El hecho, derivado del servidor.
      "anchor": "verify-email",    // CLAVE, no selector. La UI la mapea a un elemento.
      "title": "…",                // Copia. NO es contrato.
      "body": "…"                  // Copia. NO es contrato.
    },
    { "id": "staff",   "position": 2, "required": false, "done": false, "anchor": "staff",   "title": "…", "body": "…" },
    { "id": "catalog", "position": 3, "required": false, "done": true,  "anchor": "catalog", "title": "…", "body": "…" },
    { "id": "program", "position": 4, "required": false, "done": false, "anchor": "program", "title": "…", "body": "…" },
    { "id": "brand",   "position": 5, "required": false, "done": false, "anchor": "brand",   "title": "…", "body": "…" }
  ]
}
```

**Son CINCO items** (ADR 0078 §1): `verify-email` y los cuatro TOURS de pantalla. Los cuatro
ids de tour son los mismos que acepta `POST /api/onboarding/tours/{tourId}`
(`0084-contratos-de-api.md`) — **no hay dos listas**.

**`items` viene ordenado por `position` ascendente.** La UI no reordena.

### `required` es UN SOLO eje, y dice las dos cosas

**Enmienda de la spec 0085 (2026-09-20).** Este contrato declaraba DOS campos —`required` y uno
que separaba «hay que hacerlo» de «frena a los que siguen»—. **El segundo se borro**: el owner
pregunto por que habia dos y la respuesta medida es que no hay dos. Con los cinco items reales
los dos ejes **nunca divergen**, y ninguna UI consumia el campo todavia.

| Campo | Que afirma | Que tiene que hacer la UI |
|---|---|---|
| `required` | **Hay que hacerlo**, y **mientras no este `done` los items de `position` mayor estan bloqueados** (palabras del owner: *«sin eso no se puede hacer nada mas»*) | Marcarlo como obligatorio, **no** ofrecer «saltar este paso», y deshabilitar lo que viene despues hasta que este `done` |

**`verify-email` es el UNICO `required: true`.** Los cuatro tours son `required: false`: se
pueden saltear —es una decision explicita del owner (ADR 0078 §2)— y no traban a nadie.

**La API lo REPORTA *y* lo HACE CUMPLIR, y ya no es una pregunta abierta.** La version anterior
de este contrato decia que rechazar acciones de un item bloqueado era *«una decision que no esta
tomada, y se toma cuando haya un segundo item»*. **Ya hay cinco, y la decision esta tomada: es
que SI.** `POST /api/onboarding/tours/{tourId}` —la escritura de los cuatro items que siguen—
lleva el gate de email y contesta **403 `email_not_verified`** mientras `verify-email` no este
`done`. Ese 403 es el bloqueo hecho cumplir, no reportado. Lo que NO lo hace cumplir es **este**
endpoint, que se gatearia a si mismo (§2).

### Lo que la UI puede dar por estable, y lo que no

| Campo | ¿Contrato? |
|---|---|
| `id`, `anchor` | **Si.** Son claves. Sobre ellas se construye el mapa de hotspots |
| `position`, `required`, `done` | **Si.** Son el estado |
| `title`, `body` | **No.** Es copia y va a cambiar sin aviso. No aseverar sobre su texto |
| `locale` | **Si**, pero hoy es siempre `"es"` — ver §4 |

---

## 2. LO QUE ESTE ENDPOINT NO EMITE, Y ES EL PUNTO

**`GET /api/onboarding/checklist` NUNCA devuelve `403 email_not_verified`.**

No es un olvido: un endpoint cuyo PRIMER item —y el unico obligatorio— dice «verifica tu
email» **no puede estar bloqueado por no haber verificado el email**, o se gatea a si mismo y el owner nunca ve la
instruccion que vino a buscar. Es el mismo argumento que sostiene el 200-siempre de
`GET /api/merchant/session` (`0074-contratos-de-api.md` §1).

Concretamente: **un owner recien salido del wizard, con el email sin verificar, recibe `200`**
con sus cinco items, el primero en `done: false`. Ese es el caso principal del endpoint, no un borde.

### Los `code` de fallo

| Status | `code` | Cuando |
|---|---|---|
| **401** | `unauthorized` | No hay sesion |
| **403** | `not_owner` | Hay sesion pero no es owner con membresia `active` (p. ej. un integrante) |
| **403** | `business_suspended` | El negocio esta suspendido. Trae ademas **`suspensionReason`** cuando hay motivo — **camelCase, es la clave que serializa `apiOwnerFailureResponse`** y la convencion declarada en `0072-contratos-de-api.md`. (La primera version de esta fila decia `reason`, que es el nombre del campo INTERNO del guard y **nunca** viaja por HTTP.) |
| **403** | `business_closed` | El negocio esta cerrado |
| **503** | `onboarding_unavailable` | Fallo de base |

Los cuatro primeros salen de `API_OWNER_CODES`, los mismos que ya usan las otras 10
superficies de owner: **no hay `code` nuevo que aprender.**

**Por que un integrante recibe `not_owner` y no un checklist vacio:** el staff **no tiene email
al que escribirle** — su direccion sintetica termina en `@staff.invalid` y
`POST /api/merchant/auth/verify-email` la rechaza con `400 invalid_email`. Un checklist que le
llegara le pediria verificar una casilla que no existe.

---

## 3. El `anchor` es una clave, no una coordenada

El item trae `anchor: "verify-email"`. **La API no sabe nada de DOM**: no manda selectores, ni
clases, ni coordenadas, ni orden de elementos en pantalla.

**La UI mantiene el mapa** `anchor → elemento real`. Si mañana el boton de verificar se mueve
de lugar, cambia de forma o se rediseña la pantalla entera, **se toca el mapa de la UI y la API
no se entera**.

Esto es deliberado (ADR 0077 §3): si la API guardara coordenadas, un rediseño dejaria hotspots
apuntando a elementos que ya no existen, **y eso no pone rojo a nada en CI** — aparece en
produccion y no avisa.

**Regla para la UI:** ante un `id` que no conoce, **listarlo sin tour, nunca fallar**. El dia
que la API gane un item, la UI ya desplegada tiene que seguir funcionando.

---

## 4. Limites de HOY, declarados

**Esto es estado actual medido el 2026-09-20, no una decision.**

| Lo que no hay | Evidencia | Que hacer mientras tanto |
|---|---|---|
| **Eleccion de idioma** | **No hay columna de idioma del merchant en ninguna tabla.** `core.terms_template` y `otp_delivery` tienen `locale` (este con `CHECK in ('es','pt','en')`), pero no hay de donde sacar el del owner | `locale` viene **siempre `"es"`**. Leerlo igual: el dia que haya un segundo idioma, el campo ya esta y la UI no cambia de contrato |
| **Los pasos del tour** | **No existen por HTTP y no van a existir** (ADR 0078 §4): los define la UI con su libreria de tours | **Ver §5.** No esperar un segundo endpoint ni meter los pasos adentro de este JSON |
| **Saber si un tour se completo o se salteo** | El JSON dice `done: boolean` y nada mas. La distincion **se persiste** (`0084-contratos-de-api.md`) pero no se serializa | Tratar los dos igual. Es lo que el owner decidio (ADR 0078 §2) |
| **Cualquier escritura de onboarding** | Este endpoint es de lectura pura | El paso se completa con la accion de su dominio — para el email, `POST /api/merchant/auth/verify-email` (contrato en `0067-contratos-de-api.md` §7) |

---

## 5. EL TUTORIAL NO ES UN ENDPOINT — por HTTP viaja solo el ESTADO

El onboarding tiene **dos niveles**, y por la API viaja **uno solo**:

1. **El checklist** — «que hay que hacer y en que estado esta». Es lo de este documento.
2. **El tutorial de cada item** — «toca aca → abri la camara → saca la foto y espera a la IA».

**Enmienda de la spec 0085 (ADR 0078 §4).** La version anterior de esta seccion anunciaba un
segundo endpoint, `GET /api/onboarding/<el id del item>`, que serviria los pasos del tutorial.
**Ese endpoint no existe y no va a existir.** Si alguien esta construyendo la UI contra la
version vieja de este documento, esto es lo unico que cambia para el.

**Por que se mato:** el contenido de un tour son componentes de una libreria en el CLIENTE, no
JSON del servidor. El ADR 0078 §5 eligio `driver.js` despues de medir tres librerias sobre
nuestro Next en un iPhone 13. Un endpoint que devolviera «pasos» tendria que describir la
pantalla —selectores, orden, textos— y eso **es** la UI: cada rediseño romperia el tour en
produccion sin poner rojo a nadie en CI, que es exactamente lo que el `anchor` de §3 evita.

**Lo que la API SI sirve de los tours, y es todo lo que necesita la UI:**

| Que | Donde |
|---|---|
| **Leer** si un tour esta hecho | El `done` de su item en **este** `GET` |
| **Escribir** que se completo o se salteo | `POST /api/onboarding/tours/{tourId}` — contrato en `0084-contratos-de-api.md` |

**`completed` y `skipped` proyectan los DOS `done: true`**, y el JSON de este endpoint **no
dice cual de los dos fue**. La distincion se guarda en la base (el owner pidio conservar
«cuantos saltearon») pero no viaja: el contrato de la UI es `done: boolean` y no hay que
modelar un tercer estado.

**Lo que se le pide a quien construya la UI:** mantener los pasos de cada tour del lado del
cliente, junto al mapa `anchor → elemento` de §3. Lo unico que se le pregunta al servidor es
si el item esta hecho, y lo unico que se le avisa es cuando se termino o se salteo.

---

## 6. Tabla de bolsillo

| Ruta | Metodo | Gate | Status posibles | ¿Emite `email_not_verified`? |
|---|---|---|---|---|
| `/api/onboarding/checklist` | `GET` | sesion + owner activo + negocio operativo · **SIN gate de email** | 200 · 401 · 403 · 503 | **NO, nunca** |

Para comparar con las vecinas de la misma familia:

| Ruta | Para que | ¿Gate de email? |
|---|---|---|
| `/api/merchant/session` | Quien soy y en que negocio | No — **200 siempre** |
| `/api/onboarding/state` | Que falta para terminar **el wizard** | No — corre antes de verificar |
| `/api/onboarding/checklist` | Que falta **despues** del wizard | **No**, y §2 explica por que |

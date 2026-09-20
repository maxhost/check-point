---
spec: 0083
fecha: 2026-09-20
estado: anexo
resumen: Contrato normativo de `GET /api/onboarding/checklist` para quien construya la UI del onboarding por fuera. Un endpoint de LECTURA con un solo item (`verify-email`); la API dicta `position`, `required` y `blocking` —dos ejes SEPARADOS: «hay que hacerlo» no es lo mismo que «frena a los que siguen»— y la UI no tiene lista propia de pasos. NO emite `email_not_verified` en ningun camino —se gatearia a si mismo— y ese es el punto del endpoint. El texto viaja en la respuesta con `locale: "es"` fijo y declarado, y el `anchor` es una CLAVE estable que la UI mapea a un elemento, nunca un selector ni una coordenada. Declara ademas el recurso que NO existe todavia: el tutorial paso-a-paso de cada item es un SEGUNDO endpoint, y sus pasos no van adentro de este.
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
      "required": true,            // HAY QUE HACERLO. No se puede ignorar ni saltar.
      "blocking": true,            // Mientras no este done, los de position mayor se bloquean.
      "done": false,               // El hecho, derivado del servidor.
      "anchor": "verify-email",    // CLAVE, no selector. La UI la mapea a un elemento.
      "title": "…",                // Copia. NO es contrato.
      "body": "…"                  // Copia. NO es contrato.
    }
  ]
}
```

**`items` viene ordenado por `position` ascendente.** La UI no reordena.

### `required` y `blocking` son DOS ejes, no uno

Es la parte del contrato mas facil de colapsar por error, asi que va explicita:

| Campo | Que afirma | Que tiene que hacer la UI |
|---|---|---|
| `required` | **Hay que hacerlo.** Es obligatorio, no algo que el merchant pueda ignorar | Marcarlo como obligatorio; **no** ofrecer «saltar este paso» |
| `blocking` | **Mientras no este `done`, los items de `position` mayor no se pueden hacer** | Deshabilitar lo que viene despues |

Son **independientes**. Un item puede ser obligatorio y **no** frenar al resto (hay que
hacerlo, pero mientras tanto se puede avanzar con otra cosa), y puede frenar al resto **sin**
ser obligatorio.

**Hoy los dos valen `true`** en el unico item, porque asi lo dicto el owner para el email
(*«sin esto no desbloqueas nada de lo que sigue»*). **No leer uno por el otro:** el dia que
aparezca un item que sea solo una de las dos cosas, una UI que los haya tratado como sinonimos
se comporta mal y nadie lo va a ver hasta que un merchant se trabe.

**La API los REPORTA; no los hace cumplir.** Con un solo item no hay un «siguiente» que
bloquear. Si la API ademas debe **rechazar** acciones de un item bloqueado es una decision que
**no esta tomada**, y se toma cuando haya un segundo item.

### Lo que la UI puede dar por estable, y lo que no

| Campo | ¿Contrato? |
|---|---|
| `id`, `anchor` | **Si.** Son claves. Sobre ellas se construye el mapa de hotspots |
| `position`, `required`, `blocking`, `done` | **Si.** Son el estado |
| `title`, `body` | **No.** Es copia y va a cambiar sin aviso. No aseverar sobre su texto |
| `locale` | **Si**, pero hoy es siempre `"es"` — ver §4 |

---

## 2. LO QUE ESTE ENDPOINT NO EMITE, Y ES EL PUNTO

**`GET /api/onboarding/checklist` NUNCA devuelve `403 email_not_verified`.**

No es un olvido: un endpoint cuyo unico item hoy es «verifica tu email» **no puede estar
bloqueado por no haber verificado el email**, o se gatea a si mismo y el owner nunca ve la
instruccion que vino a buscar. Es el mismo argumento que sostiene el 200-siempre de
`GET /api/merchant/session` (`0074-contratos-de-api.md` §1).

Concretamente: **un owner recien salido del wizard, con el email sin verificar, recibe `200`**
con su item en `done: false`. Ese es el caso principal del endpoint, no un borde.

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
| **El tutorial paso-a-paso** | No existe ningun endpoint de guide | **Ver §5.** No meter los pasos del tour adentro de este JSON |
| **Mas de un item** | El catalogo tiene **una** entrada | No construir una barra «3 de 5» que asuma varios. Derivarla del largo de `items` |
| **Cualquier escritura de onboarding** | Este endpoint es de lectura pura | El paso se completa con la accion de su dominio — para el email, `POST /api/merchant/auth/verify-email` (contrato en `0067-contratos-de-api.md` §7) |

---

## 5. EL TUTORIAL ES OTRO RECURSO, Y TODAVIA NO EXISTE

El onboarding tiene **dos niveles**, y este endpoint sirve **solo el primero**:

1. **El checklist** — «que hay que hacer y en que estado esta». Es lo de este documento.
2. **El tutorial de cada item** — «toca aca → abri la camara → saca la foto y espera a la IA».

**No se sirven juntos, y no es una decision de comodidad** (ADR 0077 §1): el item sobrevive a
cualquier rediseño de pantalla, mientras que el tutorial **es** la descripcion de una pantalla
concreta y cambia cada vez que esa pantalla cambia. Ademas el checklist se pide en **cada**
carga del backoffice y un tutorial se abre **una vez**: bajarlos juntos paga el peso de todos
los tours en cada pantalla, que es exactamente lo que no se quiere en movil.

Cuando exista, el tutorial va a ser un segundo endpoint con esta forma:

```
GET /api/onboarding/guide/{itemId}
```

**Hoy no existe ninguno**, porque el unico item —`verify-email`— es una accion de un toque y no
necesita tour. El primero va a llegar con la feature de catalogo o la de staff, y **su forma se
decide ahi**, con un ejemplo real a la vista.

**Lo que se le pide a quien construya la UI ahora:** no modelar los pasos del tour como parte
del item del checklist. Cuando llegue el segundo endpoint, un tour embebido en este JSON hay
que desarmarlo.

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

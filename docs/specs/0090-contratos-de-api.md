---
spec: 0090-contratos
fecha: 2026-09-21
estado: cerrada
resumen: Contrato normativo de la IMPORTACION DE CATALOGO para quien construya la pantalla por fuera. Las rutas de `/api/catalog/imports/*` —reservar, re-firmar, analizar, consultar, cancelar— abiertas al owner SIEMPRE y al integrante con el permiso `catalog`. **Actualizado por la spec 0091 (ADR 0084): la importacion ESCRIBE el catalogo sola y es siempre aditiva**; se borraron el borrador, `PUT /draft`, `POST /accept` y el estado `ready`, y el DTO perdio `draft` y gano `result`. El proceso sigue siendo asincrono: se sube, se pide el analisis, se cierra la pantalla, y `GET /api/catalog/imports` devuelve el ULTIMO import (abierto o terminal) para retomarlo. **Actualizado otra vez por la spec 0092 (ADR 0085 y 0086): NO hay aviso por email —la funcion se elimino entera—, y mientras hay un import ABIERTO el alta manual de catalogo devuelve `409 catalog_import_in_progress`, con `GET /api/catalog` sumando `importInProgress` para que la pantalla lo refleje.** Un precio que no se puede leer crea el producto SIN precio, nunca en cero; un item ilegible se descarta y se lista. Ninguna respuesta incluye claves de R2, ids del proveedor, tokens, costo ni la extraccion cruda.
disjunta: no
archivos: apps/merchant/src/app/api/catalog/imports
---

# 0090 — Contrato de API: importacion de catalogo desde imagen o PDF

**Para quien construye la pantalla.** Nada de aca se deduce del codigo: si una respuesta no esta
descrita, no la inventes — pregunta. La feature la implementan
`specs/0090-importacion-de-catalogo-desde-imagen-o-pdf.md` y
`specs/0091-la-importacion-de-catalogo-escribe-directo.md` (ADR 0084); **este archivo es el unico
insumo que la UI necesita.**

> **Cambio del 2026-09-23 (spec 0091 / ADR 0084).** La importacion **escribe el catalogo sola**:
> no hay borrador, ni revision, ni aceptacion. Se borraron `PUT /api/catalog/imports/{id}/draft` y
> `POST /api/catalog/imports/{id}/accept` —hoy devuelven **404 por inexistencia de la ruta**—, el
> estado `ready` y los `code` `catalog_import_version`, `catalog_import_conflict`,
> `unresolved_catalog_import` e `invalid_catalog_draft`. El DTO perdio `draft` y gano `result`.

## 0. Quien puede

Todas las rutas de `/api/catalog/imports/*` pasan por el mismo guard que el resto de
`/api/catalog/*`:

- **El owner, siempre.**
- **El integrante con el permiso `catalog`.** Los permisos llegan en
  `GET /api/merchant/session` → `permissions: string[]` (para un owner vienen los siete).
- Cualquier otro: **403**.

La escalera de rechazos, con su `code` estable (contrato 0086):

| | Situacion | HTTP | `code` |
|---|---|---|---|
| 1 | sin sesion | 401 | `unauthorized` |
| 2 | sesion sin membresia activa del negocio | 403 | `not_member` |
| 3 | membresia sin el permiso `catalog` | 403 | `missing_permission` |
| 4 | **owner** con email sin verificar (al integrante no se le aplica) | 403 | `email_not_verified` |
| 5 | negocio suspendido / cerrado | 403 | `business_suspended` / `business_closed` |

**Todo error de estas rutas tiene la misma forma:** `{ "error": "copy en espanol", "code":
"estable" }`. El `code` es para la UI; el `error` es para mostrar.

## 1. El modelo mental, y es lo que hay que entender antes de dibujar

**El analisis es asincrono y eso es a favor.** El merchant sube, pide el analisis, **puede cerrar la
pantalla** y seguir con lo suyo: el import es un recurso del servidor, no un estado de React. Al
volver se consulta y se retoma donde estaba. **No hay ningun aviso: ni email, ni push** (ADR
0085 — el aviso por email existio hasta el 2026-09-23 y se elimino). El merchant se entera al
volver al catalogo, que es donde iba a ir igual: `GET /api/catalog/imports` devuelve el ultimo
import con su `result`, asi que la pantalla que vuelve encuentra el resumen sin ayuda de nadie.

**Un analisis termina en catalogo o en `failed`.** No hay paso intermedio que revisar: el servidor
concilia contra el catalogo actual, crea lo que falta y **nunca actualiza ni borra nada** (ADR 0084
§1). Importar dos veces el mismo PDF es seguro por construccion.

**Hay como maximo UN import ABIERTO por negocio.** Eso es lo que hace que «al volver, retomar» sea
trivial: no hay que elegir entre varios. Los terminales no cuentan para eso, pero **el ultimo si se
devuelve** en `GET /api/catalog/imports`, para que un reload no pierda el resultado.

Los estados que la UI va a ver, y que significan para la pantalla:

| `status` | Que mostrar | Que se puede hacer |
|---|---|---|
| `pending_upload` | «subiendo archivos» | subir a las URLs firmadas; despues llamar a `analyze` |
| `queued` | «en cola» (dura segundos) | esperar; cancelar |
| `analyzing` | «analizando tu menu» | esperar; cancelar |
| `accepted` | el `result`: «se crearon N productos en M categorias» | cerrar y recargar el catalogo |
| `failed` | el `error` saneado | empezar de nuevo (crea otro import) |
| `cancelled` / `expired` | nada, se descarta | empezar de nuevo |

`ready` **ya no existe**: ningun import queda esperando una decision humana. Si ves ese valor, es
una fila vieja anterior al 2026-09-23.

**Cadencia de consulta sugerida:** cada 3 s mientras el estado sea `queued` o `analyzing`, y
**parar al salir de esos dos**. No hace falta poll agresivo: el analisis normal tarda decenas de
segundos, y al que se fue lo cubre el `GET` de la proxima visita, no un aviso.

## 1.bis Lo minimo que la pantalla tiene que hacer para no trabar al merchant

Tres cosas. Ninguna es opcional, y las tres salen de mirar la pantalla que ya existe:

1. **Al abrir el modal, llamar primero a `GET /api/catalog/imports`.** Devuelve **el ultimo
   import del negocio, terminal incluido**. Si esta `accepted`, mostrar su `result`; si esta
   abierto, retomarlo en su estado. Sin esto, un merchant que cerro el modal **pierde el
   resultado** de la importacion que ya pago.
2. **El boton «Cancelar» deberia llamar a `DELETE`**, no solo cerrar el modal. Si no lo hace, el
   servidor se las arregla: un import abandonado **antes** de pedir el analisis se descarta solo en
   el siguiente `POST`. Un import ya `accepted` **no se puede cancelar**: cancelar no es deshacer.
3. **No hardcodear los limites** (1-10 archivos, 10 MB, 250 productos, el cupo diario): son
   configuracion del servidor. La pantalla valida lo que quiera para dar un mensaje rapido, pero la
   autoridad es la respuesta.

**La pantalla actual manda UN archivo y la API acepta hasta 10.** Eso no es un desajuste: el dia que
mande cinco fotos de un menu de cinco hojas, el servidor ya lo soporta y el orden de las paginas es
el orden del array `files`.

## 2. `POST /api/catalog/imports` — reservar y pedir las URLs de subida

**Regla que no se deduce: o UN PDF o SOLO imagenes. Nunca mezcla.**

Cuerpo:

```json
{ "files": [{ "name": "menu-1.heic", "contentType": "image/heic", "byteSize": 6240123 }] }
```

**201:**

```jsonc
{
  "import": { "id": "uuid", "status": "pending_upload", "expiresAt": "2026-09-22T18:00:00.000Z" },
  "uploads": [{
    "fileId": "uuid",
    "url": "https://…firmada…",
    "method": "PUT",
    "headers": { "content-type": "image/heic" }
  }]
}
```

La URL firmada **expira pronto** y hay que mandar **exactamente** el `content-type` que vino en
`headers`. El orden de `uploads` corresponde al orden de `files`: **ese es el orden de las paginas**.

Limites: **1-10 imagenes**, 10 MB cada una, 50 MB en total; **o un PDF** de hasta 20 MB y **10
paginas**. Formatos: JPEG, PNG, WebP, HEIC/HEIF, PDF.

| HTTP | `code` | Cuando |
|---|---|---|
| 400 | `invalid_import_files` | lista vacia, mezcla PDF+imagenes, mas de 10, formato no aceptado |
| 413 | `catalog_import_too_large` | un archivo o el total pasan el tope |
| 409 | `catalog_import_in_progress` | ya hay un import **en `queued` o `analyzing`** (hay trabajo pago en vuelo) |
| 429 | `catalog_import_rate_limited` | se agoto el cupo de analisis del dia |

El **429** es el unico error con un campo extra:

```json
{ "error": "…", "code": "catalog_import_rate_limited", "retryAfterSeconds": 43200 }
```

y la ruta manda tambien el header `Retry-After`. El cupo arranca en **un analisis por negocio por
dia** y es un valor de configuracion del servidor: puede cambiar sin que cambie el contrato, asi que
la pantalla **no lo hardcodea** — muestra lo que dice `retryAfterSeconds`.

**Un import abandonado en `pending_upload` NO da 409:** el servidor lo descarta y crea el nuevo, asi
que reabrir el modal y volver a empezar siempre funciona. El 409 aparece **solo cuando hay trabajo
pago en vuelo** (`queued`/`analyzing`): la salida es `GET /api/catalog/imports` y retomar, o
`DELETE` si el merchant decide descartarlo. Un import terminal —`accepted`, `failed`, `cancelled`,
`expired`— **no bloquea nada**.

**Y puede ser de otro integrante**, no necesariamente de quien mira: el copy tiene que decir «ya hay
una importacion en curso», no «tenes una».

### Como se sube cada archivo

Exactamente como las otras tres subidas del backoffice (marca, sello, imagen de producto —
`use-catalog-image.ts:174-178`), asi que el CORS de R2 ya esta resuelto:

```js
await fetch(upload.url, {
  method: "PUT",
  headers: { "content-type": file.type }, // el MISMO que viene en upload.headers
  body: file,                              // el File/Blob crudo, no FormData
});
```

**Sin header de autorizacion** —la firma va en la URL— y **sin headers extra**: cualquier header de
mas invalida la firma. Un `2xx` es exito; cualquier otra cosa se reintenta con la misma URL mientras
no haya vencido.

### `POST /api/catalog/imports/{id}/uploads` — re-firmar si una URL vencio

Las URLs firmadas **duran ~10 minutos**, que en una conexion movil mala con 50 MB puede no alcanzar.
Sin cuerpo; devuelve **200** con las URLs nuevas de los archivos que **todavia no se subieron**:

```jsonc
{ "uploads": [{ "fileId": "uuid", "url": "https://…", "method": "PUT", "headers": { "content-type": "image/heic" } }] }
```

Solo en `pending_upload`; en cualquier otro estado, `409 catalog_import_state`. Si todos los
archivos ya estan subidos devuelve `{ "uploads": [] }`. **Nunca cambia el orden de las paginas.**
Con esto una subida cortada no obliga a empezar el import de cero.

## 3. `POST /api/catalog/imports/{id}/analyze` — confirmar los archivos y arrancar

Sin cuerpo. Se llama **despues** de que los PUT a R2 terminaron.

**202** con el import (`result` todavia en `null`). Es **idempotente**: repetirla en `queued` o
`analyzing` devuelve el estado actual y **no** dispara otro analisis (un reintento de red no cuesta
plata ni duplica trabajo).

**Un fallo es un fallo:** si el analisis no sale, el import queda en `failed` y el merchant vuelve a
empezar desde subir el archivo. El servidor **no re-submitea** un analisis por su cuenta.

| HTTP | `code` | Cuando |
|---|---|---|
| 404 | `catalog_import_not_found` | no existe, **o es de otro negocio** (indistinguible a proposito) |
| 409 | `catalog_import_state` | el import ya es terminal |
| 413 | `catalog_import_too_large` | lo subido no coincide con lo reservado |
| 422 | `unsupported_catalog_file` | los bytes no son lo declarado, o el PDF no se puede leer |
| 422 | `catalog_pdf_encrypted` | PDF protegido |
| 422 | `catalog_page_limit` | el PDF tiene mas de 10 paginas |

## 4. `GET /api/catalog/imports/{id}` — estado y resultado

Es la ruta del poll y la de **retomar** al volver a la pantalla.

**200:**

```jsonc
{
  "import": {
    "id": "uuid",
    "status": "accepted",
    "sourceKind": "images",          // "images" | "pdf"
    "fileCount": 3,
    "pageCount": 3,
    "expiresAt": "2026-09-22T18:00:00.000Z",
    "result": {                       // objeto SOLO en `accepted`; en el resto, null
      "categoriesCreated": 12,
      "categoriesReused": 2,
      "productsCreated": 86,
      "productsSkipped": 4,
      "productsWithoutPrice": 3,
      "discardedCount": 4,
      "discarded": [{ "text": "Milanesa …", "reason": "unreadable_name" }]
    },
    "error": null                     // en `failed`: { "code": "...", "message": "..." }
  }
}
```

**La lista es cerrada, y son esos ocho campos.** No viajan —ni van a viajar— las claves de R2, el id
del trabajo del proveedor, el request id, los tokens, el costo ni **la extraccion cruda del
modelo**.

### `GET /api/catalog/imports` — el ultimo import, para retomar

**Sin `id`.** Devuelve **200** con `{ "import": null }` si el negocio nunca importo, o con **el
ultimo import —abierto o terminal— en la misma forma de arriba**. Es la primera llamada que conviene
hacer al abrir la pantalla: es lo que hace que un reload despues de importar no pierda el `result`.

Nunca devuelve el import de otro negocio.

### El `result`, campo por campo

| Campo | Que es |
|---|---|
| `categoriesCreated` | categorias que no existian y se crearon |
| `categoriesReused` | categorias del menu que **ya existian** y se reusaron |
| `productsCreated` | productos nuevos, ya escritos en el catalogo |
| `productsSkipped` | productos del menu que **ya existian en su categoria** y se omitieron |
| `productsWithoutPrice` | de los creados, cuantos nacieron **sin precio** |
| `discardedCount` | items que **no se pudieron leer** y quedaron afuera (el total) |
| `discarded` | los primeros **50** de esos items, con `{ text, reason }` |

`reason` es `"unreadable_name"` (el nombre quedo vacio o supera 120 caracteres) o `"invalid_row"`
(la fila no cumple el esquema). `text` es lo que se vio, saneado y recortado a 120 caracteres.

**`productsWithoutPrice > 0` es un buen momento** para decirle «3 productos quedaron sin precio,
podes completarlos cuando quieras». **`discardedCount > 0`** es el listado de lo que hay que cargar
a mano.

## 5. Como escribe el servidor, y por que no hay nada que revisar

La importacion es **siempre aditiva** (ADR 0084 §1):

- crea las categorias que no existen y **reusa** las que existen;
- crea los productos que no existen **dentro de su categoria**;
- **omite** los que ya existen ahi;
- **nunca** actualiza nombre, precio, costo, imagen, disponibilidad ni categoria de algo existente;
- **nunca** borra nada.

Un precio distinto en el documento **no** es un pedido de actualizacion: el producto ya existe, se
omite y listo.

La conciliacion es por **clave canonica** —sin acentos, en minusculas, puntuacion y separadores a
espacio, espacios colapsados—: «Coca-Cola» = «coca cola», pero **«Hamburguesa» ≠ «Hamburguesa
doble»**. No es fuzzy matching. Dos «Agua» en categorias distintas son dos productos legitimos y se
crean los dos.

**El precio lo decide el servidor, no el modelo.** El proveedor devuelve el texto impreso; el
servidor lo parsea con una regla unica: el ultimo separador seguido de **exactamente dos** digitos
es el decimal y cualquier otro es de miles. Si el texto no parsea sin ambiguedad —un rango como
`3-5`, un signo, «consultar»— el producto nace con **`unit_price` null, NUNCA `0`**. Un cero seria
un precio falso con cara de valido; un producto sin precio es inofensivo, porque el mostrador se lo
pide al operador.

Los productos nacen **disponibles en todos los locales**, sin precio de costo y sin imagen.

## 6. Las dos rutas que se BORRARON

`PUT /api/catalog/imports/{id}/draft` y `POST /api/catalog/imports/{id}/accept` **ya no existen**:
responden **404 por inexistencia de la ruta**, sin `code` del dominio. No hay dos pasos, hay uno.

Con ellas se fueron cuatro `code` de la lista cerrada de §0:
`catalog_import_version`, `catalog_import_conflict`, `unresolved_catalog_import` e
`invalid_catalog_draft`. Una pantalla que los programe esta programando contra un contrato muerto.

**La idempotencia sigue siendo del servidor:** el resultado de un analisis se escribe una sola vez
aunque el callback del proveedor llegue dos veces, y el `GET` devuelve siempre el mismo `result`.

## 7. `DELETE /api/catalog/imports/{id}` — cancelar

**200** siempre que se pueda cancelar, y **repetirlo tambien da 200**. Tambien en `analyzing`
pasa inmediatamente al terminal `cancelled`; un resultado tardio del proveedor se descarta porque
los writers solo aceptan imports abiertos. La UI puede cerrar la pantalla en el momento.

`accepted` responde `409 catalog_import_already_accepted`, y **eso no es un error que haya que
arreglar: cancelar NO es deshacer.** Lo que la importacion creo se borra desde el catalogo, producto
por producto.

**Cancelar nunca toca el catalogo**: no borra nada.

## 7.bis Mientras se importa, el alta manual del catalogo esta BLOQUEADA

**No es una ruta de `/imports`, pero la pantalla del catalogo la ve** (ADR 0086, spec 0092).

Mientras el negocio tiene un import **abierto** (`pending_upload`, `queued`, `analyzing`,
`ready`), estas dos rutas responden **409**:

| Ruta | Respuesta con un import abierto |
|---|---|
| `POST /api/catalog/category` | `409 { "error": "Estamos importando tu menu. …", "code": "catalog_import_in_progress" }` |
| `POST /api/catalog/product` | idem |

**Editar, renombrar y borrar NO se bloquean** (`PUT`/`DELETE` de producto y categoria): el writer
de la importacion es estrictamente aditivo y no compite con ellos. Un import `accepted`, `failed`,
`cancelled` o `expired` **no bloquea nada**, y el bloqueo es **por negocio**: el import abierto de
otro negocio no toca a este.

**El `code` de este 409 es la excepcion del dominio catalogo**, que no tiene lista cerrada de
codigos: el resto de sus errores sigue respondiendo `{ "error": "…" }` **sin** clave `code`. Por
eso la pantalla tiene que leer `code === "catalog_import_in_progress"` y no el texto.

**Para reflejarlo sin una segunda llamada, `GET /api/catalog` suma un booleano:**

```json
{ "products": [...], "categories": [...], "locations": [...],
  "currencyCode": "USD", "importInProgress": true }
```

Es **un booleano y nada mas**: ni el id del import, ni su estado, ni la extraccion. Y **no es el
guard** — deshabilitar el boton es cortesia; la proteccion es el 409. Dos requests exactamente
simultaneas siguen pudiendo cruzarse, y por eso el servidor conserva su recuperacion del 23505.

## 8. Lo que esta spec NO decide

- **El diseno.** Copy, layout, orden de los pasos y como se ven los avisos son del owner.
- **El aviso de privacidad.** Que el archivo se procesa con un proveedor externo de IA **lo escribe
  la UI** (ADR 0082 §12). El servidor no lo emite.
- **Cualquier notificacion.** El servidor **no avisa por ningun canal** cuando la importacion
  termina: ni email (ADR 0085 lo elimino) ni push (ADR 0082 §12 ya lo dejaba afuera).
- **La precision del modelo.** Que tan bien lee un menu torcido se mide con el corpus del ADR 0082
  §2, no se promete acá. **Un precio mal leido con confianza alta entra al catalogo**: es un riesgo
  aceptado por el owner (ADR 0084) y se corrige editando el producto.
- **Deshacer una importacion.** No existe, y no esta previsto.

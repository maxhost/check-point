---
spec: 0090-contratos
fecha: 2026-09-21
estado: cerrada
resumen: Contrato normativo de la IMPORTACION DE CATALOGO para quien construya la pantalla por fuera. Las rutas de `/api/catalog/imports/*` —reservar, re-firmar, analizar, consultar, guardar el borrador, aceptar, cancelar— abiertas al owner SIEMPRE y al integrante con el permiso `catalog`. El proceso es asincrono por diseno: se sube, se pide el analisis, se cierra la pantalla y al volver se retoma el import activo; el servidor avisa por email. **DOS estados de precio y ninguno bloquea**: un `ambiguous` nace con `unit_price` null y el merchant lo completa despues. El `accept` no lleva cuerpo y su idempotencia la resuelve el servidor, no el cliente. Ninguna respuesta incluye claves de R2, ids del proveedor, tokens ni costo.
disjunta: no
archivos: apps/merchant/src/app/api/catalog/imports
---

# 0090 — Contrato de API: importacion de catalogo desde imagen o PDF

**Para quien construye la pantalla.** Nada de aca se deduce del codigo: si una respuesta no esta
descrita, no la inventes — pregunta. La feature la implementa
`specs/0090-importacion-de-catalogo-desde-imagen-o-pdf.md`; **este archivo es el unico insumo que
la UI necesita.**

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
volver se consulta y se retoma donde estaba. Cuando el borrador queda listo, **el servidor le manda
un email** — la pantalla no tiene que quedarse abierta para que el trabajo termine.

**Hay como maximo UN import no terminal por negocio.** Eso es lo que hace que «al volver, retomar»
sea trivial: no hay que elegir entre varios.

Los estados que la UI va a ver, y que significan para la pantalla:

| `status` | Que mostrar | Que se puede hacer |
|---|---|---|
| `pending_upload` | «subiendo archivos» | subir a las URLs firmadas; despues llamar a `analyze` |
| `queued` | «en cola» (dura segundos) | esperar; cancelar |
| `analyzing` | «analizando tu menu» | esperar; cancelar |
| `ready` | la pantalla de revision | editar el borrador; aceptar; cancelar |
| `accepted` | «listo, N productos creados» | cerrar y recargar el catalogo |
| `failed` | el `error` saneado | empezar de nuevo (crea otro import) |
| `cancelled` / `expired` | nada, se descarta | empezar de nuevo |

**Cadencia de consulta sugerida:** cada 3 s mientras el estado sea `queued` o `analyzing`, y
**parar al salir de esos dos**. No hace falta poll agresivo: el analisis normal tarda decenas de
segundos y el email cubre al que se fue.

## 1.bis Lo minimo que la pantalla tiene que hacer para no trabar al merchant

Tres cosas. Ninguna es opcional, y las tres salen de mirar la pantalla que ya existe:

1. **Al abrir el modal, llamar primero a `GET /api/catalog/imports`.** Si devuelve un import, hay
   que retomarlo en su estado (si esta en `ready`, mostrar la revision). Sin esto, un merchant que
   cerro el modal con un borrador listo **no puede volver a el** y encima gasto su analisis del dia.
2. **El boton «Cancelar» deberia llamar a `DELETE`**, no solo cerrar el modal. Si no lo hace, el
   servidor se las arregla: un import abandonado **antes** de pedir el analisis se descarta solo en
   el siguiente `POST`. Pero uno ya analizado **no** se descarta en silencio — ver el punto 1.
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
| 409 | `catalog_import_in_progress` | ya hay un import **en `queued`, `analyzing` o `ready`** |
| 429 | `catalog_import_rate_limited` | se agoto el cupo de analisis del dia |

El **429** es el unico error con un campo extra:

```json
{ "error": "…", "code": "catalog_import_rate_limited", "retryAfterSeconds": 43200 }
```

y la ruta manda tambien el header `Retry-After`. El cupo arranca en **un analisis por negocio por
dia** y es un valor de configuracion del servidor: puede cambiar sin que cambie el contrato, asi que
la pantalla **no lo hardcodea** — muestra lo que dice `retryAfterSeconds`.

**Un import abandonado en `pending_upload` NO da 409:** el servidor lo descarta y crea el nuevo, asi
que reabrir el modal y volver a empezar siempre funciona. El 409 aparece cuando hay trabajo real en
vuelo (`queued`/`analyzing`) o **un borrador terminado que seria una lastima tirar** (`ready`): en
los tres casos la salida es `GET /api/catalog/imports` y retomar, o `DELETE` si el merchant decide
descartarlo.

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

**202** con el import sin borrador. Es **idempotente**: repetirla en `queued`, `analyzing` o `ready`
devuelve el estado actual y **no** dispara otro analisis (un reintento de red no cuesta plata ni
duplica trabajo).

| HTTP | `code` | Cuando |
|---|---|---|
| 404 | `catalog_import_not_found` | no existe, **o es de otro negocio** (indistinguible a proposito) |
| 409 | `catalog_import_state` | el import ya es terminal |
| 413 | `catalog_import_too_large` | lo subido no coincide con lo reservado |
| 422 | `unsupported_catalog_file` | los bytes no son lo declarado, o el PDF no se puede leer |
| 422 | `catalog_pdf_encrypted` | PDF protegido |
| 422 | `catalog_page_limit` | el PDF tiene mas de 10 paginas |

## 4. `GET /api/catalog/imports/{id}` — estado y borrador

Es la ruta del poll y la de **retomar** al volver a la pantalla.

**200:**

```jsonc
{
  "import": {
    "id": "uuid",
    "status": "ready",
    "sourceKind": "images",          // "images" | "pdf"
    "fileCount": 3,
    "pageCount": 3,
    "expiresAt": "2026-09-22T18:00:00.000Z",
    "draft": { "version": 1, "categories": [], "warnings": [] },
    "error": null                     // en `failed`: { "code": "...", "message": "..." }
  }
}
```

**La lista es cerrada.** No viajan —ni van a viajar— las claves de R2, el id del trabajo del
proveedor, el request id, los tokens, el costo ni la respuesta cruda del modelo.

### `GET /api/catalog/imports` — el import activo, para retomar

**Sin `id`.** Es como la pantalla retoma despues de un reload sin guardar nada en el cliente:
devuelve **200** con `{ "import": null }` si no hay ninguno en curso, o con el unico no terminal en
**la misma forma de arriba** (incluido su `draft` si ya esta en `ready`). Es la primera llamada que
conviene hacer al abrir la pantalla de importacion.

### La forma del borrador

```jsonc
{
  "version": 3,
  "categories": [{
    "draftId": "c1",
    "name": "Bebidas calientes",
    "resolution": { "kind": "create" },
    "duplicateCandidate": { "categoryId": "uuid", "name": "Bebidas calientes" },
    "products": [{
      "draftId": "p1",
      "name": "Cappuccino",
      "unitPrice": "3.25",            // string decimal, o null
      "priceStatus": "detected",      // "detected" | "ambiguous"
      "sourceText": "Cappuccino $3,25",
      "include": true,
      "duplicateCandidate": null
    }]
  }],
  "warnings": ["La pagina 2 estaba borrosa."]
}
```

**El precio es un string decimal, no un numero** (`"3.25"`), o `null`. Mandarlo como numero es un
422: la plata en este repo no pasa por el punto flotante.

**Dos `priceStatus`, y ninguno bloquea:**

- **`detected`** — el modelo leyo el precio. Viene en `unitPrice` como string decimal.
- **`ambiguous`** — **no hay precio confiable**: o el menu no lo dice, o el modelo no pudo confirmar
  lo que vio (el caso `$3,50` vs `$35,00`). `unitPrice` es **`null`** y `sourceText` trae lo que
  vio, para que el merchant decida.

**Se puede aceptar con precios ambiguos.** Esos productos nacen **sin precio** —`null`, nunca `0`— y
el merchant los completa despues en el catalogo, que es lo mismo que pasa si carga un producto a
mano sin precio. La pantalla **puede** marcarlos y mostrar un contador («N productos sin precio»),
pero **no tiene que impedir nada**: el `accept` devuelve cuantos fueron.

**Duplicados:** `duplicateCandidate` es **un aviso, no una seleccion**. Nunca se resuelve solo.

- Producto: `include: false` lo descarta; `include: true` **crea uno nuevo** aunque haya candidato.
- Categoria, por `resolution.kind`:
  - `create` — crea una categoria nueva.
  - `use_existing` — requiere `categoryId`; los productos van a la categoria que ya existe.
  - `uncategorized` — los productos incluidos nacen sin categoria.
  - `discard` — **exige** que cada producto de esa categoria este `include:false` o reasignado a
    otra categoria del borrador. Si queda uno colgado, aceptar responde `409
    unresolved_catalog_import`: **nunca se pierde un producto en silencio.**

## 5. `PUT /api/catalog/imports/{id}/draft` — guardar la revision

Solo en `ready`. El cuerpo es **el borrador completo** mas su `version`:

```jsonc
{ "version": 3, "categories": [ /* … */ ], "warnings": [] }
```

Devuelve **200** con el borrador guardado y su `version` **incrementada**. Guarda esa version: la
siguiente escritura la necesita.

| HTTP | `code` | Cuando |
|---|---|---|
| 409 | `catalog_import_version` | tu `version` no es la actual (alguien mas guardo). **Relee con el `GET` y avisale al usuario antes de pisar.** |
| 409 | `catalog_import_state` | el import ya no esta en `ready` |
| 422 | `invalid_catalog_draft` | nombre vacio o largo (producto 120, categoria 60), precio negativo o mal formado, mas de 250 productos, `categoryId` de otro negocio, resolucion invalida |
| 404 | `catalog_import_not_found` | no existe o es de otro negocio |

No hace falta guardar en cada tecla: alcanza guardar antes de aceptar, o cada tanto.

## 6. `POST /api/catalog/imports/{id}/accept` — crear todo

**Sin cuerpo.** Acepta el borrador tal como esta guardado en el servidor. Si la pantalla edito y
guardo con el `PUT`, puede mandar `{ "version": 3 }` para que el servidor verifique que acepta
exactamente lo que vos viste; es **opcional**.

**201** la primera vez, y **200 con el mismo resultado** si se llama de nuevo:

```json
{
  "result": {
    "importId": "uuid",
    "categoriesCreated": 2,
    "productsCreated": 18,
    "productsWithoutPrice": 3
  }
}
```

**Un doble clic no crea el catalogo dos veces, y la pantalla no tiene que hacer nada para eso:** el
servidor toma el import bajo llave y, si ya esta aceptado, devuelve el mismo resultado guardado. No
hay ninguna clave que el cliente tenga que generar ni recordar.

Es **todo o nada**: si algo falla, no queda medio catalogo. Los productos nacen **disponibles en
todos los locales**, sin precio de costo y sin imagen.

| HTTP | `code` | Cuando |
|---|---|---|
| 409 | `catalog_import_version` | mandaste `version` y el borrador cambio despues de tu ultimo `PUT` |
| 409 | `unresolved_catalog_import` | queda un producto colgado de una categoria descartada (los precios ambiguos **no** bloquean) |
| 409 | `catalog_import_conflict` | una categoria o producto **aparecio en el catalogo entre la revision y el accept**. Nunca se fusiona en silencio: hay que reabrir la revision |
| 422 | `invalid_catalog_draft` | lo mismo que en el `PUT` |

Al **201**, recarga el catalogo y mostra las cantidades creadas. `productsWithoutPrice > 0` es un
buen momento para decirle «3 productos quedaron sin precio, podes completarlos cuando quieras».

## 7. `DELETE /api/catalog/imports/{id}` — cancelar

**200** siempre que se pueda cancelar, y **repetirlo tambien da 200**. Tambien en `analyzing`
pasa inmediatamente al terminal `cancelled`; un resultado tardio del proveedor se descarta porque
los writers solo aceptan imports abiertos. La UI puede cerrar la pantalla en el momento.

`accepted` responde `409 catalog_import_already_accepted`. **Cancelar nunca toca el catalogo**: no
borra nada de lo que ya existia.

## 8. Lo que esta spec NO decide

- **El diseno.** Copy, layout, orden de los pasos y como se ven los avisos son del owner.
- **El aviso de privacidad.** Que el archivo se procesa con un proveedor externo de IA **lo escribe
  la UI** (ADR 0082 §12). El servidor no lo emite.
- **Notificacion push.** El aviso del servidor es **email**; un push al backoffice es otra feature.
- **La precision del modelo.** Que tan bien lee un menu torcido se mide con el corpus del ADR 0082
  §2, no se promete acá.

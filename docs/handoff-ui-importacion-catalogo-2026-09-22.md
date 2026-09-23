# Handoff — Conectar la PANTALLA de importacion de catalogo con su API

Fecha: 2026-09-22 · Para: quien construye la UI (fuera de este repo de agentes) · Alcance: **solo UI**

## Lo que ya existe y funciona

**La API esta implementada, revisada y su migracion aplicada en la base.** No hay que esperar nada
del servidor: las ocho rutas responden.

```
POST   /api/catalog/imports               GET    /api/catalog/imports
POST   /api/catalog/imports/{id}/uploads  GET    /api/catalog/imports/{id}
POST   /api/catalog/imports/{id}/analyze  PUT    /api/catalog/imports/{id}/draft
POST   /api/catalog/imports/{id}/accept   DELETE /api/catalog/imports/{id}
```

## Que leer — y que NO leer

| archivo | por que |
|---|---|
| **`docs/specs/0090-contratos-de-api.md`** | **EL CONTRATO. Es la unica fuente.** 340 lineas, normativo y autocontenido: las ocho rutas con sus cuerpos, los HTTP, la lista **cerrada** de `code`, la forma del borrador y las tres reglas de pantalla |
| `apps/merchant/src/app/backoffice/catalog/catalog-ai-import.tsx` | el mock visual que ya existe. **Es el punto de partida**, no se empieza de cero |
| `apps/merchant/src/app/backoffice/catalog/use-catalog-image.ts:174-178` | el `PUT` a R2 que **ya funciona** en marca, sello y producto. El CORS ya esta resuelto ahi |

**NO leer `docs/specs/0090-importacion-de-catalogo-desde-imagen-o-pdf.md`.** Es la spec de
implementacion del servidor (lease, reconciliador, webhook, cupo, limpieza). Nada de eso es
contrato, y leerlo solo tienta a acoplar la pantalla a internals que pueden cambiar.

**Si una respuesta no esta descrita en el contrato, no se inventa: se pregunta.**

## Las tres reglas de pantalla que NO son opcionales (contrato §1.bis)

Salen de mirar la pantalla que ya existe, y cada una tapa un agujero real:

1. **Al abrir el modal, lo PRIMERO es `GET /api/catalog/imports`** (sin id). Si devuelve un import,
   hay que retomarlo en su estado — si esta en `ready`, mostrar la revision. Sin esto, un merchant
   que cerro el modal con un borrador listo **no puede volver a el** y encima gasto su analisis del
   dia.
2. **«Cancelar» deberia llamar a `DELETE`**, no solo cerrar el modal. Si no lo hace, el servidor se
   las arregla con uno abandonado **antes** del analisis; pero uno ya analizado **no** se descarta
   en silencio (ver punto 1).
3. **No hardcodear los limites** — 1-10 archivos, 10 MB por archivo, 50 MB total, 250 productos, el
   cupo diario. Son **configuracion del servidor** y cambian sin que cambie el contrato. La pantalla
   puede validar para dar un mensaje rapido, pero **la autoridad es la respuesta**.

## El modelo mental: el analisis es ASINCRONICO, y eso es a favor

El merchant sube, pide el analisis, **puede cerrar la pantalla** y seguir con lo suyo. El import es
un recurso del servidor, no un estado de React. Al volver se consulta y se retoma. Cuando el
borrador queda listo, **el servidor le manda un email**: la pantalla no tiene que quedarse abierta.

**Hay como maximo UN import no terminal por negocio.** Por eso «al volver, retomar» es trivial.

**Cadencia de poll:** cada 3 s mientras el estado sea `queued` o `analyzing`, y **parar al salir de
esos dos**. No hace falta poll agresivo.

## La subida: copiar el patron que ya anda

```js
await fetch(upload.url, {
  method: "PUT",
  headers: { "content-type": file.type }, // el MISMO que viene en upload.headers
  body: file,                              // el File/Blob crudo, NO FormData
});
```

**Sin header de autorizacion** —la firma va en la URL— y **sin headers extra**: cualquier header de
mas **invalida la firma**. Un `2xx` es exito; cualquier otra cosa se reintenta con la misma URL
mientras no haya vencido.

Las URLs firmadas duran **~10 minutos**. Si se vencen, `POST /{id}/uploads` re-firma **solo** los
archivos que faltan, sin cambiar el orden de las paginas.

**El orden del array `files` es el orden de las paginas.** La pantalla actual manda UN archivo y la
API acepta hasta 10: no es un desajuste, el dia que mande cinco fotos de un menu de cinco hojas ya
funciona.

## Dos cosas del borrador que se prestan a error

**El precio es un STRING decimal (`"3.25"`) o `null`. Nunca un number.** Mandarlo como number es un
`422`: la plata de este repo no pasa por punto flotante.

**Hay dos `priceStatus` y NINGUNO bloquea:**

- `detected` — el modelo leyo el precio, viene en `unitPrice`.
- `ambiguous` — **no hay precio confiable** (el menu no lo dice, o el modelo no pudo confirmar si
  era `$3,50` o `$35,00`). `unitPrice` es **`null`** y `sourceText` trae lo que vio.

**Se puede aceptar con precios ambiguos.** Esos productos nacen sin precio —`null`, **nunca `0`**— y
el merchant los completa despues, igual que si cargara un producto a mano sin precio. La pantalla
**puede** marcarlos y mostrar «N productos sin precio» (el `accept` devuelve `productsWithoutPrice`),
pero **no tiene que impedir nada**.

**Duplicados:** `duplicateCandidate` es **un aviso, no una seleccion**. Nunca se resuelve solo.

## Probar en local

La migracion ya esta aplicada, asi que los endpoints responden contra la base real.

```
# apps/merchant/.env.local
CATALOG_EXTRACTION_PROVIDER=fake
```

Con `fake` el arco entero anda **sin clave de OpenAI, sin webhook y sin gastar un centavo**: el
analisis contesta **sincronico** y devuelve un borrador determinista (dos categorias, con **un
precio ambiguo incluido** para que se pueda probar ese caso). Es el modo correcto para construir la
pantalla.

Para el LLM real hace falta `CATALOG_EXTRACTION_PROVIDER=openai` + `OPENAI_API_KEY`, y el resultado
**no llega solo en local** (el webhook apunta a produccion): se levanta pegandole al reconciliador
con el `CRON_SECRET` local, cinco minutos despues del submit. Eso es trabajo del owner, no de la UI.

## Alcance — duro

**Solo UI.** Fuera de alcance, sin excepcion:

- `apps/merchant/src/server/**`
- `apps/merchant/src/app/api/**`
- la migracion y el esquema

Si algo parece exigir tocar el servidor, **es que falta una respuesta en el contrato**: se pregunta,
no se improvisa.

## Lo que decide el OWNER y la UI no puede resolver sola

- **El aviso de privacidad.** Que el archivo se procesa con un proveedor externo de IA **lo escribe
  la pantalla** (ADR 0082 §12). El servidor no lo emite. Es obligatorio que este.
- **El diseno entero**: copy, layout, orden de los pasos, como se ven los avisos.

## Gates antes de dar por cerrada la pantalla

Node 24 (`export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use`), scripts de **root**:

```
pnpm run typecheck
pnpm run lint
pnpm run format:check
pnpm run test
pnpm run build
pnpm exec playwright install chromium && pnpm run test:e2e
```

**`test:e2e` SI aplica acá** y es el unico gate que nadie corre local por costumbre — es el que
puede tumbar `main` despues de un push «con todo verde». Toda pantalla nueva lo lleva.

**Nota sobre `format:check`:** hoy ya esta rojo en **10 archivos** que son WIP de UI del owner
(`backoffice/catalog/*.tsx`, `globals.css`). **No correr `pnpm format`** —reformatea trabajo ajeno—:
formatear solo los archivos propios con `pnpm exec prettier --write <rutas>`.

---
spec: 0035
fecha: 2026-08-14
estado: implementada
resumen: Biblioteca de imágenes de stock gratis para productos vía interfaz `StockPhotoProvider` intercambiable (Pexels primero), server-proxied y anti-SSRF; el owner busca y elige una foto ("Elegir de biblioteca"), se previsualiza desde la URL remota y al guardar el servidor la baja a R2 y persiste la atribución del autor. Extiende la imagen de la spec 0034.
disjunta: no
archivos: apps/merchant (server/stock, catalog/image+products+core, api/catalog/stock/search, backoffice/catalog stock-picker + editor), migración drizzle, tests
---

# 0035 — Imágenes de stock para productos

> **Cerrada con el owner el 2026-08-14** (4 decisiones). Diseño en **ADR 0035**. Extiende la
> imagen de producto de la **spec 0034** (no crea un dominio nuevo de catálogo).

## Problema

Muchos comercios no tienen fotos de sus productos. Hoy la única vía es subir un archivo propio
(spec 0034). Un buscador de stock gratis integrado al editor de producto elimina esa fricción:
buscar → elegir → aplicar, sin salir del form.

## Alcance

**Entra:**

- Botón **"Elegir de biblioteca"** en el editor de producto → **modal** con buscador.
- **Búsqueda** de fotos (input de texto) contra un proveedor de stock, **proxeada por el
  servidor** (la API key nunca va al cliente).
- **Seleccionar** una foto → se previsualiza en el form **desde la URL del proveedor** y se
  muestra la **atribución** ("Foto de Pexels.com · Autor: <nombre>", con enlaces).
- Al **Guardar** (diferido): el servidor resuelve la foto **por id** contra el proveedor, baja
  los bytes (allow-list de host, tope de tamaño, **anti-SSRF**), los procesa con `normalizeImage`
  y los sube a R2 como cualquier upload; persiste la atribución.
- **Interfaz `StockPhotoProvider` intercambiable** (Pexels primero; variante `fake` para
  dev/test). La atribución se muestra también al **reeditar** un producto con imagen de stock.

**No entra:**

- Otros proveedores concretos (Unsplash, …): la interfaz los habilita, no se implementan hoy.
- Stock para **logo de marca / sello**: sólo productos (la interfaz es reutilizable a futuro).
- Edición/recorte de la imagen, favoritos, colecciones, paginación infinita (una página de
  resultados con "cargar más" simple es suficiente).
- Cachear/reindexar resultados en DB: la búsqueda es en vivo contra el proveedor.

## Diseño

La imagen de producto ya viaja **diferida a Guardar**. Se agrega una tercera forma de origen —
además de *subir archivo propio* — : *elegir de biblioteca*. El cliente nunca manda una URL; al
guardar manda `{ imageAction: "stock", provider, photoId }` y el servidor hace el resto
(resolver por id → descargar acotado → `normalizeImage` → R2). El preview sale de la URL remota
mientras se edita y de R2 una vez guardado. La atribución se guarda en columnas de `product` y
se muestra en el form (honra las guías de Pexels: crédito + enlace).

### Especificación técnica

**Proveedor (server).** Módulo `apps/merchant/src/server/stock/*`:
- `provider.ts` — contrato + `getStockProvider()` (por `STOCK_PROVIDER`, default `pexels`;
  `fake` para dev/test) + `StockError`.
  ```ts
  type StockPhoto = { id: string; thumbUrl: string; previewUrl: string;
    author: string; authorUrl: string; sourceUrl: string; width: number; height: number };
  interface StockPhotoProvider {
    id: string;                                   // "pexels"
    search(query: string, page?: number): Promise<StockPhoto[]>;
    resolve(photoId: string): Promise<{ bytes: Buffer; contentType: string;
      author: string; authorUrl: string; sourceUrl: string }>;
  }
  ```
- `pexels.ts` — implementa `search`/`resolve` contra la API de Pexels con `PEXELS_API_KEY`.
  `resolve` obtiene la URL canónica **desde la API por id** y descarga los bytes **sólo si el
  host ∈ allow-list** (`images.pexels.com`), con tope `MAX_LOGO_BYTES`. Sin key → `StockError(503)`.
- `fake.ts` — resultados deterministas + bytes de una imagen mínima local (sin red), para tests.

**Import (server, catálogo).** `server/catalog/image.ts` suma `resolveProductStock({
businessId, provider, photoId })`: `getStockProvider()` (valida que `provider` sea el activo) →
`resolve` → `normalizeImage(bytes)` → `putProductVariants` → devuelve `{ prefix, author,
authorUrl, sourceUrl, source }`. Mismo rollback que el upload.

**Modelo de datos (migración aditiva, `core.product`).**
```text
core.product  (+ columnas, todas nullable)
  image_source      text   -- p.ej. 'pexels'; null si es subida propia
  image_author      text
  image_author_url  text
  image_source_url  text   -- página de la foto en el proveedor
```
`imageAction` del cliente pasa a ser `keep | replace | remove | stock`. En `replace`/`remove`
las 4 columnas se ponen en `null`; en `stock` se setean; en `keep` no se tocan.

**Rutas / acciones.**

| Método · ruta | Entrada | Salida | Errores |
|---|---|---|---|
| `GET /api/catalog/stock/search?q=&page=` | — (sesión owner) | `{ photos: StockPhoto[] }` (sin exponer la key) | 401, 422 (q vacío), 503 (sin proveedor) |
| `POST /api/catalog/product` y `PUT /api/catalog/product/[id]` | `{ …, imageAction: "stock", provider, photoId }` | producto DTO | 401, 404, 422, 503 |

El producto DTO suma `imageSource`, `imageAuthor`, `imageAuthorUrl`, `imageSourceUrl`
(nullable). **Sigue sin serializar `image_object_key`** (allow-list, test anti-fuga por entidad).

**UI.** En `backoffice/catalog`:
- `ProductEditor`: junto al input de archivo, botón **"Elegir de biblioteca"** → abre
  `StockPicker`. Cuando hay imagen de stock seleccionada (o el producto editado la tiene),
  muestra la línea de atribución con enlaces.
- `stock-picker.tsx`: modal con input de búsqueda **on-submit**, grilla de resultados
  (thumb + autor), **"cargar más"** (paginación append), "Aplicar" al elegir y "Cerrar".
- `use-catalog-image.ts`: suma `chooseStock(photo)` → `action: "stock"`, `preview =
  previewUrl` remoto, y expone la atribución; el payload de guardado incluye `provider`+`photoId`.

**Seguridad / aislamiento.** Todas las rutas exigen sesión de owner (`requireOwner`). La
descarga server-side es el único vector nuevo: se acota a resolución por-id + allow-list de host
+ tope de bytes (anti-SSRF). La búsqueda no persiste nada. Aislamiento por `business_id` sin
cambios (la imagen se asocia al producto del owner).

### Arquitectura de referencia

- **ADR 0035** — decisión (esta feature la implementa).
- ADR 0024 — `PEXELS_API_KEY` en env. ADR 0029 — pipeline de imagen R2.
- ADR 0013/0033 — proveedor intercambiable + `fake` por entorno.
- Spec 0034 — catálogo de productos (imagen que esta spec extiende).

## Archivos

| Archivo | Acción |
|---|---|
| `apps/merchant/src/server/stock/{provider,pexels,fake}.ts` | crear |
| `apps/merchant/src/server/catalog/image.ts` | editar (`resolveProductStock`) |
| `apps/merchant/src/server/catalog/{core,validation,products}.ts` | editar (acción `stock`, columnas de atribución, DTO) |
| `apps/merchant/src/server/schema/catalog.ts` | editar (4 columnas de atribución) |
| `apps/merchant/src/app/api/catalog/stock/search/route.ts` | crear |
| `apps/merchant/src/app/backoffice/catalog/{stock-picker.tsx,use-catalog-image.ts,product-editor.tsx,types.ts}` | crear/editar |
| `apps/merchant/src/app/globals.css` | editar (estilos del modal/picker) |
| `apps/merchant/drizzle/**` | crear (migración aditiva) |
| `apps/merchant/src/server/*.test.ts`, `*.neon.integration.test.ts` | crear/editar (unit + integración con `fake`) |
| `docs/INDEX.md`, `docs/TASKS.md` | editar |

### Disjunta?

**No.** Toca archivos de la spec 0034 (`catalog/*`, `product-editor.tsx`, `use-catalog-image.ts`,
`schema/catalog.ts`). Como 0034 ya está implementada y no hay otra spec abierta sobre catálogo,
se implementa en serie sin conflicto.

## Definition of Done

- [x] El owner abre "Elegir de biblioteca", busca, ve resultados y selecciona una foto; el
  preview se muestra desde la URL del proveedor y aparece la atribución "Foto de Pexels.com ·
  Autor: <nombre>" (con enlaces).
- [x] Al Guardar, el servidor baja la foto (por id, host allow-listado, tope de tamaño),
  la procesa y la sube a R2; al reeditar, el preview sale de R2 y la atribución persiste
  (columnas→DTO verificadas en integración; el render R2 real es live-QA con la key).
- [x] La API key nunca se expone al cliente; sin `PEXELS_API_KEY` el buscador responde 503 y la
  subida propia sigue funcionando.
- [x] Reemplazar por una subida propia o quitar la imagen limpia la atribución.
- [x] Ningún endpoint serializa `image_object_key`; el DTO expone atribución + `imagePath`
  (test por entidad).
- [x] `imageAction: "stock"` con `provider`/`photoId` inválidos → 422; provider distinto del
  activo → 422/503. Aislado por `business_id`.
- [x] Format, lint, typecheck, unit, integración Neon (con `fake`) y build pasan; **revisor
  independiente emite PASS**.

## Implementación

Implementada el 2026-08-14 con el protocolo de `AGENT-WORKFLOW.md` (implementador + **revisor
independiente PASS**). Dominio `server/stock/*` (`provider` contrato + factory por
`STOCK_PROVIDER`; `pexels` con **anti-SSRF**: resolución por id + allow-list `images.pexels.com`
+ `redirect: "error"` + tope 5 MB; `fake` sin red). `resolveImageChange` (en `catalog/image.ts`)
unifica keep/replace/remove/**stock** con rollback R2 y borrado diferido; 4 columnas de
atribución en `core.product` (migración **`0018_swift_mockingbird`**), DTO las expone y **sigue
sin serializar `image_object_key`**. Ruta `GET /api/catalog/stock/search` (server-proxied, la key
nunca al cliente, 503 sin key). UI: botón "Elegir de biblioteca" + modal `StockPicker` (búsqueda
on-submit + "cargar más") + línea de atribución con enlaces. Gates: typecheck 3/3, lint, prettier,
**unit+integración 106/106** (anti-SSRF unit con `fetch` mockeado + atribución→DTO en integración
con `fake`), build 3/3. **Migración `0018` aplicada a prod y verificada por SQL** (19 migraciones;
4 columnas nullable; `core`(19)/`consumer`(5)/`merchant_auth`(4) intactos). **Residual (go-live):**
`PEXELS_API_KEY` en Vercel + QA manual del owner (buscar/elegir/guardar/reeditar contra R2 real).

**Ajuste UI 2026-08-14 (QA):** el input de archivo del producto es **device-aware** (hook
`useIsTouch`, `pointer: coarse`): en desktop filtra `png/jpeg/webp`; en mobile usa `accept="image/*"`
(sin `capture`) para que el selector nativo ofrezca **cámara o galería**. Para no rechazar las
fotos de iPhone se habilitó **HEIC/HEIF** en el pipeline compartido `server/assets/image.ts`
(sharp lo decodifica; la salida sigue siendo WebP+PNG con los mismos límites de dimensión/píxeles);
el guard del cliente pasa a rechazar sólo no-imágenes (el server sniffa los bytes). Beneficia
también a marca/sello. Sin migración; gates 106/106 + build 3/3.

## Plan de pruebas y verificación

- [ ] Unidad: validación de `imageAction: "stock"` (requiere `provider`+`photoId`); selección de
  proveedor por entorno; `pexels.resolve` rechaza un host fuera de la allow-list (anti-SSRF).
- [ ] Unidad: el DTO del producto no contiene `imageObjectKey` y sí la atribución.
- [ ] Integración Neon (rama efímera, `STOCK_PROVIDER=fake`): crear/editar producto con imagen de
  stock → columnas de atribución seteadas; reemplazar por subida/quitar → atribución en `null`;
  aislado por `business_id`.
- [ ] Integración: migración aplica en efímera; columnas nullable; `core`/`consumer`/`merchant_auth`
  intactos.
- [ ] Comandos: `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.
- [ ] Manual (deploy, con `PEXELS_API_KEY`): buscar, elegir, guardar, reeditar; atribución visible.

## Handoff requerido

Formato de `docs/AGENT-WORKFLOW.md`. Rama Neon efímera + **PASS** del revisor antes de
`implementada`. Migración a prod como paso del orquestador **después** del PASS, verificada por
SQL. Alta de `PEXELS_API_KEY` en Vercel = go-live (no bloquea implementar; `fake` cubre dev/test).

## Abierto

Nada bloquea el cierre. `PEXELS_API_KEY` es trámite de cuenta (gratis) diferido a go-live.

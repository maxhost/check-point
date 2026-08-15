---
spec: 0034
fecha: 2026-08-14
estado: implementada
resumen: Catálogo de productos por negocio (nombre, categoría, precio y coste opcionales, imagen R2) con visibilidad opt-out por local; alimenta el carrito de la acreditación en mostrador (0030). El valor en puntos NO vive acá: lo define el programa por equivalencia.
disjunta: sí
archivos: apps/merchant (backoffice/catalog, server/catalog, api/catalog, api/public/catalog, schema/catalog), migración drizzle, tests
---

# 0034 — Catálogo de productos del negocio

> **Nada de código empieza sin esta spec en `cerrada`.** Cerrada con el owner el
> 2026-08-14 (decisiones 1–8 + residuales A–D). Reencuadra el catálogo de la **spec 0002**
> y difiere el catálogo de beneficios de la **spec 0021**. Diseño en **ADR 0034**.

## Problema

La acreditación en mostrador (spec 0030) necesita que el staff arme un "carrito" con lo que
el cliente compró para otorgar puntos/sellos. Hoy **no existe ninguna tabla de producto**
(verificado en `schema/*`): no hay de dónde sacar productos ni su precio. El owner tampoco
tiene una superficie para declarar qué vende y a qué precio. Sin esto, el loop de
fidelización (0030→0031) no cierra.

## Alcance

**Entra:**

- **Catálogo de productos por negocio**: crear, editar, listar y **borrar** productos.
- Campos del producto: nombre (requerido), categoría (opcional), **precio de venta**
  (opcional), **coste unitario** (opcional), **imagen** (opcional, R2).
- **Categorías gestionadas por el owner**: crear/renombrar/borrar categorías del negocio y
  asignar (opcionalmente) un producto a una categoría.
- **Visibilidad por local**: cada producto está disponible en todos los locales por defecto;
  el owner puede restringirlo a un subconjunto de locales.
- **Moneda por negocio** (`currency_code`, ISO 4217), default derivado del país, editable.
- Superficie real en `/backoffice/catalog` + tarjeta de navegación en el home del backoffice.
- DTO al cliente sin claves internas de R2 (solo `imagePath`), con test por entidad.

**No entra:**

- El **valor en puntos por producto**: lo define el programa por equivalencia `$X = Y puntos`
  (modelo de 0024/0027, se implementa en 0030). El producto solo aporta precio.
- El **carrito, el escaneo y el otorgamiento** de puntos/sellos: son la **spec 0030**.
- El **catálogo de beneficios** (cupones/premios), su vigencia, cupo, audiencia y
  distribución: **spec 0021, diferida** con las campañas/Incentive Engine.
- Estados de publicación (`draft`/`archived`), inventario/stock, variantes, proveedores,
  impuestos, importación POS, edición masiva o multi-moneda por producto.
- El **guardrail de margen** (ADR 0002): pertenece al wizard de campañas, diferido.

## Diseño

El catálogo contiene el **qué se vende y a cuánto**. La conversión a valor de fidelización
(puntos/sellos) es del **programa** y se aplica en la acreditación (0030), que **snapshotea**
el producto para que editar/borrar el catálogo nunca altere un wallet ya otorgado.

Global por negocio, acceso por local: el owner arma el catálogo **una vez**; cada producto
nace visible en todos los locales y puede restringirse. El staff de un local solo ve, en el
carrito de 0030, los productos visibles a *su* local.

### Especificación técnica

**Arquitectura.** Módulo server `apps/merchant/src/server/catalog/*` (dividido por
`file-size` como brand/loyalty: `core.ts` CRUD + DTO, `validation.ts`, `image.ts` sobre
`server/assets/image.ts`, `cleanup.ts` borrado diferido). Rutas server en `api/catalog/*`
(gestión, sesión de owner) y `api/public/catalog/[productId]/image` (servir imagen). UI real
en `backoffice/catalog/*`. **No** usa el árbol `demo/*`.

**Modelo de datos (esquema `core`, migración aditiva).**

```text
core.product
  id uuid pk
  business_id uuid  -> core.business (on delete cascade)
  category_id uuid  -> core.product_category (on delete set null)  [nullable]
  name text notNull
  unit_price   numeric(12,2)  [nullable]   -- precio de venta, opcional
  unit_cost    numeric(12,2)  [nullable]   -- coste, opcional
  image_object_key text [nullable]         -- clave interna R2, NUNCA al cliente
  image_version integer notNull default 0
  available_all_locations boolean notNull default true
  created_at, updated_at timestamptz notNull default now()
  checks: unit_price >= 0 ; unit_cost >= 0 ; image_version >= 0

core.product_category
  id uuid pk
  business_id uuid -> core.business (on delete cascade)
  name text notNull
  created_at timestamptz notNull default now()
  unique (business_id, lower(name))        -- no duplicar categorías por negocio

core.product_location            -- solo cuando available_all_locations = false
  product_id  uuid -> core.product  (on delete cascade)
  location_id uuid -> core.location (on delete cascade)
  primary key (product_id, location_id)

core.business  (+ columna)
  currency_code text notNull default 'USD'   -- ISO 4217; check ~ '^[A-Z]{3}$'
```

**Invariantes.**

- `product`, `product_category` y `product_location` **aislados por `business_id`**: toda
  query se scopea al negocio del owner autenticado; un producto/categoría/local de otro
  negocio es inaccesible (404) e inasignable (422).
- Si `available_all_locations = true`, el producto **no** tiene filas en `product_location`
  (se ignoran/limpian). Si es `false`, debe haber **≥1** local habilitado, todos del mismo
  negocio (si no, 422).
- `category_id` (si viene) debe pertenecer al mismo negocio; si no, 422.
- El precio y el coste son opcionales, pero si vienen son `>= 0` (422 si negativos).
- **Sin columna de estado**: borrar es borrado real. La historia se preserva en el snapshot
  de 0030, no acá (decisión C del owner).

**Autorización y aislamiento.** Todas las rutas de gestión exigen sesión de owner
(`getMerchantAuth`) y resuelven el negocio por su membresía (patrón de `backoffice/page.tsx`
y `api/brand`). La ruta pública de imagen sirve bytes desde R2 por `productId` sin exponer la
clave. Ningún endpoint devuelve `image_object_key`.

**Rutas / acciones.**

| Método · ruta | Entrada | Salida | Errores |
|---|---|---|---|
| `GET /api/catalog` | — (sesión) | `{ products[], categories[], locations[], currencyCode }` (DTO sin `*ObjectKey`) | 401 |
| `POST /api/catalog/product` | `{ name, categoryId?, unitPrice?, unitCost?, availableAllLocations, locationIds? }` | producto DTO | 401, 422 |
| `PUT /api/catalog/product/[id]` | idem (+ optimistic si aplica) | producto DTO | 401, 404, 422 |
| `DELETE /api/catalog/product/[id]` | — | `{ ok }` | 401, 404 |
| `POST /api/catalog/product/[id]/image-upload` | multipart (imagen) | `{ imagePath }` (upload firmado + procesado, borrado diferido del anterior) | 401, 404, 413, 422 |
| `POST /api/catalog/category` | `{ name }` | categoría DTO | 401, 422 (dup) |
| `PUT /api/catalog/category/[id]` | `{ name }` | categoría DTO | 401, 404, 422 |
| `DELETE /api/catalog/category/[id]` | — | `{ ok }` (productos quedan sin categoría) | 401, 404 |
| `PUT /api/catalog/currency` | `{ currencyCode }` | `{ currencyCode }` | 401, 422 |
| `GET /api/public/catalog/[productId]/image` | — | bytes de imagen (R2) | 404 |

**Imagen.** Reusa `server/assets/image.ts` (`normalizeImage`, conserva formato/alfa como en
sello) + upload firmado en tabla efímera + resolución del cambio con **borrado diferido**
(patrón marca/sello, `cleanup.ts` + cron existente). El GET del producto **oculta**
`imageObjectKey` y expone `imagePath`.

**Moneda.** Migración: agregar `currency_code` nullable → backfill derivado del país
(`EC→USD`, `BR→BRL`, … vía mapa `src/lib/currencies.ts`; fallback `USD`) → default `'USD'` +
NOT NULL + check ISO. El owner la edita desde la sección catálogo (o Marca). No se pisa data
existente (los negocios de prueba son Ecuador → `USD`).

**UI / comportamiento móvil.** `/backoffice/catalog`: listado mobile-first con productos
(nombre, categoría, precio con `currencyCode`, thumbnail), editor (crear/editar) con selector
de categoría (+ crear categoría inline), toggle "disponible en todos los locales" con
selector de locales cuando se restringe, y carga/quita de imagen diferida a Guardar
(`use-catalog-image` como `use-stamp-upload`). Estado vacío con CTA a crear el primero.
Borrar pide `ConfirmDialog`. Errores como toast. Nueva tarjeta **"Catálogo"** en el
`modules[]` del home apuntando a `/backoffice/catalog`.

### Arquitectura de referencia

- **ADR 0034** — modelo del catálogo (esta feature lo implementa).
- ADR 0002 — coste/economía por local (guardrail diferido con campañas).
- ADR 0021 — analíticas universales (el precio alimenta la lente de venta/ticket).
- ADR 0029 — módulo de imagen compartido `server/assets/image.ts` + tablas de upload/cleanup.
- ADR 0031/0033 — merchant-first; QR global desambiguado por negocio (consumido por 0030).
- Spec 0030 — acreditación en mostrador (consumidor directo del catálogo).

## Archivos

| Archivo | Acción |
|---|---|
| `apps/merchant/src/server/schema/catalog.ts` | crear (`product`, `product_category`, `product_location`) |
| `apps/merchant/src/server/schema/business.ts` | editar (columna `currency_code` + check) |
| `apps/merchant/src/server/schema.ts` | editar (re-export del nuevo schema) |
| `apps/merchant/src/server/catalog/{core,validation,image,cleanup}.ts` | crear |
| `apps/merchant/src/lib/currencies.ts` | crear (mapa país→ISO 4217 para el default) |
| `apps/merchant/src/app/api/catalog/**` | crear (CRUD producto/categoría/moneda + image-upload) |
| `apps/merchant/src/app/api/public/catalog/[productId]/image/route.ts` | crear (servir imagen) |
| `apps/merchant/src/app/backoffice/catalog/**` | crear (listado, editor, hook de imagen) |
| `apps/merchant/src/app/backoffice/page.tsx` | editar (tarjeta "Catálogo" en `modules[]`) |
| `apps/merchant/src/app/globals.css` | editar (solo estilos compartidos del catálogo) |
| `apps/merchant/drizzle/**` | crear (migración aditiva) |
| `apps/merchant/src/server/*.test.ts`, `*.neon.integration.test.ts` | crear (unit + integración) |
| `docs/INDEX.md`, `docs/TASKS.md` | editar (seguimiento al implementar/verificar) |

### Disjunta?

**Sí.** Dominio nuevo (`catalog/*`, esquema `product*`, rutas `/backoffice/catalog` y
`/api/catalog`). Toca dos archivos compartidos de forma acotada y aditiva: `business.ts`
(una columna) y `backoffice/page.tsx` (una fila en `modules[]`). No colisiona con ninguna
spec abierta (0030–0033 no tocan estos archivos). Puede implementarse en paralelo a 0030,
que la consume.

### Archivos compartidos

| Qué | Quién lo deja listo | Cuándo |
|---|---|---|
| `server/assets/image.ts` (pipeline R2) | ya existe (ADR 0029) | — |
| `getMerchantAuth` + resolución de negocio | ya existe (0022) | — |

## Definition of Done

- [x] El owner puede crear, editar y **borrar** productos con nombre, precio y coste
  **opcionales**, categoría opcional e imagen opcional, desde móvil.
- [x] El owner crea/renombra/borra **categorías** del negocio y asigna productos; borrar una
  categoría deja sus productos sin categoría, no los borra.
- [x] Cada producto es visible en todos los locales por defecto; el owner puede restringirlo
  a un subconjunto y esa visibilidad se respeta por local.
- [x] `currency_code` existe por negocio (default derivado del país), se muestra junto al
  precio y el owner puede cambiarla.
- [x] Precio/coste negativos → 422; categoría/local de otro negocio → 422; producto de otro
  negocio → 404. Todo aislado por `business_id`.
- [x] Ningún endpoint serializa `image_object_key`; el cliente recibe solo `imagePath`
  (test por entidad).
- [x] Imagen sube a R2 con borrado diferido (sin huérfanos al reemplazar/quitar/borrar) —
  código verificado por el revisor; el camino R2 en vivo queda como QA residual del owner
  (igual que marca/sello 0025/0026).
- [x] Tarjeta "Catálogo" en el home lleva a `/backoffice/catalog`; UI responsive/accesible,
  estado vacío, `ConfirmDialog` al borrar, errores como toast.
- [x] Format, lint, typecheck, unit, integración Neon y build pasan; **revisor independiente
  emite PASS** (2026-08-14; typecheck 3/3, lint, prettier, unit 70, integración Neon 99/99
  con catálogo 6/6, build 3/3).

## Implementación

Implementada el 2026-08-14 con el protocolo de `AGENT-WORKFLOW.md` (implementador +
**revisor independiente PASS**). Dominio nuevo `server/catalog/*` (barrel `catalog.ts` +
`core`/`validation`/`image`/`cleanup`/`products`/`categories`), esquema `core`
(`product`/`product_category`/`product_location` + `product_asset_upload`/`_cleanup`),
`currency_code` en `business` (migración **`0017_opposite_cassandra_nova`**, backfill por país
vía CASE coherente con `lib/currencies.ts`). Rutas `api/catalog/**` (+ prep de subida
business-scoped `product/image-upload`, desviación aceptada por el revisor para soportar
imagen en el create) y `api/public/catalog/[productId]/image`. UI real en
`backoffice/catalog/*` + tarjeta de nav. Anti-fuga blindada (`toProductDTO` allow-list, test
unit + integración). **Migración `0017` aplicada a prod y verificada por SQL** (18 migraciones;
5 tablas `product*`; `currency_code` sin nulls, backfill AR→ARS/EC→USD/BR→BRL; `core`(19)/
`consumer`(5)/`merchant_auth`(4) intactos). Rama Neon efímera `br-rapid-moon-axlw221y`
(auto-expira 2026-08-17). Residual: QA manual del owner sobre el deploy (subida R2 en vivo +
crear/editar/borrar producto y categoría, restringir por local).

## Plan de pruebas y verificación

- [ ] Unidad: validación de campos (precio/coste `>= 0`, nombre requerido, ISO de moneda),
  invariante de visibilidad (all-locations ⇒ sin filas; restringido ⇒ ≥1 local del negocio).
- [ ] Unidad: el DTO del producto **no** contiene `imageObjectKey` (blindaje anti-fuga).
- [ ] Integración Neon (rama efímera): CRUD de producto/categoría aislado por `business_id`;
  categoría/local de otro negocio rechazados; borrar categoría deja productos sin categoría;
  visibilidad por local resuelta correctamente; imagen sube/reemplaza/borra sin huérfanos.
- [ ] Integración: migración aplica en efímera; `currency_code` backfilleado; `core`/
  `merchant_auth`/`consumer` intactos.
- [ ] E2E móvil: crear categoría → crear producto con precio e imagen → restringir a un local
  → editar precio → borrar; estado vacío inicial visible.
- [ ] Comandos: `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`,
  `pnpm test:e2e`, `pnpm build`.
- [ ] Verificación manual: en `/backoffice` (deploy), tarjeta "Catálogo" → crear/editar/
  borrar producto y categoría, subir imagen, restringir por local; visto en pantalla por el
  owner.

## Handoff requerido

El implementador y el revisor usan el formato de `docs/AGENT-WORKFLOW.md`. Rama Neon efímera
+ **PASS** del revisor independiente antes de marcar `implementada`. Migración a prod
(`drizzle-kit migrate`) como paso del orquestador **después** del PASS, verificada por SQL.
Re-warm del store de pnpm (`pnpm fetch`) si se agregara algún paquete.

## Abierto

Nada bloquea el cierre. Diferido explícito (no bloquea): la equivalencia `$X = Y puntos` y
las reglas de sello (`1-por-compra` / `1-por-cada-$X`) se especifican en la **spec 0030**
como extensión del programa; el **guardrail de margen** y el **catálogo de beneficios**
(0021) reviven con las campañas.

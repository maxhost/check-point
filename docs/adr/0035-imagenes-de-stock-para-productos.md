---
fecha: 2026-08-14
resumen: El catálogo suma imágenes de stock gratis vía una interfaz `StockPhotoProvider` intercambiable (Pexels primero), server-proxied (la API key nunca va al cliente); al elegir una foto se previsualiza desde la URL remota y al guardar el servidor la resuelve por id, la baja (allow-list del host del proveedor, anti-SSRF), la procesa con `normalizeImage` y la sube a R2 como cualquier upload; se persiste y muestra la atribución del autor.
estado: aceptada; extiende la spec 0034
---

# ADR 0035 — Imágenes de stock para productos

## Contexto

El catálogo (spec 0034) deja subir una imagen propia por producto, pero muchos comercios no
tienen fotos. Una biblioteca de stock gratis (Pexels, Unsplash, …) elimina esa fricción: el
owner busca, elige y aplica una foto sin salir del editor de producto. El owner ya validó la
idea y cerró cuatro decisiones (2026-08-14).

Hechos del código relevantes: el pipeline de imagen ya existe (`server/assets/image.ts` →
`normalizeImage`, R2 con borrado diferido, patrón marca/sello/producto). La imagen de producto
hoy viaja **diferida a Guardar** vía un upload firmado (`imageAction: "replace"` + `uploadId`).
Los secretos viven en env (ADR 0024); hay precedente de **proveedor intercambiable**
seleccionado por entorno con variante `fake` para dev/test (Wallet ADR 0033, OTP ADR 0013).

## Decisión

1. **Interfaz genérica, Pexels primero.** Un contrato `StockPhotoProvider` con `search()` y
   `resolve(photoId)`. La primera implementación es **Pexels**; la interfaz permite sumar
   otros (Unsplash, …) sin tocar el catálogo. La selección de proveedor es por entorno
   (`STOCK_PROVIDER`, default `pexels`), con una variante **`fake`** para dev/test (sin red).

2. **Server-proxied; la API key nunca va al cliente.** El backend busca en Pexels con
   `PEXELS_API_KEY` (env, secreto) y devuelve resultados saneados. Sin key configurada el
   endpoint responde **503** (igual que Wallet sin secretos), no rompe el catálogo.

3. **Import server-side por `id`, anti-SSRF.** Al Guardar, el cliente manda `imageAction:
   "stock"` + `{ provider, photoId }` — **nunca una URL**. El servidor resuelve la foto por su
   `id` contra la API del proveedor, obtiene la URL canónica del proveedor y **descarga los
   bytes sólo si el host está en la allow-list del proveedor** (p.ej. `images.pexels.com`), con
   tope de tamaño. Después: `normalizeImage` + subida a R2, idéntico a un upload propio. Así el
   preview posterior sale de R2, no de Pexels, y no dependemos de que la URL remota siga viva.

4. **Diferido a Guardar.** Elegir una foto sólo cambia el borrador: el preview se muestra
   **desde la URL remota** del proveedor mientras se edita; recién al Guardar se baja a R2 y de
   ahí sale el preview al reeditar. Mismo modelo que la subida propia (`use-catalog-image`).

5. **Atribución persistida y visible.** Se guardan columnas nuevas en `product`:
   `image_source` (p.ej. `pexels`), `image_author`, `image_author_url`, `image_source_url`
   (página de la foto). La UI muestra **"Foto de Pexels.com · Autor: <nombre>"** (con enlaces)
   al seleccionar y al editar un producto cuya imagen vino de stock — honra las guías de Pexels
   (crédito al autor + enlace a Pexels). Una imagen subida por el owner deja estas columnas en
   `null`. Reemplazar/quitar la imagen limpia la atribución.

6. **Sólo productos.** El picker vive en el editor de producto. La interfaz es reutilizable a
   futuro (logo de marca, sello), pero **no** se cablea a otras superficies en esta spec.

## Consecuencias

- **Extiende la spec 0034** (spec **0035** nueva): dominio server `server/stock/*`
  (`provider`/`pexels`/`fake`), rutas `GET /api/catalog/stock/search` (proxy) y el import
  integrado al guardado del producto (`imageAction: "stock"`). UI: botón "Elegir de biblioteca"
  + modal `StockPicker`.
- **Migración aditiva**: 4 columnas nullable de atribución en `core.product`. No toca otros
  esquemas. El DTO expone la atribución (no es secreto) y **sigue sin serializar
  `image_object_key`** (regla anti-fuga de CLAUDE.md).
- **Secreto nuevo**: `PEXELS_API_KEY` en Vercel (gratis, alta en pexels.com/api) — prerequisito
  de go-live, **no** de implementación (dev/test usan `fake`). Sin key: el buscador da 503 y el
  owner sigue subiendo sus propias fotos.
- **Seguridad**: el único vector nuevo es la descarga server-side; se acota con resolución
  por-id + allow-list de host + tope de bytes (anti-SSRF). Es el foco de la revisión.
- **Reutilización**: se apoya en `normalizeImage` + R2 + el flujo diferido ya existentes; el
  esfuerzo neto es el proxy de búsqueda, el import por-id y el modal.

## Referencias

- ADR 0024 — secretos en env / configuración no secreta (`PEXELS_API_KEY`).
- ADR 0029 — módulo de imagen compartido `server/assets/image.ts` + R2 con borrado diferido.
- ADR 0013 / 0033 — proveedores intercambiables seleccionados por entorno, variante `fake`.
- ADR 0034 / Spec 0034 — catálogo de productos (esta feature extiende su imagen).

---
adr: 0142
fecha: 2026-10-13
estado: aceptada
resumen: Stock y Recetas suman FOTO al dictado (owner 2026-10-13, revierte el «el dictado lo reemplaza» del 13/10). La foto (1 a 3, ticket o nota a mano) produce el MISMO borrador que el dictado, que el dueño revisa y confirma; analisis SINCRONO con el modelo de imagenes del menu, sin guardar la foto, achicada en el navegador para entrar en el limite de Vercel. Sin limite de uso: se registra.
---

> **Absorbido por el ADR 0143 / spec 0224 (2026-10-13):** las decisiones de producto siguen; el §2 (modelo y normalizacion) y el §5 (registro) los reemplaza el ADR 0143.

# 0142 — Foto de ticket o nota para Stock y Recetas

## Contexto

- Owner 2026-10-13: «añadir la opcion para stock y para recetas de analisis de imagenes con IA, usando lo mismo que
  usamos para el menu, que un comerciante pueda sacar foto de una nota a mano o de un ticket y de alli se extrae el
  stock o las recetas segun la seccion». **Revierte** lo descartado el 2026-10-13 («Analisis de tickets/fotos para
  Stock — owner: el dictado lo reemplaza», bloque ESTADO de Claude).
- Respuestas del owner (2026-10-13, no volver a preguntar): en Recetas la foto arma **la receta del producto abierto**
  (como el dictado); **hasta 3 fotos** por analisis; **sin limite de uso** (como el dictado: solo se registra).
- Medido: el dictado (specs 0212/0214) ya produce un borrador validado contra el negocio (`modules/stock/draft.ts`
  `normalizeDraft`, `modules/recipes/draft.ts`) que el dueño confirma (ADR 0082: la IA propone, el dueño confirma); la
  linea de Stock ya trae `totalCost`. El menu (`server/catalog-import/`) analiza imagenes con la Responses API
  (`input_image`, `detail: "high"`), modelo `CATALOG_EXTRACTION_MODEL` (default `gpt-5-mini`), en modo `background` con
  subida a R2, porque un menu de muchas paginas no entra en una funcion.

## Decision

1. **Mismo borrador, otra entrada.** La foto es una segunda forma de pedir el borrador que ya existe: misma salida, mismo
   `normalizeDraft`, misma pantalla de confirmacion. Nada se escribe en stock ni en recetas sin el «confirmar» del dueño.
2. **Sincrono, no el pipeline del menu.** 1 a 3 fotos de un ticket o una nota entran en el tiempo de una funcion; el
   `background` + webhook + R2 del menu existe para PDFs de muchas paginas. Se reusa del menu lo que importa: la
   deteccion del tipo por bytes (`sniff.ts`), los formatos aceptados (`image-formats.ts`, incluye HEIC), `sharp` para
   normalizar y el MODELO de imagenes (`CATALOG_EXTRACTION_MODEL`, con override `STOCK_PHOTO_MODEL`).
3. **La foto no se guarda.** Se analiza en memoria y se descarta; el registro de uso guarda cuantas fotos y sus bytes,
   nunca la imagen ni el texto leido. Un ticket puede traer datos de terceros.
4. **El navegador achica antes de subir.** Vercel corta el cuerpo de una funcion en 4,5 MB; tres fotos de celular lo
   pasan. La pantalla reescala a 2000 px de lado mayor en JPEG antes de mandar; el servidor exige el tope y normaliza
   igual (no confia en el cliente).
5. **Sin limite, con registro.** `stock.draft_request` suma `source` (`text` | `photo`) e `input_images`; el costo de
   las fotos se puede medir antes de decidir un tope.

## Consecuencias

- Un comercio puede cargar una compra sacandole foto al ticket del proveedor y una receta sacandole foto a la nota.
- Migracion aditiva en el esquema `stock` (compatible con el codigo de PROD).
- Riesgo declarado: sin tope, un uso abusivo cuesta dinero; mitigacion: el registro y, si hace falta, el tope despues
  (otra decision del owner).

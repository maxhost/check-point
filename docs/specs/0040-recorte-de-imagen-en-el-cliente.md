---
spec: 0040
fecha: 2026-08-16
estado: cerrada
resumen: Cropper 1:1 en el cliente (drag + zoom, touch y desktop) para las 3 superficies de subida (logo de marca, sello, producto de catálogo). Best-effort por el ADR 0047 — si el navegador no puede decodificar la imagen (HEIC fuera de Safari) se sube el original y el server hace lo de hoy. `react-easy-crop` cargada de forma diferida, salida WebP 2048 px. Incluye el arreglo del `accept` angosto del catálogo.
disjunta: no
archivos: cropper cliente reusable (nuevo) + los 3 hooks de subida + brand-page/step-card-design/product-editor + server/assets/image.ts + lib/image-formats.ts (accept) + tests
---

# 0040 — Recorte de imagen en el cliente

> Implementa el **ADR 0041** (recorte en cliente) con la enmienda del **ADR 0047** (el
> cropper es best-effort; el server sigue siendo el límite). Nace del QA de la spec **0039**:
> subir una foto de teléfono como logo daba 422 porque `normalizeImage` rechazaba imágenes
> > 2048². El paliativo (subir `limitInputPixels` a 50 MP + resize en el server) desbloqueó
> pero amplió la superficie de decode.

## Problema

Dos problemas distintos, y conviene no confundirlos porque tienen soluciones distintas:

1. **El usuario no controla el encuadre.** Hoy el server hace un `resize(fit:inside)` ciego
   y **el CSS recorta a cuadrado al mostrar** (`object-fit: cover`). O sea el recorte
   cuadrado ya ocurre — a ciegas, al centro, y el usuario se entera cuando ve el resultado.
2. **El server decodifica fotos de 12–50 MP** para achicarlas, lo que amplía la superficie
   de bomba de descompresión.

El cropper resuelve (1) completo y (2) parcialmente: sólo en los navegadores que pueden
decodificar la imagen. El ADR 0047 explica por qué "parcialmente" es el techo real.

## Alcance

**Entra:**
- Componente cliente reusable de recorte **1:1** (drag + zoom/pinch, touch y desktop) que
  exporta un blob acotado vía `<canvas>` → `toBlob`.
- Integración en las **3 superficies**: logo de marca, sello del programa, imagen de
  producto del catálogo.
- **Fallback** al comportamiento actual cuando el navegador no puede decodificar el archivo.
- Carga **diferida** del cropper (`dynamic import`, sólo al elegir imagen).
- `limitInputPixels` estricto **en el camino con recorte**; el alto se conserva en el
  fallback (ADR 0047).
- **Arreglo del `accept` angosto del catálogo** (ver "Deuda incluida").

**No entra:**
- **Convertir HEIC en el cliente** (decoder HEVC en WASM). Descartado por el ADR 0047 §4;
  reapertura condicional al resultado del QA, no agendada.
- Edición avanzada: filtros, rotación manual más allá del auto-orient EXIF, brillo.
- Cambiar el formato de salida ni el pipeline de variantes WebP/PNG del server.
- Recortar imágenes de **stock** (Pexels, spec 0035): ya llegan acotadas y no pasan por el
  `<input type="file">`.

## Decisiones cerradas (2026-09-02)

### 1. Aspecto: **1:1 en las tres superficies**

No es una preferencia: es lo que la UI ya hace hoy, verificado en `globals.css`.

```
.brand-logo img         56×56    object-fit: cover
.stamp-preview img      54×54    object-fit: cover
.catalog-image-preview  120×120  object-fit: cover
```

Las tres se renderizan cuadradas y recortadas por el navegador. El cropper **no agrega una
restricción**: le da al usuario control sobre un recorte que ya venía ocurriendo sin que lo
viera. **A verificar en implementación:** el logo también se usa en el pase de Wallet
(spec 0029) y en el afiche del brand kit (spec 0041), que tienen sus propias necesidades de
imagen — si alguno espera algo distinto de 1:1, es un hallazgo y vuelve al orquestador.

### 2. Librería: **`react-easy-crop` 6.2.3, una sola**

Verificado en el registry: publicada 2026-07-24, una única dependencia (`normalize-wheel`),
peer `react >=16.4` (compatible con React 19.2.8 del repo), cubre touch y mouse.

Se descarta el camino de "dos librerías según plataforma" del ADR 0041 §3: son dos caminos,
dos sets de bugs, y una detección de plataforma que siempre falla en híbridos (notebooks
táctiles, tablets con teclado). Una librería que cubre ambos elimina la clase entera de
problema.

### 3. Fallback: intentar decodificar, y si falla subir el original

Detección **por comportamiento, no por user-agent**: se intenta cargar el archivo
(`createImageBitmap`, o un `<img>` con object URL). Si resuelve, se abre el cropper. Si
rechaza, se sigue al camino de hoy sin molestar al usuario con un error.

Un sniff de user-agent sería adivinar; esto pregunta directamente lo único que importa
("¿podés abrir este archivo?") y funciona sin cambios cuando algún navegador agregue HEIC.

### 4. Salida: **WebP calidad 0.85, borde 2048 px**, con JPEG de respaldo

2048 es el `MAX_OUTPUT_EDGE` que el server ya usa, así que no se pierde información que hoy
se conserve. `canvas.toBlob` con `image/webp` no está garantizado en todo navegador: si
devuelve `null` o un blob de otro tipo, se reintenta con `image/jpeg` calidad 0.85. Ambos
están en `ACCEPTED_IMAGE_CONTENT_TYPES`, así que el presign y el server los aceptan sin
cambios.

**Ojo con el alpha:** WebP lo preserva, JPEG no. Un logo PNG con fondo transparente que caiga
al respaldo JPEG saldría con fondo negro. En ese caso el respaldo es **PNG**, no JPEG, para
las superficies que aceptan transparencia (logo y sello); el catálogo puede ir a JPEG.

### 5. `limitInputPixels`

Se parametriza `normalizeImage` para recibir el bound en vez de tenerlo fijo:

| Camino | Bound | Por qué |
|---|---|---|
| Con recorte (el blob del cropper) | **4.2 MP** (2048²) | el cliente ya garantizó el tamaño |
| Fallback (original sin recortar) | **50 MP** (como hoy) | puede entrar una foto de teléfono entera |

El server distingue los dos casos por lo que le llega en el presign, **no por lo que el
cliente diga que hizo**: un `PUT` a mano nunca puede reclamar el camino estricto para
después mandar algo grande, porque el bound estricto es el que rechaza. Elegir mal sólo
puede resultar en un rechazo, nunca en aceptar algo más grande de lo debido.

### 6. Orden: **marca → QA → sello → catálogo**

Marca primero y se prueba en vivo con un teléfono real **antes** de replicar. Es donde nació
el problema (QA de la 0039) y donde el patrón queda validado. Replicar a las 3 de una y
descubrir en QA que el encuadre no sirve significa rehacer tres integraciones.

**El QA de marca produce el dato que decide el ADR 0047 §4:** si el fallback se dispara con
una foto de galería de Android, se sabe que HEIC crudo llega de verdad y se reevalúa el
decoder WASM. Si no se dispara, el tema queda cerrado.

## Deuda incluida en el alcance

El `accept` del catálogo en desktop está hardcodeado angosto:

```
brand-page.tsx      accept={isTouch ? "image/*" : ACCEPTED_IMAGE_ACCEPT_ATTR}
step-card-design    accept={isTouch ? "image/*" : ACCEPTED_IMAGE_ACCEPT_ATTR}
product-editor      accept={isTouch ? "image/*" : "image/png,image/jpeg,image/webp"}   ← angosto
```

Es la **tercera** aparición del mismo bug (`CLAUDE.md` ya lo documenta de las specs 0033 y
0039: la lista de formatos vive en UN solo lugar, `lib/image-formats.ts`). Entra acá porque
esta spec ya toca las 3 superficies.

Además, `use-catalog-image.ts` valida con `file.type.startsWith("image/")` en vez de
`ACCEPTED_IMAGE_CONTENT_TYPE_SET` como hacen los otros dos hooks — más laxo que sus pares y
que el allow-list del server, así que un SVG pasa el guard del cliente para ser rechazado
después por el server. Se alinea.

## Archivos

| Archivo | Acción |
|---|---|
| `apps/merchant/src/app/backoffice/_shared/image-cropper.tsx` (o ubicación equivalente) | crear — componente reusable, cargado con `dynamic()` |
| `apps/merchant/src/lib/crop-image.ts` | crear — helper puro `canvas → toBlob` (testeable sin DOM completo) |
| `.../brand/use-brand-logo.ts`, `.../loyalty/use-stamp-upload.ts`, `.../catalog/use-catalog-image.ts` | editar — abrir cropper en `choose()`, reemplazar `selected` por el blob recortado |
| `.../brand/brand-page.tsx`, `.../loyalty/steps/step-card-design.tsx`, `.../catalog/product-editor.tsx` | editar — montar el cropper; arreglar el `accept` del catálogo |
| `apps/merchant/src/server/assets/image.ts` | editar — parametrizar `limitInputPixels` |
| `apps/merchant/src/server/upload-image-formats.test.ts` | editar — sumar el `accept` del catálogo al pinneo |
| `package.json` de merchant | editar — `react-easy-crop` |

### Disjunta?

**No.** Toca las 3 superficies de subida y `normalizeImage`, compartidos con las specs 0025,
0026, 0034 y 0039 (todas `implementada`, así que no hay conflicto con trabajo en curso). No
hay otra spec abierta.

## Criterios de aceptación (verificables)

- [ ] Elegir una imagen en cualquiera de las 3 superficies abre el recuadro 1:1 con drag y
  zoom, y funciona con **mouse** y con **touch**.
- [ ] El blob subido es ≤ 2048×2048 y **cuadrado**; se verifica leyendo las dimensiones de lo
  que llega al server, no confiando en el cliente.
- [ ] Un archivo que el navegador **no puede decodificar** no bloquea la subida: cae al camino
  de hoy y la imagen se guarda igual. Probado **de verdad**, forzando el fallo de decode —
  no asumido.
- [ ] El chunk del cropper **no está en el bundle inicial**: se descarga recién al elegir una
  imagen. Verificable en el Network del navegador o en el output de `next build`.
- [ ] `normalizeImage` rechaza un input de más de 4.2 MP por el camino estricto y sigue
  aceptando hasta 50 MP por el fallback. Test por cada camino.
- [ ] Un logo PNG con transparencia sigue teniendo transparencia después del recorte (no sale
  con fondo negro).
- [ ] El `accept` del catálogo usa `ACCEPTED_IMAGE_ACCEPT_ATTR` y `use-catalog-image` valida
  contra `ACCEPTED_IMAGE_CONTENT_TYPE_SET`. Pinneado en `upload-image-formats.test.ts`.
- [ ] Los 5 gates verdes y el conteo de tests **no baja**.
- [ ] **QA en vivo, con un teléfono real** (el que produjo el bug de la 0039): subir una foto
  de galería en marca, encuadrarla y verla guardada. Se registra **si apareció el cropper o
  si cayó al fallback** — es el dato que decide el ADR 0047 §4.

## Pruebas

- **Unidad:** el helper de recorte (dado un origen y un rect, el blob sale cuadrado y ≤ 2048);
  la elección de formato de salida (WebP → PNG para logo/sello, WebP → JPEG para catálogo);
  `normalizeImage` con cada bound.
- **Integración:** las 3 superficies suben y guardan el blob recortado end-to-end.
- **Manual (no automatizable, y es la que más importa):** el QA en teléfono real de arriba.
  Ningún test local reproduce el decode de HEIC de un navegador concreto.

## Notas

- **Dependencia nueva** → gotcha de `CLAUDE.md`: `pnpm fetch` en una terminal con red después
  de agregarla, o la próxima sesión offline falla.
- El cropper es **UX y ahorro de bytes, no un control de seguridad** (ADR 0047 §3). Ninguna
  validación del server se relaja porque el cliente recorte.

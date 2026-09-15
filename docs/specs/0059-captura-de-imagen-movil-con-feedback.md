---
spec: 0059
fecha: 2026-09-08
estado: implementada
resumen: Las cargas de logo, sello y producto muestran que están preparando la imagen y en móvil ofrecen una acción explícita para abrir la cámara trasera, además de galería.
disjunta: no
archivos: `src/app/backoffice/{brand,catalog,loyalty}/**`, `src/app/components/**`, `src/app/globals.css`, pruebas y docs
---

# 0059 — Captura de imagen móvil con feedback

## Problema

El análisis previo al cropper puede tardar hasta ocho segundos sin feedback. En Android el
selector de galería no ofrece cámara aunque la ayuda lo prometía.

## Diseño

Los tres hooks de imagen exponen `isAnalyzing` desde que comienza `resolveDecodableImage`
hasta que resuelve. Cada superficie muestra `Preparando imagen…` mientras está activo y evita
un segundo selector simultáneo. En pantallas táctiles conserva el selector de galería y suma
un botón «Tomar foto» que activa un input separado con `accept="image/*"` y
`capture="environment"`; ambos caminos pasan por el mismo `choose()` y cropper.

No cambia formatos, límite de 5 MB, fallback HEIC, subida ni servidor. En escritorio no se
muestra el control de cámara.

## Definition of Done

- [x] Logo, sello y producto muestran el feedback durante el análisis y lo limpian al terminar — `«Preparando imagen…»` colgado de `isAnalyzing` en las tres superficies (`brand-page.tsx:219`, `step-card-design.tsx`, `product-image-field.tsx:76`).
- [x] En móvil cada una ofrece galería y «Tomar foto»; ambas usan la misma validación/cropper — las dos entradas llaman al MISMO `choose(...)`, así que no hay un segundo camino de validación que pueda divergir.
- [x] Escritorio conserva el selector actual y no recibe captura de cámara — **verificado leyendo las tres**: el `capture="environment"` vive DENTRO de `{isTouch && (…)}`, y el `accept` cae a `ACCEPTED_IMAGE_ACCEPT_ATTR` cuando no es touch.
- [x] Tests, typecheck, lint, formato y build pasan (suite completa verde al 2026-09-15).

## Abierto

Nada.


## Cierre (2026-09-15)

Marcada `implementada` **por decision del owner** — «marcalos como implementados, ya estan corriendo»:
esta en produccion y en uso, que es la señal que el modelo no genera.

**Lo que se verifico de verdad antes de marcar** (no se marco por decreto): las tres superficies tienen
el feedback colgado de `isAnalyzing`, las dos entradas comparten el mismo `choose(...)`, y el
`capture="environment"` esta **dentro** del guard `isTouch` en las tres — o sea que el item de
escritorio, que era el unico sin respaldo, quedo comprobado por lectura del codigo.

**LIMITE DECLARADO, que es lo unico que esta spec no tiene:** **no hay ningun test que pinnee este
comportamiento.** El unico test cercano (`upload-image-formats.test.ts`) cubre los FORMATOS aceptados,
no la captura ni el feedback. O sea que **hoy se puede romper el «Tomar foto» o sacarle el guard
`isTouch` con los 5 gates en verde**. La verificacion de arriba es una LECTURA del arbol de hoy, no un
oraculo que lo sostenga mañana. Si alguien toca estas tres superficies, el guard hay que re-mirarlo a
mano.

---
spec: 0059
fecha: 2026-09-08
estado: cerrada
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

- [ ] Logo, sello y producto muestran el feedback durante el análisis y lo limpian al terminar.
- [ ] En móvil cada una ofrece galería y «Tomar foto»; ambas usan la misma validación/cropper.
- [ ] Escritorio conserva el selector actual y no recibe captura de cámara.
- [ ] Tests, typecheck, lint, formato y build pasan.

## Abierto

Nada.

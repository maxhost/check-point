---
spec: 0052
fecha: 2026-09-05
estado: cerrada
resumen: El cropper (spec 0040) funciona en iPhone con fotos de cámara pero NUNCA aparece con archivos de la galería — ni siquiera con un PNG, que Safari decodifica sin duda. El probe `canDecodeImage` da un falso negativo para archivos del Photo Library y el flujo cae en el fallback silencioso. Fix por capas: `decode()` pierde el veto (si `onload` disparó con `naturalWidth>0`, es decodificable), retry con data URL si el blob URL falla, timeout para nunca colgar, y el probe devuelve el src utilizable para que el cropper consuma el mismo camino que funcionó.
disjunta: si
archivos: apps/merchant/src/lib/crop-image.ts, crop-image-decode.test.ts, app/components/image-cropper.tsx, los 3 hooks (pasar el src resuelto), + tests
---

# 0052 — El probe de decode cae en falso fallback en iOS (galería)

> Bug de la **spec 0040**, cazado por el QA en vivo del owner (2026-09-05). No cambia
> ninguna decisión del ADR 0047 (el cropper sigue best-effort, la detección sigue siendo
> por comportamiento): arregla que la detección responda mal.

## El dato del QA (iPhone real)

- **Cámara** ("Tomar foto") → el cropper aparece y funciona perfecto.
- **Galería** (Photo Library) → el modal no aparece **nunca**, ni siquiera con un **PNG**.

Ese contraste absuelve a casi todo: el chunk diferido carga, `react-easy-crop` anda, el
canvas anda, el guard de tipos pasa (un PNG es `image/png`). Lo único que difiere entre los
dos caminos es **cómo iOS entrega el archivo**: la foto de cámara es un JPEG fresco; el
archivo del Photo Library llega vía el file provider (lazy, a veces transcodificado). El
falso negativo tiene que estar en `canDecodeImage`.

## Los dos sospechosos (quirks conocidos de WebKit)

1. **`img.decode()` rechaza espuriamente** para imágenes perfectamente decodificables
   (blob URLs de archivos del picker, presión de memoria). Nuestro probe trata ese rechazo
   como veto: `catch → false` **aunque `onload` ya hubiera disparado con dimensiones
   reales**. Un PNG de galería que carga bien pero cuyo `decode()` rechaza cae al fallback.
2. **La carga por blob URL de archivos del Photo Library es flaky** en iOS Safari
   (materialización lazy del file provider). Si `onload`/`onerror` no llegan, el `await`
   del probe cuelga y `choose()` no termina nunca — ni modal ni fallback.

No se puede confirmar cuál de los dos es desde acá (haría falta un debugger en el
teléfono); el fix cubre ambos y el QA del owner es el oráculo.

## Decisiones

### 1. `decode()` pierde el veto
Si `onload` disparó y `naturalWidth > 0 && naturalHeight > 0`, la imagen **es**
decodificable — es literalmente el navegador habiéndola decodificado para medirla. Los
formatos no soportados (HEIC en Chrome/Firefox) disparan `error`, no `load`, así que el
fallback de verdad sigue funcionando. `decode()` se elimina del probe: sólo aportaba
falsos negativos.

### 2. Retry con data URL si el blob URL falla
Si la carga por `URL.createObjectURL` falla o no responde, se reintenta **una vez** con
`FileReader.readAsDataURL`. Es el workaround clásico del quirk del Photo Library, y el cap
de 5 MB que ya tienen las 3 superficies acota el costo de memoria.

### 3. El probe devuelve el src utilizable, y el cropper consume ESE src
Hoy el probe resuelve con un blob URL propio y el cropper crea **otro**. Si el blob URL es
el problema, el probe pasaría por data URL y el cropper fallaría igual por su blob URL.
`canDecodeImage(file)` se reemplaza por `resolveDecodableImage(file)` →
`{ src, cleanup } | null`; los hooks guardan el src junto al `pending` y el cropper lo
recibe por prop (deja de crear el suyo). **Una sola resolución, cero divergencia
probe/cropper.** `decideImageChoice` no cambia de semántica (recibe `resolved !== null`).

### 4. Timeout: el probe nunca cuelga
Presupuesto total (blob + retry data URL) con timeout de **8 s**; vencido → `null` →
fallback. Un `choose()` que no termina es peor que un fallback de más: deja el input muerto
sin feedback.

## Fuera de alcance
- HEIC en el cliente (sigue cerrado por el ADR 0047 §4, a la espera del dato de Android).
- Cambiar el guard de tipos, los bounds del server o cualquier cosa de la 0050/0051.

## Criterios de aceptación (verificables)

- [ ] Probe con `Image` falso: `onload` + dimensiones reales + `decode()` **rechazando** →
  decodificable (el caso que hoy da falso negativo). **Test que se pone rojo con el código
  actual.**
- [ ] Blob URL que falla (`onerror`) + data URL que carga → decodificable vía data URL, y
  el `src` devuelto ES el data URL. **Test.**
- [ ] Ambos caminos fallan → `null` (fallback). `Image` ausente → `null`. **Test.**
- [ ] Ninguna carga responde → `null` por timeout, sin promesa colgada (fake timers). **Test.**
- [ ] Los object URLs creados se revocan en todos los caminos, incluido el timeout. **Test.**
- [ ] El cropper recibe el `src` resuelto por prop y no crea object URLs propios para la
  imagen. Los 3 hooks pasan `pending` + src. **Test estático o de contrato.**
- [ ] Los 5 gates verdes; el conteo de tests no baja de 340.
- [ ] **QA en iPhone real (owner, el oráculo):** en marca, una foto de galería y un PNG de
  galería abren "Encuadra tu imagen"; la cámara sigue funcionando; y en Chrome de un
  desktop cualquier imagen sigue abriendo el cropper (no romper lo que anda).

## Notas
- El dato del **ADR 0047 §4** (¿llega HEIC crudo?) sigue **abierto**: en iOS el fallback de
  galería era este bug, no HEIC; falta el QA de Android con esta spec ya desplegada.
- Sin migración, sin secreto, sin dependencia nueva.

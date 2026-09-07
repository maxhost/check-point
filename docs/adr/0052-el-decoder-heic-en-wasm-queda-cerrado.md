---
adr: 0052
fecha: 2026-09-05
estado: aceptada
resumen: Cierra el punto 4 del ADR 0047. El QA en un Android real mostró que el cropper ABRE con fotos de galería y el fallback NO se dispara nunca, así que HEIC crudo no llega desde Android y la condición de reapertura del decoder HEVC en WASM no se cumplió. No se embarca WASM (1–2 MB + LGPL-3.0). El fallback se conserva igual, porque su justificación nunca fue Android.
---

# 0052 — El decoder HEIC en WASM queda cerrado

> **Cierra el punto 4 del ADR 0047**, que dejaba la reapertura *condicional a un dato del
> QA*. Los puntos 1, 2 y 3 del 0047 siguen vigentes sin cambios.

## Contexto

El ADR 0047 §4 dijo, con todas las letras, que descartar el decoder HEVC en WASM era una
decisión **con condición de reapertura, no una fecha**:

> *"Si el QA en un Android real muestra que el fallback se dispara seguido, se reevalúa con
> el costo (tamaño + LGPL) sobre la mesa. Si no se dispara, no se vuelve a tocar."*

Ese dato no se podía producir con tests: ningún entorno local reproduce qué entrega el
picker de un Android real. Quedó como residual del owner desde la spec 0040 y era el único
ítem del QA cuyo resultado cambiaba una decisión de arquitectura.

## El dato

QA del owner, 2026-09-05, Android real, subiendo una foto de **galería** en marca
(`/backoffice/brand`):

- El **cropper abrió** ("Encuadra tu imagen").
- El fallback **no se disparó ni una vez**.
- La imagen se guardó correctamente.

## Decisión

1. **La condición del ADR 0047 §4 NO se cumplió: no se embarca un decoder HEVC en WASM.**
   El picker de Android entrega imágenes que el navegador **sí** puede decodificar (JPEG ya
   convertido), que era la hipótesis optimista que el 0047 no podía confirmar. El costo que
   se evitó es el que ese ADR ya había medido: 1–2 MB de WASM real que paga el usuario de
   Android justo cuando espera ver su foto, con licencia **LGPL-3.0** en las dos librerías
   mantenidas y una obligación de relinkeo difusa dentro de un bundle propietario.

2. **El tema queda CERRADO, no diferido.** No hay condición de reapertura nueva. Si en el
   futuro un picker entregara HEIC crudo, el síntoma observable sería el fallback
   disparándose, y eso abre una spec nueva con este ADR como punto de partida — no una
   reapertura automática de éste.

3. **El fallback de decode se conserva exactamente como está.** Esto no es contradictorio:
   su justificación nunca fue Android. El fallback existe porque **el cropper es
   best-effort** (ADR 0047 §1) y porque un navegador que no puede decodificar un archivo no
   debe bloquear la subida. Sigue cubriendo iOS Safari con archivos raros, formatos que
   ningún navegador abra, y cualquier picker futuro. Borrarlo por este dato sería leer el
   ADR 0047 al revés.

## Consecuencias

- **Se cierra el último residual de arquitectura de la spec 0040.** Era el único ítem del
  QA que podía cambiar una decisión, y salió por el lado barato.
- **La deuda de la tarea 43 se abarata y cambia de forma.** El costo del fallback real
  —leer hasta ~6,7 MB de string en base64 antes de rendirse— resulta que **casi no tiene a
  quién afectar** en Android, porque ese camino no se recorre. La opción (c) de esa tarea
  (saltear el retry por data URL cuando el `type` ya es HEIC/HEIF) pierde casi todo su
  valor: ahorraría bytes en un camino que no se transita. Queda en pie la observación de UX
  —hasta 8 s sin señal en pantalla—, que es independiente de este ADR.
- **No cambia una línea de código.** Esta decisión es *no hacer* algo, y su valor es que
  deja de estar pendiente: el ADR 0047 §4 obligaba a volver sobre el tema cada vez que
  alguien leyera el índice.
- **Hallazgo lateral del mismo QA, que NO decide este ADR:** en Android el selector de
  archivos ofrece **sólo galería, nunca la cámara** (en iPhone sí aparece "Tomar foto").
  Es un problema distinto —del atributo `accept`/`capture`, no del decoder— y va a su
  propia tarea.

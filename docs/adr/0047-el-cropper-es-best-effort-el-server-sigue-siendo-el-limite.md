---
adr: 0047
fecha: 2026-09-02
estado: aceptada
resumen: Enmienda el punto 2 del ADR 0041. Los navegadores que no son Safari NO pueden decodificar HEIC (HEVC está bajo patente y no lo licencian), así que un cropper en el cliente no puede ser obligatorio sin romper las fotos de galería de Android — el caso exacto que ya arreglaron dos rondas de QA. El cropper pasa a ser best-effort con fallback al camino de hoy, y por eso `limitInputPixels` queda estricto sólo en el camino con recorte: el server sigue siendo el límite real, no el cliente.
---

# 0047 — El cropper es best-effort; el server sigue siendo el límite

> **Enmienda el ADR 0041**, punto 2 ("el server vuelve a un `limitInputPixels` estricto").
> El punto 1 (recortar en el cliente) y el punto 3 (mobile + desktop, carga diferida) siguen
> vigentes sin cambios.

## Contexto

Al cerrar la spec 0040 apareció un hecho que el ADR 0041 no conocía y que invalida una de
sus consecuencias:

**Chrome, Firefox y Edge no pueden decodificar HEIC.** No es una limitación temporal ni un
flag: HEIC usa el códec **HEVC, que está bajo patente**, y esos navegadores no lo licencian.
Safari sí lo muestra, pero sólo porque delega en el decoder del sistema operativo, que
macOS/iOS ya tienen licenciado para video.

Un cropper **necesita mostrar la imagen** para que el usuario la encuadre. Si el navegador
no puede decodificarla, no hay nada que dibujar.

Y HEIC no es un caso de borde en este producto: es el formato de las fotos de galería de
**Android** (Samsung/Pixel, Android 9+) y de **iPhone**. Está documentado en `CLAUDE.md`
porque ya costó **dos rondas de QA** (specs 0033 y 0039) descubrir que una allow-list
angosta rechazaba justamente esas fotos. Un cropper obligatorio volvería a romper el mismo
caso, por tercera vez y por otro motivo.

Se evaluó y **se descartó** la salida obvia —convertir HEIC en el navegador— porque implica
embarcar un decoder HEVC completo en WebAssembly:

| Paquete | Tamaño | Licencia | Última publicación |
|---|---|---|---|
| `heic2any` | 2.59 MB | MIT (pero empaqueta libheif, LGPL) | **2023-03-29** |
| `libheif-js` | 6.10 MB | **LGPL-3.0** | 2025-06-12 |
| `heic-to` | 23.23 MB | **LGPL-3.0** | 2026-05-26 |

Aun cargado de forma diferida, el WASM real ronda 1–2 MB que paga el usuario de Android
justo cuando espera ver su foto; los dos mantenidos son **LGPL-3.0**, cuya obligación de
relinkeo queda difusa con WASM embebido en un bundle propietario; y **no sabemos con qué
frecuencia llega HEIC crudo** — los pickers de Android a veces entregan JPEG ya convertido.
Pagar tamaño y licencia antes de medir es exactamente la clase de decisión que este
repositorio evita.

## Decisión

1. **El cropper es best-effort, no un peaje.** Si el navegador puede decodificar la imagen,
   el usuario la encuadra y se sube un blob chico y recortado. Si no puede, **se sube el
   archivo original** y el server hace lo que hace hoy. La subida nunca se bloquea por no
   poder mostrar un recuadro.

2. **`limitInputPixels` estricto aplica al camino con recorte, no a todos.** El camino de
   fallback conserva el límite alto (50 MP), porque por ahí sí puede entrar una foto de
   teléfono entera. **Esto enmienda el punto 2 del ADR 0041**, que afirmaba que el límite
   estricto pasaba a ser global una vez implementado el cropper: no es alcanzable mientras
   exista el fallback, y el fallback es obligatorio.

3. **El server sigue siendo el límite real, no el cliente.** El recorte en el cliente es UX
   y ahorro de bytes; **no es un control de seguridad** y no se le delega ninguno. Un
   cliente malicioso siempre puede saltear la UI y hacer el `PUT` a mano, así que
   `normalizeImage` sigue validando formato por bytes, redimensionando y acotando el decode.

4. **Convertir HEIC en el cliente queda descartado por ahora, y su reapertura es
   condicional, no una fecha.** Si el QA en un Android real muestra que el fallback se
   dispara seguido, se reevalúa con el costo (tamaño + LGPL) sobre la mesa. Si no se
   dispara, no se vuelve a tocar.

## Consecuencias

- **La mejora sigue siendo real, pero menor de lo que prometía el 0041.** La mayoría de las
  subidas dejan de decodificarse grandes en el server; la afirmación "el server siempre
  recibe una imagen chica" era falsa y se retira.
- **Se gana algo que el 0041 no contemplaba:** hoy las tres superficies ya recortan a
  cuadrado a ciegas por CSS (`object-fit: cover`), así que el cropper no agrega una
  restricción — le da al usuario control sobre un recorte que ya venía sufriendo sin verlo.
- **Ningún usuario queda peor que hoy.** El fallback es exactamente el comportamiento
  actual, así que el peor caso de esta feature es el statu quo.
- La spec **0040** implementa esto y fija librería, aspectos, borde de salida y orden.

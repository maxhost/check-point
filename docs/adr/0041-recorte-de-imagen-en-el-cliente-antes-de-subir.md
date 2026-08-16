---
fecha: 2026-08-16
resumen: Las subidas de imagen (logo de marca, sello, producto de catálogo) recortan/redimensionan en el CLIENTE antes de subir — con un recuadro de encuadre (drag + zoom, touch y desktop) que exporta un blob ya acotado (≤ borde máximo, aspecto por superficie). Motivo doble: (1) el usuario controla el encuadre en vez de un resize ciego; (2) el server recibe siempre una imagen chica, así puede volver a un `limitInputPixels` estricto (poca superficie de bomba de descompresión) en vez de tener que decodificar fotos de teléfono de 12-50 MP. Requisito: funcionar en mobile Y desktop, con el código del cropper cargado de forma diferida (dynamic import) para no engordar el bundle inicial. Supersede el paliativo de la spec 0039 (subir el límite de decode a 50 MP) una vez implementado.
estado: aceptada (dirección); la selección de librería y los aspectos por superficie los cierra la spec 0040; habilita la spec 0040
---

# ADR 0041 — Recorte de imagen en el cliente antes de subir

## Contexto

El QA de la spec 0039 destapó que `normalizeImage` (server, compartida por marca/sello/catálogo)
**rechazaba toda imagen > 2048×2048** y tenía `limitInputPixels: 2048²` (~4.2 MP), así que
**cualquier foto de cámara de teléfono** (~12 MP, 4000×3000) daba 422 al guardar. El fix inmediato
(spec 0039, enmienda 3) fue **subir `limitInputPixels` a 50 MP** y dejar que el `resize(fit:inside,
2048)` del server las achique.

Ese fix desbloquea, pero tiene un costo real que el owner señaló: para **achicar en el server** hay
que **decodificar** primero, y decodificar 12-50 MP amplía la superficie de **bomba de
descompresión** (un input malicioso de 50 MP ≈ 150 MB de RAM al decodificar; el endpoint es
autenticado —owner/merchant— pero igual es superficie). "Subir el límite" y "resize en el server"
son **incompatibles con mantener un límite de decode estricto**: no se puede reducir lo que no se
decodifica.

La resolución correcta la intuyó el owner: **recortar/redimensionar en el cliente antes de subir**,
como los croppers con cuadrícula/drag/zoom. Así el server nunca recibe la foto gigante.

## Decisión

1. **El recorte/redimensionado ocurre en el cliente, antes de la subida.** Al seleccionar una
   imagen se abre un **recuadro de encuadre** (drag para reposicionar + zoom/pinch), y al confirmar
   el navegador dibuja el área elegida en un `<canvas>` y exporta un **blob acotado** (borde máximo
   ≤ el que hoy usa el server, con el **aspecto** que corresponda a cada superficie). Ese blob chico
   es lo que se sube.

2. **El server vuelve a un `limitInputPixels` estricto** una vez que el cliente garantiza inputs
   chicos — defensa en profundidad: `normalizeImage` sigue validando/redimensionando (un cliente
   malicioso puede saltear la UI), pero con un bound de decode bajo. Esto **supersede** el paliativo
   de 50 MP de la spec 0039.

3. **Debe funcionar en mobile Y desktop.** El flujo es principalmente móvil (foto de cámara/galería)
   pero la subida desde desktop tiene que andar igual. Dos caminos aceptables, la spec 0040 elige:
   - **una** librería liviana que cubra ambos (touch + mouse), o
   - **dos** librerías especializadas cargadas **según plataforma**.
   En cualquier caso, **el código del cropper se carga de forma diferida** (`dynamic import`, solo
   cuando el usuario elige una imagen) para **no engordar el bundle inicial** y mantener la carga
   veloz.

## Consecuencias

- **Nueva dependencia** (o dos) → aplica el gotcha del store de pnpm del CLAUDE.md: `pnpm fetch` en
  una terminal con red antes de la próxima sesión offline.
- **Menos superficie de DoS en el server** y **mejor UX** (encuadre controlado, no resize ciego);
  menos bytes subidos desde el teléfono.
- **Las 3 superficies** (logo de marca, sello, producto de catálogo) adoptan el cropper con su
  aspecto propio; comparten un componente cliente reusable.
- **El paliativo de 50 MP de la 0039 se revierte** al bajar `limitInputPixels` cuando el cropper
  esté en las 3 superficies (no antes, para no re-romper la subida).
- Trabajo futuro: lo detalla y cierra la **spec 0040** (librería, aspectos, orden de superficies,
  fallback si el navegador no soporta canvas/toBlob).

---
spec: 0040
fecha: 2026-08-16
estado: borrador
resumen: Cropper de imagen en el cliente (recuadro con drag + zoom, touch y desktop) para las 3 superficies de subida (logo de marca, sello, producto de catálogo): al elegir una imagen el usuario la encuadra y el navegador exporta un blob ya recortado y acotado antes de subir. Implementa el ADR 0041; una vez en las 3 superficies, baja de nuevo `limitInputPixels` del server al bound estricto (revierte el paliativo de 50 MP de la spec 0039).
disjunta: no
archivos: por definir (cropper cliente reusable + integración en marca/sello/catálogo + ajuste de `server/assets/image.ts`)
---

# 0040 — Recorte de imagen en el cliente

> **Stub — reserva de alcance. No cerrada.** Implementa el **ADR 0041**. Nace del QA de la spec
> **0039**: subir una foto de teléfono como logo daba 422 porque `normalizeImage` rechazaba
> imágenes > 2048². El paliativo (subir `limitInputPixels` a 50 MP + resize en el server) desbloqueó
> pero amplió la superficie de decode; la solución principista es **recortar/reducir en el cliente**.

## Problema

Hoy el redimensionado ocurre en el **server** (`normalizeImage`), lo que obliga a decodificar la
foto completa del teléfono (12-50 MP) — superficie de bomba de descompresión — y el usuario **no
controla el encuadre** (resize ciego, sin recorte). Se quiere que el usuario encuadre (drag + zoom)
y que el server reciba una imagen ya chica.

## Alcance (tentativo)

**Entra:**
- Componente cliente reusable de **recorte** (recuadro con drag + zoom/pinch, **touch y desktop**),
  que exporta un blob acotado (borde máximo + aspecto por superficie) vía `<canvas>` → `toBlob`.
- Integración en las **3 superficies**: logo de marca, sello del programa, imagen de producto del
  catálogo (comparten `normalizeImage` y el patrón de presign).
- **Bajar `limitInputPixels`** del server a un bound estricto una vez que el cliente garantiza
  inputs chicos (revierte el paliativo de 50 MP de la 0039). El server sigue validando/redimensionando
  como defensa en profundidad.
- Carga **diferida** del cropper (`dynamic import`, solo al elegir imagen) para no engordar el bundle.

**No entra:**
- Edición avanzada (filtros, rotación manual más allá del auto-orient EXIF, brillo, etc.).
- Cambiar el formato de salida o el pipeline de variantes WebP/PNG del server.

## Abierto (bloquea el cierre)

- **Librería(s):** una liviana que cubra touch + mouse, **o** dos especializadas cargadas según
  plataforma (ADR 0041 §3). Candidata mencionada: `react-easy-crop` (liviana, touch-friendly).
  Medir peso y soporte desktop antes de fijar. Decidir el criterio de detección de plataforma si
  se van por dos librerías.
- **Aspecto por superficie:** ¿logo **cuadrado** (1:1)? ¿sello cuadrado? ¿producto libre o un ratio
  fijo? Cada superficie fija su aspecto en el cropper.
- **Borde máximo de salida** del blob del cliente y calidad de exportación (`toBlob` quality).
- **Nuevo `limitInputPixels` estricto** del server tras el cropper (p.ej. volver a ~2048² o el que
  corresponda al borde de salida del cliente).
- **Fallback** si el navegador no soporta `canvas.toBlob`/el cropper (¿subir tal cual y que el
  server redimensione como hoy?).
- **Orden de superficies:** ¿las 3 juntas o marca primero?

## Dependencias

- **ADR 0041** — la dirección (recorte en cliente; server con límite estricto después).
- **Spec 0039** — el paliativo de 50 MP que esta spec revierte.
- Gotcha del store de pnpm (CLAUDE.md): la dependencia nueva pide `pnpm fetch` con red antes de la
  próxima sesión offline.

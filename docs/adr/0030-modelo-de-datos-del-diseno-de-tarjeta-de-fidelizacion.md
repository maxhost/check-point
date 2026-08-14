---
fecha: 2026-08-13
resumen: El diseño visual de la tarjeta de Sellos (fondo, fondo 2 de degradé, ángulo, borde) se persiste en columnas dedicadas nullable con checks hex/ángulo a nivel DB —no en jsonb ni en `configuration`—, siguiendo el criterio de 0026 y el precedente de color de `business.ts`; el ángulo de degradé es configurable y los defaults derivan de la marca del negocio.
estado: aceptada
---

# ADR 0030 — Modelo de datos del diseño de tarjeta de fidelización

## Contexto

La spec 0027 agrega el diseño visual de la tarjeta de un programa de **Sellos**: color de fondo
(uno, o dos combinados en degradé lineal), color de borde de los recuadros del sello, y —a
futuro— reutilización en el wallet consumer. La imagen del sello ya se resolvió en 0026 con
columnas dedicadas (`stamp_image_object_key`/`stamp_image_version`) y el comentario explícito de
que **la imagen no vive en `configuration` jsonb**. Falta decidir dónde y cómo persistir los
colores, la dirección del degradé, y de dónde salen los valores iniciales.

El precedente de color en el repo es la marca del negocio: `business.ts` tiene
`brandPrimaryColor`/`brandComplementaryColor`/`brandAccentColor` como columnas `text` con checks
`~ '^#[0-9A-Fa-f]{6}$'` y defaults concretos.

## Decisión

- **Columnas dedicadas, no `jsonb`.** Cuatro columnas nullable en `core.loyalty_program`:
  `card_background_color`, `card_background_color_2`, `card_background_gradient_angle`,
  `card_border_color`. Se sigue el criterio de 0026 (el sello son columnas) y de `business.ts`
  (color = columna con check hex). Ventajas: constraint de patrón `#RRGGBB` y de rango del ángulo
  a nivel DB, queries simples, y tipos explícitos. Un `card_design` jsonb sólo convendría con
  muchos campos variables, y no es el caso.
- **Checks a nivel DB** (tolerando `NULL`, estilo `business_*_color_check`): patrón hex en los tres
  colores, ángulo `0..360`, y un check de pareja: no se persiste `card_background_color_2` sin
  `card_background_color` ni sin `card_background_gradient_angle`.
- **Degradé lineal con ángulo configurable, persistido en grados.** La dirección no es fija: se
  guarda `card_background_gradient_angle` (entero) y la UI ofrece presets (vertical/horizontal/
  diagonal) que lo setean. Sólo se aplica cuando hay 2º color. Se descartan degradés radiales y de
  3+ colores (fuera de alcance de 0027).
- **Nullable ⇒ la DB queda preparada sin trabajo de UI para Puntos.** Los programas de **Puntos** y
  los de Sellos creados antes de esta feature dejan las cuatro columnas en `null`; el server rechaza
  `cardDesign` en Puntos con `422`. Cuando exista un visual de Puntos, las columnas ya están.
- **Defaults derivados de la marca.** Al diseñar un programa **nuevo** de Sellos, los valores
  iniciales vienen de `business.brand*Color` (fondo = primario, fondo 2 = complementario con degradé
  activado, borde = acento), para que la tarjeta arranque coherente con el branding sin que el owner
  toque nada. Son sólo defaults editables; no se copian a la fila hasta guardar.
- **Los colores son diseño público, no secretos.** A diferencia de `*ObjectKey` (claves internas de
  R2, que el DTO oculta), las columnas de color se serializan directo en `toClientProgram`.

## Consecuencias

- Migración **aditiva** (`0013`), verificada en rama Neon efímera y aplicada a prod, sin romper
  programas existentes (todo nullable).
- La validación de color/ángulo vive en `loyalty-program/validation.ts` (`validateCardDesign`),
  reforzada por los checks de DB como segunda línea.
- `CardPreview` es puro-props (sin backend), portable al wallet consumer más adelante.
- Si en el futuro el diseño crece a muchos campos poco estructurados, habría que reconsiderar el
  jsonb; hoy el costo de columnas es mínimo y da garantías que el jsonb no da.

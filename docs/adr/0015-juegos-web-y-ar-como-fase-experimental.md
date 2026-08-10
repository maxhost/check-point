---
fecha: 2026-08-10
resumen: Los juegos V1 son web y el resultado se decide en servidor; realidad aumentada se valida con un spike antes de adoptarse.
estado: propuesta
---

# ADR 0015 — Juegos web y AR como fase experimental

## Propuesta

Implementar ruleta y raspadita como juegos Canvas/WebGL dentro de la PWA. El servidor valida la oportunidad y preasigna el resultado antes de cualquier animación; el cliente no puede elegir ni alterar el premio.

No introducir AR en V1. La futura AR se valida primero con un spike en teléfonos reales y, si es viable, usará 8th Wall autoalojado para tracking y cámara web con renderizado `three.js`, más una alternativa no AR. El primer juego usa un image target/marcador con branding junto al vaso; no depende de reconocer un vaso genérico.

## Consecuencias

- Los nuevos juegos reutilizan un contrato seguro de oportunidades, resultados y activos.
- La realidad aumentada no bloquea el lanzamiento ni impone WebXR a navegadores incompatibles.
- La física calculada en cliente no puede emitir por sí sola un premio de alto valor.

## Estado

Propuesta pendiente de validación del fundador.

---
fecha: 2026-08-11
resumen: El objetivo comercial recomienda una regla inicial, pero los disparadores se eligen de forma independiente según las capacidades verificables del negocio.
estado: aceptada
---

# ADR 0023 — Disparadores independientes de objetivos de campaña

## Contexto

ADR 0022 separó objetivos, mecánicas y efectos. El wizard no debe volver a unirlos al
hacer que un objetivo esconda o fuerce una única mecánica. “Fidelizar”, por ejemplo,
puede iniciarse por un check-in, compra acreditada, canje o referido válido, según las
capacidades del negocio.

## Decisión

El constructor de campaña comienza con un objetivo, que aporta métrica primaria y una
recomendación inicial, pero no bloquea el disparador, condiciones ni distribución. Una
regla se expresa como `objetivo → disparador → condiciones → efecto/distribución →
límites`.

El catálogo de disparadores es independiente del objetivo:

| Disparador | Capacidad requerida |
|---|---|
| Check-in válido | QR/check-in verificado |
| Compra acreditada | POS o validación confiable de staff |
| Canje de cupón | Catálogo de beneficios, instancia emitida y canje atómico |
| Canje de puntos/sellos | Programa activo, wallet y canje atómico |
| Juego completado | Motor de juego y resultado verificable |
| Referido válido | Identidad, atribución y controles antifraude |

La UI muestra los disparadores que conoce. Los que no disponen de su capacidad requerida
se declaran no disponibles y explican la integración o módulo que los habilita; no se
simulan como eventos reales. En el demo sólo se habilitan los eventos ya simulados.

Una combinación se recomienda o advierte según el objetivo, pero la validación final se
hace por evento verificable, guardrails y capacidades disponibles, no por una lista rígida
de “mecánicas permitidas por objetivo”.

## Consecuencias

- El wizard puede crecer sin reescribirse al incorporar POS, canje, juegos o referidos.
- Analíticas mantiene la intención comercial (objetivo) separada de la causa observable
  (disparador).
- El Incentive Engine evalúa disparadores tipados y no asume que un objetivo implique
  check-in.

## Relación

Complementa ADR 0022 y lo prevalece únicamente respecto a disponibilidad y selección de
disparadores en el constructor.

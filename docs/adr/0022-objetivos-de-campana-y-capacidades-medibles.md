---
fecha: 2026-08-11
resumen: Las campañas se crean desde objetivos de negocio; mecánicas, incentivos y distribución se habilitan sólo con eventos verificables y datos suficientes.
estado: aceptada
---

# ADR 0022 — Objetivos de campaña y capacidades medibles

## Decisión

Una campaña se modela como `objetivo → audiencia/contexto → mecánicas/distribución →
incentivo → métrica primaria`. Puntos, sellos, cupones, juegos y check-in no son tipos de
campaña: son efectos, mecánicas o eventos verificables que una campaña puede combinar.

Objetivos universales: atraer tráfico, impulsar demanda en una franja, fidelizar,
reactivar, promover producto/servicio, aumentar consumo/ticket, aumentar permanencia,
descubrimiento mediante directorio/ruta y solicitar feedback genuino.

El wizard habilita un objetivo sólo si están presentes sus datos mínimos:

| Objetivo | Evento/dato mínimo |
|---|---|
| Tráfico, franja, fidelidad, reactivación | check-in/interacción validada y programa cuando aplique |
| Consumo/ticket, producto/servicio | compra acreditada/POS, importe e ítems/categoría cuando aplique |
| Permanencia | inicio/fin de visita o señal de duración confiable |
| Directorio/ruta | distribución y atribución de ruta implementadas |
| Feedback | experiencia real y enlace de reseña/encuesta; no requiere incentivo |

Cada objetivo limita incentivos recomendados: tráfico cupón/puntos; franja puntos,
sellos/cupón; fidelidad sólo el efecto del programa activo; reactivación cupón/juego.
Una primera versión guiada elige un incentivo principal; el motor conserva campañas
compuestas como capacidad avanzada posterior.

No se incentivan reseñas de Google con descuentos, puntos, sellos, bienes o premios.
Google permite solicitar una reseña genuina, pero prohíbe ofrecer incentivos a cambio de
publicar, modificar o retirar reseñas. El objetivo Feedback muestra una solicitud neutral
y mide sólo acciones verificables propias, no una reseña publicada.

## Consecuencias

- Analíticas conoce la métrica primaria desde la definición de campaña.
- El Incentive Engine mantiene reglas/efectos tipados, pero no decide la intención
  comercial del owner.
- El wizard declara por qué un objetivo está bloqueado y qué integración lo habilita; no
  simula ticket, permanencia, ruta ni reseñas como resultados existentes.

## Referencias

- [Política de reseñas incentivadas de Google](https://support.google.com/contributionpolicy/answer/16597558?hl=en)
- [Cómo solicitar reseñas, Google Business Profile](https://support.google.com/business/answer/3474122?hl=en)

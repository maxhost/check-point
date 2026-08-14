---
spec: 0031
fecha: 2026-08-14
estado: borrador
resumen: Al otorgarse puntos/sellos, el consumidor recibe una notificación en su Wallet ("La Gringa te dio…") si ya agregó el pase; si no, la landing de enrolamiento se actualiza en vivo mostrando el resultado sobre la tarjeta del programa; cuarta rebanada del camino A.
disjunta: no
archivos: por definir (depende de 0028, 0029 y 0030)
---

# 0031 — Notificación y landing en vivo

> **Stub — reserva de alcance.** No cerrada. Cuarta rebanada del camino A (ADR 0031).
> Cierra el loop: depende de **0028** (identidad/landing), **0029** (pase + canal de push) y
> **0030** (el otorgamiento que dispara el aviso).

## Problema

Cuando el encargado otorga puntos/sellos (0030), el consumidor debe enterarse en el momento.
Dos caminos según el estado del consumidor:
- **Ya agregó el pase a la Wallet:** recibe una **notificación push** del pase ("La Gringa te
  dio 30 puntos"/"…un sello").
- **Todavía no agregó el pase** (sigue en la landing de 0028): la landing se **actualiza en
  vivo** mostrando los puntos obtenidos o los sellos marcados sobre la tarjeta con el diseño
  del programa (reusa `CardPreview`, spec 0027).

## Alcance (tentativo)

**Entra:** disparo de la notificación push del pase al otorgar (0030 → canal de 0029);
mecanismo de actualización en vivo de la landing (polling o realtime) para el consumidor sin
pase; render del resultado sobre la tarjeta del programa.

**No entra:** el otorgamiento en sí (0030); la emisión del pase (0029); notificaciones de
marketing/campañas (futuro, tier Plus).

## Dependencias

- **Spec 0030** — evento de otorgamiento que dispara el aviso.
- **Spec 0029** — canal de push del pase de Wallet.
- **Spec 0028** — landing y sesión de consumer para la actualización en vivo.
- **Spec 0027** — diseño de tarjeta para renderizar el resultado.

## Abierto (bloquea el cierre)

- Mecanismo de "landing en vivo": polling simple vs canal realtime; ventana de tiempo que la
  landing queda escuchando.
- Contenido y formato exacto de la notificación del pase (Apple/Google).
- Qué pasa si el consumidor cierra la landing antes del otorgamiento y aún no tiene pase
  (¿se pierde el aviso hasta que consulte, o hay un fallback?).
